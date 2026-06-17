export default function DragonSkull() {
  const commonMaterialProps = {
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: 0.95
  };

  return (
    <group>
      {/* Main Horns - Left and Right */}
      {[-0.89, 0.89].map((side) => (
        <group 
          key={side} 
          position={[side * 0.56, 0.625, -0.75]}
          rotation={[-1.35, 0, side * 3.025]}
        >
          {/* Main Horn Segment */}
          <mesh>
            <cylinderGeometry args={[.08, 0.0125, 1, ]} />
            <meshStandardMaterial 
              color="#d4d4d4"
              {...commonMaterialProps}
            />
          </mesh>

          {/* Teeth Rows */}
          <group position={[0, 1.35, -0.0]} scale={1.6} rotation={[-0.65, 0, 0]}>
            {/* Upper teeth row */}
            {[-0.07 , -0.02, 0.02, 0.07].map((offset, i) => (
              <group key={`upper-${i}`} position={[offset, 0.125, -0.15]} rotation={[+2, 0, 0]} scale={[1., 1.5, 1.2]}>
                <mesh>
                  <coneGeometry args={[
                    0.02 * (i === 0 || i === 6 ? 1 : 1),
                    0.075 * (i === 0 || i === 6 ? 1 : 1),
                    3
                  ]} />
                  <meshStandardMaterial 
                    color="#e8e8e8"
                    {...commonMaterialProps}
                  />
                </mesh>
              </group>
            ))}
            
            {/* Lower teeth row */}
            {[-0.08, -0.015, 0.015, 0.09].map((offset, i) => (
              <group key={`lower-${i}`} position={[offset, 0.01075, 0]} rotation={[-0.45, 0, 0]}>
                <mesh>
                  <coneGeometry args={[
                    0.025 * (i === 0 || i === 3 ? 1.3 : 1),
                    0.095 * (i === 0 || i === 3 ? 1.5 : 1),
                    3
                  ]} />
                  <meshStandardMaterial 
                    color="#e8e8e8"
                    {...commonMaterialProps}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* Mid Section with Ridge Details */}
          <group 
            position={[0, 0.4, 0.2]} 
            rotation={[-0.05, 0, side * 0.3]} 
          >
            <mesh>
              <cylinderGeometry args={[0.08, 0.008, 0.8, 32, 32]} />
              <meshStandardMaterial 
                color="#c4c4c4"
                {...commonMaterialProps}
              />
            </mesh>
            
            {/* Ridge Spikes */}
            {[...Array(5)].map((_, i) => (
              <group 
                key={i}
                position={[side * +0.02, i * 0.095, 0.07]}
                rotation={[Math.PI / 1.5, 0, 0]}
              >
                <mesh>
                  <coneGeometry args={[0.0325, 0.1, 32, 32]} />
                  <meshStandardMaterial 
                    color="#b4b4b4"
                    {...commonMaterialProps}
                  />
                </mesh>
              </group>
            ))}
          </group>

          {/* Upper Curved Section */}
          <group 
            position={[0, 1.0225, +0.3]} 
            rotation={[-0.925, 0, side * 0.5]}
          >
            <mesh>
              <cylinderGeometry args={[0.07, 0.0075, 0.6, 5]} />
              <meshStandardMaterial 
                color="#b4b4b4"
                {...commonMaterialProps}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}