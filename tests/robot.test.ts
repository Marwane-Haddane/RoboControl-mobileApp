import test from "node:test";
import assert from "node:assert/strict";
import {
  frame,
  crawl,
  height,
  moveBody,
  rotateBody,
  voltageFrom,
  Order,
  bodyAxesFromPad,
  padFromBodyAxes,
} from "../src/robot/protocol";
import { RobotEngine } from "../src/robot/engine";
import type { Transport } from "../src/robot/transport";
import { rigPose, RIG_FEET } from "../src/robot/rig";
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
test("packets match Freenove binary framing and signed offset encoding", () => {
  assert.deepEqual([...frame([Order.Forward])], [128, 80, 129]);
  assert.deepEqual(crawl(0, 42, 0), [110, 64, 106, 64]);
  assert.deepEqual(crawl(0, 0, -18), [110, 64, 64, 46]);
  assert.deepEqual(height(100), [112, 109]);
  assert.deepEqual(moveBody(-50, 50, -2), [114, 34, 94, 64]);
  assert.deepEqual(rotateBody(-20, 20, 0), [116, 54, 74, 64]);
  assert.equal(voltageFrom([11, 6, 5]), 7.73);
  assert.throws(() => frame([20, 8, 1]));
  assert.throws(() => frame([110, 128, 64, 64]));
});
test("body touch diagram maps screen directions to the original firmware axes", () => {
  assert.deepEqual(bodyAxesFromPad("move", 1, -1, 12), [-30, 30, 12]);
  assert.deepEqual(bodyAxesFromPad("move", -1, 1, 45), [30, -30, 45]);
  assert.deepEqual(bodyAxesFromPad("move", 3, -4, 100), [-30, 30, 45]);
  assert.deepEqual(bodyAxesFromPad("rotate", 1, -1, 4), [10, 10, 4]);
  assert.deepEqual(bodyAxesFromPad("rotate", -4, 2, -50), [-10, -10, -10]);
  assert.deepEqual(bodyAxesFromPad("move", 0, 0, 0), [0, 0, 0]);
  assert.deepEqual(padFromBodyAxes("move", [-30, 30, 12]), { x: 1, y: -1 });
  assert.deepEqual(padFromBodyAxes("rotate", [10, -10, 2]), { x: -1, y: -1 });
  assert.deepEqual(
    moveBody(
      ...(bodyAxesFromPad("move", 1, 0, 10) as [number, number, number]),
    ),
    [114, 34, 64, 74],
  );
});
test("elastic leg preview keeps all six continuous legs connected to planted feet", () => {
  for (const mode of ["move", "rotate"] as const)
    for (const x of mode === "move" ? [-30, 0, 30] : [-10, 0, 10])
      for (const y of mode === "move" ? [-30, 0, 30] : [-10, 0, 10])
        for (const z of mode === "move" ? [0, 45] : [-10, 0, 10]) {
          const rig = rigPose(mode, [x, y, z]);
          assert.equal(rig.legs.length, 6);
          rig.legs.forEach((leg, i) => {
            assert.deepEqual(leg.foot, RIG_FEET[i]);
            assert.ok(
              Math.hypot(leg.foot.x - leg.hip.x, leg.foot.y - leg.hip.y) > 0,
            );
            assert.ok(Number.isFinite(leg.hip.x) && Number.isFinite(leg.hip.y));
          });
        }
  const neutral = rigPose("move", [0, 0, 0]),
    shifted = rigPose("move", [-18, 12, 12]);
  assert.ok(shifted.center.x > neutral.center.x);
  assert.ok(shifted.center.y < neutral.center.y);
  assert.notDeepEqual(shifted.legs[0].hip, neutral.legs[0].hip);
});
class ControlledTransport implements Transport {
  native = true;
  calls: number[][] = [];
  outstanding = 0;
  maxOutstanding = 0;
  resolve: (() => void) | undefined;
  fail = false;
  async connect() {}
  async exchange(payload: number[]) {
    this.calls.push(payload);
    this.outstanding++;
    this.maxOutstanding = Math.max(this.maxOutstanding, this.outstanding);
    try {
      if (payload[0] >= 64)
        await new Promise<void>((resolve, reject) => {
          this.resolve = () =>
            this.fail ? reject(new Error("Lost Wi-Fi")) : resolve();
        });
      return payload[0] === 0 ? [1] : payload[0] === 10 ? [11, 6, 5] : [23];
    } finally {
      this.outstanding--;
    }
  }
  disconnect() {}
}
test("release discards further walking and never overlaps a blocking command", async () => {
  const transport = new ControlledTransport(),
    engine = new RobotEngine(transport);
  await engine.connect("192.168.4.1", 65535);
  await tick();
  engine.hold(crawl(0, 42), "Forward");
  await tick();
  engine.hold(crawl(42, 0), "Left");
  engine.pollVoltage();
  engine.stop();
  transport.resolve!();
  await tick();
  assert.equal(transport.calls.filter((x) => x[0] === 110).length, 1);
  assert.equal(transport.maxOutstanding, 1);
  assert.equal(engine.snapshot().busy, false);
});
test("body updates coalesce to latest desired pose instead of replaying a slider backlog", async () => {
  const transport = new ControlledTransport(),
    engine = new RobotEngine(transport);
  await engine.connect("192.168.4.1", 65535);
  await tick();
  engine.command(moveBody(1, 0, 0), "Pose");
  await tick();
  engine.command(moveBody(2, 0, 0), "Pose");
  engine.command(moveBody(9, 0, 0), "Pose");
  transport.resolve!();
  await tick();
  assert.deepEqual(
    transport.calls.filter((x) => x[0] === 114),
    [moveBody(1, 0, 0), moveBody(9, 0, 0)],
  );
  engine.stop();
  transport.resolve!();
  await tick();
  assert.equal(transport.maxOutstanding, 1);
});
test("connection errors stop motion and never replay it after reconnect", async () => {
  const transport = new ControlledTransport(),
    engine = new RobotEngine(transport);
  await engine.connect("192.168.4.1", 65535);
  await tick();
  engine.hold(crawl(0, 42));
  await tick();
  transport.fail = true;
  transport.resolve!();
  await tick();
  assert.equal(engine.snapshot().status, "error");
  transport.fail = false;
  await engine.connect("192.168.4.1", 65535);
  await tick();
  assert.equal(transport.calls.filter((x) => x[0] === 110).length, 1);
});
test("invalid connection settings cannot reach the transport", async () => {
  const transport = new ControlledTransport(),
    engine = new RobotEngine(transport);
  await engine.connect("192.168.4.999", 65535);
  assert.equal(engine.snapshot().status, "error");
  assert.equal(transport.calls.length, 0);
});
