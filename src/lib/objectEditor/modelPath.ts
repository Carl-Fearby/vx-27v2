import { DEFAULT_MODEL_LIBRARY_FOLDER } from "@/lib/objectEditor/catalog";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function slugifyModelSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.glb$/i, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function isValidModelSegment(value: string): boolean {
  return value.length > 0 && value.length <= 64 && SLUG_PATTERN.test(value);
}

export function parseModelSegments(folder: string, modelName: string): {
  folder: string;
  modelName: string;
} | null {
  const nextFolder = slugifyModelSegment(folder);
  const nextModelName = slugifyModelSegment(modelName);
  if (!isValidModelSegment(nextFolder) || !isValidModelSegment(nextModelName)) {
    return null;
  }
  return { folder: nextFolder, modelName: nextModelName };
}

export function buildModelPublicPath(folder: string, modelName: string): string {
  return `/models/${folder}/${modelName}.glb`;
}

export function parseModelPublicPath(
  publicPath: string,
): { folder: string; modelName: string } | null {
  const match = /^\/models\/([^/]+)\/([^/]+)\.glb$/i.exec(publicPath);
  if (!match) {
    return null;
  }
  return parseModelSegments(match[1], match[2]);
}

export function buildModelAssetId(folder: string, modelName: string): string {
  return `${folder}-${modelName}`;
}

export function defaultModelNameFromFileName(fileName: string): string {
  return slugifyModelSegment(fileName) || "model";
}

export function defaultFolderFromFileName(fileName: string): string {
  const base = defaultModelNameFromFileName(fileName);
  if (base.includes("weapon") || base.includes("rifle") || base.includes("pistol")) {
    return "weapons";
  }
  if (base.includes("enemy") || base.includes("droid") || base.includes("character")) {
    return "enemies";
  }
  return DEFAULT_MODEL_LIBRARY_FOLDER;
}

export function titleCaseSegment(value: string): string {
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
