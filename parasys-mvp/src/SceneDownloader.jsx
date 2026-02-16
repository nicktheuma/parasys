import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

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