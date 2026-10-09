package za.leemcq.webrx.bridge;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.SystemClock;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

/**
 * Wi-Fi access points in range (RSSI, frequency, channel width, standard) and
 * the connected link. Android throttles app-initiated scans (about 4 per
 * 2 minutes in the foreground, fewer in the background); results from system
 * scans are picked up as well. Turning off "Wi-Fi scan throttling" in Developer
 * options allows continuous scanning.
 */
public final class WifiCollector {
    private static final long READ_PERIOD_MS = 2000;
    private static final long SCAN_PERIOD_MS = 15000;

    private final Context ctx;
    private final RadioState state;
    private final Handler handler;
    private final WifiManager wm;
    private volatile boolean running;
    private long lastScanRequest;
    private long lastScanResults;
    private boolean lastScanAccepted = true;
    private String error;

    private final BroadcastReceiver receiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            lastScanResults = System.currentTimeMillis();
            handler.post(WifiCollector.this::read);
        }
    };

    public WifiCollector(Context ctx, RadioState state, Handler handler) {
        this.ctx = ctx;
        this.state = state;
        this.handler = handler;
        this.wm = (WifiManager) ctx.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
    }

    public void start() {
        running = true;
        IntentFilter f = new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ctx.registerReceiver(receiver, f, null, handler, Context.RECEIVER_NOT_EXPORTED);
            } else {
                ctx.registerReceiver(receiver, f, null, handler);
            }
        } catch (Exception e) {
            error = "Could not listen for scans: " + e.getMessage();
        }
        handler.post(this::loop);
    }

    public void stop() {
        running = false;
        try {
            ctx.unregisterReceiver(receiver);
        } catch (Exception ignored) {
        }
    }

    /** Asks for a scan now (may be refused by Android's throttling). */
    public void requestScan() {
        handler.post(() -> scan(true));
    }

    private void loop() {
        if (!running) return;
        scan(false);
        read();
        handler.postDelayed(this::loop, READ_PERIOD_MS);
    }

    @SuppressWarnings("deprecation")
    private void scan(boolean force) {
        if (wm == null) return;
        long now = System.currentTimeMillis();
        if (!force && now - lastScanRequest < SCAN_PERIOD_MS) return;
        lastScanRequest = now;
        try {
            lastScanAccepted = wm.startScan();
        } catch (SecurityException e) {
            error = "Location / nearby-devices permission needed for Wi-Fi scans";
            lastScanAccepted = false;
        }
    }

    @SuppressWarnings("deprecation")
    private void read() {
        if (!running) return;
        JSONObject o = new JSONObject();
        try {
            o.put("ts", System.currentTimeMillis());
            if (wm == null) {
                o.put("ok", false);
                o.put("error", "No Wi-Fi on this device");
                state.setWifi(o);
                return;
            }
            o.put("enabled", wm.isWifiEnabled());
            o.put("scanThrottled", !lastScanAccepted);
            o.put("lastResultsAt", lastScanResults == 0 ? JSONObject.NULL : lastScanResults);

            JSONArray aps = new JSONArray();
            List<ScanResult> results = null;
            try {
                results = wm.getScanResults();
            } catch (SecurityException e) {
                error = "Location / nearby-devices permission needed for Wi-Fi scans";
            }
            long bootMs = System.currentTimeMillis() - SystemClock.elapsedRealtime();
            long newest = 0;
            if (results != null) {
                for (ScanResult r : results) {
                    JSONObject a = new JSONObject();
                    a.put("ssid", RadioState.v(r.SSID));
                    a.put("bssid", RadioState.v(r.BSSID));
                    a.put("rssi", r.level);
                    a.put("freq", r.frequency);
                    a.put("channel", channel(r.frequency));
                    a.put("widthMhz", widthMhz(r.channelWidth));
                    a.put("center0", r.centerFreq0);
                    a.put("security", RadioState.v(r.capabilities));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) a.put("standard", standard(r.getWifiStandard()));
                    long seen = bootMs + r.timestamp / 1000;
                    a.put("seenAt", seen);
                    newest = Math.max(newest, seen);
                    aps.put(a);
                }
            }
            o.put("aps", aps);
            o.put("scanAt", newest == 0 ? JSONObject.NULL : newest);

            WifiInfo info = wm.getConnectionInfo();
            if (info != null && info.getNetworkId() != -1) {
                JSONObject c = new JSONObject();
                c.put("ssid", RadioState.v(info.getSSID()));
                c.put("bssid", RadioState.v(info.getBSSID()));
                c.put("rssi", info.getRssi());
                c.put("freq", info.getFrequency());
                c.put("channel", channel(info.getFrequency()));
                c.put("linkMbps", info.getLinkSpeed());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    c.put("txMbps", RadioState.v(info.getTxLinkSpeedMbps()));
                    c.put("rxMbps", RadioState.v(info.getRxLinkSpeedMbps()));
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) c.put("standard", standard(info.getWifiStandard()));
                o.put("connected", c);
            } else {
                o.put("connected", JSONObject.NULL);
            }
            o.put("ok", results != null);
            o.put("error", RadioState.v(error));
        } catch (JSONException ignored) {
        }
        state.setWifi(o);
    }

    static int channel(int freq) {
        if (freq == 2484) return 14;
        if (freq >= 2412 && freq <= 2472) return (freq - 2407) / 5;
        if (freq >= 5955 && freq <= 7115) return (freq - 5950) / 5; // 6 GHz
        if (freq >= 5000 && freq <= 5900) return (freq - 5000) / 5;
        return 0;
    }

    static int widthMhz(int code) {
        switch (code) {
            case ScanResult.CHANNEL_WIDTH_40MHZ: return 40;
            case ScanResult.CHANNEL_WIDTH_80MHZ: return 80;
            case ScanResult.CHANNEL_WIDTH_160MHZ: return 160;
            case ScanResult.CHANNEL_WIDTH_80MHZ_PLUS_MHZ: return 160;
            case 5: return 320; // CHANNEL_WIDTH_320MHZ (API 33)
            default: return 20;
        }
    }

    static String standard(int s) {
        switch (s) {
            case 1: return "legacy";
            case 4: return "802.11n";
            case 5: return "802.11ac";
            case 6: return "802.11ax";
            case 7: return "802.11ad";
            case 8: return "802.11be";
            default: return "unknown";
        }
    }
}
