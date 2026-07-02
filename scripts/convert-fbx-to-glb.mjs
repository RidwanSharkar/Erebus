/**
 * Convert a Mixamo FBX animation export to a single-animation GLB.
 * Uses three-stdlib (FBXLoader + GLTFExporter) — works on Apple Silicon without fbx2gltf.
 *
 * Usage: node scripts/convert-fbx-to-glb.mjs <input.fbx> <output.glb>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Minimal browser polyfills for Node (must run before three imports)
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
  constructor() {
    this.onload = null;
    this.onerror = null;
    this._listeners = {};
    this.src = '';
    this.width = 1;
    this.height = 1;
  }
  addEventListener(type, fn) {
    (this._listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    const list = this._listeners[type];
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }
  set src(_v) {
    queueMicrotask(() => {
      for (const fn of this._listeners.load || []) fn();
      this.onload?.();
    });
  }
};
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}
if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}

const root = path.resolve(import.meta.dirname, '..');
const THREE = await import('three');
const { FBXLoader } = await import(pathToFileURL(path.join(root, 'node_modules/three-stdlib/loaders/FBXLoader.js')).href);
const { GLTFExporter } = await import(pathToFileURL(path.join(root, 'node_modules/three-stdlib/exporters/GLTFExporter.js')).href);

// Animation-only export — stub textures on the same three instance FBXLoader uses.
THREE.TextureLoader.prototype.load = function loadTextureStub(_url, onLoad) {
  const texture = new THREE.Texture();
  texture.needsUpdate = true;
  if (onLoad) queueMicrotask(() => onLoad(texture));
  return texture;
};

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-fbx-to-glb.mjs <input.fbx> <output.glb>');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
const absOutput = path.resolve(outputPath);

console.log(`Loading FBX: ${absInput}`);
const buffer = readFileSync(absInput);
const loader = new FBXLoader();
const group = loader.parse(buffer.buffer, path.dirname(absInput));

const animCount = group.animations?.length ?? 0;
console.log(`Parsed scene with ${animCount} animation clip(s)`);
if (animCount > 0) {
  group.animations.forEach((clip, i) => {
    console.log(`  [${i}] "${clip.name}" duration=${clip.duration.toFixed(3)}s tracks=${clip.tracks.length}`);
  });
}

// Strip textured materials so GLTFExporter doesn't require image data.
group.traverse((child) => {
  if (child.isMesh) {
    child.material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    child.visible = false;
  }
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
    { binary: true, animations: group.animations, onlyVisible: false },
  );
});

writeFileSync(absOutput, glbBuffer);
console.log(`Wrote ${absOutput} (${(glbBuffer.length / 1024).toFixed(1)} KB)`);
