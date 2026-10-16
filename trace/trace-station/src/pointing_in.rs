//! Heading inputs for direction finding: a fixed bearing, a Hamlib rotctld
//! rotator, an NMEA heading sensor (HDT/HDG/HDM over UDP or TCP), a simulated
//! rotator, or the client's own compass (via control messages).

use std::io::{BufRead, BufReader, Write};
use std::net::{TcpStream, UdpSocket};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::Sender;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use trace_core::pointing::Source;

#[derive(Clone, Debug)]
pub struct PointIn {
    pub unix_ns: u128,
    pub heading: f64,
    pub pitch: Option<f64>,
    pub roll: Option<f64>,
    pub accuracy: Option<f64>,
    pub magnetic: bool,
    pub declination: Option<f64>,
    pub source: Source,
    pub element: u8,
}

pub fn now_ns() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos()
}

fn p(
    heading: f64,
    source: Source,
    magnetic: bool,
    declination: Option<f64>,
    offset: f64,
) -> PointIn {
    PointIn {
        unix_ns: now_ns(),
        heading: (heading + offset).rem_euclid(360.0),
        pitch: None,
        roll: None,
        accuracy: None,
        magnetic,
        declination,
        source,
        element: 0,
    }
}

pub fn fixed(tx: Sender<PointIn>, heading: f64) {
    std::thread::spawn(move || loop {
        if tx
            .send(p(heading, Source::Manual, false, None, 0.0))
            .is_err()
        {
            return;
        }
        std::thread::sleep(Duration::from_secs(1));
    });
}

/// Simulated rotator turning at `deg_per_s`, shared with the simulated receiver.
pub fn sim_rotator(tx: Sender<PointIn>, shared: Arc<AtomicU64>, deg_per_s: f64) {
    std::thread::spawn(move || {
        let t0 = std::time::Instant::now();
        loop {
            let h = (t0.elapsed().as_secs_f64() * deg_per_s).rem_euclid(360.0);
            shared.store((h * 1000.0) as u64, Ordering::Relaxed);
            let mut s = p(h, Source::Rotator, false, None, 0.0);
            s.accuracy = Some(1.0);
            if tx.send(s).is_err() {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    });
}

/// Polls a Hamlib `rotctld` (`p` → azimuth, elevation) ten times a second.
pub fn rotctld(tx: Sender<PointIn>, addr: String, offset: f64, magnetic: bool) {
    std::thread::spawn(move || loop {
        match TcpStream::connect(&addr) {
            Ok(mut s) => {
                s.set_read_timeout(Some(Duration::from_secs(2))).ok();
                let mut r = BufReader::new(s.try_clone().unwrap());
                loop {
                    if s.write_all(b"p\n").is_err() {
                        break;
                    }
                    let (mut az, mut el) = (String::new(), String::new());
                    if r.read_line(&mut az).unwrap_or(0) == 0
                        || r.read_line(&mut el).unwrap_or(0) == 0
                    {
                        break;
                    }
                    if let Ok(a) = az.trim().parse::<f64>() {
                        let mut pt = p(a, Source::Rotator, magnetic, None, offset);
                        pt.pitch = el.trim().parse().ok();
                        if tx.send(pt).is_err() {
                            return;
                        }
                    }
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
            Err(e) => eprintln!("rotctld {addr}: {e}"),
        }
        std::thread::sleep(Duration::from_secs(2));
    });
}

/// Parses one NMEA heading sentence: HDT (true), HDM (magnetic), HDG (magnetic + variation).
pub fn parse_nmea(line: &str) -> Option<(f64, bool, Option<f64>)> {
    let line = line.trim();
    let body = line.strip_prefix('$')?;
    let (data, cs) = body.split_once('*')?;
    let sum = data.bytes().fold(0u8, |a, b| a ^ b);
    if u8::from_str_radix(cs.get(..2)?, 16).ok()? != sum {
        return None;
    }
    let f: Vec<&str> = data.split(',').collect();
    let kind = f.first()?.get(2..)?;
    let h: f64 = f.get(1)?.parse().ok()?;
    match kind {
        "HDT" => Some((h, false, None)),
        "HDM" => Some((h, true, None)),
        "HDG" => {
            let var = f.get(4).and_then(|v| v.parse::<f64>().ok()).map(|v| {
                if f.get(5) == Some(&"W") {
                    -v
                } else {
                    v
                }
            });
            Some((h, true, var))
        }
        _ => None,
    }
}

/// NMEA heading over `udp://bind:port` or `tcp://host:port`.
pub fn nmea(tx: Sender<PointIn>, url: String, offset: f64) {
    std::thread::spawn(move || {
        let send = |line: &str| -> bool {
            if let Some((h, mag, var)) = parse_nmea(line) {
                return tx.send(p(h, Source::Compass, mag, var, offset)).is_ok();
            }
            true
        };
        if let Some(addr) = url.strip_prefix("udp://") {
            match UdpSocket::bind(addr) {
                Ok(s) => {
                    let mut b = [0u8; 2048];
                    while let Ok(n) = s.recv(&mut b) {
                        for l in String::from_utf8_lossy(&b[..n]).lines() {
                            if !send(l) {
                                return;
                            }
                        }
                    }
                }
                Err(e) => eprintln!("NMEA {url}: {e}"),
            }
        } else {
            let addr = url.strip_prefix("tcp://").unwrap_or(&url).to_string();
            loop {
                if let Ok(s) = TcpStream::connect(&addr) {
                    for l in BufReader::new(s).lines().map_while(Result::ok) {
                        if !send(&l) {
                            return;
                        }
                    }
                }
                std::thread::sleep(Duration::from_secs(2));
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::parse_nmea;
    #[test]
    fn nmea_sentences() {
        assert_eq!(
            parse_nmea("$HEHDT,274.07,T*19"),
            Some((274.07, false, None))
        );
        let s = "$HCHDG,98.3,0.0,E,12.6,W";
        let cs = s[1..].bytes().fold(0u8, |a, b| a ^ b);
        assert_eq!(
            parse_nmea(&format!("{s}*{cs:02X}")),
            Some((98.3, true, Some(-12.6)))
        );
        assert_eq!(parse_nmea("$HEHDT,274.07,T*18"), None);
    }
}
