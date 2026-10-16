//! HTTP + WebSocket front end (WebTransport/MOQT is milestone M2).
//!
//! `GET /trace.json` — station description (CORS open, Private Network Access allowed).
//! `GET /trace/ws`   — one WebSocket per client; every binary message is one TRACE frame.

use crate::engine::DspCmd;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{ConnectInfo, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};
use trace_core::context::{from_cbor, ClientMsg};
use trace_core::header::{parse, Header};
use trace_core::{codec, Tier};

#[derive(Clone)]
pub struct AppState {
    pub dsp: Arc<Mutex<Sender<DspCmd>>>,
    pub info: Arc<serde_json::Value>,
    pub next: Arc<AtomicU64>,
}

fn cors(mut r: Response) -> Response {
    let h = r.headers_mut();
    h.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_static("*"),
    );
    h.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("*"),
    );
    h.insert(
        "Access-Control-Allow-Private-Network",
        HeaderValue::from_static("true"),
    );
    r
}

async fn info(State(s): State<AppState>) -> Response {
    cors(
        (
            [
                (header::CONTENT_TYPE, "application/json"),
                (header::CACHE_CONTROL, "no-store"),
            ],
            s.info.to_string(),
        )
            .into_response(),
    )
}

async fn preflight() -> Response {
    cors(StatusCode::NO_CONTENT.into_response())
}

async fn ws(
    ws: WebSocketUpgrade,
    State(s): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    _h: HeaderMap,
) -> Response {
    ws.max_message_size(1 << 20)
        .on_upgrade(move |sock| session(sock, s, addr))
}

async fn session(sock: WebSocket, s: AppState, addr: SocketAddr) {
    let id = s.next.fetch_add(1, Ordering::Relaxed);
    let (crit_tx, mut crit_rx) = tokio::sync::mpsc::unbounded_channel::<Vec<u8>>();
    let (media_tx, mut media_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(96);
    let send = |c: DspCmd| {
        let _ = s.dsp.lock().unwrap().send(c);
    };
    send(DspCmd::Add {
        id,
        peer: addr.to_string(),
        crit: crit_tx,
        media: media_tx,
    });
    let (mut tx, mut rx) = sock.split();
    let writer = tokio::spawn(async move {
        loop {
            let m = tokio::select! {
                biased;
                m = crit_rx.recv() => m,
                m = media_rx.recv() => m,
            };
            let Some(m) = m else { break };
            if tx.send(Message::Binary(m.into())).await.is_err() {
                break;
            }
        }
    });
    while let Some(Ok(m)) = rx.next().await {
        let Message::Binary(b) = m else {
            if matches!(m, Message::Close(_)) {
                break;
            }
            continue;
        };
        // client messages are TRACE frames on the control track, CBOR payload
        let Ok((h, payload)) = parse(&b) else {
            continue;
        };
        let ok = match &h {
            Header::Full(f) => f.tier == Tier::Control as u8 && f.codec == codec::CBOR,
            Header::Compact(_) => false,
        };
        if !ok {
            continue;
        }
        match from_cbor::<ClientMsg>(payload) {
            Ok(msg) => send(DspCmd::Msg { id, msg }),
            Err(e) => eprintln!("client {id}: bad message: {e}"),
        }
    }
    send(DspCmd::Remove { id });
    writer.abort();
}

pub async fn serve(listen: SocketAddr, state: AppState) -> std::io::Result<()> {
    let app = Router::new()
        .route("/trace.json", get(info).options(preflight))
        .route("/trace/ws", get(ws))
        .with_state(state);
    let l = tokio::net::TcpListener::bind(listen).await?;
    eprintln!("TRACE station listening on http://{listen}/ (WebSocket /trace/ws)");
    axum::serve(l, app.into_make_service_with_connect_info::<SocketAddr>()).await
}
