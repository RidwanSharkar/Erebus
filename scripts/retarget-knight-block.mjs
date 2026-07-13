/**
 * Retarget knight block animations from flat Mixamo FBX skeleton onto the
 * Assimp-node track layout used by knight_idle.glb and all other knight clips.
 *
 * Per frame: apply FBX world-rotation deltas onto the idle bind skeleton (solving
 * Assimp _$AssimpFbx$_Rotation helpers where present), then extract local track
 * values for the 156-track Assimp clip layout used by all other knight GLBs.
 *
 * Usage:
 *   node scripts/retarget-knight-block.mjs <source.fbx> <output.glb>
 *   node scripts/retarget-knight-block.mjs knight_startblock.fbx knight_startblock.glb
 *   node scripts/retarget-knight-block.mjs knight_idleblock.fbx knight_idleblock.glb
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
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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
const _worldDelta = new Quaternion();
const _desiredWorld = new Quaternion();
const _parentWorld = new Quaternion();
const _handPos = new Vector3();

/** Max allowed hand-position error (cm) between FBX source and retargeted GLB on idle skeleton. */
const HAND_POSE_TOLERANCE = 12;

function findByName(rootObj, name) {
  let found = null;
  rootObj.traverse((child) => {
    if (!found && child.name === name) found = child;
  });
  return found;
}

/** Mixamo FBX files duplicate bone names along a chain — return the animated leaf bone. */
function findAnimationBone(rootObj, name) {
  const matches = [];
  rootObj.traverse((child) => {
    if (child.name === name) matches.push(child);
  });
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const leaf = matches.find((bone) => !bone.children.some((c) => c.name === name));
  return leaf ?? matches[matches.length - 1];
}

function captureFbxBindPose(scene) {
  const quats = new Map();
  const positions = new Map();
  const seen = new Set();
  scene.traverse((child) => {
    if (!child.name || seen.has(child.name)) return;
    const bone = findAnimationBone(scene, child.name);
    if (!bone) return;
    seen.add(child.name);
    quats.set(child.name, bone.quaternion.clone());
    positions.set(child.name, bone.position.clone());
  });
  return { quats, positions };
}

function isAssimpHelperTrack(trackName) {
  return trackName.split('.')[0].includes('_$AssimpFbx$_');
}

/** Assimp helper tracks map to the flat Mixamo bone name for delta sampling. */
function flatBoneNameForTrack(trackName) {
  const nodeName = trackName.split('.')[0];
  const assimpIdx = nodeName.indexOf('_$AssimpFbx$_');
  return assimpIdx === -1 ? nodeName : nodeName.slice(0, assimpIdx);
}

function captureWorldQuats(scene) {
  const worldQuats = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if (!child.name) return;
    child.getWorldQuaternion(_worldQuat);
    worldQuats.set(child.name, _worldQuat.clone());
  });
  return worldQuats;
}

function captureFbxWorldQuats(scene) {
  const worldQuats = new Map();
  const seen = new Set();
  scene.updateMatrixWorld(true);
  scene.traverse((child) => {
    if (!child.name || seen.has(child.name)) return;
    const bone = findAnimationBone(scene, child.name);
    if (!bone) return;
    seen.add(child.name);
    bone.getWorldQuaternion(_worldQuat);
    worldQuats.set(child.name, _worldQuat.clone());
  });
  return worldQuats;
}

function captureBindPose(scene) {
  const quats = new Map();
  const positions = new Map();
  scene.traverse((child) => {
    if (!child.name) return;
    quats.set(child.name, child.quaternion.clone());
    positions.set(child.name, child.position.clone());
  });
  return { quats, positions };
}

function resetSceneToBind(scene, bindQuats, bindPositions) {
  scene.traverse((child) => {
    if (!child.name) return;
    const q = bindQuats.get(child.name);
    const p = bindPositions.get(child.name);
    if (q) child.quaternion.copy(q);
    if (p) child.position.copy(p);
  });
  scene.updateMatrixWorld(true);
}

function boneDepth(scene, boneName) {
  const node = findByName(scene, boneName);
  if (!node) return 0;
  let depth = 0;
  let cur = node;
  while (cur.parent) {
    depth += 1;
    cur = cur.parent;
  }
  return depth;
}

/**
 * Apply FBX world-rotation delta for one flat bone onto the target skeleton.
 * Prefers driving the Assimp _$AssimpFbx$_Rotation helper when present.
 */
function applyBoneWorldDelta(
  solveScene,
  tgtBindWorld,
  fbxBindWorld,
  fbxBone,
  boneName,
) {
  const W_fbx_bind = fbxBindWorld.get(boneName);
  if (!W_fbx_bind || !fbxBone) return;

  fbxBone.getWorldQuaternion(_worldQuat);
  _worldDelta.copy(W_fbx_bind).invert().multiply(_worldQuat);

  const W_tgt_bind = tgtBindWorld.get(boneName);
  if (!W_tgt_bind) return;

  _desiredWorld.copy(W_tgt_bind).multiply(_worldDelta);

  const helperName = `${boneName}_$AssimpFbx$_Rotation`;
  const helper = findByName(solveScene, helperName);
  if (helper) {
    const helperBindWorld = tgtBindWorld.get(helperName);
    if (!helperBindWorld) return;
    _worldQuat.copy(helperBindWorld).multiply(_worldDelta);
    helper.parent.getWorldQuaternion(_parentWorld);
    helper.quaternion.copy(_parentWorld.invert().multiply(_worldQuat));
    return;
  }

  const direct = findByName(solveScene, boneName);
  if (!direct) return;
  direct.parent.getWorldQuaternion(_parentWorld);
  direct.quaternion.copy(_parentWorld.invert().multiply(_desiredWorld));
}

function makeConstantTrack(refTrack, duration) {
  const values = refTrack.values;
  const size = refTrack.getValueSize();
  const start = values.slice(0, size);
  const TrackCtor = refTrack instanceof QuaternionKeyframeTrack
    ? QuaternionKeyframeTrack
    : VectorKeyframeTrack;
  return new TrackCtor(refTrack.name, [0, duration], [...start, ...start]);
}

function getBindVector(refTrack) {
  const values = refTrack.values;
  const size = refTrack.getValueSize();
  return values.slice(0, size);
}

async function loadGltfClip(filePath) {
  const buffer = readFileSync(filePath);
  const gltf = await loader.parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    path.dirname(filePath),
  );
  return gltf.animations[0];
}

async function loadGltfScene(filePath) {
  const buffer = readFileSync(filePath);
  const gltf = await loader.parseAsync(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    path.dirname(filePath),
  );
  return gltf.scene;
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

function getHandWorldPos(scene) {
  const hand = findByName(scene, 'mixamorigLeftHand');
  if (!hand) return null;
  hand.getWorldPosition(_handPos);
  return _handPos.clone();
}

async function validateHandPose(sourceFbxPath, outputClip, sampleTime, label) {
  const sourceScene = loadFbxScene(sourceFbxPath);
  const sourceClip = sourceScene.animations[0];
  const sourceMixer = new AnimationMixer(sourceScene);
  sourceMixer.clipAction(sourceClip).play();
  sourceMixer.setTime(sampleTime);
  sourceScene.updateMatrixWorld(true);
  const sourceHand = getHandWorldPos(sourceScene);
  sourceMixer.stopAllAction();

  const idleScene = SkeletonUtils.clone(await loadGltfScene(path.join(modelsDir, 'knight_idle.glb')));
  const targetMixer = new AnimationMixer(idleScene);
  targetMixer.clipAction(outputClip).play();
  targetMixer.setTime(sampleTime);
  idleScene.updateMatrixWorld(true);
  const targetHand = getHandWorldPos(idleScene);
  targetMixer.stopAllAction();

  if (!sourceHand || !targetHand) {
    throw new Error(`${label}: could not find mixamorigLeftHand for pose validation`);
  }

  const dist = sourceHand.distanceTo(targetHand);
  const ok = dist <= HAND_POSE_TOLERANCE;
  console.log(
    `  pose check (${label} @ t=${sampleTime.toFixed(3)}s): hand dist=${dist.toFixed(2)} cm` +
    ` (src Z=${sourceHand.z.toFixed(1)}, tgt Z=${targetHand.z.toFixed(1)})` +
    (ok ? ' OK' : ' FAIL'),
  );
  if (!ok) {
    throw new Error(
      `${label}: hand pose mismatch ${dist.toFixed(2)} cm (tolerance ${HAND_POSE_TOLERANCE} cm)`,
    );
  }
}

function trackNodeNameForRef(refTrackName) {
  return refTrackName.split('.')[0];
}

async function retargetKnightBlockAnimation(sourceFbxName, outputGlbName) {
  const sourceFbxPath = path.join(modelsDir, sourceFbxName);
  const outputPath = path.join(modelsDir, outputGlbName);

  console.log(`\n=== Retargeting ${sourceFbxName} -> ${outputGlbName} ===`);

  console.log('Loading reference clip (knight_smite.glb)...');
  const refClip = await loadGltfClip(path.join(modelsDir, 'knight_smite.glb'));

  console.log('Loading idle bind-pose clip (knight_idle.glb)...');
  const idleBindClip = await loadGltfClip(path.join(modelsDir, 'knight_idle.glb'));
  const idleBindTrackMap = new Map(idleBindClip.tracks.map((t) => [t.name, t]));

  console.log('Loading target skeleton (knight_smite.glb)...');
  const smiteBuffer = readFileSync(path.join(modelsDir, 'knight_smite.glb'));
  const smiteGltf = await loader.parseAsync(
    smiteBuffer.buffer.slice(smiteBuffer.byteOffset, smiteBuffer.byteOffset + smiteBuffer.byteLength),
    modelsDir,
  );
  const targetScene = smiteGltf.scene.clone(true);
  stripMeshes(targetScene);

  console.log('Loading idle skeleton for bind reference...');
  const idleScene = await loadGltfScene(path.join(modelsDir, 'knight_idle.glb'));
  const { quats: tgtBindQuats, positions: tgtBindPositions } = captureBindPose(idleScene);
  const tgtBindWorld = captureWorldQuats(idleScene);

  console.log(`Loading source animation (${sourceFbxName})...`);
  const sourceScene = loadFbxScene(sourceFbxPath);
  const sourceClip = sourceScene.animations[0];
  if (!sourceClip) throw new Error(`${sourceFbxName} has no animation clip`);

  const fbxBindWorld = captureFbxWorldQuats(sourceScene);
  const { positions: fbxBindPositions } = captureFbxBindPose(sourceScene);
  const sourceTrackMap = new Map(sourceClip.tracks.map((t) => [t.name, t]));

  const fbxAnimatedBones = [...new Set(
    sourceClip.tracks
      .filter((t) => t.name.endsWith('.quaternion'))
      .map((t) => t.name.split('.')[0]),
  )].sort((a, b) => boneDepth(idleScene, a) - boneDepth(idleScene, b));

  const fps = 30;
  const duration = sourceClip.duration;
  const numFrames = Math.max(2, Math.round(duration * fps) + 1);
  const times = Float32Array.from({ length: numFrames }, (_, i) =>
    Math.min(duration, (i / (numFrames - 1)) * duration),
  );

  console.log(`Sampling ${numFrames} frames over ${duration.toFixed(3)}s (world-delta solve)...`);

  const sourceMixer = new AnimationMixer(sourceScene);
  sourceMixer.clipAction(sourceClip).play();

  const solveScene = SkeletonUtils.clone(idleScene);
  const trackSamples = new Map();

  for (const refTrack of refClip.tracks) {
    const size = refTrack.getValueSize();
    trackSamples.set(refTrack.name, {
      size,
      isQuat: refTrack instanceof QuaternionKeyframeTrack,
      values: new Float32Array(numFrames * size),
    });
  }

  for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
    sourceMixer.setTime(times[frameIndex]);
    sourceScene.updateMatrixWorld(true);

    resetSceneToBind(solveScene, tgtBindQuats, tgtBindPositions);

    for (const boneName of fbxAnimatedBones) {
      applyBoneWorldDelta(
        solveScene,
        tgtBindWorld,
        fbxBindWorld,
        findAnimationBone(sourceScene, boneName),
        boneName,
      );
      solveScene.updateMatrixWorld(true);
    }

    solveScene.updateMatrixWorld(true);

    // Snapshot solved quaternions; keep position/scale at idle bind-clip values (scene
    // node positions differ from animation-track values and corrupt playback if copied).
    for (const refTrack of refClip.tracks) {
      const [, prop] = refTrack.name.split('.');
      const sample = trackSamples.get(refTrack.name);
      const bindTrack = idleBindTrackMap.get(refTrack.name) ?? refTrack;
      const bindValues = getBindVector(bindTrack);
      const offset = frameIndex * sample.size;
      const nodeName = trackNodeNameForRef(refTrack.name);
      const node = findByName(solveScene, nodeName);

      if (node && prop === 'quaternion') {
        node.quaternion.toArray(sample.values, offset);
      } else if (prop === 'position') {
        const fbxBoneName = flatBoneNameForTrack(refTrack.name);
        const fbxPosTrack = sourceTrackMap.get(`${fbxBoneName}.position`);
        if (fbxPosTrack && !isAssimpHelperTrack(refTrack.name)) {
          const fbxNode = findAnimationBone(sourceScene, fbxBoneName);
          const fbxBindPos = fbxBindPositions.get(fbxBoneName);
          if (fbxNode && fbxBindPos) {
            const delta = new Vector3().subVectors(fbxNode.position, fbxBindPos);
            const out = new Vector3().fromArray(bindValues).add(delta);
            out.toArray(sample.values, offset);
          } else {
            for (let j = 0; j < sample.size; j++) sample.values[offset + j] = bindValues[j];
          }
        } else {
          for (let j = 0; j < sample.size; j++) sample.values[offset + j] = bindValues[j];
        }
      } else {
        for (let j = 0; j < sample.size; j++) sample.values[offset + j] = bindValues[j];
      }
    }
  }

  sourceMixer.stopAllAction();

  const outputTracks = refClip.tracks.map((refTrack) => {
    const sample = trackSamples.get(refTrack.name);
    const TrackCtor = sample.isQuat ? QuaternionKeyframeTrack : VectorKeyframeTrack;
    return new TrackCtor(refTrack.name, times.slice(), sample.values);
  });

  const outputClip = new AnimationClip('mixamo.com', duration, outputTracks);
  await exportAnimationGlb(targetScene, outputClip, outputPath);

  console.log(`Wrote ${outputPath}`);
  console.log(`  duration: ${duration.toFixed(3)}s`);
  console.log(`  tracks: ${outputTracks.length}`);
  console.log(
    `  has Assimp tracks: ${outputTracks.some((t) => t.name.includes('AssimpFbx'))}`,
  );

  const sampleTime = outputGlbName.includes('startblock') ? duration : 0;
  await validateHandPose(sourceFbxPath, outputClip, sampleTime, outputGlbName);

  return { duration, outputPath, outputClip };
}

const [sourceArg, outputArg] = process.argv.slice(2);
const jobs = sourceArg && outputArg
  ? [[sourceArg, outputArg]]
  : [
      ['knight_startblock.fbx', 'knight_startblock.glb'],
      ['knight_idleblock.fbx', 'knight_idleblock.glb'],
    ];

for (const [sourceFbx, outputGlb] of jobs) {
  await retargetKnightBlockAnimation(sourceFbx, outputGlb);
}
