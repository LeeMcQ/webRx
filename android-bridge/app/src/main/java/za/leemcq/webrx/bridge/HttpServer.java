package za.leemcq.webrx.bridge;

import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Minimal HTTP server bound to 127.0.0.1 only, so the measurements never leave
 * the phone. The webRx website (running in Chrome on the same phone) polls it.
 *
 * Endpoints: GET /status, GET /snapshot, POST /wifi/scan.
 * CORS is limited to the webRx site and local development origins, and the
 * Private/Local Network Access preflight header is answered.
 */
public final class HttpServer {
    public static final int PORT = 8737;
    private static final String TAG = "RadioBridgeHttp";

    /** Origins allowed to read measurements (location and nearby networks are personal data). */
    private static final String[] ALLOWED_ORIGIN_PREFIXES = {
        "https://leemcq.github.io",
        "http://localhost",
        "http://127.0.0.1",
        "https://localhost",
    };

    public interface Actions {
        void requestWifiScan();
    }

    private final RadioState state;
    private final Actions actions;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private volatile ServerSocket server;
    private Thread acceptThread;

    public HttpServer(RadioState state, Actions actions) {
        this.state = state;
        this.actions = actions;
    }

    public synchronized void start() throws IOException {
        if (server != null) return;
        ServerSocket s = new ServerSocket();
        s.setReuseAddress(true);
        s.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), PORT), 16);
        server = s;
        acceptThread = new Thread(this::acceptLoop, "bridge-http");
        acceptThread.setDaemon(true);
        acceptThread.start();
    }

    public synchronized void stop() {
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
        server = null;
        pool.shutdownNow();
    }

    public boolean isRunning() {
        ServerSocket s = server;
        return s != null && !s.isClosed();
    }

    private void acceptLoop() {
        while (true) {
            ServerSocket s = server;
            if (s == null || s.isClosed()) return;
            try {
                Socket client = s.accept();
                pool.execute(() -> handle(client));
            } catch (IOException e) {
                if (server == null) return;
                Log.w(TAG, "accept failed", e);
            } catch (Exception e) {
                Log.w(TAG, "rejected", e);
            }
        }
    }

    static boolean originAllowed(String origin) {
        if (origin == null) return true; // native tools (curl, adb forward)
        for (String p : ALLOWED_ORIGIN_PREFIXES) {
            if (origin.equals(p) || origin.startsWith(p + ":") || origin.startsWith(p + "/")) return true;
        }
        return false;
    }

    private void handle(Socket socket) {
        try (Socket s = socket) {
            s.setSoTimeout(5000);
            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.ISO_8859_1));
            String requestLine = in.readLine();
            if (requestLine == null) return;
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0].toUpperCase(Locale.ROOT);
            String path = parts[1];
            int q = path.indexOf('?');
            if (q >= 0) path = path.substring(0, q);

            Map<String, String> headers = new HashMap<>();
            String line;
            while ((line = in.readLine()) != null && !line.isEmpty()) {
                int c = line.indexOf(':');
                if (c > 0) headers.put(line.substring(0, c).trim().toLowerCase(Locale.ROOT), line.substring(c + 1).trim());
            }
            String origin = headers.get("origin");
            OutputStream out = s.getOutputStream();

            if (!originAllowed(origin)) {
                write(out, 403, "Forbidden", null, "application/json", "{\"error\":\"origin not allowed\"}");
                return;
            }
            if ("OPTIONS".equals(method)) {
                StringBuilder extra = new StringBuilder();
                extra.append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
                String reqHeaders = headers.get("access-control-request-headers");
                extra.append("Access-Control-Allow-Headers: ").append(reqHeaders != null ? reqHeaders : "Content-Type").append("\r\n");
                extra.append("Access-Control-Max-Age: 600\r\n");
                if (headers.containsKey("access-control-request-private-network")
                        || headers.containsKey("access-control-request-local-network")) {
                    extra.append("Access-Control-Allow-Private-Network: true\r\n");
                    extra.append("Access-Control-Allow-Local-Network: true\r\n");
                }
                writeRaw(out, 204, "No Content", origin, extra.toString(), null, null);
                return;
            }

            if ("GET".equals(method) && "/status".equals(path)) {
                write(out, 200, "OK", origin, "application/json", state.status().toString());
            } else if ("GET".equals(method) && "/snapshot".equals(path)) {
                write(out, 200, "OK", origin, "application/json", state.snapshot().toString());
            } else if ("POST".equals(method) && "/wifi/scan".equals(path)) {
                actions.requestWifiScan();
                write(out, 202, "Accepted", origin, "application/json", "{\"requested\":true}");
            } else if ("GET".equals(method) && "/".equals(path)) {
                write(out, 200, "OK", origin, "text/plain",
                        "webRx Radio Bridge is running. Open the webRx monitor in Chrome on this phone.\n");
            } else {
                write(out, 404, "Not Found", origin, "application/json", "{\"error\":\"not found\"}");
            }
        } catch (IOException e) {
            // Client went away; nothing to do.
        } catch (Exception e) {
            Log.w(TAG, "request failed", e);
        }
    }

    private static void write(OutputStream out, int code, String reason, String origin, String type, String body) throws IOException {
        writeRaw(out, code, reason, origin, "", type, body);
    }

    private static void writeRaw(OutputStream out, int code, String reason, String origin, String extraHeaders,
                                 String type, String body) throws IOException {
        byte[] bytes = body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8);
        StringBuilder h = new StringBuilder();
        h.append("HTTP/1.1 ").append(code).append(' ').append(reason).append("\r\n");
        if (origin != null) {
            h.append("Access-Control-Allow-Origin: ").append(origin).append("\r\n");
            h.append("Vary: Origin\r\n");
        }
        if (type != null) h.append("Content-Type: ").append(type).append("; charset=utf-8\r\n");
        h.append("Cache-Control: no-store\r\n");
        h.append("Content-Length: ").append(bytes.length).append("\r\n");
        h.append("Connection: close\r\n");
        h.append(extraHeaders);
        h.append("\r\n");
        out.write(h.toString().getBytes(StandardCharsets.ISO_8859_1));
        out.write(bytes);
        out.flush();
    }
}
