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


def export_glb(obj, path):
    """Exporta só o objeto, com a origem no lugar. Mesmo jeito validado em 2026-11-11."""
    view_layer = bpy.context.view_layer
    saved = obj.location.copy()
    obj.location = (0.0, 0.0, 0.0)
    for other in view_layer.objects:
        if other.select_get():
            other.select_set(False)
    obj.select_set(True)
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
    )
    obj.select_set(False)
    obj.location = saved


def save_copy(path):
    """Grava uma cópia editável. A sessão aberta continua apontando para o arquivo dela."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=path, copy=True, compress=True)
    return path
