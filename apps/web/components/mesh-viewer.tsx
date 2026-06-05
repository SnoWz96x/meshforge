"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  // Material limpo "studio" — a malha do Hunyuan3D (shape) vem sem textura.
  useMemo(() => {
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = new THREE.MeshStandardMaterial({
          color: "#c6c8d2",
          roughness: 0.62,
          metalness: 0.05,
          flatShading: false,
        });
      }
    });
  }, [scene]);
  return <primitive object={scene} />;
}

export function MeshViewer({ url }: { url: string }) {
  useEffect(() => () => useGLTF.clear(url), [url]);
  return (
    <Canvas camera={{ position: [1.6, 1.1, 1.9], fov: 42 }} dpr={[1, 2]} className="!absolute inset-0">
      <color attach="background" args={["#0a0b0e"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 4, 2]} intensity={1.3} />
      <directionalLight position={[-3, -1, -2]} intensity={0.45} />
      <Suspense fallback={null}>
        <Center>
          <Model url={url} />
        </Center>
      </Suspense>
      <OrbitControls
        autoRotate
        autoRotateSpeed={1.4}
        enablePan={false}
        minDistance={1}
        maxDistance={6}
        makeDefault
      />
    </Canvas>
  );
}
