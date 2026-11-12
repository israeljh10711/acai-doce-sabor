"""
Estúdio de fotografia de comida no Cycles, comum à vitrine (vitrine.py), às miniaturas dos
ingredientes (miniaturas.py) e às fotos de conferência (conferir_render.py).

- Importa os GLB do site sem mudar nada neles: a foto mostra o mesmo modelo da cena 3D.
- Plástico e vidro deixam a luz passar para as sombras (truque padrão de estúdio: sem isso,
  o açaí dentro do copo fica no escuro e a imagem sai granulada).
- Luz principal neutra-quente, preenchimento suave, recorte por trás (desenha a borda do copo) e
  um rebatedor de cima, como em fotografia de produto.

O Cycles roda no processador de propósito: a pré-visualização do EEVEE fecha o Blender neste
computador (falha registrada em 2026-11-12).
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

from comum import MODELS, hex_to_linear


def clear():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def import_glb(file):
    """Importa um GLB e devolve as malhas, sem pais e no lugar em que estavam."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, f"{file}.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for mesh in meshes:
        world = mesh.matrix_world.copy()
        mesh.parent = None
        mesh.matrix_world = world
    for other in new:
        if other.type != "MESH":
            bpy.data.objects.remove(other, do_unlink=True)
    return meshes


def bsdf(material):
    return next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def transmission_of(material):
    node = bsdf(material)
    for key in ("Transmission Weight", "Transmission"):
        if key in node.inputs:
            return node.inputs[key].default_value
    return 0.0


def light_through_glass(obj):
    """Plástico e vidro transparentes para os raios de sombra. Na foto, a superfície fica lisa
    (rugosidade baixa): no Cycles, as duas faces do plástico áspero embaçam o que está dentro."""
    for slot in obj.material_slots:
        mat = slot.material
        if mat is None or transmission_of(mat) <= 0 or mat.get("ads_sombra"):
            continue
        if mat.name.split(".")[0] != "pp":  # o polipropileno é fosco de verdade
            node = bsdf(mat)
            node.inputs["Roughness"].default_value = min(node.inputs["Roughness"].default_value, 0.04)
            # sem a parte difusa: no Cycles, os 8% brancos viram névoa nas duas faces do plástico
            for key in ("Transmission Weight", "Transmission"):
                if key in node.inputs:
                    node.inputs[key].default_value = 1.0
                    break
        tree = mat.node_tree
        output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
        shader = output.inputs["Surface"].links[0].from_socket
        path = tree.nodes.new("ShaderNodeLightPath")
        clear_bsdf = tree.nodes.new("ShaderNodeBsdfTransparent")
        mix = tree.nodes.new("ShaderNodeMixShader")
        tree.links.new(path.outputs["Is Shadow Ray"], mix.inputs["Fac"])
        tree.links.new(shader, mix.inputs[1])
        tree.links.new(clear_bsdf.outputs["BSDF"], mix.inputs[2])
        tree.links.new(mix.outputs["Shader"], output.inputs["Surface"])
        mat["ads_sombra"] = True


def recolor(obj, color):
    """Troca a cor do material (como o site faz nas caldas, no pó e no sabor do milk-shake).
    Se a cor vem de uma textura ou da cor por vértice, multiplica por ela."""
    rgb = (*hex_to_linear(color), 1.0)
    for slot in obj.material_slots:
        mat = slot.material.copy()
        node = bsdf(mat)
        socket = node.inputs["Base Color"]
        if socket.links:
            source = socket.links[0].from_socket
            multiply = mat.node_tree.nodes.new("ShaderNodeMix")
            multiply.data_type = "RGBA"
            multiply.blend_type = "MULTIPLY"
            multiply.inputs["Factor"].default_value = 1.0
            mat.node_tree.links.new(source, multiply.inputs[6])
            multiply.inputs[7].default_value = rgb
            mat.node_tree.links.new(multiply.outputs[2], socket)
        else:
            socket.default_value = rgb
        slot.material = mat


def ground(size=1.2):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size)
    mesh = bpy.data.meshes.new("chao")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("chao", mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.is_shadow_catcher = True
    return obj


def area_light(name, location, power, size, target, color="#ffffff", size_y=None, shadow=True):
    data = bpy.data.lights.new(name, type="AREA")
    data.energy = power
    try:
        data.use_shadow = shadow
    except AttributeError:
        data.cycles.cast_shadow = shadow
    data.color = hex_to_linear(color)
    if size_y is not None:
        data.shape = "RECTANGLE"
        data.size = size
        data.size_y = size_y
    else:
        data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return obj


def studio(target, scale=1.0):
    """Luzes de estúdio em volta de `target`. `scale` acompanha o tamanho do que é fotografado."""
    s = scale
    t = Vector(target)
    area_light("principal", t + Vector((0.34, -0.44, 0.46)) * s, 10 * s * s, 0.26 * s, t, "#fff1e2")
    area_light("preenchimento", t + Vector((-0.55, -0.3, 0.2)) * s, 3 * s * s, 0.6 * s, t, "#f3f1ff",
               shadow=False)
    # recorte: tiras altas atrás, dos dois lados, que desenham a borda do plástico
    area_light("recorte-direita", t + Vector((0.3, 0.42, 0.12)) * s, 7 * s * s, 0.08 * s, t,
               "#ffffff", size_y=0.5 * s, shadow=False)
    area_light("recorte-esquerda", t + Vector((-0.34, 0.38, 0.12)) * s, 5 * s * s, 0.08 * s, t,
               "#ffffff", size_y=0.5 * s, shadow=False)
    area_light("topo", t + Vector((0.0, -0.05, 0.6)) * s, 4 * s * s, 0.5 * s, t, "#ffffff")


def setup_cycles(scene, width, height, samples, background="#d8d4dc", strength=0.03):
    try:
        scene.render.engine = "CYCLES"
    except TypeError as error:
        print("motores disponíveis:", error)
        raise
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 16
    scene.cycles.transmission_bounces = 16
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.glossy_bounces = 6
    scene.cycles.blur_glossy = 1.0
    scene.render.film_transparent = True
    try:
        scene.cycles.film_transparent_glass = True
    except AttributeError:
        pass
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    # Khronos PBR Neutral: feito para foto de produto, mantém a cor (o AgX desbotava o roxo do
    # açaí) e segura o brilho do branco do isopor e do creme. Ambiente escuro de propósito: no
    # reflexo do plástico e do verniz aparecem só as caixas de luz, como em estúdio de verdade.
    for transform in ("Khronos PBR Neutral", "Standard"):
        try:
            scene.view_settings.view_transform = transform
            break
        except TypeError:
            continue
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.35
    world = scene.world or bpy.data.worlds.new("mundo")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    node = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if node is not None:
        node.inputs["Color"].default_value = (*hex_to_linear(background), 1.0)
        node.inputs["Strength"].default_value = strength


def bounds(objects):
    bpy.context.view_layer.update()
    corners = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return lo, hi


def frame_camera(scene, objects, elevation=17.0, azimuth=-24.0, margin=0.06, lens=70, center_z=0.47):
    """Câmera apontada para o centro dos objetos, na menor distância em que todos os cantos
    cabem na imagem com uma borda de `margin` (fração da imagem)."""
    from bpy_extras.object_utils import world_to_camera_view

    lo, hi = bounds(objects)
    center = (lo + hi) / 2
    center.z = lo.z + (hi.z - lo.z) * center_z
    corners = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    data = bpy.data.cameras.new("camera")
    data.lens = lens
    data.clip_start = 0.005
    obj = bpy.data.objects.new("camera", data)
    scene.collection.objects.link(obj)
    scene.camera = obj
    el, az = math.radians(elevation), math.radians(azimuth)
    direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))

    def fits(distance):
        obj.location = center + direction * distance
        obj.rotation_euler = (center - obj.location).to_track_quat("-Z", "Y").to_euler()
        data.clip_end = distance * 4 + 1
        bpy.context.view_layer.update()
        for corner in corners:
            p = world_to_camera_view(scene, obj, corner)
            if p.z <= 0 or not (margin <= p.x <= 1 - margin and margin <= p.y <= 1 - margin):
                return False
        return True

    near, far = 0.01, 50.0
    for _ in range(40):
        mid = (near + far) / 2
        near, far = (near, mid) if fits(mid) else (mid, far)
    fits(far)
    return obj, center


def render(scene, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("imagem:", path)
