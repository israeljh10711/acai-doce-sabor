"""
Imagens de vitrine da página inicial, renderizadas com o Cycles no processador.

Monta cada produto com os mesmos modelos GLB do site e a mesma posição de cada pedaço,
lida de assets/blender/vitrine.json (gravado por exportar-vitrine.mjs a partir do site).
Fundo transparente, com a sombra no chão.

Rodar com o Blender em segundo plano (não toca no Blender aberto):
    blender --background --factory-startup --python-exit-code 1 \
        --python <projeto>/assets/blender/scripts/vitrine.py -- <pasta de saída> [amostras]

O Cycles no processador é usado de propósito: a pré-visualização do EEVEE fecha o Blender
neste computador (falha registrada em 2026-11-12).
"""
import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import MODELS, PROJECT, hex_to_linear  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args else os.path.join(PROJECT, "assets", "blender", "vitrine")
SAMPLES = int(args[1]) if len(args) > 1 else 96
WIDTH, HEIGHT = 1200, 900

# Plástico e vidro: transparência simples, com reflexo. A refração (transmissão) deixava o copo
# leitoso e escondia o açaí escuro. O copo tem parede de verdade (quatro superfícies no caminho
# da luz), então a cor própria do PET e do vidro fica quase preta: sobra só o reflexo, como no
# plástico transparente real. O pote de polipropileno é fosco e claro.
# Valores: (cor própria, opacidade, rugosidade).
GLASS = {"pet": ("#0a0a0a", 0.3, 0.05), "vidro": ("#0c0c0e", 0.32, 0.03), "pp": ("#d9d6d0", 0.3, 0.32)}


def clear():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def import_glb(file):
    """Importa um GLB e devolve o objeto de malha (os modelos têm um só)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f"{file}.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    mesh = next(o for o in new if o.type == "MESH")
    for other in new:
        if other is not mesh:
            bpy.data.objects.remove(other, do_unlink=True)
    mesh.parent = None
    return mesh


def bsdf(material):
    return next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def recolor(obj, color):
    for slot in obj.material_slots:
        mat = slot.material.copy()
        bsdf(mat).inputs["Base Color"].default_value = (*hex_to_linear(color), 1.0)
        slot.material = mat


def make_glass(obj):
    for slot in obj.material_slots:
        name = slot.material.name.split(".")[0]
        if name not in GLASS:
            continue
        color, alpha, roughness = GLASS[name]
        node = bsdf(slot.material)
        node.inputs["Base Color"].default_value = (*hex_to_linear(color), 1.0)
        node.inputs["Alpha"].default_value = alpha
        node.inputs["Roughness"].default_value = roughness
        for key in ("Transmission Weight", "Transmission"):
            if key in node.inputs:
                node.inputs[key].default_value = 0.0
                break


def three_to_blender(position):
    """three.js tem o Y para cima; o Blender, o Z. (x, y, z) -> (x, -z, y)."""
    x, y, z = position
    return Vector((x, -z, y))


def piece_rotation(piece):
    """Mesma rotação da cena do site: inclinação sobre o eixo (ax, 0, az) e giro em volta de Y."""
    ax, az, angle = piece["tilt"]
    axis = Vector((ax, 0.0, az))
    tilt = Quaternion(axis.normalized(), angle) if axis.length > 1e-9 else Quaternion()
    yaw = Quaternion((0.0, 1.0, 0.0), piece["rotationY"])
    q = tilt @ yaw
    # muda a base de Y para cima (three) para Z para cima (Blender)
    return Quaternion((q.w, q.x, -q.z, q.y))


def place(template, piece):
    obj = template.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.location = three_to_blender(piece["position"])
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = piece_rotation(piece)
    obj.scale = (piece["scale"],) * 3
    return obj


def ground():
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.6)
    mesh = bpy.data.meshes.new("chao")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("chao", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.is_shadow_catcher = True
    return obj


def area_light(name, location, power, size, target):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = power
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    direction = Vector(target) - Vector(location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_render(scene):
    try:
        scene.render.engine = "CYCLES"
    except TypeError as error:
        print("motores disponíveis:", error)
        raise
    scene.cycles.device = "CPU"
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # "Standard": as cores saem como foram definidas (o AgX desbotava o roxo e o vermelho)
    try:
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
        scene.view_settings.exposure = -0.15
    except TypeError:
        pass
    world = scene.world or bpy.data.worlds.new("mundo")
    scene.world = world
    world.color = hex_to_linear("#f7eddd")
    try:
        world.use_nodes = True
    except Exception:
        pass
    background = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if background is not None:
        background.inputs["Color"].default_value = (*hex_to_linear("#f7eddd"), 1.0)
        background.inputs["Strength"].default_value = 0.55


def frame_camera(scene, objects, elevation=17.0, azimuth=-24.0, margin=0.98):
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    center = (lo + hi) / 2
    center.z = (lo.z + hi.z) * 0.47
    radius = (hi - lo).length / 2

    data = bpy.data.cameras.new("camera")
    data.lens = 70
    obj = bpy.data.objects.new("camera", data)
    scene.collection.objects.link(obj)
    fov = 2 * math.atan(data.sensor_width / (2 * data.lens)) * min(1.0, HEIGHT / WIDTH)
    distance = radius * margin / math.sin(fov / 2)
    el, az = math.radians(elevation), math.radians(azimuth)
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
    obj.location = center + direction * distance
    obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
    data.clip_start = 0.01
    data.clip_end = distance * 4
    scene.camera = obj


def render(slug, entry):
    clear()
    scene = bpy.context.scene
    setup_render(scene)
    layout = entry["layout"]

    container = import_glb(layout["containerFile"])
    make_glass(container)
    objects = [container]
    if layout["baseFile"]:
        base = import_glb(layout["baseFile"])
        if layout.get("baseColor"):
            recolor(base, layout["baseColor"])
        objects.append(base)

    for topping in layout["toppings"]:
        template = import_glb(topping["file"])
        if topping.get("color"):
            recolor(template, topping["color"])
        for piece in topping["pieces"]:
            objects.append(place(template, piece))
        bpy.data.objects.remove(template, do_unlink=True)

    ground()
    target = (0.0, 0.0, layout["dome"]["top"] * 0.6)
    area_light("principal", (0.32, -0.42, 0.5), 22, 0.35, target)
    area_light("preenchimento", (-0.5, -0.25, 0.25), 7, 0.5, target)
    area_light("contorno", (-0.1, 0.5, 0.42), 14, 0.3, target)
    frame_camera(scene, objects)

    os.makedirs(OUT, exist_ok=True)
    scene.render.filepath = os.path.join(OUT, f"{slug}.png")
    bpy.ops.render.render(write_still=True)
    print("imagem:", scene.render.filepath)


with open(os.path.join(PROJECT, "assets", "blender", "vitrine.json"), encoding="utf-8") as file:
    vitrine = json.load(file)

only = args[2].split(",") if len(args) > 2 else list(vitrine)
for slug in only:
    render(slug, vitrine[slug])
