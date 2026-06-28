# Object Editor Face Resize Archive

Archived on 2026-06-28 after removing the live face-resize/face-UV editing path from `/object-editor`.

## Why It Was Removed

The first pass tried to resize selected GLB surfaces with small triangle handles attached to a selected face. It also tried to remap only the selected face UVs for edge-case texture fixes such as the ammo crate lower strip.

In practice this was not reliable enough for the current object viewer:

- Handles could be placed near the selected face but drag interaction was inconsistent.
- Face resizing could move or distort the selected surface instead of resizing from the intended edge.
- Selected-face UV controls were too dependent on imported GLB primitive structure and shared atlas/material transforms.
- Imported GLBs can have split primitives, duplicated vertices, shared materials, texture transforms, and atlas seams that make per-face edits ambiguous.

## What Should Replace It Later

For the GLB creation tool, do not retrofit this on top of arbitrary imported GLBs. Build it into the authoring data model:

- Treat imported GLB click selection as material-region inspection only.
- Do not call a clicked triangle/primitive an editable surface.
- Represent editable surfaces as first-class quads/polygons with stable IDs.
- Represent curved assets with logical regions such as barrel body, top rim, bottom rim, cap, label band, bolts, and emissive strips.
- Store per-surface width, height, local axes, pivot/anchor, material slot, UV rect, and texture transform explicitly.
- Render handles from that source data, not from inferred triangle/primitive geometry.
- Apply edits to the authoring model first, then rebuild/export GLB.
- Keep imported GLB inspection read-only unless a conversion step turns it into editable object data.

## Interaction Requirements

- Surface selection should remain a faint overlay only.
- Resize handles should be optional and should appear only in an edit mode.
- Handles should be attached to the real surface edges and resize from the opposite edge as an anchor.
- Texture repair should expose a UV rectangle editor for the selected authored surface, not mutate arbitrary shared imported material UVs.
- Undo/redo must capture the authoring model state, not just Babylon mesh buffers.

## Current Live State

The live object editor now keeps:

- Model loading.
- Object tree.
- Transform gizmo.
- Imported material-region selection.
- Material-region UV and material controls.
- Broad indicative outline for selected imported material regions.

The live object editor no longer includes:

- Face resize triangle handles.
- Direct selected-face UV mutation controls.
- Updatable-buffer/geometry mutation setup for imported GLBs.
- Clicked triangle/face editing for imported GLBs.
