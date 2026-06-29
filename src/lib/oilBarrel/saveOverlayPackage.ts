import type { ModelOverlayPackage } from "@/lib/oilBarrel/overlayPackage";

export async function saveOverlayPackageToServer(
  overlayPath: string,
  overlayPackage: ModelOverlayPackage,
): Promise<{ savedAt: string }> {
  const response = await fetch("/api/model-overlays", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      overlayPath,
      package: overlayPackage,
    }),
  });

  const data = (await response.json()) as {
    savedAt?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to save overlay package.");
  }

  return { savedAt: data.savedAt ?? new Date().toISOString() };
}
