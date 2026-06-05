"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Center, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Box } from "lucide-react";

function ThumbModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  useMemo(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh)
        m.material = new THREE.MeshStandardMaterial({
          color: "#c6c8d2",
          roughness: 0.6,
          metalness: 0.05,
        });
    });
  }, [scene]);
  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

// Thumbnail 3D leve: só monta o canvas quando entra na viewport (IntersectionObserver),
// e renderiza sob demanda (frameloop demand) — econômico para grids.
export function MeshThumb({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: "150px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {visible ? (
        <Canvas camera={{ position: [1.7, 1.2, 2.1], fov: 42 }} dpr={[1, 1.5]}>
          <color attach="background" args={["#121318"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 4, 2]} intensity={1.2} />
          <Suspense fallback={null}>
            <ThumbModel url={url} />
          </Suspense>
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={2.2}
            makeDefault
          />
        </Canvas>
      ) : (
        <div className="grid h-full w-full place-items-center">
          <Box size={22} className="text-content-muted" />
        </div>
      )}
    </div>
  );
}
