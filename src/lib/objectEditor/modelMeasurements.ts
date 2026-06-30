import {
  AbstractMesh,
  Color3,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

import { modelDimensionShort } from "@/lib/objectEditor/viewportRuler";
import {
  OIL_BARREL_FIRE_LIGHT_RIG_NAME,
} from "@/lib/oilBarrel/oilBarrelFireLight";
import { resolveOilBarrelOverlayDimensions } from "@/lib/oilBarrel/oilBarrelDimensions";
import { computeInteriorFlameLayout } from "@/lib/oilBarrel/oilBarrelFlameLayout";
import {
  OIL_INTERIOR_VIDEO_MESH_NAME,
} from "@/lib/oilBarrel/oilBarrelInteriorVideo";
import {
  getDefaultOilBarrelEditorFireTuning,
  normalizeOilBarrelEditorFireTuning,
} from "@/lib/oilBarrel/oilBarrelEditorSettings";
import type { OilBarrelFireTuning } from "@/lib/oilBarrel/oilBarrelTuning";

export type SupplementalMeasurementGuide = {
  id: string;
  label: string;
  color: Color3;
  start: Vector3;
  end: Vector3;
};

export type ResolvedModelMeasurements = {
  primaryMin: Vector3;
  primaryMax: Vector3;
  supplemental: SupplementalMeasurementGuide[];
};

const FIRE_GUIDE_COLOR = new Color3(1, 0.58, 0.24);

function findNodeByName(root: TransformNode, name: string): TransformNode | null {
  if (root.name === name) {
    return root;
  }
  for (const child of root.getChildren(undefined, false)) {
    if (!(child instanceof TransformNode)) {
      continue;
    }
    const found = findNodeByName(child, name);
    if (found) {
      return found;
    }
  }
  return null;
}

function isMeasurementOverlayMesh(mesh: AbstractMesh): boolean {
  if (mesh.metadata?.objectEditorExcludeFromMeasurements === true) {
    return true;
  }
  return (
    mesh.name === OIL_INTERIOR_VIDEO_MESH_NAME ||
    mesh.name === OIL_BARREL_FIRE_LIGHT_RIG_NAME ||
    mesh.name === "oil_barrel_fire_light_l" ||
    mesh.name === "oil_barrel_fire_light_r" ||
    mesh.metadata?.isOilBarrelInteriorVideo === true ||
    mesh.metadata?.isOilBarrelFireLightRig === true ||
    mesh.metadata?.objectEditorExcludeFromMeasurements === true
  );
}

function boundsFromMeshes(
  root: TransformNode,
  exclude?: (mesh: AbstractMesh) => boolean,
): { min: Vector3; max: Vector3 } | null {
  root.computeWorldMatrix(true);
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  let any = false;

  for (const mesh of root.getChildMeshes(true)) {
    if (exclude?.(mesh)) {
      continue;
    }
    mesh.refreshBoundingInfo(true, true);
    const bounds = mesh.getBoundingInfo().boundingBox;
    min = Vector3.Minimize(min, bounds.minimumWorld);
    max = Vector3.Maximize(max, bounds.maximumWorld);
    any = true;
  }

  if (any) {
    return { min, max };
  }

  const hierarchy = root.getHierarchyBoundingVectors(true);
  const hierarchySize = hierarchy.max.subtract(hierarchy.min);
  if (
    Number.isFinite(hierarchySize.x) &&
    Number.isFinite(hierarchySize.y) &&
    Number.isFinite(hierarchySize.z) &&
    hierarchySize.length() > 0.00001
  ) {
    return { min: hierarchy.min, max: hierarchy.max };
  }

  return null;
}

function localYToWorldY(barrelRoot: TransformNode, localY: number): number {
  return Vector3.TransformCoordinates(
    new Vector3(0, localY, 0),
    barrelRoot.getWorldMatrix(),
  ).y;
}

function resolveOilBarrelFireHeightGuide(
  root: TransformNode,
  primaryMin: Vector3,
  primaryMax: Vector3,
): SupplementalMeasurementGuide | null {
  const barrelRoot = findNodeByName(root, "oil_barrel");
  if (!barrelRoot || barrelRoot.metadata?.interiorFire === false) {
    return null;
  }

  const tuning = normalizeOilBarrelEditorFireTuning(
    (barrelRoot.metadata?.fireTuning as OilBarrelFireTuning | undefined) ??
      getDefaultOilBarrelEditorFireTuning(),
  );
  if (!tuning.interiorFire) {
    return null;
  }

  const dimensions = resolveOilBarrelOverlayDimensions(barrelRoot, {
    innerRadius: 0.267,
    floorY: -0.3905,
    clipTopY: 0.3795,
    innerWallHeight: 0.787,
  });

  const layout = computeInteriorFlameLayout(
    dimensions.innerRadius,
    dimensions.floorY,
    dimensions.clipTopY,
    tuning,
  );
  if (layout.height <= 0.00001) {
    return null;
  }

  barrelRoot.computeWorldMatrix(true);
  const bottomY = localYToWorldY(barrelRoot, layout.layoutBottomY);
  const topY = localYToWorldY(barrelRoot, layout.layoutTopY);
  const anchorX = primaryMax.x;
  const anchorZ = primaryMin.z;

  return {
    id: "fire-height",
    label: `Fire ${modelDimensionShort(layout.height)}`,
    color: FIRE_GUIDE_COLOR,
    start: new Vector3(anchorX, bottomY, anchorZ),
    end: new Vector3(anchorX, topY, anchorZ),
  };
}

function resolveOilBarrelMeasurements(
  root: TransformNode,
): ResolvedModelMeasurements | null {
  const primaryBounds = boundsFromMeshes(root, isMeasurementOverlayMesh);
  if (!primaryBounds) {
    return null;
  }

  const supplemental = [
    resolveOilBarrelFireHeightGuide(
      root,
      primaryBounds.min,
      primaryBounds.max,
    ),
  ].filter((guide): guide is SupplementalMeasurementGuide => guide !== null);

  return {
    primaryMin: primaryBounds.min,
    primaryMax: primaryBounds.max,
    supplemental,
  };
}

function resolveDefaultMeasurements(
  root: TransformNode,
): ResolvedModelMeasurements | null {
  const bounds = boundsFromMeshes(root);
  if (!bounds) {
    return null;
  }

  return {
    primaryMin: bounds.min,
    primaryMax: bounds.max,
    supplemental: [],
  };
}

function isOilBarrelRoot(root: TransformNode): boolean {
  return (
    root.name.includes("oil-barrel") ||
    root.name.includes("oil_barrel") ||
    findNodeByName(root, "oil_barrel") !== null
  );
}

export function resolveSupplementalMeasurementGuides(
  root: TransformNode,
  primaryMin: Vector3,
  primaryMax: Vector3,
): SupplementalMeasurementGuide[] {
  if (!isOilBarrelRoot(root)) {
    return [];
  }
  const guide = resolveOilBarrelFireHeightGuide(root, primaryMin, primaryMax);
  return guide ? [guide] : [];
}

export function resolveModelMeasurements(
  root: TransformNode,
): ResolvedModelMeasurements | null {
  if (isOilBarrelRoot(root)) {
    return resolveOilBarrelMeasurements(root);
  }
  return resolveDefaultMeasurements(root);
}

export function measurementBoundsExtents(
  measurements: ResolvedModelMeasurements,
): { min: Vector3; max: Vector3 } {
  let min = measurements.primaryMin.clone();
  let max = measurements.primaryMax.clone();

  for (const guide of measurements.supplemental) {
    min = Vector3.Minimize(min, guide.start);
    min = Vector3.Minimize(min, guide.end);
    max = Vector3.Maximize(max, guide.start);
    max = Vector3.Maximize(max, guide.end);
  }

  return { min, max };
}
