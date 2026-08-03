import {
  ShaderMaterial,
  AdditiveBlending,
  Color,
} from '@/utils/three-exports';

/** Default: effectively no world-Y clip. */
const MIN_WORLD_Y_DISABLED = -1e10;

export const BEAM_CYLINDER_ADDITIVE_VS = `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const BEAM_CYLINDER_ADDITIVE_FS = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uWhiteMix;
  uniform float uBrightnessMul;
  uniform float uMinWorldY;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    if (vWorldPos.y < uMinWorldY) discard;
    float strength = 1.0 - length(vUv - vec2(0.5));
    strength = max(strength, 0.0);
    vec3 glowColor = mix(uColor, vec3(1.0), uWhiteMix);
    gl_FragColor = vec4(glowColor * uBrightnessMul, strength * uOpacity);
  }
`;

export function createBeamCylinderAdditiveMaterial(
  color: Color,
  opacity: number,
  whiteMix: number,
  brightnessMul = 1,
  minWorldY = MIN_WORLD_Y_DISABLED,
): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: BEAM_CYLINDER_ADDITIVE_VS,
    fragmentShader: BEAM_CYLINDER_ADDITIVE_FS,
    uniforms: {
      uColor: { value: color.clone() },
      uOpacity: { value: opacity },
      uWhiteMix: { value: whiteMix },
      uBrightnessMul: { value: brightnessMul },
      uMinWorldY: { value: minWorldY },
    },
  });
}
