"use client";

import type {
  ModelTreeFolderNode,
  ModelTreeNode,
} from "@/lib/objectEditor/buildModelTree";

type ObjectEditorTreeProps = {
  root: ModelTreeFolderNode;
  selectedAssetId: string | null;
  localPreviewName: string | null;
  expandedFolderIds: ReadonlySet<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectAsset: (assetId: string) => void;
};

function TreeFolder({
  folder,
  depth,
  selectedAssetId,
  expandedFolderIds,
  onToggleFolder,
  onSelectAsset,
}: {
  folder: ModelTreeFolderNode;
  depth: number;
  selectedAssetId: string | null;
  expandedFolderIds: ReadonlySet<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectAsset: (assetId: string) => void;
}) {
  const expanded = expandedFolderIds.has(folder.id);

  return (
    <li className="object-editor-tree-branch">
      <button
        type="button"
        className="object-editor-tree-folder"
        style={{ paddingLeft: `${0.45 + depth * 0.75}rem` }}
        aria-expanded={expanded}
        onClick={() => onToggleFolder(folder.id)}
      >
        <span
          className={[
            "object-editor-tree-chevron",
            expanded ? "object-editor-tree-chevron--open" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden
        />
        <span className="object-editor-tree-folder-label">{folder.label}</span>
      </button>
      {expanded ? (
        <ul className="object-editor-tree-children">
          {folder.children.map((child) => (
            <TreeNode
              key={child.kind === "folder" ? child.id : child.asset.id}
              node={child}
              depth={depth + 1}
              selectedAssetId={selectedAssetId}
              expandedFolderIds={expandedFolderIds}
              onToggleFolder={onToggleFolder}
              onSelectAsset={onSelectAsset}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function TreeNode({
  node,
  depth,
  selectedAssetId,
  expandedFolderIds,
  onToggleFolder,
  onSelectAsset,
}: {
  node: ModelTreeNode;
  depth: number;
  selectedAssetId: string | null;
  expandedFolderIds: ReadonlySet<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectAsset: (assetId: string) => void;
}) {
  if (node.kind === "folder") {
    return (
      <TreeFolder
        folder={node}
        depth={depth}
        selectedAssetId={selectedAssetId}
        expandedFolderIds={expandedFolderIds}
        onToggleFolder={onToggleFolder}
        onSelectAsset={onSelectAsset}
      />
    );
  }

  const active = selectedAssetId === node.asset.id;

  return (
    <li className="object-editor-tree-branch">
      <button
        type="button"
        className={[
          "object-editor-tree-item",
          active ? "object-editor-tree-item--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ paddingLeft: `${0.85 + depth * 0.75}rem` }}
        onClick={() => onSelectAsset(node.asset.id)}
      >
        <span className="object-editor-tree-item-label">{node.asset.name}</span>
        <small>{node.asset.type.toUpperCase()}</small>
      </button>
    </li>
  );
}

export default function ObjectEditorTree({
  root,
  selectedAssetId,
  localPreviewName,
  expandedFolderIds,
  onToggleFolder,
  onSelectAsset,
}: ObjectEditorTreeProps) {
  const localExpanded = expandedFolderIds.has("local");

  return (
    <nav className="object-editor-tree" aria-label="Model library">
      <ul className="object-editor-tree-root">
        {localPreviewName ? (
          <li className="object-editor-tree-branch">
            <button
              type="button"
              className="object-editor-tree-folder"
              style={{ paddingLeft: "0.45rem" }}
              aria-expanded={localExpanded}
              onClick={() => onToggleFolder("local")}
            >
              <span
                className={[
                  "object-editor-tree-chevron",
                  localExpanded ? "object-editor-tree-chevron--open" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden
              />
              <span className="object-editor-tree-folder-label">Local</span>
            </button>
            {localExpanded ? (
              <ul className="object-editor-tree-children">
                <li className="object-editor-tree-branch">
                  <button
                    type="button"
                    className="object-editor-tree-item object-editor-tree-item--active object-editor-tree-item--local"
                    style={{ paddingLeft: "1.6rem" }}
                    disabled
                  >
                    <span className="object-editor-tree-item-label">
                      {localPreviewName}
                    </span>
                    <small>GLB</small>
                  </button>
                </li>
              </ul>
            ) : null}
          </li>
        ) : null}

        <TreeFolder
          folder={root}
          depth={0}
          selectedAssetId={selectedAssetId}
          expandedFolderIds={expandedFolderIds}
          onToggleFolder={onToggleFolder}
          onSelectAsset={onSelectAsset}
        />
      </ul>
    </nav>
  );
}
