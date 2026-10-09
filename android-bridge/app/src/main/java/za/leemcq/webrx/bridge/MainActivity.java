package za.leemcq.webrx.bridge;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * One screen: grant permissions, start/stop the bridge, see live counts, and
 * open the webRx monitor in Chrome.
 */
public final class MainActivity extends Activity {
    private static final String MONITOR_URL = "https://leemcq.github.io/webRx/thesis-view.html";
    private static final int REQ_PERMS = 1;

    private static final int BG = Color.rgb(11, 18, 32);
    private static final int PANEL = Color.rgb(17, 26, 43);
    private static final int TEXT = Color.rgb(226, 232, 240);
    private static final int MUTED = Color.rgb(138, 155, 181);
    private static final int ACCENT = Color.rgb(59, 130, 246);
    private static final int GO = Color.rgb(21, 128, 61);
    private static final int STOP = Color.rgb(185, 28, 28);

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Runnable refreshTick = this::refresh;
    private TextView status;
    private TextView counts;
    private Button toggle;
    private Button perms;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        BuildConfigInfo.init(this);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        scroll.setFillViewport(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(20);
        col.setPadding(pad, pad, pad, pad);
        scroll.addView(col);
        scroll.setOnApplyWindowInsetsListener((v, insets) -> {
            int top;
            int bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets i = insets.getInsets(WindowInsets.Type.systemBars());
                top = i.top;
                bottom = i.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
            v.setPadding(0, top, 0, bottom);
            return insets;
        });

        TextView title = text("webRx Radio Bridge", 24, TEXT, true);
        col.addView(title);
        TextView sub = text("Lets the webRx website read this phone's cellular, Wi-Fi, GNSS and Bluetooth "
                + "measurements. Data stays on the phone (127.0.0.1:" + HttpServer.PORT + ").", 14, MUTED, false);
        sub.setPadding(0, dp(6), 0, dp(16));
        col.addView(sub);

        status = text("", 15, TEXT, true);
        counts = text("", 14, TEXT, false);
        counts.setTypeface(Typeface.MONOSPACE);
        LinearLayout card = card();
        card.addView(status);
        card.addView(counts);
        col.addView(card);

        perms = button("Allow permissions", ACCENT);
        perms.setOnClickListener(v -> requestPermissions(Permissions.needed(), REQ_PERMS));
        col.addView(perms);

        toggle = button("Start bridge", GO);
        toggle.setOnClickListener(v -> {
            if (BridgeService.isRunning()) BridgeService.stop(this);
            else startBridge();
            ui.removeCallbacks(refreshTick);
            ui.postDelayed(refreshTick, 300);
        });
        col.addView(toggle);

        Button open = button("Open webRx Monitor in Chrome", ACCENT);
        open.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(MONITOR_URL))));
        col.addView(open);

        Button location = button("Location settings", PANEL);
        location.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)));
        col.addView(location);

        TextView tips = text("Tips\n"
                + "• In the monitor choose Cellular, Wi-Fi, GNSS or Bluetooth as the source.\n"
                + "• Android limits Wi-Fi scans. For continuous scanning turn off "
                + "Developer options → \"Wi-Fi scan throttling\".\n"
                + "• Chrome may ask to let the site access apps on this device: allow it.\n"
                + "• Stop the bridge from here or from its notification when you're done.", 13, MUTED, false);
        tips.setPadding(0, dp(16), 0, 0);
        col.addView(tips);

        setContentView(scroll);

        if (Permissions.locationGranted(this) && !BridgeService.isRunning()) startBridge();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    @Override
    protected void onPause() {
        super.onPause();
        ui.removeCallbacksAndMessages(null);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (Permissions.locationGranted(this)) {
            if (BridgeService.isRunning()) BridgeService.stop(this);
            startBridge();
        }
        refresh();
    }

    private void startBridge() {
        if (!Permissions.locationGranted(this)) {
            requestPermissions(Permissions.needed(), REQ_PERMS);
            return;
        }
        BridgeService.start(this);
    }

    private void refresh() {
        boolean running = BridgeService.isRunning();
        String err = BridgeService.serverError();
        StringBuilder s = new StringBuilder();
        s.append(running ? "● Running" : "○ Stopped");
        if (err != null) s.append("\n").append(err);
        if (!Permissions.locationGranted(this)) s.append("\nLocation permission is required.");
        else if (!Permissions.locationServicesOn(this)) s.append("\nTurn on Location for Wi-Fi, cell and GNSS data.");
        status.setText(s.toString());
        status.setTextColor(running ? Color.rgb(74, 222, 128) : Color.rgb(251, 191, 36));

        RadioState st = BridgeService.state();
        counts.setText(String.format(java.util.Locale.ROOT,
                "\nCells       %d\nWi-Fi APs   %d\nSatellites  %d\nBLE devices %d\n\nVersion %s",
                st.cellCount(), st.wifiCount(), st.gnssCount(), st.bleCount(), BuildConfigInfo.versionName()));

        toggle.setText(running ? "Stop bridge" : "Start bridge");
        tint(toggle, running ? STOP : GO);
        perms.setVisibility(Permissions.allGranted(this) ? View.GONE : View.VISIBLE);
        ui.removeCallbacks(refreshTick);
        ui.postDelayed(refreshTick, 1000);
    }

    // ── tiny UI helpers ─────────────────────────────────────

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private TextView text(String s, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(PANEL);
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), Color.rgb(30, 44, 69));
        c.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.bottomMargin = dp(12);
        c.setLayoutParams(lp);
        return c;
    }

    private Button button(String label, int color) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setGravity(Gravity.CENTER);
        tint(b, color);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(52));
        lp.topMargin = dp(10);
        b.setLayoutParams(lp);
        return b;
    }

    private void tint(Button b, int color) {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(color);
        bg.setCornerRadius(dp(10));
        b.setBackground(bg);
    }
}
