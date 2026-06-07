"""Limpeza / otimização de malha headless (Blender 4.2).

Importa um .glb, aplica operações de correção/otimização e re-exporta .glb
(preservando a textura quando possível).

Uso:
  blender --background --factory-startup --python process_mesh.py -- <in.glb> <out.glb> <op> [target_faces]

op:
  cleanup  -> merge by distance + apaga geometria solta + recalcula normais + fecha buracos
  decimate -> cleanup + reduz a contagem de faces para ~target_faces (collapse, preserva UV)
  remesh   -> topologia limpa watertight (voxel remesh) + UV novo + bake da textura (EMIT)
  texfix   -> ajuste automático da textura (white-balance + níveis + saturação), sem mexer na malha
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


def _texture_images():
    """Imagens ligadas ao Base Color dos materiais (a textura albedo da malha)."""
    imgs = []
    seen = set()
    for o in meshes:
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not bsdf:
                continue
            bc = bsdf.inputs["Base Color"]
            if bc.is_linked:
                node = bc.links[0].from_node
                if node.type == "TEX_IMAGE" and node.image and node.image.name not in seen:
                    seen.add(node.image.name)
                    imgs.append(node.image)
    return imgs


def _auto_adjust_image(img, levels=0.6, sat=1.12):
    """Ajuste automático no albedo, **preservando a matiz** (sem white-balance, que
    estraga objetos de cor forte legítima — ex.: um cogumelo vermelho viraria ciano).

    - Níveis: estica a LUMINÂNCIA entre percentis robustos e reescala o RGB pelo
      mesmo fator (razão de luminância) → muda só brilho/contraste, nunca a cor.
    - Saturação: realce suave em torno da luminância.
    Conservador (mistura parcial). Ignora o padding escuro do atlas nas estatísticas.
    Devolve (rgb_antes, rgb_depois) para log."""
    import numpy as np

    n = len(img.pixels)
    if n == 0:
        return None, None
    buf = np.empty(n, dtype=np.float32)
    img.pixels.foreach_get(buf)
    a = buf.reshape(-1, 4)
    rgb = a[:, :3].astype(np.float32)
    coef = np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lum = rgb @ coef
    mask = lum > 0.02  # exclui padding preto do atlas nas estatísticas
    if mask.sum() < 16:
        mask = np.ones(len(rgb), dtype=bool)
    before = rgb[mask].mean(axis=0) * 255.0

    # 1) níveis por razão de luminância (preserva matiz/croma)
    lo, hi = np.percentile(lum[mask], 2.0), np.percentile(lum[mask], 98.0)
    if hi - lo > 1e-3:
        lum_s = np.clip((lum - lo) / (hi - lo), 0.0, 1.0)
        lum_t = lum * (1.0 - levels) + lum_s * levels
        ratio = (lum_t / (lum + 1e-6))[:, None]
        rgb = np.clip(rgb * ratio, 0.0, 1.0)

    # 2) saturação suave (em torno da nova luminância)
    l2 = (rgb @ coef)[:, None]
    rgb = np.clip(l2 + (rgb - l2) * sat, 0.0, 1.0)

    after = rgb[mask].mean(axis=0) * 255.0
    a[:, :3] = rgb
    img.pixels.foreach_set(a.reshape(-1))
    img.update()
    try:
        img.pack()
    except Exception:  # noqa: BLE001
        pass
    return before, after


if op == "texfix":
    imgs = _texture_images()
    if not imgs:
        print("PROCESS_WARN texfix: malha sem textura albedo — re-exportando sem mudanças", flush=True)
    for img in imgs:
        b, a = _auto_adjust_image(img)
        if b is not None:
            print(f"texfix {img.name}: RGB {b.round(1)} -> {a.round(1)} ({img.size[0]}x{img.size[1]})", flush=True)
    bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB")
    print(f"PROCESS_OK {dst} texfix images={len(imgs)}", flush=True)
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
