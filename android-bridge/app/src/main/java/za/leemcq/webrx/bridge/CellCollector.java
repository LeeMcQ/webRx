package za.leemcq.webrx.bridge;

import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.telephony.CellIdentityGsm;
import android.telephony.CellIdentityLte;
import android.telephony.CellIdentityNr;
import android.telephony.CellIdentityWcdma;
import android.telephony.CellInfo;
import android.telephony.CellInfoGsm;
import android.telephony.CellInfoLte;
import android.telephony.CellInfoNr;
import android.telephony.CellInfoWcdma;
import android.telephony.CellSignalStrength;
import android.telephony.CellSignalStrengthGsm;
import android.telephony.CellSignalStrengthLte;
import android.telephony.CellSignalStrengthNr;
import android.telephony.CellSignalStrengthWcdma;
import android.telephony.TelephonyManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;
import java.util.concurrent.Executor;

/**
 * Serving and neighbour cells from the modem: RSRP/RSRQ/SINR/RSSI, band,
 * channel, PCI and cell identity for LTE, 5G NR, UMTS and GSM.
 * Requires ACCESS_FINE_LOCATION.
 */
public final class CellCollector {
    private static final long PERIOD_MS = 2000;

    private final Context ctx;
    private final RadioState state;
    private final Handler handler;
    private final Executor executor;
    private final TelephonyManager tm;
    private volatile boolean running;
    private String lastError;

    public CellCollector(Context ctx, RadioState state, Handler handler) {
        this.ctx = ctx;
        this.state = state;
        this.handler = handler;
        this.executor = handler::post;
        this.tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
    }

    public void start() {
        running = true;
        handler.post(this::tick);
    }

    public void stop() {
        running = false;
    }

    private void tick() {
        if (!running) return;
        try {
            if (tm == null) {
                publish(null, "No telephony on this device");
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                tm.requestCellInfoUpdate(executor, new TelephonyManager.CellInfoCallback() {
                    @Override
                    public void onCellInfo(List<CellInfo> cellInfo) {
                        publish(cellInfo, null);
                    }

                    @Override
                    public void onError(int errorCode, Throwable detail) {
                        // Fall back to the cached list.
                        publishCached("Modem update error " + errorCode);
                    }
                });
            } else {
                publishCached(null);
            }
        } catch (SecurityException e) {
            publish(null, "Location permission needed for cell info");
        } catch (Exception e) {
            publish(null, String.valueOf(e.getMessage()));
        }
        handler.postDelayed(this::tick, PERIOD_MS);
    }

    private void publishCached(String note) {
        try {
            publish(tm.getAllCellInfo(), note);
        } catch (SecurityException e) {
            publish(null, "Location permission needed for cell info");
        }
    }

    private void publish(List<CellInfo> list, String error) {
        JSONObject o = new JSONObject();
        try {
            o.put("ts", System.currentTimeMillis());
            JSONArray cells = new JSONArray();
            if (list != null) {
                for (CellInfo ci : list) {
                    JSONObject c = describe(ci);
                    if (c != null) cells.put(c);
                }
            }
            o.put("ok", list != null);
            o.put("cells", cells);
            o.put("operator", tm != null ? RadioState.v(tm.getNetworkOperatorName()) : JSONObject.NULL);
            o.put("simOperator", tm != null ? RadioState.v(tm.getSimOperatorName()) : JSONObject.NULL);
            o.put("error", RadioState.v(error));
        } catch (JSONException ignored) {
        }
        lastError = error;
        state.setCell(o);
    }

    public String lastError() {
        return lastError;
    }

    private static JSONObject describe(CellInfo ci) throws JSONException {
        JSONObject c = new JSONObject();
        c.put("registered", ci.isRegistered());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            int st = ci.getCellConnectionStatus();
            c.put("connection", st == CellInfo.CONNECTION_PRIMARY_SERVING ? "primary"
                    : st == CellInfo.CONNECTION_SECONDARY_SERVING ? "secondary"
                    : st == CellInfo.CONNECTION_NONE ? "none" : "unknown");
        }
        if (ci instanceof CellInfoLte) {
            CellInfoLte lte = (CellInfoLte) ci;
            CellIdentityLte id = lte.getCellIdentity();
            CellSignalStrengthLte ss = lte.getCellSignalStrength();
            c.put("tech", "LTE");
            c.put("arfcn", RadioState.v(id.getEarfcn()));
            c.put("pci", RadioState.v(id.getPci()));
            c.put("tac", RadioState.v(id.getTac()));
            c.put("cid", RadioState.v(id.getCi()));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                c.put("mcc", RadioState.v(id.getMccString()));
                c.put("mnc", RadioState.v(id.getMncString()));
                c.put("bandwidthKhz", RadioState.v(id.getBandwidth()));
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) c.put("bands", bands(id.getBands()));
            c.put("rsrp", RadioState.v(ss.getRsrp()));
            c.put("rsrq", RadioState.v(ss.getRsrq()));
            c.put("sinr", RadioState.v(ss.getRssnr()));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) c.put("rssi", RadioState.v(ss.getRssi()));
            c.put("cqi", RadioState.v(ss.getCqi()));
            c.put("ta", RadioState.v(ss.getTimingAdvance()));
            common(c, ss);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && ci instanceof CellInfoNr) {
            CellInfoNr nr = (CellInfoNr) ci;
            CellIdentityNr id = (CellIdentityNr) nr.getCellIdentity();
            CellSignalStrengthNr ss = (CellSignalStrengthNr) nr.getCellSignalStrength();
            c.put("tech", "NR");
            c.put("arfcn", RadioState.v(id.getNrarfcn()));
            c.put("pci", RadioState.v(id.getPci()));
            c.put("tac", RadioState.v(id.getTac()));
            c.put("cid", RadioState.v(id.getNci()));
            c.put("mcc", RadioState.v(id.getMccString()));
            c.put("mnc", RadioState.v(id.getMncString()));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) c.put("bands", bands(id.getBands()));
            c.put("rsrp", RadioState.v(ss.getSsRsrp()));
            c.put("rsrq", RadioState.v(ss.getSsRsrq()));
            c.put("sinr", RadioState.v(ss.getSsSinr()));
            c.put("csiRsrp", RadioState.v(ss.getCsiRsrp()));
            common(c, ss);
        } else if (ci instanceof CellInfoWcdma) {
            CellInfoWcdma w = (CellInfoWcdma) ci;
            CellIdentityWcdma id = w.getCellIdentity();
            CellSignalStrengthWcdma ss = w.getCellSignalStrength();
            c.put("tech", "UMTS");
            c.put("arfcn", RadioState.v(id.getUarfcn()));
            c.put("pci", RadioState.v(id.getPsc()));
            c.put("tac", RadioState.v(id.getLac()));
            c.put("cid", RadioState.v(id.getCid()));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                c.put("mcc", RadioState.v(id.getMccString()));
                c.put("mnc", RadioState.v(id.getMncString()));
            }
            c.put("rscp", RadioState.v(ss.getDbm()));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) c.put("ecno", RadioState.v(ss.getEcNo()));
            common(c, ss);
        } else if (ci instanceof CellInfoGsm) {
            CellInfoGsm g = (CellInfoGsm) ci;
            CellIdentityGsm id = g.getCellIdentity();
            CellSignalStrengthGsm ss = g.getCellSignalStrength();
            c.put("tech", "GSM");
            c.put("arfcn", RadioState.v(id.getArfcn()));
            c.put("pci", RadioState.v(id.getBsic()));
            c.put("tac", RadioState.v(id.getLac()));
            c.put("cid", RadioState.v(id.getCid()));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                c.put("mcc", RadioState.v(id.getMccString()));
                c.put("mnc", RadioState.v(id.getMncString()));
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) c.put("rssi", RadioState.v(ss.getRssi()));
            c.put("ta", RadioState.v(ss.getTimingAdvance()));
            common(c, ss);
        } else {
            c.put("tech", ci.getClass().getSimpleName().replace("CellInfo", ""));
            c.put("dbm", JSONObject.NULL);
        }
        return c;
    }

    private static void common(JSONObject c, CellSignalStrength ss) throws JSONException {
        c.put("dbm", RadioState.v(ss.getDbm()));
        c.put("level", ss.getLevel());
        c.put("asu", RadioState.v(ss.getAsuLevel()));
    }

    private static JSONArray bands(int[] bands) {
        JSONArray a = new JSONArray();
        if (bands != null) for (int b : bands) a.put(b);
        return a;
    }
}
