package za.leemcq.webrx.bridge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Foreground service that keeps the collectors and the loopback HTTP server
 * running while the webRx website is open in Chrome.
 */
public final class BridgeService extends Service {
    public static final String ACTION_STOP = "za.leemcq.webrx.bridge.STOP";
    private static final String CHANNEL = "bridge";
    private static final int NOTIFICATION_ID = 8737;

    private static volatile BridgeService instance;
    private static final RadioState STATE = new RadioState();

    private HandlerThread thread;
    private Handler handler;
    private HttpServer server;
    private CellCollector cell;
    private WifiCollector wifi;
    private GnssCollector gnss;
    private BleCollector ble;
    private String serverError;

    public static boolean isRunning() {
        BridgeService s = instance;
        return s != null && s.server != null && s.server.isRunning();
    }

    public static String serverError() {
        BridgeService s = instance;
        return s == null ? null : s.serverError;
    }

    public static RadioState state() {
        return STATE;
    }

    public static void start(Context ctx) {
        Intent i = new Intent(ctx, BridgeService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
        else ctx.startService(i);
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, BridgeService.class));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        BuildConfigInfo.init(this);
        instance = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        goForeground();
        if (thread == null) startWork();
        return START_STICKY;
    }

    private void goForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Radio Bridge", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shows while webRx can read this phone's radio measurements");
            nm.createNotificationChannel(ch);
        }
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), piFlags);
        PendingIntent stop = PendingIntent.getService(this, 1,
                new Intent(this, BridgeService.class).setAction(ACTION_STOP), piFlags);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("webRx Radio Bridge is running")
                .setContentText("Sharing cellular, Wi-Fi, GNSS and Bluetooth readings with webRx on this phone")
                .setContentIntent(open)
                .addAction(new Notification.Action.Builder(null, "Stop", stop).build())
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
    }

    private void startWork() {
        thread = new HandlerThread("radio-bridge");
        thread.start();
        handler = new Handler(thread.getLooper());
        STATE.setPermissions(Permissions.summary(this));

        cell = new CellCollector(this, STATE, handler);
        wifi = new WifiCollector(this, STATE, handler);
        gnss = new GnssCollector(this, STATE, handler);
        ble = new BleCollector(this, STATE, handler);
        handler.post(() -> {
            cell.start();
            wifi.start();
            gnss.start();
            ble.start();
        });

        server = new HttpServer(STATE, () -> {
            if (wifi != null) wifi.requestScan();
        });
        try {
            server.start();
            serverError = null;
        } catch (Exception e) {
            serverError = "Port " + HttpServer.PORT + " unavailable: " + e.getMessage();
        }
    }

    @Override
    public void onDestroy() {
        if (server != null) server.stop();
        if (handler != null) {
            handler.post(() -> {
                if (cell != null) cell.stop();
                if (wifi != null) wifi.stop();
                if (gnss != null) gnss.stop();
                if (ble != null) ble.stop();
            });
        }
        if (thread != null) thread.quitSafely();
        thread = null;
        server = null;
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /** Summary used in the status page and the activity. */
    public static JSONObject quickStatus() {
        JSONObject o = new JSONObject();
        try {
            o.put("running", isRunning());
            o.put("error", RadioState.v(serverError()));
        } catch (JSONException ignored) {
        }
        return o;
    }
}
