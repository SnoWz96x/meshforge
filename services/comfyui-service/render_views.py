"""Renderiza 4 vistas canônicas (front/right/back/left) de um .glb via Blender headless.

Uso (validação multi-imagem→3D): produz PNGs 512² com fundo branco, objeto
centrado e normalizado, câmera perspectiva fixa. Saída: <out_dir>/{front,right,back,left}.png

  blender --background --factory-startup --python render_views.py -- <src.glb> <out_dir> [size]
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out_dir = argv[0], argv[1]
size = int(argv[2]) if len(argv) > 2 else 512
os.makedirs(out_dir, exist_ok=True)

# cena limpa
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
    for d in list(blk):
        blk.remove(d)

bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("sem malha no glb")

# junta tudo num objeto
bpy.ops.object.select_all(action="DESELECT")
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

# centraliza na origem e normaliza para caber em cubo unitário
bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
obj.location = (0, 0, 0)
dims = obj.dimensions
scale = 1.0 / max(dims.x, dims.y, dims.z)
obj.scale = (scale, scale, scale)
bpy.context.view_layer.update()

# mundo branco brilhante (fundo branco + luz de preenchimento uniforme)
world = bpy.data.worlds.new("w") if not bpy.data.worlds else bpy.data.worlds[0]
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

# luz solar para dar forma/sombreamento ao objeto
sun_data = bpy.data.lights.new("sun", type="SUN")
sun_data.energy = 2.5
sun = bpy.data.objects.new("sun", sun_data)
bpy.context.scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(45), math.radians(20), math.radians(30))

# render EEVEE (GPU OpenGL, sem ZLUDA): usa o mundo branco como fundo + luz
scn = bpy.context.scene
scn.render.engine = "BLENDER_EEVEE_NEXT"
scn.render.film_transparent = False
scn.view_settings.view_transform = "Standard"
scn.render.resolution_x = size
scn.render.resolution_y = size
scn.render.image_settings.file_format = "PNG"

# câmera perspectiva
cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 50
cam = bpy.data.objects.new("cam", cam_data)
scn.collection.objects.link(cam)
scn.camera = cam
dist = 2.4

# azimutes: front=-Y, right=+X, back=+Y, left=-X ; leve elevação
views = {
    "front": (0.0, -dist, 0.0),
    "right": (dist, 0.0, 0.0),
    "back": (0.0, dist, 0.0),
    "left": (-dist, 0.0, 0.0),
}
elev = dist * 0.15
for name, (x, y, z) in views.items():
    cam.location = (x, y, z + elev)
    direction = Vector((0, 0, 0)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scn.render.filepath = os.path.join(out_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[render] {name}.png")

print("[render] OK")
