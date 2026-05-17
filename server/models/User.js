// Base de usuarios en memoria (sin base de datos)
// En producción reemplazar por MongoDB/PostgreSQL

const users = new Map();

module.exports = {
  findByUsername(username) {
    return users.get(username.toLowerCase()) || null;
  },

  findById(id) {
    for (const user of users.values()) {
      if (user.id === id) return user;
    }
    return null;
  },

  create(user) {
    users.set(user.username.toLowerCase(), user);
    return user;
  },

  exists(username) {
    return users.has(username.toLowerCase());
  },

  getAll() {
    return Array.from(users.values()).map(u => ({
      id: u.id,
      username: u.username,
      stats: u.stats
    }));
  },

  updateStats(id, result) {
    const user = this.findById(id);
    if (!user) return;
    if (result === 'win') user.stats.wins++;
    else user.stats.losses++;
  }
};
