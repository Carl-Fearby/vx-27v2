import { AnimationGroup, type Node } from "@babylonjs/core";

export type ModelToggleId = string;

export type ModelToggleControl = {
  id: ModelToggleId;
  label: string;
  source: string;
};

type ToggleBinding = {
  id: ModelToggleId;
  label: string;
  source: string;
  primary?: AnimationGroup;
  enabled?: AnimationGroup;
  disabled?: AnimationGroup;
};

type ToggleAction = {
  checked: boolean;
  token: string;
};

type ToggleActionMatch = ToggleAction & {
  index: number;
};

const bindings = new WeakMap<object, Map<ModelToggleId, ToggleBinding>>();
const MOTION_EPSILON = 0.0001;
const CHECKED_ACTIONS = new Set(["open", "on", "show", "extend", "deploy", "activate"]);
const UNCHECKED_ACTIONS = new Set([
  "close",
  "closed",
  "shut",
  "off",
  "hide",
  "retract",
  "stow",
  "deactivate",
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizedParts(value: string): string[] {
  return normalizeText(value).split(" ").filter(Boolean);
}

function slug(value: string, fallback = "toggle"): string {
  return normalizeText(value).replace(/\s+/g, "-") || fallback;
}

function title(value: string): string {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function targetNameChain(target: unknown): string[] {
  const names: string[] = [];
  let cursor = target as (Node & { parent?: unknown }) | null;
  while (cursor) {
    if (typeof cursor.name === "string" && cursor.name) {
      names.push(cursor.name);
    }
    cursor = cursor.parent as (Node & { parent?: unknown }) | null;
  }
  return names;
}

function partNameFromTarget(target: unknown): string | null {
  const names = targetNameChain(target);
  return (
    names.find((name) => /door|hatch|lid|cover|drawer|switch|button|lever|ramp/i.test(name)) ??
    names.find((name) => /hinge|pivot|socket|root/i.test(name)) ??
    names[0] ??
    null
  );
}

function semanticDoorId(text: string): string | null {
  const normalized = normalizeText(text);
  if (!normalized.includes("door")) {
    return null;
  }

  const front = normalized.includes("front");
  const back = normalized.includes("back") || normalized.includes("rear");
  const left = normalized.includes("left");
  const right = normalized.includes("right");

  if (front && left) return "front-left";
  if (front && right) return "front-right";
  if (back && left) return "back-left";
  if (back && right) return "back-right";
  return null;
}

function partIdFromText(text: string): string {
  return semanticDoorId(text) ?? slug(text);
}

function partLabel(id: string, text: string): string {
  if (id === "front-left") return "Front left";
  if (id === "front-right") return "Front right";
  if (id === "back-left") return "Back left";
  if (id === "back-right") return "Back right";
  return title(text || id);
}

function actionFromParts(parts: string[]): ToggleActionMatch | null {
  let match: ToggleActionMatch | null = null;
  parts.forEach((part, index) => {
    if (CHECKED_ACTIONS.has(part)) {
      match = { checked: true, token: part, index };
    } else if (UNCHECKED_ACTIONS.has(part)) {
      match = { checked: false, token: part, index };
    }
  });
  return match;
}

function actionFromText(text: string): ToggleAction | null {
  const match = actionFromParts(normalizedParts(text));
  return match ? { checked: match.checked, token: match.token } : null;
}

function stripActionWords(text: string): string {
  return normalizedParts(text)
    .filter((part) => !CHECKED_ACTIONS.has(part) && !UNCHECKED_ACTIONS.has(part))
    .join(" ");
}

function partNameFromAnimationName(name: string): string | null {
  const parts = normalizedParts(name);
  const action = actionFromParts(parts);
  if (!action) {
    return null;
  }
  const before = parts.slice(0, action.index).join(" ");
  const after = parts.slice(action.index + 1).join(" ");
  return before || after || null;
}

function numericParts(value: unknown): number[] {
  if (typeof value === "number") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((entry): entry is number => typeof entry === "number");
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return ["x", "y", "z", "w", "r", "g", "b", "a"]
      .map((key) => source[key])
      .filter((entry): entry is number => typeof entry === "number");
  }
  return [];
}

function valuesDiffer(left: unknown, right: unknown): boolean {
  const leftParts = numericParts(left);
  const rightParts = numericParts(right);
  if (leftParts.length === 0 || leftParts.length !== rightParts.length) {
    return left !== right;
  }
  return leftParts.some(
    (value, index) => Math.abs(value - rightParts[index]) > MOTION_EPSILON,
  );
}

function targetedAnimationChanges(targeted: AnimationGroup["targetedAnimations"][number]): boolean {
  const keys = targeted.animation.getKeys();
  if (keys.length < 2) {
    return false;
  }
  const first = keys[0]?.value;
  return keys.slice(1).some((key) => valuesDiffer(first, key.value));
}

function cloneToggleAnimationGroup(
  source: AnimationGroup,
  toggleId: string,
  targetFilter: (target: unknown) => boolean,
): AnimationGroup | null {
  const group = new AnimationGroup(
    `${source.name || "toggle_animation"}_${toggleId}`,
    source.getScene(),
  );

  for (const targeted of source.targetedAnimations) {
    if (targetFilter(targeted.target) && targetedAnimationChanges(targeted)) {
      group.addTargetedAnimation(targeted.animation, targeted.target);
    }
  }

  if (group.targetedAnimations.length === 0) {
    group.dispose();
    return null;
  }

  group.normalize(source.from, source.to);
  group.stop();
  return group;
}

export function detectModelToggleControls(
  owner: object,
  animationGroups: AnimationGroup[],
): ModelToggleControl[] {
  const next = new Map<ModelToggleId, ToggleBinding>();

  for (const sourceGroup of animationGroups) {
    sourceGroup.stop();
    const sourceAction = actionFromText(sourceGroup.name);
    const sourcePartName = partNameFromAnimationName(sourceGroup.name);
    const targetsByPart = new Map<string, { labelSeed: string; targets: unknown[] }>();

    for (const targeted of sourceGroup.targetedAnimations) {
      if (!targetedAnimationChanges(targeted)) {
        continue;
      }
      const targetPartName = partNameFromTarget(targeted.target);
      const partName = stripActionWords(sourcePartName ?? targetPartName ?? "");
      if (!partName) {
        continue;
      }
      const id = partIdFromText(partName);
      const entry = targetsByPart.get(id) ?? { labelSeed: partName, targets: [] };
      entry.targets.push(targeted.target);
      targetsByPart.set(id, entry);
    }

    for (const [id, { labelSeed, targets }] of targetsByPart) {
      const targetSet = new Set(targets);
      const group = cloneToggleAnimationGroup(sourceGroup, id, (target) =>
        targetSet.has(target),
      );
      if (!group) {
        continue;
      }

      const existing = next.get(id);
      const binding: ToggleBinding =
        existing ?? {
          id,
          label: partLabel(id, labelSeed),
          source: sourceGroup.name || group.name,
        };
      const action = sourceAction ?? actionFromText(`${sourceGroup.name} ${binding.label}`);

      if (action?.checked === true) {
        binding.enabled = group;
      } else if (action?.checked === false) {
        binding.disabled = group;
      } else {
        binding.primary = group;
      }
      next.set(id, binding);
    }
  }

  bindings.set(owner, next);
  return Array.from(next.values()).map((binding) => ({
    id: binding.id,
    label: binding.label,
    source: binding.source,
  }));
}

function playAndHold(group: AnimationGroup, from: number, to: number): void {
  group.stop(true);
  group.onAnimationGroupEndObservable.clear();
  group.onAnimationGroupEndObservable.addOnce(() => {
    group.goToFrame(to);
    group.pause();
  });
  group.start(false, 1, from, to);
}

function stopBindingGroups(binding: ToggleBinding): void {
  binding.enabled?.stop(true);
  binding.disabled?.stop(true);
  binding.primary?.stop(true);
}

function resolveTogglePlayback(
  binding: ToggleBinding,
  open: boolean,
): { group: AnimationGroup; from: number; to: number } | null {
  const group = open
    ? binding.enabled ?? binding.primary ?? binding.disabled
    : binding.disabled ?? binding.primary ?? binding.enabled;
  if (!group) return null;

  const from = open || binding.disabled ? group.from : group.to;
  const to = open || binding.disabled ? group.to : group.from;
  return { group, from, to };
}

export function setModelToggleOpen(
  owner: object,
  doorId: ModelToggleId,
  open: boolean,
): boolean {
  const binding = bindings.get(owner)?.get(doorId);
  if (!binding) return false;

  const playback = resolveTogglePlayback(binding, open);
  if (!playback) return false;

  stopBindingGroups(binding);
  playAndHold(playback.group, playback.from, playback.to);
  return true;
}

export function snapModelToggleOpen(
  owner: object,
  doorId: ModelToggleId,
  open: boolean,
): boolean {
  const binding = bindings.get(owner)?.get(doorId);
  if (!binding) return false;

  const playback = resolveTogglePlayback(binding, open);
  if (!playback) return false;

  stopBindingGroups(binding);
  playback.group.start(false, 1, playback.from, playback.to);
  playback.group.pause();
  playback.group.goToFrame(playback.to);
  playback.group.pause();
  return true;
}

export const detectContainerDoorControls = detectModelToggleControls;
export const setContainerDoorOpen = setModelToggleOpen;
export type ContainerDoorId = ModelToggleId;
export type ContainerDoorControl = ModelToggleControl;
