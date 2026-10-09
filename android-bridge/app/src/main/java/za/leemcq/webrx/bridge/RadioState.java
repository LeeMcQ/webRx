package za.leemcq.webrx.bridge;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Latest measurements from every collector. Collectors replace their section
 * whole; the HTTP server reads a consistent snapshot.
 */
public final class RadioState {
    public static final int API_VERSION = 1;

    private JSONObject cell = section();
    private JSONObject wifi = section();
    private JSONObject gnss = section();
    private JSONObject ble = section();
    private JSONObject permissions = new JSONObject();
    private final long startedAt = System.currentTimeMillis();

    private static JSONObject section() {
        JSONObject o = new JSONObject();
        try {
            o.put("ok", false);
            o.put("ts", 0);
        } catch (JSONException ignored) {
        }
        return o;
    }

    public synchronized void setCell(JSONObject o) { cell = o; }
    public synchronized void setWifi(JSONObject o) { wifi = o; }
    public synchronized void setGnss(JSONObject o) { gnss = o; }
    public synchronized void setBle(JSONObject o) { ble = o; }
    public synchronized void setPermissions(JSONObject o) { permissions = o; }

    public synchronized int cellCount() { return count(cell, "cells"); }
    public synchronized int wifiCount() { return count(wifi, "aps"); }
    public synchronized int gnssCount() { return count(gnss, "sats"); }
    public synchronized int bleCount() { return count(ble, "devices"); }

    private static int count(JSONObject o, String key) {
        JSONArray a = o.optJSONArray(key);
        return a == null ? 0 : a.length();
    }

    public synchronized JSONObject status() {
        JSONObject o = new JSONObject();
        try {
            o.put("app", "webrx-radio-bridge");
            o.put("api", API_VERSION);
            o.put("version", BuildConfigInfo.versionName());
            o.put("device", android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL);
            o.put("android", android.os.Build.VERSION.RELEASE);
            o.put("sdk", android.os.Build.VERSION.SDK_INT);
            o.put("uptimeMs", System.currentTimeMillis() - startedAt);
            o.put("permissions", permissions);
            JSONObject counts = new JSONObject();
            counts.put("cells", cellCount());
            counts.put("wifi", wifiCount());
            counts.put("gnss", gnssCount());
            counts.put("ble", bleCount());
            o.put("counts", counts);
        } catch (JSONException ignored) {
        }
        return o;
    }

    public synchronized JSONObject snapshot() {
        JSONObject o = new JSONObject();
        try {
            o.put("ts", System.currentTimeMillis());
            o.put("status", status());
            o.put("cell", cell);
            o.put("wifi", wifi);
            o.put("gnss", gnss);
            o.put("ble", ble);
        } catch (JSONException ignored) {
        }
        return o;
    }

    /** Converts Android's "unavailable" sentinels to JSON null. */
    public static Object v(int value) {
        return value == Integer.MAX_VALUE || value == Integer.MIN_VALUE ? JSONObject.NULL : value;
    }

    public static Object v(long value) {
        return value == Long.MAX_VALUE || value == Long.MIN_VALUE ? JSONObject.NULL : value;
    }

    public static Object v(double value) {
        return Double.isNaN(value) || Double.isInfinite(value) ? JSONObject.NULL : value;
    }

    public static Object v(String value) {
        return value == null ? JSONObject.NULL : value;
    }
}
