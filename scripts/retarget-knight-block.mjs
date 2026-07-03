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

function isAssimpHelperTrack(trackName) {
  return trackName.split('.')[0].includes('_$AssimpFbx$_');
}

/** Map a reference-track name to the flat Mixamo FBX node name (exact track lookup). */
function sourceBoneNameForTrack(trackName) {
  return trackName.split('.')[0];
}

/** Assimp helper tracks (e.g. mixamorigLeftArm_$AssimpFbx$_Rotation) map to the flat Mixamo bone. */
function flatBoneNameForTrack(trackName) {
  const nodeName = trackName.split('.')[0];
  const assimpIdx = nodeName.indexOf('_$AssimpFbx$_');
  return assimpIdx === -1 ? nodeName : nodeName.slice(0, assimpIdx);
}

function sampleHelperLocalQuaternion(targetScene, sourceScene, targetTrackName) {
  const targetBone = targetTrackName.split('.')[0];
  const targetNode = findByName(targetScene, targetBone);
  if (!targetNode) return null;

  const sourceName = flatBoneNameForTrack(targetTrackName);
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

function getBindVector(refTrack) {
  const values = refTrack.values;
  const size = refTrack.getValueSize();
  return values.slice(0, size);
}

function resampleQuaternionTrack(refTrack, times, frameSampleFn, bindTrack) {
  const bindValues = getBindVector(bindTrack);
  const values = new Float32Array(times.length * 4);
  let lastValid = bindValues.length === 4 ? bindValues.slice() : [0, 0, 0, 1];
  let nullFrames = 0;

  for (let i = 0; i < times.length; i++) {
    const sampled = frameSampleFn(i);
    if (!sampled) {
      nullFrames += 1;
      for (let j = 0; j < 4; j++) values[i * 4 + j] = lastValid[j];
      continue;
    }
    sampled.toArray(values, i * 4);
    lastValid = [values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]];
  }

  return { track: new QuaternionKeyframeTrack(refTrack.name, times.slice(), values), nullFrames };
}

function resamplePositionTrack(refTrack, times, frameSampleFn, bindTrack) {
  const bindValues = getBindVector(bindTrack);
  const values = new Float32Array(times.length * 3);
  let lastValid = bindValues.length === 3 ? bindValues.slice() : [0, 0, 0];
  let nullFrames = 0;

  for (let i = 0; i < times.length; i++) {
    const sampled = frameSampleFn(i);
    if (!sampled) {
      nullFrames += 1;
      for (let j = 0; j < 3; j++) values[i * 3 + j] = lastValid[j];
      continue;
    }
    sampled.toArray(values, i * 3);
    lastValid = [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]];
  }

  return { track: new VectorKeyframeTrack(refTrack.name, times.slice(), values), nullFrames };
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

console.log('Loading idle bind-pose clip (knight_idle.glb)...');
const idleBindClip = await loadGltfClip(path.join(modelsDir, 'knight_idle.glb'));
const idleBindTrackMap = new Map(idleBindClip.tracks.map((t) => [t.name, t]));

console.log('Loading target skeleton (knight_smite.glb — animation-only, matches other knight clips)...');
const smiteBuffer = readFileSync(path.join(modelsDir, 'knight_smite.glb'));
const smiteGltf = await loader.parseAsync(
  smiteBuffer.buffer.slice(smiteBuffer.byteOffset, smiteBuffer.byteOffset + smiteBuffer.byteLength),
  modelsDir,
);
const targetScene = smiteGltf.scene.clone(true);
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
const resampleWarnings = [];

for (const refTrack of refClip.tracks) {
  const [, prop] = refTrack.name.split('.');
  const directSourceName = `${sourceBoneNameForTrack(refTrack.name)}.${prop}`;
  const hasDirectSource = blockTrackMap.has(directSourceName);
  const bindTrack = idleBindTrackMap.get(refTrack.name) ?? refTrack;

  // Mixamo FBX exports flat bones only — never drive Assimp helper tracks from a parent
  // bone's quaternion (that mismatch is what causes the twisted block pose).
  if (prop === 'quaternion' && hasDirectSource && !isAssimpHelperTrack(refTrack.name)) {
    const { track, nullFrames } = resampleQuaternionTrack(
      refTrack,
      times,
      (frameIndex) => {
        sourceMixer.setTime(times[frameIndex]);
        sourceScene.updateMatrixWorld(true);
        return sampleLocalQuaternion(targetScene, sourceScene, refTrack.name);
      },
      bindTrack,
    );
    if (nullFrames > 0) {
      resampleWarnings.push(`${refTrack.name}: ${nullFrames}/${numFrames} frames used fallback`);
    }
    outputTracks.push(track);
    continue;
  }

  // Assimp helper rotations must be derived from the flat FBX bone's world pose, not held
  // at idle bind — block is a static guard pose (~40-90° off idle on arms) baked in the FBX.
  if (prop === 'quaternion' && isAssimpHelperTrack(refTrack.name)) {
    const { track, nullFrames } = resampleQuaternionTrack(
      refTrack,
      times,
      (frameIndex) => {
        sourceMixer.setTime(times[frameIndex]);
        sourceScene.updateMatrixWorld(true);
        return sampleHelperLocalQuaternion(targetScene, sourceScene, refTrack.name);
      },
      bindTrack,
    );
    if (nullFrames > 0) {
      resampleWarnings.push(`${refTrack.name}: ${nullFrames}/${numFrames} frames used fallback`);
    }
    outputTracks.push(track);
    continue;
  }

  if (prop === 'position' && hasDirectSource && !isAssimpHelperTrack(refTrack.name)) {
    const { track, nullFrames } = resamplePositionTrack(
      refTrack,
      times,
      (frameIndex) => {
        sourceMixer.setTime(times[frameIndex]);
        sourceScene.updateMatrixWorld(true);
        return sampleLocalPosition(targetScene, sourceScene, refTrack.name);
      },
      bindTrack,
    );
    if (nullFrames > 0) {
      resampleWarnings.push(`${refTrack.name}: ${nullFrames}/${numFrames} frames used fallback`);
    }
    outputTracks.push(track);
    continue;
  }

  // Assimp offsets + any track absent from the FBX — hold idle bind-pose constants.
  outputTracks.push(makeConstantTrack(bindTrack, duration));
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
if (resampleWarnings.length > 0) {
  console.warn(`  resample fallbacks (${resampleWarnings.length} tracks):`);
  for (const warning of resampleWarnings) console.warn(`    ${warning}`);
} else {
  console.log('  resample fallbacks: none');
}
