# Sirve el repo con las mismas cabeceras que firebase.json (CSP incluida), para que las
# pruebas detecten lo que solo falla en Firebase Hosting (scripts/estilos inline, etc.).
# Uso: python3 pruebas/e2e/servidor.py [puerto]   (por defecto 8767)
import http.server, json, os, sys
RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
conf = json.load(open(os.path.join(RAIZ, "firebase.json")))["hosting"]["headers"]
GLOBALES = [h for h in conf if h["source"] == "**"][0]["headers"]
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)
    def end_headers(self):
        for h in GLOBALES:
            self.send_header(h["key"], h["value"])
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()
    def log_message(self, *a):
        pass
http.server.ThreadingHTTPServer(("127.0.0.1", PUERTO), H).serve_forever()
