"""
Imagem de conferência no modo sólido (Workbench), sem iluminação de ambiente.
Usa o Workbench de propósito: a pré-visualização de materiais do EEVEE fecha o Blender neste
computador (falha registrada em 2026-11-12).

Rodar em segundo plano, com um arquivo do projeto:
    blender --background --factory-startup <arquivo.blend> --python <projeto>/assets/blender/scripts/conferir.py
            -- <saida.png> <prefixos separados por vírgula> [elevação em graus] [largura] [altura] [prefixos a excluir]
"""
import math
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = args[0] if args else "//conferencia.png"
prefixes = tuple(args[1].split(",")) if len(args) > 1 else ("container-", "base-")
elevation = math.radians(float(args[2])) if len(args) > 2 else math.radians(18)
width = int(args[3]) if len(args) > 3 else 2400
height = int(args[4]) if len(args) > 4 else 560
exclude = tuple(args[5].split(",")) if len(args) > 5 else ()

scene = bpy.context.scene
objs = [o for o in scene.objects if o.type == "MESH" and o.name.startswith(prefixes) and not o.name.startswith(exclude)]
for obj in scene.objects:
    if obj.type == "MESH":
        obj.hide_render = obj not in objs

try:
    scene.render.engine = "BLENDER_WORKBENCH"
except TypeError as error:
    print("motores disponíveis:", error)
    raise

shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "MATERIAL"
shading.show_shadows = True
shading.show_cavity = True
shading.cavity_type = "BOTH"
scene.render.resolution_x = width
scene.render.resolution_y = height
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"

# Caixa de todos os objetos, no espaço do mundo. A atualização faz valer as posições
# mudadas há pouco por outro script (sem ela, matrix_world ainda é a antiga).
bpy.context.view_layer.update()
corners = [obj.matrix_world @ Vector(corner) for obj in objs for corner in obj.bound_box]
lo = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
hi = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
center = (lo + hi) / 2
size = hi - lo

camera_data = bpy.data.cameras.new("conferencia")
camera_data.type = "ORTHO"
aspect = width / height
visible_height = size.z * math.cos(elevation) + size.y * math.sin(elevation)
camera_data.ortho_scale = max(size.x, visible_height * aspect) * 1.12
camera = bpy.data.objects.new("conferencia", camera_data)
scene.collection.objects.link(camera)
camera.location = center + Vector((0.0, -math.cos(elevation), math.sin(elevation))) * (size.length + 1.0)
camera.rotation_euler = (math.radians(90) - elevation, 0.0, 0.0)
camera_data.clip_end = size.length * 4 + 10
scene.camera = camera

scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("imagem:", out)
