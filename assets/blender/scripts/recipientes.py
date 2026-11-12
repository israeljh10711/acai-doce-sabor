"""
Recipientes e bases do Açaí Doce Sabor, gerados a partir de src/features/configurator-3d/medidas.json.

Cria, numa coleção própria ("ADS Recipientes") da cena aberta:
  - container-<tamanho>       pote, copo e isopor de açaí; copo de vidro facetado de milk-shake
  - base-acai-<tamanho>       açaí preenchendo o recipiente, com o monte acima da borda
  - base-shake-<tamanho>      milk-shake preenchendo o copo, com a espuma
Exporta um GLB por objeto em public/models/ e grava uma cópia editável em assets/blender/recipientes.blend.

Rodar com o Blender em segundo plano (não toca no Blender aberto):
    blender --background --factory-startup --python-exit-code 1 --python <projeto>/assets/blender/scripts/recipientes.py

Escala real em metros, origem na base do recipiente, Z para cima no Blender (Y para cima no GLB).
"""
import math
import os
import sys

from mathutils import Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import (  # noqa: E402
    MODELS,
    PROJECT,
    collection,
    export_glb,
    lathe,
    load_medidas,
    material,
    remove_object,
    save_copy,
)

BLEND = os.path.join(PROJECT, "assets", "blender", "recipientes.blend")
COLLECTION_NAME = "ADS Recipientes"

ROUND_SEGMENTS = 56
SHAKE_SEGMENTS = 10  # copo de vidro facetado, como o das referências do proprietário
SHAKE_BASE = 0.012   # fundo grosso do copo de vidro
GAP = 0.0004         # folga entre a base e a parede, para não atravessar

MATERIALS = {
    "pp": dict(color="#f4f1ec", roughness=0.35, alpha=0.42),        # pote de polipropileno, fosco
    "pet": dict(color="#ffffff", roughness=0.06, alpha=0.2),         # copo de PET, transparente
    "eps": dict(color="#f7f4ee", roughness=0.9),                     # isopor
    "vidro": dict(color="#f2f6fa", roughness=0.04, alpha=0.24),      # copo de vidro do milk-shake
    "acai": dict(color="#4a1550", roughness=0.36, coat=0.25),        # açaí cremoso
    "shake": dict(color="#eadfce", roughness=0.55),                  # cor neutra; o site troca pelo sabor
}
CONTAINER_MATERIAL = {"pote": "pp", "copo": "pet", "isopor": "eps", "shake": "vidro"}


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


def dome_geometry(m, monte, fill_fraction):
    """Onde começa o monte, o raio e a altura dele. A cena do site usa a mesma conta."""
    top = m["altura"] * fill_fraction
    dome_r = outer_radius(m, top) - m["parede"] - GAP
    dome_h = monte * (m["raioBoca"] - m["parede"])
    return top, dome_r, dome_h


def base_profile(m, monte, expoente, fill_fraction):
    w = m["parede"]
    floor = bottom_height(m) + 0.0003
    top, dome_r, dome_h = dome_geometry(m, monte, fill_fraction)
    e = 2 / expoente  # superelipse: monte cheio, de topo arredondado
    points = [(0.0, floor), (outer_radius(m, floor) - w - GAP, floor), (dome_r, top)]
    steps = 14
    for k in range(1, steps + 1):
        t = (math.pi / 2) * k / steps
        x = dome_r * (math.cos(t) ** e) if k < steps else 0.0
        points.append((x, top + dome_h * (math.sin(t) ** e)))
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


def fill_fraction(m, product):
    return 0.9 if product == "shake" else 1.0 - 0.0015 / m["altura"]


def all_entries(medidas):
    """(chave, tamanho, medidas, produto) de todos os recipientes, na ordem da tabela."""
    entries = [(s, s, m, "acai") for s, m in medidas["acai"].items()]
    entries += [(f"shake-{s}", s, m, "shake") for s, m in medidas["shake"].items()]
    return entries


def build_entries(keys=None):
    """Cria e exporta os recipientes e as bases pedidos (todos, sem lista). Devolve um relatório."""
    medidas = load_medidas()
    monte = medidas["monte"]
    os.makedirs(MODELS, exist_ok=True)
    coll = collection(COLLECTION_NAME)
    mats = {name: material(name, **spec) for name, spec in MATERIALS.items()}

    report = []
    x = 0.0
    for key, size_id, m, product in all_entries(medidas):
        x += m["raioBoca"] + 0.03
        offset = x
        x += m["raioBoca"] + 0.03
        if keys is not None and key not in keys:
            continue

        is_shake = product == "shake"
        segments = SHAKE_SEGMENTS if is_shake else ROUND_SEGMENTS
        container_name = f"container-{key}"
        base_name = f"base-{product}-{size_id}"
        for name in (container_name, base_name):
            remove_object(name)

        container = lathe(container_name, container_profile(m), segments, smooth=not is_shake)
        container.data.materials.append(mats[CONTAINER_MATERIAL[m["tipo"]]])

        profile, top, dome_h = base_profile(m, monte[product], monte["expoente"], fill_fraction(m, product))
        base = lathe(base_name, profile, segments, smooth=True, sharp_angle=60.0,
                     displace=creamy(top, dome_h, 0.035 if is_shake else 0.06))
        base.data.materials.append(mats["shake" if is_shake else "acai"])

        for obj in (base, container):
            coll.objects.link(obj)
            obj.location.x = offset  # lado a lado, só para ver
            export_glb(obj, os.path.join(MODELS, f"{obj.name}.glb"))
        report.append(f"{container_name}: {len(container.data.polygons)} faces | "
                      f"{base_name}: {len(base.data.polygons)} faces")
    return report


if __name__ == "__main__":
    for line in build_entries():
        print(line)
    print("arquivo editável:", save_copy(BLEND))
