/**
 * Convert wraith_idle.fbx (full Mixamo mesh + skin) to wraith_idle.glb.
 * Preserves renderable geometry; uses a solid material (embedded FBX textures
 * cannot be decoded in Node without an image pipeline).
 *
 * Usage: node scripts/convert-wraith-idle-to-glb.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { URL, devicePixelRatio: 1 };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElementNS(_ns, tag) {
      if (tag === 'canvas') {
        return {
          width: 1,
          height: 1,
          getContext() {
            return {
              fillRect() {},
              drawImage() {},
              getImageData() {
                return { data: new Uint8ClampedArray(4) };
              },
              putImageData() {},
            };
          },
        };
      }
      return {};
    },
  };
}
if (typeof globalThis.HTMLCanvasElement === 'undefined') {
  globalThis.HTMLCanvasElement = function HTMLCanvasElement() {};
}
globalThis.Image = class Image {
  set src(_v) {}
  addEventListener() {}
};
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

const root = path.resolve(import.meta.dirname, '..');
const modelsDir = path.join(root, 'public', 'models');
const inputPath = path.join(modelsDir, 'wraith_idle.fbx');
const outputPath = path.join(modelsDir, 'wraith_idle.glb');

const THREE = await import('three');
const { FBXLoader } = await import(
  pathToFileURL(path.join(root, 'node_modules/three-stdlib/loaders/FBXLoader.js')).href
);
const { GLTFExporter } = await import(
  pathToFileURL(path.join(root, 'node_modules/three-stdlib/exporters/GLTFExporter.js')).href
);

THREE.TextureLoader.prototype.load = function loadTextureStub(_url, onLoad) {
  const texture = new THREE.Texture();
  texture.needsUpdate = true;
  if (onLoad) queueMicrotask(() => onLoad(texture));
  return texture;
};

console.log(`Loading FBX: ${inputPath}`);
const buffer = readFileSync(inputPath);
const loader = new FBXLoader();
const group = loader.parse(buffer.buffer, path.dirname(inputPath));

const wraithMat = new THREE.MeshStandardMaterial({
  color: 0x8b4513,
  emissive: 0x331a00,
  emissiveIntensity: 0.35,
  metalness: 0.15,
  roughness: 0.75,
});

group.traverse((child) => {
  if (!child.isMesh) return;
  child.material = wraithMat;
  child.castShadow = true;
  child.receiveShadow = false;
});

const exporter = new GLTFExporter();
const glbBuffer = await new Promise((resolve, reject) => {
  exporter.parse(
    group,
    (result) => {
      if (result instanceof ArrayBuffer) {
        resolve(Buffer.from(result));
      } else {
        reject(new Error('Expected binary GLB output'));
      }
    },
    (error) => reject(error),
    { binary: true, animations: group.animations, onlyVisible: true },
  );
});

writeFileSync(outputPath, glbBuffer);
console.log(`Wrote ${outputPath} (${(glbBuffer.length / 1024).toFixed(1)} KB)`);
