"""
Imagem de conferência dos recipientes, no modo sólido (Workbench), sem iluminação de ambiente.
Usa o Workbench de propósito: a pré-visualização de materiais do EEVEE fecha o Blender neste
computador (falha registrada em 2026-11-12).

Rodar em segundo plano:
    blender --background --factory-startup <projeto>/assets/blender/recipientes.blend
            --python <projeto>/assets/blender/scripts/conferir.py -- <saida.png>
"""
import math
import sys

import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "//conferencia.png"
scene = bpy.context.scene

objs = [o for o in scene.objects if o.name.startswith(("container-", "base-"))]
for obj in scene.objects:
    if obj not in objs and obj.type == "MESH":
        obj.hide_render = True

try:
    scene.render.engine = "BLENDER_WORKBENCH"
except TypeError as error:
    print("motores disponíveis:", error)
    raise

shading = scene.display.shading
shading.light = "STUDIO"
shading.color_type = "MATERIAL"
shading.show_xray = False
shading.show_shadows = True
shading.show_cavity = True
shading.cavity_type = "BOTH"
scene.render.film_transparent = False
scene.render.resolution_x = 2400
scene.render.resolution_y = 560
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"

xs = [o.location.x for o in objs]
x_min, x_max = min(xs) - 0.09, max(xs) + 0.09
center = Vector(((x_min + x_max) / 2, 0.0, 0.06))

camera_data = bpy.data.cameras.new("conferencia")
camera_data.type = "ORTHO"
camera_data.ortho_scale = (x_max - x_min)
camera = bpy.data.objects.new("conferencia", camera_data)
scene.collection.objects.link(camera)
angle = math.radians(18)
camera.location = center + Vector((0.0, -1.0 * math.cos(angle), math.sin(angle)))
camera.rotation_euler = (math.radians(90) - angle, 0.0, 0.0)
scene.camera = camera

scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("imagem:", out)
