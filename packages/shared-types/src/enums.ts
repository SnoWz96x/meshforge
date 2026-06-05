// Enums compartilhados — espelham o schema Prisma, mas vivem aqui para
// que frontend e workers Python (via geração de schema) não dependam do DB.

export const GpuBackend = {
  ZLUDA: "ZLUDA",
  ROCM: "ROCM",
  CUDA: "CUDA",
  DIRECTML: "DIRECTML",
} as const;
export type GpuBackend = (typeof GpuBackend)[keyof typeof GpuBackend];

export const GenerationType = {
  TEXT_TO_IMAGE: "TEXT_TO_IMAGE",
  IMAGE_TO_IMAGE: "IMAGE_TO_IMAGE",
  IMAGE_TO_3D: "IMAGE_TO_3D",
  TEXT_TO_3D: "TEXT_TO_3D",
  FULL_PIPELINE: "FULL_PIPELINE",
} as const;
export type GenerationType = (typeof GenerationType)[keyof typeof GenerationType];

export const JobStage = {
  SDXL_TXT2IMG: "SDXL_TXT2IMG",
  SDXL_IMG2IMG: "SDXL_IMG2IMG",
  COMFYUI_WORKFLOW: "COMFYUI_WORKFLOW",
  // Pipeline encadeado: SDXL txt2img -> Hunyuan3D shape (uma geração só).
  TEXT_TO_3D: "TEXT_TO_3D",
  HUNYUAN3D_SHAPE: "HUNYUAN3D_SHAPE",
  HUNYUAN3D_TEXTURE: "HUNYUAN3D_TEXTURE",
  BLENDER_CLEANUP: "BLENDER_CLEANUP",
  BLENDER_RETOPO: "BLENDER_RETOPO",
  BLENDER_UV: "BLENDER_UV",
  BLENDER_BAKE: "BLENDER_BAKE",
  BLENDER_TEXTURE_FIX: "BLENDER_TEXTURE_FIX",
  PREVIEW_RENDER: "PREVIEW_RENDER",
  EXPORT: "EXPORT",
} as const;
export type JobStage = (typeof JobStage)[keyof typeof JobStage];

export const JobStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const AssetKind = {
  IMAGE: "IMAGE",
  MESH_RAW: "MESH_RAW",
  MESH_RETOPO: "MESH_RETOPO",
  TEXTURE: "TEXTURE",
  PREVIEW: "PREVIEW",
  EXPORT: "EXPORT",
} as const;
export type AssetKind = (typeof AssetKind)[keyof typeof AssetKind];

export const ExportFormat = {
  GLB: "glb",
  GLTF: "gltf",
  OBJ: "obj",
  FBX: "fbx",
  STL: "stl",
  USDZ: "usdz",
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ALL_EXPORT_FORMATS: ExportFormat[] = Object.values(ExportFormat);
