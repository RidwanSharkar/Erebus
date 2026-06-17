import {
  ShaderMaterial,
  AdditiveBlending,
  Color,
} from '@/utils/three-exports';

export const BEAM_CYLINDER_ADDITIVE_VS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const BEAM_CYLINDER_ADDITIVE_FS = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uWhiteMix;
  uniform float uBrightnessMul;
  varying vec2 vUv;
  void main() {
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
    },
  });
}
