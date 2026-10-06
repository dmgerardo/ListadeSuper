// Configuración pública del proyecto Firebase (no es un secreto: la protección real
// son las reglas de la base de datos en database.rules.json).
// authDomain = el MISMO dominio desde el que se abre la app (si es uno de Firebase Hosting).
// Si fuera otro dominio (el de siempre, pilo-compras.firebaseapp.com), Safari en iOS 16.1+
// aísla su almacenamiento como de terceros y signInWithRedirect regresa sin sesión: en la
// app anclada a la pantalla de inicio el usuario volvía al botón de "Continuar con Google".
// Firebase Hosting sirve /__/auth/* en ambos dominios. Requiere que
// https://pilo-compras.web.app/__/auth/handler esté en "URIs de redirección autorizados" del
// cliente OAuth en Google Cloud Console. Fuera de Hosting (pruebas locales) se usa el de siempre.
var _HOST_APP = window.location.hostname;
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1ERJUwaqmiFtwCAghWhKNn3ILlhB-g84",
  authDomain: _HOST_APP === "pilo-compras.web.app" || _HOST_APP === "pilo-compras.firebaseapp.com"
    ? _HOST_APP
    : "pilo-compras.firebaseapp.com",
  databaseURL: "https://pilo-compras-default-rtdb.firebaseio.com",
  projectId: "pilo-compras",
  storageBucket: "pilo-compras.firebasestorage.app",
  messagingSenderId: "346092505338",
  appId: "1:346092505338:web:3e36f29ec24475fbcce143"
};

// Se inicializa aquí (y no en db.js) porque auth.js, que se carga justo después, ya
// necesita firebase.auth() listo.
firebase.initializeApp(FIREBASE_CONFIG);
