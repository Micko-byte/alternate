import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface TShirtModelProps {
  shirtColor: string;
  designTexture: THREE.Texture | null;
  designPosition?: { x: number; y: number; z: number };
  designScale?: number;
  designRotation?: number;
  zone?: 'front' | 'back' | 'leftSleeve' | 'rightSleeve';
}

// Generate procedural fabric normal map
const generateFabricNormalMap = (): THREE.Texture => {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base normal (facing camera)
  ctx.fillStyle = 'rgb(128, 128, 255)';
  ctx.fillRect(0, 0, size, size);

  // Add fabric weave pattern
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      
      // Create fabric weave pattern
      const waveX = Math.sin(x * 0.3) * 8;
      const waveY = Math.sin(y * 0.3) * 8;
      const noise = (Math.random() - 0.5) * 10;
      
      // Modulate normal based on weave
      data[i] = 128 + waveX + noise;     // R (X normal)
      data[i + 1] = 128 + waveY + noise; // G (Y normal)
      // B (Z normal) stays mostly 255
    }
  }

  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
};

// Generate displacement map for fabric folds
const generateDisplacementMap = (): THREE.Texture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Create smooth gradient with fabric-like folds
  const gradient = ctx.createRadialGradient(
    size / 2, size / 3, 0,
    size / 2, size / 2, size
  );
  gradient.addColorStop(0, '#808080');
  gradient.addColorStop(0.3, '#909090');
  gradient.addColorStop(0.6, '#707070');
  gradient.addColorStop(1, '#606060');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add subtle vertical folds
  for (let i = 0; i < 5; i++) {
    const x = (i + 0.5) * (size / 5);
    const grd = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    grd.addColorStop(0, 'rgba(100,100,100,0.3)');
    grd.addColorStop(0.5, 'rgba(160,160,160,0.3)');
    grd.addColorStop(1, 'rgba(100,100,100,0.3)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - 20, 0, 40, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
};

// Generate roughness map for fabric material
const generateRoughnessMap = (): THREE.Texture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Cotton fabric is fairly rough
  ctx.fillStyle = '#b0b0b0'; // ~70% roughness
  ctx.fillRect(0, 0, size, size);

  // Add micro-variation
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const variation = (Math.random() - 0.5) * 30;
    data[i] = data[i + 1] = data[i + 2] = 176 + variation;
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  return new THREE.CanvasTexture(canvas);
};

// Generate AO map for subtle shadows
const generateAOMap = (): THREE.Texture => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Subtle AO around edges and seams
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.2,
    size / 2, size / 2, size * 0.6
  );
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.7, '#f0f0f0');
  gradient.addColorStop(1, '#d0d0d0');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
};

const TShirtModel = ({ 
  shirtColor, 
  designTexture,
  designPosition = { x: 0, y: 0.15, z: 0.52 },
  designScale = 0.4,
  designRotation = 0,
  zone = 'front'
}: TShirtModelProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Generate procedural textures
  const normalMap = useMemo(() => generateFabricNormalMap(), []);
  const displacementMap = useMemo(() => generateDisplacementMap(), []);
  const roughnessMap = useMemo(() => generateRoughnessMap(), []);
  const aoMap = useMemo(() => generateAOMap(), []);

  // Create t-shirt geometry (simplified torso shape)
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    
    // T-shirt silhouette
    shape.moveTo(-0.5, -0.8);
    shape.lineTo(-0.5, 0.3);
    shape.lineTo(-0.8, 0.4); // Left sleeve start
    shape.lineTo(-0.8, 0.6);
    shape.lineTo(-0.5, 0.5);
    shape.lineTo(-0.3, 0.7); // Shoulder
    shape.lineTo(-0.15, 0.75); // Neck left
    shape.bezierCurveTo(-0.1, 0.8, 0.1, 0.8, 0.15, 0.75); // Collar curve
    shape.lineTo(0.3, 0.7); // Neck right
    shape.lineTo(0.5, 0.5);
    shape.lineTo(0.8, 0.6);
    shape.lineTo(0.8, 0.4); // Right sleeve
    shape.lineTo(0.5, 0.3);
    shape.lineTo(0.5, -0.8);
    shape.lineTo(-0.5, -0.8);

    const extrudeSettings = {
      steps: 1,
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.01,
      bevelSegments: 3
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  // Subtle idle animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  // Zone-specific positioning
  const getDecalConfig = () => {
    switch (zone) {
      case 'front':
        return { position: [0, 0.15, 0.06] as [number, number, number], rotation: [0, 0, designRotation] as [number, number, number] };
      case 'back':
        return { position: [0, 0.15, -0.02] as [number, number, number], rotation: [0, Math.PI, designRotation] as [number, number, number] };
      case 'leftSleeve':
        return { position: [-0.65, 0.45, 0.03] as [number, number, number], rotation: [0, 0, designRotation - 0.3] as [number, number, number] };
      case 'rightSleeve':
        return { position: [0.65, 0.45, 0.03] as [number, number, number], rotation: [0, 0, designRotation + 0.3] as [number, number, number] };
      default:
        return { position: [0, 0.15, 0.06] as [number, number, number], rotation: [0, 0, designRotation] as [number, number, number] };
    }
  };

  const decalConfig = getDecalConfig();

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={shirtColor}
        normalMap={normalMap}
        normalScale={new THREE.Vector2(0.3, 0.3)}
        roughnessMap={roughnessMap}
        roughness={0.8}
        aoMap={aoMap}
        aoMapIntensity={0.5}
        envMapIntensity={0.4}
      />
      
      {/* Design decal */}
      {designTexture && (
        <Decal
          position={decalConfig.position}
          rotation={decalConfig.rotation}
          scale={[designScale, designScale, 0.1]}
        >
          <meshStandardMaterial
            map={designTexture}
            transparent
            polygonOffset
            polygonOffsetFactor={-1}
            roughness={0.6}
          />
        </Decal>
      )}
    </mesh>
  );
};

export default TShirtModel;
