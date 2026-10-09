package za.leemcq.webrx.bridge;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Runtime permissions the bridge needs, per Android version. */
public final class Permissions {
    private Permissions() {}

    public static String[] needed() {
        List<String> p = new ArrayList<>();
        p.add(Manifest.permission.ACCESS_FINE_LOCATION);
        p.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            p.add(Manifest.permission.BLUETOOTH_SCAN);
            p.add(Manifest.permission.BLUETOOTH_CONNECT);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            p.add(Manifest.permission.NEARBY_WIFI_DEVICES);
            p.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        return p.toArray(new String[0]);
    }

    public static boolean granted(Context ctx, String perm) {
        return ctx.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED;
    }

    public static boolean locationGranted(Context ctx) {
        return granted(ctx, Manifest.permission.ACCESS_FINE_LOCATION);
    }

    public static boolean allGranted(Context ctx) {
        for (String p : needed()) if (!granted(ctx, p)) return false;
        return true;
    }

    public static boolean locationServicesOn(Context ctx) {
        LocationManager lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return lm.isLocationEnabled();
        return lm.isProviderEnabled(LocationManager.GPS_PROVIDER) || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
    }

    public static JSONObject summary(Context ctx) {
        JSONObject o = new JSONObject();
        try {
            o.put("location", locationGranted(ctx));
            o.put("locationServices", locationServicesOn(ctx));
            o.put("bluetooth", Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                    || granted(ctx, Manifest.permission.BLUETOOTH_SCAN));
            o.put("nearbyWifi", Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                    || granted(ctx, Manifest.permission.NEARBY_WIFI_DEVICES));
        } catch (JSONException ignored) {
        }
        return o;
    }
}
