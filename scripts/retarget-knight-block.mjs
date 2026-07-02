/**
 * Retarget knight_block animation from flat Mixamo FBX skeleton onto the
 * Assimp-node track layout used by knight_idle.glb and all other knight clips.
 *
 * Usage: node scripts/retarget-knight-block.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  AnimationClip,
  AnimationMixer,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Minimal browser polyfills for Node (must run before three-stdlib imports)
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
globalThis.Image = class Image {
  set src(_v) {}
  addEventListener() {}
};

const root = path.resolve(import.meta.dirname, '..');
const modelsDir = path.join(root, 'public', 'models');

const { FBXLoader } = await import(
  pathToFileURL(path.join(root, 'node_modules/three-stdlib/loaders/FBXLoader.js')).href
);
const { GLTFExporter } = await import(
  pathToFileURL(path.join(root, 'node_modules/three-stdlib/exporters/GLTFExporter.js')).href
);

const loader = new GLTFLoader();
loader.manager.onLoad = () => {};

// Stub textures so idle GLB loads in Node.
import * as THREE from 'three';
THREE.TextureLoader.prototype.load = function loadTextureStub(_url, onLoad) {
  const texture = new THREE.Texture();
  texture.needsUpdate = true;
  if (onLoad) queueMicrotask(() => onLoad(texture));
  return texture;
};

const _worldQuat = new Quaternion();
const _parentWorldQuat = new Quaternion();
const _localQuat = new Quaternion();
const _worldPos = new Vector3();
const _localPos = new Vector3();

function findByName(rootObj, name) {
  let found = null;
  rootObj.traverse((child) => {
    if (!found && child.name === name) found = child;
  });
  return found;
}

/** Map a smite/idle track bone name to the flat Mixamo source bone. */
function sourceBoneNameForTrack(trackName) {
  const bone = trackName.split('.')[0];
  if (bone.includes('_$AssimpFbx$_Rotation')) {
    return bone.replace('_$AssimpFbx$_Rotation', '');
  }
  return bone;
}

function sampleLocalQuaternion(targetScene, sourceScene, targetTrackName) {
  const targetBone = targetTrackName.split('.')[0];
  const targetNode = findByName(targetScene, targetBone);
  if (!targetNode) return null;

  const sourceName = sourceBoneNameForTrack(targetTrackName);
  const sourceNode = findByName(sourceScene, sourceName);
  if (!sourceNode) return null;

  sourceNode.updateWorldMatrix(true, false);
  sourceNode.getWorldQuaternion(_worldQuat);

  if (targetNode.parent) {
    targetNode.parent.updateWorldMatrix(true, false);
    targetNode.parent.getWorldQuaternion(_parentWorldQuat);
    _localQuat.copy(_parentWorldQuat.invert().multiply(_worldQuat));
  } else {
    _localQuat.copy(_worldQuat);
  }

  return _localQuat.clone();
}

function sampleLocalPosition(targetScene, sourceScene, targetTrackName) {
  const targetBone = targetTrackName.split('.')[0];
  const targetNode = findByName(targetScene, targetBone);
  if (!targetNode) return null;

  const sourceName = sourceBoneNameForTrack(targetTrackName);
  const sourceNode = findByName(sourceScene, sourceName);
  if (!sourceNode) return null;

  sourceNode.updateWorldMatrix(true, false);
  sourceNode.getWorldPosition(_worldPos);

  if (targetNode.parent) {
    targetNode.parent.updateWorldMatrix(true, false);
    targetNode.parent.worldToLocal(_worldPos);
    _localPos.copy(_worldPos);
  } else {
    _localPos.copy(_worldPos);
  }

  return _localPos.clone();
}

function makeConstantTrack(refTrack, duration) {
  const values = refTrack.values;
  const size = refTrack.getValueSize();
  const start = values.slice(0, size);
  const end = values.slice(values.length - size);
  const TrackCtor = refTrack instanceof QuaternionKeyframeTrack
    ? QuaternionKeyframeTrack
    : VectorKeyframeTrack;
  return new TrackCtor(
    refTrack.name,
    [0, duration],
    [...start, ...end],
  );
}

function resampleTrack(refTrack, times, sampleFn) {
  const size = refTrack.getValueSize();
  const values = new Array(times.length * size);
  for (let i = 0; i < times.length; i++) {
    const sampled = sampleFn();
    if (!sampled) return null;
    for (let j = 0; j < size; j++) values[i * size + j] = sampled[j];
  }
  const TrackCtor = refTrack instanceof QuaternionKeyframeTrack
    ? QuaternionKeyframeTrack
    : VectorKeyframeTrack;
  return new TrackCtor(refTrack.name, times, values);
}

async function loadGltfClip(filePath) {
  const buffer = readFileSync(filePath);
  const gltf = await loader.parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    path.dirname(filePath),
  );
  return gltf.animations[0];
}

function loadFbxScene(filePath) {
  const fbxLoader = new FBXLoader();
  const buffer = readFileSync(filePath);
  return fbxLoader.parse(buffer.buffer, path.dirname(filePath));
}

function stripMeshes(scene) {
  const toRemove = [];
  scene.traverse((child) => {
    if (child.isMesh) toRemove.push(child);
  });
  for (const mesh of toRemove) mesh.parent?.remove(mesh);
}

async function exportAnimationGlb(scene, clip, outputPath) {
  const exporter = new GLTFExporter();
  const glbBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(Buffer.from(result));
        else reject(new Error('Expected binary GLB output'));
      },
      (error) => reject(error),
      { binary: true, animations: [clip], onlyVisible: false },
    );
  });
  writeFileSync(outputPath, glbBuffer);
}

console.log('Loading reference clip (knight_smite.glb)...');
const refClip = await loadGltfClip(path.join(modelsDir, 'knight_smite.glb'));

console.log('Loading target skeleton (knight_idle.glb)...');
const idleBuffer = readFileSync(path.join(modelsDir, 'knight_idle.glb'));
const idleGltf = await loader.parseAsync(
  idleBuffer.buffer.slice(idleBuffer.byteOffset, idleBuffer.byteOffset + idleBuffer.byteLength),
  modelsDir,
);
const targetScene = idleGltf.scene.clone(true);
stripMeshes(targetScene);

console.log('Loading source animation (knight_block.fbx)...');
const sourceScene = loadFbxScene(path.join(modelsDir, 'knight_block.fbx'));
const sourceClip = sourceScene.animations[0];
if (!sourceClip) throw new Error('knight_block.fbx has no animation clip');

const fps = 30;
const duration = sourceClip.duration;
const numFrames = Math.max(2, Math.round(duration * fps) + 1);
const times = Float32Array.from({ length: numFrames }, (_, i) =>
  Math.min(duration, (i / (numFrames - 1)) * duration),
);

console.log(`Sampling ${numFrames} frames over ${duration.toFixed(3)}s...`);

const sourceMixer = new AnimationMixer(sourceScene);
const sourceAction = sourceMixer.clipAction(sourceClip);
sourceAction.play();

const blockTrackMap = new Map(sourceClip.tracks.map((t) => [t.name, t]));

const outputTracks = [];

for (const refTrack of refClip.tracks) {
  const [targetBone, prop] = refTrack.name.split('.');
  const directSourceName = `${sourceBoneNameForTrack(refTrack.name)}.${prop}`;
  const hasDirectSource = blockTrackMap.has(directSourceName);

  if (prop === 'quaternion' && hasDirectSource) {
    const values = new Float32Array(numFrames * 4);
    for (let i = 0; i < numFrames; i++) {
      sourceMixer.setTime(times[i]);
      sourceScene.updateMatrixWorld(true);
      const q = sampleLocalQuaternion(targetScene, sourceScene, refTrack.name);
      if (!q) break;
      q.toArray(values, i * 4);
    }
    outputTracks.push(new QuaternionKeyframeTrack(refTrack.name, times.slice(), values));
    continue;
  }

  if (prop === 'position' && blockTrackMap.has(directSourceName)) {
    const values = new Float32Array(numFrames * 3);
    for (let i = 0; i < numFrames; i++) {
      sourceMixer.setTime(times[i]);
      sourceScene.updateMatrixWorld(true);
      const p = sampleLocalPosition(targetScene, sourceScene, refTrack.name);
      if (!p) break;
      p.toArray(values, i * 3);
    }
    outputTracks.push(new VectorKeyframeTrack(refTrack.name, times.slice(), values));
    continue;
  }

  // Constant position/scale offsets — hold smite bind-pose values for the clip duration.
  outputTracks.push(makeConstantTrack(refTrack, duration));
}

sourceMixer.stopAllAction();

const outputClip = new AnimationClip('mixamo.com', duration, outputTracks);
const outputPath = path.join(modelsDir, 'knight_block.glb');
await exportAnimationGlb(targetScene, outputClip, outputPath);

console.log(`Wrote ${outputPath}`);
console.log(`  duration: ${duration.toFixed(3)}s`);
console.log(`  tracks: ${outputTracks.length}`);
console.log(
  `  has Assimp tracks: ${outputTracks.some((t) => t.name.includes('AssimpFbx'))}`,
);
