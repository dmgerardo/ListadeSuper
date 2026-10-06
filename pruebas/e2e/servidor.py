# Sirve el repo con las mismas cabeceras que firebase.json, aplicadas POR RUTA como Firebase
# Hosting ("/", "**/*.@(html)", "**/*.@(json)", "**"), para que las pruebas detecten lo que
# solo falla en producción (CSP: scripts/estilos inline, etc.).
# Uso: python3 pruebas/e2e/servidor.py [puerto]   (por defecto 8767)
import http.server, json, os, re, sys
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
REGLAS = json.load(open(os.path.join(RAIZ, "firebase.json")))["hosting"]["headers"]


def coincide(fuente, ruta):
    if fuente == "**":
        return True
    if fuente == "/":
        return ruta == "/"
    m = re.fullmatch(r"\*\*/\*\.@\(([\w|]+)\)", fuente)
    if m:
        return any(ruta.endswith("." + ext) for ext in m.group(1).split("|"))
    raise SystemExit("Patrón de firebase.json no soportado por este servidor: " + fuente)


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)

    def end_headers(self):
        ruta = self.path.split("?")[0]
        puestas = set()
        for regla in REGLAS:
            if coincide(regla["source"], ruta):
                for h in regla["headers"]:
                    if h["key"] not in puestas:
                        self.send_header(h["key"], h["value"])
                        puestas.add(h["key"])
        if "Cache-Control" not in puestas:
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO), H).serve_forever()
