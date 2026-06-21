import {
  BoxGeometry,
  CircleGeometry,
  OctahedronGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  BufferGeometry,
} from '@/utils/three-exports';

function createJaggedBlockGeometry(): BufferGeometry {
  const geo = new BoxGeometry(1.0, 1.25, 1.0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const edge = Math.abs(x) > 0.4 && Math.abs(y) > 0.5 && Math.abs(z) > 0.4 ? 1.08 : 1.0;
    const jitter = 0.92 + Math.sin(i * 2.17 + x * 3.1 + z * 2.3) * 0.08;
    pos.setX(i, x * edge * jitter);
    pos.setY(i, y * (0.96 + Math.abs(x) * 0.06) * jitter);
    pos.setZ(i, z * edge * jitter);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export const sharedFrozenGeometries = {
  jaggedBlock: createJaggedBlockGeometry(),
  ground: new CircleGeometry(1.0, 8),
  spike: new OctahedronGeometry(0.18, 0),
};

export const sharedFrozenMaterials = {
  shell: new MeshStandardMaterial({
    color: '#B3E5FC',
    emissive: '#29B6F6',
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.42,
    roughness: 0.12,
    metalness: 0.1,
    flatShading: true,
    depthWrite: false,
  }),
  ground: new MeshBasicMaterial({
    color: '#7EC8E8',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  }),
  spike: new MeshStandardMaterial({
    color: '#B3E5FC',
    emissive: '#4FC3F7',
    emissiveIntensity: 0.55,
    transparent: true,
    opacity: 0.7,
    roughness: 0.08,
    metalness: 0.12,
    flatShading: true,
    depthWrite: false,
  }),
};

export function cloneFrozenShellMaterial(): MeshStandardMaterial {
  return sharedFrozenMaterials.shell.clone();
}

export function cloneFrozenGroundMaterial(): MeshBasicMaterial {
  return sharedFrozenMaterials.ground.clone();
}

export function cloneFrozenSpikeMaterial(): MeshStandardMaterial {
  return sharedFrozenMaterials.spike.clone();
}
