
import React, { useRef, useEffect, useMemo } from 'react';
import { BufferGeometry, CylinderGeometry, ConeGeometry, Group, MeshStandardMaterial, Mesh, Quaternion, Color, Vector3 } from 'three';


interface TreeBranch {
  start: Vector3;
  end: Vector3;
  radius: number;
  children: TreeBranch[];
  rotation: Vector3;
}

export interface DetailedTree {
  position: Vector3;
  scale: number;
  height: number;
  trunkRadius: number;
  trunkColor: Color;
}

// Function to generate a natural tree structure
const generateTreeStructure = (): TreeBranch[] => {
  const trunkHeight = 3 + Math.random() * 2; // 3-5 units tall
  const trunkRadius = 0.15 + Math.random() * 0.1; // 0.15-0.25 radius
  
  // Determine tree type for variety
  const treeType = Math.random();
  let isSparse = false;
  let isDense = false;
  
  if (treeType < 0.3) {
    isSparse = true; // 30% chance for sparse trees
  } else if (treeType > 0.7) {
    isDense = true; // 30% chance for dense trees
  }
  // 40% chance for normal trees
  
  // Create main trunk with slight natural curve
  const trunkCurve = (Math.random() - 0.5) * 0.3; // Slight trunk curve
  const trunk: TreeBranch = {
    start: new Vector3(0, 0, 0),
    end: new Vector3(trunkCurve, trunkHeight, 0),
    radius: trunkRadius,
    children: [],
    rotation: new Vector3(0, 0, 0)
  };
  
  // Generate main branches from trunk
  let mainBranchCount = 4 + Math.floor(Math.random() * 4); // 4-7 main branches (increased)
  if (isSparse) mainBranchCount = Math.max(3, mainBranchCount - 2); // Fewer branches for sparse trees
  if (isDense) mainBranchCount = mainBranchCount + 3; // More branches for dense trees
  
  const branchStartHeight = trunkHeight * (0.5 + Math.random() * 0.2); // Start branching at 50-70% of trunk height
  
  for (let i = 0; i < mainBranchCount; i++) {
    const angle = (i / mainBranchCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
    const height = branchStartHeight + (Math.random() - 0.5) * trunkHeight * 0.4;
    const length = 1.2 + Math.random() * 1.8; // 1.2-3 units long
    const radius = trunkRadius * (0.5 + Math.random() * 0.5); // 50-100% of trunk radius
    
    // Natural upward-growing branches
    const upwardAngle = Math.PI * 0.15 + Math.random() * Math.PI * 0.25; // 15-40 degrees upward
    const horizontalSpread = 0.4 + Math.random() * 0.3; // Reduced horizontal spread (0.4-0.7)
    const verticalGrowth = Math.cos(upwardAngle) * length; // Strong vertical component
    const horizontalGrowth = Math.sin(upwardAngle) * length * horizontalSpread;
    
    const branch: TreeBranch = {
      start: new Vector3(0, height, 0),
      end: new Vector3(
        Math.cos(angle) * horizontalGrowth,
        height + verticalGrowth, // Strong upward growth
        Math.sin(angle) * horizontalGrowth
      ),
      radius: radius,
      children: [],
      rotation: new Vector3(
        (Math.random() - 0.5) * 0.3, // Less rotation variation
        angle + (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.3
      )
    };
    
    // Generate secondary branches
    const secondaryCount = 3 + Math.floor(Math.random() * 4); // 3-6 secondary branches (increased)
    for (let j = 0; j < secondaryCount; j++) {
      const secAngle = angle + (Math.random() - 0.5) * 2.0;
      const secLength = length * (0.3 + Math.random() * 0.5); // 30-80% of main branch
      const secRadius = radius * (0.4 + Math.random() * 0.4); // 40-80% of main branch radius
      
      // Secondary branches also grow upward but at steeper angles
      const secUpwardAngle = Math.PI * 0.2 + Math.random() * Math.PI * 0.3; // 20-50 degrees upward
      const secHorizontalSpread = 0.3 + Math.random() * 0.4; // Even less horizontal spread
      const secVerticalGrowth = Math.cos(secUpwardAngle) * secLength;
      const secHorizontalGrowth = Math.sin(secUpwardAngle) * secLength * secHorizontalSpread;
      
      const secondaryBranch: TreeBranch = {
        start: branch.end.clone(),
        end: new Vector3(
          branch.end.x + Math.cos(secAngle) * secHorizontalGrowth,
          branch.end.y + secVerticalGrowth, // Strong upward growth
          branch.end.z + Math.sin(secAngle) * secHorizontalGrowth
        ),
        radius: secRadius,
        children: [],
        rotation: new Vector3(
          (Math.random() - 0.5) * 0.4,
          secAngle + (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.4
        )
      };
      
      // Removed tertiary branches to prevent cactus-like appearance
      
      branch.children.push(secondaryBranch);
    }
    
    trunk.children.push(branch);
  }
  
  return [trunk];
};

// Function to create branch geometry
const createBranchGeometry = (branch: TreeBranch): BufferGeometry => {
  const direction = branch.end.clone().sub(branch.start);
  const length = direction.length();
  
  // Create a cylinder for the branch
  const geometry = new CylinderGeometry(
    branch.radius * 0.8, // Top radius (slightly smaller)
    branch.radius,        // Bottom radius
    length,
    7                     // 6 segments for natural look
  );
  
  // Position cylinder so it starts at origin and extends along Y-axis
  geometry.translate(0, length / 2, 0);
  
  return geometry;
};

// Function to create foliage cone geometry
const createFoliageCone = (position: Vector3, scale: number = 1): ConeGeometry => {
  const coneRadius = 0.3 + Math.random() * 0.4; // 0.3-0.7 radius
  const coneHeight = 0.3 + Math.random() * 0.5; // 0.6-1.4 height
  
  return new ConeGeometry(
    coneRadius * scale,
    coneHeight * scale,
    8, // 8 segments for natural look
    1  // 1 height segment
  );
};

const DetailedTrees: React.FC<{ trees: DetailedTree[] }> = ({ trees }) => {
  const treeGroupsRef = useRef<Group[]>([]);

  // Generate tree structures
  const treeStructures = useMemo(() => {
    return trees.map(tree => ({
      ...tree,
      branches: generateTreeStructure()
    }));
  }, [trees]);

  useEffect(() => {
    // Clear previous trees
    treeGroupsRef.current.forEach(group => {
      if (group.parent) {
        group.parent.remove(group);
      }
    });
    treeGroupsRef.current = [];

    // Create new trees
    treeStructures.forEach((tree) => {
      const treeGroup = new Group();
      
      // Create trunk
      const trunkGeometry = new CylinderGeometry(
        tree.trunkRadius * 0.8,
        tree.trunkRadius,
        tree.height,
        8
      );
      
      // Create more realistic bark material with color variation
      const barkColorVariation = 0.2; // 20% color variation
      const trunkColorWithVariation = tree.trunkColor.clone().multiplyScalar(
        1.0 + Math.random() * barkColorVariation // Keep trunk at full brightness (was 0.9)
      );
      
      const trunkMaterial = new MeshStandardMaterial({
        color: trunkColorWithVariation,
        roughness: 0.85 + Math.random() * 0.1, // 0.85-0.95 for bark texture
        metalness: 0.05 + Math.random() * 0.05, // 0.05-0.1 for subtle variation
        emissive: trunkColorWithVariation.clone().multiplyScalar(0.05),
        emissiveIntensity: 0.15 + Math.random() * 0.1
      });
      
      const trunkMesh = new Mesh(trunkGeometry, trunkMaterial);
      trunkMesh.position.y = tree.height / 2;
      treeGroup.add(trunkMesh);

      // Create branches recursively
      const createBranches = (branches: TreeBranch[], parentGroup: Group) => {
        branches.forEach(branch => {
          const branchGeometry = createBranchGeometry(branch);
          
          // Create branch material with color variation based on branch size
          const branchColorVariation = 0.1; // 20% color variation for branches
          const branchColor = tree.trunkColor.clone().multiplyScalar(
            0.85 + Math.random() * branchColorVariation // Branches slightly darker than trunk (was 0.7)
          );
          
          const branchMaterial = new MeshStandardMaterial({
            color: branchColor,
            roughness: 0.9 + Math.random() * 0.08, // 0.9-0.98 for branch texture
            metalness: 0.02 + Math.random() * 0.03, // 0.02-0.05 for subtle variation
            emissive: branchColor.clone().multiplyScalar(0.03),
            emissiveIntensity: 0.08 + Math.random() * 0.07
          });
          
          const branchMesh = new Mesh(branchGeometry, branchMaterial);
          
          // Position branch at start point
          branchMesh.position.copy(branch.start);
          
          // Calculate direction and rotation to align branch properly
          const direction = branch.end.clone().sub(branch.start).normalize();
          const up = new Vector3(0, 1, 0);
          
          // Create quaternion to rotate from up vector to branch direction
          const quaternion = new Quaternion();
          quaternion.setFromUnitVectors(up, direction);
          branchMesh.setRotationFromQuaternion(quaternion);
          
          parentGroup.add(branchMesh);
          
          // Add foliage cones at terminal branches (branches with no children)
          if (branch.children.length === 0) {
            const coneGeometry = createFoliageCone(branch.end, tree.scale);
            
            // Create foliage material with green colors
            const foliageColors = [
              new Color(0x32C432), // Forest green
     
              new Color(0x90EE90), // Light green

            ];
            
            const foliageColor = foliageColors[Math.floor(Math.random() * foliageColors.length)];
            const foliageMaterial = new MeshStandardMaterial({
              color: foliageColor,
              roughness: 0.8 + Math.random() * 0.15, // 0.8-0.95 for natural leaf texture
              metalness: 0.0, // No metallic properties for leaves
              emissive: foliageColor.clone().multiplyScalar(0.1), // Subtle glow
              emissiveIntensity: 0.2 + Math.random() * 0.15 // 0.2-0.35 intensity
            });
            
            const coneMesh = new Mesh(coneGeometry, foliageMaterial);
            
            // Position cone at the end of the branch
            coneMesh.position.copy(branch.end);
            
            // Add slight random rotation for natural variation
            coneMesh.rotation.x = (Math.random() - 0.5) * 0.3;
            coneMesh.rotation.z = (Math.random() - 0.5) * 0.3;
            coneMesh.rotation.y = Math.random() * Math.PI * 2;
            
            // Slightly offset the cone upward so it sits naturally on the branch
            coneMesh.position.y += 0.1;
            
            parentGroup.add(coneMesh);
          }
          
          // Recursively add child branches
          if (branch.children.length > 0) {
            createBranches(branch.children, parentGroup);
          }
        });
      };

      createBranches(tree.branches, treeGroup);
      
      // Position the entire tree
      treeGroup.position.copy(tree.position);
      treeGroup.scale.setScalar(tree.scale);
      
      // Add some random rotation for variety
      treeGroup.rotation.y = Math.random() * Math.PI * 2;
      
      // Add slight random tilt for more natural look
      treeGroup.rotation.x = (Math.random() - 0.5) * 0.1;
      treeGroup.rotation.z = (Math.random() - 0.5) * 0.1;
      
      // Add some random position variation for more natural clustering
      const positionVariation = 0.5;
      treeGroup.position.x += (Math.random() - 0.5) * positionVariation;
      treeGroup.position.z += (Math.random() - 0.5) * positionVariation;
      
      treeGroupsRef.current.push(treeGroup);
    });
  }, [treeStructures]);

  return (
    <group>
      {treeGroupsRef.current.map((treeGroup, index) => (
        <primitive key={index} object={treeGroup} />
      ))}
    </group>
  );
};

export default DetailedTrees;
