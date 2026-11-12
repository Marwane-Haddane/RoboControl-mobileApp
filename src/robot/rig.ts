export type Point = { x: number; y: number };
export const RIG_FEET: Point[] = [
  { x: 56, y: 36 },
  { x: 18, y: 180 },
  { x: 56, y: 324 },
  { x: 344, y: 36 },
  { x: 382, y: 180 },
  { x: 344, y: 324 },
];
export function rigPose(mode: "move" | "rotate", axes: number[]) {
  const [x, y, z] = axes;
  const roll = mode === "rotate" ? (x * Math.PI) / 180 : 0,
    pitch = mode === "rotate" ? (y * Math.PI) / 180 : 0,
    yaw = mode === "rotate" ? (z * Math.PI) / 180 : 0;
  const cx = Math.cos(roll),
    sx = Math.sin(roll),
    cy = Math.cos(pitch),
    sy = Math.sin(pitch),
    cz = Math.cos(yaw),
    sz = Math.sin(yaw);
  const matrix = [
    cy * cz,
    cy * sz,
    sy * sx * cz - cx * sz,
    sy * sx * sz + cx * cz,
  ];
  const center = {
    x: 200 + (mode === "move" ? -x * 1.4 : 0),
    y: 180 + (mode === "move" ? -y * 1.4 : 0),
  };
  const bodyHeight = mode === "move" ? z : 0;
  const legs = RIG_FEET.map((foot, i) => {
    const side = i < 3 ? -1 : 1,
      row = i % 3,
      lx = side * (row === 1 ? 85 : 73),
      ly = [-50, -2, 45][row];
    const hip = {
      x: center.x + matrix[0] * lx + matrix[2] * ly,
      y: center.y + matrix[1] * lx + matrix[3] * ly,
    };
    return { hip, foot };
  });
  return { center, matrix, legs, bodyHeight };
}
