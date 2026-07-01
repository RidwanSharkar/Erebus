import { ShaderMaterial } from '@/utils/three-exports';

export const CRACK_VERT = `
  attribute vec2 aCrackSeed;
  varying vec2 vCrackUv;

  void main() {
    vCrackUv = uv * 2.5 + aCrackSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const CRACK_VERT_SINGLE = `
  attribute vec2 aCrackSeed;
  varying vec2 vCrackUv;

  void main() {
    vCrackUv = uv * 2.5 + aCrackSeed;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

export const CRACK_FRAG = `
  varying vec2 vCrackUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float voronoiEdge(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = fract(p);

    float minDist1 = 1e9;
    float minDist2 = 1e9;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell  = vec2(float(x), float(y));
        vec2 point = hash2(pi + cell);
        vec2 diff  = cell + point - pf;
        float d    = dot(diff, diff);
        if (d < minDist1) { minDist2 = minDist1; minDist1 = d; }
        else if (d < minDist2) { minDist2 = d; }
      }
    }
    return sqrt(minDist2) - sqrt(minDist1);
  }

  float crackLine(float edge, float baseWidth) {
    float w = max(baseWidth, fwidth(edge) * 1.5);
    return smoothstep(w, 0.0, edge);
  }

  void main() {
    vec2 uv = vCrackUv;

    float edge1 = voronoiEdge(uv * 1.0);
    float edge2 = voronoiEdge(uv * 2.2 + 3.7);
    float edge3 = voronoiEdge(uv * 4.5 - 1.9);

    float crack1 = crackLine(edge1, 0.06);
    float crack2 = crackLine(edge2, 0.03) * 0.7;
    float crack3 = crackLine(edge3, 0.015) * 0.45;

    float cracks = clamp(crack1 + crack2 + crack3, 0.0, 1.0);

    vec3 crackCol = vec3(0.06, 0.05, 0.04);
    float alpha   = cracks * 0.72;

    gl_FragColor = vec4(crackCol, alpha);
  }
`;

export function createGroundCrackMaterial(instanced = true): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: instanced ? CRACK_VERT : CRACK_VERT_SINGLE,
    fragmentShader: CRACK_FRAG,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
