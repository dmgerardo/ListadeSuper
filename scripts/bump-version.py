#!/usr/bin/env python3
"""Sube APP_VERSION en js/app-version.js y sw.js, y el ?v=N de los <script>/<link> en los
HTML, cuando el commit toca archivos .js o .css. Lo invoca .githooks/pre-commit."""
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARCHIVO_VERSION = RAIZ / "js" / "app-version.js"
ARCHIVO_SW = RAIZ / "sw.js"
PATRON_VERSION_JS = re.compile(r'const APP_VERSION = "(\d+)";')
PATRON_VERSION_SW = re.compile(r'const APP_VERSION = "(\d+)";')
PATRON_QUERY = re.compile(r'(\.(?:js|css))\?v=\d+')


def archivos_staged():
    salida = subprocess.run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        cwd=RAIZ, capture_output=True, text=True, check=True,
    ).stdout
    return [l for l in salida.splitlines() if l]


def toca_js_o_css(archivos):
    return any(a.endswith(".js") or a.endswith(".css") for a in archivos if a != "js/app-version.js")


def version_actual():
    texto = ARCHIVO_VERSION.read_text(encoding="utf-8")
    m = PATRON_VERSION_JS.search(texto)
    return int(m.group(1)) if m else 0


def escribir_version(nueva):
    texto = ARCHIVO_VERSION.read_text(encoding="utf-8")
    texto = PATRON_VERSION_JS.sub('const APP_VERSION = "%d";' % nueva, texto)
    ARCHIVO_VERSION.write_text(texto, encoding="utf-8")

    if ARCHIVO_SW.exists():
        texto_sw = ARCHIVO_SW.read_text(encoding="utf-8")
        texto_sw = PATRON_VERSION_SW.sub('const APP_VERSION = "%d";' % nueva, texto_sw)
        ARCHIVO_SW.write_text(texto_sw, encoding="utf-8")

    for html in RAIZ.glob("*.html"):
        texto_html = html.read_text(encoding="utf-8")
        nuevo_html = PATRON_QUERY.sub(lambda m: m.group(1) + "?v=%d" % nueva, texto_html)
        if nuevo_html != texto_html:
            html.write_text(nuevo_html, encoding="utf-8")


def main():
    archivos = archivos_staged()
    if not toca_js_o_css(archivos):
        return 0
    nueva = version_actual() + 1
    escribir_version(nueva)
    archivos_a_agregar = ["js/app-version.js", "sw.js"] + [str(h.name) for h in RAIZ.glob("*.html")]
    subprocess.run(["git", "add"] + archivos_a_agregar, cwd=RAIZ, check=False)
    print("bump-version: APP_VERSION -> %d" % nueva)
    return 0


if __name__ == "__main__":
    sys.exit(main())
