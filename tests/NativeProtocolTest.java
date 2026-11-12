package dev.marwane.hexapod;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
public class NativeProtocolTest {
    static void check(boolean valid,String label){if(!valid)throw new AssertionError(label);}
    static int[] read(InputStream stream)throws Exception{ArrayList<Integer> bytes=new ArrayList<>();int n;while((n=stream.read())!=-1){bytes.add(n);if(n==129)break;}return bytes.stream().mapToInt(i->i).toArray();}
    public static void main(String[] args)throws Exception{
        try(ServerSocket server=new ServerSocket(0)){
            ExecutorService executor=Executors.newSingleThreadExecutor();
            Future<?> peer=executor.submit(()->{
                try(Socket socket=server.accept()){
                    InputStream in=socket.getInputStream();OutputStream out=socket.getOutputStream();
                    check(Arrays.equals(read(in),new int[]{128,0,129}),"echo packet");
                    out.write(128);out.flush();Thread.sleep(20);out.write(new byte[]{1,(byte)129});out.flush();
                    check(Arrays.equals(read(in),new int[]{128,80,129}),"walk packet");
                    // Start + completion can arrive together or across arbitrary TCP reads.
                    out.write(new byte[]{(byte)128,21,(byte)129,(byte)128});out.flush();Thread.sleep(35);out.write(new byte[]{23,(byte)129});out.flush();
                    check(Arrays.equals(read(in),new int[]{128,10,129}),"voltage packet");
                    out.write(new byte[]{(byte)128,11,6,5,(byte)129});out.flush();
                    check(Arrays.equals(read(in),new int[]{128,94,129}),"sleep packet");
                    out.write(new byte[]{(byte)128,21,(byte)129});out.flush();
                    // A premature close must propagate, never count as motion completion.
                }catch(Exception e){throw new RuntimeException(e);}
            });
            RobotClient client=new RobotClient();client.connect("127.0.0.1",server.getLocalPort(),Socket::new);
            check(Arrays.equals(client.exchange(new int[]{0}),new int[]{1}),"fragmented echo");
            check(Arrays.equals(client.exchange(new int[]{80}),new int[]{23}),"wait for completion");
            check(Arrays.equals(client.exchange(new int[]{10}),new int[]{11,6,5}),"voltage decoding bytes");
            boolean eof=false;try{client.exchange(new int[]{94});}catch(EOFException e){eof=true;}check(eof,"dropped completion is rejected");client.close();peer.get(3,TimeUnit.SECONDS);executor.shutdownNow();
        }
        boolean rejected=false;try{RobotClient.validate(new int[]{32});}catch(IOException e){rejected=true;}check(rejected,"calibration writes not exposed");
        rejected=false;try{RobotClient.validate(new int[]{20,8,1});}catch(IOException e){rejected=true;}check(rejected,"invalid output rejected");
        System.out.println("Native TCP tests passed: binary framing, fragmented/combined responses, start/done handshake, battery response, disconnect, command allowlist.");
    }
}
