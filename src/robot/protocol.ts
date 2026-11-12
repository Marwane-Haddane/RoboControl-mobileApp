// Freenove V12.6: ProcessingApp/Orders.pde and ArduinoLibraries/FNHR.zip.
export const Order = {
  Echo: 0,
  Voltage: 10,
  IO: 20,
  Leg: 30,
  Calibrate: 32,
  Install: 64,
  CalibrationPose: 66,
  Boot: 68,
  Verify: 70,
  Forward: 80,
  Backward: 82,
  Left: 84,
  Right: 86,
  TurnLeft: 88,
  TurnRight: 90,
  Activate: 92,
  Sleep: 94,
  Switch: 96,
  Crawl: 110,
  Height: 112,
  Move: 114,
  Rotate: 116,
  Twist: 118,
} as const;
const lengths: Record<number, number> = {
  0: 1,
  10: 1,
  20: 3,
  30: 5,
  32: 1,
  64: 1,
  66: 1,
  68: 1,
  70: 1,
  80: 1,
  82: 1,
  84: 1,
  86: 1,
  88: 1,
  90: 1,
  92: 1,
  94: 1,
  96: 1,
  110: 4,
  112: 2,
  114: 4,
  116: 4,
  118: 7,
};
export function validate(payload: number[]) {
  if (
    lengths[payload[0]] !== payload.length ||
    payload.some((n) => !Number.isInteger(n) || n < 0 || n > 127)
  )
    throw new Error("Invalid robot command");
  if (payload[0] === Order.IO && (payload[1] > 7 || payload[2] > 1))
    throw new Error("Invalid output");
  return payload;
}
export const frame = (payload: number[]) =>
  Uint8Array.from([128, ...validate(payload), 129]);
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Math.round(n)));
export function crawl(x: number, y: number, turn = 0) {
  const length = Math.hypot(x, y),
    scale = length > 42 ? 42 / length : 1;
  return [
    Order.Crawl,
    64 + clamp(x * scale, -42, 42),
    64 + clamp(y * scale, -42, 42),
    64 + clamp(turn, -18, 18),
  ];
}
export const height = (z: number) => [Order.Height, 64 + clamp(z, 0, 45)];
export const moveBody = (x: number, y: number, z: number) => [
  Order.Move,
  64 + clamp(x, -30, 30),
  64 + clamp(y, -30, 30),
  64 + clamp(z, 0, 45),
];
export const rotateBody = (x: number, y: number, z: number) => [
  Order.Rotate,
  64 + clamp(x, -10, 10),
  64 + clamp(y, -10, 10),
  64 + clamp(z, -10, 10),
];
// Matches the original Processing body controls: screen-right is negative robot X.
export function bodyAxesFromPad(
  mode: "move" | "rotate",
  screenX: number,
  screenY: number,
  z: number,
) {
  const x = Math.max(-1, Math.min(1, screenX)),
    y = Math.max(-1, Math.min(1, screenY));
  const axes =
    mode === "move"
      ? [-clamp(x * 30, -30, 30), -clamp(y * 30, -30, 30), clamp(z, 0, 45)]
      : [-clamp(y * 10, -10, 10), clamp(x * 10, -10, 10), clamp(z, -10, 10)];
  return axes.map((value) => value || 0);
}
export function padFromBodyAxes(mode: "move" | "rotate", axes: number[]) {
  const point =
    mode === "move"
      ? { x: -axes[0] / 30, y: -axes[1] / 30 }
      : { x: axes[1] / 10, y: -axes[0] / 10 };
  return { x: point.x || 0, y: point.y || 0 };
}
export const voltageFrom = (reply: number[]) => {
  if (
    reply.length !== 3 ||
    reply[0] !== 11 ||
    reply.slice(1).some((n) => n < 0 || n > 127)
  )
    throw new Error("Invalid battery response");
  return (reply[1] * 128 + reply[2]) / 100;
};
