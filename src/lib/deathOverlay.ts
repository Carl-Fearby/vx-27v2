export type DeathOverlayPhase = "hidden" | "active" | "fading";

export function showDeathOverlay(
  overlayEl: HTMLElement | null,
  reasonEl: HTMLElement | null,
  titleEl: HTMLElement | null,
  hintEl: HTMLElement | null,
  reason: string,
): void {
  if (titleEl) {
    titleEl.textContent = "YOU DIED";
  }
  if (hintEl) {
    hintEl.textContent = "Click to respawn";
  }
  if (reasonEl) {
    reasonEl.textContent = reason;
  }
  if (!overlayEl) {
    return;
  }
  overlayEl.setAttribute("aria-hidden", "false");
  overlayEl.classList.remove("deathOverlayFading");
  overlayEl.classList.remove("deathOverlayActive");
  void overlayEl.offsetWidth;
  overlayEl.classList.add("deathOverlayActive");
}

export function beginDeathOverlayFade(overlayEl: HTMLElement | null): void {
  if (!overlayEl) {
    return;
  }
  overlayEl.classList.remove("deathOverlayActive");
  void overlayEl.offsetWidth;
  overlayEl.classList.add("deathOverlayFading");
}

export function hideDeathOverlay(overlayEl: HTMLElement | null): void {
  if (!overlayEl) {
    return;
  }
  overlayEl.classList.remove("deathOverlayActive");
  overlayEl.classList.remove("deathOverlayFading");
  overlayEl.setAttribute("aria-hidden", "true");
}
