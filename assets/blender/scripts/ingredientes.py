"""
Ingredientes do Açaí Doce Sabor, um modelo por peça, que o site repete e posiciona sobre o monte.

Dois tipos de modelo:
  - Peças em tamanho real (metros), com a origem embaixo: granola, frutas, cereja, barras...
  - Camadas "normalizadas", modeladas sobre um monte de raio 1 com a altura do monte do produto:
    topping-calda-acai, topping-calda-shake e topping-po-acai. O site só amplia ou reduz pelo
    raio do monte do recipiente; como todo monte tem a mesma proporção, a camada encaixa.
    O site troca a cor da calda e do pó conforme o ingrediente.

Itens de marca (BIS, Kit Kat) são genéricos, sem logotipo nem embalagem.

Rodar com o Blender em segundo plano (não toca no Blender aberto):
    blender --background --factory-startup --python-exit-code 1 --python <projeto>/assets/blender/scripts/ingredientes.py
"""
import math
import os
import sys

import bmesh
from mathutils import Matrix, Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import (  # noqa: E402
    MODELS,
    PROJECT,
    collection,
    dome_height,
    export_glb,
    finish,
    lathe_bmesh,
    load_medidas,
    material,
    remove_object,
    save_copy,
)

BLEND = os.path.join(PROJECT, "assets", "blender", "ingredientes.blend")
COLLECTION_NAME = "ADS Ingredientes"

MATERIALS = {
    "granola": dict(color="#c98f4c", roughness=0.85),
    "biscoito": dict(color="#d9ae6c", roughness=0.75),
    "pacoca": dict(color="#d2a46a", roughness=0.95),
    "chocolate": dict(color="#3f2214", roughness=0.32),
    "chocolate-ao-leite": dict(color="#6b3a22", roughness=0.4),
    "amendoim": dict(color="#d8b27e", roughness=0.6),
    "wafer": dict(color="#e3bc80", roughness=0.7),
    "sucrilhos": dict(color="#e9a53b", roughness=0.55),
    "marshmallow": dict(color="#fbf4f6", roughness=0.85),
    "kiwi": dict(color="#7cb342", roughness=0.45),
    "kiwi-miolo": dict(color="#f1efc4", roughness=0.45),
    "kiwi-casca": dict(color="#8a7a3a", roughness=0.8),
    "semente": dict(color="#1f1a12", roughness=0.4),
    "banana": dict(color="#f4e6b0", roughness=0.6),
    "morango": dict(color="#d22a3c", roughness=0.35),
    "morango-polpa": dict(color="#f3a3ae", roughness=0.5),
    "creme-avela": dict(color="#5a3420", roughness=0.35),
    "creme-ninho": dict(color="#f3e7cc", roughness=0.45),
    "cereja": dict(color="#b5121b", roughness=0.18, coat=0.4),
    "cabo": dict(color="#5d6b2a", roughness=0.7),
    "calda": dict(color="#ffffff", roughness=0.18, coat=0.3),
    "po": dict(color="#fbf6e8", roughness=0.95),
}


# ---------------------------------------------------------------- ajudantes

def jitter(bm, amount, scale, seed=0.0):
    """Deforma levemente os vértices com ruído, para as peças não parecerem perfeitas."""
    for vert in bm.verts:
        n = noise.noise_vector(Vector((vert.co.x * scale + seed, vert.co.y * scale, vert.co.z * scale)))
        vert.co += n * amount


def transform(bm, matrix):
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)


def sit_on_ground(bm):
    """Coloca a peça com a base em z = 0 e centrada em x e y."""
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    z_min = min(v.co.z for v in bm.verts)
    shift = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -z_min))
    bmesh.ops.translate(bm, vec=shift, verts=bm.verts)


def scale(x, y, z):
    return Matrix.Diagonal((x, y, z, 1.0))


def cylinder(bm, radius, depth, segments, material_index=0):
    geom = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                                 radius1=radius, radius2=radius, depth=depth)
    for face in {f for v in geom["verts"] for f in v.link_faces}:
        face.material_index = material_index
    return geom["verts"]


def bevel_all(bm, offset, segments=2):
    try:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=offset, segments=segments,
                        profile=0.5, affect="EDGES")
    except Exception as error:  # se a versão do Blender mudar o operador, segue sem chanfro
        print("chanfro ignorado:", error)


# ---------------------------------------------------------------- peças

def granola(bm):
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.0045)
    transform(bm, scale(1.25, 0.95, 0.65))
    jitter(bm, 0.0011, 260)


def biscoito(bm):
    verts = cylinder(bm, 0.0062, 0.0026, 7)
    for vert in verts:
        angle = math.atan2(vert.co.y, vert.co.x)
        factor = 0.82 + 0.3 * (0.5 + 0.5 * math.sin(angle * 3.1 + 0.7))
        vert.co.x *= factor
        vert.co.y *= factor


def pacoca(bm):
    bmesh.ops.create_cube(bm, size=0.0072)
    transform(bm, scale(1.0, 0.85, 0.7))
    bevel_all(bm, 0.0009, 1)
    jitter(bm, 0.0007, 300, 3.0)


def chocoball(bm):
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.0036)


def amendoim(bm):
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.0042)
    transform(bm, scale(1.25, 0.8, 0.6))


def gotas(bm):
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=10,
                          radius1=0.0029, radius2=0.0, depth=0.0042)


def canudinho(bm):
    cylinder(bm, 0.0036, 0.06, 14)


def bis(bm):
    bmesh.ops.create_cube(bm, size=1.0)
    transform(bm, scale(0.013, 0.0085, 0.026))
    bevel_all(bm, 0.0013)


def sucrilhos(bm):
    verts = cylinder(bm, 0.0066, 0.0009, 9)
    for vert in verts:
        angle = math.atan2(vert.co.y, vert.co.x)
        r = math.hypot(vert.co.x, vert.co.y)
        factor = 0.85 + 0.25 * (0.5 + 0.5 * math.sin(angle * 2.3 + 1.1))
        vert.co.x *= factor
        vert.co.y *= factor
        vert.co.z += (r / 0.0066) ** 2 * 0.0018  # leve curva de floco


def marshmallow(bm):
    cylinder(bm, 0.0052, 0.0085, 14)
    bevel_all(bm, 0.0012)


def kiwi(bm):
    # 0 polpa verde, 1 miolo, 2 casca, 3 sementes
    verts = cylinder(bm, 0.0125, 0.004, 24, material_index=0)
    for face in {f for v in verts for f in v.link_faces}:
        if abs(face.normal.z) < 0.5:
            face.material_index = 2
    core = cylinder(bm, 0.0042, 0.0042, 16, material_index=1)
    for vert in core:
        vert.co.z += 0.0001
    for k in range(14):
        angle = 2 * math.pi * k / 14
        geom = bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=0.00055)
        for vert in geom["verts"]:
            vert.co.x = vert.co.x * 1.6 + 0.0058 * math.cos(angle)
            vert.co.y = vert.co.y + 0.0058 * math.sin(angle)
            vert.co.z = vert.co.z * 0.5 + 0.00205
        for face in {f for v in geom["verts"] for f in v.link_faces}:
            face.material_index = 3


def banana(bm):
    cylinder(bm, 0.0125, 0.006, 24)
    jitter(bm, 0.0003, 200, 7.0)


def morango(bm):
    # metade de um morango, com o corte virado para cima: 0 casca, 1 polpa
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.011)
    for vert in bm.verts:
        t = (vert.co.z / 0.011 + 1) / 2  # 0 embaixo (ponta), 1 em cima (cabinho)
        width = 0.45 + 0.55 * math.sin(min(1.0, t * 1.15) * math.pi / 2)
        vert.co.x *= width
        vert.co.y *= width
        vert.co.z *= 1.15
    result = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                    plane_co=(0, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
    cut_edges = [e for e in result["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    filled = bmesh.ops.holes_fill(bm, edges=cut_edges, sides=0)
    for face in filled["faces"]:
        face.material_index = 1
    # corte (+X) virado para cima (+Z)
    transform(bm, Matrix.Rotation(math.radians(-90), 4, "Y"))


def creme(bm):
    # porção de creme em espiral: perfil girado, torcido conforme a altura
    profile = [(0.0, 0.0), (0.012, 0.0), (0.0135, 0.0028), (0.0118, 0.0052), (0.0088, 0.0062),
               (0.0094, 0.0082), (0.0068, 0.0098), (0.0066, 0.0112), (0.0040, 0.0128),
               (0.0022, 0.0146), (0.0, 0.0158)]
    lathe_bmesh(profile, 20, bm)
    for vert in bm.verts:
        twist = vert.co.z * 260
        c, s = math.cos(twist), math.sin(twist)
        x, y = vert.co.x, vert.co.y
        bump = 1 + 0.08 * math.sin(math.atan2(y, x) * 3 + vert.co.z * 900)
        vert.co.x = (x * c - y * s) * bump
        vert.co.y = (x * s + y * c) * bump


def cereja(bm):
    # 0 fruta, 1 cabinho
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=0.0095)
    for vert in bm.verts:
        vert.co.z *= 0.9
        r = math.hypot(vert.co.x, vert.co.y)
        if vert.co.z > 0 and r < 0.003:
            vert.co.z -= 0.0018 * (1 - r / 0.003)  # covinha do cabinho
    stem = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6,
                                 radius1=0.0008, radius2=0.0006, depth=0.026)
    for vert in stem["verts"]:
        h = vert.co.z + 0.013  # 0 a 0.026
        vert.co.z = h + 0.0058
        vert.co.x += (h / 0.026) ** 2 * 0.009  # cabinho curvado
    for face in {f for v in stem["verts"] for f in v.link_faces}:
        face.material_index = 1


def kit_kat(bm):
    bmesh.ops.create_cube(bm, size=1.0)
    transform(bm, scale(0.0125, 0.0095, 0.045))
    bevel_all(bm, 0.0014)


# ---------------------------------------------------------------- camadas normalizadas

def calda(bm, monte, expoente, seed):
    """Fio de calda em zigue-zague sobre um monte de raio 1."""
    random_phase = seed * 1.7
    path = []
    steps = 90
    for k in range(steps + 1):
        t = k / steps
        x = -0.86 + 1.72 * t
        limit = math.sqrt(max(0.0, 1 - x * x)) * 0.86
        y = math.sin(t * math.pi * 4.2 + random_phase) * limit
        rho = math.hypot(x, y)
        z = dome_height(rho, monte, expoente) + 0.045
        path.append(Vector((x, y, z)))
    tube(bm, path, radius=0.042, sides=8)


def tube(bm, path, radius, sides):
    """Tubo ao longo de um caminho, com pontas arredondadas."""
    rings = []
    up = Vector((0, 0, 1))
    for i, point in enumerate(path):
        tangent = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        side = tangent.cross(up)
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        normal = side.cross(tangent).normalized()
        rings.append([bm.verts.new(point + (side * math.cos(2 * math.pi * s / sides)
                                            + normal * math.sin(2 * math.pi * s / sides)) * radius)
                      for s in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for s in range(sides):
            bm.faces.new((a[s], a[(s + 1) % sides], b[(s + 1) % sides], b[s]))
    for ring, point, direction in ((rings[0], path[0], -1), (rings[-1], path[-1], 1)):
        tip = bm.verts.new(point + (path[-1] - path[-2] if direction > 0 else path[0] - path[1]).normalized() * radius)
        for s in range(sides):
            bm.faces.new((ring[s], ring[(s + 1) % sides], tip) if direction > 0 else (ring[(s + 1) % sides], ring[s], tip))


def po(bm, monte, expoente):
    """Mancha de pó polvilhado sobre o monte: arredondada, de borda irregular, um pouco fora do
    centro e levemente acima da superfície."""
    center = Vector((0.32, 0.0, 0.0))
    radius = 0.52
    spokes, rings = 36, 8
    grid = [[bm.verts.new((center.x, center.y, dome_height(center.length, monte, expoente) + 0.03))]]
    for i in range(1, rings + 1):
        row = []
        for j in range(spokes):
            angle = 2 * math.pi * j / spokes
            edge = 0.82 + 0.2 * noise.noise(Vector((math.cos(angle) * 2.2, math.sin(angle) * 2.2, 1.7)))
            r = radius * edge * (i / rings)
            x, y = center.x + r * math.cos(angle), center.y + r * math.sin(angle)
            rho = min(math.hypot(x, y), 0.96)
            scale_to = rho / max(math.hypot(x, y), 1e-9)
            x, y = x * scale_to, y * scale_to
            row.append(bm.verts.new((x, y, dome_height(rho, monte, expoente) + 0.03)))
        grid.append(row)
    for j in range(spokes):
        bm.faces.new((grid[0][0], grid[1][j], grid[1][(j + 1) % spokes]))
    for a, b in zip(grid[1:], grid[2:]):
        for j in range(spokes):
            k = (j + 1) % spokes
            bm.faces.new((a[j], b[j], b[k], a[k]))
    # espessura: uma cópia por baixo, para o pó ser visível dos dois lados
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-0.012)


# ---------------------------------------------------------------- catálogo e exportação

PIECES = {
    "granola": (granola, ["granola"]),
    "biscoito": (biscoito, ["biscoito"]),
    "pacoca": (pacoca, ["pacoca"]),
    "chocoball": (chocoball, ["chocolate"]),
    "amendoim": (amendoim, ["amendoim"]),
    "gotas-de-chocolate": (gotas, ["chocolate"]),
    "canudinho": (canudinho, ["wafer"]),
    "bis": (bis, ["chocolate"]),
    "sucrilhos": (sucrilhos, ["sucrilhos"]),
    "marshmallow": (marshmallow, ["marshmallow"]),
    "kiwi": (kiwi, ["kiwi", "kiwi-miolo", "kiwi-casca", "semente"]),
    "banana": (banana, ["banana"]),
    "morango": (morango, ["morango", "morango-polpa"]),
    "creme-de-avela": (creme, ["creme-avela"]),
    "creme-de-ninho": (creme, ["creme-ninho"]),
    "cereja": (cereja, ["cereja", "cabo"]),
    "kit-kat": (kit_kat, ["chocolate-ao-leite"]),
}


def build_all(names=None):
    medidas = load_medidas()
    monte = medidas["monte"]
    os.makedirs(MODELS, exist_ok=True)
    coll = collection(COLLECTION_NAME)
    mats = {name: material(name, **spec) for name, spec in MATERIALS.items()}

    jobs = [(name, fn, materials, True) for name, (fn, materials) in PIECES.items()]
    jobs += [
        ("calda-acai", lambda bm: calda(bm, monte["acai"], monte["expoente"], 0.0), ["calda"], False),
        ("calda-shake", lambda bm: calda(bm, monte["shake"], monte["expoente"], 0.0), ["calda"], False),
        ("po-acai", lambda bm: po(bm, monte["acai"], monte["expoente"]), ["po"], False),
    ]

    report = []
    for index, (name, fn, materials, grounded) in enumerate(jobs):
        if names is not None and name not in names:
            continue
        object_name = f"topping-{name}"
        remove_object(object_name)
        bm = bmesh.new()
        fn(bm)
        if grounded:
            sit_on_ground(bm)
        obj = finish(bm, object_name, smooth=True, sharp_angle=50.0)
        for material_name in materials:
            obj.data.materials.append(mats[material_name])
        coll.objects.link(obj)
        obj.location = ((index % 6) * 0.08, (index // 6) * 0.08 + 0.4, 0.0)  # grade, só para ver
        export_glb(obj, os.path.join(MODELS, f"{object_name}.glb"))
        report.append(f"{object_name}: {len(obj.data.polygons)} faces, {len(materials)} material(is)")
    return report


if __name__ == "__main__":
    for line in build_all():
        print(line)
    print("arquivo editável:", save_copy(BLEND))
