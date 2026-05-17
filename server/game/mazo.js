// Mazo español de 40 cartas

const PALOS = ['espada', 'basto', 'oro', 'copa'];

const CARTAS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]; // sin 8 y 9

// Valor de truco (jerarquía de mayor a menor)
// 1=14, 2=13, 3=12, 7e=11, 7o=10, 3=9... etc.
const VALOR_TRUCO = {
  '1-espada': 14,
  '1-basto': 13,
  '7-espada': 12,
  '7-oro': 11,
  '3-espada': 10, '3-basto': 10, '3-oro': 10, '3-copa': 10,
  '2-espada': 9, '2-basto': 9, '2-oro': 9, '2-copa': 9,
  '1-oro': 8, '1-copa': 8,
  '12-espada': 7, '12-basto': 7, '12-oro': 7, '12-copa': 7,
  '11-espada': 6, '11-basto': 6, '11-oro': 6, '11-copa': 6,
  '10-espada': 5, '10-basto': 5, '10-oro': 5, '10-copa': 5,
  '7-basto': 4, '7-copa': 4,
  '6-espada': 3, '6-basto': 3, '6-oro': 3, '6-copa': 3,
  '5-espada': 2, '5-basto': 2, '5-oro': 2, '5-copa': 2,
  '4-espada': 1, '4-basto': 1, '4-oro': 1, '4-copa': 1,
};

// Valor de envido por carta
function valorEnvido(numero) {
  if (numero >= 10) return 0; // figuras valen 0
  return numero;
}

function crearMazo() {
  const mazo = [];
  for (const palo of PALOS) {
    for (const numero of CARTAS) {
      mazo.push({ numero, palo, id: `${numero}-${palo}` });
    }
  }
  return mazo;
}

function mezclarMazo(mazo) {
  const m = [...mazo];
  for (let i = m.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [m[i], m[j]] = [m[j], m[i]];
  }
  return m;
}

function repartirCartas(mazo, cantJugadores) {
  // 3 cartas por jugador
  const manos = Array.from({ length: cantJugadores }, () => []);
  for (let i = 0; i < cantJugadores * 3; i++) {
    manos[i % cantJugadores].push(mazo[i]);
  }
  return manos;
}

function calcularEnvido(cartas) {
  // Buscar el mejor envido con las 3 cartas
  let mejorEnvido = 0;

  // Agrupar por palo
  const porPalo = {};
  for (const c of cartas) {
    if (!porPalo[c.palo]) porPalo[c.palo] = [];
    porPalo[c.palo].push(c);
  }

  for (const palo in porPalo) {
    const grupo = porPalo[palo];
    if (grupo.length >= 2) {
      // Sumar los dos mayores valores del mismo palo + 20
      const vals = grupo.map(c => valorEnvido(c.numero)).sort((a, b) => b - a);
      const envido = 20 + vals[0] + vals[1];
      if (envido > mejorEnvido) mejorEnvido = envido;
    } else {
      // Carta suelta
      const val = valorEnvido(grupo[0].numero);
      if (val > mejorEnvido) mejorEnvido = val;
    }
  }

  return mejorEnvido;
}

function valorTruco(carta) {
  return VALOR_TRUCO[carta.id] || 0;
}

function determinarGanadorMano(jugadas) {
  // jugadas = [{jugadorIndex, carta}]
  let mejor = null;
  let empate = false;

  for (const j of jugadas) {
    const val = valorTruco(j.carta);
    if (!mejor || val > mejor.valor) {
      mejor = { jugadorIndex: j.jugadorIndex, valor: val };
      empate = false;
    } else if (val === mejor.valor) {
      empate = true;
    }
  }

  if (empate) return null; // parda
  return mejor.jugadorIndex;
}

module.exports = {
  crearMazo,
  mezclarMazo,
  repartirCartas,
  calcularEnvido,
  valorTruco,
  determinarGanadorMano
};
