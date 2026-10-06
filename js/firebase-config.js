// Configuración pública del proyecto Firebase (no es un secreto: la protección real
// son las reglas de la base de datos en database.rules.json).
// REEMPLAZAR con los valores reales de Consola Firebase → ⚙️ Configuración del proyecto
// → tus apps → "Config" del SDK web.
const FIREBASE_CONFIG = {
  apiKey: "REEMPLAZAR-apiKey",
  authDomain: "REEMPLAZAR-project-id.firebaseapp.com",
  databaseURL: "https://REEMPLAZAR-project-id-default-rtdb.firebaseio.com",
  projectId: "REEMPLAZAR-project-id",
  storageBucket: "REEMPLAZAR-project-id.appspot.com",
  messagingSenderId: "REEMPLAZAR",
  appId: "REEMPLAZAR"
};

// Se inicializa aquí (y no en db.js) porque auth.js, que se carga justo después, ya
// necesita firebase.auth() listo.
firebase.initializeApp(FIREBASE_CONFIG);
