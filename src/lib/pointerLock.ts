const POINTER_LOCK_RECAPTURE_DELAY_MS = 80;

export function safeRequestPointerLock(
  element: Element,
  retries = 3,
): void {
  if (document.pointerLockElement === element) {
    return;
  }

  const attempt = (remaining: number) => {
    if (document.pointerLockElement === element) {
      return;
    }

    if (element instanceof HTMLElement) {
      element.focus({ preventScroll: true });
    }
    const result = element.requestPointerLock();
    if (result instanceof Promise) {
      result.catch(() => {
        if (remaining > 0) {
          requestAnimationFrame(() => attempt(remaining - 1));
        }
      });
    }
  };

  attempt(retries);
}

export function safeExitPointerLock(): void {
  if (!document.pointerLockElement) {
    return;
  }

  try {
    document.exitPointerLock();
  } catch {
    // Pointer lock may already be releasing.
  }
}

/** Re-request pointer lock after UI closes — delay avoids Esc swallowing the lock. */
export function schedulePointerLockRecapture(element: Element | null): void {
  if (!element) {
    return;
  }

  window.setTimeout(() => {
    safeRequestPointerLock(element);
    requestAnimationFrame(() => safeRequestPointerLock(element));
  }, POINTER_LOCK_RECAPTURE_DELAY_MS);
}
