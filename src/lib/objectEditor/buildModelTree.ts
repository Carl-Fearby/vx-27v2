import type { ObjectEditorAsset } from "@/lib/objectEditor/catalog";

export type ModelTreeAssetNode = {
  kind: "asset";
  asset: ObjectEditorAsset;
};

export type ModelTreeFolderNode = {
  kind: "folder";
  id: string;
  label: string;
  children: ModelTreeNode[];
};

export type ModelTreeNode = ModelTreeFolderNode | ModelTreeAssetNode;

const MODELS_ROOT_ID = "models";

function extractFolderSegments(path: string): string[] {
  const match = path.match(/^\/models\/(.+)\/[^/]+\.glb$/i);
  if (!match) {
    return ["other"];
  }
  return match[1].split("/").filter(Boolean);
}

function sortTreeNodes(nodes: ModelTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "folder" ? -1 : 1;
    }
    const aLabel = a.kind === "folder" ? a.label : a.asset.name;
    const bLabel = b.kind === "folder" ? b.label : b.asset.name;
    return aLabel.localeCompare(bLabel);
  });

  for (const node of nodes) {
    if (node.kind === "folder") {
      sortTreeNodes(node.children);
    }
  }
}

function findOrCreateFolder(
  parent: ModelTreeFolderNode,
  segment: string,
): ModelTreeFolderNode {
  const folderId = `${parent.id}/${segment}`;
  const existing = parent.children.find(
    (child): child is ModelTreeFolderNode =>
      child.kind === "folder" && child.id === folderId,
  );
  if (existing) {
    return existing;
  }

  const folder: ModelTreeFolderNode = {
    kind: "folder",
    id: folderId,
    label: segment,
    children: [],
  };
  parent.children.push(folder);
  return folder;
}

export function buildModelTree(
  assets: ObjectEditorAsset[],
  extraFolderPaths: readonly string[] = [],
): ModelTreeFolderNode {
  const root: ModelTreeFolderNode = {
    kind: "folder",
    id: MODELS_ROOT_ID,
    label: "models",
    children: [],
  };

  for (const folderPath of extraFolderPaths) {
    let folder = root;
    for (const segment of folderPath.split("/").filter(Boolean)) {
      folder = findOrCreateFolder(folder, segment);
    }
  }

  for (const asset of assets) {
    let folder = root;
    for (const segment of extractFolderSegments(asset.path)) {
      folder = findOrCreateFolder(folder, segment);
    }
    folder.children.push({ kind: "asset", asset });
  }

  sortTreeNodes(root.children);
  return root;
}

export function collectFolderIds(folder: ModelTreeFolderNode): string[] {
  const ids = [folder.id];
  for (const child of folder.children) {
    if (child.kind === "folder") {
      ids.push(...collectFolderIds(child));
    }
  }
  return ids;
}

export function collectFolderIdsForAsset(
  root: ModelTreeFolderNode,
  assetId: string,
): string[] {
  const path: string[] = [];

  const walk = (folder: ModelTreeFolderNode): boolean => {
    path.push(folder.id);
    for (const child of folder.children) {
      if (child.kind === "asset" && child.asset.id === assetId) {
        return true;
      }
      if (child.kind === "folder" && walk(child)) {
        return true;
      }
    }
    path.pop();
    return false;
  };

  walk(root);
  return path;
}
