"""
Texturas do Açaí Doce Sabor, geradas por conta (nenhuma imagem de terceiros) e repetíveis sem
emenda. Ficam em assets/blender/texturas/ e entram nos materiais de recipientes.py e
ingredientes.py; o exportador embute cada uma no GLB que a usa, em WebP.

Mapas de relevo (normal maps) seguem a convenção do glTF e do Blender: verde para cima (+V).

Rodar dentro do Blender (usa o numpy que vem com ele), em segundo plano:
    blender --background --factory-startup --python-exit-code 1 --python <projeto>/assets/blender/scripts/texturas.py
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comum import PROJECT  # noqa: E402

OUT = os.path.join(PROJECT, "assets", "blender", "texturas")


# ---------------------------------------------------------------- ferramentas

def hexrgb(value):
    value = value.lstrip("#")
    return np.array([int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float64)


def periodic_noise(h, w, seed, beta=2.0, low=None, high=None, aniso=(1.0, 1.0)):
    """Ruído que se repete sem emenda (filtrado no espectro), média 0 e desvio 1.
    `beta` controla a suavidade; `low`/`high` cortam frequências (ciclos por pixel);
    `aniso` alonga o ruído (ex.: (1, 4) dá veios verticais)."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None] * aniso[1]
    fx = np.fft.fftfreq(w)[None, :] * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = f ** (-beta / 2)
    if low is not None:
        amp = amp / (1 + (low / f) ** 6)
    if high is not None:
        amp = amp / (1 + (f / high) ** 6)
    amp[0, 0] = 0.0
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * amp))
    return (out - out.mean()) / (out.std() + 1e-12)


def grid(h, w):
    """Coordenadas de cada pixel, de 0 a 1, com a linha 0 embaixo (como o Blender guarda)."""
    v, u = np.mgrid[0:h, 0:w]
    return (u + 0.5) / w, (v + 0.5) / h


def stamp(height, centers, radii, amount, combine="max"):
    """Calotas (gotas, bolhas, sementes) com repetição sem emenda. `amount` > 0 levanta,
    < 0 afunda. Devolve também a máscara de cobertura (0 a 1)."""
    h, w = height.shape
    mask = np.zeros_like(height)
    for (cx, cy), r in zip(centers, radii):
        ys = np.arange(int(math.floor(cy - r)) - 1, int(math.ceil(cy + r)) + 2)
        xs = np.arange(int(math.floor(cx - r)) - 1, int(math.ceil(cx + r)) + 2)
        dy = (ys + 0.5 - cy)[:, None]
        dx = (xs + 0.5 - cx)[None, :]
        cap = np.sqrt(np.clip(1 - (dx * dx + dy * dy) / (r * r), 0, None))
        idx = np.ix_(ys % h, xs % w)
        value = cap * amount * r
        if combine == "max":
            height[idx] = np.maximum(height[idx], value) if amount > 0 else np.minimum(height[idx], value)
        else:
            height[idx] += value
        mask[idx] = np.maximum(mask[idx], np.clip(cap * 4, 0, 1))
    return mask


def to_normal(height, slope):
    """Mapa de relevo a partir da altura. `slope` é a inclinação média desejada."""
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    rms = math.sqrt(float(np.mean(gx * gx + gy * gy))) + 1e-12
    k = slope / rms
    n = np.dstack((-gx * k, -gy * k, np.ones_like(height)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def to_normal_abs(height, k):
    """Como to_normal, mas com a escala fixa (para mapas quase lisos, como as gotas)."""
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    n = np.dstack((-gx * k, -gy * k, np.ones_like(height)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def smooth(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)


def save(name, rgb):
    """Grava PNG de 8 bits. Cor em sRGB (como no código hex); relevo em valores brutos."""
    os.makedirs(OUT, exist_ok=True)
    h, w = rgb.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = np.clip(rgb, 0, 1)
    image.pixels.foreach_set(rgba.ravel())
    path = os.path.join(OUT, f"{name}.png")
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    print("textura:", path, f"{w}x{h}")


# ---------------------------------------------------------------- açaí

def acai_topo():
    """Topo do açaí: cremoso e granulado, como sorvete artesanal. Ladrilho de 3 cm."""
    n = 256
    creamy = periodic_noise(n, n, 11, beta=2.8, high=0.09)
    grain = periodic_noise(n, n, 12, beta=0.4, low=0.14)
    height = creamy * 1.0 + grain * 0.18
    rng = np.random.default_rng(13)
    count = 260
    stamp(height, rng.uniform(0, n, (count, 2)), rng.uniform(0.7, 1.8, count), -0.9, combine="add")
    save("acai-topo-relevo", to_normal(height, 0.32))


def acai_lado():
    """Açaí encostado no plástico: veios do enchimento, manchas e bolhas de ar.
    Ladrilho de 10 cm (volta) por 5 cm (altura)."""
    w, h = 512, 256
    u, v = grid(h, w)
    streak = periodic_noise(h, w, 21, beta=2.2, aniso=(1.0, 3.2))
    fine = periodic_noise(h, w, 22, beta=1.1, aniso=(1.0, 1.8))
    swirl = periodic_noise(h, w, 23, beta=2.6)
    field = 0.62 * streak + 0.25 * fine + 0.35 * swirl

    dark, mid, light, smear = hexrgb("#2a081d"), hexrgb("#3b0d2b"), hexrgb("#561a4b"), hexrgb("#76386b")
    color = mix(dark[None, None, :] * np.ones((h, w, 1)), mid, smooth(-1.4, 0.6, field))
    color = mix(color, light, smooth(0.5, 1.6, field))
    color = mix(color, smear, smooth(1.5, 2.4, field) * 0.85)

    # bolhas: algumas espalhadas e alguns grupinhos
    rng = np.random.default_rng(24)
    centers = list(rng.uniform((0, 0), (w, h), (70, 2)))
    for _ in range(9):
        c = rng.uniform((0, 0), (w, h))
        centers += list(c + rng.normal(0, 7, (8, 2)))
    centers = np.array(centers)
    radii = np.clip(rng.lognormal(math.log(2.6), 0.45, len(centers)), 1.2, 8.0)
    bump = np.zeros((h, w))
    inside = stamp(bump, centers, radii, -1.0)
    bubble_in, bubble_rim = hexrgb("#55264d"), hexrgb("#14030d")
    rim = np.clip(inside * (1 - inside) * 4, 0, 1)
    color = mix(color, bubble_in, inside * 0.85)
    color = mix(color, bubble_rim, rim * 0.5)
    # brilho dentro de cada bolha (a luz bate no fundo da bolha)
    shine = np.zeros((h, w))
    stamp(shine, centers + radii[:, None] * np.array([-0.3, 0.3]), radii * 0.35, 1.0)
    color = mix(color, hexrgb("#9c6f93"), np.clip(shine * 1.6, 0, 1) * 0.45)
    save("acai-lado-cor", color)

    height = field * 0.25 + bump * 1.0
    save("acai-lado-relevo", to_normal(height, 0.22))


# ---------------------------------------------------------------- recipientes

def isopor():
    """Bolinhas do isopor (células de Voronoi). Ladrilho de 4 cm, bolinhas de ~2,5 mm."""
    n, cells = 256, 16
    cs = n / cells
    rng = np.random.default_rng(31)
    jitter = rng.uniform(0.12, 0.88, (cells, cells, 2))
    v, u = np.mgrid[0:n, 0:n]
    px, py = u + 0.5, v + 0.5
    cx, cy = (px // cs).astype(int), (py // cs).astype(int)
    f1 = np.full((n, n), 1e9)
    f2 = np.full((n, n), 1e9)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            gx, gy = cx + ox, cy + oy
            jx = jitter[gy % cells, gx % cells, 0]
            jy = jitter[gy % cells, gx % cells, 1]
            d = np.hypot(px - (gx + jx) * cs, py - (gy + jy) * cs)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            f1 = np.where(closer, d, f1)
    edge = (f2 - f1) / cs
    height = smooth(0.0, 0.16, edge) - 0.22 * (f1 / cs) ** 2
    height += periodic_noise(n, n, 32, beta=1.5) * 0.04
    save("isopor-relevo", to_normal(height, 0.55))


def gotas():
    """Condensação leve: gotinhas espalhadas no plástico, o resto liso. Ladrilho de 3 cm."""
    n = 256
    rng = np.random.default_rng(41)
    height = np.zeros((n, n))
    small = 110
    stamp(height, rng.uniform(0, n, (small, 2)), rng.uniform(1.3, 3.4, small), 0.55)
    medium = 22
    stamp(height, rng.uniform(0, n, (medium, 2)), rng.uniform(3.5, 8.5, medium), 0.55)
    save("pet-gotas-relevo", to_normal_abs(height, 0.9))


# ---------------------------------------------------------------- frutas

def banana():
    """Rodela de banana: creme com fibras radiais, miolo em três pontas com sementinhas.
    A face ocupa o disco central; o canto (0 a 0,08) é a cor lisa da lateral."""
    n = 256
    u, v = grid(n, n)
    dx, dy = u - 0.5, v - 0.5
    r = np.hypot(dx, dy) / 0.47
    ang = np.arctan2(dy, dx)

    base = hexrgb("#f4e7bd")
    color = base[None, None, :] * np.ones((n, n, 1))
    color = mix(color, hexrgb("#ead48f"), smooth(0.78, 0.98, r))
    wobble = periodic_noise(n, n, 52, beta=2.4) * 0.35
    fibers = (np.sin(ang * 38 + wobble * 6 + 2 * np.sin(ang * 5)) * 0.5 + 0.5) ** 3
    fibers *= 0.6 + 0.4 * periodic_noise(n, n, 53, beta=1.6)
    fibers *= smooth(0.25, 0.5, r) * (1 - smooth(0.92, 1.0, r))
    color = mix(color, hexrgb("#e6d29c"), np.clip(fibers, 0, 1) * 0.22)

    star = 0.17 * (1 + 0.38 * np.cos(3 * (ang - 0.4)))
    core = 1 - smooth(star * 0.8, star * 1.05, r)
    color = mix(color, hexrgb("#e2cd95"), core * 0.7)

    rng = np.random.default_rng(51)
    seeds = []
    for lobe in range(3):
        a = 0.4 + lobe * 2 * math.pi / 3
        for k in range(5):
            t = 0.05 + 0.032 * k + rng.uniform(-0.01, 0.01)
            aa = a + rng.uniform(-0.25, 0.25)
            seeds.append((0.5 + math.cos(aa) * t * 0.47, 0.5 + math.sin(aa) * t * 0.47))
    seeds = np.array(seeds) * n
    seed_mask = np.zeros((n, n))
    stamp(seed_mask, seeds, rng.uniform(1.6, 2.6, len(seeds)), 1.0)
    color = mix(color, hexrgb("#4d3622"), np.clip(seed_mask / 2.0, 0, 1))

    side = (u < 0.09) & (v < 0.09)
    color[side] = hexrgb("#efe0b2")
    save("banana-cor", color)

    height = fibers * 0.18 - core * 0.3 + seed_mask * 0.25 + smooth(0.86, 1.0, r) * 0.4
    save("banana-relevo", to_normal(height, 0.25))


def strawberry_halfwidth(y):
    """Meia largura do contorno da fatia de morango, com y de -1 (ponta) a 1 (topo).
    A mesma função está em ingredientes.py, para a malha e a textura coincidirem."""
    t = (y + 1) / 2
    return 0.86 * t ** 0.55 * np.sqrt(np.clip(1 - t ** 6, 0, None))


def morango():
    """Fatia de morango: borda vermelha, polpa rosada, miolo claro com veios. A faixa de baixo
    (v < 0,18) é a casca com sementes, que vai na lateral da fatia."""
    n = 256
    u, v = grid(n, n)
    # face: v de 0,2 a 1, x e y de -1 a 1
    fx = (u - 0.5) / 0.42
    fy = (v - 0.6) / 0.38
    w = strawberry_halfwidth(np.clip(fy, -1, 1))
    inside = (np.abs(fy) <= 1) & (np.abs(fx) <= w)
    d = np.clip(1 - np.abs(fx) / np.maximum(w, 1e-6), 0, 1)  # 0 na borda, 1 no eixo
    d = np.minimum(d, np.clip((fy + 1) * 3, 0, 1))
    d = np.minimum(d, np.clip((1 - fy) * 3, 0, 1))

    color = hexrgb("#a10d24")[None, None, :] * np.ones((n, n, 1))
    color = mix(color, hexrgb("#d9314a"), smooth(0.06, 0.22, d))
    color = mix(color, hexrgb("#f08c98"), smooth(0.25, 0.62, d))
    color = mix(color, hexrgb("#fcdcdc"), smooth(0.66, 0.92, d) * smooth(-0.75, -0.3, fy))
    # veios: linhas claras do miolo para a borda
    veins = np.abs(np.sin(np.arctan2(fy + 0.2, fx) * 9)) ** 18
    veins *= smooth(0.12, 0.45, d) * (1 - smooth(0.7, 0.95, d))
    color = mix(color, hexrgb("#ffd4d8"), veins * 0.6)
    speck = periodic_noise(n, n, 61, beta=0.8)
    color = mix(color, hexrgb("#c21b34"), np.clip(speck - 1.9, 0, 1) * 0.25)

    # casca com sementes (faixa de baixo, repete na horizontal)
    skin = v < 0.18
    skin_color = hexrgb("#b30f27")[None, None, :] * np.ones((n, n, 1))
    rng = np.random.default_rng(62)
    seeds = []
    for row in range(3):
        for col in range(11):
            seeds.append(((col + 0.5 * (row % 2) + rng.uniform(-0.15, 0.15)) * n / 11,
                          (row + 0.5) * 0.18 * n / 3 + rng.uniform(-1.5, 1.5)))
    seeds = np.array(seeds)
    dimple = np.zeros((n, n))
    stamp(dimple, seeds, np.full(len(seeds), 4.2), -1.0)
    seed_bump = np.zeros((n, n))
    seed_mask = stamp(seed_bump, seeds, np.full(len(seeds), 1.9), 1.0)
    skin_color = mix(skin_color, hexrgb("#7d0918"), np.clip(-dimple / 4, 0, 1) * 0.6)
    skin_color = mix(skin_color, hexrgb("#e9c45a"), seed_mask)
    color[skin] = skin_color[skin]
    color[~inside & ~skin] = hexrgb("#a10d24")
    save("morango-cor", color)

    height = np.where(inside, d * 0.6 + veins * 0.12, 0.0)
    height = np.where(skin, dimple * 0.25 + seed_bump * 0.35, height)
    save("morango-relevo", to_normal(height, 0.3))


def kiwi():
    """Rodela de kiwi: verde com raios claros, miolo creme e sementes pretas em volta.
    O canto (0 a 0,08) é a casca marrom da lateral."""
    n = 256
    u, v = grid(n, n)
    dx, dy = u - 0.5, v - 0.5
    r = np.hypot(dx / 1.0, dy / 0.92) / 0.47
    ang = np.arctan2(dy, dx)
    color = hexrgb("#6fa833")[None, None, :] * np.ones((n, n, 1))
    color = mix(color, hexrgb("#8fc24a"), smooth(0.9, 0.3, r))
    rays = np.abs(np.sin(ang * 26)) ** 6 * smooth(0.2, 0.5, r) * (1 - smooth(0.85, 0.97, r))
    color = mix(color, hexrgb("#b7d97a"), rays * 0.45)
    color = mix(color, hexrgb("#d7e3a0"), 1 - smooth(0.22, 0.34, r))
    color = mix(color, hexrgb("#f4f1d2"), 1 - smooth(0.12, 0.22, r))
    color = mix(color, hexrgb("#5d4a22"), smooth(0.95, 1.0, r))

    rng = np.random.default_rng(71)
    seed_mask = np.zeros((n, n))
    for k in range(44):
        a = 2 * math.pi * k / 44 + rng.uniform(-0.05, 0.05)
        rr = rng.uniform(0.27, 0.4) * 0.47
        for step in (0.0, 0.012):
            cx = 0.5 + math.cos(a) * (rr + step)
            cy = 0.5 + math.sin(a) * (rr + step) * 0.92
            stamp(seed_mask, np.array([[cx * n, cy * n]]), np.array([1.7]), 1.0)
    color = mix(color, hexrgb("#17110b"), np.clip(seed_mask / 1.7, 0, 1))
    side = (u < 0.09) & (v < 0.09)
    color[side] = hexrgb("#7a5a2e")
    save("kiwi-cor", color)
    save("kiwi-relevo", to_normal(rays * 0.2 + seed_mask * 0.2 - (1 - smooth(0.12, 0.3, r)) * 0.2, 0.22))


# ---------------------------------------------------------------- uso geral

def grao():
    """Relevo granulado para paçoca, biscoito, pó e cremes. Ladrilho de 1,5 cm."""
    n = 128
    height = periodic_noise(n, n, 81, beta=1.0) + periodic_noise(n, n, 82, beta=0.3, low=0.2) * 0.3
    save("grao-relevo", to_normal(height, 0.35))


if __name__ == "__main__":
    for job in (acai_topo, acai_lado, isopor, gotas, banana, morango, kiwi, grao):
        job()
