"use client";

import { useCallback, useEffect, useState } from "react";
import {
  loadKeyBindings,
  saveKeyBindings,
  type KeyBindingsMap,
} from "@/lib/keyBindings";

export function useKeyBindings() {
  const [bindings, setBindings] = useState<KeyBindingsMap>(() =>
    loadKeyBindings(),
  );

  useEffect(() => {
    setBindings(loadKeyBindings());

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "vx27-key-bindings") {
        setBindings(loadKeyBindings());
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateBindings = useCallback((next: KeyBindingsMap) => {
    setBindings(saveKeyBindings(next));
  }, []);

  const patchBindings = useCallback((patch: Partial<KeyBindingsMap>) => {
    setBindings((current) => saveKeyBindings({ ...current, ...patch }));
  }, []);

  return { bindings, updateBindings, patchBindings };
}
