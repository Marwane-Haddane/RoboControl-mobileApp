package dev.marwane.hexapod;

import java.io.*;
import java.net.*;
import java.util.*;

/** Plain-Java protocol client, also exercised against a real local TCP mock. */
public final class RobotClient {
    public interface SocketMaker { Socket create() throws IOException; }
    private volatile Socket socket;

    public void connect(String host, int port, SocketMaker maker) throws IOException {
        close();
        if (!host.matches("\\d{1,3}(\\.\\d{1,3}){3}") || port < 1 || port > 65535) throw new IOException("Invalid robot address or port");
        for (String octet : host.split("\\.")) if (Integer.parseInt(octet) > 255) throw new IOException("Invalid robot address");
        Socket candidate = maker.create();
        socket = candidate;
        try { candidate.connect(new InetSocketAddress(host, port), 4000); candidate.setTcpNoDelay(true); candidate.setSoTimeout(1200); }
        catch (IOException error) { close(); throw error; }
    }

    public synchronized int[] exchange(int[] payload) throws IOException {
        validate(payload);
        Socket current = socket;
        if (current == null || current.isClosed()) throw new IOException("Connect to the robot first");
        byte[] bytes = new byte[payload.length+2]; bytes[0]=(byte)128; bytes[bytes.length-1]=(byte)129;
        for(int i=0;i<payload.length;i++)bytes[i+1]=(byte)payload[i];
        OutputStream output=current.getOutputStream(); output.write(bytes); output.flush();
        InputStream input=current.getInputStream();
        int[] response=readFrame(current,input,System.nanoTime()+1_200_000_000L);
        if(payload[0]>=64) {
            if(response.length==1 && response[0]==21) response=readFrame(current,input,System.nanoTime()+10_000_000_000L);
            if(response.length!=1 || response[0]!=23)throw new IOException("Invalid motion acknowledgement");
        } else if(payload[0]==0) {
            if(response.length!=1 || response[0]!=1)throw new IOException("Device did not identify as the robot");
        } else if(payload[0]==10) {
            if(response.length!=3 || response[0]!=11)throw new IOException("Invalid battery response");
        } else if(response.length!=1 || response[0]!=23)throw new IOException("Invalid robot response");
        return response;
    }
    static int[] readFrame(Socket socket,InputStream input,long deadline) throws IOException {
        int[] data=new int[30];int count=0;boolean started=false;
        while(true) {
            long remaining=deadline-System.nanoTime();
            if(remaining<=0)throw new SocketTimeoutException("Robot response timed out");
            socket.setSoTimeout((int)Math.max(1,Math.min(10000,remaining/1_000_000)));
            int value=input.read();
            if(value<0)throw new EOFException("Robot disconnected");
            if(value==128) { started=true;count=0;continue; }
            if(!started)continue;
            if(value==129) { if(count==0)throw new IOException("Empty robot response");return Arrays.copyOf(data,count); }
            if(value>127 || count>=data.length)throw new IOException("Malformed robot response");
            data[count++]=value;
        }
    }
    static void validate(int[] payload) throws IOException {
        if(payload.length==0)throw new IOException("Empty command");
        int length=switch(payload[0]) {case 0,10,80,82,84,86,88,90,92,94,96->1;case 20->3;case 110,114,116->4;case 112->2;case 118->7;default->-1;};
        if(payload.length!=length)throw new IOException("Unsupported command");
        for(int value:payload)if(value<0||value>127)throw new IOException("Invalid command data");
        if(payload[0]==20&&(payload[1]>7||payload[2]>1))throw new IOException("Invalid output index");
    }
    public void close() { Socket current=socket; socket=null; if(current!=null)try{current.close();}catch(IOException ignored){} }
}
