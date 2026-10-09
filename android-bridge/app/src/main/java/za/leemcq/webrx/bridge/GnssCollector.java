package za.leemcq.webrx.bridge;

import android.content.Context;
import android.location.GnssAutomaticGainControl;
import android.location.GnssMeasurement;
import android.location.GnssMeasurementsEvent;
import android.location.GnssStatus;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;

/**
 * GNSS signal quality from the phone's receiver: per-satellite C/N0, elevation,
 * azimuth, carrier frequency and use in fix (GnssStatus), the receiver's
 * automatic gain control level when the chipset reports it (a drop in AGC is a
 * classic sign of in-band interference or jamming), and the current fix.
 */
public final class GnssCollector {
    private final RadioState state;
    private final Handler handler;
    private final LocationManager lm;
    private volatile boolean running;

    private JSONArray sats = new JSONArray();
    private final Map<String, Double> agcByBand = new HashMap<>();
    private long agcTs;
    private JSONObject fix;
    private String error;
    private boolean rawMeasurements;

    private final GnssStatus.Callback statusCallback = new GnssStatus.Callback() {
        @Override
        public void onSatelliteStatusChanged(GnssStatus status) {
            JSONArray a = new JSONArray();
            try {
                for (int i = 0; i < status.getSatelliteCount(); i++) {
                    JSONObject s = new JSONObject();
                    s.put("svid", status.getSvid(i));
                    s.put("constellation", constellation(status.getConstellationType(i)));
                    s.put("cn0", RadioState.v((double) status.getCn0DbHz(i)));
                    s.put("elev", RadioState.v((double) status.getElevationDegrees(i)));
                    s.put("az", RadioState.v((double) status.getAzimuthDegrees(i)));
                    s.put("used", status.usedInFix(i));
                    if (status.hasCarrierFrequencyHz(i)) {
                        double f = status.getCarrierFrequencyHz(i);
                        s.put("freqHz", RadioState.v(f));
                        s.put("band", band(f));
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && status.hasBasebandCn0DbHz(i)) {
                        s.put("basebandCn0", RadioState.v((double) status.getBasebandCn0DbHz(i)));
                    }
                    a.put(s);
                }
            } catch (JSONException ignored) {
            }
            sats = a;
            publish();
        }

        @Override
        public void onStopped() {
            publish();
        }
    };

    private final GnssMeasurementsEvent.Callback measurementCallback = new GnssMeasurementsEvent.Callback() {
        @Override
        @SuppressWarnings("deprecation")
        public void onGnssMeasurementsReceived(GnssMeasurementsEvent event) {
            rawMeasurements = true;
            if (Build.VERSION.SDK_INT >= 34) {
                Collection<GnssAutomaticGainControl> agcs = event.getGnssAutomaticGainControls();
                for (GnssAutomaticGainControl g : agcs) {
                    agcByBand.put(constellation(g.getConstellationType()) + " " + band(g.getCarrierFrequencyHz()), g.getLevelDb());
                }
            } else {
                for (GnssMeasurement m : event.getMeasurements()) {
                    if (m.hasAutomaticGainControlLevelDb()) {
                        String key = constellation(m.getConstellationType())
                                + (m.hasCarrierFrequencyHz() ? " " + band(m.getCarrierFrequencyHz()) : "");
                        agcByBand.put(key, m.getAutomaticGainControlLevelDb());
                    }
                }
            }
            if (!agcByBand.isEmpty()) agcTs = System.currentTimeMillis();
        }
    };

    private final LocationListener locationListener = new LocationListener() {
        @Override
        public void onLocationChanged(Location l) {
            JSONObject f = new JSONObject();
            try {
                f.put("lat", l.getLatitude());
                f.put("lon", l.getLongitude());
                f.put("alt", l.hasAltitude() ? l.getAltitude() : JSONObject.NULL);
                f.put("acc", l.hasAccuracy() ? l.getAccuracy() : JSONObject.NULL);
                f.put("speed", l.hasSpeed() ? l.getSpeed() : JSONObject.NULL);
                f.put("bearing", l.hasBearing() ? l.getBearing() : JSONObject.NULL);
                f.put("time", l.getTime());
                Bundle extras = l.getExtras();
                if (extras != null && extras.containsKey("satellites")) f.put("satellites", extras.getInt("satellites"));
            } catch (JSONException ignored) {
            }
            fix = f;
            publish();
        }

        // Implemented explicitly: these are abstract before Android 11.
        @Override
        public void onStatusChanged(String provider, int status, Bundle extras) {}

        @Override
        public void onProviderEnabled(String provider) {}

        @Override
        public void onProviderDisabled(String provider) {
            error = "Location is turned off";
            publish();
        }
    };

    public GnssCollector(Context ctx, RadioState state, Handler handler) {
        this.state = state;
        this.handler = handler;
        this.lm = (LocationManager) ctx.getSystemService(Context.LOCATION_SERVICE);
    }

    public void start() {
        running = true;
        if (lm == null) {
            error = "No location service";
            publish();
            return;
        }
        try {
            lm.registerGnssStatusCallback(statusCallback, handler);
            lm.registerGnssMeasurementsCallback(measurementCallback, handler);
            if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, locationListener, handler.getLooper());
                error = null;
            } else {
                error = "Turn on Location (GPS) for satellite data";
            }
        } catch (SecurityException e) {
            error = "Location permission needed for GNSS";
        } catch (Exception e) {
            error = String.valueOf(e.getMessage());
        }
        publish();
    }

    public void stop() {
        running = false;
        if (lm == null) return;
        try {
            lm.unregisterGnssStatusCallback(statusCallback);
            lm.unregisterGnssMeasurementsCallback(measurementCallback);
            lm.removeUpdates(locationListener);
        } catch (Exception ignored) {
        }
    }

    private void publish() {
        JSONObject o = new JSONObject();
        try {
            o.put("ts", System.currentTimeMillis());
            o.put("ok", error == null);
            o.put("sats", sats);
            JSONArray agc = new JSONArray();
            for (Map.Entry<String, Double> e : agcByBand.entrySet()) {
                JSONObject g = new JSONObject();
                g.put("band", e.getKey());
                g.put("db", RadioState.v(e.getValue()));
                agc.put(g);
            }
            o.put("agc", agc);
            o.put("agcTs", agcTs == 0 ? JSONObject.NULL : agcTs);
            o.put("rawMeasurements", rawMeasurements);
            o.put("fix", fix == null ? JSONObject.NULL : fix);
            o.put("error", RadioState.v(error));
        } catch (JSONException ignored) {
        }
        state.setGnss(o);
    }

    static String constellation(int t) {
        switch (t) {
            case GnssStatus.CONSTELLATION_GPS: return "GPS";
            case GnssStatus.CONSTELLATION_SBAS: return "SBAS";
            case GnssStatus.CONSTELLATION_GLONASS: return "GLONASS";
            case GnssStatus.CONSTELLATION_QZSS: return "QZSS";
            case GnssStatus.CONSTELLATION_BEIDOU: return "BeiDou";
            case GnssStatus.CONSTELLATION_GALILEO: return "Galileo";
            case 7: return "NavIC";
            default: return "Unknown";
        }
    }

    /** Names the signal band from the carrier frequency. */
    static String band(double hz) {
        double mhz = hz / 1e6;
        if (Math.abs(mhz - 1575.42) < 3) return "L1/E1/B1C";
        if (Math.abs(mhz - 1561.098) < 2) return "B1I";
        if (mhz > 1597 && mhz < 1610) return "G1";
        if (Math.abs(mhz - 1227.60) < 3) return "L2";
        if (Math.abs(mhz - 1176.45) < 3) return "L5/E5a/B2a";
        if (Math.abs(mhz - 1207.14) < 3) return "E5b/B2I";
        if (Math.abs(mhz - 1278.75) < 3) return "E6";
        return String.format(java.util.Locale.ROOT, "%.2f MHz", mhz);
    }
}
