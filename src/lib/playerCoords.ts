export type PlayerCoords = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
};

export function formatPlayerCoordsJson(coords: PlayerCoords, pretty = true): string {
  const payload = {
    x: Number(coords.x.toFixed(3)),
    y: Number(coords.y.toFixed(3)),
    z: Number(coords.z.toFixed(3)),
    yaw: Number(coords.yaw.toFixed(4)),
    pitch: Number(coords.pitch.toFixed(4)),
  };

  return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
}
