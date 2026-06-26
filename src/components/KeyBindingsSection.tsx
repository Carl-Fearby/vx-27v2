"use client";

import { useEffect, useState } from "react";
import {
  BINDING_ROWS,
  formatBindingValue,
  resetKeyBindings,
  type BindingAction,
  type KeyBindingsMap,
} from "@/lib/keyBindings";

type KeyBindingsSectionProps = {
  bindings: KeyBindingsMap;
  onChange: (next: KeyBindingsMap) => void;
};

export default function KeyBindingsSection({
  bindings,
  onChange,
}: KeyBindingsSectionProps) {
  const [rebindAction, setRebindAction] = useState<BindingAction | null>(null);

  useEffect(() => {
    if (!rebindAction) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.code === "Escape") {
        setRebindAction(null);
        return;
      }

      if (
        event.code === "Unidentified" ||
        event.code.startsWith("Meta") ||
        event.code === "Tab"
      ) {
        return;
      }

      onChange({ ...bindings, [rebindAction]: event.code });
      setRebindAction(null);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [bindings, onChange, rebindAction]);

  return (
    <div className="settings-list">
      {rebindAction ? (
        <p className="settings-rebind-prompt">
          Press a key for{" "}
          <strong>
            {BINDING_ROWS.find((row) => row.id === rebindAction)?.label}
          </strong>
          … (Esc to cancel)
        </p>
      ) : null}

      <ul className="bindings-list">
        {BINDING_ROWS.map((row) => (
          <li key={row.id} className="binding-row">
            <span className="binding-label">{row.label}</span>
            <button
              type="button"
              className={
                rebindAction === row.id
                  ? "binding-key binding-key--active"
                  : "binding-key"
              }
              onClick={() => setRebindAction(row.id)}
            >
              {rebindAction === row.id ? "…" : formatBindingValue(bindings[row.id])}
            </button>
          </li>
        ))}
        <li className="binding-row binding-row--fixed">
          <span className="binding-label">Look (mouse)</span>
          <span className="binding-key binding-key--fixed">Mouse</span>
        </li>
      </ul>

      <div className="settings-row">
        <button
          type="button"
          className="settings-copy-button"
          onClick={() => onChange(resetKeyBindings())}
        >
          Reset bindings to default
        </button>
      </div>
    </div>
  );
}
