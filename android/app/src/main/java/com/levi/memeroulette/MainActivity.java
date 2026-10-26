package com.levi.memeroulette;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Shows the shared meme viewer (web/ folder, bundled as assets) in a full-screen WebView,
 * and gives it a few phone powers through window.AndroidBridge:
 * fetching from the internet, saving to the Gallery, sharing, and opening links.
 */
public class MainActivity extends Activity {
    private static final String UA = "android:com.levi.memeroulette:1.0 (personal meme viewer)";

    private WebView web;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0E0E11);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // remembers saved memes + seen list
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setAllowFileAccess(true);             // to load the bundled page from assets

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Any link leaving the app opens in the browser
                openExternal(request.getUrl().toString());
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        pool.shutdownNow();
        web.destroy();
        super.onDestroy();
    }

    private void openExternal(String url) {
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) { }
    }

    /** Sends a result back to the page's Promise (see web/native.js). */
    private void resolve(String id, boolean ok, String value) {
        String js = "window.__nativeResolve(" + JSONObject.quote(id) + "," + ok + "," + JSONObject.quote(value) + ")";
        runOnUiThread(() -> {
            if (!isDestroyed()) web.evaluateJavascript(js, null);
        });
    }

    private static byte[] download(String address, int maxBytes) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(address).openConnection();
        con.setInstanceFollowRedirects(true);
        con.setConnectTimeout(15000);
        con.setReadTimeout(20000);
        con.setRequestProperty("User-Agent", UA);
        con.setRequestProperty("Accept", "*/*");
        try {
            int code = con.getResponseCode();
            if (code >= 400) throw new IllegalStateException("HTTP " + code);
            try (InputStream in = con.getInputStream()) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n);
                    if (out.size() > maxBytes) throw new IllegalStateException("File too big");
                }
                return out.toByteArray();
            }
        } finally {
            con.disconnect();
        }
    }

    private static String mimeFor(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".gif")) return "image/gif";
        if (n.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }

    final class Bridge {
        @JavascriptInterface
        public void getText(String id, String url) {
            pool.execute(() -> {
                try {
                    if (!url.startsWith("https://")) throw new IllegalArgumentException("Only https links");
                    resolve(id, true, new String(download(url, 5_000_000), StandardCharsets.UTF_8));
                } catch (Exception e) {
                    resolve(id, false, e.getMessage() == null ? e.toString() : e.getMessage());
                }
            });
        }

        /** Downloads the image into Pictures/Meme Roulette so it shows up in the Gallery. */
        @JavascriptInterface
        public void save(String id, String url, String name) {
            pool.execute(() -> {
                Uri item = null;
                ContentResolver cr = getContentResolver();
                try {
                    if (!url.startsWith("https://")) throw new IllegalArgumentException("Only https links");
                    byte[] bytes = download(url, 40_000_000);
                    String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
                    v.put(MediaStore.Images.Media.MIME_TYPE, mimeFor(safeName));
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Meme Roulette");
                    v.put(MediaStore.Images.Media.IS_PENDING, 1);
                    item = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (item == null) throw new IllegalStateException("Gallery refused the file");
                    try (OutputStream out = cr.openOutputStream(item)) {
                        if (out == null) throw new IllegalStateException("Couldn't write the file");
                        out.write(bytes);
                    }
                    v.clear();
                    v.put(MediaStore.Images.Media.IS_PENDING, 0);
                    cr.update(item, v, null, null);
                    resolve(id, true, "your Gallery");
                } catch (Exception e) {
                    if (item != null) cr.delete(item, null, null);
                    resolve(id, false, e.getMessage() == null ? e.toString() : e.getMessage());
                }
            });
        }

        @JavascriptInterface
        public void share(String url, String title) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND)
                        .setType("text/plain")
                        .putExtra(Intent.EXTRA_SUBJECT, title)
                        .putExtra(Intent.EXTRA_TEXT, title + "\n" + url);
                startActivity(Intent.createChooser(i, "Share meme"));
            });
        }

        @JavascriptInterface
        public void openLink(String url) {
            runOnUiThread(() -> openExternal(url));
        }
    }
}
