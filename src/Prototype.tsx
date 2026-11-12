import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
} from "react";
import {
  ArrowCounterClockwise,
  ArrowUUpLeft,
  ArrowUUpRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CubeTransparent,
  GameController,
  GearSix,
  Play,
  Square,
  WifiHigh,
  X,
  PlugsConnected,
  Check,
  Bluetooth,
  Microphone,
  TerminalWindow,
  House,
  CarSimple,
  Triangle,
  Circle,
  ArrowLeft,
  PaperPlaneTilt,
  Plus,
  PencilSimple,
} from "@phosphor-icons/react";
import {
  KeyboardInput,
  MobileScroll,
  useKeyboard,
  useMobileDevice,
} from "./mobile";
import { RobotEngine } from "./robot/engine";
import { RobotRig } from "./RobotRig";
import { AndroidTransport, DemoTransport } from "./robot/transport";
import {
  Order,
  crawl,
  moveBody,
  rotateBody,
  bodyAxesFromPad,
  padFromBodyAxes,
} from "./robot/protocol";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/latin-900.css";
import "./prototype.css";
const engine = new RobotEngine(
  window.HexapodNative ? new AndroidTransport() : new DemoTransport(),
);
const ASSETS = "/assets/hexapod/";
const outputPins = ["20", "21", "A0", "A1", "15", "14", "2", "3"];
type Tab = "drive" | "body" | "settings";
type Mode = "home" | "hexapod" | "car" | "voice" | "terminal" | "smart" | "devices";
type BtDevice = { name: string; address: string };
type Binding = { label: string; command: string };
const defaultCarBindings: Binding[] = [
  { label: "Up", command: "O" },
  { label: "Left", command: "J" },
  { label: "Down", command: "K" },
  { label: "Right", command: "L" },
  { label: "Triangle", command: "A" },
  { label: "Square", command: "B" },
  { label: "X", command: "X" },
  { label: "Circle", command: "Y" },
];
const defaultSmartBindings: Binding[] = Array.from({ length: 6 }, (_, i) => ({
  label: `Button ${i + 1}`,
  command: "",
}));
export default function Prototype() {
  const keyboard = useKeyboard();
  const { setDeviceId } = useMobileDevice();
  useEffect(() => {
    setDeviceId("pixel-10");
  }, []);
  return <RobotApp onNavigate={() => keyboard.hide()} />;
}
export function RobotApp({
  native = false,
  onNavigate = () => {},
}: {
  native?: boolean;
  onNavigate?: () => void;
}) {
  const state = useSyncExternalStore(engine.subscribe, engine.snapshot);
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const [mode, setMode] = useState<Mode>("home");
  const [tab, setTab] = useState<Tab>("drive");
  const [btDevices, setBtDevices] = useState<BtDevice[]>([]);
  const [btDevice, setBtDevice] = useState(() => localStorage.getItem("robocontrol-bt-address") || "");
  const [btName, setBtName] = useState("");
  const [btConnected, setBtConnected] = useState(false);
  const [btBusy, setBtBusy] = useState(false);
  const [carBindings, setCarBindings] = useState<Binding[]>(() => readBindings("robocontrol-car-bindings", defaultCarBindings));
  const [smartBindings, setSmartBindings] = useState<Binding[]>(() => readBindings("robocontrol-smart-bindings", defaultSmartBindings));
  const [configuring, setConfiguring] = useState(false);
  const [terminalText, setTerminalText] = useState("");
  const [terminalLog, setTerminalLog] = useState<string[]>([]);
  const [voiceLocale, setVoiceLocale] = useState("en-US");
  const [voiceText, setVoiceText] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const deviceRequestId = useRef(100);
  useEffect(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    onNavigateRef.current();
  }, [mode]);
  const [host, setHost] = useState(
    () => localStorage.getItem("hexapod-host") || "192.168.4.1",
  );
  const [port, setPort] = useState(
    () => localStorage.getItem("hexapod-port") || "65535",
  );
  const [bodyMode, setBodyMode] = useState<"move" | "rotate">("move");
  const [axes, setAxes] = useState([0, 0, 0]);
  const [outputs, setOutputs] = useState<boolean[]>(Array(8).fill(false));
  const [showOutputs, setShowOutputs] = useState(false);
  const [notice, setNotice] = useState("");
  const [stopToken, setStopToken] = useState(0);
  const ready = state.status === "connected";
  const demo = !engine.transport.native;
  useEffect(() => {
    if (demo) void engine.connect("192.168.4.1", 65535);
    const timer = setInterval(() => engine.pollVoltage(), 1800);
    const stop = () => engine.stop();
    const hidden = () => {
      if (document.hidden) {
        engine.stop();
        if (!demo) engine.disconnect();
      }
    };
    const lifecycle = () => {
      engine.stop();
      engine.disconnect();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("hexapod-background", lifecycle);
    return () => {
      clearInterval(timer);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("hexapod-background", lifecycle);
      engine.disconnect();
    };
  }, []);
  useEffect(() => {
    window.__deviceResult = (id, result) => {
      if (id === -1) {
        setBtDevices(result.devices ?? []);
        if (result.ok) setNotice(`Found ${result.devices?.length ?? 0} paired device(s)`);
        else setNotice(result.error ?? "Could not read paired devices");
        setBtBusy(false);
      } else if (id === -2) {
        setBtConnected(!!result.ok);
        if (result.ok && result.name) setBtName(result.name);
        setBtBusy(false);
        setNotice(result.ok ? "Bluetooth serial connected" : result.error ?? "Bluetooth connection failed");
      } else if (id === -3) {
        setBtConnected(false);
        setBtBusy(false);
        if (!result.ok) setNotice(result.error ?? "Bluetooth disconnected");
      } else if (id === -4) {
        setVoiceListening(false);
        if (result.ok && result.text) setVoiceText(result.text);
        else if (result.error) setNotice(result.error);
      } else if (id === -5 && result.text) {
        setTerminalLog((old) => [...old.slice(-49), `‹ ${result.text}`]);
      } else if (id > 0) {
        if (!result.ok) setNotice(result.error ?? "Could not send command");
      }
    };
    return () => { window.__deviceResult = undefined; };
  }, []);
  const navigate = (next: Tab) => {
    engine.stop();
    (document.activeElement as HTMLElement | null)?.blur();
    onNavigate();
    setTab(next);
    requestAnimationFrame(() => document.querySelector(".app-scroll")?.scrollTo(0, 0));
    setNotice("");
  };
  const openMode = (next: Mode) => {
    engine.stop();
    (document.activeElement as HTMLElement | null)?.blur();
    if (window.HexapodNative) {
      requestDevice("orientation", { orientation: next === "car" ? "landscape" : "portrait" });
    }
    if (next === "hexapod") {
      setMode(next);
      setTab("drive");
    } else if (next === "home") {
      setMode("home");
      setConfiguring(false);
    } else {
      setMode(next);
      setConfiguring(false);
    }
    onNavigate();
    requestAnimationFrame(() => document.querySelector(".app-scroll")?.scrollTo(0, 0));
    setNotice("");
  };
  const requestDevice = (action: string, args: Record<string, unknown> = {}) => {
    const id = typeof args.id === "number" ? args.id : ++deviceRequestId.current;
    window.HexapodNative?.request(JSON.stringify({ id, action, ...args }));
  };
  const refreshBluetooth = () => {
    if (!window.HexapodNative) { const demoDevice = { name: "Demo Bluetooth device", address: "DEMO" }; setBtDevices([demoDevice]); setBtDevice("DEMO"); setBtName(demoDevice.name); setNotice("Preview uses a simulated Bluetooth device"); return; }
    setBtBusy(true);
    requestDevice("bluetoothDevices", { id: -1 });
  };
  const connectBluetooth = () => {
    if (!btDevice) { setNotice("Pair a device, then select it here."); return; }
    if (!native || btDevice === "DEMO") { setBtConnected(true); setBtBusy(false); setNotice("Demo serial connection ready"); return; }
    setBtBusy(true);
    requestDevice("connectBluetooth", { id: -2, address: btDevice });
  };
  const disconnectBluetooth = () => {
    setBtConnected(false);
    requestDevice("disconnectBluetooth", { id: -3 });
  };
  const sendText = (text: string, newline = false) => {
    if (!btConnected) { setNotice("Connect a Bluetooth serial device first."); return false; }
    if (!native) { setNotice(`Demo sent: ${text}`); return true; }
    requestDevice("sendText", { text, newline });
    return true;
  };
  const saveBindings = (kind: "car" | "smart", values: Binding[]) => {
    const normalized = values.map((item) => ({ label: item.label.slice(0, 18), command: item.command.slice(0, 80) }));
    if (kind === "car") { setCarBindings(normalized); localStorage.setItem("robocontrol-car-bindings", JSON.stringify(normalized)); }
    else { setSmartBindings(normalized); localStorage.setItem("robocontrol-smart-bindings", JSON.stringify(normalized)); }
  };
  const connect = () => {
    onNavigate();
    (document.activeElement as HTMLElement | null)?.blur();
    localStorage.setItem("hexapod-host", host);
    localStorage.setItem("hexapod-port", port);
    void engine.connect(host, +port);
  };
  const sendAxes = (values: number[]) => {
    setAxes(values);
    engine.command(
      bodyMode === "move"
        ? moveBody(...(values as [number, number, number]))
        : rotateBody(...(values as [number, number, number])),
      bodyMode === "move" ? "Positioning body" : "Rotating body",
    );
  };
  const Scroll = native ? "div" : MobileScroll;
  const Field = native ? "input" : KeyboardInput;
  const content = (
    <>
      {mode === "home" && (
        <section className="mode-home">
          <div className="home-intro">
            <span className="eyebrow">ONE APP · MANY CONTROLLERS</span>
            <h2>What are we<br />controlling today?</h2>
            <p>Choose a mode to get started. Your controls stay focused.</p>
          </div>
          <div className="mode-grid" aria-label="Choose a control mode">
            {([
              ["hexapod", "Hexapod", "Walk, turn and pose your Freenove robot.", GameController],
              ["car", "Car remote", "A familiar two-hand layout for driving.", CarSimple],
              ["voice", "Voice control", "Speak in English, French or Arabic.", Microphone],
              ["terminal", "Terminal", "Send text commands over Bluetooth serial.", TerminalWindow],
              ["smart", "Smart buttons", "Build a simple panel for your device.", House],
            ] as const).map(([id, title, description, Icon], index) => (
              <button className={`mode-card mode-card-${index + 1}`} key={id} onClick={() => openMode(id)}>
                <span className="mode-card-icon"><Icon weight="duotone" /></span>
                <span className="mode-card-copy"><strong>{title}</strong><small>{description}</small></span>
                <CaretRight className="mode-card-arrow" />
              </button>
            ))}
          </div>
          <button className="device-summary" onClick={() => openMode("devices")}>
            <span className={`status-dot ${btConnected ? "online" : ""}`} />
            <span><strong>{btConnected ? (btName || "Bluetooth device connected") : "Connect a Bluetooth device"}</strong><small>{btConnected ? "Serial link ready" : "Pair and choose a serial device"}</small></span>
            <Bluetooth size={20} />
            <CaretRight />
          </button>
          <div className="home-credit">Designed for curious builders <span>·</span> Built by Marwane Haddane</div>
        </section>
      )}
      {mode === "devices" && (
        <section className="secondary-page device-page">
          <div className="section-heading"><span className="eyebrow">DEVICE CONNECTION</span><h2>Choose a device.</h2><p>Bluetooth Serial (SPP) is for devices such as HC-05 and HC-06 modules.</p></div>
          <div className="device-callout"><Bluetooth size={25} /><div><strong>{btConnected ? (btName || "Connected") : "Bluetooth serial"}</strong><p>{btConnected ? "Connected. Commands are sent as text." : "Pair your controller in Android Bluetooth settings first."}</p></div></div>
          <button className="secondary-button" onClick={() => window.HexapodNative ? requestDevice("bluetoothSettings") : refreshBluetooth()}><Bluetooth /> {window.HexapodNative ? "Open Bluetooth settings" : "Show demo device"}</button>
          <button className="secondary-button" disabled={btBusy} onClick={refreshBluetooth}>{btBusy ? "Checking paired devices…" : "Refresh paired devices"}</button>
          <label className="device-select-label">Paired device<select value={btDevice} onChange={(e) => { setBtDevice(e.target.value); localStorage.setItem("robocontrol-bt-address", e.target.value); setBtName(btDevices.find((d) => d.address === e.target.value)?.name ?? ""); }}><option value="">Choose a paired device</option>{btDevices.map((d) => <option key={d.address} value={d.address}>{d.name} · {d.address}</option>)}</select></label>
          <button className={`primary-button ${btConnected ? "disconnect-button" : ""}`} disabled={btBusy || (!btDevice && !btConnected)} onClick={() => btConnected ? disconnectBluetooth() : connectBluetooth()}>{btConnected ? <><PlugsConnected /> Disconnect device</> : btBusy ? "Connecting…" : <><Bluetooth /> Connect device</>}</button>
          <p className="info-note">Bluetooth Classic SPP only in this version. A device must use the same text commands you configure here. BLE/GATT devices need their own protocol support.</p>
          <button className="back-home-button" onClick={() => openMode("home")}><ArrowLeft /> Back to modes</button>
        </section>
      )}
      {mode === "car" && (
        <section className="secondary-page car-page">
          <div className="section-heading"><span className="eyebrow">BLUETOOTH REMOTE</span><h2>Drive your car.</h2><p>Hold a direction to move. Release sends stop.</p><span className={`car-link-state ${btConnected ? "connected" : ""}`}><span className={`status-dot ${btConnected ? "online" : ""}`} />{btConnected ? (window.HexapodNative ? "Connected" : "Demo link") : "Bluetooth disconnected"}</span></div>
          <button className={`mode-device-chip ${btConnected ? "connected" : ""}`} onClick={() => openMode("devices")}><span className={`status-dot ${btConnected ? "online" : ""}`} />{btConnected ? (btName || "Serial connected") : "Choose Bluetooth device"}<CaretRight /></button>
          {configuring ? <BindingEditor title="Car controls" rows={carBindings} onSave={(rows) => { saveBindings("car", rows); setConfiguring(false); }} onCancel={() => setConfiguring(false)} Field={Field} /> : <>
            <div className="car-control-layout">
              <div className="car-dpad" aria-label="Car directional controls">
                {([0, 1, 2, 3] as const).map((i) => { const Icon = [CaretUp, CaretLeft, CaretDown, CaretRight][i]; const binding = carBindings[i]; return <button key={binding.label} className={`car-direction dir-${i}`} aria-label={binding.label} disabled={!btConnected || !binding.command} onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); sendText(binding.command); }} onPointerUp={() => sendText("0")} onPointerCancel={() => sendText("0")} onLostPointerCapture={() => sendText("0")}><Icon weight="bold" /></button>; })}
                <span className="dpad-center"><img src="/assets/car/controller-center.png" alt="Textured cyan D-pad center" draggable={false} /></span>
              </div>
              <div className="car-face-buttons" aria-label="Car action buttons">
                {carBindings.slice(4).map((binding, i) => { const Icon = [Triangle, Square, X, Circle][i]; return <button key={binding.label} className={`face-button face-${i}`} disabled={!btConnected || !binding.command} aria-label={`Send ${binding.label}`} onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); sendText(binding.command); }} onPointerUp={() => sendText("0")} onPointerCancel={() => sendText("0")} onLostPointerCapture={() => sendText("0")}><Icon weight="bold" /></button>; })}
              </div>
            </div>
            <div className="car-hint"><span className="status-dot online" />Press and hold <span>·</span> release to send <code>0</code></div>
            <div className="car-actions-row">
              <button className="secondary-button configure-button" onClick={() => setConfiguring(true)}><PencilSimple /> Configure commands</button>
              <button className="stop-button" disabled={!btConnected} onClick={() => sendText("0")}><Square weight="fill" /> Stop</button>
            </div>
          </>}
        </section>
      )}
      {mode === "terminal" && (
        <section className="secondary-page terminal-page">
          <div className="section-heading"><span className="eyebrow">SERIAL CONSOLE</span><h2>Terminal.</h2><p>Commands are sent as text to the selected Bluetooth SPP device.</p></div>
          <button className={`mode-device-chip ${btConnected ? "connected" : ""}`} onClick={() => openMode("devices")}><span className={`status-dot ${btConnected ? "online" : ""}`} />{btConnected ? (btName || "Serial connected") : "Choose Bluetooth device"}<CaretRight /></button>
          <div className="terminal-log" aria-live="polite">{terminalLog.length ? terminalLog.map((line, i) => <p key={i}>{line}</p>) : <div className="terminal-empty"><TerminalWindow size={34} /><span>Command history will appear here.</span></div>}</div>
          <form className="terminal-composer" onSubmit={(e) => { e.preventDefault(); const value = terminalText.trim(); if (!value) return; if (sendText(value, true)) setTerminalLog((old) => [...old.slice(-49), `› ${value}`]); setTerminalText(""); (document.activeElement as HTMLElement | null)?.blur(); onNavigate(); }}>
            <Field value={terminalText} onChange={(e) => setTerminalText(e.target.value)} placeholder="Enter a command" aria-label="Terminal command" autoComplete="off" spellCheck={false} />
            <button type="submit" aria-label="Send command" disabled={!terminalText.trim()}><PaperPlaneTilt /></button>
          </form>
        </section>
      )}
      {mode === "voice" && (
        <section className="secondary-page voice-page">
          <div className="section-heading"><span className="eyebrow">HANDS-FREE CONTROL</span><h2>Speak a command.</h2><p>Recognized text is shown first. Tap send when you are ready.</p></div>
          <button className={`mode-device-chip ${btConnected ? "connected" : ""}`} onClick={() => openMode("devices")}><span className={`status-dot ${btConnected ? "online" : ""}`} />{btConnected ? (btName || "Serial connected") : "Choose Bluetooth device"}<CaretRight /></button>
          <label className="device-select-label language-label">Speech language<select value={voiceLocale} onChange={(e) => setVoiceLocale(e.target.value)}><option value="en-US">English</option><option value="fr-FR">Français</option><option value="ar-MA">العربية · المغرب</option><option value="ar-SA">العربية</option></select></label>
          <div className="voice-transcript" aria-live="polite">{voiceListening ? <><span className="listening-pulse" />Listening…</> : voiceText || "Your recognized words will appear here."}</div>
          <button className={`voice-listen-button ${voiceListening ? "listening" : ""}`} onClick={() => { if (!window.HexapodNative) { setVoiceText("Demo: advance"); setNotice("Demo voice preview. Connect a Bluetooth serial device to send."); return; } setVoiceListening(true); requestDevice("listen", { id: -4, locale: voiceLocale }); }}><Microphone weight="fill" />{voiceListening ? "Listening…" : "Tap to speak"}</button>
          <button className="primary-button" disabled={!voiceText || !btConnected} onClick={() => { if (sendText(voiceText, true)) setTerminalLog((old) => [...old.slice(-49), `Voice: ${voiceText}`]); }}><PaperPlaneTilt /> Send recognized command</button>
          <p className="info-note">Uses the speech recognizer installed on Android. Offline recognition depends on the recognizer and language models installed on your phone; this app does not download third-party models yet.</p>
        </section>
      )}
      {mode === "smart" && (
        <section className="secondary-page smart-page">
          <div className="section-heading"><span className="eyebrow">YOUR CUSTOM PANEL</span><h2>Smart buttons.</h2><p>Assign a label and text command for your Bluetooth device.</p></div>
          <button className={`mode-device-chip ${btConnected ? "connected" : ""}`} onClick={() => openMode("devices")}><span className={`status-dot ${btConnected ? "online" : ""}`} />{btConnected ? (btName || "Serial connected") : "Choose Bluetooth device"}<CaretRight /></button>
          {configuring ? <BindingEditor title="Smart buttons" rows={smartBindings} onSave={(rows) => { saveBindings("smart", rows); setConfiguring(false); }} onCancel={() => setConfiguring(false)} Field={Field} /> : <>
            <div className="smart-grid">{smartBindings.map((binding, i) => <button key={i} className="smart-button" disabled={!btConnected || !binding.command} onClick={() => sendText(binding.command)}><span className="smart-light" /><strong>{binding.label || `Button ${i + 1}`}</strong><small>{binding.command ? `Send “${binding.command}”` : "Set a command"}</small></button>)}</div>
            <button className="secondary-button configure-button" onClick={() => setConfiguring(true)}><PencilSimple /> Configure buttons</button>
          </>}
        </section>
      )}
      {tab === "drive" && (
        mode === "hexapod" && <>
        <>
          <section className="robot-hero" aria-label="Robot status">
            <img
              src={`${ASSETS}robot.png`}
              alt="Black six-legged Freenove hexapod robot"
              draggable={false}
            />
            <div>
              <h2>
                {ready ? (
                  <>
                    Ready to
                    <br />
                    explore
                  </>
                ) : (
                  <>
                    Let’s get
                    <br />
                    connected
                  </>
                )}
              </h2>
              <span className="hero-rule" />
            </div>
          </section>
          <section className="drive-control" aria-label="Drive controls">
            <div className="section-heading">
              <h2>Drive</h2>
              <p>{ready ? "Release to stop" : "Connect before moving"}</p>
            </div>
            <Joystick
              disabled={!ready}
              stopToken={stopToken}
              onMove={(x, y) => {
                if (Math.hypot(x, y) < 0.14) engine.stop();
                else engine.hold(crawl(-x * 42, -y * 42), "Walking");
              }}
              onStop={() => engine.stop()}
            />
            <div className="turn-row">
              <HoldButton
                label="Turn left"
                icon={<ArrowUUpLeft />}
                disabled={!ready}
                onStart={() => engine.hold([Order.TurnLeft], "Turning left")}
                onStop={() => engine.stop()}
              />
              <HoldButton
                label="Turn right"
                icon={<ArrowUUpRight />}
                disabled={!ready}
                onStart={() => engine.hold([Order.TurnRight], "Turning right")}
                onStop={() => engine.stop()}
              />
            </div>
            <button
              className="stop-button"
              onClick={() => {
                engine.stop();
                setStopToken((v) => v + 1);
                setNotice(
                  state.busy ? "Stopping after this step" : "Movement stopped",
                );
              }}
              aria-label="Stop movement"
            >
              <Square weight="fill" />
              Stop
            </button>
            <button
              className="sleep-button"
              disabled={!ready}
              onClick={() => {
                engine.stop();
                engine.command(
                  [state.asleep ? Order.Activate : Order.Sleep],
                  state.asleep ? "Activating" : "Going to sleep",
                );
              }}
            >
              {state.asleep ? (
                <>
                  <Play />
                  Activate
                </>
              ) : (
                "Sleep"
              )}
            </button>
            {!ready && (
              <button
                className="connect-prompt"
                onClick={() => navigate("settings")}
              >
                <WifiHigh />
                Connect robot
              </button>
            )}
          </section>
        </>
        </>
      )}
      {tab === "body" && (
        mode === "hexapod" &&
        <section className="secondary-page body-page">
          <div className="section-heading">
            <h2>{bodyMode === "move" ? "Move body" : "Rotate body"}</h2>
            <p>
              {bodyMode === "move"
                ? "Drag the robot body."
                : "Drag the body to tilt it."}
            </p>
          </div>
          <div className="segmented" aria-label="Body control mode">
            <button
              className={bodyMode === "move" ? "selected" : ""}
              onClick={() => {
                engine.stop();
                setBodyMode("move");
                setAxes([0, 0, 0]);
              }}
            >
              Move body
            </button>
            <button
              className={bodyMode === "rotate" ? "selected" : ""}
              onClick={() => {
                engine.stop();
                setBodyMode("rotate");
                setAxes([0, 0, 0]);
              }}
            >
              Rotate body
            </button>
          </div>
          <span className="requested-pose-label">REQUESTED POSE</span>
          <BodyPad
            mode={bodyMode}
            values={axes}
            disabled={!ready}
            stopToken={stopToken}
            onChange={sendAxes}
          />
          <div className="pose-readout" aria-label="Requested body position">
            {bodyMode === "move" ? (
              <span>
                <b>
                  {axes[0] < 0 ? "Right" : "Left"} {Math.abs(axes[0])} mm ·{" "}
                  {axes[1] < 0 ? "Back" : "Forward"} {Math.abs(axes[1])} mm
                </b>
              </span>
            ) : (
              <>
                <span>
                  Roll <b>{axes[0]}°</b>
                </span>
                <span>
                  Pitch <b>{axes[1]}°</b>
                </span>
              </>
            )}
          </div>
          <Slider
            label={bodyMode === "move" ? "Body height" : "Turn body"}
            value={axes[2]}
            min={bodyMode === "move" ? 0 : -10}
            max={bodyMode === "move" ? 45 : 10}
            unit={bodyMode === "move" ? "mm" : "°"}
            disabled={!ready}
            onChange={(value) => sendAxes([axes[0], axes[1], value])}
          />
          <div className="body-actions">
            <button
              className="secondary-button"
              disabled={!ready}
              onClick={() => {
                setStopToken((v) => v + 1);
                sendAxes([0, 0, 0]);
              }}
            >
              <ArrowCounterClockwise />
              Center body
            </button>
            <button
              className="stop-button compact"
              onClick={() => {
                engine.stop();
                setStopToken((v) => v + 1);
              }}
            >
              <Square weight="fill" />
              Stop
            </button>
          </div>
        </section>
      )}
      {tab === "settings" && (
        mode === "hexapod" &&
        <section className="secondary-page settings-page">
          <div className="section-heading">
            <span className="eyebrow">YOUR ROBOT, YOUR CONTROL</span>
            <h2>Connection.</h2>
            <p>
              {demo
                ? "Explore the controls in demo mode."
                : "Join your robot’s Wi-Fi, then connect."}
            </p>
          </div>
          <div className="wifi-instructions">
            <WifiHigh size={28} />
            <div>
              <strong>Freenove Hexapod Robot</strong>
              <p>
                Password: <span>Freenove</span>
              </p>
            </div>
          </div>
          {native && !demo && (
            <button
              className="secondary-button"
              onClick={() =>
                window.HexapodNative?.request(
                  JSON.stringify({ id: 0, action: "wifi" }),
                )
              }
            >
              Open Wi-Fi settings
            </button>
          )}
          <div className="connection-fields">
            <label>
              Robot address
              <Field
                value={host}
                onChange={(e) => setHost(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                spellCheck={false}
                disabled={ready || state.status === "connecting"}
                aria-label="Robot address"
              />
            </label>
            <label>
              Port
              <Field
                value={port}
                onChange={(e) => setPort(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                disabled={ready || state.status === "connecting"}
                aria-label="Port"
              />
            </label>
          </div>
          <button
            className={`primary-button ${ready ? "disconnect-button" : ""}`}
            disabled={state.status === "connecting"}
            onClick={() => (ready ? engine.disconnect() : connect())}
          >
            {ready ? (
              <>
                <PlugsConnected />
                {demo ? "End demo" : "Disconnect"}
              </>
            ) : state.status === "connecting" ? (
              "Connecting…"
            ) : (
              <>
                <WifiHigh />
                {demo ? "Start demo" : "Connect robot"}
              </>
            )}
          </button>
          {demo && (
            <p className="info-note">
              Demo uses simulated commands and a sample battery reading. Install
              the Android app to control your robot.
            </p>
          )}
          <div className="settings-divider" />
          <button
            className="settings-disclosure"
            aria-expanded={showOutputs}
            onClick={() => setShowOutputs(!showOutputs)}
          >
            <div>
              <strong>Output switches</strong>
              <span>Eight auxiliary board outputs</span>
            </div>
            <CaretDown
              style={{ transform: showOutputs ? "rotate(180deg)" : "none" }}
            />
          </button>
          {showOutputs && (
            <>
              <div className="outputs-grid">
                {outputPins.map((pin, index) => (
                  <button
                    key={pin}
                    disabled={!ready || state.busy}
                    className={outputs[index] ? "output active" : "output"}
                    aria-pressed={outputs[index]}
                    onClick={() => {
                      const next = !outputs[index];
                      setOutputs((prev) =>
                        prev.map((v, i) => (i === index ? next : v)),
                      );
                      engine.command(
                        [Order.IO, index, next ? 1 : 0],
                        `Output ${pin}`,
                      );
                    }}
                  >
                    <span>{pin}</span>
                    <span className="switch-track">
                      <span />
                    </span>
                  </button>
                ))}
              </div>
              <p className="info-note">
                Switch positions show your last request; the board does not
                report output state.
              </p>
            </>
          )}
          <div className="settings-divider" />
          <div className="calibration-note">
            <Check />
            <div>
              <strong>Keep your calibration</strong>
              <p>
                Connecting and driving won’t rewrite servo calibration. Use the
                original calibration tool for adjustments.
              </p>
            </div>
          </div>
          <p className="stop-note">
            Stop prevents further steps. A step already in progress finishes
            first.
          </p>
          <div className="about">
            <GameController size={32} />
            <strong>HEXAPOD</strong>
            <span>Built by Marwane Haddane</span>
            <small>RoboContol 1.5 · Wi-Fi + Bluetooth</small>
            <small>Compatible with Freenove Hexapod V12.6</small>
          </div>
        </section>
      )}
    </>
  );
  return (
    <div className={`hexapod-app ${native ? "native-app" : "preview-app"}`}>
      <header className={`app-header ${mode === "home" ? "home-header" : "mode-header"}`}>
        <div className="header-brand">
          {mode === "home" && <img className="brand-mascot" src="/assets/brand/robocontrol-mascot.png" alt="RoboContol robot mascot holding a phone" draggable={false} />}
          <div>
          {mode !== "home" && <button className="header-back" aria-label="Back to modes" onClick={() => openMode("home")}><ArrowLeft /></button>}
          <span className="eyebrow">ROBOT CONTROL</span>
          <h1>{mode === "home" ? "RoboContol" : mode === "hexapod" ? "HEXAPOD" : mode === "car" ? "CAR REMOTE" : mode === "voice" ? "VOICE" : mode === "terminal" ? "TERMINAL" : mode === "smart" ? "SMART BUTTONS" : "DEVICES"}</h1>
          </div>
        </div>
        {mode === "home" || mode === "hexapod" ? <button
          className="icon-button"
          aria-label={mode === "home" ? "Connect a device" : "Open settings"}
          onClick={() => mode === "home" ? openMode("devices") : navigate("settings")}
        >
          {mode === "home" ? <Bluetooth /> : <GearSix />}
        </button> : <button className="icon-button" aria-label="Bluetooth device" onClick={() => openMode("devices")}><Bluetooth /></button>}
      </header>
      {mode === "hexapod" && <button
        className="connection-status"
        onClick={() => navigate("settings")}
        aria-label="View connection settings"
      >
        <span className={`status-dot ${ready ? "online" : ""}`} />
        <span>
          {ready
            ? "Connected"
            : state.status === "connecting"
              ? "Connecting…"
              : "Disconnected"}
        </span>
        {demo && <span className="demo-badge">DEMO</span>}
        <span className="voltage">
          {state.voltage === null ? "— V" : `${state.voltage.toFixed(2)} V`}
        </span>
      </button>}
      <Scroll className="app-scroll">
        <div className={`app-content ${tab === "drive" ? "drive-page" : ""} ${mode === "home" ? "home-content" : ""}`}>
          {content}
        </div>
      </Scroll>
      {(state.error || notice) && (
        <div
          className={`notice ${state.error ? "error" : ""}`}
          role={state.error ? "alert" : "status"}
        >
          <span>{state.error || notice}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => (state.error ? engine.disconnect() : setNotice(""))}
          >
            <X />
          </button>
        </div>
      )}
      {mode === "hexapod" ? <footer className="app-footer">
        <nav aria-label="Main navigation">
            {(
            [
              { id: "drive", label: "Drive", Icon: GameController },
              { id: "body", label: "Body", Icon: CubeTransparent },
              { id: "settings", label: "Settings", Icon: GearSix },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <p>Built by Marwane Haddane</p>
      </footer> : mode !== "home" && <footer className="mode-footer"><button onClick={() => openMode("home")}><ArrowLeft /> All modes</button><p>Built by Marwane Haddane</p></footer>}
    </div>
  );
}
function BodyPad({
  mode,
  values,
  disabled,
  stopToken,
  onChange,
}: {
  mode: "move" | "rotate";
  values: number[];
  disabled: boolean;
  stopToken: number;
  onChange: (v: number[]) => void;
}) {
  const active = useRef<number | null>(null);
  const grab = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const position = padFromBodyAxes(mode, values);
  const release = () => {
    active.current = null;
    grab.current = null;
  };
  useEffect(() => {
    release();
  }, [mode, disabled, stopToken]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) release();
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current !== event.pointerId || !grab.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x =
      grab.current.px +
      ((event.clientX - grab.current.x) * 400) / (box.width * 42);
    const y =
      grab.current.py +
      ((event.clientY - grab.current.y) * 360) / (box.height * 42);
    onChange(bodyAxesFromPad(mode, x, y, values[2]));
  };
  return (
    <div
      className={`body-pad ${disabled ? "disabled" : ""}`}
      data-testid="body-pad"
      data-scroll-drag="ignore"
      role="group"
      aria-label={
        mode === "move"
          ? "Body position touch control"
          : "Body tilt touch control"
      }
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={(event) => {
        if (
          disabled ||
          event.button !== 0 ||
          active.current !== null ||
          !(event.target as Element).closest("[data-chassis]")
        )
          return;
        event.preventDefault();
        active.current = event.pointerId;
        grab.current = {
          x: event.clientX,
          y: event.clientY,
          px: position.x,
          py: position.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={drag}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onBlur={release}
      onKeyDown={(event) => {
        if (disabled) return;
        const steps: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (event.key === "Home") {
          event.preventDefault();
          onChange([0, 0, values[2]]);
          return;
        }
        const step = steps[event.key];
        if (!step) return;
        event.preventDefault();
        const scale = mode === "move" ? 30 : 10;
        onChange(
          bodyAxesFromPad(
            mode,
            position.x + step[0] / scale,
            position.y + step[1] / scale,
            values[2],
          ),
        );
      }}
    >
      <RobotRig mode={mode} values={values} disabled={disabled} />
      <span className="sr-only">
        Drag the chassis, or use arrow keys to adjust. Home centers the touch
        control.
      </span>
    </div>
  );
}
function readBindings(key: string, fallback: Binding[]): Binding[] {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return fallback;
    return fallback.map((item, i) => ({
      label: String(parsed[i]?.label ?? item.label).slice(0, 18),
      command: String(parsed[i]?.command ?? item.command).slice(0, 80),
    }));
  } catch { return fallback; }
}
function BindingEditor({
  title, rows, onSave, onCancel, Field,
}: {
  title: string;
  rows: Binding[];
  onSave: (rows: Binding[]) => void;
  onCancel: () => void;
  Field: React.ElementType;
}) {
  const [draft, setDraft] = useState(rows);
  return <div className="binding-editor">
    <div className="binding-editor-title"><div><span className="eyebrow">PERSONALIZE</span><h3>{title}</h3></div><button className="icon-button" aria-label="Close editor" onClick={onCancel}><X /></button></div>
    {draft.map((row, i) => <div className="binding-row" key={i}>
      <Field value={row.label} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((all) => all.map((item, j) => j === i ? { ...item, label: e.target.value } : item))} aria-label={`${title} button ${i + 1} label`} placeholder={`Button ${i + 1}`} />
      <Field value={row.command} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft((all) => all.map((item, j) => j === i ? { ...item, command: e.target.value } : item))} aria-label={`${title} button ${i + 1} command`} placeholder="Command text" autoComplete="off" spellCheck={false} />
    </div>)}
    <p className="info-note">Car and button actions are sent as exact text; terminal and voice commands add a line break. Check your device’s command format.</p>
    <div className="binding-actions"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={() => onSave(draft)}>Save controls</button></div>
  </div>;
}
function Slider({
  label,
  value,
  min,
  max,
  unit,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="axis-slider">
      <span>
        {label}
        <output>
          {value > 0 ? "+" : ""}
          {value}
          {unit === "°" ? "" : " "}
          {unit}
        </output>
      </span>
      <input
        data-scroll-drag="ignore"
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(+e.target.value)}
        aria-label={label}
      />
      <span className="range-endpoints">
        <small>
          {min}
          {unit}
        </small>
        <small>
          {max}
          {unit}
        </small>
      </span>
    </label>
  );
}
function HoldButton({
  label,
  icon,
  disabled,
  onStart,
  onStop,
}: {
  label: string;
  icon: React.ReactNode;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <button
      data-scroll-drag="ignore"
      className="turn-button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        onStart();
      }}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onLostPointerCapture={onStop}
      onKeyDown={(e) => {
        if (!e.repeat && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          onStart();
        }
      }}
      onKeyUp={onStop}
      onBlur={onStop}
    >
      <span className="turn-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
function Joystick({
  disabled,
  stopToken,
  onMove,
  onStop,
}: {
  disabled: boolean;
  stopToken: number;
  onMove: (x: number, y: number) => void;
  onStop: () => void;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (active.current !== event.pointerId) return;
    const r = event.currentTarget.getBoundingClientRect(),
      radius = r.width * 0.34;
    let x = (event.clientX - r.left - r.width / 2) / radius,
      y = (event.clientY - r.top - r.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setPosition({ x: x * radius, y: y * radius });
    onMove(x, y);
  };
  const stop = () => {
    active.current = null;
    setPosition({ x: 0, y: 0 });
    onStop();
  };
  useEffect(() => {
    stop();
  }, [stopToken, disabled]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  return (
    <div
      className={`joystick ${disabled ? "disabled" : ""}`}
      role="group"
      aria-label="Movement joystick"
      data-scroll-drag="ignore"
      data-testid="joystick"
      onPointerDown={(e) => {
        if (disabled || e.button !== 0 || active.current !== null) return;
        e.preventDefault();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <CaretUp className="joystick-arrow up" />
      <CaretDown className="joystick-arrow down" />
      <CaretLeft className="joystick-arrow left" />
      <CaretRight className="joystick-arrow right" />
      <img
        className="joystick-thumb"
        src={`${ASSETS}thumb.png`}
        alt=""
        draggable={false}
        style={{ transform: `translate(${position.x}px,${position.y}px)` }}
      />
      <div className="sr-only">
        {[
          [0, -1, "Forward"],
          [0, 1, "Backward"],
          [-1, 0, "Left"],
          [1, 0, "Right"],
        ].map(([x, y, label]) => (
          <button
            key={label}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onMove(+x, +y);
              }
            }}
            onKeyUp={stop}
            onBlur={stop}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
