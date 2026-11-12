"""
Foto de conferência com o Cycles: modelos de public/models lado a lado, no estúdio de estudio.py.

    blender --background --factory-startup --python-exit-code 1 --python conferir_render.py -- \
        <saída.png> <modelo1,modelo2+...> [amostras] [largura] [altura] [elevação]

Cada item é o nome de um GLB sem a extensão; itens ligados por "&" ficam no mesmo lugar
(recipiente e base). Com "+creme", as faixas de creme da base aparecem
(a primeira cor de leite condensado, a segunda de creme de avelã); sem isso, elas somem, como no
site. Com "@#cor", a cor do material é trocada (calda, pó, sabor do milk-shake).
"""
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import estudio  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
out = args[0]
items = args[1].split(",")
samples = int(args[2]) if len(args) > 2 else 40
width = int(args[3]) if len(args) > 3 else 1400
height = int(args[4]) if len(args) > 4 else 640
elevation = float(args[5]) if len(args) > 5 else 16.0

def load(item):
    name, _, color = item.partition("@")
    show_cream = name.endswith("+creme")
    name = name.removesuffix("+creme")
    meshes = estudio.import_glb(name)
    for mesh in list(meshes):
        if "camada" in mesh.name:
            if not show_cream:
                bpy.data.objects.remove(mesh, do_unlink=True)
                meshes.remove(mesh)
            else:
                estudio.recolor(mesh, "#fbf0d2" if mesh.name.endswith("1") else "#4a2a18")
        elif color:
            estudio.recolor(mesh, color)
    return meshes


estudio.clear()
scene = bpy.context.scene
estudio.setup_cycles(scene, width, height, samples)

placed = []
x = 0.0
for group in items:
    meshes = []
    for item in group.split("&"):
        meshes += load(item)
    lo, hi = estudio.bounds(meshes)
    width_x = hi.x - lo.x
    for mesh in meshes:
        mesh.location.x += x - lo.x
        estudio.light_through_glass(mesh)
    x += width_x + 0.025
    placed += meshes

estudio.ground(2.0)
lo, hi = estudio.bounds(placed)
center = (lo + hi) / 2
size = max(hi.x - lo.x, hi.z - lo.z)
estudio.studio((center.x, center.y, (hi.z - lo.z) * 0.45), scale=max(0.6, size / 0.25))
estudio.frame_camera(scene, placed, elevation=elevation, azimuth=-12.0, margin=0.04, lens=85)
estudio.render(scene, os.path.abspath(out))
