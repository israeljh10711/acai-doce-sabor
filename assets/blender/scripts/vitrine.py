"""
Imagens de vitrine da página inicial, renderizadas com o Cycles no processador, no estúdio de
estudio.py (luz de fotografia de comida, plástico e vidro de verdade, fundo transparente com a
sombra no chão).

Monta cada produto com os mesmos modelos GLB do site e a mesma posição de cada pedaço, lida de
assets/blender/vitrine.json (gravado por exportar-vitrine.mjs a partir do site). Faz:
  - <categoria>.png  uma imagem por cartão (acai-oca, acai-tradicional, milk-shake);
  - destaque.png     os três produtos juntos, para o destaque do topo da página inicial.

Rodar com o Blender em segundo plano (não toca no Blender aberto):
    blender --background --factory-startup --python-exit-code 1 \
        --python <projeto>/assets/blender/scripts/vitrine.py -- [pasta de saída] [amostras] [quais]

`quais` é uma lista separada por vírgulas (ex.: "destaque" ou "acai-oca,milk-shake").
"""
import json
import os
import sys

import bpy
from mathutils import Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import estudio  # noqa: E402
from comum import PROJECT  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args and args[0] else os.path.join(PROJECT, "assets", "blender", "vitrine")
SAMPLES = int(args[1]) if len(args) > 1 else 128
ONLY = args[2].split(",") if len(args) > 2 else None

# Onde cada produto fica no destaque (metros, Z para cima): o copo atrás à esquerda, o isopor
# na frente, o milk-shake atrás à direita.
DESTAQUE = {
    "acai-tradicional": Vector((-0.118, 0.05, 0.0)),
    "acai-oca": Vector((0.0, -0.035, 0.0)),
    "milk-shake": Vector((0.12, 0.055, 0.0)),
}


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


def place(template, piece, offset):
    obj = template.copy()  # mesma malha e mesmos materiais do modelo
    bpy.context.scene.collection.objects.link(obj)
    obj.location = three_to_blender(piece["position"]) + offset
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = piece_rotation(piece)
    obj.scale = (piece["scale"],) * 3
    return obj


def build(layout, offset):
    """Recipiente, base (com as faixas de creme escolhidas) e os pedaços, como no site."""
    objects = []
    for obj in estudio.import_glb(layout["containerFile"]):
        obj.location += offset
        estudio.light_through_glass(obj)
        objects.append(obj)

    if layout["baseFile"]:
        bands = layout.get("bands", [])
        for obj in estudio.import_glb(layout["baseFile"]):
            if "-camada-" in obj.name:
                band = next((b for b in bands if obj.name.startswith(b["mesh"])), None)
                if band is None:
                    bpy.data.objects.remove(obj, do_unlink=True)
                    continue
                estudio.recolor(obj, band["color"])
            elif layout.get("baseColor"):
                estudio.recolor(obj, layout["baseColor"])
            obj.location += offset
            objects.append(obj)

    for topping in layout["toppings"]:
        templates = estudio.import_glb(topping["file"])
        for template in templates:
            if topping.get("color"):
                estudio.recolor(template, topping["color"])
        for piece in topping["pieces"]:
            for template in templates:
                objects.append(place(template, piece, offset))
        for template in templates:
            bpy.data.objects.remove(template, do_unlink=True)
    return objects


def render_scene(name, layouts, width, height, elevation, azimuth, margin):
    estudio.clear()
    scene = bpy.context.scene
    estudio.setup_cycles(scene, width, height, SAMPLES)
    objects = []
    for layout, offset in layouts:
        objects += build(layout, offset)
    estudio.ground(2.0)
    lo, hi = estudio.bounds(objects)
    center = (lo + hi) / 2
    size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
    estudio.studio((center.x, center.y, (hi.z - lo.z) * 0.4), scale=max(0.6, size / 0.22))
    estudio.frame_camera(scene, objects, elevation=elevation, azimuth=azimuth, margin=margin, lens=70)
    estudio.render(scene, os.path.join(OUT, f"{name}.png"))


with open(os.path.join(PROJECT, "assets", "blender", "vitrine.json"), encoding="utf-8") as file:
    vitrine = json.load(file)

for slug in [s for s in vitrine if ONLY is None or s in ONLY]:
    render_scene(slug, [(vitrine[slug]["layout"], Vector((0, 0, 0)))], 1200, 900, 22.0, -22.0, 0.07)

if ONLY is None or "destaque" in ONLY:
    layouts = [(vitrine[slug]["layout"], DESTAQUE[slug]) for slug in ("acai-tradicional", "milk-shake", "acai-oca")]
    render_scene("destaque", layouts, 1600, 1200, 16.0, -14.0, 0.05)
