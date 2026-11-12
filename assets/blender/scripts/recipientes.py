"""
Recipientes e bases do Açaí Doce Sabor, gerados a partir de src/features/configurator-3d/medidas.json,
com aparência de foto: materiais físicos (transmissão, refração, verniz) e texturas de texturas.py.

Cria, numa coleção própria ("ADS Recipientes") da cena aberta:
  - container-<tamanho>       copo de PET transparente (borda enrolada e dois anéis estruturais,
                              gotas de condensação), pote de PP translúcido com aba, isopor branco
                              com textura de bolinhas e manchas de açaí na borda, copo de vidro
                              facetado do milk-shake
  - base-acai-<tamanho>       açaí preenchendo o recipiente: parede com veios e bolhas (vista pelo
                              plástico) e monte granulado com marcas de espátula. Nos copos e potes,
                              duas faixas de creme encostadas na parede (base-...-camada-1 e -2),
                              que o site só mostra quando o cliente escolhe um creme
  - base-shake-<tamanho>      milk-shake preenchendo o copo, com a espuma
Exporta um GLB por base e por recipiente em public/models/ e grava uma cópia editável em
assets/blender/recipientes.blend.

Rodar com o Blender em segundo plano (não toca no Blender aberto), depois de texturas.py:
    blender --background --factory-startup --python-exit-code 1 --python <projeto>/assets/blender/scripts/recipientes.py

Escala real em metros, origem na base do recipiente, Z para cima no Blender (Y para cima no GLB).
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import (  # noqa: E402
    MODELS,
    PROJECT,
    collection,
    cylinder_uv,
    export_glb,
    hex_to_linear,
    lathe_uv,
    load_medidas,
    pbr,
    planar_uv,
    remove_object,
    save_copy,
)

BLEND = os.path.join(PROJECT, "assets", "blender", "recipientes.blend")
COLLECTION_NAME = "ADS Recipientes"

ROUND_SEGMENTS = 96
EPS_SEGMENTS = 128   # mais divisões na borda do isopor, para as manchas de açaí
SHAKE_SEGMENTS = 10  # copo de vidro facetado, como o das referências do proprietário
SHAKE_BASE = 0.012   # fundo grosso do copo de vidro
GAP = 0.0004         # folga entre a base e a parede, para não atravessar

# Tamanho de cada ladrilho das texturas, em metros.
TILE_GOTAS = 0.03
TILE_ISOPOR = 0.026
TILE_TOPO = 0.03
TILE_LADO = (0.10, 0.05)  # volta, altura

CONTAINER_MATERIAL = {"pote": "pp", "copo": "pet", "isopor": "eps", "shake": "vidro"}
# Altura do centro de cada faixa de creme, em fração da altura do açaí.
BANDS = {"copo": (0.36, 0.68), "pote": (0.34, 0.7)}
BAND_HALF = {"copo": 0.0062, "pote": 0.0042}


def make_materials():
    return {
        # PET: transparente e brilhante, com gotinhas de condensação no relevo
        "pet": pbr("pet", "#ffffff", 0.12, transmission=0.92, ior=1.49,
                   normal_map="pet-gotas-relevo", normal_strength=0.6),
        # polipropileno: translúcido e fosco
        "pp": pbr("pp", "#f6f4ef", 0.16, transmission=0.97, ior=1.49),
        # isopor: branco, bolinhas no relevo, manchas de açaí na cor por vértice
        "eps": pbr("eps", "#ffffff", 0.84, vertex_color=True, normal_map="isopor-relevo",
                   normal_strength=0.32),
        "vidro": pbr("vidro", "#f7fbff", 0.03, transmission=1.0, ior=1.5),
        # açaí: roxo bem escuro, cremoso e granulado, com um verniz leve de umidade
        "acai": pbr("acai", "#3b0d2b", 0.34, normal_map="acai-topo-relevo", normal_strength=0.9,
                    coat=0.45, coat_roughness=0.14),
        "acai-lado": pbr("acai-lado", roughness=0.3, base_map="acai-lado-cor",
                         normal_map="acai-lado-relevo", normal_strength=0.8, coat=0.25,
                         coat_roughness=0.2),
        # faixa de creme: cor neutra, o site troca pela do creme escolhido
        "camada": pbr("camada", "#fff4d8", 0.36, normal_map="acai-topo-relevo", normal_strength=0.45,
                      coat=0.15, coat_roughness=0.3),
        # milk-shake: cor neutra, o site troca pela do sabor
        "shake": pbr("shake", "#eadfce", 0.6, normal_map="acai-topo-relevo", normal_strength=0.45),
        "shake-lado": pbr("shake-lado", "#eadfce", 0.48, normal_map="acai-lado-relevo",
                          normal_strength=0.5, coat=0.1),
    }


# ---------------------------------------------------------------- perfis

def outer_radius(m, z):
    return m["raioFundo"] + (m["raioBoca"] - m["raioFundo"]) * (z / m["altura"])


def arc(cx, cz, radius, a0, a1, steps):
    return [(cx + radius * math.cos(a0 + (a1 - a0) * k / steps),
             cz + radius * math.sin(a0 + (a1 - a0) * k / steps)) for k in range(steps + 1)]


def bulge(m, z0, height, out):
    """Anel estrutural: saliência suave na parede de fora."""
    return [(outer_radius(m, z0 + t * height / 2) + out * math.cos(t * math.pi / 2) ** 2, z0 + t * height / 2)
            for t in (-1.0, -0.6, -0.25, 0.25, 0.6, 1.0)]


def inner_floor(m):
    """Altura do fundo por dentro: onde a base de açaí apoia."""
    return {"copo": 0.0022, "pote": m["parede"] + 0.0009, "isopor": m["parede"] * 1.2,
            "shake": SHAKE_BASE}[m["tipo"]]


def copo_profile(m):
    R, r, h, w = m["raioBoca"], m["raioFundo"], m["altura"], m["parede"]
    points = [(0.0, 0.0018), (r * 0.5, 0.0014), (r - 0.0022, 0.0003), (r - 0.0012, 0.0),
              (r - 0.0004, 0.0001), (r, 0.0008)]
    points += [(outer_radius(m, z), z) for z in (0.006, h * 0.3, h * 0.6, h - 0.019)]
    points += bulge(m, h - 0.0145, 0.0016, 0.00055)
    points += bulge(m, h - 0.0085, 0.0016, 0.00055)
    bead = 0.0009  # borda enrolada do PET
    points.append((outer_radius(m, h - 0.0035), h - 0.0035))
    points += arc(R - 0.0001, h - bead, bead, -math.pi / 2, math.pi, 12)
    floor = inner_floor(m)
    points += [(outer_radius(m, z) - w, z) for z in (h - 0.0022, h * 0.5, 0.006)]
    points += [(outer_radius(m, floor) - w - 0.0004, floor), (0.0, floor + 0.0004)]
    return points


def pote_profile(m):
    R, r, h, w = m["raioBoca"], m["raioFundo"], m["altura"], m["parede"]
    points = [(0.0, 0.0012), (r * 0.6, 0.001), (r - 0.0015, 0.0), (r - 0.0004, 0.0002), (r, 0.0009)]
    points += [(outer_radius(m, z), z) for z in (0.005, h * 0.5, h - 0.0095)]
    points += bulge(m, h - 0.0068, 0.0014, 0.0004)
    # aba para a tampa encaixar, com a ponta arredondada
    points += [(outer_radius(m, h - 0.0042), h - 0.0042), (R + 0.0019, h - 0.0038)]
    points += arc(R + 0.0021, h - 0.0019, 0.0019, -math.pi / 2, math.pi / 2, 6)
    points += [(R - w, h), (R - w, h - 0.0012)]
    floor = inner_floor(m)
    points += [(outer_radius(m, z) - w, z) for z in (h - 0.004, h * 0.5, floor + 0.0012)]
    points += [(outer_radius(m, floor) - w - 0.0003, floor), (0.0, floor + 0.0002)]
    return points


def isopor_profile(m):
    R, r, h, w = m["raioBoca"], m["raioFundo"], m["altura"], m["parede"]
    points = [(0.0, 0.0015), (r - 0.004, 0.0012), (r - 0.0025, 0.0), (r - 0.001, 0.0), (r, 0.0012)]
    points += [(outer_radius(m, z), z) for z in (0.004, h * 0.5, h - w)]
    points += arc(R - w / 2, h - w / 2, w / 2, 0.0, math.pi, 12)[1:]  # borda redonda
    # parede de dentro, com anéis próximos perto da borda (onde ficam as manchas)
    for z in (h - w / 2 - 0.0012, h - w / 2 - 0.0026, h - w / 2 - 0.0045, h - w / 2 - 0.007, h * 0.6, h * 0.3):
        points.append((outer_radius(m, z) - w, z))
    floor = inner_floor(m)
    points += [(outer_radius(m, floor) - w - 0.001, floor), (0.0, floor)]
    return points


def shake_profile(m):
    R, r, h, w = m["raioBoca"], m["raioFundo"], m["altura"], m["parede"]
    chamfer = min(0.0015, r * 0.05)
    points = [(0.0, 0.0), (r - chamfer, 0.0), (r, chamfer), (R, h - w / 2)]
    points += arc(R - w / 2, h - w / 2, w / 2, 0.0, math.pi, 6)[1:]
    floor = inner_floor(m)
    points += [(outer_radius(m, floor) - w, floor), (0.0, floor)]
    return points


PROFILES = {"copo": copo_profile, "pote": pote_profile, "isopor": isopor_profile, "shake": shake_profile}


def eps_colors(m, seed):
    """Isopor branco, com manchas de açaí na borda de dentro, como nas fotos de referência."""
    R, h, w = m["raioBoca"], m["altura"], m["parede"]
    white = hex_to_linear("#f6f5f0")
    light, dark = hex_to_linear("#9a5b8b"), hex_to_linear("#4d1440")

    def color(co):
        radius = math.hypot(co.x, co.y)
        if co.z < h - w / 2 - 0.0075 or radius > R - w / 2:
            return white
        theta = math.atan2(co.y, co.x)
        p = Vector((math.cos(theta) * 2.6, math.sin(theta) * 2.6, seed))
        q = Vector((math.cos(theta) * 8.0, math.sin(theta) * 8.0, seed + 3.0 + co.z * 300))
        n = noise.noise(p) + 0.55 * noise.noise(q)
        amount = min(max((n - 0.08) * 2.4, 0.0), 1.0)
        # a mancha fica mais fraca no alto da borda
        amount *= 0.45 + 0.55 * min(max((h - co.z) / (w * 0.55), 0.0), 1.0)
        if amount <= 0:
            return white
        stain = tuple(a + (b - a) * min(amount * 1.3, 1.0) for a, b in zip(light, dark))
        return tuple(a + (b - a) * min(amount * 1.6, 1.0) for a, b in zip(white, stain))
    return color


# ---------------------------------------------------------------- base (açaí ou milk-shake)

def dome_geometry(m, monte, fill_fraction):
    """Onde começa o monte, o raio e a altura dele. A cena do site usa a mesma conta."""
    top = m["altura"] * fill_fraction
    dome_r = outer_radius(m, top) - m["parede"] - GAP
    dome_h = monte * (m["raioBoca"] - m["parede"])
    return top, dome_r, dome_h


def base_profile(m, monte, expoente, fill_fraction):
    """Perfil da base: fundo, parede (encostada no recipiente) e o monte (superelipse).
    Devolve também o índice do anel onde a parede termina e o monte começa."""
    w = m["parede"]
    floor = inner_floor(m) + 0.0003
    top, dome_r, dome_h = dome_geometry(m, monte, fill_fraction)
    points = [(0.0, floor), (outer_radius(m, floor) - w - GAP, floor)]
    rings = max(2, round((top - floor) / 0.006))
    points += [(outer_radius(m, floor + (top - floor) * k / rings) - w - GAP,
                floor + (top - floor) * k / rings) for k in range(1, rings + 1)]
    wall_top = len(points) - 1
    e = 2 / expoente  # superelipse: monte cheio, de topo arredondado
    steps = 40
    for k in range(1, steps + 1):
        t = (math.pi / 2) * k / steps
        x = dome_r * (math.cos(t) ** e) if k < steps else 0.0
        points.append((x, top + dome_h * (math.sin(t) ** e)))
    return points, wall_top, top, dome_r, dome_h


def spatula(top, dome_r, dome_h, seed, strength):
    """Marcas de espátula no monte: faixas em espiral que sobem devagar e caem de repente,
    mais um ondulado irregular. Somem na borda (que encosta na parede) e no topo."""
    def displace(vert):
        if vert.co.z <= top + 1e-6:
            return
        x, y = vert.co.x, vert.co.y
        rho = min(math.hypot(x, y) / dome_r, 1.0)
        theta = math.atan2(y, x)
        fade = math.sqrt(max(0.0, 1 - rho * rho)) * min(1.0, rho * 3.5 + 0.15)
        stroke = ((theta * 2.0 - rho * 9.5 + seed) / (2 * math.pi)) % 1.0
        ridge = stroke ** 1.7 - 0.37
        lumps = noise.noise(Vector((x / dome_r * 1.7, y / dome_r * 1.7, seed)))
        vert.co.z += fade * dome_h * strength * (ridge * 0.05 + lumps * 0.06)
    return displace


def band(name, m, center, half, seed, segments, mat):
    """Faixa de creme encostada na parede, entre o açaí e o plástico, de bordas onduladas.
    Superfície única virada para fora: só é vista através do recipiente."""
    w = m["parede"]

    def wave(theta, offset):
        p = Vector((math.cos(theta) * 1.9, math.sin(theta) * 1.9, seed + offset))
        q = Vector((math.cos(theta) * 5.5, math.sin(theta) * 5.5, seed + offset + 7))
        return half * (0.55 * noise.noise(p) + 0.3 * noise.noise(q))

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    rows = 6
    grid = []
    for row in range(rows):
        t = row / (rows - 1)
        ring = []
        for i in range(segments):
            theta = 2 * math.pi * i / segments
            lower = center - half + wave(theta, 0.0)
            upper = center + half + wave(theta, 11.0)
            z = lower + (upper - lower) * t
            r = outer_radius(m, z) - w - GAP * 0.5
            ring.append(bm.verts.new((r * math.cos(theta), r * math.sin(theta), z)))
        grid.append(ring)
    for row in range(rows - 1):
        lower, upper = grid[row], grid[row + 1]
        for i in range(segments):
            j = (i + 1) % segments
            face = bm.faces.new((lower[i], lower[j], upper[j], upper[i]))  # normal para fora
            face.smooth = True
            for loop, step in zip(face.loops, (i, i + 1, i + 1, i)):
                loop[uv_layer].uv = (step / segments * 6, loop.vert.co.z / TILE_TOPO)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    return obj


def facets(segments, inner):
    """Encaixa a base redonda no copo facetado: em cada ângulo, o raio do polígono de
    `segments` lados (1 nos vértices, cos(pi/n) no meio de cada face plana)."""
    def displace(vert):
        theta = math.atan2(vert.co.y, vert.co.x) % (2 * math.pi)
        phi = (theta % (2 * math.pi / segments)) - math.pi / segments
        factor = math.cos(math.pi / segments) / math.cos(phi)
        vert.co.x *= factor
        vert.co.y *= factor
        inner(vert)
    return displace


def fill_fraction(m, product):
    return 0.9 if product == "shake" else 1.0 - 0.0015 / m["altura"]


def all_entries(medidas):
    """(chave, tamanho, medidas, produto) de todos os recipientes, na ordem da tabela."""
    entries = [(s, s, m, "acai") for s, m in medidas["acai"].items()]
    entries += [(f"shake-{s}", s, m, "shake") for s, m in medidas["shake"].items()]
    return entries


def build_container(name, m, mats, seed):
    kind = m["tipo"]
    segments = {"shake": SHAKE_SEGMENTS, "isopor": EPS_SEGMENTS}.get(kind, ROUND_SEGMENTS)
    profile = PROFILES[kind](m)
    circumference = 2 * math.pi * (m["raioBoca"] + m["raioFundo"]) / 2
    if kind == "isopor":
        uv = cylinder_uv(max(1, round(circumference / TILE_ISOPOR)), TILE_ISOPOR)
    else:
        uv = cylinder_uv(max(1, round(circumference / TILE_GOTAS)), TILE_GOTAS)
    obj = lathe_uv(name, profile, segments, uv, smooth=kind != "shake",
                   color_of=eps_colors(m, seed) if kind == "isopor" else None)
    obj.data.materials.append(mats[CONTAINER_MATERIAL[kind]])
    return obj


def build_base(name, m, product, monte, mats, seed):
    is_shake = product == "shake"
    segments = SHAKE_SEGMENTS * 8 if is_shake else ROUND_SEGMENTS
    profile, wall_top, top, dome_r, dome_h = base_profile(
        m, monte[product], monte["expoente"], fill_fraction(m, product))
    circumference = 2 * math.pi * dome_r
    side_uv = cylinder_uv(max(1, round(circumference / TILE_LADO[0])), TILE_LADO[1])
    top_uv = planar_uv(TILE_TOPO)
    obj = lathe_uv(
        name, profile, segments,
        uv_of=lambda k, frac, co: side_uv(k, frac, co) if k < wall_top else top_uv(k, frac, co),
        material_of=lambda k: 1 if k < wall_top else 0,
        displace=(facets(SHAKE_SEGMENTS, spatula(top, dome_r, dome_h, seed, 0.5)) if is_shake
                  else spatula(top, dome_r, dome_h, seed, 1.0)),
        smooth=True, sharp_angle=70.0,
    )
    for key in (("shake", "shake-lado") if is_shake else ("acai", "acai-lado")):
        obj.data.materials.append(mats[key])

    bands = []
    if not is_shake and m["tipo"] in BANDS:
        for index, fraction in enumerate(BANDS[m["tipo"]], start=1):
            bands.append(band(f"{name}-camada-{index}", m, top * fraction, BAND_HALF[m["tipo"]],
                              seed + index * 5.3, ROUND_SEGMENTS, mats["camada"]))
    return obj, bands


def build_entries(keys=None):
    """Cria e exporta os recipientes e as bases pedidos (todos, sem lista). Devolve um relatório."""
    medidas = load_medidas()
    monte = medidas["monte"]
    os.makedirs(MODELS, exist_ok=True)
    coll = collection(COLLECTION_NAME)
    mats = make_materials()

    report = []
    x = 0.0
    for index, (key, size_id, m, product) in enumerate(all_entries(medidas)):
        x += m["raioBoca"] + 0.03
        offset = x
        x += m["raioBoca"] + 0.03
        if keys is not None and key not in keys:
            continue

        container_name = f"container-{key}"
        base_name = f"base-{product}-{size_id}"
        for name in (container_name, base_name, f"{base_name}-camada-1", f"{base_name}-camada-2"):
            remove_object(name)

        container = build_container(container_name, m, mats, seed=index * 1.37)
        base, bands = build_base(base_name, m, product, monte, mats, seed=index * 2.11)
        for obj in (container, base, *bands):
            coll.objects.link(obj)
        export_glb(container, os.path.join(MODELS, f"{container_name}.glb"))
        export_glb(base, os.path.join(MODELS, f"{base_name}.glb"), extra=bands)
        for obj in (container, base, *bands):
            obj.location.x += offset  # lado a lado, só para ver no arquivo editável
        report.append(f"{container_name}: {len(container.data.polygons)} faces | "
                      f"{base_name}: {len(base.data.polygons)} faces, {len(bands)} faixa(s)")
    return report


if __name__ == "__main__":
    for line in build_entries():
        print(line)
    print("arquivo editável:", save_copy(BLEND))
