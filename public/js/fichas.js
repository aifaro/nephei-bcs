// Fichas reales de BCS (de los módulos de VASSAL de Arracourt y Danger Forward)
// y los valores que llevan impresos. Cada unidad tiene su cara desplegada (d)
// y su cara de movimiento (m); las de una sola cara repiten la misma.
(function (root) {
  'use strict';

  const BANDOS = {
    aliado: { nombre: 'EE. UU.' },
    eje: { nombre: 'Alemania' }
  };

  const tac = 'tac', truck = 'truck', leg = 'leg';
  const U = (o) => Object.assign({ img: { d: 'fichas/u/' + o.archivo + '-d.png', m: 'fichas/u/' + o.archivo + (o.unaCara ? '-d.png' : '-m.png') } }, o);

  const UNIDADES = {
    'inf-us': U({ archivo: 'inf-us', nombre: 'Infantería', bando: 'aliado', id: '3/137 · 35th Inf Div', pasos: 6,
      d: { asalto: true, ar: 3, ma: 4, claseMa: leg }, m: { asalto: false, ar: 2, ma: 8, claseMa: leg },
      nota: 'Batallón de infantería a pie. Desplegado ataca y defiende; en su cara de movimiento está desprevenido.' }),
    'inf-de': U({ archivo: 'inf-de', nombre: 'Infantería', bando: 'eje', id: 'II/1125 · 559. VGD', pasos: 5,
      d: { asalto: true, ar: 3, ma: 4, claseMa: leg }, m: { asalto: false, ar: 2, ma: 8, claseMa: leg } }),
    'mec-us': U({ archivo: 'mec-us', nombre: 'Infantería acorazada', bando: 'aliado', id: '10 AIB · CCA/4th Arm', pasos: 4,
      d: { asalto: true, ar: 4, ma: 4, claseMa: leg }, m: { asalto: true, ar: 4, ma: 16, claseMa: tac },
      nota: 'Desplegada, la infantería ha desmontado (MA a pie); en marcha va en semiorugas con MA táctico y puede hacer Shock Attacks.' }),
    'mec-de': U({ archivo: 'mec-de', nombre: 'Panzergrenadiere', bando: 'eje', id: 'I/110 · 11. Pz', pasos: 3,
      d: { asalto: true, ar: 4, ma: 4, claseMa: leg }, m: { asalto: true, ar: 4, ma: 16, claseMa: tac } }),
    'tq-us': U({ archivo: 'tq-us', nombre: 'Tanques medios', bando: 'aliado', id: '37 Tk Bn · CCA/4th Arm', pasos: 3, duro: true,
      d: { av: 3, tipoAv: 'red', ar: 5, alcance: 2, ma: 5, claseMa: tac }, m: { av: 2, tipoAv: 'red', ar: 5, alcance: 1, ma: 14, claseMa: tac },
      nota: 'El batallón de Shermans de Abrams: Hard Red AV 3 y AR 5, el mejor de la partida.' }),
    'tq-de': U({ archivo: 'tq-de', nombre: 'Panzer IV', bando: 'eje', id: '2112 · 21. Pz', pasos: 2, duro: true,
      d: { av: 4, tipoAv: 'red', ar: 3, alcance: 2, ma: 4, claseMa: tac }, m: { av: 3, tipoAv: 'red', ar: 3, alcance: 1, ma: 14, claseMa: tac } }),
    panther: U({ archivo: 'panther', nombre: 'Panther', bando: 'eje', id: 'I/15 · 11. Pz', pasos: 2, duro: true,
      d: { av: 5, tipoAv: 'red', ar: 4, alcance: 3, ma: 4, claseMa: tac }, m: { av: 4, tipoAv: 'red', ar: 4, alcance: 2, ma: 16, claseMa: tac },
      nota: 'Hard Red AV 5 con alcance 3: solo un 6 lo daña en el Barrage Table y defiende con +2 en abierto.' }),
    tiger: U({ archivo: 'tiger', nombre: 'Tiger I', bando: 'eje', id: '2/504 · Danger Forward', pasos: 2, duro: true, ruptura: true, sinReemplazo: true,
      d: { av: 5, tipoAv: 'red', ar: 4, alcance: 3, ma: 3, claseMa: tac }, m: { av: 4, tipoAv: 'red', ar: 4, alcance: 2, ma: 14, claseMa: tac },
      nota: 'Breakthrough Hard Red AV (TGR con la marca de ruptura). El punto amarillo tras el AR indica que no admite reemplazos.' }),
    td: U({ archivo: 'td', nombre: 'Cazacarros (Limited)', bando: 'aliado', id: '602 TD Bn', pasos: 3,
      d: { av: 3, tipoAv: 'limited', ar: 4, alcance: 3, ma: 6, claseMa: tac }, m: { av: 2, tipoAv: 'limited', ar: 4, alcance: 2, ma: 16, claseMa: tac },
      nota: 'Limited AV (cifra en contorno): -1 como tirador y sin Shock Attacks.' }),
    flak: U({ archivo: 'flak', nombre: 'Cañones de 88 (Stand Off)', bando: 'eje', id: '200 · 21. Pz', pasos: 1,
      d: { av: 5, tipoAv: 'standoff', ar: 4, alcance: 3, ma: 2, claseMa: truck }, m: { asalto: false, ar: 3, ma: 12, claseMa: truck },
      nota: 'Stand Off AV (cifra negra). Remolcados, en su cara de movimiento no tienen AV: quedan desprevenidos.' }),
    'rec-us': U({ archivo: 'rec-us', nombre: 'Reconocimiento (Dual)', bando: 'aliado', id: '106 Cav Sqn', pasos: 4, recon: true, unaCara: true,
      d: { asalto: true, av: 1, tipoAv: 'red', ar: 3, alcance: 1, ma: 16, claseMa: tac }, m: { asalto: true, av: 1, tipoAv: 'red', ar: 3, alcance: 1, ma: 16, claseMa: tac },
      nota: 'Dual: flecha de asalto y AV a la vez. Ataca en el Combat Table y dispara en el Engagement Table.' }),
    'rec-de': U({ archivo: 'rec-de', nombre: 'Reconocimiento (Dual)', bando: 'eje', id: '115 · 15. PGD', pasos: 4, recon: true, unaCara: true,
      d: { asalto: true, av: 1, tipoAv: 'red', ar: 4, alcance: 1, ma: 16, claseMa: tac }, m: { asalto: true, av: 1, tipoAv: 'red', ar: 4, alcance: 1, ma: 16, claseMa: tac } })
  };

  // Apoyos (Support) disponibles para un host.
  const APOYOS = {
    red: { nombre: 'Apoyo de tanques', tipoAv: 'red', av: 3, alcance: 2 },
    limited: { nombre: 'Apoyo de cazacarros', tipoAv: 'limited', av: 3, alcance: 2 },
    standoff: { nombre: 'Apoyo de cañones de 88', tipoAv: 'standoff', av: 4, alcance: 3 }
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function etiqueta(u) { return u.nombre + ' (' + BANDOS[u.bando].nombre + ')'; }

  // Ficha real. op: { tam (px; sin él ocupa el ancho del contenedor), pasos, clase }
  // Si le quedan menos pasos que los impresos, tapa la casilla con los que quedan,
  // como haría el marcador de pérdida de pasos.
  function ficha(u, lado, op) {
    op = op || {};
    lado = lado || 'd';
    const pasos = op.pasos !== undefined ? op.pasos : u.pasos;
    const estilo = op.tam ? ` style="width:${op.tam}px"` : '';
    const alt = esc(u.nombre + ' · ' + u.id + (u.unaCara ? '' : lado === 'm' ? ', cara de movimiento' : ', cara desplegada'));
    const resto = pasos > 0 && pasos < u.pasos ? `<span class="ficha__pasos" aria-hidden="true">${pasos}</span>` : '';
    return `<span class="ficha ${op.clase || ''}"${estilo}><img src="${u.img[lado]}" alt="${alt}" draggable="false">${resto}</span>`;
  }

  const MARCADORES = {
    obj: 'OBJ', dobleobj: 'Double OBJ', red: 'Red Support', limited: 'Limited Support', standoff: 'Stand Off Support',
    drop: 'Dropped Support', trafico: 'Traffic', pd: 'Prepared Defense', screen: 'Screen', arty: 'Puntos de artillería'
  };
  function marcador(tipo, op) {
    op = op || {};
    const archivo = tipo === 'arty' ? 'arty-' + Math.min(3, Math.max(1, op.n || 1)) : tipo;
    const estilo = op.tam ? ` style="width:${op.tam}px"` : '';
    return `<span class="marcador"${estilo}><img src="fichas/m/${archivo}.png" alt="${esc(MARCADORES[tipo] || tipo)}" draggable="false"></span>`;
  }

  root.Fichas = { BANDOS, UNIDADES, APOYOS, ficha, marcador, etiqueta, esc };
})(window);
