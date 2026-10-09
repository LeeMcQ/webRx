package za.leemcq.webrx.bridge;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.os.Build;
import android.os.Handler;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * Bluetooth Low Energy advertisers in range with RSSI. Devices not heard for
 * 30 s are dropped. The scan is restarted every 10 minutes because Android
 * silently downgrades long-running scans.
 */
public final class BleCollector {
    private static final long PUBLISH_MS = 1000;
    private static final long EXPIRE_MS = 30000;
    private static final long RESTART_MS = 10 * 60 * 1000;

    private final Context ctx;
    private final RadioState state;
    private final Handler handler;
    private volatile boolean running;
    private BluetoothLeScanner scanner;
    private long scanStartedAt;
    private String error;

    private static final class Seen {
        String address;
        String name;
        int rssi;
        int txPower = Integer.MAX_VALUE;
        long ts;
        int count;
    }

    private final Map<String, Seen> devices = new HashMap<>();

    private final ScanCallback callback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult r) {
            record(r);
        }

        @Override
        public void onScanFailed(int errorCode) {
            error = "BLE scan failed (" + errorCode + ")";
        }
    };

    public BleCollector(Context ctx, RadioState state, Handler handler) {
        this.ctx = ctx;
        this.state = state;
        this.handler = handler;
    }

    public void start() {
        running = true;
        startScan();
        handler.post(this::loop);
    }

    public void stop() {
        running = false;
        stopScan();
    }

    private void startScan() {
        try {
            BluetoothManager bm = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter ad = bm == null ? null : bm.getAdapter();
            if (ad == null) {
                error = "No Bluetooth on this device";
                return;
            }
            if (!ad.isEnabled()) {
                error = "Bluetooth is off";
                return;
            }
            scanner = ad.getBluetoothLeScanner();
            if (scanner == null) {
                error = "Bluetooth LE scanner unavailable";
                return;
            }
            ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                    .build();
            scanner.startScan(null, settings, callback);
            scanStartedAt = System.currentTimeMillis();
            error = null;
        } catch (SecurityException e) {
            error = "Nearby-devices permission needed for Bluetooth scans";
        } catch (Exception e) {
            error = String.valueOf(e.getMessage());
        }
    }

    private void stopScan() {
        try {
            if (scanner != null) scanner.stopScan(callback);
        } catch (Exception ignored) {
        }
        scanner = null;
    }

    private void loop() {
        if (!running) return;
        long now = System.currentTimeMillis();
        if (scanner == null || now - scanStartedAt > RESTART_MS) {
            stopScan();
            startScan();
        }
        publish(now);
        handler.postDelayed(this::loop, PUBLISH_MS);
    }

    private void record(ScanResult r) {
        String addr;
        try {
            addr = r.getDevice().getAddress();
        } catch (SecurityException e) {
            addr = "unknown-" + Integer.toHexString(r.getDevice().hashCode());
        }
        Seen s;
        synchronized (devices) {
            s = devices.get(addr);
            if (s == null) {
                s = new Seen();
                s.address = addr;
                devices.put(addr, s);
            }
            s.rssi = r.getRssi();
            s.ts = System.currentTimeMillis();
            s.count++;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.txPower = r.getTxPower();
            ScanRecord rec = r.getScanRecord();
            if (rec != null && rec.getDeviceName() != null) s.name = rec.getDeviceName();
        }
    }

    private void publish(long now) {
        JSONObject o = new JSONObject();
        try {
            o.put("ts", now);
            JSONArray a = new JSONArray();
            synchronized (devices) {
                Iterator<Map.Entry<String, Seen>> it = devices.entrySet().iterator();
                while (it.hasNext()) {
                    Seen s = it.next().getValue();
                    if (now - s.ts > EXPIRE_MS) {
                        it.remove();
                        continue;
                    }
                    JSONObject d = new JSONObject();
                    d.put("address", s.address);
                    d.put("name", RadioState.v(s.name));
                    d.put("rssi", s.rssi);
                    d.put("txPower", s.txPower == ScanResult.TX_POWER_NOT_PRESENT ? JSONObject.NULL : RadioState.v(s.txPower));
                    d.put("ageMs", now - s.ts);
                    d.put("adverts", s.count);
                    a.put(d);
                }
            }
            o.put("devices", a);
            o.put("ok", error == null);
            o.put("error", RadioState.v(error));
        } catch (JSONException ignored) {
        }
        state.setBle(o);
    }
}
