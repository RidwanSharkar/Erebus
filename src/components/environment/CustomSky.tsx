import React, { useMemo } from 'react';
import { Color, BackSide, SphereGeometry } from '@/utils/three-exports';
import { useColorCycle } from '../../utils/hooks/useColorCycle';

interface SkyProps {
  level?: number;
}

// Note: Level-based colors removed in favor of time-based cycling

/**
 * Creates a custom sky shader with time-based gradient colors
 */
const createSkyShader = (skyColors: { topColor: string; middleColor: string; bottomColor: string }) => {
  const topColor = new Color(skyColors.topColor);
  const middleColor = new Color(skyColors.middleColor);
  const bottomColor = new Color(skyColors.bottomColor);
  
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
 * Custom sky component with time-based gradient shader
 * Creates an immersive atmospheric backdrop for the game
 */
const CustomSky: React.FC<SkyProps> = ({ level = 1 }) => {
  // Use time-based color cycling
  const { getSkyColors } = useColorCycle();
  const skyColors = getSkyColors();

  const shaderParams = useMemo(() => {
    const skyShader = createSkyShader(skyColors);
    return {
      uniforms: skyShader.uniforms,
      vertexShader: skyShader.vertexShader,
      fragmentShader: skyShader.fragmentShader,
      side: BackSide,
    };
  }, [skyColors]);

  // Memoize geometry for performance
  const skyGeometry = useMemo(() => new SphereGeometry(500, 32, 32), []);

  return (
    <mesh geometry={skyGeometry}>
      <shaderMaterial attach="material" args={[shaderParams]} />
    </mesh>
  );
};

export default CustomSky;
