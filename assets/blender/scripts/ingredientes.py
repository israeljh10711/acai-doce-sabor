"""
Ingredientes do Açaí Doce Sabor, com formas orgânicas e materiais de foto, que o site repete e
posiciona em setores sobre o monte (como nos isopores das fotos de referência).

Três tipos de modelo:
  - Montinhos (granola, amendoim triturado, paçoca, chocoball, gotas, sucrilhos, marshmallow,
    biscoito): vários pedaços irregulares numa malha só, com a cor de cada pedaço na cor por
    vértice. O site espalha vários montinhos para cobrir o setor do ingrediente.
  - Peças em tamanho real, com a origem embaixo: rodelas e fatias de fruta (com textura), canudinho,
    barras, cereja e rosetas de creme.
  - Camadas "normalizadas", modeladas sobre um monte de raio 1 com a altura do monte do produto:
    topping-calda-acai, topping-calda-shake e topping-po-acai. O site amplia pelo raio do monte e
    troca a cor conforme a calda ou o pó.

Itens de marca (BIS, Kit Kat) são genéricos, sem logotipo nem embalagem. Confeitos coloridos não
entram: não estão no cardápio.

Rodar com o Blender em segundo plano (não toca no Blender aberto), depois de texturas.py:
    blender --background --factory-startup --python-exit-code 1 --python <projeto>/assets/blender/scripts/ingredientes.py
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import (  # noqa: E402
    MODELS,
    PROJECT,
    collection,
    color_layer,
    dome_height,
    export_glb,
    finish,
    hex_to_linear,
    lathe_bmesh,
    load_medidas,
    pbr,
    remove_object,
    save_copy,
)

BLEND = os.path.join(PROJECT, "assets", "blender", "ingredientes.blend")
COLLECTION_NAME = "ADS Ingredientes"


def make_materials():
    vc = dict(vertex_color=True)
    return {
        "granola": pbr("granola", roughness=0.78, normal_map="grao-relevo", normal_strength=0.5, **vc),
        "amendoim": pbr("amendoim", roughness=0.62, normal_map="grao-relevo", normal_strength=0.35, **vc),
        "pacoca": pbr("pacoca", roughness=0.92, normal_map="grao-relevo", normal_strength=0.8, **vc),
        "chocolate": pbr("chocolate", roughness=0.36, coat=0.2, coat_roughness=0.25, **vc),
        "sucrilhos": pbr("sucrilhos", roughness=0.55, normal_map="grao-relevo", normal_strength=0.4, **vc),
        "marshmallow": pbr("marshmallow", roughness=0.86, normal_map="grao-relevo", normal_strength=0.25, **vc),
        "biscoito": pbr("biscoito", roughness=0.8, normal_map="grao-relevo", normal_strength=0.7, **vc),
        "wafer": pbr("wafer", roughness=0.68, **vc),
        "chocolate-barra": pbr("chocolate-barra", "#4a2816", 0.3, coat=0.3, coat_roughness=0.2),
        "chocolate-ao-leite": pbr("chocolate-ao-leite", "#6b3a22", 0.34, coat=0.25, coat_roughness=0.22),
        "banana": pbr("banana", roughness=0.5, base_map="banana-cor", normal_map="banana-relevo",
                      normal_strength=0.6, coat=0.15, coat_roughness=0.25),
        "morango": pbr("morango", roughness=0.3, base_map="morango-cor", normal_map="morango-relevo",
                       normal_strength=0.6, coat=0.5, coat_roughness=0.1),
        "kiwi": pbr("kiwi", roughness=0.36, base_map="kiwi-cor", normal_map="kiwi-relevo",
                    normal_strength=0.5, coat=0.35, coat_roughness=0.12),
        "creme-avela": pbr("creme-avela", "#4a2817", 0.3, normal_map="grao-relevo", normal_strength=0.15,
                           coat=0.35, coat_roughness=0.18),
        "creme-ninho": pbr("creme-ninho", "#f4ead2", 0.42, normal_map="grao-relevo", normal_strength=0.2,
                           coat=0.18, coat_roughness=0.25),
        "cereja": pbr("cereja", roughness=0.14, coat=1.0, coat_roughness=0.04, **vc),
        "cabo": pbr("cabo", "#55602a", 0.6),
        "calda": pbr("calda", "#ffffff", 0.1, coat=1.0, coat_roughness=0.03),
        "po": pbr("po", "#fbf6e8", 1.0, normal_map="grao-relevo", normal_strength=0.9),
    }


# ---------------------------------------------------------------- ajudantes

def new_bm():
    bm = bmesh.new()
    bm.loops.layers.uv.new("UVMap")
    color_layer(bm)
    return bm


def merge(target, piece):
    """Junta um pedaço (bmesh próprio, já pintado e no lugar) ao montinho."""
    mesh = bpy.data.meshes.new("pedaco")
    piece.to_mesh(mesh)
    piece.free()
    target.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


def paint(bm, color, variation=0.08, seed=0.0):
    """Pinta todos os cantos com a cor (hex), com uma leve variação para não ficar chapado."""
    layer = color_layer(bm)
    base = hex_to_linear(color)
    for face in bm.faces:
        for loop in face.loops:
            co = loop.vert.co
            k = 1 + variation * noise.noise(Vector((co.x * 700 + seed, co.y * 700, co.z * 700)))
            loop[layer] = (base[0] * k, base[1] * k, base[2] * k, 1.0)


def paint_radial(bm, center_color, edge_color, radius):
    """Do centro para a borda (flocos tostados nas pontas)."""
    layer = color_layer(bm)
    a, b = hex_to_linear(center_color), hex_to_linear(edge_color)
    for face in bm.faces:
        for loop in face.loops:
            t = min(math.hypot(loop.vert.co.x, loop.vert.co.y) / radius, 1.0) ** 2
            loop[layer] = (*(x + (y - x) * t for x, y in zip(a, b)), 1.0)


def place(bm, location, rotation=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0)):
    matrix = (Matrix.Translation(location) @ Euler(rotation).to_matrix().to_4x4()
              @ Matrix.Diagonal((*scale, 1.0)))
    bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)


def heap_point(rnd, radius, height):
    """Ponto num montinho: mais alto no meio, mais espalhado na borda."""
    angle = rnd.uniform(0, 2 * math.pi)
    r = radius * math.sqrt(rnd.random())
    return Vector((r * math.cos(angle), r * math.sin(angle), height * (1 - (r / radius) ** 2)))


def random_tilt(rnd, amount):
    return (rnd.uniform(-amount, amount), rnd.uniform(-amount, amount), rnd.uniform(0, 2 * math.pi))


def flake(rnd, radius, thickness, cup=0.2, sides=9):
    """Floco irregular e levemente côncavo (aveia, sucrilhos)."""
    bm = new_bm()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides,
                          radius1=radius, radius2=radius, depth=thickness)
    phase = rnd.uniform(0, 2 * math.pi)
    for vert in bm.verts:
        angle = math.atan2(vert.co.y, vert.co.x)
        k = 1 + 0.22 * math.sin(angle * 2 + phase) + 0.12 * math.sin(angle * 5 + phase * 2)
        vert.co.x *= k
        vert.co.y *= k
        vert.co.z += cup * radius * (math.hypot(vert.co.x, vert.co.y) / radius) ** 2
    return bm


def chunk(rnd, size, jitter=0.25, smooth_level=1):
    """Pedaço anguloso (castanha quebrada, amendoim triturado, farelo)."""
    bm = new_bm()
    bmesh.ops.create_icosphere(bm, subdivisions=smooth_level, radius=size)
    sx, sy, sz = rnd.uniform(0.8, 1.25), rnd.uniform(0.7, 1.1), rnd.uniform(0.5, 0.85)
    for vert in bm.verts:
        vert.co.x *= sx * (1 + rnd.uniform(-jitter, jitter))
        vert.co.y *= sy * (1 + rnd.uniform(-jitter, jitter))
        vert.co.z *= sz * (1 + rnd.uniform(-jitter, jitter))
    return bm


def blob(radius, scale=(1.0, 1.0, 1.0), wrinkle=0.0, seed=0.0, subdivisions=2):
    """Bolinha macia, com rugas opcionais (uva-passa)."""
    bm = new_bm()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    for vert in bm.verts:
        direction = vert.co.normalized()
        if wrinkle:
            n = noise.noise(Vector((vert.co.x * 2200 + seed, vert.co.y * 2200, vert.co.z * 2200)))
            vert.co += direction * n * wrinkle
        vert.co.x *= scale[0]
        vert.co.y *= scale[1]
        vert.co.z *= scale[2]
    return bm


def cylinder_piece(radius, depth, segments, bevel=0.0):
    bm = new_bm()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=depth)
    if bevel:
        bevel_edges(bm, bevel)
    return bm


def bevel_edges(bm, offset, segments=2):
    try:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=offset, segments=segments,
                        profile=0.5, affect="EDGES")
    except Exception as error:  # se a versão do Blender mudar o operador, segue sem chanfro
        print("chanfro ignorado:", error)


def sit_on_ground(bm):
    """Coloca a peça com a base em z = 0 e centrada em x e y."""
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    z_min = min(v.co.z for v in bm.verts)
    shift = Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -z_min))
    bmesh.ops.translate(bm, vec=shift, verts=bm.verts)


def top_uv(bm, tile):
    """Projeção de cima, para o relevo granulado dos montinhos."""
    uv = bm.loops.layers.uv.active
    for face in bm.faces:
        for loop in face.loops:
            loop[uv].uv = (loop.vert.co.x / tile + 0.5, loop.vert.co.y / tile + 0.5)


# ---------------------------------------------------------------- montinhos

def granola(bm, rnd):
    for _ in range(15):  # flocos de aveia tostados
        piece = flake(rnd, rnd.uniform(0.0021, 0.0033), 0.0007, cup=0.25)
        paint(piece, rnd.choice(["#d9a45f", "#c98f4c", "#e2b877", "#b8793a"]), seed=rnd.random())
        place(piece, heap_point(rnd, 0.0085, 0.0032) + Vector((0, 0, 0.0005)), random_tilt(rnd, 0.7))
        merge(bm, piece)
    for _ in range(3):  # castanhas quebradas
        piece = chunk(rnd, rnd.uniform(0.0021, 0.0029), jitter=0.22)
        paint(piece, rnd.choice(["#dcb98c", "#cfa676", "#e6c89e"]), seed=rnd.random())
        place(piece, heap_point(rnd, 0.007, 0.003) + Vector((0, 0, 0.0012)), random_tilt(rnd, 3.1))
        merge(bm, piece)
    for _ in range(2):  # uvas-passas
        piece = blob(0.0025, (1.25, 0.9, 0.62), wrinkle=0.00045, seed=rnd.random() * 10)
        paint(piece, "#3b1a13", variation=0.2, seed=rnd.random())
        place(piece, heap_point(rnd, 0.0075, 0.003) + Vector((0, 0, 0.0012)), random_tilt(rnd, 0.6))
        merge(bm, piece)


def amendoim(bm, rnd):
    """Amendoim triturado: lascas irregulares, algumas com a pele."""
    for _ in range(30):
        piece = chunk(rnd, rnd.uniform(0.0011, 0.0024), jitter=0.3)
        color = "#a8693a" if rnd.random() < 0.15 else rnd.choice(["#efdcb4", "#e3c798", "#d6b07a", "#c9995f"])
        paint(piece, color, seed=rnd.random())
        place(piece, heap_point(rnd, 0.0088, 0.003) + Vector((0, 0, 0.0008)), random_tilt(rnd, 3.1))
        merge(bm, piece)


def pacoca(bm, rnd):
    """Paçoca esfarelada: farelo e dois pedaços maiores."""
    for _ in range(22):
        piece = chunk(rnd, rnd.uniform(0.0012, 0.0028), jitter=0.3)
        paint(piece, rnd.choice(["#dcae73", "#d09f63", "#c48f55", "#e6bf8a"]), seed=rnd.random())
        place(piece, heap_point(rnd, 0.0088, 0.0028) + Vector((0, 0, 0.0008)), random_tilt(rnd, 3.1))
        merge(bm, piece)
    for _ in range(2):
        piece = new_bm()
        bmesh.ops.create_cube(piece, size=0.0058)
        for vert in piece.verts:
            vert.co += Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.0007
        bevel_edges(piece, 0.0008, 1)
        paint(piece, "#d4a468", seed=rnd.random())
        place(piece, heap_point(rnd, 0.005, 0.002) + Vector((0, 0, 0.0025)), random_tilt(rnd, 0.5),
              (1.0, 0.85, 0.65))
        merge(bm, piece)


def chocoball(bm, rnd):
    for _ in range(7):
        radius = rnd.uniform(0.0033, 0.004)
        piece = new_bm()
        bmesh.ops.create_uvsphere(piece, u_segments=14, v_segments=9, radius=radius)
        paint(piece, rnd.choice(["#3e2011", "#4a2816", "#341a0c"]), variation=0.05, seed=rnd.random())
        place(piece, heap_point(rnd, 0.0075, 0.0035) + Vector((0, 0, radius)), random_tilt(rnd, 3.1))
        merge(bm, piece)


def gotas(bm, rnd):
    for _ in range(13):
        piece = new_bm()
        bmesh.ops.create_cone(piece, cap_ends=True, cap_tris=True, segments=10,
                              radius1=0.0026, radius2=0.0004, depth=0.0036)
        paint(piece, rnd.choice(["#2e170c", "#3a1f12"]), variation=0.05, seed=rnd.random())
        place(piece, heap_point(rnd, 0.0082, 0.0028) + Vector((0, 0, 0.0018)), random_tilt(rnd, 0.6))
        merge(bm, piece)


def sucrilhos(bm, rnd):
    for _ in range(6):
        radius = rnd.uniform(0.0045, 0.006)
        piece = flake(rnd, radius, 0.0008, cup=0.35, sides=11)
        paint_radial(piece, "#f0b54a", "#c27420", radius)
        place(piece, heap_point(rnd, 0.0075, 0.003) + Vector((0, 0, 0.0008)), random_tilt(rnd, 0.6))
        merge(bm, piece)


def marshmallow(bm, rnd):
    for _ in range(6):
        piece = cylinder_piece(rnd.uniform(0.0034, 0.004), rnd.uniform(0.0048, 0.0058), 14, bevel=0.0011)
        paint(piece, rnd.choice(["#fbf7f4", "#fbf7f4", "#f6c9d6"]), variation=0.03, seed=rnd.random())
        place(piece, heap_point(rnd, 0.0072, 0.003) + Vector((0, 0, 0.0028)), random_tilt(rnd, 1.4))
        merge(bm, piece)


def biscoito(bm, rnd):
    """Biscoito quebrado: três pedaços e farelo."""
    for _ in range(3):
        piece = new_bm()
        radius = rnd.uniform(0.0052, 0.0068)
        bmesh.ops.create_cone(piece, cap_ends=True, cap_tris=False, segments=7,
                              radius1=radius, radius2=radius, depth=0.0024)
        for vert in piece.verts:
            angle = math.atan2(vert.co.y, vert.co.x)
            k = 0.75 + 0.35 * abs(math.sin(angle * 1.5 + radius * 900))
            vert.co.x *= k
            vert.co.y *= k
        bevel_edges(piece, 0.0004, 1)
        paint_radial(piece, "#dfb675", "#c48b49", radius)
        place(piece, heap_point(rnd, 0.0065, 0.0022) + Vector((0, 0, 0.0014)), random_tilt(rnd, 0.6))
        merge(bm, piece)
    for _ in range(6):
        piece = chunk(rnd, rnd.uniform(0.0009, 0.0016), jitter=0.3)
        paint(piece, "#d6a866", seed=rnd.random())
        place(piece, heap_point(rnd, 0.008, 0.002) + Vector((0, 0, 0.0006)), random_tilt(rnd, 3.1))
        merge(bm, piece)


# ---------------------------------------------------------------- frutas (com textura)

def disc_slice(bm, radius, depth, segments, yscale=1.0, wobble=0.04, seed=0.0, face_radius_uv=0.47):
    """Rodela: faces de cima e de baixo com a textura do corte (disco central da imagem) e a
    lateral na cor lisa do canto da imagem. Borda levemente arredondada."""
    uv = bm.loops.layers.uv.active
    rings = []
    for z, shrink in ((-depth / 2, 0.95), (-depth / 4, 0.995), (depth / 4, 0.995), (depth / 2, 0.95)):
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            k = 1 + wobble * noise.noise(Vector((math.cos(a) * 1.7, math.sin(a) * 1.7, seed)))
            ring.append(bm.verts.new((radius * k * shrink * math.cos(a),
                                      radius * k * shrink * math.sin(a) * yscale, z)))
        rings.append(ring)
    for lower, upper in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            face = bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
            for loop in face.loops:
                loop[uv].uv = (0.04, 0.04)
    top = bm.faces.new(rings[-1])
    bottom = bm.faces.new(list(reversed(rings[0])))
    for face in (top, bottom):
        for loop in face.loops:
            loop[uv].uv = (0.5 + loop.vert.co.x / radius * face_radius_uv,
                           0.5 + loop.vert.co.y / (radius * yscale) * face_radius_uv * yscale)
    # faces de corte levemente onduladas
    for vert in rings[-1]:
        vert.co.z += 0.00025 * noise.noise(Vector((vert.co.x * 400, vert.co.y * 400, seed + 2)))


def banana(bm, rnd):
    disc_slice(bm, 0.0125, 0.0055, 30, wobble=0.035, seed=1.3)


def kiwi(bm, rnd):
    disc_slice(bm, 0.0128, 0.0046, 30, yscale=0.92, wobble=0.02, seed=2.1)


def strawberry_halfwidth(y):
    """Meia largura do contorno da fatia de morango, y de -1 (ponta) a 1 (topo).
    Igual à de texturas.py, para a malha e a textura coincidirem."""
    t = (y + 1) / 2
    return 0.86 * t ** 0.55 * math.sqrt(max(0.0, 1 - t ** 6))


def morango(bm, rnd):
    """Fatia de morango cortada no comprido: contorno de coração, polpa com veios e a casca com
    sementes na lateral. Brilho úmido no material."""
    uv = bm.loops.layers.uv.active
    half_h = 0.0125
    half_w = half_h * 0.42 / 0.38  # mesma proporção da textura, sem esticar
    depth = 0.0042
    ys = [math.cos(math.pi * k / 20) for k in range(21)]  # 1 (topo) a -1 (ponta), mais denso nas pontas
    outline = [(strawberry_halfwidth(y) * half_w, y * half_h) for y in ys]
    outline += [(-strawberry_halfwidth(y) * half_w, y * half_h) for y in reversed(ys[1:-1])]
    # tira pontos repetidos nas pontas (largura zero)
    clean = []
    for point in outline:
        if not clean or math.dist(point, clean[-1]) > 1e-6:
            clean.append(point)
    outline = clean
    rings = []
    for z, shrink in ((-depth / 2, 0.93), (0.0, 1.0), (depth / 2, 0.93)):
        rings.append([bm.verts.new((x * shrink, y * shrink + (1 - shrink) * half_h * 0.1, z)) for x, y in outline])
    n = len(outline)
    perimeter = sum(math.dist(outline[i], outline[(i + 1) % n]) for i in range(n))
    run = [0.0]
    for i in range(1, n + 1):
        run.append(run[-1] + math.dist(outline[i - 1], outline[i % n]))
    for r, (lower, upper) in enumerate(zip(rings, rings[1:])):
        for i in range(n):
            j = (i + 1) % n
            face = bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
            for loop, (index, level) in zip(face.loops, ((i, r), (i + 1, r), (i + 1, r + 1), (i, r + 1))):
                loop[uv].uv = (run[index] / perimeter * 3.0, 0.02 + 0.07 * level)
    top = bm.faces.new(rings[-1])
    bottom = bm.faces.new(list(reversed(rings[0])))
    for face in (top, bottom):
        for loop in face.loops:
            loop[uv].uv = (0.5 + loop.vert.co.x / half_w * 0.42, 0.6 + loop.vert.co.y / half_h * 0.38)
    bmesh.ops.triangulate(bm, faces=[top, bottom])


# ---------------------------------------------------------------- espetados, cereja e creme

def canudinho(bm, rnd):
    """Canudinho de wafer: tubo oco com a espiral do enrolado (relevo e duas cores)."""
    layer = color_layer(bm)
    light, dark = hex_to_linear("#ebcb95"), hex_to_linear("#c48b47")
    profile = [(0.0028, 0.0), (0.0036, 0.0), (0.0036, 0.06), (0.0028, 0.06), (0.0028, 0.0)]
    segments, steps = 18, 36
    rings = []
    for k in range(steps + 1):
        z = 0.06 * k / steps
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            groove = 0.5 + 0.5 * math.sin(a - z * 2 * math.pi / 0.009)
            r = 0.0036 - 0.00022 * groove ** 6
            ring.append((bm.verts.new((r * math.cos(a), r * math.sin(a), z)), groove))
        rings.append(ring)
    inner = [[bm.verts.new((0.0028 * math.cos(2 * math.pi * i / segments),
                            0.0028 * math.sin(2 * math.pi * i / segments), z)) for i in range(segments)]
             for z in (0.0, 0.06)]
    def add(face_verts, colors):
        face = bm.faces.new(face_verts)
        for loop, c in zip(face.loops, colors):
            loop[layer] = (*c, 1.0)
    for lower, upper in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            verts = (lower[i][0], lower[j][0], upper[j][0], upper[i][0])
            grooves = (lower[i][1], lower[j][1], upper[j][1], upper[i][1])
            add(verts, [tuple(a + (b - a) * g ** 3 for a, b in zip(light, dark)) for g in grooves])
    for i in range(segments):  # parede de dentro e as duas bocas
        j = (i + 1) % segments
        add((inner[0][j], inner[0][i], inner[1][i], inner[1][j]), [dark] * 4)
        add((rings[0][j][0], rings[0][i][0], inner[0][i], inner[0][j]), [light] * 4)
        add((rings[-1][i][0], rings[-1][j][0], inner[1][j], inner[1][i]), [light] * 4)
    del profile


def bis(bm, rnd):
    """Barrinha de wafer coberta de chocolate, com as ondas por cima. Genérica, sem marca."""
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=3, use_grid_fill=True)
    for vert in bm.verts:
        x, y, z = vert.co
        if y > 0.49:
            vert.co.y += 0.06 * math.sin(x * math.pi * 4) ** 2
        vert.co = Vector((vert.co.x * 0.013, vert.co.y * 0.0085, vert.co.z * 0.026))
    bevel_edges(bm, 0.0009, 1)


def kit_kat(bm, rnd):
    """Barrinha de chocolate ao leite, de lados inclinados. Genérica, sem marca."""
    bmesh.ops.create_cube(bm, size=1.0)
    for vert in bm.verts:
        x, y, z = vert.co
        taper = 0.82 if y > 0 else 1.0
        vert.co = Vector((x * 0.0125 * taper, y * 0.0095, z * 0.045))
    bevel_edges(bm, 0.0014, 2)


def cereja(bm, rnd):
    """Cereja em calda: vermelho profundo, covinha do cabinho e o cabinho curvo."""
    layer = color_layer(bm)
    fruit = new_bm()
    bmesh.ops.create_uvsphere(fruit, u_segments=20, v_segments=14, radius=0.0095)
    for vert in fruit.verts:
        vert.co.z *= 0.9
        r = math.hypot(vert.co.x, vert.co.y)
        if vert.co.z > 0 and r < 0.003:
            vert.co.z -= 0.0018 * (1 - r / 0.003)
    top_color, bottom_color = hex_to_linear("#b1101d"), hex_to_linear("#6e0610")
    fruit_layer = color_layer(fruit)
    for face in fruit.faces:
        for loop in face.loops:
            t = (loop.vert.co.z / 0.0095 + 1) / 2
            loop[fruit_layer] = (*(b + (a - b) * t for a, b in zip(top_color, bottom_color)), 1.0)
    merge(bm, fruit)
    stem = new_bm()
    bmesh.ops.create_cone(stem, cap_ends=True, cap_tris=False, segments=6,
                          radius1=0.0008, radius2=0.0006, depth=0.026)
    for vert in stem.verts:
        h = vert.co.z + 0.013
        vert.co.z = h + 0.0058
        vert.co.x += (h / 0.026) ** 2 * 0.009
    paint(stem, "#ffffff", variation=0.0)  # o site multiplica a cor do material pela do vértice
    for face in stem.faces:
        face.material_index = 1
    merge(bm, stem)
    del layer


def creme(bm, rnd):
    """Roseta de creme feita com bico pitanga: oito sulcos em espiral até a ponta."""
    levels, segments = 26, 56
    rings = []
    for k in range(levels + 1):
        t = k / levels
        z = 0.0152 * t
        base_r = 0.0125 * (1 - t ** 1.6) ** 0.75 + 0.0009 * (1 - t)
        twist = z * 300
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            star = 1 + 0.06 * math.cos(6 * a + twist) * (1 - t * 0.7)
            sag = 1 + 0.05 * math.sin(t * math.pi * 3.2 + a)  # voltas do creme
            r = base_r * star * sag
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    tip = bm.verts.new((0.0, 0.0, 0.0158))
    bottom = bm.verts.new((0.0, 0.0, 0.0))
    for lower, upper in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i + 1) % segments
            bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new((rings[-1][i], rings[-1][j], tip))
        bm.faces.new((rings[0][j], rings[0][i], bottom))
    top_uv(bm, 0.015)


# ---------------------------------------------------------------- camadas normalizadas

def tube(bm, path, radii, sides, flatten=0.6):
    """Fio ao longo de um caminho, achatado como calda escorrida, com pontas arredondadas."""
    rings = []
    up = Vector((0, 0, 1))
    for i, point in enumerate(path):
        tangent = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        side = tangent.cross(up)
        if side.length < 1e-6:
            side = Vector((1, 0, 0))
        side.normalize()
        normal = side.cross(tangent).normalized()
        r = radii[i]
        rings.append([bm.verts.new(point + side * math.cos(2 * math.pi * s / sides) * r * 1.35
                                   + normal * math.sin(2 * math.pi * s / sides) * r * flatten)
                      for s in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for s in range(sides):
            bm.faces.new((a[s], a[(s + 1) % sides], b[(s + 1) % sides], b[s]))
    for ring, point, direction in ((rings[0], path[0], -1), (rings[-1], path[-1], 1)):
        tip = bm.verts.new(point + (path[-1] - path[-2] if direction > 0 else path[0] - path[1]).normalized() * radii[0])
        for s in range(sides):
            bm.faces.new((ring[s], ring[(s + 1) % sides], tip) if direction > 0 else (ring[(s + 1) % sides], ring[s], tip))


def calda(bm, monte, expoente, seed):
    """Fio de calda em zigue-zague sobre um monte de raio 1, mais grosso onde a calda acumula."""
    path, radii = [], []
    steps = 120
    for k in range(steps + 1):
        t = k / steps
        x = -0.86 + 1.72 * t
        limit = math.sqrt(max(0.0, 1 - x * x)) * 0.86
        y = math.sin(t * math.pi * 4.2 + seed * 1.7) * limit
        rho = math.hypot(x, y)
        z = dome_height(rho, monte, expoente) + 0.035
        path.append(Vector((x, y, z)))
        radii.append(0.036 * (1 + 0.35 * noise.noise(Vector((t * 9.0, seed, 0.3)))))
    tube(bm, path, radii, sides=10, flatten=0.55)


def po(bm, monte, expoente):
    """Mancha de pó polvilhado sobre o monte: arredondada, de borda irregular, um pouco fora do
    centro, com volume e grão."""
    uv = bm.loops.layers.uv.active
    center = Vector((0.32, 0.0, 0.0))
    radius = 0.52
    spokes, rings = 48, 10
    grid = [[bm.verts.new((center.x, center.y, dome_height(center.length, monte, expoente) + 0.05))]]
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
            mound = 0.035 * (1 - (i / rings) ** 2) + 0.012 * noise.noise(Vector((x * 9, y * 9, 0.4)))
            row.append(bm.verts.new((x, y, dome_height(rho, monte, expoente) + 0.015 + mound)))
        grid.append(row)
    for j in range(spokes):
        bm.faces.new((grid[0][0], grid[1][j], grid[1][(j + 1) % spokes]))
    for a, b in zip(grid[1:], grid[2:]):
        for j in range(spokes):
            k = (j + 1) % spokes
            bm.faces.new((a[j], b[j], b[k], a[k]))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=-0.012)
    for face in bm.faces:
        for loop in face.loops:
            loop[uv].uv = (loop.vert.co.x * 3 + 0.5, loop.vert.co.y * 3 + 0.5)


# ---------------------------------------------------------------- catálogo e exportação

# nome: (função, materiais, ângulo para quina viva, montinho com relevo granulado)
PIECES = {
    "granola": (granola, ["granola"], 50.0, True),
    "amendoim": (amendoim, ["amendoim"], 30.0, True),
    "pacoca": (pacoca, ["pacoca"], 40.0, True),
    "chocoball": (chocoball, ["chocolate"], 60.0, False),
    "gotas-de-chocolate": (gotas, ["chocolate"], 50.0, False),
    "sucrilhos": (sucrilhos, ["sucrilhos"], 60.0, True),
    "marshmallow": (marshmallow, ["marshmallow"], 60.0, True),
    "biscoito": (biscoito, ["biscoito"], 45.0, True),
    "canudinho": (canudinho, ["wafer"], 60.0, False),
    "bis": (bis, ["chocolate-barra"], 50.0, False),
    "kit-kat": (kit_kat, ["chocolate-ao-leite"], 50.0, False),
    "banana": (banana, ["banana"], 50.0, False),
    "kiwi": (kiwi, ["kiwi"], 50.0, False),
    "morango": (morango, ["morango"], 50.0, False),
    "cereja": (cereja, ["cereja", "cabo"], 60.0, False),
    "creme-de-avela": (creme, ["creme-avela"], 89.0, False),
    "creme-de-ninho": (creme, ["creme-ninho"], 89.0, False),
}


def build_all(names=None):
    medidas = load_medidas()
    monte = medidas["monte"]
    os.makedirs(MODELS, exist_ok=True)
    coll = collection(COLLECTION_NAME)
    mats = make_materials()

    jobs = [(name, fn, materials, angle, grain, True) for name, (fn, materials, angle, grain) in PIECES.items()]
    jobs += [
        ("calda-acai", lambda bm, rnd: calda(bm, monte["acai"], monte["expoente"], 0.0), ["calda"], 60.0, False, False),
        ("calda-shake", lambda bm, rnd: calda(bm, monte["shake"], monte["expoente"], 0.0), ["calda"], 60.0, False, False),
        ("po-acai", lambda bm, rnd: po(bm, monte["acai"], monte["expoente"]), ["po"], 60.0, False, False),
    ]

    report = []
    for index, (name, fn, materials, angle, grain, grounded) in enumerate(jobs):
        if names is not None and name not in names:
            continue
        object_name = f"topping-{name}"
        remove_object(object_name)
        bm = new_bm()
        fn(bm, random.Random(f"ads:{name}"))
        if grounded:
            sit_on_ground(bm)
        if grain:
            top_uv(bm, 0.015)
        obj = finish(bm, object_name, smooth=True, sharp_angle=angle)
        for material_name in materials:
            obj.data.materials.append(mats[material_name])
        coll.objects.link(obj)
        export_glb(obj, os.path.join(MODELS, f"{object_name}.glb"))
        obj.location = ((index % 6) * 0.08, (index // 6) * 0.08 + 0.4, 0.0)  # grade, só para ver
        report.append(f"{object_name}: {len(obj.data.polygons)} faces, {len(materials)} material(is)")
    return report


if __name__ == "__main__":
    for line in build_all():
        print(line)
    print("arquivo editável:", save_copy(BLEND))
