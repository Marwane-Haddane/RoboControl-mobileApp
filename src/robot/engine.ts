import { Order, voltageFrom } from "./protocol";
import type { Transport } from "./transport";
export type RobotState = {
  status: "disconnected" | "connecting" | "connected" | "error";
  voltage: number | null;
  busy: boolean;
  activity: string;
  error: string;
  asleep: boolean;
  count: number;
};
type Job = { payload: number[]; label: string };
export class RobotEngine {
  private state: RobotState = {
    status: "disconnected",
    voltage: null,
    busy: false,
    activity: "Ready",
    error: "",
    asleep: false,
    count: 0,
  };
  private listeners = new Set<() => void>();
  private motion: Job | null = null;
  private pending: Job | null = null;
  private polling = false;
  private pumping = false;
  private generation = 0;
  constructor(public transport: Transport) {}
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private update(patch: Partial<RobotState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  async connect(host: string, port: number) {
    this.disconnect();
    const generation = this.generation;
    this.update({ status: "connecting", error: "", activity: "Connecting…" });
    try {
      if (
        !/^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
        host.split(".").some((n) => +n > 255) ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
      )
        throw new Error("Enter a valid IPv4 address and port.");
      await this.transport.connect(host, port);
      const echo = await this.transport.exchange([Order.Echo]);
      if (echo.length !== 1 || echo[0] !== 1)
        throw new Error("This device did not identify as the robot.");
      if (generation !== this.generation) return;
      this.update({ status: "connected", activity: "Ready" });
      this.pollVoltage();
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }
  disconnect() {
    this.generation++;
    this.stop();
    this.polling = false;
    this.transport.disconnect();
    this.update({
      status: "disconnected",
      voltage: null,
      busy: false,
      activity: "Ready",
      error: "",
      asleep: false,
    });
  }
  stop() {
    this.motion = null;
    this.pending = null;
    if (this.state.busy) this.update({ activity: "Finishing step…" });
  }
  hold(payload: number[], label = "Moving") {
    if (this.state.status !== "connected") return;
    this.pending = null;
    this.motion = { payload, label };
    void this.pump();
  }
  command(payload: number[], label: string) {
    if (this.state.status !== "connected") return;
    this.motion = null;
    this.pending = { payload, label };
    void this.pump();
  }
  pollVoltage() {
    if (this.state.status !== "connected") return;
    this.polling = true;
    void this.pump();
  }
  private fail(error: unknown) {
    this.generation++;
    this.motion = null;
    this.pending = null;
    this.polling = false;
    this.transport.disconnect();
    this.update({
      status: "error",
      voltage: null,
      busy: false,
      activity: "Stopped",
      error: error instanceof Error ? error.message : "Connection lost",
    });
  }
  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    const generation = this.generation;
    try {
      while (
        this.state.status === "connected" &&
        generation === this.generation
      ) {
        let job = this.pending;
        this.pending = null;
        // Battery polling gets one slot between acknowledged steps.
        if (!job && this.polling) {
          job = { payload: [Order.Voltage], label: "Reading battery" };
          this.polling = false;
        }
        if (!job) job = this.motion;
        if (!job) break;
        this.update({ busy: true, activity: job.label });
        const reply = await this.transport.exchange(job.payload);
        if (generation !== this.generation) break;
        if (job.payload[0] === Order.Voltage)
          this.update({ voltage: voltageFrom(reply) });
        else {
          if (reply.length !== 1 || reply[0] !== 23)
            throw new Error("Unexpected robot acknowledgement");
          this.update({
            count: this.state.count + 1,
            asleep:
              job.payload[0] === Order.Sleep
                ? true
                : job.payload[0] >= 64
                  ? false
                  : this.state.asleep,
          });
        }
      }
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      this.pumping = false;
      if (generation === this.generation)
        this.update({
          busy: false,
          activity: this.state.asleep ? "Sleeping" : "Ready",
        });
      if (
        this.state.status === "connected" &&
        (this.pending || this.motion || this.polling)
      )
        void this.pump();
    }
  }
}
