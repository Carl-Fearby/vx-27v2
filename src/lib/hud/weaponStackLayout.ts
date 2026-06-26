export function getStackDepthInOrder(
  itemId: number | string,
  selectedId: number | string,
  visibleOrder: Array<number | string>,
): number {
  if (visibleOrder.length <= 1 || itemId === selectedId) return 0;
  let depth = 0;
  let current = selectedId;
  while (current !== itemId) {
    const i = visibleOrder.indexOf(current);
    if (i < 0) return 0;
    current = visibleOrder[(i + 1) % visibleOrder.length];
    depth += 1;
  }
  return depth;
}

export function resolveStackSelection<T extends number | string>(
  selectedId: T,
  visibleOrder: T[],
): T | null {
  if (visibleOrder.length === 0) return null;
  return visibleOrder.includes(selectedId) ? selectedId : visibleOrder[0];
}

const MAX_STACK_TUNE_DEPTH = 3;

export function compressStackTuneDepth(
  logicalDepth: number,
  visibleCount: number,
): number {
  if (logicalDepth <= 0 || visibleCount <= 1) return 0;
  const maxLogical = visibleCount - 1;
  return Math.max(
    1,
    Math.min(
      MAX_STACK_TUNE_DEPTH,
      Math.ceil((logicalDepth / maxLogical) * MAX_STACK_TUNE_DEPTH),
    ),
  );
}

export type StackTuneStep = { x: number; y: number; scale: number };

export function getStackFrameStyleFromDepth(
  depth: number,
  tune: Record<number, StackTuneStep>,
  visibleCount = 4,
): Record<string, string | number> {
  if (depth === 0) {
    return {
      "--slot-x": "0px",
      "--slot-y": "0px",
      "--slot-scale": "1",
      "--slot-z": 4,
    };
  }
  const tuneDepth = compressStackTuneDepth(depth, visibleCount);
  const t = tune[tuneDepth] ?? tune[1];
  return {
    "--slot-x": `${t.x}px`,
    "--slot-y": `${t.y}px`,
    "--slot-scale": String(t.scale),
    "--slot-z": Math.max(1, 4 - depth),
  };
}
