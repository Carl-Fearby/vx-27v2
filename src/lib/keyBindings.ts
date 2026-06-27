export type BindingAction =
  | "forward"
  | "backward"
  | "strafeLeft"
  | "strafeRight"
  | "jump"
  | "crouch"
  | "sprint"
  | "openSettings"
  | "materialEdit"
  | "dayNightToggle"
  | "flashlightToggle"
  | "lookUp"
  | "lookDown"
  | "lookLeft"
  | "lookRight";

export type KeyBindingsMap = Record<BindingAction, string | string[]>;

export const BINDINGS_STORAGE_KEY = "vx27-key-bindings";

export const DEFAULT_BINDINGS: KeyBindingsMap = {
  forward: "KeyW",
  backward: "KeyS",
  strafeLeft: "KeyA",
  strafeRight: "KeyD",
  jump: "Space",
  crouch: "KeyZ",
  sprint: ["ShiftLeft", "ShiftRight"],
  openSettings: "",
  materialEdit: "KeyE",
  dayNightToggle: "KeyN",
  flashlightToggle: "KeyF",
  lookUp: "ArrowUp",
  lookDown: "ArrowDown",
  lookLeft: "ArrowLeft",
  lookRight: "ArrowRight",
};

export const BINDING_ROWS: Array<{ id: BindingAction; label: string }> = [
  { id: "forward", label: "Move forward" },
  { id: "backward", label: "Move backward" },
  { id: "strafeLeft", label: "Strafe left" },
  { id: "strafeRight", label: "Strafe right" },
  { id: "jump", label: "Jump" },
  { id: "crouch", label: "Crouch" },
  { id: "sprint", label: "Run" },
  { id: "openSettings", label: "Open settings" },
  { id: "materialEdit", label: "Material edit toggle" },
  { id: "dayNightToggle", label: "Toggle day / night" },
  { id: "flashlightToggle", label: "Toggle flashlight" },
  { id: "lookUp", label: "Look up" },
  { id: "lookDown", label: "Look down" },
  { id: "lookLeft", label: "Look left" },
  { id: "lookRight", label: "Look right" },
];

const CODE_LABELS: Record<string, string> = {
  KeyW: "W",
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyZ: "Z",
  KeyE: "E",
  KeyF: "F",
  KeyN: "N",
  Space: "Space",
  Escape: "Esc",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

function cloneBindings(source: KeyBindingsMap): KeyBindingsMap {
  const out = {} as KeyBindingsMap;
  for (const [key, value] of Object.entries(source) as Array<
    [BindingAction, string | string[]]
  >) {
    out[key] = Array.isArray(value) ? [...value] : value;
  }
  return out;
}

export function formatBindingCode(code: string): string {
  if (!code) {
    return "—";
  }
  return CODE_LABELS[code] ?? code.replace(/^Key/, "").replace(/^Digit/, "");
}

export function formatBindingValue(value: string | string[] | undefined): string {
  if (!value) {
    return "—";
  }
  if (Array.isArray(value)) {
    const labels = [...new Set(value.map(formatBindingCode))];
    return labels.join(" / ");
  }
  return formatBindingCode(value);
}

export function loadKeyBindings(): KeyBindingsMap {
  if (typeof window === "undefined") {
    return cloneBindings(DEFAULT_BINDINGS);
  }

  try {
    const raw = window.localStorage.getItem(BINDINGS_STORAGE_KEY);
    if (!raw) {
      return cloneBindings(DEFAULT_BINDINGS);
    }

    const parsed = JSON.parse(raw) as Partial<KeyBindingsMap>;
    const merged = cloneBindings(DEFAULT_BINDINGS);
    for (const row of BINDING_ROWS) {
      const value = parsed[row.id];
      if (typeof value === "string") {
        merged[row.id] = value;
      } else if (Array.isArray(value) && value.every((code) => typeof code === "string")) {
        merged[row.id] = value;
      }
    }
    return merged;
  } catch {
    return cloneBindings(DEFAULT_BINDINGS);
  }
}

export function saveKeyBindings(bindings: KeyBindingsMap): KeyBindingsMap {
  const next = cloneBindings(DEFAULT_BINDINGS);
  for (const row of BINDING_ROWS) {
    next[row.id] = Array.isArray(bindings[row.id])
      ? [...(bindings[row.id] as string[])]
      : bindings[row.id];
  }

  if (typeof window !== "undefined") {
    window.localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

export function resetKeyBindings(): KeyBindingsMap {
  return saveKeyBindings(DEFAULT_BINDINGS);
}

export function getBindingCodes(
  bindings: KeyBindingsMap,
  action: BindingAction,
): string[] {
  const value = bindings[action];
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function isBindingDown(
  bindings: KeyBindingsMap,
  action: BindingAction,
  pressed: ReadonlySet<string>,
): boolean {
  return getBindingCodes(bindings, action).some((code) => pressed.has(code));
}

export function eventMatchesBinding(
  bindings: KeyBindingsMap,
  action: BindingAction,
  code: string,
): boolean {
  if (action === "openSettings" && code === "Escape") {
    return false;
  }

  return getBindingCodes(bindings, action).includes(code);
}

export function syncGameCoreInput(
  gameCore: {
    set_input(
      forward: boolean,
      backward: boolean,
      left: boolean,
      right: boolean,
      look_up: boolean,
      look_down: boolean,
      look_left: boolean,
      look_right: boolean,
      jump: boolean,
      sprint: boolean,
      crouch: boolean,
    ): void;
    clear_input(): void;
  },
  bindings: KeyBindingsMap,
  pressed: ReadonlySet<string>,
): void {
  gameCore.set_input(
    isBindingDown(bindings, "forward", pressed),
    isBindingDown(bindings, "backward", pressed),
    isBindingDown(bindings, "strafeLeft", pressed),
    isBindingDown(bindings, "strafeRight", pressed),
    isBindingDown(bindings, "lookUp", pressed),
    isBindingDown(bindings, "lookDown", pressed),
    isBindingDown(bindings, "lookLeft", pressed),
    isBindingDown(bindings, "lookRight", pressed),
    isBindingDown(bindings, "jump", pressed),
    isBindingDown(bindings, "sprint", pressed),
    isBindingDown(bindings, "crouch", pressed),
  );
}
