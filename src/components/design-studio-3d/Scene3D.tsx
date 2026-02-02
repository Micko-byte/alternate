import { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { 
  Environment, 
  OrbitControls, 
  ContactShadows,
  PerspectiveCamera,
  Lightformer,
  Center
} from '@react-three/drei';
import * as THREE from 'three';
import TShirtModel from './TShirtModel';

interface Scene3DProps {
  shirtColor: string;
  designTexture: THREE.Texture | null;
  designScale?: number;
  designRotation?: number;
  zone?: 'front' | 'back' | 'leftSleeve' | 'rightSleeve';
  autoRotate?: boolean;
}

// Loading fallback
const Loader = () => (
  <mesh>
    <boxGeometry args={[0.5, 0.5, 0.5]} />
    <meshStandardMaterial color="#333" wireframe />
  </mesh>
);

// Studio lighting setup
const StudioLighting = () => (
  <>
    {/* Key light - main illumination */}
    <directionalLight
      position={[5, 5, 5]}
      intensity={1.2}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-far={20}
      shadow-camera-left={-5}
      shadow-camera-right={5}
      shadow-camera-top={5}
      shadow-camera-bottom={-5}
    />
    
    {/* Fill light - soften shadows */}
    <directionalLight
      position={[-5, 3, -5]}
      intensity={0.4}
      color="#b4c7ff"
    />
    
    {/* Rim light - edge definition */}
    <directionalLight
      position={[0, 5, -8]}
      intensity={0.6}
      color="#ffeedd"
    />
    
    {/* Ambient fill */}
    <ambientLight intensity={0.3} />
    
    {/* Subtle point lights for fabric highlights */}
    <pointLight position={[2, 2, 2]} intensity={0.3} color="#ffffff" />
    <pointLight position={[-2, 1, 2]} intensity={0.2} color="#e0e8ff" />
  </>
);

const Scene3D = ({ 
  shirtColor, 
  designTexture,
  designScale = 0.4,
  designRotation = 0,
  zone = 'front',
  autoRotate = false
}: Scene3DProps) => {
  return (
    <div className="w-full h-full min-h-[400px] bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 rounded-xl overflow-hidden">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 2.5]} fov={35} />
        
        <color attach="background" args={['#18181b']} />
        <fog attach="fog" args={['#18181b', 3, 8]} />

        <Suspense fallback={<Loader />}>
          {/* Environment for reflections */}
          <Environment preset="studio" background={false}>
            <Lightformer
              form="rect"
              intensity={2}
              position={[0, 5, -5]}
              scale={[10, 5, 1]}
              color="#ffffff"
            />
            <Lightformer
              form="circle"
              intensity={0.5}
              position={[-5, 2, 0]}
              scale={3}
              color="#b4c7ff"
            />
          </Environment>

          <StudioLighting />

          {/* Main shirt model */}
          <Center>
            <TShirtModel
              shirtColor={shirtColor}
              designTexture={designTexture}
              designScale={designScale}
              designRotation={designRotation}
              zone={zone}
            />
          </Center>

          {/* Ground shadow */}
          <ContactShadows
            position={[0, -1, 0]}
            opacity={0.5}
            scale={3}
            blur={2}
            far={2}
            color="#000000"
          />
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={1.5}
          maxDistance={5}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
};

export default Scene3D;
