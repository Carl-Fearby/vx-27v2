import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MODEL_LIBRARY_FOLDER,
  MODEL_LIBRARY_FOLDERS,
  type ObjectEditorAnimationToggleStates,
  type ObjectEditorAsset,
} from "@/lib/objectEditor/catalog";
import {
  buildModelAssetId,
  buildModelPublicPath,
  parseModelSegments,
  titleCaseSegment,
} from "@/lib/objectEditor/modelPath";

export const runtime = "nodejs";

const MODELS_ROOT = path.join(process.cwd(), "public", "models");
const USER_CATALOG_PATH = path.join(MODELS_ROOT, "user-catalog.json");
const GLB_MAGIC = 0x46546c67;
const MAX_FILE_BYTES = 80 * 1024 * 1024;
const STANDARD_MODEL_FOLDERS = new Set<string>(MODEL_LIBRARY_FOLDERS);

type StoredCatalogEntry = ObjectEditorAsset & {
  folder: string;
  modelName: string;
  savedAt: string;
};

function devOnlyGuard() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Model upload is disabled in production." },
      { status: 403 },
    );
  }
  return null;
}

async function readUserCatalog(): Promise<StoredCatalogEntry[]> {
  try {
    const raw = await readFile(USER_CATALOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredCatalogEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeUserCatalog(entries: StoredCatalogEntry[]): Promise<void> {
  await mkdir(MODELS_ROOT, { recursive: true });
  await writeFile(USER_CATALOG_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function isGlbBuffer(buffer: Buffer): boolean {
  return buffer.length >= 12 && buffer.readUInt32LE(0) === GLB_MAGIC;
}

function toPublicAsset(entry: StoredCatalogEntry): ObjectEditorAsset {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    type: "glb",
    path: entry.path,
    notes: entry.notes,
    animationToggles: entry.animationToggles,
    savedAt: entry.savedAt,
  };
}

function parseAnimationToggles(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const toggles: ObjectEditorAnimationToggleStates = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (typeof key === "string" && key.length <= 120 && typeof entry === "boolean") {
        toggles[key] = entry;
      }
    }
    return Object.keys(toggles).length > 0 ? toggles : undefined;
  } catch {
    return undefined;
  }
}

async function scanModelFolderPaths(relativeDir = ""): Promise<string[]> {
  const absoluteDir = relativeDir
    ? path.join(MODELS_ROOT, relativeDir)
    : MODELS_ROOT;

  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const folders: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }
    const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    folders.push(relPath);
    folders.push(...(await scanModelFolderPaths(relPath)));
  }

  return folders;
}

export async function GET() {
  const blocked = devOnlyGuard();
  if (blocked) {
    return blocked;
  }

  const [catalog, folders] = await Promise.all([
    readUserCatalog(),
    scanModelFolderPaths(),
  ]);
  return NextResponse.json({
    assets: catalog.map(toPublicAsset),
    folders: [...new Set(folders)].sort((a, b) => a.localeCompare(b)),
  });
}

export async function POST(request: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) {
    return blocked;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  const folderValue = formData.get("folder");
  const modelNameValue = formData.get("modelName");

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: "Missing GLB file." }, { status: 400 });
  }
  if (typeof folderValue !== "string" || typeof modelNameValue !== "string") {
    return NextResponse.json({ error: "Folder and model name are required." }, { status: 400 });
  }

  const segments = parseModelSegments(folderValue, modelNameValue);
  if (!segments) {
    return NextResponse.json(
      { error: "Folder and model name must use letters, numbers, _ or -." },
      { status: 400 },
    );
  }
  if (!STANDARD_MODEL_FOLDERS.has(segments.folder)) {
    return NextResponse.json(
      { error: "Choose one of the standard model folders." },
      { status: 400 },
    );
  }

  const displayNameValue = formData.get("displayName");
  const categoryValue = formData.get("category");
  const animationToggles = parseAnimationToggles(formData.get("animationToggles"));
  const displayNameRaw =
    typeof displayNameValue === "string" ? displayNameValue.trim() : "";
  const categoryRaw =
    typeof categoryValue === "string" ? categoryValue.trim() : "";

  const displayName =
    displayNameRaw || titleCaseSegment(segments.modelName) || segments.modelName;
  const category =
    categoryRaw ||
    titleCaseSegment(segments.folder) ||
    titleCaseSegment(DEFAULT_MODEL_LIBRARY_FOLDER);

  if (displayName.length > 80 || category.length > 40) {
    return NextResponse.json({ error: "Display name or category is too long." }, { status: 400 });
  }

  if (!fileValue.name.toLowerCase().endsWith(".glb")) {
    return NextResponse.json({ error: "Only .glb files are supported." }, { status: 400 });
  }

  if (fileValue.size <= 0 || fileValue.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is empty or exceeds the 80 MB limit." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await fileValue.arrayBuffer());
  if (!isGlbBuffer(buffer)) {
    return NextResponse.json({ error: "File is not a valid GLB." }, { status: 400 });
  }

  const folderDir = path.join(MODELS_ROOT, segments.folder);
  const fileName = `${segments.modelName}.glb`;
  const absolutePath = path.join(folderDir, fileName);
  const resolvedFile = path.resolve(absolutePath);

  if (!resolvedFile.startsWith(`${path.resolve(MODELS_ROOT)}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid save path." }, { status: 400 });
  }

  await mkdir(folderDir, { recursive: true });

  let overwritten = false;
  try {
    await readFile(resolvedFile);
    overwritten = true;
  } catch {
    overwritten = false;
  }

  await writeFile(resolvedFile, buffer);

  const catalog = await readUserCatalog();
  const id = buildModelAssetId(segments.folder, segments.modelName);
  const publicPath = buildModelPublicPath(segments.folder, segments.modelName);
  const entry: StoredCatalogEntry = {
    id,
    name: displayName,
    category,
    type: "glb",
    path: publicPath,
    notes: "Saved from object editor.",
    animationToggles,
    folder: segments.folder,
    modelName: segments.modelName,
    savedAt: new Date().toISOString(),
  };

  const nextCatalog = catalog.filter((item) => item.id !== id);
  nextCatalog.push(entry);
  nextCatalog.sort((a, b) => a.path.localeCompare(b.path));
  await writeUserCatalog(nextCatalog);

  return NextResponse.json({
    asset: toPublicAsset(entry),
    overwritten,
  });
}

export async function DELETE(request: NextRequest) {
  const blocked = devOnlyGuard();
  if (blocked) {
    return blocked;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const { assetId, confirmName } =
    payload && typeof payload === "object"
      ? (payload as { assetId?: unknown; confirmName?: unknown })
      : {};
  if (typeof assetId !== "string" || typeof confirmName !== "string") {
    return NextResponse.json(
      { error: "Asset id and confirmation name are required." },
      { status: 400 },
    );
  }

  const catalog = await readUserCatalog();
  const entry = catalog.find((item) => item.id === assetId);
  if (!entry) {
    return NextResponse.json(
      { error: "Only saved user-catalog models can be deleted here." },
      { status: 404 },
    );
  }
  if (confirmName !== entry.name) {
    return NextResponse.json(
      { error: `Type ${entry.name} exactly to confirm delete.` },
      { status: 400 },
    );
  }

  const segments = parseModelSegments(entry.folder, entry.modelName);
  if (!segments || buildModelAssetId(segments.folder, segments.modelName) !== entry.id) {
    return NextResponse.json({ error: "Catalog entry has an invalid path." }, { status: 400 });
  }

  const filePath = path.resolve(
    path.join(MODELS_ROOT, segments.folder, `${segments.modelName}.glb`),
  );
  const modelsRoot = path.resolve(MODELS_ROOT);
  if (!filePath.startsWith(`${modelsRoot}${path.sep}`)) {
    return NextResponse.json({ error: "Invalid delete path." }, { status: 400 });
  }

  try {
    await unlink(filePath);
  } catch (error) {
    const code = typeof error === "object" && error ? (error as { code?: string }).code : "";
    if (code !== "ENOENT") {
      return NextResponse.json({ error: "Could not delete GLB file." }, { status: 500 });
    }
  }

  const nextCatalog = catalog.filter((item) => item.id !== entry.id);
  await writeUserCatalog(nextCatalog);

  return NextResponse.json({
    deleted: true,
    asset: toPublicAsset(entry),
  });
}
