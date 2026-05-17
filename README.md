# Truco Online 🃏
Truco argentino multijugador — 2 vs 2 — con Envido, Truco, Retruco y Vale Cuatro.

---

## Estructura del proyecto

```
truco/
├── server/
│   ├── index.js              ← Punto de entrada del servidor
│   ├── socket.js             ← WebSockets (tiempo real)
│   ├── routes/
│   │   ├── auth.js           ← Rutas de login/registro
│   │   └── rooms.js          ← Rutas de salas
│   ├── controllers/
│   │   ├── authController.js ← Lógica de autenticación
│   │   └── roomController.js ← Lógica de salas
│   ├── middleware/
│   │   └── auth.js           ← Verificación JWT
│   ├── models/
│   │   └── User.js           ← Almacén de usuarios (en memoria)
│   └── game/
│       ├── mazo.js           ← Mazo español, envido, truco
│       └── partida.js        ← Máquina de estados del juego
├── public/                   ← Frontend (se hace por separado)
├── .env.example
├── .gitignore
└── package.json
```

---

## Instalación paso a paso

### 1. Instalar Node.js

Si no lo tenés, bajalo de https://nodejs.org (recomendado: versión LTS).

Para verificar que está instalado, abrí una terminal y ejecutá:
```bash
node --version
npm --version
```

### 2. Descargar el proyecto

```bash
# Si tenés git:
git clone <url-del-repo>
cd truco

# O simplemente copiá la carpeta y hacé:
cd truco
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Configurar variables de entorno

Copiá el archivo de ejemplo:
```bash
# En Mac/Linux:
cp .env.example .env

# En Windows:
copy .env.example .env
```

Abrí el archivo `.env` y cambiá `JWT_SECRET` por algo aleatorio y largo, por ejemplo:
```
JWT_SECRET=mi_clave_super_secreta_truco_2024_xyz
```

### 5. Correr el servidor

```bash
# Para desarrollo (se reinicia solo cuando cambiás código):
npm run dev

# Para producción:
npm start
```

El servidor arranca en **http://localhost:3000**

---

## API REST — Endpoints

### Autenticación

#### Registrar usuario
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "juan",
  "password": "1234"
}
```
Respuesta:
```json
{
  "token": "eyJ...",
  "user": { "id": "...", "username": "juan", "stats": { "wins": 0, "losses": 0 } }
}
```

#### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "juan",
  "password": "1234"
}
```

#### Ver mi perfil
```
GET /api/auth/me
Authorization: Bearer <token>
```

---

### Salas

#### Listar salas disponibles
```
GET /api/rooms
Authorization: Bearer <token>
```

#### Crear sala
```
POST /api/rooms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "La mesa de Juan"
}
```

#### Ver sala
```
GET /api/rooms/:id
Authorization: Bearer <token>
```

---

## WebSocket — Eventos

Conectarse con Socket.IO:
```js
const socket = io('http://localhost:3000', {
  auth: { token: '...' }  // el JWT del login
});
```

### Eventos que enviás al servidor

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `room:join` | `{ roomId, team }` | Unirse a sala (team: "A" o "B") |
| `game:play_card` | `{ cartaId }` | Jugar una carta (ej: "1-espada") |
| `game:envido` | `{ tipo }` | Cantar envido/real_envido/falta_envido |
| `game:responder_envido` | `{ respuesta }` | quiero / no_quiero / (o subir) |
| `game:truco` | `{ tipo }` | Cantar truco/retruco/vale_cuatro |
| `game:responder_truco` | `{ respuesta }` | quiero / no_quiero / (o subir) |
| `game:mazo` | — | Irse al mazo |
| `game:nueva_mano` | — | Pedir nueva mano (cuando terminó) |
| `room:chat` | `{ msg }` | Enviar mensaje de chat |

### Eventos que recibís del servidor

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `room:joined` | `{ jugadorIdx, team, roomId }` | Confirmación de ingreso |
| `room:update` | `{ players, status }` | Actualización de jugadores en sala |
| `game:start` | `{ message }` | Comienza el juego (4 jugadores listos) |
| `game:state` | Estado completo (ver abajo) | Estado actualizado del juego |
| `game:nueva_mano` | — | Empezó una nueva mano |
| `game:fin` | `{ ganador, puntaje }` | Fin del juego |
| `room:chat` | `{ username, msg, ts }` | Mensaje de chat |
| `room:player_left` | `{ username }` | Un jugador se desconectó |
| `error` | String | Mensaje de error |

### Estructura de `game:state`

```json
{
  "puntaje": { "A": 3, "B": 7 },
  "rondaActual": 1,
  "turnoActual": 2,
  "cartasEnMano": [
    { "numero": 1, "palo": "espada", "id": "1-espada" },
    { "numero": 7, "palo": "oro", "id": "7-oro" },
    { "numero": 3, "palo": "copa", "id": "3-copa" }
  ],
  "cartasJugadas": [[...], [...], []],
  "ganadorRondas": [0, null, null],
  "estado": "turno",
  "envido": { "propuesto": null, "estado": null, "proponente": null },
  "truco": { "propuesto": "truco", "estado": "propuesto", "proponente": 1, "puntos": 2 },
  "log": ["Juan jugó 1 de espada", "..."],
  "jugadores": [
    { "idx": 0, "username": "juan", "team": "A", "cartasRestantes": 2 },
    ...
  ]
}
```

---

## Deploy gratuito en Railway

1. Creá una cuenta en https://railway.app
2. Creá un nuevo proyecto → "Deploy from GitHub repo"
3. Agregá la variable de entorno `JWT_SECRET` en el panel de Railway
4. Railway detecta automáticamente Node.js y corre `npm start`
5. Te da una URL pública como `https://truco-production.railway.app`

---

## Notas técnicas

- Los usuarios se guardan **en memoria** (se pierden al reiniciar el servidor). Para producción, conectar una base de datos (MongoDB o PostgreSQL).
- El límite de puntos es 15 por defecto. Se puede cambiar en `partida.js` (línea `this.limitePuntos = 15`).
- El frontend va en la carpeta `public/` y se construye por separado.
