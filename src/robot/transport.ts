import { Order, validate } from "./protocol";
export interface Transport {
  native: boolean;
  connect(host: string, port: number): Promise<void>;
  exchange(payload: number[]): Promise<number[]>;
  disconnect(): void;
}
declare global {
  interface Window {
    HexapodNative?: { request(json: string): void };
    __hexapodResult?: (
      id: number,
      result: { ok: boolean; data?: number[]; error?: string },
    ) => void;
    __deviceResult?: (id: number, result: { ok: boolean; error?: string; text?: string; name?: string; devices?: { name: string; address: string }[] }) => void;
  }
}
export class DemoTransport implements Transport {
  native = false;
  connected = false;
  async connect() {
    this.connected = true;
  }
  async exchange(payload: number[]) {
    validate(payload);
    if (!this.connected) throw new Error("Disconnected");
    await new Promise((resolve) =>
      setTimeout(resolve, payload[0] >= 64 ? 240 : 40),
    );
    if (!this.connected) throw new Error("Disconnected");
    return payload[0] === Order.Voltage
      ? [11, 6, 5]
      : payload[0] === Order.Echo
        ? [1]
        : [23];
  }
  disconnect() {
    this.connected = false;
  }
}
export class AndroidTransport implements Transport {
  native = true;
  private id = 0;
  private waiting = new Map<
    number,
    {
      resolve: (value: number[]) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor() {
    window.__hexapodResult = (id, result) => {
      const task = this.waiting.get(id);
      if (!task) return;
      clearTimeout(task.timer);
      this.waiting.delete(id);
      if (result.ok) task.resolve(result.data ?? []);
      else task.reject(new Error(result.error ?? "Robot did not respond"));
    };
  }
  private request(action: string, args = {}) {
    const id = ++this.id;
    return new Promise<number[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(id);
        reject(new Error("Robot response timed out. Reconnect before moving."));
      }, 15000);
      this.waiting.set(id, { resolve, reject, timer });
      try {
        window.HexapodNative!.request(JSON.stringify({ id, action, ...args }));
      } catch {
        clearTimeout(timer);
        this.waiting.delete(id);
        reject(new Error("Android connection unavailable"));
      }
    });
  }
  async connect(host: string, port: number) {
    await this.request("connect", { host, port });
  }
  exchange(payload: number[]) {
    return this.request("command", { payload: validate(payload) });
  }
  disconnect() {
    window.HexapodNative?.request(
      JSON.stringify({ id: ++this.id, action: "disconnect" }),
    );
    for (const task of this.waiting.values()) {
      clearTimeout(task.timer);
      task.reject(new Error("Disconnected"));
    }
    this.waiting.clear();
  }
}
