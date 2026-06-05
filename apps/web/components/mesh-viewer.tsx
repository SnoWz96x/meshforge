"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, useGLTF, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  Maximize2,
  Minimize2,
  RotateCcw,
  Grid3x3,
  Box as BoxIcon,
  Palette,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MaterialMode = "studio" | "normal" | "clay";
const MATERIAL_LABEL: Record<MaterialMode, string> = {
  studio: "Studio",
  normal: "Normais",
  clay: "Argila",
};

function makeMaterial(mode: MaterialMode, wireframe: boolean): THREE.Material {
  if (mode === "normal") return new THREE.MeshNormalMaterial({ wireframe });
  if (mode === "clay")
    return new THREE.MeshStandardMaterial({
      color: "#d9c3a5",
      roughness: 0.9,
      metalness: 0,
      wireframe,
    });
  return new THREE.MeshStandardMaterial({
    color: "#c6c8d2",
    roughness: 0.62,
    metalness: 0.05,
    wireframe,
  });
}

interface Stats {
  vertices: number;
  faces: number;
}

function Model({
  url,
  material,
  wireframe,
  onStats,
}: {
  url: string;
  material: MaterialMode;
  wireframe: boolean;
  onStats: (s: Stats) => void;
}) {
  const { scene } = useGLTF(url);

  useEffect(() => {
    let vertices = 0;
    let faces = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        const pos = m.geometry.attributes.position?.count ?? 0;
        vertices += pos;
        faces += m.geometry.index ? m.geometry.index.count / 3 : pos / 3;
      }
    });
    onStats({ vertices, faces: Math.round(faces) });
  }, [scene, onStats]);

  useMemo(() => {
    const mat = makeMaterial(material, wireframe);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = mat;
    });
  }, [scene, material, wireframe]);

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

export function MeshViewer({ url }: { url: string }) {
  const [material, setMaterial] = useState<MaterialMode>("studio");
  const [wireframe, setWireframe] = useState(false);
  const [grid, setGrid] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [fs, setFs] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<{ reset?: () => void } | null>(null);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  return (
    <div ref={containerRef} className="absolute inset-0 bg-base">
      <Canvas camera={{ position: [1.8, 1.3, 2.2], fov: 42 }} dpr={[1, 2]}>
        <color attach="background" args={["#0a0b0e"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 2]} intensity={1.3} />
        <directionalLight position={[-3, -1, -2]} intensity={0.45} />
        <Suspense fallback={null}>
          <Model url={url} material={material} wireframe={wireframe} onStats={setStats} />
        </Suspense>
        {grid && (
          <Grid
            infiniteGrid
            cellSize={0.2}
            sectionSize={1}
            fadeDistance={16}
            sectionColor="#2e3038"
            cellColor="#1a1c22"
            position={[0, -1, 0]}
          />
        )}
        <OrbitControls
          ref={controlsRef as never}
          enablePan={false}
          autoRotate
          autoRotateSpeed={1.1}
          minDistance={0.6}
          maxDistance={9}
          makeDefault
        />
      </Canvas>

      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-surface-overlay/90 p-1 backdrop-blur">
        <ToolBtn
          onClick={() =>
            setMaterial((m) => (m === "studio" ? "normal" : m === "normal" ? "clay" : "studio"))
          }
          title={`Material: ${MATERIAL_LABEL[material]}`}
        >
          <Palette size={15} />
        </ToolBtn>
        <ToolBtn active={wireframe} onClick={() => setWireframe((w) => !w)} title="Wireframe">
          <Layers size={15} />
        </ToolBtn>
        <ToolBtn active={grid} onClick={() => setGrid((g) => !g)} title="Grade">
          <Grid3x3 size={15} />
        </ToolBtn>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <ToolBtn onClick={() => controlsRef.current?.reset?.()} title="Resetar câmera">
          <RotateCcw size={15} />
        </ToolBtn>
        <ToolBtn active={fs} onClick={toggleFullscreen} title="Tela cheia">
          {fs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </ToolBtn>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-md border border-border bg-surface-overlay/80 px-2.5 py-1.5 font-mono text-[10px] text-content-muted backdrop-blur">
        <BoxIcon size={12} className="text-accent" />
        <span>
          <b className="text-content-secondary">
            {stats ? stats.vertices.toLocaleString("pt-BR") : "—"}
          </b>{" "}
          verts
        </span>
        <span>
          <b className="text-content-secondary">
            {stats ? stats.faces.toLocaleString("pt-BR") : "—"}
          </b>{" "}
          faces
        </span>
        <span>
          {MATERIAL_LABEL[material]}
          {wireframe ? " · wire" : ""}
        </span>
      </div>
    </div>
  );
}

function ToolBtn({
  active = false,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-sm transition-colors",
        active
          ? "bg-accent-soft text-accent"
          : "text-content-secondary hover:bg-surface-2 hover:text-content",
      )}
    >
      {children}
    </button>
  );
}
