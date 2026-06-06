"""Exportador multi-formato headless (Blender 4.2).

Importa um .glb e exporta para o formato pedido, preservando geometria/UV/textura.
Uso:
  blender --background --factory-startup --python export_mesh.py -- <in.glb> <out.ext> <fmt>

fmt: glb | gltf | obj | fbx | stl | ply | usdz | usd
"""
import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst, fmt = argv[0], argv[1], argv[2].lower()

# Cena vazia + importa o GLB.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)

if fmt == "glb":
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB")
elif fmt == "gltf":
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLTF_SEPARATE")
elif fmt == "obj":
    bpy.ops.wm.obj_export(filepath=dst, export_materials=True)
elif fmt == "fbx":
    bpy.ops.export_scene.fbx(filepath=dst, path_mode="COPY", embed_textures=True)
elif fmt == "stl":
    # Blender 4.x: exportador STL nativo (C++). Fallback p/ addon legado.
    try:
        bpy.ops.wm.stl_export(filepath=dst)
    except AttributeError:
        bpy.ops.export_mesh.stl(filepath=dst)
elif fmt == "ply":
    bpy.ops.wm.ply_export(filepath=dst)
elif fmt in ("usdz", "usd", "usda", "usdc"):
    bpy.ops.wm.usd_export(filepath=dst)
else:
    raise SystemExit(f"formato nao suportado: {fmt}")

if not os.path.exists(dst):
    raise SystemExit(f"falha: arquivo de saida nao foi criado: {dst}")
print("EXPORT_OK", dst, os.path.getsize(dst), "bytes", flush=True)
