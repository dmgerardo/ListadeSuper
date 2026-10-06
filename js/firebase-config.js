// Configuración pública del proyecto Firebase (no es un secreto: la protección real
// son las reglas de la base de datos en database.rules.json).
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1ERJUwaqmiFtwCAghWhKNn3ILlhB-g84",
  authDomain: "pilo-compras.firebaseapp.com",
  databaseURL: "https://pilo-compras-default-rtdb.firebaseio.com",
  projectId: "pilo-compras",
  storageBucket: "pilo-compras.firebasestorage.app",
  messagingSenderId: "346092505338",
  appId: "1:346092505338:web:3e36f29ec24475fbcce143"
};

// Se inicializa aquí (y no en db.js) porque auth.js, que se carga justo después, ya
// necesita firebase.auth() listo.
firebase.initializeApp(FIREBASE_CONFIG);
