import type { ObjectEditorAsset } from "@/lib/objectEditor/catalog";
import {
  DEFAULT_MODEL_LIBRARY_FOLDER,
  MODEL_LIBRARY_FOLDERS,
} from "@/lib/objectEditor/catalog";
import {
  buildModelAssetId,
  parseModelSegments,
  slugifyModelSegment,
  titleCaseSegment,
} from "@/lib/objectEditor/modelPath";

export type SaveModelToServerInput = {
  file: File;
  folder: string;
  modelName: string;
  displayName?: string;
  category?: string;
};

export type SaveModelToServerResult = {
  asset: ObjectEditorAsset;
  overwritten: boolean;
};

export type ModelLibraryResponse = {
  assets: ObjectEditorAsset[];
  folders: string[];
};

function mergeFolderLists(...lists: readonly string[][]): string[] {
  return [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));
}

export async function fetchModelLibrary(): Promise<ModelLibraryResponse> {
  try {
    const response = await fetch("/api/models", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load model library.");
    }
    const data = (await response.json()) as {
      assets?: ObjectEditorAsset[];
      folders?: string[];
    };
    return {
      assets: Array.isArray(data.assets) ? data.assets : [],
      folders: mergeFolderLists(
        [...MODEL_LIBRARY_FOLDERS],
        Array.isArray(data.folders) ? data.folders : [],
      ),
    };
  } catch {
    return {
      assets: [],
      folders: [...MODEL_LIBRARY_FOLDERS],
    };
  }
}

/** @deprecated Use fetchModelLibrary */
export async function fetchUserCatalogAssets(): Promise<ObjectEditorAsset[]> {
  const library = await fetchModelLibrary();
  return library.assets;
}

export async function saveModelToServer(
  input: SaveModelToServerInput,
): Promise<SaveModelToServerResult> {
  const segments = parseModelSegments(input.folder, input.modelName);
  if (!segments) {
    throw new Error("Folder and model name must use letters, numbers, _ or -.");
  }

  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("folder", segments.folder);
  formData.append("modelName", segments.modelName);
  formData.append(
    "displayName",
    input.displayName?.trim() ||
      titleCaseSegment(segments.modelName) ||
      segments.modelName,
  );
  formData.append(
    "category",
    input.category?.trim() || titleCaseSegment(segments.folder),
  );

  const response = await fetch("/api/models", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as {
    asset?: ObjectEditorAsset;
    overwritten?: boolean;
    error?: string;
  };

  if (!response.ok || !data.asset) {
    throw new Error(data.error ?? "Failed to save model.");
  }

  return {
    asset: data.asset,
    overwritten: Boolean(data.overwritten),
  };
}

export function normalizeSaveForm(
  folder: string,
  modelName: string,
  fileName: string,
): { folder: string; modelName: string } {
  const parsed = parseModelSegments(folder, modelName);
  if (parsed) {
    return parsed;
  }
  return {
    folder: slugifyModelSegment(folder) || DEFAULT_MODEL_LIBRARY_FOLDER,
    modelName: slugifyModelSegment(modelName) || slugifyModelSegment(fileName) || "model",
  };
}

export function previewSavedAssetPath(folder: string, modelName: string): string {
  const parsed = parseModelSegments(folder, modelName);
  if (!parsed) {
    return "/models/…";
  }
  return `/models/${parsed.folder}/${parsed.modelName}.glb`;
}

export function previewSavedAssetId(folder: string, modelName: string): string {
  const parsed = parseModelSegments(folder, modelName);
  if (!parsed) {
    return "…";
  }
  return buildModelAssetId(parsed.folder, parsed.modelName);
}
