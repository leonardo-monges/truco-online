const jwt = require('jsonwebtoken');
const { rooms } = require('./controllers/roomController');
const { Partida, ESTADO } = require('./game/partida');

// Map roomId -> Partida
const partidas = new Map();

// Map socketId -> { userId, username, roomId, jugadorIdx }
const sesiones = new Map();

function autenticarSocket(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token requerido'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error('Token inválido'));
  }
}

function emitirEstado(io, roomId, partida) {
  const sala = rooms.get(roomId);
  if (!sala) return;

  sala.players.forEach((player, idx) => {
    const socketId = player.socketId;
    if (!socketId) return;
    const estado = partida.getEstadoPublico(idx);
    io.to(socketId).emit('game:state', estado);
  });
}

function emitirLog(io, roomId, msg) {
  io.to(roomId).emit('game:log', { msg });
}

module.exports = function setupSocket(io) {
  io.use(autenticarSocket);

  io.on('connection', (socket) => {
    console.log(`Conectado: ${socket.user.username} (${socket.id})`);

    // ─── Unirse a sala ─────────────────────────────────────
    socket.on('room:join', ({ roomId, team }) => {
      const sala = rooms.get(roomId);
      if (!sala) return socket.emit('error', 'Sala no encontrada');
      if (sala.status !== 'waiting') return socket.emit('error', 'La partida ya empezó');
      if (sala.players.length >= 4) return socket.emit('error', 'Sala llena');

      // Verificar que el equipo no esté lleno (máx maxPlayers/2 por equipo)
      const maxPorEquipo = sala.maxPlayers / 2;
      const enEquipo = sala.players.filter(p => p.team === team).length;
      if (enEquipo >= maxPorEquipo) return socket.emit('error', `Equipo ${team} lleno`);

      // Registrar jugador
      const jugadorIdx = sala.players.length;
      const player = {
        id: socket.user.id,
        username: socket.user.username,
        team,
        socketId: socket.id
      };
      sala.players.push(player);
      sesiones.set(socket.id, { userId: socket.user.id, username: socket.user.username, roomId, jugadorIdx });

      socket.join(roomId);
      socket.emit('room:joined', { jugadorIdx, team, roomId });

      io.to(roomId).emit('room:update', {
        players: sala.players.map(p => ({ username: p.username, team: p.team })),
        status: sala.status,
        maxPlayers: sala.maxPlayers,
        createdBy: sala.createdBy
      });
    });

    // ─── Iniciar partida (solo el creador) ─────────────────
    socket.on('room:start', () => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');

      const sala = rooms.get(sesion.roomId);
      if (!sala) return socket.emit('error', 'Sala no encontrada');
      if (sala.createdBy !== socket.user.id) return socket.emit('error', 'Solo el creador puede iniciar la partida');
      if (sala.status !== 'waiting') return socket.emit('error', 'La partida ya empezó');
      if (sala.players.length < 2) return socket.emit('error', 'Necesitás al menos 2 jugadores para empezar');

      const equipoA = sala.players.filter(p => p.team === 'A').length;
      const equipoB = sala.players.filter(p => p.team === 'B').length;
      if (equipoA !== equipoB) return socket.emit('error', 'Los equipos deben tener la misma cantidad de jugadores');

      sala.status = 'playing';
      const partida = new Partida(sala.players.map(p => ({ id: p.id, username: p.username, team: p.team })));
      partidas.set(sesion.roomId, partida);

      io.to(sesion.roomId).emit('game:start', { message: '¡Comienza el truco!' });
      emitirEstado(io, sesion.roomId, partida);
    });

    // ─── Jugar carta ───────────────────────────────────────
    socket.on('game:play_card', ({ cartaId }) => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');

      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.jugarCarta(sesion.jugadorIdx, cartaId);
      if (!resultado.ok) return socket.emit('error', resultado.error);

      emitirEstado(io, sesion.roomId, partida);
      checkFinJuego(io, sesion.roomId, partida);
    });

    // ─── Envido ────────────────────────────────────────────
    socket.on('game:envido', ({ tipo }) => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');
      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.proponerEnvido(sesion.jugadorIdx, tipo);
      if (!resultado.ok) return socket.emit('error', resultado.error);

      emitirEstado(io, sesion.roomId, partida);
    });

    socket.on('game:responder_envido', ({ respuesta }) => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');
      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.responderEnvido(sesion.jugadorIdx, respuesta);
      if (!resultado.ok) return socket.emit('error', resultado.error);

      emitirEstado(io, sesion.roomId, partida);
      checkFinJuego(io, sesion.roomId, partida);
    });

    // ─── Truco ─────────────────────────────────────────────
    socket.on('game:truco', ({ tipo }) => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');
      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.proponerTruco(sesion.jugadorIdx, tipo);
      if (!resultado.ok) return socket.emit('error', resultado.error);

      emitirEstado(io, sesion.roomId, partida);
    });

    socket.on('game:responder_truco', ({ respuesta }) => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');
      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.responderTruco(sesion.jugadorIdx, respuesta);
      if (!resultado.ok) return socket.emit('error', resultado.error);

      emitirEstado(io, sesion.roomId, partida);
      checkFinJuego(io, sesion.roomId, partida);
    });

    // ─── Irse al mazo ──────────────────────────────────────
    socket.on('game:mazo', () => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');
      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.irseAlMazo(sesion.jugadorIdx);
      if (!resultado.ok) return socket.emit('error', resultado.error);

      emitirEstado(io, sesion.roomId, partida);
      checkFinJuego(io, sesion.roomId, partida);
    });

    // ─── Nueva mano ────────────────────────────────────────
    socket.on('game:nueva_mano', () => {
      const sesion = sesiones.get(socket.id);
      if (!sesion) return socket.emit('error', 'No estás en ninguna sala');
      const partida = partidas.get(sesion.roomId);
      if (!partida) return socket.emit('error', 'Partida no encontrada');

      const resultado = partida.nuevaMano();
      if (!resultado.ok) return socket.emit('error', resultado.error);

      io.to(sesion.roomId).emit('game:nueva_mano');
      emitirEstado(io, sesion.roomId, partida);
    });

    // ─── Chat en sala ──────────────────────────────────────
    socket.on('room:chat', ({ msg }) => {
      const sesion = sesiones.get(socket.id);
      if (!sesion || !msg || msg.length > 200) return;
      io.to(sesion.roomId).emit('room:chat', {
        username: sesion.username,
        msg: msg.trim(),
        ts: Date.now()
      });
    });

    // ─── Desconexión ───────────────────────────────────────
    socket.on('disconnect', () => {
      const sesion = sesiones.get(socket.id);
      if (sesion) {
        const sala = rooms.get(sesion.roomId);
        if (sala) {
          io.to(sesion.roomId).emit('room:player_left', { username: sesion.username });
        }
        sesiones.delete(socket.id);
      }
      console.log(`Desconectado: ${socket.user.username}`);
    });
  });
};

function checkFinJuego(io, roomId, partida) {
  if (partida.mano.estado === ESTADO.FIN_JUEGO) {
    const ganador = partida.puntaje.A >= partida.limitePuntos ? 'A' : 'B';
    io.to(roomId).emit('game:fin', {
      ganador,
      puntaje: partida.puntaje
    });
    rooms.get(roomId).status = 'finished';
  }
}
