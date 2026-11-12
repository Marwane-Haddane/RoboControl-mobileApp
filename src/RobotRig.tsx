import { useEffect, useRef, useState, type CSSProperties } from "react";
import { rigPose, type Point } from "./robot/rig";
const ROOT = "/assets/hexapod/";
function useAnimatedPose(target: number[]) {
  const [pose, setPose] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setPose(target);
      return;
    }
    let frame = 0,
      last = performance.now();
    const update = (time: number) => {
      const mix = 1 - Math.exp(-Math.min(50, time - last) / 45);
      last = time;
      const next = current.current.map((v, i) =>
        Math.abs(target[i] - v) < 0.025 ? target[i] : v + (target[i] - v) * mix,
      );
      current.current = next;
      setPose(next);
      if (next.some((v, i) => v !== target[i]))
        frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return pose;
}
function ElasticLeg({ from, to }: { from: Point; to: Point }) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = Math.hypot(dx, dy),
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const style: CSSProperties = {
    left: `${from.x / 4}%`,
    top: `${from.y / 3.6}%`,
    width: `${length / 4}%`,
    transform: `translateY(-50%) rotate(${angle}deg)`,
  };
  return (
    <img
      className="rig-elastic-leg"
      src={`${ROOT}rig-elastic-leg.svg`}
      alt=""
      style={style}
      draggable={false}
    />
  );
}
export function RobotRig({
  mode,
  values,
  disabled,
}: {
  mode: "move" | "rotate";
  values: number[];
  disabled: boolean;
}) {
  const pose = useAnimatedPose(values),
    rig = rigPose(mode, pose);
  return (
    <>
      <img
        className="rig-neutral"
        src={`${ROOT}rig-chassis.png`}
        alt=""
        draggable={false}
      />
      {rig.legs.map((leg, i) => (
        <div className="rig-leg" key={i} data-leg={i}>
          <ElasticLeg from={leg.hip} to={leg.foot} />
        </div>
      ))}
      <button
        className="rig-chassis"
        data-chassis="true"
        aria-label="Drag robot chassis"
        tabIndex={-1}
        disabled={disabled}
        style={{
          left: `${rig.center.x / 4}%`,
          top: `${rig.center.y / 3.6}%`,
          transform: `translate(-50%,-50%) matrix(${rig.matrix.join(",")},0,0)`,
          filter: `brightness(1.2) drop-shadow(0 0 1px #00ddf4) drop-shadow(0 ${4 + rig.bodyHeight * 0.1}px ${5 + rig.bodyHeight * 0.1}px #0008)`,
        }}
      >
        <img
          src={`${ROOT}rig-chassis.png`}
          alt="Top-view hexapod chassis; drag to adjust its pose"
          draggable={false}
        />
      </button>
    </>
  );
}
