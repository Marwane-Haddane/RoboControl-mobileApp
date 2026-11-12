package dev.marwane.hexapod;

import android.app.Activity;
import android.Manifest;
import android.os.*;
import android.graphics.Color;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.net.*;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.bluetooth.*;
import android.view.*;
import android.webkit.*;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import org.json.*;
import java.io.*;
import java.net.Socket;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.UUID;
import java.util.Locale;

public final class MainActivity extends Activity {
    private WebView web;
    private final RobotClient robot=new RobotClient();
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicInteger epoch=new AtomicInteger();
    private volatile BluetoothSocket bluetoothSocket;
    private volatile OutputStream bluetoothOutput;
    private volatile int pendingBluetoothListId=-1;
    private volatile int pendingVoiceId=-1;
    private static final int REQUEST_BLUETOOTH_CONNECT=71;
    private static final int REQUEST_VOICE=72;
    private static final UUID SPP_UUID=UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.rgb(4,27,39)); getWindow().setNavigationBarColor(Color.rgb(4,27,39));
        FrameLayout root=new FrameLayout(this); root.setBackgroundColor(Color.rgb(4,27,39));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(4,27,39));
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            if(Build.VERSION.SDK_INT>=30) {android.graphics.Insets bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(bars.left,bars.top,bars.right,bars.bottom);}
            else v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        WebSettings options=web.getSettings();options.setJavaScriptEnabled(true);options.setDomStorageEnabled(true);
        options.setAllowFileAccess(false);options.setAllowContentAccess(false);options.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);options.setSupportMultipleWindows(false);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request) {
                WebResourceResponse local=loader.shouldInterceptRequest(request.getUrl());
                return local!=null?local:new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !isLocal(request.getUrl());}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,android.net.http.SslError error){handler.cancel();}
        });
        web.addJavascriptInterface(new Bridge(),"HexapodNative");
        web.loadUrl("https://appassets.androidplatform.net/native.html");
    }
    private boolean isLocal(Uri uri){return "https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost());}
    private Socket wifiSocket() throws IOException {
        ConnectivityManager manager=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        for(Network network:manager.getAllNetworks()) {
            NetworkCapabilities caps=manager.getNetworkCapabilities(network);
            if(caps!=null&&caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))return network.getSocketFactory().createSocket();
        }
        throw new IOException("Join the robot’s Wi-Fi network first");
    }
    private final class Bridge {
        @JavascriptInterface public void request(String raw) {
            try {
                JSONObject request=new JSONObject(raw);int id=request.getInt("id");String action=request.getString("action");
                if(action.equals("wifi")) {runOnUiThread(()->startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS)));return;}
                if(action.equals("orientation")) {
                    boolean landscape="landscape".equals(request.optString("orientation","portrait"));
                    runOnUiThread(()->setRequestedOrientation(landscape?ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE:ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
                    return;
                }
                if(action.equals("bluetoothSettings")) {runOnUiThread(()->startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));return;}
                if(action.equals("listen")) {startVoice(id,request.optString("locale","en-US"));return;}
                if(action.equals("bluetoothDevices")) {listBluetoothDevices(id);return;}
                if(action.equals("connectBluetooth")) {connectBluetooth(id,request.getString("address"));return;}
                if(action.equals("disconnectBluetooth")) {closeBluetooth();respondDevice(id,true,null,null);return;}
                if(action.equals("sendText")) {sendBluetoothText(id,request.getString("text"),request.optBoolean("newline",false));return;}
                if(action.equals("disconnect")){epoch.incrementAndGet();robot.close();respond(id,new int[0],null);return;}
                final int token=action.equals("connect")?epoch.incrementAndGet():epoch.get();
                if(action.equals("connect"))robot.close();
                worker.execute(()->{
                    try {
                        if(token!=epoch.get())throw new IOException("Connection cancelled");
                        if(action.equals("connect")) {
                            robot.connect(request.getString("host"),request.getInt("port"),MainActivity.this::wifiSocket);
                            if(token!=epoch.get()){robot.close();throw new IOException("Connection cancelled");}
                            respond(id,new int[0],null);
                        } else if(action.equals("command")) {
                            JSONArray values=request.getJSONArray("payload");int[] data=new int[values.length()];
                            for(int i=0;i<data.length;i++)data[i]=values.getInt(i);
                            int[] reply=robot.exchange(data);if(token!=epoch.get())throw new IOException("Connection cancelled");respond(id,reply,null);
                        } else throw new IOException("Unknown action");
                    } catch(Exception error) {robot.close();respond(id,null,message(error));}
                });
            } catch(Exception ignored) { /* Only the bundled, CSP-restricted app can access this bridge. */ }
        }
    }
    private void listBluetoothDevices(int id) {
        if(Build.VERSION.SDK_INT>=31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED) {
            pendingBluetoothListId=id;
            runOnUiThread(()->requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},REQUEST_BLUETOOTH_CONNECT));
            return;
        }
        worker.execute(()->{
            try {
                BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
                if(adapter==null)throw new IOException("This phone does not have Bluetooth");
                JSONArray devices=new JSONArray();
                for(BluetoothDevice device:adapter.getBondedDevices()) {
                    JSONObject item=new JSONObject();item.put("name",device.getName()==null?"Bluetooth device":device.getName());item.put("address",device.getAddress());devices.put(item);
                }
                JSONObject result=new JSONObject();result.put("ok",true);result.put("devices",devices);respondRawDevice(id,result);
            } catch(Exception error) {respondDevice(id,false,message(error),null);}
        });
    }
    private void connectBluetooth(int id,String address) {
        if(Build.VERSION.SDK_INT>=31 && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED) {
            respondDevice(id,false,"Allow Nearby devices access, then refresh and connect again.",null);return;
        }
        worker.execute(()->{
            BluetoothSocket candidate=null;
            try {
                closeBluetooth();
                BluetoothAdapter adapter=BluetoothAdapter.getDefaultAdapter();
                if(adapter==null)throw new IOException("This phone does not have Bluetooth");
                BluetoothDevice device=adapter.getRemoteDevice(address);
                candidate=device.createRfcommSocketToServiceRecord(SPP_UUID);
                candidate.connect();
                bluetoothSocket=candidate;bluetoothOutput=candidate.getOutputStream();
                startBluetoothReader(candidate);
                JSONObject extra=new JSONObject();extra.put("name",device.getName()==null?"Bluetooth device":device.getName());
                respondDevice(id,true,null,extra);
            } catch(Exception error) {if(candidate!=null)try{candidate.close();}catch(IOException ignored){}respondDevice(id,false,"Could not connect. Confirm this is a paired Bluetooth Serial (SPP) device.",null);}
        });
    }
    private void startBluetoothReader(BluetoothSocket socket) {
        Thread reader=new Thread(()->{
            try(BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),java.nio.charset.StandardCharsets.UTF_8))) {
                String line;
                while((line=input.readLine())!=null && socket==bluetoothSocket) {
                    JSONObject extra=new JSONObject();extra.put("text",line);respondRawDevice(-5,extra);
                }
            } catch(Exception ignored) { /* The peer may close the serial link at any time. */ }
        },"BluetoothSerialReader");
        reader.setDaemon(true);reader.start();
    }
    private void sendBluetoothText(int id,String text,boolean newline) {
        worker.execute(()->{
            try {
                OutputStream output=bluetoothOutput;
                if(output==null || bluetoothSocket==null || !bluetoothSocket.isConnected())throw new IOException("Connect a Bluetooth serial device first");
                output.write((text+(newline?"\n":"")).getBytes(java.nio.charset.StandardCharsets.UTF_8));output.flush();
                if(id!=0)respondDevice(id,true,null,null);
            } catch(Exception error) {if(id!=0)respondDevice(id,false,error.getMessage()==null?"Command could not be sent":error.getMessage(),null);}
        });
    }
    private synchronized void closeBluetooth() {
        OutputStream output=bluetoothOutput;BluetoothSocket socket=bluetoothSocket;bluetoothOutput=null;bluetoothSocket=null;
        if(output!=null)try{output.close();}catch(IOException ignored){}
        if(socket!=null)try{socket.close();}catch(IOException ignored){}
    }
    private void startVoice(int id,String locale) {
        runOnUiThread(()->{
            try {
                Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,locale);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,locale);
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT,"Speak a device command");
                pendingVoiceId=id;startActivityForResult(intent,REQUEST_VOICE);
            } catch(Exception error) {respondDevice(id,false,"Install or enable a speech recognition service on Android.",null);}
        });
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQUEST_VOICE) {
            int id=pendingVoiceId;pendingVoiceId=-1;
            if(resultCode==RESULT_OK && data!=null) {
                java.util.ArrayList<String> results=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if(results!=null&&!results.isEmpty()){JSONObject extra=new JSONObject();try{extra.put("text",results.get(0));}catch(JSONException ignored){}respondDevice(id,true,null,extra);return;}
            }
            respondDevice(id,false,"No speech was recognized.",null);
        }
    }
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults) {
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==REQUEST_BLUETOOTH_CONNECT) {
            int id=pendingBluetoothListId;pendingBluetoothListId=-1;
            if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED)listBluetoothDevices(id);
            else respondDevice(id,false,"Nearby devices permission is needed to list paired Bluetooth devices.",null);
        }
    }
    private void respondDevice(int id,boolean ok,String error,JSONObject extra) {
        try {JSONObject result=new JSONObject();result.put("ok",ok);if(error!=null)result.put("error",error);if(extra!=null){java.util.Iterator<String> keys=extra.keys();while(keys.hasNext()){String key=keys.next();result.put(key,extra.get(key));}}respondRawDevice(id,result);}catch(Exception ignored){}
    }
    private void respondRawDevice(int id,JSONObject result) {
        String script="window.__deviceResult && window.__deviceResult("+id+","+result.toString()+")";
        runOnUiThread(()->{if(web!=null)web.evaluateJavascript(script,null);});
    }
    private String message(Exception error) {
        if(error instanceof java.net.SocketTimeoutException)return "Robot did not respond. Check its power and Wi-Fi, then reconnect.";
        if(error instanceof java.net.ConnectException)return "Cannot reach the robot. Join Freenove Hexapod Robot Wi-Fi and retry.";
        return error.getMessage()!=null?error.getMessage():"Connection lost. Reconnect before moving.";
    }
    private void respond(int id,int[] values,String error) {
        try {
            JSONObject data=new JSONObject();data.put("ok",error==null);
            if(error!=null)data.put("error",error);else{JSONArray array=new JSONArray();for(int value:values)array.put(value);data.put("data",array);}
            String script="window.__hexapodResult && window.__hexapodResult("+id+","+data+")";
            runOnUiThread(()->{if(web!=null)web.evaluateJavascript(script,null);});
        } catch(JSONException ignored){}
    }
    @Override protected void onPause(){epoch.incrementAndGet();robot.close();if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('hexapod-background'))",null);super.onPause();}
    @Override protected void onDestroy(){epoch.incrementAndGet();robot.close();closeBluetooth();worker.shutdownNow();if(web!=null){web.removeJavascriptInterface("HexapodNative");web.destroy();web=null;}super.onDestroy();}
}
