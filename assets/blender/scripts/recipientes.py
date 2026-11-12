"""
Recipientes e bases do Açaí Doce Sabor, gerados a partir de src/features/configurator-3d/medidas.json.

Cria, numa coleção própria ("ADS Recipientes") da cena aberta:
  - container-<tamanho>       pote, copo e isopor de açaí; copo de vidro facetado de milk-shake
  - base-acai-<tamanho>       açaí preenchendo o recipiente, com o monte acima da borda
  - base-shake-<tamanho>      milk-shake preenchendo o copo, com a espuma
Exporta um GLB por objeto em public/models/ e grava uma cópia editável em assets/blender/recipientes.blend.

Rodar no Blender 5.3 (pelo MCP ou pelo editor de texto):
    path = r"<projeto>/assets/blender/scripts/recipientes.py"
    exec(compile(open(path, encoding="utf-8").read(), path, "exec"), {"__name__": "__main__", "__file__": path})

Pelo MCP, prefira rodar em lotes (cada chamada precisa terminar rápido):
    ns = {"__name__": "recipientes", "__file__": path}; exec(compile(...), ns)
    ns["build_entries"](["pote-150", "pote-200"]); ns["save_blend"]()

Escala real em metros, origem na base do recipiente, Z para cima no Blender (Y para cima no GLB).
"""
import json
import math
import os

import bmesh
import bpy
from mathutils import Vector, noise

PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MEDIDAS = os.path.join(PROJECT, "src", "features", "configurator-3d", "medidas.json")
MODELS = os.path.join(PROJECT, "public", "models")
BLEND = os.path.join(PROJECT, "assets", "blender", "recipientes.blend")
COLLECTION_NAME = "ADS Recipientes"

ROUND_SEGMENTS = 56
SHAKE_SEGMENTS = 10  # copo de vidro facetado, como o das referências do proprietário
SHAKE_BASE = 0.012   # fundo grosso do copo de vidro
GAP = 0.0004         # folga entre a base e a parede, para não atravessar


# ---------------------------------------------------------------- materiais

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(value):
    value = value.lstrip("#")
    return tuple(srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def material(name, color, roughness, alpha=1.0, coat=0.0):
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


MATERIALS = {
    "pp": dict(color="#f4f1ec", roughness=0.35, alpha=0.42),        # pote de polipropileno, fosco
    "pet": dict(color="#ffffff", roughness=0.06, alpha=0.2),         # copo de PET, transparente
    "eps": dict(color="#f7f4ee", roughness=0.9),                     # isopor
    "vidro": dict(color="#f2f6fa", roughness=0.04, alpha=0.24),      # copo de vidro do milk-shake
    "acai": dict(color="#4a1550", roughness=0.36, coat=0.25),        # açaí cremoso
    "shake": dict(color="#eadfce", roughness=0.55),                  # cor neutra; o site troca pelo sabor
}
CONTAINER_MATERIAL = {"pote": "pp", "copo": "pet", "isopor": "eps", "shake": "vidro"}


# ---------------------------------------------------------------- geometria

def lathe(name, profile, segments, smooth=True, sharp_angle=35.0, displace=None):
    """Gira um perfil (raio, altura) em volta do eixo Z. O perfil começa e termina no eixo,
    então a malha sai fechada. `displace(vertex)` permite deformar vértices depois."""
    bm = bmesh.new()
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

    if displace:
        for vert in bm.verts:
            displace(vert)

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


def outer_radius(m, z):
    return m["raioFundo"] + (m["raioBoca"] - m["raioFundo"]) * (z / m["altura"])


def rim_arc(cx, cy, radius, steps=6):
    """Borda arredondada: meia volta por cima, de fora para dentro."""
    return [(cx + radius * math.cos(math.pi * k / steps), cy + radius * math.sin(math.pi * k / steps))
            for k in range(steps + 1)]


def bottom_height(m):
    return SHAKE_BASE if m["tipo"] == "shake" else (m["parede"] * 1.2 if m["tipo"] == "isopor" else m["parede"])


def container_profile(m):
    R, r, h, w = m["raioBoca"], m["raioFundo"], m["altura"], m["parede"]
    kind = m["tipo"]
    floor = bottom_height(m)
    chamfer = min(0.0015, r * 0.05)
    points = [(0.0, 0.0), (r - chamfer, 0.0), (r, chamfer)]

    if kind == "pote":
        # aba para a tampa encaixar
        points += [(outer_radius(m, h - 0.004), h - 0.004), (R + 0.0025, h - 0.0035), (R + 0.0025, h),
                   (R - w, h)]
    elif kind == "copo":
        # borda enrolada do copo de PET
        points += [(R, h - 0.0016), (R + 0.0009, h - 0.0008), (R + 0.0006, h), (R - w - 0.0004, h),
                   (R - w, h - 0.002)]
    else:
        # isopor e vidro: parede grossa com a borda arredondada
        points += [(R, h - w / 2)]
        points += rim_arc(R - w / 2, h - w / 2, w / 2)[1:]

    inner_floor_radius = outer_radius(m, floor) - w
    points += [(inner_floor_radius, floor), (0.0, floor)]
    return points


def base_profile(m, dome_factor, fill_fraction):
    w, h = m["parede"], m["altura"]
    floor = bottom_height(m) + 0.0003

    def inner(z):
        return outer_radius(m, z) - w - GAP

    top = h * fill_fraction
    dome_r = inner(top)
    dome_h = dome_factor * (m["raioBoca"] - w)
    exponent = 2 / 2.6  # superelipse: monte cheio, de topo arredondado
    points = [(0.0, floor), (inner(floor), floor), (dome_r, top)]
    steps = 14
    for k in range(1, steps + 1):
        t = (math.pi / 2) * k / steps
        x = dome_r * (math.cos(t) ** exponent) if k < steps else 0.0
        y = top + dome_h * (math.sin(t) ** exponent)
        points.append((x, y))
    return points, top, dome_h


def creamy(top, dome_h, strength):
    """Ondulações suaves na superfície do monte, para parecer cremoso."""
    def displace(vert):
        if vert.co.z <= top + 0.0005:
            return
        height = (vert.co.z - top) / dome_h
        sample = noise.noise(Vector((vert.co.x * 60, vert.co.y * 60, vert.co.z * 40)))
        vert.co.z += sample * strength * dome_h * math.sin(math.pi * min(height, 1.0) * 0.5 + 0.2)
    return displace


# ---------------------------------------------------------------- coleção e exportação

def load_medidas():
    with open(MEDIDAS, encoding="utf-8") as file:
        return json.load(file)


def all_entries(medidas):
    """(tamanho, medidas, produto) de todos os recipientes, na ordem da tabela."""
    entries = [(size_id, m, "acai") for size_id, m in medidas["acai"].items()]
    entries += [(size_id, m, "shake") for size_id, m in medidas["shake"].items()]
    return entries


def collection():
    """Coleção própria na cena aberta. Não troca a cena da janela do usuário."""
    coll = bpy.data.collections.get(COLLECTION_NAME)
    if coll is None:
        coll = bpy.data.collections.new(COLLECTION_NAME)
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
    """Exporta só o objeto, com a origem no centro da base. Mesmo jeito validado em 2026-11-11."""
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


def build_entries(size_ids=None):
    """Cria e exporta os recipientes e as bases pedidos (todos, sem lista). Devolve um relatório."""
    medidas = load_medidas()
    os.makedirs(MODELS, exist_ok=True)
    coll = collection()
    mats = {name: material(name, **spec) for name, spec in MATERIALS.items()}

    entries = all_entries(medidas)
    keys = [f"{'shake-' if p == 'shake' else ''}{s}" for s, _, p in entries]
    offsets = {}
    x = 0.0
    for key, (_, m, _) in zip(keys, entries):
        x += m["raioBoca"] + 0.03
        offsets[key] = x
        x += m["raioBoca"] + 0.03

    report = []
    for key, (size_id, m, product) in zip(keys, entries):
        if size_ids is not None and key not in size_ids:
            continue
        is_shake = product == "shake"
        segments = SHAKE_SEGMENTS if is_shake else ROUND_SEGMENTS
        container_name = f"container-{key}"
        base_name = f"base-{product}-{size_id}"
        for name in (container_name, base_name):
            remove_object(name)

        container = lathe(container_name, container_profile(m), segments, smooth=not is_shake)
        container.data.materials.append(mats[CONTAINER_MATERIAL[m["tipo"]]])

        fill = 0.9 if is_shake else 1.0 - 0.0015 / m["altura"]
        profile, top, dome_h = base_profile(m, medidas["monte"][product], fill)
        base = lathe(base_name, profile, segments, smooth=True, sharp_angle=60.0,
                     displace=creamy(top, dome_h, 0.035 if is_shake else 0.06))
        base.data.materials.append(mats["shake" if is_shake else "acai"])

        for obj in (base, container):
            coll.objects.link(obj)
            obj.location.x = offsets[key]  # lado a lado, só para ver
            export_glb(obj, os.path.join(MODELS, f"{obj.name}.glb"))
        report.append(f"{container_name}: {len(container.data.polygons)} faces | "
                      f"{base_name}: {len(base.data.polygons)} faces")
    return report


def save_blend():
    """Grava uma cópia editável. A sessão aberta continua apontando para o arquivo dela."""
    os.makedirs(os.path.dirname(BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, copy=True, compress=True)
    return BLEND


if __name__ == "__main__":
    for line in build_entries():
        print(line)
    print("arquivo editável:", save_blend())
