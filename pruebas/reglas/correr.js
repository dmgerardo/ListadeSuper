// Arranca el Emulador de Realtime Database (el .jar que descarga firebase-tools) y corre
// reglas.test.js contra él. Se arranca el .jar directo, y no con `firebase emulators:exec`,
// porque en el entorno en la nube el CLI manda su llamada local para cargar las reglas por el
// proxy de salida y recibe "request blocked"; la librería de pruebas carga las reglas sola.
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const dirEmuladores = path.join(os.homedir(), ".cache", "firebase", "emulators");
function buscarJar() {
  if (!fs.existsSync(dirEmuladores)) return null;
  const jars = fs.readdirSync(dirEmuladores).filter((f) => /^firebase-database-emulator-v.*\.jar$/.test(f)).sort();
  return jars.length ? path.join(dirEmuladores, jars[jars.length - 1]) : null;
}

let jar = buscarJar();
if (!jar) {
  spawnSync("npx", ["firebase", "setup:emulators:database"], { cwd: __dirname, stdio: "inherit" });
  jar = buscarJar();
}
if (!jar) {
  console.error("No se encontró el .jar del emulador en " + dirEmuladores);
  process.exit(1);
}

const puerto = process.env.PUERTO_EMULADOR || "9000";
const emulador = spawn("java", ["-jar", jar, "--host", "127.0.0.1", "--port", puerto], { stdio: "ignore" });

async function esperarEmulador() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch("http://127.0.0.1:" + puerto + "/.json?ns=espera");
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("El emulador no respondió en 30 s");
}

esperarEmulador()
  .then(() => {
    const r = spawnSync(process.execPath, ["--test", path.join(__dirname, "reglas.test.js")], {
      stdio: "inherit",
      env: Object.assign({}, process.env, { FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:" + puerto }),
    });
    emulador.kill();
    process.exit(r.status === null ? 1 : r.status);
  })
  .catch((e) => {
    console.error(e.message);
    emulador.kill();
    process.exit(1);
  });
