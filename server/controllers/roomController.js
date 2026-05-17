const { v4: uuidv4 } = require('uuid');

// Salas en memoria
const rooms = new Map();

function getRooms(req, res) {
  const list = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    players: r.players.length,
    maxPlayers: r.maxPlayers,
    status: r.status
  }));
  res.json(list);
}

function createRoom(req, res) {
  const { name, maxPlayers } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre de sala requerido' });

  // maxPlayers debe ser 2, 4 o 6 (pares para equipos A y B)
  const max = parseInt(maxPlayers);
  if (![2, 4, 6].includes(max)) {
    return res.status(400).json({ error: 'maxPlayers debe ser 2, 4 o 6' });
  }

  const id = uuidv4().slice(0, 8).toUpperCase();
  const room = {
    id,
    name,
    maxPlayers: max,
    players: [],
    teams: { A: [], B: [] },
    status: 'waiting', // waiting | playing | finished
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };
  rooms.set(id, room);

  res.status(201).json({ id, name, maxPlayers: max, status: room.status, createdBy: req.user.id });
}

function getRoom(req, res) {
  const room = rooms.get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Sala no encontrada' });
  res.json({
    id: room.id,
    name: room.name,
    maxPlayers: room.maxPlayers,
    createdBy: room.createdBy,
    players: room.players.map(p => ({ id: p.id, username: p.username, team: p.team })),
    status: room.status
  });
}

module.exports = { getRooms, createRoom, getRoom, rooms };
