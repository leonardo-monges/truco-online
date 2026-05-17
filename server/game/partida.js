const {
  crearMazo, mezclarMazo, repartirCartas,
  calcularEnvido, determinarGanadorMano
} = require('./mazo');

// Estados posibles del juego
const ESTADO = {
  ESPERANDO: 'esperando',
  TURNO: 'turno',
  ENVIDO_PROPUESTO: 'envido_propuesto',
  TRUCO_PROPUESTO: 'truco_propuesto',
  FIN_MANO: 'fin_mano',
  FIN_JUEGO: 'fin_juego'
};

// Apuestas de envido
const ENVIDO_CADENA = ['envido', 'real_envido', 'falta_envido'];
const PUNTOS_ENVIDO = {
  envido: 2,
  'envido_envido': 4,
  real_envido: 3,
  falta_envido: null // vale lo que falta para llegar a 15
};

// Apuestas de truco
const TRUCO_CADENA = ['truco', 'retruco', 'vale_cuatro'];
const PUNTOS_TRUCO = { truco: 2, retruco: 3, vale_cuatro: 4 };

class Partida {
  constructor(jugadores) {
    // jugadores = [{id, username, team}]
    // Equipo A: índices pares (0, 2, 4) / Equipo B: índices impares (1, 3, 5)
    this.jugadores = jugadores;
    this.cantJugadores = jugadores.length;
    this.puntaje = { A: 0, B: 0 };
    this.limitePuntos = 15;
    this.mano = null;
    this.historial = [];
    this.iniciarMano();
  }

  iniciarMano() {
    const mazo = mezclarMazo(crearMazo());
    const cartasRepartidas = repartirCartas(mazo, this.cantJugadores);

    this.mano = {
      numero: (this.mano?.numero || 0) + 1,
      cartasJugadores: cartasRepartidas, // índice = posición del jugador
      cartasJugadas: [[], [], []], // 3 rondas de cartas jugadas
      rondaActual: 0,
      ganadorRondas: [null, null, null], // null=no jugada, -1=parda
      turnoActual: 0, // índice del jugador que debe jugar
      mano: 0, // índice del jugador que es "mano" esta vuelta

      // Estado de envido
      envidoPropuesto: null,  // null | 'envido' | 'real_envido' | 'falta_envido'
      envidoNivel: 0,         // cuántas veces se subió
      envidoEstado: null,     // null | 'propuesto' | 'aceptado' | 'rechazado' | 'resuelto'
      envidoProponente: null,
      envidoGanador: null,
      envidoPuntos: 0,

      // Estado de truco
      trucoPropuesto: null,   // null | 'truco' | 'retruco' | 'vale_cuatro'
      trucoNivel: 0,
      trucoEstado: null,      // null | 'propuesto' | 'aceptado' | 'rechazado'
      trucoProponente: null,
      trucoPuntos: 1,         // puntos actuales en juego por el truco

      estado: ESTADO.TURNO,
      log: []
    };
  }

  // ─── Helpers ───────────────────────────────────────────────

  equipoDe(jugadorIdx) {
    return this.jugadores[jugadorIdx].team;
  }

  equipoContrario(equipo) {
    return equipo === 'A' ? 'B' : 'A';
  }

  jugadoresDelEquipo(equipo) {
    return this.jugadores.map((j, i) => ({ ...j, idx: i })).filter(j => j.team === equipo);
  }

  siguienteTurno() {
    this.mano.turnoActual = (this.mano.turnoActual + 1) % this.cantJugadores;
  }

  agregarLog(msg) {
    this.mano.log.push(msg);
    this.historial.push(msg);
  }

  getEstadoPublico(jugadorIdx) {
    const m = this.mano;
    return {
      puntaje: this.puntaje,
      cantJugadores: this.cantJugadores,
      rondaActual: m.rondaActual,
      turnoActual: m.turnoActual,
      cartasEnMano: m.cartasJugadores[jugadorIdx],
      cartasJugadas: m.cartasJugadas,
      ganadorRondas: m.ganadorRondas,
      estado: m.estado,
      envido: {
        propuesto: m.envidoPropuesto,
        estado: m.envidoEstado,
        proponente: m.envidoProponente
      },
      truco: {
        propuesto: m.trucoPropuesto,
        estado: m.trucoEstado,
        proponente: m.trucoProponente,
        puntos: m.trucoPuntos
      },
      log: m.log.slice(-10),
      jugadores: this.jugadores.map((j, i) => ({
        idx: i,
        username: j.username,
        team: j.team,
        cartasRestantes: m.cartasJugadores[i].length
      }))
    };
  }

  // ─── Acciones del jugador ───────────────────────────────────

  jugarCarta(jugadorIdx, cartaId) {
    const m = this.mano;
    if (m.estado !== ESTADO.TURNO) return { ok: false, error: 'No es momento de jugar carta' };
    if (m.turnoActual !== jugadorIdx) return { ok: false, error: 'No es tu turno' };

    const mano = m.cartasJugadores[jugadorIdx];
    const idx = mano.findIndex(c => c.id === cartaId);
    if (idx === -1) return { ok: false, error: 'No tenés esa carta' };

    const carta = mano.splice(idx, 1)[0];
    m.cartasJugadas[m.rondaActual].push({ jugadorIdx, carta });
    this.agregarLog(`${this.jugadores[jugadorIdx].username} jugó ${carta.numero} de ${carta.palo}`);

    // Si todos jugaron en esta ronda
    if (m.cartasJugadas[m.rondaActual].length === this.cantJugadores) {
      this._resolverRonda();
    } else {
      this.siguienteTurno();
    }

    return { ok: true };
  }

  _resolverRonda() {
    const m = this.mano;
    const jugadas = m.cartasJugadas[m.rondaActual];
    const ganadorIdx = determinarGanadorMano(jugadas);

    if (ganadorIdx === null) {
      m.ganadorRondas[m.rondaActual] = -1; // parda
      this.agregarLog('¡Parda en esta ronda!');
    } else {
      m.ganadorRondas[m.rondaActual] = ganadorIdx;
      this.agregarLog(`${this.jugadores[ganadorIdx].username} ganó la ronda`);
      m.turnoActual = ganadorIdx; // el ganador empieza la siguiente ronda
    }

    m.rondaActual++;

    // Chequear si terminó la mano (3 rondas o ganador claro)
    const resultado = this._chequearFinMano();
    if (resultado) {
      this._finalizarMano(resultado);
    }
  }

  _chequearFinMano() {
    const m = this.mano;
    const ganadasPorEquipo = { A: 0, B: 0 };
    let pardas = 0;

    for (const g of m.ganadorRondas) {
      if (g === null) continue;
      if (g === -1) { pardas++; continue; }
      ganadasPorEquipo[this.equipoDe(g)]++;
    }

    const rounasJugadas = m.rondaActual;

    // Gana quien gane 2 rondas
    if (ganadasPorEquipo.A >= 2) return { ganador: 'A' };
    if (ganadasPorEquipo.B >= 2) return { ganador: 'B' };

    // Fin de 3 rondas
    if (rounasJugadas === 3) {
      if (ganadasPorEquipo.A > ganadasPorEquipo.B) return { ganador: 'A' };
      if (ganadasPorEquipo.B > ganadasPorEquipo.A) return { ganador: 'B' };
      // Todo empatado — gana el equipo del jugador "mano"
      return { ganador: this.equipoDe(m.mano) };
    }

    // Si hay parda en primera ronda y alguien gana la segunda
    if (m.ganadorRondas[0] === -1 && rounasJugadas >= 2) {
      if (ganadasPorEquipo.A >= 1) return { ganador: 'A' };
      if (ganadasPorEquipo.B >= 1) return { ganador: 'B' };
    }

    return null; // sigue jugando
  }

  _finalizarMano(resultado) {
    const m = this.mano;
    const puntosTruco = m.trucoEstado === 'aceptado' ? m.trucoPuntos : 1;
    this.puntaje[resultado.ganador] += puntosTruco;
    this.agregarLog(`Equipo ${resultado.ganador} gana la mano (+${puntosTruco} pts)`);
    m.estado = ESTADO.FIN_MANO;

    if (this.puntaje.A >= this.limitePuntos || this.puntaje.B >= this.limitePuntos) {
      m.estado = ESTADO.FIN_JUEGO;
      const ganador = this.puntaje.A >= this.limitePuntos ? 'A' : 'B';
      this.agregarLog(`¡JUEGO TERMINADO! Gana el equipo ${ganador}`);
    }
  }

  // ─── Envido ────────────────────────────────────────────────

  proponerEnvido(jugadorIdx, tipo) {
    const m = this.mano;
    const TIPOS_VALIDOS = ['envido', 'real_envido', 'falta_envido'];

    if (!TIPOS_VALIDOS.includes(tipo)) return { ok: false, error: 'Tipo de envido inválido' };
    if (m.rondaActual > 0) return { ok: false, error: 'El envido solo se canta en la primera ronda' };
    if (m.envidoEstado === 'resuelto' || m.envidoEstado === 'rechazado') return { ok: false, error: 'El envido ya fue resuelto' };
    if (m.trucoEstado === 'propuesto') return { ok: false, error: 'Hay truco propuesto, respondé primero' };

    // Si ya hay envido propuesto, verificar que sea subida válida
    if (m.envidoEstado === 'propuesto') {
      // Solo puede subir el que aceptó o es el otro equipo
      if (m.envidoProponente === jugadorIdx) return { ok: false, error: 'Vos propusiste, esperá respuesta' };
    }

    m.envidoPropuesto = tipo;
    m.envidoEstado = 'propuesto';
    m.envidoProponente = jugadorIdx;
    m.estado = ESTADO.ENVIDO_PROPUESTO;
    this.agregarLog(`${this.jugadores[jugadorIdx].username} canta ${tipo.replace('_', ' ')}`);

    return { ok: true };
  }

  responderEnvido(jugadorIdx, respuesta) {
    const m = this.mano;
    if (m.envidoEstado !== 'propuesto') return { ok: false, error: 'No hay envido propuesto' };
    if (this.equipoDe(jugadorIdx) === this.equipoDe(m.envidoProponente)) {
      return { ok: false, error: 'Tu compañero propuso el envido, no vos' };
    }

    if (respuesta === 'no_quiero') {
      // Gana el que propuso con puntos menores
      const puntosNoQuiero = m.envidoPropuesto === 'falta_envido' ? 1 :
        m.envidoPropuesto === 'real_envido' ? 2 : 1;
      this.puntaje[this.equipoDe(m.envidoProponente)] += puntosNoQuiero;
      m.envidoEstado = 'rechazado';
      m.estado = ESTADO.TURNO;
      this.agregarLog(`No quiero — Equipo ${this.equipoDe(m.envidoProponente)} suma ${puntosNoQuiero} pts de envido`);
      return { ok: true };
    }

    if (respuesta === 'quiero') {
      // Resolver envido: cada equipo calcula su mejor envido
      const envidoA = Math.max(
        ...this.jugadoresDelEquipo('A').map(j => calcularEnvido(m.cartasJugadores[j.idx]))
      );
      const envidoB = Math.max(
        ...this.jugadoresDelEquipo('B').map(j => calcularEnvido(m.cartasJugadores[j.idx]))
      );

      let puntos;
      if (m.envidoPropuesto === 'falta_envido') {
        const ganadorEquipo = envidoA >= envidoB ? 'A' : 'B';
        puntos = this.limitePuntos - this.puntaje[ganadorEquipo];
      } else if (m.envidoPropuesto === 'real_envido') {
        puntos = 3;
      } else {
        puntos = 2;
      }

      const ganadorEnvido = envidoA >= envidoB ? 'A' : 'B';
      this.puntaje[ganadorEnvido] += puntos;
      m.envidoGanador = ganadorEnvido;
      m.envidoPuntos = puntos;
      m.envidoEstado = 'resuelto';
      m.estado = ESTADO.TURNO;

      this.agregarLog(`Envido: A=${envidoA} B=${envidoB} — Gana equipo ${ganadorEnvido} (+${puntos} pts)`);
      return { ok: true, envidoA, envidoB, ganador: ganadorEnvido, puntos };
    }

    // Subir envido
    const subidas = ['envido', 'real_envido', 'falta_envido'];
    if (subidas.includes(respuesta)) {
      return this.proponerEnvido(jugadorIdx, respuesta);
    }

    return { ok: false, error: 'Respuesta inválida' };
  }

  // ─── Truco ─────────────────────────────────────────────────

  proponerTruco(jugadorIdx, tipo) {
    const m = this.mano;
    const CADENA = ['truco', 'retruco', 'vale_cuatro'];

    if (!CADENA.includes(tipo)) return { ok: false, error: 'Tipo inválido' };
    if (m.envidoEstado === 'propuesto') return { ok: false, error: 'Hay envido pendiente, respondé primero' };

    // Verificar que sea subida válida
    if (m.trucoPropuesto) {
      const nivelActual = CADENA.indexOf(m.trucoPropuesto);
      const nivelNuevo = CADENA.indexOf(tipo);
      if (nivelNuevo <= nivelActual) return { ok: false, error: 'Tenés que subir el truco' };
      if (this.equipoDe(jugadorIdx) === this.equipoDe(m.trucoProponente)) {
        return { ok: false, error: 'Tu equipo propuso el truco' };
      }
    }

    m.trucoPropuesto = tipo;
    m.trucoEstado = 'propuesto';
    m.trucoProponente = jugadorIdx;
    m.trucoPuntos = PUNTOS_TRUCO[tipo];
    m.estado = ESTADO.TRUCO_PROPUESTO;
    this.agregarLog(`${this.jugadores[jugadorIdx].username} canta ${tipo.replace('_', ' ')}`);

    return { ok: true };
  }

  responderTruco(jugadorIdx, respuesta) {
    const m = this.mano;
    if (m.trucoEstado !== 'propuesto') return { ok: false, error: 'No hay truco propuesto' };
    if (this.equipoDe(jugadorIdx) === this.equipoDe(m.trucoProponente)) {
      return { ok: false, error: 'Tu equipo propuso el truco' };
    }

    if (respuesta === 'no_quiero') {
      const puntosNoQuiero = m.trucoPuntos - 1 || 1;
      this.puntaje[this.equipoDe(m.trucoProponente)] += puntosNoQuiero;
      m.trucoEstado = 'rechazado';
      m.estado = ESTADO.FIN_MANO;
      this.agregarLog(`No quiero el truco — Equipo ${this.equipoDe(m.trucoProponente)} suma ${puntosNoQuiero} pts`);

      if (this.puntaje.A >= this.limitePuntos || this.puntaje.B >= this.limitePuntos) {
        m.estado = ESTADO.FIN_JUEGO;
      }
      return { ok: true };
    }

    if (respuesta === 'quiero') {
      m.trucoEstado = 'aceptado';
      m.estado = ESTADO.TURNO;
      this.agregarLog(`¡Quiero! El truco vale ${m.trucoPuntos} puntos`);
      return { ok: true };
    }

    // Subir truco
    const CADENA = ['truco', 'retruco', 'vale_cuatro'];
    if (CADENA.includes(respuesta)) {
      return this.proponerTruco(jugadorIdx, respuesta);
    }

    return { ok: false, error: 'Respuesta inválida' };
  }

  // ─── Irse al mazo ──────────────────────────────────────────

  irseAlMazo(jugadorIdx) {
    const m = this.mano;
    const equipoContrario = this.equipoContrario(this.equipoDe(jugadorIdx));
    const puntos = m.trucoPuntos > 1 ? m.trucoPuntos - 1 : 1;
    this.puntaje[equipoContrario] += puntos;
    this.agregarLog(`${this.jugadores[jugadorIdx].username} se fue al mazo — Equipo ${equipoContrario} suma ${puntos} pts`);
    m.estado = ESTADO.FIN_MANO;

    if (this.puntaje.A >= this.limitePuntos || this.puntaje.B >= this.limitePuntos) {
      m.estado = ESTADO.FIN_JUEGO;
    }
    return { ok: true };
  }

  nuevaMano() {
    if (this.mano.estado !== ESTADO.FIN_MANO) return { ok: false, error: 'La mano no terminó' };
    this.iniciarMano();
    return { ok: true };
  }
}

module.exports = { Partida, ESTADO };
