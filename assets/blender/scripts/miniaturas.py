"""
Miniaturas dos ingredientes, para os cartões dos personalizadores: cada ingrediente numa
tigelinha de cerâmica branca, vista de cima e de lado, com fundo transparente, no estúdio de
estudio.py. Usa os mesmos modelos GLB do site e a cor de cada calda e pó, lidas de
assets/blender/ingredientes.json (gravado por exportar-vitrine.mjs a partir do site).

Rodar com o Blender em segundo plano (não toca no Blender aberto):
    blender --background --factory-startup --python-exit-code 1 \
        --python <projeto>/assets/blender/scripts/miniaturas.py -- [pasta de saída] [amostras] [ids]
Depois, `node assets/blender/scripts/miniaturas-webp.mjs` gera as imagens do site.
"""
import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Vector, noise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import estudio  # noqa: E402
from comum import PROJECT, cylinder_uv, hex_to_linear, lathe_uv, pbr  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = args[0] if args and args[0] else os.path.join(PROJECT, "assets", "blender", "miniaturas")
SAMPLES = int(args[1]) if len(args) > 1 else 64
ONLY = args[2].split(",") if len(args) > 2 else None
SIZE = 320

# Tigelinha: raio de dentro na altura do recheio e a altura do recheio.
BOWL_R, BOWL_H, WALL = 0.034, 0.024, 0.0028
FILL_Z = 0.0175
INNER_R = BOWL_R - WALL - 0.0012


def bowl():
    """Tigelinha de cerâmica branca e lisa, de borda arredondada."""
    r, h, w = BOWL_R, BOWL_H, WALL
    profile = [(0.0, 0.0012), (r * 0.62, 0.0008), (r * 0.66, 0.0), (r * 0.72, 0.0), (r * 0.78, 0.0018)]
    profile += [(r * (0.78 + 0.22 * math.sin(t * math.pi / 2)), h * t) for t in (0.2, 0.45, 0.7, 0.9)]
    profile += [(r - w / 2 + w / 2 * math.cos(a), h - w / 2 + w / 2 * math.sin(a))
                for a in (0.0, 0.5, 1.0, 1.5, 2.0, 2.5, math.pi)]
    profile += [(r * (0.74 + 0.22 * math.sin(t * math.pi / 2)) - w, h * t) for t in (0.9, 0.7, 0.45, 0.25)]
    profile += [(r * 0.55, 0.0045), (0.0, 0.004)]
    obj = lathe_uv("tigela", profile, 72, cylinder_uv(1, 0.05))
    obj.data.materials.append(pbr("ceramica", "#f6f3ef", 0.18, coat=0.5, coat_roughness=0.06))
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mound(rho):
    """Altura do recheio na tigela: um montinho no meio."""
    return FILL_Z + 0.0055 * (1 - rho * rho)


def fill_disc(name, color, roughness, coat, height, bump=0.0, seed=0.0, material_name=None):
    """Superfície do recheio (calda, pó, creme): um disco que encosta na parede da tigela."""
    bm = bmesh.new()
    rings, spokes = 24, 96
    center = bm.verts.new((0.0, 0.0, height(0.0)))
    grid = []
    for i in range(1, rings + 1):
        rho = i / rings
        row = []
        for j in range(spokes):
            a = 2 * math.pi * j / spokes
            x, y = INNER_R * rho * math.cos(a), INNER_R * rho * math.sin(a)
            z = height(rho) + bump * noise.noise(Vector((x * 520 + seed, y * 520, seed))) * min(1.0, (1 - rho) * 6)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for j in range(spokes):
        bm.faces.new((center, grid[0][j], grid[0][(j + 1) % spokes]))
    for a, b in zip(grid, grid[1:]):
        for j in range(spokes):
            k = (j + 1) % spokes
            bm.faces.new((a[j], b[j], b[k], a[k]))
    for face in bm.faces:
        face.smooth = True
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(pbr(material_name or name, color, roughness, coat=coat, coat_roughness=0.04))
    bpy.context.scene.collection.objects.link(obj)
    return obj


def import_piece(entry):
    meshes = estudio.import_glb(entry["file"])
    if entry.get("color"):
        for mesh in meshes:
            estudio.recolor(mesh, entry["color"])
    return meshes


def scatter(templates, positions, rnd, tilt=0.35, scale=1.0, lift=0.0):
    placed = []
    for x, y in positions:
        rho = math.hypot(x, y) / INNER_R
        for template in templates:
            obj = template.copy()
            bpy.context.scene.collection.objects.link(obj)
            obj.location = (x, y, mound(min(rho, 1.0)) + lift)
            obj.rotation_mode = "XYZ"  # o importador do glTF deixa em quatérnio
            obj.rotation_euler = Euler((rnd.uniform(-tilt, tilt), rnd.uniform(-tilt, tilt), rnd.uniform(0, 6.3)))
            obj.scale = (scale,) * 3
            placed.append(obj)
    for template in templates:
        bpy.data.objects.remove(template, do_unlink=True)
    return placed


def ring_positions(count, radius, offset=0.0):
    return [(radius * math.cos(offset + 2 * math.pi * k / count), radius * math.sin(offset + 2 * math.pi * k / count))
            for k in range(count)]


def fill(entry_id, entry, rnd):
    """Coloca o ingrediente na tigela, do jeito que ele aparece na vida real."""
    placement = entry["placement"]
    if placement == "drizzle":
        # calda: a tigela cheia de calda brilhante
        fill_disc("calda", entry["color"], 0.06, 1.0, lambda rho: FILL_Z + 0.002 * (1 - rho ** 4))
        return
    if placement == "patch":
        # pó: um montinho fofo
        fill_disc("po", entry["color"], 1.0, 0.0, lambda rho: FILL_Z + 0.009 * (1 - rho ** 2) ** 1.3,
                  bump=0.0011, seed=rnd.random() * 10)
        return
    # o resto fica sobre um fundo de açaí, como no copo
    fill_disc("acai", "#3b0d2b", 0.34, 0.45, lambda rho: FILL_Z - 0.001 + 0.0035 * (1 - rho * rho),
              bump=0.0003, seed=1.0)
    templates = import_piece(entry)
    if placement == "cluster":
        positions = [(0.0, 0.0)] + ring_positions(6, 0.0145, rnd.random()) + ring_positions(9, 0.0255, rnd.random())
        scatter(templates, positions, rnd, tilt=0.3, scale=1.0)
    elif placement == "slices":
        positions = ring_positions(6, 0.0155, rnd.random()) + [(0.0, 0.0)]
        scatter(templates, positions, rnd, tilt=0.25, scale=0.95, lift=0.0006)
    elif placement == "dollop":
        scatter(templates, [(0.0, 0.0)], rnd, tilt=0.05, scale=1.25)
    elif placement == "top":
        scatter(templates, [(-0.008, -0.004), (0.009, -0.003), (0.0, 0.009)], rnd, tilt=0.4, scale=1.0)
    elif placement == "stuck":
        # barras e canudinhos deitados, cruzando a tigela
        placed = []
        for k, angle in enumerate((0.5, 2.1, 1.3)):
            for template in templates:
                obj = template.copy()
                bpy.context.scene.collection.objects.link(obj)
                length = max(obj.dimensions)
                obj.rotation_mode = "XYZ"  # o importador do glTF deixa em quatérnio
                obj.rotation_euler = Euler((math.pi / 2 - 0.12, 0.0, angle))
                # deitada, a peça vai da origem na direção abaixo; o meio dela fica no meio da tigela
                direction = Vector((math.sin(angle), -math.cos(angle), 0.0))
                middle = Vector(((k - 1) * 0.004, (k - 1) * 0.009, mound(0.3) + 0.003 + k * 0.002))
                obj.location = middle - direction * (length / 2)
                placed.append(obj)
        for template in templates:
            bpy.data.objects.remove(template, do_unlink=True)


def render(entry_id, entry):
    estudio.clear()
    scene = bpy.context.scene
    estudio.setup_cycles(scene, SIZE, SIZE, SAMPLES)
    rnd = random.Random(f"miniatura:{entry_id}")
    tigela = bowl()
    fill(entry_id, entry, rnd)
    estudio.ground(1.0)
    estudio.studio((0.0, 0.0, 0.012), scale=0.6)
    # enquadra a tigela e o que passa dela (cabinho da cereja, pontas das barras)
    framed = [o for o in scene.objects if o.type == "MESH" and o.name != "chao"]
    estudio.frame_camera(scene, framed, elevation=48.0, azimuth=-18.0, margin=0.03, lens=85, center_z=0.55)
    del tigela
    estudio.render(scene, os.path.join(OUT, f"{entry_id}.png"))


with open(os.path.join(PROJECT, "assets", "blender", "ingredientes.json"), encoding="utf-8") as file:
    ingredientes = json.load(file)

for entry_id, entry in ingredientes.items():
    if ONLY is None or entry_id in ONLY:
        render(entry_id, entry)
