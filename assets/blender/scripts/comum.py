"""
Funções comuns aos scripts de modelagem do Açaí Doce Sabor: materiais, geometria girada,
monte de açaí, coleção e exportação GLB. Importado por recipientes.py e ingredientes.py.
"""
import json
import math
import os

import bmesh
import bpy

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MEDIDAS = os.path.join(PROJECT, "src", "features", "configurator-3d", "medidas.json")
MODELS = os.path.join(PROJECT, "public", "models")


def load_medidas():
    with open(MEDIDAS, encoding="utf-8") as file:
        return json.load(file)


# ---------------------------------------------------------------- materiais

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(value):
    value = value.lstrip("#")
    return tuple(srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(name, color, roughness, alpha=1.0, coat=0.0):
    """Material Principled BSDF compatível com glTF. Reaproveita o existente pelo nome."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = hex_to_linear(color)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if alpha < 1.0:
        try:
            mat.surface_render_method = "BLENDED"
        except Exception:
            try:
                mat.blend_method = "BLEND"
            except Exception:
                pass
    mat.diffuse_color = (*rgb, alpha)
    return mat


TEXTURES = os.path.join(PROJECT, "assets", "blender", "texturas")


def image(name, non_color=False):
    """Textura gerada por texturas.py. Cor em sRGB; relevo como dado bruto (Non-Color)."""
    img = bpy.data.images.load(os.path.join(TEXTURES, f"{name}.png"), check_existing=True)
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    return img


def pbr(name, color="#ffffff", roughness=0.5, *, base_map=None, normal_map=None, normal_strength=1.0,
        transmission=0.0, ior=1.5, coat=0.0, coat_roughness=0.05, vertex_color=False, metallic=0.0):
    """Material físico (Principled BSDF) que o exportador glTF entende por inteiro:
    cor ou textura de cor ou cor por vértice, rugosidade, mapa de relevo, transmissão (vidro e
    plástico), índice de refração e verniz (clearcoat). Recria os nós a cada chamada."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for node in [n for n in nodes if n.type not in ("BSDF_PRINCIPLED", "OUTPUT_MATERIAL")]:
        nodes.remove(node)
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    rgb = hex_to_linear(color)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = 1.0
    bsdf.inputs["IOR"].default_value = ior
    for key in ("Transmission Weight", "Transmission"):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = transmission
            break
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = coat_roughness
    if base_map:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image(base_map)
        tex.location = (-520, 260)
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    elif vertex_color:
        attr = nodes.new("ShaderNodeVertexColor")
        attr.layer_name = "Color"
        attr.location = (-520, 260)
        links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    if normal_map:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image(normal_map, non_color=True)
        tex.location = (-720, -260)
        normal = nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = normal_strength
        normal.location = (-360, -260)
        links.new(tex.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    try:
        mat.surface_render_method = "DITHERED"
    except Exception:
        pass
    mat.diffuse_color = (*rgb, 1.0)
    return mat


def color_layer(bm):
    """Camada de cor por vértice (por canto de face), chamada "Color" como o material espera."""
    # cor em ponto flutuante: guarda os valores lineares como estão (a de 8 bits espera sRGB)
    layers = bm.loops.layers.float_color
    return layers.get("Color") or layers.new("Color")


def lathe_uv(name, profile, segments, uv_of, material_of=None, displace=None, smooth=True,
             sharp_angle=35.0, color_of=None):
    """Como `lathe`, com coordenadas de textura e, se pedido, material e cor por face.

    - `uv_of(k, frac, co)`: (u, v) de cada canto. `k` é o anel de baixo da face (decide a região),
      `frac` vai de 0 a 1 na volta (sem emenda: a última face usa 1, não 0), `co` é a posição.
    - `material_of(k)`: índice do material das faces entre os anéis k e k + 1.
    - `color_of(co)`: cor linear (r, g, b) de cada canto.
    """
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    colors = color_layer(bm) if color_of else None
    rings = []
    for radius, z in profile:
        if radius <= 1e-7:
            rings.append([bm.verts.new((0.0, 0.0, z))] * segments)
        else:
            rings.append([
                bm.verts.new((radius * math.cos(2 * math.pi * i / segments),
                              radius * math.sin(2 * math.pi * i / segments), z))
                for i in range(segments)
            ])
    if displace:
        for vert in bm.verts:
            displace(vert)
    for k in range(len(rings) - 1):
        lower, upper = rings[k], rings[k + 1]
        for i in range(segments):
            j = (i + 1) % segments
            corners = []
            for vert, step in ((lower[i], i), (lower[j], i + 1), (upper[j], i + 1), (upper[i], i)):
                if all(vert is not c[0] for c in corners):
                    corners.append((vert, step))
            if len(corners) < 3:
                continue
            face = bm.faces.new([c[0] for c in corners])
            for loop, (vert, step) in zip(face.loops, corners):
                loop[uv_layer].uv = uv_of(k, step / segments, vert.co)
                if colors is not None:
                    loop[colors] = (*color_of(vert.co), 1.0)
            if material_of:
                face.material_index = material_of(k)
    return finish(bm, name, smooth, sharp_angle)


def cylinder_uv(repeats, tile_height):
    """Volta inteira = `repeats` ladrilhos; altura em ladrilhos de `tile_height` metros."""
    return lambda k, frac, co: (frac * repeats, co.z / tile_height)


def planar_uv(tile):
    """Projeção de cima, em ladrilhos de `tile` metros."""
    return lambda k, frac, co: (co.x / tile + 0.5, co.y / tile + 0.5)


# ---------------------------------------------------------------- geometria

def finish(bm, name, smooth=True, sharp_angle=35.0):
    """Normais para fora, sombreamento suave com quinas marcadas, e vira um objeto."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        face.smooth = smooth
    limit = math.radians(sharp_angle)
    for edge in bm.edges:
        if len(edge.link_faces) == 2 and edge.calc_face_angle(0.0) > limit:
            edge.smooth = False
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return bpy.data.objects.new(name, mesh)


def lathe_bmesh(profile, segments, bm=None):
    """Gira um perfil (raio, altura) em volta do eixo Z. Começando e terminando no eixo,
    a malha sai fechada. Devolve o bmesh e os anéis de vértices."""
    bm = bm or bmesh.new()
    rings = []
    for radius, z in profile:
        if radius <= 1e-7:
            rings.append([bm.verts.new((0.0, 0.0, z))] * segments)
        else:
            rings.append([
                bm.verts.new((radius * math.cos(2 * math.pi * i / segments),
                              radius * math.sin(2 * math.pi * i / segments), z))
                for i in range(segments)
            ])
    for lower, upper in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            quad = []
            for vert in (lower[i], lower[j], upper[j], upper[i]):
                if vert not in quad:
                    quad.append(vert)
            if len(quad) >= 3:
                bm.faces.new(quad)
    return bm, rings


def lathe(name, profile, segments, smooth=True, sharp_angle=35.0, displace=None):
    bm, _ = lathe_bmesh(profile, segments)
    if displace:
        for vert in bm.verts:
            displace(vert)
    return finish(bm, name, smooth, sharp_angle)


def dome_height(rho, monte, expoente):
    """Altura do monte (superelipse) na distância `rho` do centro, com raio 1 e altura `monte`.
    A mesma fórmula está em src/features/configurator-3d/dome.ts."""
    rho = min(max(rho, 0.0), 1.0)
    e = 2.0 / expoente
    cos_t = rho ** (1.0 / e)
    sin_t = math.sqrt(max(0.0, 1.0 - cos_t * cos_t))
    return monte * sin_t ** e


# ---------------------------------------------------------------- coleção e exportação

def collection(name):
    """Coleção própria na cena aberta. Não troca a cena da janela do usuário."""
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    scene = bpy.context.scene
    if coll.name not in scene.collection.children:
        scene.collection.children.link(coll)
    return coll


def remove_object(name):
    obj = bpy.data.objects.get(name)
    if obj is not None:
        mesh = obj.data
        bpy.data.objects.remove(obj, do_unlink=True)
        if mesh is not None and mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def export_glb(obj, path, extra=()):
    """Exporta o objeto (e os `extra`, que ficam onde estão em relação a ele), com a origem no
    lugar. Texturas vão dentro do GLB em WebP; cor por vértice só quando o material usa."""
    view_layer = bpy.context.view_layer
    saved = obj.location.copy()
    shift = -obj.location
    obj.location = (0.0, 0.0, 0.0)
    for other in extra:
        other.location += shift
    for other in view_layer.objects:
        if other.select_get():
            other.select_set(False)
    for item in (obj, *extra):
        item.select_set(True)
    view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_yup=True,
        export_image_format="WEBP",
        export_image_quality=80,
        export_vertex_color="MATERIAL",
        # Draco: geometria cerca de 10 vezes menor. O site decodifica com os arquivos de
        # public/draco/ (copiados de three/examples/jsm/libs/draco/gltf, licença Apache-2.0).
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
    )
    for item in (obj, *extra):
        item.select_set(False)
    obj.location = saved
    for other in extra:
        other.location -= shift


def save_copy(path):
    """Grava uma cópia editável. A sessão aberta continua apontando para o arquivo dela."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True, compress=True)
    return path
