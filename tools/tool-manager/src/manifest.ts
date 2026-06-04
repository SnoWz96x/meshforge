import type { ToolManifest } from "@meshforge/shared-types";

// ------------------------------------------------------------
// Manifesto oficial das ferramentas externas do MeshForge.
//
// - git:     clonadas e fixadas em um commit. Se pinnedCommit === "",
//            o tool-manager pina o HEAD de trackRef na primeira instalação.
// - release: binários baixados de uma URL (Blender, Instant Meshes).
//
// Para AMD/Windows usamos o ComfyUI canônico + patch ZLUDA no bootstrap.
// (Alternativa: fork patientx/ComfyUI-Zluda — trocar o repo abaixo.)
// ------------------------------------------------------------
export const DEFAULT_MANIFEST: ToolManifest = {
  comfyui: {
    type: "git",
    repo: "https://github.com/comfyanonymous/ComfyUI.git",
    pinnedCommit: "",
    trackRef: "master",
  },
  hunyuan3d: {
    type: "git",
    repo: "https://github.com/Tencent/Hunyuan3D-2.git",
    pinnedCommit: "",
    trackRef: "main",
  },
  blender: {
    type: "release",
    version: "4.2.3",
    url: "https://download.blender.org/release/Blender4.2/blender-4.2.3-windows-x64.zip",
    githubRepo: "blender/blender",
  },
  // instant-meshes: adicionado na Fase 4 (retopologia). Os binários não são
  // release assets do GitHub; URL será resolvida/verificada quando integrarmos.
};
