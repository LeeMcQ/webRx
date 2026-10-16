//! CRC-32C (Castagnoli) for full headers, CRC-16/CCITT-FALSE for compact headers.

const fn crc32c_table() -> [u32; 256] {
    let mut t = [0u32; 256];
    let mut i = 0;
    while i < 256 {
        let mut c = i as u32;
        let mut k = 0;
        while k < 8 {
            c = if c & 1 != 0 {
                0x82F6_3B78 ^ (c >> 1)
            } else {
                c >> 1
            };
            k += 1;
        }
        t[i] = c;
        i += 1;
    }
    t
}

const fn crc16_table() -> [u16; 256] {
    let mut t = [0u16; 256];
    let mut i = 0;
    while i < 256 {
        let mut c = (i as u16) << 8;
        let mut k = 0;
        while k < 8 {
            c = if c & 0x8000 != 0 {
                (c << 1) ^ 0x1021
            } else {
                c << 1
            };
            k += 1;
        }
        t[i] = c;
        i += 1;
    }
    t
}

static T32: [u32; 256] = crc32c_table();
static T16: [u16; 256] = crc16_table();

/// CRC-32C over several slices (as if concatenated).
pub fn crc32c(parts: &[&[u8]]) -> u32 {
    let mut c = 0xFFFF_FFFFu32;
    for p in parts {
        for &b in *p {
            c = T32[((c ^ b as u32) & 0xff) as usize] ^ (c >> 8);
        }
    }
    !c
}

/// CRC-16/CCITT-FALSE over several slices.
pub fn crc16(parts: &[&[u8]]) -> u16 {
    let mut c = 0xFFFFu16;
    for p in parts {
        for &b in *p {
            c = T16[(((c >> 8) as u8) ^ b) as usize] ^ (c << 8);
        }
    }
    c
}

#[cfg(test)]
mod tests {
    #[test]
    fn check_values() {
        // catalogue check values for "123456789"
        assert_eq!(super::crc32c(&[b"123456789"]), 0xE306_9283);
        assert_eq!(super::crc16(&[b"123456789"]), 0x29B1);
        assert_eq!(super::crc32c(&[b"1234", b"56789"]), 0xE306_9283);
    }
}
