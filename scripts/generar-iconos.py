#!/usr/bin/env python3
"""Genera icons/icon-*.png (PLACEHOLDER: un carrito simple, no un diseño final).

Toma los colores de los tokens de css/estilos.css (--color-primario y
--color-texto-sobre-primario del bloque :root) para no duplicarlos. Requiere Pillow.
Uso: python3 scripts/generar-iconos.py
"""
import re
from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
TAMANOS = [16, 32, 48, 180, 192, 512]
SUPER = 4  # se dibuja a 4x y se reduce, para bordes suaves


def token(nombre):
    css = (RAIZ / "css" / "estilos.css").read_text(encoding="utf-8")
    bloque = css[css.index(":root {"):css.index("\n}", css.index(":root {"))]
    m = re.search(r"--" + re.escape(nombre) + r":\s*(#[0-9A-Fa-f]{6})", bloque)
    if not m:
        raise SystemExit("No encontré el token --" + nombre)
    h = m.group(1)
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def dibujar(lado, fondo, tinta):
    L = lado * SUPER
    img = Image.new("RGB", (L, L), fondo)
    d = ImageDraw.Draw(img)
    u = L / 24.0  # mismas proporciones que el ícono shopping-cart de Lucide (viewBox 24)
    g = max(1, round(1.9 * u))
    # Margen de seguridad: el carrito ocupa el ~60% central (sirve también como "maskable").
    def p(x, y):
        return (L * 0.2 + x * u * 0.6, L * 0.2 + y * u * 0.6 + u * 0.6)
    d.line([p(2, 2), p(4.5, 2), p(7, 14.5), p(18.5, 14.5), p(20.5, 6), p(5.3, 6)], fill=tinta, width=g, joint="curve")
    for cx in (8, 18):
        x, y = p(cx, 19)
        r = 1.6 * u * 0.6
        d.ellipse([x - r, y - r, x + r, y + r], fill=tinta)
    return img.resize((lado, lado), Image.LANCZOS)


def main():
    fondo, tinta = token("color-primario"), token("color-texto-sobre-primario")
    for t in TAMANOS:
        destino = RAIZ / "icons" / ("icon-%d.png" % t)
        dibujar(t, fondo, tinta).save(destino, optimize=True)
        print("escrito", destino.relative_to(RAIZ))


if __name__ == "__main__":
    main()
