const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UserModel = require('../models/User');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res) {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: 'El usuario debe tener entre 3 y 20 caracteres' });

  if (password.length < 4)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });

  if (UserModel.exists(username))
    return res.status(409).json({ error: 'Ese nombre de usuario ya existe' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = UserModel.create({
    id: uuidv4(),
    username,
    password: hashedPassword,
    stats: { wins: 0, losses: 0 },
    createdAt: new Date().toISOString()
  });

  const token = generateToken(user);
  res.status(201).json({
    token,
    user: { id: user.id, username: user.username, stats: user.stats }
  });
}

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const user = UserModel.findByUsername(username);
  if (!user)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, stats: user.stats }
  });
}

function me(req, res) {
  const user = UserModel.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ id: user.id, username: user.username, stats: user.stats });
}

module.exports = { register, login, me };
