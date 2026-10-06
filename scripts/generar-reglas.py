#!/usr/bin/env python3
"""Genera database.rules.json. NO editar database.rules.json a mano: editar este archivo y
correr `python3 scripts/generar-reglas.py`, luego `cd pruebas/reglas && npm test`.

Las reglas de Realtime Database no tienen funciones; expresiones como "es administrador" o
"es miembro activo de la lista" se repiten en muchos lugares. Aquí se definen una sola vez.

Modelo (ver AGENTS.md §5):
- roles/{uid}: { rol: "admin"|"participante"|"invitado", activo, actualizado?, actualizadoPor? }
  Un usuario nuevo solo puede crearse a sí mismo como invitado activo. Los administradores
  cambian rol/activo de los DEMÁS. El administrador raíz es la cuenta de ADMIN_RAIZ (por
  correo verificado de Google): no depende de roles/, así que nadie puede quitárselo.
- Invitado: entra y puede unirse a listas por invitación; NO crea listas.
- Participante / admin: crean listas. Solo el dueño elimina su lista.
- Miembros de una lista: dueño y editores. Los editores hacen todo menos eliminar la lista
  (renombran, invitan, quitan miembros que no son el dueño). Cualquiera puede salirse menos
  el dueño.
- Desactivado (activo: false): no lee ni escribe ninguna lista.
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ADMIN_RAIZ = "dmgerardo@gmail.com"
SIETE_DIAS_MS = 7 * 24 * 3600 * 1000
HORAS_23_MS = 23 * 3600 * 1000  # el cliente borra la actividad de > 24 h; margen de reloj

SUPER = f"(auth.token.email === '{ADMIN_RAIZ}' && auth.token.email_verified === true)"
ROL_APP = "root.child('roles/' + auth.uid + '/rol').val()"
ACTIVO_NODO = "root.child('roles/' + auth.uid + '/activo').val() === true"
ACTIVO = f"({SUPER} || {ACTIVO_NODO})"
ADMIN = f"({SUPER} || ({ROL_APP} === 'admin' && {ACTIVO_NODO}))"
PUEDE_CREAR = f"({SUPER} || (({ROL_APP} === 'admin' || {ROL_APP} === 'participante') && {ACTIVO_NODO}))"


def rol_en_lista(lista_expr):
    return f"root.child('listas/' + {lista_expr} + '/miembros/' + auth.uid + '/rol').val()"


MI_ROL = rol_en_lista("$listaId")
ES_MIEMBRO = "root.child('listas/' + $listaId + '/miembros/' + auth.uid).exists()"
MIEMBRO_ACTIVO = f"(auth != null && {ACTIVO} && {ES_MIEMBRO})"


def o(*partes):
    return "(" + " || ".join("(" + p + ")" for p in partes) + ")"


def y(*partes):
    return " && ".join(partes)


def cadena(campo, maximo, minimo=0):
    base = f"newData.child('{campo}').isString() && newData.child('{campo}').val().length <= {maximo}"
    return base + (f" && newData.child('{campo}').val().length >= {minimo}" if minimo else "")


INV = "root.child('invitaciones/' + newData.child('codigo').val())"
# Al unirse, la misma escritura multi-ruta debe marcar la invitación como usada por mí:
# newData.parent() x4 = la raíz DESPUÉS de la escritura
# (listas/$listaId/miembros/$uid → miembros → $listaId → listas → raíz).
INV_NUEVA = "newData.parent().parent().parent().parent().child('invitaciones/' + newData.child('codigo').val())"

reglas = {
    "rules": {
        ".read": False,
        ".write": False,
        "roles": {
            ".read": f"auth != null && {ADMIN}",
            "$uid": {
                ".read": "auth != null && auth.uid === $uid",
                ".write": y("auth != null", o(
                    # Alta propia: solo como invitado activo, y solo si no existe.
                    "auth.uid === $uid && !data.exists() && newData.child('rol').val() === 'invitado' && newData.child('activo').val() === true",
                    # Los administradores cambian a los demás (nunca a sí mismos).
                    # (no se borran: .validate no corre al borrar; para quitar acceso, activo: false)
                    f"{ADMIN} && auth.uid !== $uid && newData.exists()",
                )),
                ".validate": y(
                    "newData.hasChildren(['rol', 'activo'])",
                    "(newData.child('rol').val() === 'admin' || newData.child('rol').val() === 'participante' || newData.child('rol').val() === 'invitado')",
                    "newData.child('activo').isBoolean()",
                ),
                "rol": {".validate": "newData.isString()"},
                "activo": {".validate": "newData.isBoolean()"},
                "actualizado": {".validate": "newData.isNumber()"},
                "actualizadoPor": {".validate": "newData.isString() && newData.val().length <= 128"},
                "$otro": {".validate": False},
            },
        },
        "usuarios": {
            ".read": f"auth != null && {ADMIN}",
            "$uid": {
                ".read": "auth != null && auth.uid === $uid",
                ".write": "auth != null && auth.uid === $uid",
            },
        },
        "listasDeUsuario": {
            "$uid": {
                ".read": "auth != null && auth.uid === $uid",
                "$listaId": {
                    ".write": y("auth != null", o(
                        "auth.uid === $uid",
                        f"{MI_ROL} === 'dueno'",
                        # Un editor que quita a un miembro también le quita la lista del índice.
                        f"!newData.exists() && {MI_ROL} === 'editor'",
                    )),
                },
            },
        },
        "listas": {
            "$listaId": {
                ".read": y("auth != null", ACTIVO, "data.child('miembros/' + auth.uid).exists()"),
                # Eliminar la lista completa: solo el dueño (el nodo entero desaparece).
                ".write": y("auth != null", ACTIVO, "!newData.exists()", "data.child('miembros/' + auth.uid + '/rol').val() === 'dueno'"),
                "info": {
                    ".write": y("auth != null", ACTIVO, o(
                        f"!data.exists() && newData.child('creadaPor').val() === auth.uid && {PUEDE_CREAR}",
                        f"data.exists() && newData.exists() && ({MI_ROL} === 'dueno' || {MI_ROL} === 'editor') && newData.child('creadaPor').val() === data.child('creadaPor').val()",
                    )),
                    ".validate": "newData.hasChildren(['nombre', 'moneda', 'creadaPor']) && newData.child('nombre').isString() && newData.child('nombre').val().length > 0 && newData.child('nombre').val().length <= 80",
                    # Pasillos personalizados de la lista (renombrar/crear/eliminar). Si no existe el
                    # nodo rigen los 14 por defecto. Que un pasillo esté vacío para eliminarlo lo
                    # verifica el cliente: una regla no puede consultar los artículos por pasillo.
                    "categorias": {
                        "$cat": {
                            ".validate": "$cat.matches(/^[a-z0-9_]{1,40}$/) && newData.hasChildren(['nombre'])",
                            "nombre": {".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"},
                            "$otro": {".validate": False},
                        },
                    },
                },
                "miembros": {
                    "$uid": {
                        ".write": y("auth != null", ACTIVO, o(
                            # Quien crea la lista se da de alta como dueño (lista aún sin info).
                            f"auth.uid === $uid && !data.exists() && newData.child('rol').val() === 'dueno' && !root.child('listas/' + $listaId + '/info').exists() && {PUEDE_CREAR}",
                            # Unirse con una invitación vigente, no usada, de ESTA lista, marcándola
                            # como usada por mí en la misma escritura (un solo uso).
                            y("auth.uid === $uid", "!data.exists()", "newData.child('rol').val() === 'editor'",
                              "root.child('listas/' + $listaId + '/info').exists()",
                              f"{INV}.child('listaId').val() === $listaId",
                              f"{INV}.child('expira').val() > now",
                              f"!{INV}.child('usadaPor').exists()",
                              f"{INV_NUEVA}.child('usadaPor').val() === auth.uid"),
                            # Salirse (menos el dueño).
                            "auth.uid === $uid && !newData.exists() && data.child('rol').val() !== 'dueno'",
                            # El dueño administra a los demás (solo como editores, o quitarlos).
                            f"{MI_ROL} === 'dueno' && auth.uid !== $uid && (!newData.exists() || newData.child('rol').val() === 'editor')",
                            # Un editor quita a otros miembros que no son el dueño.
                            f"{MI_ROL} === 'editor' && auth.uid !== $uid && !newData.exists() && data.child('rol').val() !== 'dueno'",
                        )),
                        ".validate": y(
                            "newData.hasChildren(['rol'])",
                            "(newData.child('rol').val() === 'dueno' || newData.child('rol').val() === 'editor')",
                        ),
                        "rol": {".validate": "newData.isString()"},
                        "nombre": {".validate": "newData.isString() && newData.val().length <= 120"},
                        "email": {".validate": "newData.isString() && newData.val().length <= 200"},
                        "foto": {".validate": "newData.isString() && newData.val().length <= 2000"},
                        "desde": {".validate": "newData.isNumber()"},
                        "codigo": {".validate": "newData.isString() && newData.val().length <= 64"},
                        "$otro": {".validate": False},
                    },
                },
                "articulos": {
                    ".write": o(
                        MIEMBRO_ACTIVO,
                        # Duplicar una lista: sus artículos se escriben en la MISMA escritura que
                        # crea la lista (info + yo como dueño), cuando aún no soy miembro en la
                        # base. Solo si la lista no existía y la estoy creando yo.
                        y("auth != null", ACTIVO,
                          "!data.parent().child('info').exists()",
                          "newData.parent().child('info/creadaPor').val() === auth.uid",
                          "newData.parent().child('miembros/' + auth.uid + '/rol').val() === 'dueno'"),
                    ),
                    "$articuloId": {
                        ".validate": "!newData.exists() || newData.hasChildren(['nombre', 'categoria', 'comprado'])",
                        "nombre": {".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 120"},
                        "cantidad": {".validate": "newData.isNumber() && newData.val() > 0 && newData.val() <= 9999"},
                        "unidad": {".validate": "newData.isString() && newData.val().length <= 20"},
                        "categoria": {".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 40"},
                        "precio": {".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() < 10000000"},
                        "notas": {".validate": "newData.isString() && newData.val().length <= 200"},
                        "comprado": {".validate": "newData.isBoolean()"},
                        "favorito": {".validate": "newData.isBoolean()"},
                        "compradoPor": {".validate": "newData.isString() && newData.val().length <= 128"},
                        "agregadoPor": {".validate": "newData.isString() && newData.val().length <= 128"},
                        "creado": {".validate": "newData.isNumber()"},
                        "plantillaId": {".validate": "newData.isString() && newData.val().length <= 40"},
                        "$otro": {".validate": False},
                    },
                },
                # Registro TEMPORAL de quién marcó/desmarcó qué (coordinación durante la compra).
                # Cada quien escribe solo sus eventos; cualquier miembro borra los de más de 23 h
                # (el cliente borra los de más de 24 h al abrir la lista).
                "actividad": {
                    ".indexOn": ["ts"],
                    "$evento": {
                        ".write": y(MIEMBRO_ACTIVO, o(
                            "!data.exists() && newData.child('uid').val() === auth.uid",
                            f"!newData.exists() && data.child('ts').val() < now - {HORAS_23_MS}",
                        )),
                        ".validate": y(
                            "newData.hasChildren(['uid', 'nombre', 'accion', 'articuloId', 'articulo', 'ts'])",
                            "(newData.child('accion').val() === 'marco' || newData.child('accion').val() === 'desmarco')",
                            "newData.child('ts').isNumber() && newData.child('ts').val() <= now",
                            cadena("nombre", 120), cadena("articulo", 120, 1), cadena("articuloId", 64, 1),
                        ),
                        "uid": {".validate": "newData.isString()"},
                        "nombre": {".validate": "newData.isString()"},
                        "accion": {".validate": "newData.isString()"},
                        "articuloId": {".validate": "newData.isString()"},
                        "articulo": {".validate": "newData.isString()"},
                        "ts": {".validate": "newData.isNumber()"},
                        "$otro": {".validate": False},
                    },
                },
                # Quién tiene la lista abierta ahora (se borra solo al desconectarse).
                "presencia": {
                    "$uid": {
                        ".write": y(MIEMBRO_ACTIVO, "auth.uid === $uid"),
                        ".validate": "!newData.exists() || (newData.hasChildren(['nombre', 'visto']) && " + cadena("nombre", 120) + ")",
                        "nombre": {".validate": "newData.isString()"},
                        "foto": {".validate": "newData.isString() && newData.val().length <= 2000"},
                        "visto": {".validate": "newData.isNumber()"},
                        "$otro": {".validate": False},
                    },
                },
                "catalogo": {".write": MIEMBRO_ACTIVO},
                "plantillas": {".write": MIEMBRO_ACTIVO},
            },
        },
        "invitaciones": {
            "$codigo": {
                ".read": "auth != null",
                ".write": y("auth != null", ACTIVO, o(
                    # Crear: dueño o editor de la lista; caduca en 7 días como máximo.
                    y("!data.exists()", "newData.child('creadaPor').val() === auth.uid",
                      "(" + rol_en_lista("newData.child('listaId').val()") + " === 'dueno' || " + rol_en_lista("newData.child('listaId').val()") + " === 'editor')",
                      "newData.child('expira').val() > now", f"newData.child('expira').val() <= now + {SIETE_DIAS_MS + 60000}",
                      "!newData.child('usadaPor').exists()"),
                    # Usarla (una vez): solo se agrega usadaPor = yo; lo demás no cambia.
                    y("data.exists()", "newData.exists()", "!data.child('usadaPor').exists()",
                      "newData.child('usadaPor').val() === auth.uid", "data.child('expira').val() > now",
                      "newData.child('listaId').val() === data.child('listaId').val()",
                      "newData.child('listaNombre').val() === data.child('listaNombre').val()",
                      "newData.child('creadaPor').val() === data.child('creadaPor').val()",
                      "newData.child('creadaPorNombre').val() === data.child('creadaPorNombre').val()",
                      "newData.child('creada').val() === data.child('creada').val()",
                      "newData.child('expira').val() === data.child('expira').val()"),
                    # Borrarla: quien la creó o el dueño de la lista.
                    "data.exists() && !newData.exists() && (data.child('creadaPor').val() === auth.uid || " + rol_en_lista("data.child('listaId').val()") + " === 'dueno')",
                )),
                ".validate": y(
                    "$codigo.length >= 22 && $codigo.length <= 64",
                    "newData.hasChildren(['listaId', 'listaNombre', 'creadaPor', 'creadaPorNombre', 'creada', 'expira'])",
                    cadena("listaId", 64, 1), cadena("listaNombre", 80, 1), cadena("creadaPorNombre", 120),
                    "newData.child('creada').isNumber() && newData.child('expira').isNumber()",
                ),
                "listaId": {".validate": "newData.isString()"},
                "listaNombre": {".validate": "newData.isString()"},
                "creadaPor": {".validate": "newData.isString()"},
                "creadaPorNombre": {".validate": "newData.isString()"},
                "creada": {".validate": "newData.isNumber()"},
                "expira": {".validate": "newData.isNumber()"},
                "usadaPor": {".validate": "newData.isString() && newData.val().length <= 128"},
                "$otro": {".validate": False},
            },
        },
    }
}

destino = RAIZ / "database.rules.json"
destino.write_text(json.dumps(reglas, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("escrito", destino.relative_to(RAIZ), "(", len(destino.read_text()), "bytes )")
