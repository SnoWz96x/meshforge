"""Limpeza / otimização de malha headless (Blender 4.2).

Importa um .glb, aplica operações de correção/otimização e re-exporta .glb
(preservando a textura quando possível).

Uso:
  blender --background --factory-startup --python process_mesh.py -- <in.glb> <out.glb> <op> [target_faces]

op:
  cleanup  -> merge by distance + apaga geometria solta + recalcula normais + fecha buracos
  decimate -> cleanup + reduz a contagem de faces para ~target_faces (collapse, preserva UV)
  remesh   -> topologia limpa watertight (voxel remesh) + UV novo + bake da textura (EMIT)
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


def remesh_rebake(faces_target, tex=1024):
    """Voxel remesh (topologia limpa) + Smart UV + bake da textura (EMIT)."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    source = bpy.context.view_layer.objects.active

    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    bpy.context.view_layer.objects.active = source
    bpy.ops.object.duplicate()
    target = bpy.context.view_layer.objects.active

    # resolução do voxel a partir do "alvo de faces" (heurística)
    res = min(320, max(60, int((faces_target / 200) ** 0.5 * 14)))
    target.data.remesh_voxel_size = max(0.001, max(target.dimensions) / res)
    target.data.remesh_voxel_adaptivity = 0.0
    target.data.use_remesh_fix_poles = True
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.voxel_remesh()

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003)
    bpy.ops.object.mode_set(mode="OBJECT")

    img = bpy.data.images.new("baked", tex, tex)
    mat = bpy.data.materials.new("remesh_mat")
    mat.use_nodes = True
    tex_node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex_node.image = img
    mat.node_tree.nodes.active = tex_node
    target.data.materials.clear()
    target.data.materials.append(mat)

    # SOURCE emissivo (transfere o albedo de forma confiável no bake EMIT)
    for slot in source.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if not out:
            continue
        emis = nt.nodes.new("ShaderNodeEmission")
        bc = bsdf.inputs["Base Color"] if bsdf else None
        if bc is not None and bc.is_linked:
            nt.links.new(bc.links[0].from_socket, emis.inputs["Color"])
        elif bc is not None:
            emis.inputs["Color"].default_value = bc.default_value
        nt.links.new(emis.outputs["Emission"], out.inputs["Surface"])

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 1
    sc.render.bake.use_selected_to_active = True
    sc.render.bake.cage_extrusion = 0.1
    sc.render.bake.max_ray_distance = 0.0
    bpy.ops.object.select_all(action="DESELECT")
    source.select_set(True)
    target.select_set(True)
    bpy.context.view_layer.objects.active = target
    try:
        bpy.ops.object.bake(type="EMIT")
        img.pack()
        bsdf_t = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf_t:
            mat.node_tree.links.new(tex_node.outputs["Color"], bsdf_t.inputs["Base Color"])
    except Exception as e:  # noqa: BLE001
        print("bake falhou:", repr(e)[:160], flush=True)

    bpy.ops.object.select_all(action="DESELECT")
    target.select_set(True)
    bpy.data.objects.remove(source, do_unlink=True)
    return len(target.data.polygons)


if op == "remesh":
    n = remesh_rebake(target_faces)
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", use_selection=True)
    print(f"PROCESS_OK {dst} remesh faces={n}", flush=True)
    raise SystemExit(0)


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
