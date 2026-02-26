import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { buildNestedSvg } from './parametric/svgNestingExporter';
import { buildNestedPdfBytes } from './parametric/pdfNestingExporter';
import { buildNestedDxf } from './parametric/dxfNestingExporter';
import { getSheetPresetForMaterial } from './parametric/materialSheetProfiles';
import { useSceneStore } from './useSceneStore';

// Helper function to trigger the browser download for binary files
const saveArrayBuffer = (buffer, filename) => {
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

// Helper function for text-based JSON files
const saveString = (text, filename) => {
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const mmToPt = (millimeters) => (millimeters * 72) / 25.4;
const PDF_VIEW_PAGES_MM = {
  A4: { width: 297, height: 210 },
  A3: { width: 420, height: 297 },
  SHEET: { width: 297, height: 210 },
};

const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = dataUrl;
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getPanelMeshes = (furniture) => {
  const meshes = [];
  furniture.traverse((child) => {
    if (!child?.isMesh) return;
    if (!child.userData?.panelId) return;
    meshes.push(child);
  });
  return meshes;
};

const buildPerspectiveCameraForView = ({ view, bounds, center, aspect }) => {
  const size = bounds.getSize(new THREE.Vector3());
  const camera = new THREE.PerspectiveCamera(24, aspect, 0.01, 200);
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  const computeDistance = (viewWidth, viewHeight) => {
    const distanceByWidth = (viewWidth / 2) / (tanHalfFov * aspect);
    const distanceByHeight = (viewHeight / 2) / tanHalfFov;
    return Math.max(distanceByWidth, distanceByHeight) * 1.25;
  };

  if (view === 'plan') {
    const distance = computeDistance(size.x, size.z);
    camera.position.set(center.x, center.y + distance, center.z);
    camera.up.set(0, 0, -1);
    camera.far = distance * 12;
  } else if (view === 'front') {
    const distance = computeDistance(size.x, size.y);
    camera.position.set(center.x, center.y, center.z + distance);
    camera.up.set(0, 1, 0);
    camera.far = distance * 12;
  } else if (view === 'side') {
    const distance = computeDistance(size.z, size.y);
    camera.position.set(center.x + distance, center.y, center.z);
    camera.up.set(0, 1, 0);
    camera.far = distance * 12;
  } else {
    const horizontal = Math.max(size.x, size.z) * 1.35;
    const vertical = size.y + (horizontal * 0.45);
    const distance = computeDistance(horizontal, vertical);
    const direction = new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(distance);
    camera.position.copy(center.clone().add(direction));
    camera.up.set(0, 1, 0);
    camera.far = distance * 14;
  }

  camera.lookAt(center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
};

const captureStyledPerspectiveDataUrl = async ({ renderer, scene, camera, greyscale = false }) => {
  if (!greyscale) {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  renderer.render(scene, camera);
  const colorUrl = renderer.domElement.toDataURL('image/png');
  const colorImage = await loadImageFromDataUrl(colorUrl);
  const canvas = document.createElement('canvas');
  canvas.width = colorImage.width;
  canvas.height = colorImage.height;
  const context = canvas.getContext('2d');
  context.drawImage(colorImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round((data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114));
    data[index] = gray;
    data[index + 1] = gray;
    data[index + 2] = gray;
  }
  context.putImageData(imageData, 0, 0);

  return canvas.toDataURL('image/png');
};

const orientDimensionBillboardsToCamera = ({ dimensionsGroup, camera }) => {
  if (!dimensionsGroup || !camera) return;
  camera.updateMatrixWorld(true);
  dimensionsGroup.traverse((child) => {
    if (child.name !== 'DimensionBillboard') return;
    child.quaternion.copy(camera.quaternion);
    child.updateMatrixWorld(true);
  });
};

const drawPanelLabelsOverlay = async ({
  dataUrl,
  width,
  height,
  panelMeshes,
  camera,
  headerTitle,
  headerMeta,
}) => {
  const image = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  context.drawImage(image, 0, 0, width, height);
  context.fillStyle = 'rgba(255,255,255,0.94)';
  context.fillRect(0, 0, width, 88);
  context.fillStyle = '#111827';
  context.font = '700 30px system-ui, sans-serif';
  context.fillText(headerTitle, 20, 38);
  context.font = '500 22px system-ui, sans-serif';
  context.fillStyle = '#334155';
  context.fillText(headerMeta, 20, 70);

  const raycaster = new THREE.Raycaster();
  raycaster.firstHitOnly = true;
  const cameraWorldPosition = new THREE.Vector3();
  camera.getWorldPosition(cameraWorldPosition);

  const isCandidateVisible = (mesh, candidateWorldPoint) => {
    const direction = candidateWorldPoint.clone().sub(cameraWorldPosition);
    const targetDistance = direction.length();
    if (targetDistance <= 0.0001) return false;
    direction.normalize();

    raycaster.set(cameraWorldPosition, direction);
    raycaster.near = 0.001;
    raycaster.far = targetDistance + 0.02;
    const intersections = raycaster.intersectObjects(panelMeshes, true);
    if (intersections.length === 0) return false;

    const firstHit = intersections[0];
    let owner = firstHit.object;
    while (owner && !owner.userData?.panelId && owner.parent) owner = owner.parent;

    const samePanel = owner?.userData?.panelId === mesh.userData?.panelId;
    const distanceClose = Math.abs(firstHit.distance - targetDistance) < 0.03;
    return samePanel && distanceClose;
  };

  const makeLabelBox = ({ text, x, y, fontSize }) => {
    context.font = `700 ${fontSize}px system-ui, sans-serif`;
    const textWidth = context.measureText(text).width;
    const paddingX = Math.max(10, Math.round(fontSize * 0.42));
    const heightPx = Math.max(28, Math.round(fontSize * 1.5));
    return { x, y, width: textWidth + (paddingX * 2), height: heightPx, text, fontSize, paddingX };
  };

  const intersects = (a, b) => !(
    b.x >= (a.x + a.width) ||
    (b.x + b.width) <= a.x ||
    b.y >= (a.y + a.height) ||
    (b.y + b.height) <= a.y
  );

  const projected = [];
  const usedAnchorPoints = [];
  const droppedIds = [];
  const minAnchorSeparationPx = 44;
  const safeArea = {
    minX: 2,
    maxX: width - 2,
    minY: 96,
    maxY: height - 4,
  };

  const toScreenPoint = (point3) => {
    const projectedPoint = point3.clone().project(camera);
    if (projectedPoint.z < -1 || projectedPoint.z > 1) return null;
    return {
      x: (projectedPoint.x * 0.5 + 0.5) * width,
      y: (-projectedPoint.y * 0.5 + 0.5) * height,
    };
  };

  panelMeshes.forEach((mesh) => {
    const panelId = String(mesh.userData.panelId || 'panel');
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (bounds.isEmpty()) {
      droppedIds.push(panelId);
      return;
    }

    const min = bounds.min;
    const max = bounds.max;
    const center = bounds.getCenter(new THREE.Vector3());

    const candidateWorldPoints = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
      new THREE.Vector3(center.x, min.y, center.z),
      new THREE.Vector3(center.x, max.y, center.z),
      new THREE.Vector3(min.x, center.y, center.z),
      new THREE.Vector3(max.x, center.y, center.z),
      new THREE.Vector3(center.x, center.y, min.z),
      new THREE.Vector3(center.x, center.y, max.z),
      new THREE.Vector3((min.x + center.x) / 2, center.y, min.z),
      new THREE.Vector3((max.x + center.x) / 2, center.y, max.z),
      new THREE.Vector3(center.x, (min.y + center.y) / 2, center.z),
      new THREE.Vector3(center.x, (max.y + center.y) / 2, center.z),
    ];

    const centerScreen = toScreenPoint(center);
    const visibleWorldCandidates = candidateWorldPoints.filter((candidate) => isCandidateVisible(mesh, candidate));
    const worldCandidates = visibleWorldCandidates.length > 0 ? visibleWorldCandidates : candidateWorldPoints;

    const screenCandidates = worldCandidates
      .map((candidate) => toScreenPoint(candidate))
      .filter(Boolean);

    if (screenCandidates.length === 0) {
      droppedIds.push(panelId);
      return;
    }

    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    const bestAnchor = screenCandidates.reduce((best, candidate) => {
      const minDistToUsed = usedAnchorPoints.length > 0
        ? Math.min(...usedAnchorPoints.map((used) => distance(candidate, used)))
        : 9999;

      const distFromCenter = centerScreen ? distance(candidate, centerScreen) : 0;
      const spacingPenalty = minDistToUsed < minAnchorSeparationPx
        ? (minAnchorSeparationPx - minDistToUsed) * 2
        : 0;
      const score = (minDistToUsed * 1.2) + (distFromCenter * 0.5) - spacingPenalty;

      if (!best || score > best.score) {
        return { candidate, score };
      }
      return best;
    }, null);

    if (!bestAnchor) {
      droppedIds.push(panelId);
      return;
    }
    usedAnchorPoints.push(bestAnchor.candidate);

    const anchorX = bestAnchor.candidate.x;
    const anchorY = bestAnchor.candidate.y;
    const anchorIsInside = (
      anchorX >= safeArea.minX &&
      anchorX <= safeArea.maxX &&
      anchorY >= safeArea.minY &&
      anchorY <= safeArea.maxY
    );

    if (!anchorIsInside) {
      droppedIds.push(panelId);
      return;
    }

    projected.push({
      id: panelId,
      x: anchorX,
      y: anchorY,
    });
  });

  if (projected.length === 0) {
    return {
      dataUrl: canvas.toDataURL('image/png'),
      droppedLabels: [...new Set(droppedIds)],
    };
  }

  const placeSide = ({ items, side, fontSize }) => {
    const marginX = 16;
    const topY = safeArea.minY;
    const bottomY = safeArea.maxY;
    const gapY = 8;
    const sorted = [...items].sort((left, right) => left.y - right.y);

    const placed = sorted.map((item) => {
      const template = makeLabelBox({ text: item.id, x: 0, y: 0, fontSize });
      const x = side === 'left'
        ? marginX
        : width - marginX - template.width;

      return {
        item,
        box: {
          ...template,
          x,
          y: clamp(item.y - (template.height / 2), topY, bottomY - template.height),
        },
      };
    });

    for (let index = 1; index < placed.length; index += 1) {
      const previous = placed[index - 1].box;
      const current = placed[index].box;
      if (current.y < previous.y + previous.height + gapY) {
        current.y = previous.y + previous.height + gapY;
      }
    }

    const overflow = placed.length > 0
      ? (placed[placed.length - 1].box.y + placed[placed.length - 1].box.height) - bottomY
      : 0;

    if (overflow > 0) {
      placed.forEach((entry) => {
        entry.box.y = Math.max(topY, entry.box.y - overflow);
      });
    }

    return placed.map(({ item, box }) => {
      const leaderStartX = side === 'left' ? box.x + box.width : box.x;
      const leaderStartY = clamp(item.y, box.y + 4, box.y + box.height - 4);
      return { item, box, leaderStartX, leaderStartY };
    });
  };

  const canFitSide = ({ items, fontSize }) => {
    if (items.length === 0) return true;
    const probeBox = makeLabelBox({ text: 'WIDE_LABEL_PROBE', x: 0, y: 0, fontSize });
    const required = (items.length * probeBox.height) + ((items.length - 1) * 8);
    return required <= (height - 96 - 8);
  };

  const sideBuckets = projected.reduce((accumulator, item) => {
    const distanceLeft = item.x;
    const distanceRight = width - item.x;
    const side = distanceLeft <= distanceRight ? 'left' : 'right';
    accumulator[side].push(item);
    return accumulator;
  }, { left: [], right: [] });

  let activeFontSize = 24;
  while (activeFontSize > 14) {
    const fitLeft = canFitSide({ items: sideBuckets.left, fontSize: activeFontSize });
    const fitRight = canFitSide({ items: sideBuckets.right, fontSize: activeFontSize });
    if (fitLeft && fitRight) break;
    activeFontSize -= 1;
  }

  const callouts = [
    ...placeSide({ items: sideBuckets.left, side: 'left', fontSize: activeFontSize }),
    ...placeSide({ items: sideBuckets.right, side: 'right', fontSize: activeFontSize }),
  ].filter(({ item, box, leaderStartX, leaderStartY }) => {
    const boxInside = (
      box.x >= safeArea.minX &&
      (box.x + box.width) <= safeArea.maxX &&
      box.y >= safeArea.minY &&
      (box.y + box.height) <= safeArea.maxY
    );

    const leaderStartInside = (
      leaderStartX >= safeArea.minX &&
      leaderStartX <= safeArea.maxX &&
      leaderStartY >= safeArea.minY &&
      leaderStartY <= safeArea.maxY
    );

    const leaderEndInside = (
      item.x >= safeArea.minX &&
      item.x <= safeArea.maxX &&
      item.y >= safeArea.minY &&
      item.y <= safeArea.maxY
    );

    return boxInside && leaderStartInside && leaderEndInside;
  });

  const drawnIds = new Set(callouts.map((callout) => callout.item.id));
  projected.forEach((item) => {
    if (!drawnIds.has(item.id)) droppedIds.push(item.id);
  });

  callouts.forEach(({ item, box, leaderStartX, leaderStartY }) => {
    context.strokeStyle = '#475569';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(leaderStartX, leaderStartY);
    context.lineTo(item.x, item.y);
    context.stroke();

    context.fillStyle = '#111827';
    context.beginPath();
    context.arc(item.x, item.y, 4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = 'rgba(255,255,255,0.95)';
    context.fillRect(box.x, box.y, box.width, box.height);
    context.strokeStyle = '#334155';
    context.lineWidth = 1.3;
    context.strokeRect(box.x, box.y, box.width, box.height);
    context.fillStyle = '#0f172a';
    context.font = `700 ${box.fontSize}px system-ui, sans-serif`;
    context.fillText(item.id, box.x + box.paddingX, box.y + Math.round(box.height * 0.66));
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    droppedLabels: [...new Set(droppedIds)],
  };
};

const capturePerspectiveViewSnapshots = async ({ scene, materialKey, renderer }) => {
  const furniture = scene.getObjectByName('FurnitureGroup');
  if (!furniture) return [];

  const bounds = new THREE.Box3().setFromObject(furniture);
  if (bounds.isEmpty()) return [];

  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const panelMeshes = getPanelMeshes(furniture);
  const dimensionsGroup = scene.getObjectByName('DimensionsGroup');
  const propsGroup = scene.getObjectByName('PropsGroup');
  const devToolGroup = scene.getObjectByName('DevToolGroup');
  const wasDimsVisible = dimensionsGroup ? dimensionsGroup.visible : true;
  const wasPropsVisible = propsGroup ? propsGroup.visible : true;
  const wasDevVisible = devToolGroup ? devToolGroup.visible : true;

  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalPixelRatio = renderer.getPixelRatio();
  const exportWidth = 2200;
  const exportHeight = 1600;

  try {
    if (dimensionsGroup) dimensionsGroup.visible = true;
    if (propsGroup) propsGroup.visible = false;
    if (devToolGroup) devToolGroup.visible = false;
    renderer.setPixelRatio(1);
    renderer.setSize(exportWidth, exportHeight, false);

    const viewDefs = [
      { key: 'iso', label: 'Isometric Perspective' },
      { key: 'front', label: 'Front Elevation' },
      { key: 'side', label: 'Side Elevation' },
      { key: 'plan', label: 'Plan View' },
    ];

    const snapshots = [];
    const aspect = exportWidth / exportHeight;
    const dimText = `W ${size.x.toFixed(3)}m | H ${size.y.toFixed(3)}m | D ${size.z.toFixed(3)}m`;

    for (const viewDef of viewDefs) {
      const camera = buildPerspectiveCameraForView({
        view: viewDef.key,
        bounds,
        center,
        aspect,
      });
      orientDimensionBillboardsToCamera({ dimensionsGroup, camera });

      const greyscale = viewDef.key !== 'iso';
      const baseDataUrl = await captureStyledPerspectiveDataUrl({
        renderer,
        scene,
        camera,
        greyscale,
      });
      const { dataUrl: labeledDataUrl, droppedLabels } = await drawPanelLabelsOverlay({
        dataUrl: baseDataUrl,
        width: exportWidth,
        height: exportHeight,
        panelMeshes,
        camera,
        headerTitle: `${viewDef.label} (${greyscale ? 'Greyscale' : 'Perspective'})` ,
        headerMeta: `${dimText} | material: ${materialKey}`,
      });

      snapshots.push({
        title: viewDef.label,
        dataUrl: labeledDataUrl,
        width: exportWidth,
        height: exportHeight,
        droppedLabels,
      });
    }

    return snapshots;
  } finally {
    renderer.setPixelRatio(originalPixelRatio);
    renderer.setSize(originalSize.x, originalSize.y, false);
    if (dimensionsGroup) dimensionsGroup.visible = wasDimsVisible;
    if (propsGroup) propsGroup.visible = wasPropsVisible;
    if (devToolGroup) devToolGroup.visible = wasDevVisible;
  }
};

const appendViewSnapshotsToPdf = async ({ pdfBytes, snapshots, pdfPageFormat }) => {
  if (!snapshots || snapshots.length === 0) return pdfBytes;

  const nestedPdfDocument = await PDFDocument.load(pdfBytes);
  const outputPdfDocument = await PDFDocument.create();
  const font = await outputPdfDocument.embedFont(StandardFonts.Helvetica);
  const pageSize = PDF_VIEW_PAGES_MM[pdfPageFormat] || PDF_VIEW_PAGES_MM.A4;

  for (const snapshot of snapshots) {
    const page = outputPdfDocument.addPage([mmToPt(pageSize.width), mmToPt(pageSize.height)]);
    const pngImage = await outputPdfDocument.embedPng(snapshot.dataUrl);

    const marginMm = 10;
    const headerMm = 12;
    const droppedLabels = Array.isArray(snapshot.droppedLabels) ? snapshot.droppedLabels : [];
    const footerMm = droppedLabels.length > 0 ? 14 : 0;
    const contentWidthMm = pageSize.width - (marginMm * 2);
    const contentHeightMm = pageSize.height - (marginMm * 2) - headerMm - footerMm;
    const imageAspect = snapshot.width / snapshot.height;

    let drawWidthMm = contentWidthMm;
    let drawHeightMm = drawWidthMm / imageAspect;
    if (drawHeightMm > contentHeightMm) {
      drawHeightMm = contentHeightMm;
      drawWidthMm = drawHeightMm * imageAspect;
    }

    const drawX = marginMm + ((contentWidthMm - drawWidthMm) / 2);
    const drawYTopDown = marginMm + headerMm + ((contentHeightMm - drawHeightMm) / 2);

    page.drawText(`${snapshot.title} (Perspective View)`, {
      x: mmToPt(marginMm),
      y: mmToPt(pageSize.height - (marginMm + 8)),
      size: 11,
      font,
      color: rgb(0.1, 0.14, 0.22),
    });

    page.drawImage(pngImage, {
      x: mmToPt(drawX),
      y: mmToPt(pageSize.height - (drawYTopDown + drawHeightMm)),
      width: mmToPt(drawWidthMm),
      height: mmToPt(drawHeightMm),
    });

    if (droppedLabels.length > 0) {
      const prefix = 'Dropped callouts (out of page bounds): ';
      const rawText = `${prefix}${droppedLabels.join(', ')}`;
      const availableWidthPt = mmToPt(contentWidthMm);
      const fontSize = 8;

      const words = rawText.split(' ');
      const lines = [];
      let currentLine = '';

      words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const candidateWidth = font.widthOfTextAtSize(candidate, fontSize);
        if (candidateWidth <= availableWidthPt) {
          currentLine = candidate;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      const maxLines = 2;
      const finalLines = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        finalLines[maxLines - 1] = `${finalLines[maxLines - 1]} ...`;
      }

      finalLines.forEach((line, index) => {
        const yTopDown = pageSize.height - marginMm - footerMm + 4 + (index * 3.8);
        page.drawText(line, {
          x: mmToPt(marginMm),
          y: mmToPt(pageSize.height - yTopDown),
          size: fontSize,
          font,
          color: rgb(0.48, 0.13, 0.13),
        });
      });
    }
  }

  const nestedPages = await outputPdfDocument.copyPages(
    nestedPdfDocument,
    nestedPdfDocument.getPageIndices(),
  );
  nestedPages.forEach((nestedPage) => outputPdfDocument.addPage(nestedPage));

  return outputPdfDocument.save();
};

export const downloadScene = (scene) => {
  if (!scene) return;

  const exporter = new GLTFExporter();

  // Find the furniture group specifically to avoid exporting environment maps/backgrounds
  const furniture = scene.getObjectByName('FurnitureGroup');
  const exportTarget = furniture;

  // Store original visibility states and hide dev/dim objects
  const hiddenObjects = [];
  exportTarget.traverse((child) => {
    // Hide Bounding box and Dimensions group
    if (child.name === 'Bounding' || (child.parent && child.parent.name === 'Dimensions')) {
      hiddenObjects.push({ object: child, originalVisible: child.visible });
      child.visible = false;
    }
  });

  // Options: binary (glb) creates a smaller, single file
  const options = {
    binary: true,
    trs: false,
    onlyVisible: true,
    truncateDrawRange: true,
  };

  exporter.parse(
    exportTarget,
    (result) => {
      // Restore visibility states after successful export
      hiddenObjects.forEach(({ object, originalVisible }) => {
        object.visible = originalVisible;
      });

      if (result instanceof ArrayBuffer) {
        saveArrayBuffer(result, 'scene_export.glb');
      } else {
        const output = JSON.stringify(result, null, 2);
        saveString(output, 'scene_export.gltf');
      }
    },
    (error) => {
      // Restore visibility states even if an error occurs
      hiddenObjects.forEach(({ object, originalVisible }) => {
        object.visible = originalVisible;
      });
      console.error('An error happened during export:', error);
    },
    options
  );
};

const extractPanelSpecsFromScene = (scene) => {
  if (!scene) return [];
  const furniture = scene.getObjectByName('FurnitureGroup');
  if (!furniture) return [];

  const panelSpecs = [];
  furniture.traverse((child) => {
    if (!child?.isMesh) return;
    const userData = child.userData || {};
    if (!userData.panelId || !userData.vectorLoops?.outerLoop) return;

    panelSpecs.push({
      id: userData.panelId,
      kind: userData.panelKind || 'panel',
      width: userData.panelWidth,
      height: userData.panelHeight,
      thickness: userData.panelThickness,
      vectorLoops: userData.vectorLoops,
    });
  });

  return panelSpecs;
};

const resolveMaterialNestingOptions = (materialKey, options = {}) => {
  const preset = getSheetPresetForMaterial(materialKey);
  const requestedSheetWidth = options.sheetWidthMm ?? preset.sheetWidthMm;
  const requestedSheetHeight = options.sheetHeightMm ?? preset.sheetHeightMm;

  return {
    ...options,
    sheetWidthMm: Math.min(requestedSheetWidth, preset.sheetWidthMm),
    sheetHeightMm: Math.min(requestedSheetHeight, preset.sheetHeightMm),
    marginMm: options.marginMm ?? preset.marginMm,
    spacingMm: options.spacingMm ?? preset.spacingMm,
  };
};

export const downloadNestedSvg = (scene, materialKey = 'Painted', options = {}) => {
  const panelSpecs = extractPanelSpecsFromScene(scene);
  if (panelSpecs.length === 0) {
    console.warn('No panel specs found for nested SVG export.');
    return;
  }

  try {
    const nestingOptions = resolveMaterialNestingOptions(materialKey, options);
    const { svg } = buildNestedSvg(panelSpecs, nestingOptions);
    saveString(svg, 'nested_panels.svg');
  } catch (error) {
    console.error('Failed to export nested SVG:', error);
    if (typeof window !== 'undefined') {
      window.alert(error?.message || 'Unable to export nested SVG for current material sheet size.');
    }
  }
};

export const downloadNestedPdf = async (scene, materialKey = 'Painted', options = {}) => {
  const panelSpecs = extractPanelSpecsFromScene(scene);
  if (panelSpecs.length === 0) {
    console.warn('No panel specs found for nested PDF export.');
    return;
  }

  try {
    const renderer = useSceneStore.getState().renderer;
    const nestingOptions = {
      ...resolveMaterialNestingOptions(materialKey, options),
      pdfPageFormat: options.pdfPageFormat || 'A4',
    };
    const { pdfBytes } = await buildNestedPdfBytes(panelSpecs, nestingOptions);

    const snapshots = renderer
      ? await capturePerspectiveViewSnapshots({ scene, materialKey, renderer })
      : [];

    const finalPdfBytes = await appendViewSnapshotsToPdf({
      pdfBytes,
      snapshots,
      pdfPageFormat: nestingOptions.pdfPageFormat,
    });

    saveArrayBuffer(finalPdfBytes, 'nested_panels.pdf');
  } catch (error) {
    console.error('Failed to export nested PDF:', error);
    if (typeof window !== 'undefined') {
      window.alert(error?.message || 'Unable to export nested PDF for current material sheet size.');
    }
  }
};

export const downloadNestedDxf = (scene, materialKey = 'Painted', options = {}) => {
  const panelSpecs = extractPanelSpecsFromScene(scene);
  if (panelSpecs.length === 0) {
    console.warn('No panel specs found for nested DXF export.');
    return;
  }

  try {
    const nestingOptions = resolveMaterialNestingOptions(materialKey, options);
    const { dxf } = buildNestedDxf(panelSpecs, nestingOptions);
    saveString(dxf, 'nested_panels.dxf');
  } catch (error) {
    console.error('Failed to export nested DXF:', error);
    if (typeof window !== 'undefined') {
      window.alert(error?.message || 'Unable to export nested DXF for current material sheet size.');
    }
  }
};
