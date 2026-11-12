"""
Montagem de teste, só para conferência: pote de 530 ml com calda, pó e peças sobre o monte,
posicionados com a mesma conta que o site vai usar (raio e altura do monte, superelipse).
Não exporta nada novo além do que os scripts de modelagem já exportam.

    blender --background --factory-startup --python <projeto>/assets/blender/scripts/montagem_teste.py -- <saida.png>
"""
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
import comum  # noqa: E402
import ingredientes  # noqa: E402
import recipientes  # noqa: E402

extra = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = extra[0] if extra else "//montagem.png"
view_elevation = extra[1] if len(extra) > 1 else "28"

medidas = comum.load_medidas()
size = "pote-530"
m = medidas["acai"][size]
monte = medidas["monte"]

recipientes.build_entries([size])
ingredientes.build_all(["calda-acai", "po-acai", "granola", "morango", "banana", "cereja", "kit-kat",
                        "creme-de-ninho", "chocoball"])

top, dome_r, dome_h = recipientes.dome_geometry(m, monte["acai"], recipientes.fill_fraction(m, "acai"))
for name in ("container-pote-530", "base-acai-pote-530"):
    bpy.data.objects[name].location = (0, 0, 0)


def surface(rho, angle):
    """Ponto sobre o monte, com rho de 0 a 1 e o ângulo em radianos."""
    z = top + dome_r * comum.dome_height(rho, monte["acai"], monte["expoente"])
    return Vector((rho * dome_r * math.cos(angle), rho * dome_r * math.sin(angle), z))


used = set()


def place(name, rho, angle, yaw=0.0, tilt=0.0):
    """Cópia da peça sobre o monte. As cópias dividem a mesma malha, como as instâncias do site."""
    used.add(name)
    obj = bpy.data.objects[f"topping-{name}"].copy()
    obj.name = f"montagem-{name}"
    bpy.context.scene.collection.objects.link(obj)
    obj.location = surface(rho, angle) - Vector((0, 0, 0.001))
    obj.rotation_euler = Euler((tilt, 0.0, yaw))
    return obj


# camadas normalizadas: escala pelo raio do monte, apoiadas no topo do recipiente
for name, yaw in (("calda-acai", 0.4), ("po-acai", 2.2)):
    obj = bpy.data.objects[f"topping-{name}"]
    obj.location = (0, 0, top)
    obj.scale = (dome_r, dome_r, dome_r)
    obj.rotation_euler = (0, 0, yaw)

for k in range(10):
    place("granola", 0.35 + 0.5 * ((k * 37) % 10) / 10, k * 2.4, yaw=k, tilt=0.3)
for k in range(5):
    place("chocoball", 0.3 + 0.12 * k, 4.0 + k * 0.5)
for k, (rho, angle) in enumerate(((0.55, 0.3), (0.6, 2.4), (0.5, 4.4))):
    place("banana", rho, angle, yaw=k, tilt=0.35)
for k, (rho, angle) in enumerate(((0.5, 1.3), (0.62, 3.4), (0.45, 5.4))):
    place("morango", rho, angle, yaw=k * 2, tilt=0.3)
place("creme-de-ninho", 0.2, 2.9)
place("cereja", 0.0, 0.0)
place("kit-kat", 0.42, 0.8, yaw=0.5, tilt=0.35)

# Os originais das peças ficam numa grade longe do pote; saem da imagem.
for name in used:
    bpy.data.objects.remove(bpy.data.objects[f"topping-{name}"], do_unlink=True)

conferir = os.path.join(here, "conferir.py")
sys.argv = [sys.argv[0], "--", out,
            "container-pote-530,base-acai-pote-530,topping-calda-acai,topping-po-acai,montagem-",
            view_elevation, "1400", "1100"]
exec(compile(open(conferir, encoding="utf-8").read(), conferir, "exec"), {"__name__": "__main__"})
