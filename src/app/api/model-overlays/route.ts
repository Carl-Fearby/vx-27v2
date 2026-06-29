import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import type { ModelOverlayPackage } from "@/lib/oilBarrel/overlayPackage";

export const runtime = "nodejs";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const MODELS_ROOT = path.join(PUBLIC_ROOT, "models");

function devOnlyGuard() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Overlay save is disabled in production." },
      { status: 403 },
    );
  }
  return null;
}

function resolveOverlayFilePath(overlayPath: string): string | null {
  if (
    typeof overlayPath !== "string" ||
    !overlayPath.startsWith("/models/") ||
    !overlayPath.endsWith(".overlay.json")
  ) {
    return null;
  }

  const relative = overlayPath.replace(/^\/+/, "");
  const absolute = path.resolve(PUBLIC_ROOT, relative);
  const modelsRootResolved = `${path.resolve(MODELS_ROOT)}${path.sep}`;
  if (!absolute.startsWith(modelsRootResolved)) {
    return null;
  }

  return absolute;
}

export async function PUT(request: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) {
    return blocked;
  }

  let body: { overlayPath?: string; package?: ModelOverlayPackage };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const absolutePath = resolveOverlayFilePath(body.overlayPath ?? "");
  if (!absolutePath || !body.package) {
    return NextResponse.json({ error: "Invalid overlay path or package." }, { status: 400 });
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(body.package, null, 2)}\n`, "utf8");

  return NextResponse.json({
    overlayPath: body.overlayPath,
    savedAt: new Date().toISOString(),
  });
}
