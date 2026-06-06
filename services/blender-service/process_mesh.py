"""Limpeza / otimização de malha headless (Blender 4.2).

Importa um .glb, aplica operações de correção/otimização e re-exporta .glb
(preservando a textura quando possível).

Uso:
  blender --background --factory-startup --python process_mesh.py -- <in.glb> <out.glb> <op> [target_faces]

op:
  cleanup  -> merge by distance + apaga geometria solta + recalcula normais + fecha buracos
  decimate -> cleanup + reduz a contagem de faces para ~target_faces (collapse, preserva UV)
"""
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
src, dst, op = argv[0], argv[1], argv[2].lower()
target_faces = int(argv[3]) if len(argv) > 3 else 20000

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("nenhuma malha importada")


def cleanup(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.0001)  # solda vértices coincidentes
    bpy.ops.mesh.delete_loose()  # remove vértices/arestas soltos
    bpy.ops.mesh.normals_make_consistent(inside=False)  # normais p/ fora
    bpy.ops.mesh.fill_holes(sides=0)  # fecha buracos pequenos
    bpy.ops.object.mode_set(mode="OBJECT")


total_before = 0
total_after = 0
for obj in meshes:
    total_before += len(obj.data.polygons)
    cleanup(obj)
    if op == "decimate":
        faces = len(obj.data.polygons)
        ratio = min(1.0, max(0.02, target_faces / max(1, faces)))
        if ratio < 0.999:
            m = obj.modifiers.new("decimate", "DECIMATE")
            m.ratio = ratio
            m.use_collapse_triangulate = True
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=m.name)
    total_after += len(obj.data.polygons)

bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB")
print(f"PROCESS_OK {dst} faces {total_before}->{total_after}", flush=True)
