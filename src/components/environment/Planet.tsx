import React, { useRef, useMemo } from 'react';
import { Mesh, Group, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, BackSide, DoubleSide, Matrix4, Vector3, RingGeometry, CanvasTexture, LinearFilter, Frustum, Sphere, Color } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useColorCycle } from '../../utils/hooks/useColorCycle';

/**
 * Planet component with rings and atmospheric glow effects
 * Creates a distant celestial body to enhance the game's atmosphere
 */
const Planet: React.FC = () => {
  const ringRef = useRef<Mesh>(null);
  const groupRef = useRef<Group>(null);

  // Use time-based color cycling
  const { getPlanetColors } = useColorCycle();
  const planetColors = getPlanetColors();

  // Memoize geometries with reduced segments for better performance
  const sphereGeometry = useMemo(() => new SphereGeometry(1, 24, 24), []);
  const ringGeometry = useMemo(() => new RingGeometry(1.4, 2.1, 48), []);

  // Dynamic planet material that updates with colors
  const planetMaterial = useMemo(() => new MeshStandardMaterial({
    color: new Color(planetColors.planet),
    roughness: 0.7,
    metalness: 0.2,
    emissive: new Color(planetColors.planet),
    emissiveIntensity: 0.675
  }), [planetColors.planet]);

  // Dynamic glow materials that update with colors
  const glowMaterial = useMemo(() => new MeshBasicMaterial({
    color: new Color(planetColors.glow),
    transparent: true,
    opacity: 0.5
  }), [planetColors.glow]);

  const outerGlowMaterial = useMemo(() => new MeshBasicMaterial({
    color: new Color(planetColors.glow),
    transparent: true,
    opacity: 0.2,
    side: BackSide
  }), [planetColors.glow]);

  // Create a simple ring texture procedurally to avoid external dependencies
  const ringTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    
    // Create radial gradient for ring alpha
    const gradient = context.createRadialGradient(128, 128, 50, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    
    const texture = new CanvasTexture(canvas);
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.generateMipmaps = false;
    
    return texture;
  }, []);

  const ringMaterial = useMemo(() => new MeshStandardMaterial({
    map: ringTexture,
    color: new Color(planetColors.ring),
    transparent: true,
    opacity: 1,
    side: DoubleSide,
    alphaMap: ringTexture,
    roughness: 0.7,
    metalness: 0.2,
    emissive: new Color(planetColors.planet),
    emissiveIntensity: 1.1
  }), [ringTexture, planetColors.ring, planetColors.planet]);

  // Cache frustum and matrices to reduce garbage collection
  const frustum = useMemo(() => new Frustum(), []);
  const matrix = useMemo(() => new Matrix4(), []);
  const sphere = useMemo(() => new Sphere(new Vector3(), 24 * Math.sqrt(3)), []);

  // Rotate the ring slowly and apply frustum culling
  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.006;
    }
    
    // Apply frustum culling for performance
    if (groupRef.current) {
      // Update frustum check with cached objects
      matrix.multiplyMatrices(
        state.camera.projectionMatrix,
        state.camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(matrix);
      
      sphere.center.copy(groupRef.current.position);
      groupRef.current.visible = frustum.intersectsSphere(sphere);
    }
  });

  return (
    <group 
      ref={groupRef} 
      position={[100, 80, -150]} 
      scale={[24, 24, 24]} 
      rotation={[1.0, 0.1, 0.1]}
    >
      {/* Main planet sphere */}
      <mesh geometry={sphereGeometry} material={planetMaterial} />

      {/* Planet Ring */}
      <mesh 
        ref={ringRef} 
        rotation={[Math.PI / 2.8, 0, 0]} 
        geometry={ringGeometry}
        material={ringMaterial}
      />

      {/* Inner glow */}
      <mesh 
        scale={[1.05, 1.05, 1.05]} 
        geometry={sphereGeometry} 
        material={glowMaterial} 
      />

      {/* Outer glow */}
      <mesh 
        scale={[1.1, 1.1, 1.1]} 
        geometry={sphereGeometry}
        material={outerGlowMaterial}
      />
    </group>
  );
};

export default Planet;
