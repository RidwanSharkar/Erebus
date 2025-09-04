import React, { useMemo } from 'react';
import { Color, BackSide, SphereGeometry } from '@/utils/three-exports';

interface SkyProps {
  level?: number;
}

/**
 * Get level-based colors for dynamic sky appearance
 */
const getLevelColors = (level: number) => {
  switch (level) {
    case 1: return { color: '#ff0000', emissive: '#600000' }; // Green 00ff00 006600
    case 2: return { color: '#ffa500', emissive: '#cc8400' }; // Orange
    case 3: return { color: '#87ceeb', emissive: '#4682b4' }; // Light Blue
    case 4: return { color: '#dda0dd', emissive: '#9370db' }; // Light Purple
    case 5: return { color: '#ff0000', emissive: '#600000' }; // Red
    default: return { color: '#00ff00', emissive: '#006600' }; // Default to green
  }
};

/**
 * Creates a custom sky shader with level-based gradient colors
 */
const createSkyShader = (level: number) => {
  const levelColors = getLevelColors(level);
  const baseColor = new Color(levelColors.color);
  
  // Create gradient colors based on level
  // Top: darker version of level color (made paler)
  const topColor = baseColor.clone().multiplyScalar(0.5);
  // Middle: level color with some saturation (made paler)
  const middleColor = baseColor.clone().multiplyScalar(0.85);
  // Bottom: lighter, more neutral version (made paler)
  const bottomColor = baseColor.clone().lerp(new Color('#87CEEB'), 0.6);
  
  return {
    uniforms: {
      topColor: { value: topColor },
      middleColor: { value: middleColor },
      bottomColor: { value: bottomColor },
      offset: { value: 33 },
      exponent: { value: 0.6 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 middleColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      
      varying vec3 vWorldPosition;
      
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        float mixStrength = max(pow(max(h, 0.0), exponent), 0.0);
        vec3 color = mix(middleColor, topColor, mixStrength);
        color = mix(bottomColor, color, smoothstep(0.0, 1.0, h));
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
};

/**
 * Custom sky component with level-based gradient shader
 * Creates an immersive atmospheric backdrop for the game
 */
const CustomSky: React.FC<SkyProps> = ({ level = 1 }) => {
  const shaderParams = useMemo(() => {
    const skyShader = createSkyShader(level);
    return {
      uniforms: skyShader.uniforms,
      vertexShader: skyShader.vertexShader,
      fragmentShader: skyShader.fragmentShader,
      side: BackSide,
    };
  }, [level]);

  // Memoize geometry for performance
  const skyGeometry = useMemo(() => new SphereGeometry(500, 32, 32), []);

  return (
    <mesh geometry={skyGeometry}>
      <shaderMaterial attach="material" args={[shaderParams]} />
    </mesh>
  );
};

export default CustomSky;
