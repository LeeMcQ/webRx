package za.leemcq.webrx.bridge;

import android.content.Context;
import android.content.pm.PackageInfo;

/** App version, read once from the package manager (BuildConfig is disabled in AGP 8). */
public final class BuildConfigInfo {
    private static String versionName = "unknown";

    private BuildConfigInfo() {}

    public static void init(Context ctx) {
        try {
            PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            if (pi.versionName != null) versionName = pi.versionName;
        } catch (Exception ignored) {
        }
    }

    public static String versionName() {
        return versionName;
    }
}
