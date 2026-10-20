// Fichas de BCS dibujadas en SVG, con el mismo esquema que las de verdad:
// pasos arriba a la izquierda, símbolo OTAN en el centro (amarillo si es Hard),
// identificador en vertical, y abajo flecha de asalto, AV, AR, alcance y MA.
// Las unidades de ejemplo son genéricas: valores típicos de la serie, no de
// un juego concreto (ver la lista de tipos de AV de la página 38 de las reglas).
(function (root) {
  'use strict';

  const BANDOS = {
    aliado: { fondo: '#8c9a35', claro: '#a5b24a', oscuro: '#6b7726', barra: '#e9c66f', nombre: 'Aliados' },
    eje: { fondo: '#a9a69a', claro: '#bdbab0', oscuro: '#86837a', barra: '#a9bfe3', nombre: 'Eje' }
  };

  // Unidades de ejemplo. d = cara desplegada (Deployed), m = cara de movimiento (Move).
  const UNIDADES = {
    inf: {
      nombre: 'Infantería', id: '2/137', tamano: 'II', simbolo: 'inf', pasos: 6,
      d: { asalto: true, ar: 3, ma: 4, claseMa: 'leg' },
      m: { asalto: false, ar: 2, ma: 8, claseMa: 'leg' },
      nota: 'Batallón de infantería a pie. Desplegada ataca y defiende; en su cara de movimiento está desprevenida.'
    },
    mec: {
      nombre: 'Infantería mecanizada', id: 'I/104', tamano: 'II', simbolo: 'mec', pasos: 5,
      d: { asalto: true, ar: 4, ma: 4, claseMa: 'tac' },
      m: { asalto: true, ar: 3, ma: 10, claseMa: 'tac' },
      nota: 'Panzergrenadiers en semiorugas: capacidad de ataque con MA táctico, así que puede hacer Shock Attacks.'
    },
    sherman: {
      nombre: 'Tanque medio', id: '3/66', tamano: 'II', simbolo: 'blindado', pasos: 4,
      d: { av: 3, tipoAv: 'red', ar: 3, alcance: 2, ma: 5, claseMa: 'tac' },
      m: { av: 3, tipoAv: 'red', ar: 3, alcance: 1, ma: 14, claseMa: 'tac' },
      nota: 'Tipo M4 Sherman: Red AV 3, alcance 2. Sin chasis Hard: sufre como cualquiera en el Barrage Table.'
    },
    panther: {
      nombre: 'Tanque pesado (Hard)', id: 'I/15', tamano: 'II', simbolo: 'blindado', pasos: 2, duro: true,
      d: { av: 5, tipoAv: 'red', ar: 4, alcance: 3, ma: 4, claseMa: 'tac' },
      m: { av: 4, tipoAv: 'red', ar: 4, alcance: 2, ma: 16, claseMa: 'tac' },
      nota: 'Tipo Panther: Hard Red AV. Solo le hace daño un 6 en el Barrage Table y defiende muy bien en abierto.'
    },
    tiger: {
      nombre: 'Tanque de ruptura', id: 's.Pz 503', tamano: 'II', simbolo: 'tgr', pasos: 3, duro: true, ruptura: true,
      d: { av: 5, tipoAv: 'red', ar: 4, alcance: 3, ma: 4, claseMa: 'tac' },
      m: { av: 5, tipoAv: 'red', ar: 4, alcance: 2, ma: 14, claseMa: 'tac' },
      nota: 'Tipo Tiger I: Breakthrough Hard Red AV. Siempre puede hacer Shock Attacks y gana +2 al hacerlos.'
    },
    td: {
      nombre: 'Cazacarros (Limited)', id: '602', tamano: 'II', simbolo: 'td', pasos: 3,
      d: { av: 3, tipoAv: 'limited', ar: 4, alcance: 3, ma: 6, claseMa: 'tac' },
      m: { av: 2, tipoAv: 'limited', ar: 4, alcance: 2, ma: 16, claseMa: 'tac' },
      nota: 'Limited AV (cifra en contorno): defensivo, con -1 como tirador en el Engagement Table. No hace Shock Attacks.'
    },
    flak: {
      nombre: 'Cañón de 88 mm (Stand Off)', id: '200', tamano: 'II', simbolo: 'c88', pasos: 1,
      d: { av: 5, tipoAv: 'standoff', ar: 4, alcance: 3, ma: 2, claseMa: 'truck' },
      m: { asalto: false, ar: 3, ma: 12, claseMa: 'truck' },
      nota: 'Stand Off AV (cifra negra): largo alcance y difícil de localizar. Remolcado, en su cara de movimiento no tiene AV.'
    },
    recon: {
      nombre: 'Reconocimiento (Dual)', id: '115', tamano: 'II', simbolo: 'recon', pasos: 4, recon: true, unaCara: true,
      d: { asalto: true, av: 1, tipoAv: 'red', ar: 4, alcance: 1, ma: 16, claseMa: 'tac' },
      m: { asalto: true, av: 1, tipoAv: 'red', ar: 4, alcance: 1, ma: 16, claseMa: 'tac' },
      nota: 'Dual: flecha de asalto y AV a la vez. Ataca en el Combat Table y dispara en el Engagement Table. Recon.'
    },
    autoam: {
      nombre: 'Autoametralladoras (Light)', id: 'A/42', tamano: 'I', simbolo: 'cocheblind', pasos: 1, recon: true, unaCara: true,
      d: { av: 0, tipoAv: 'light', ar: 3, alcance: 1, ma: 16, claseMa: 'tac' },
      m: { av: 0, tipoAv: 'light', ar: 3, alcance: 1, ma: 16, claseMa: 'tac' },
      nota: 'Light AV (cifra blanca): ametralladoras sobre ruedas. No puede iniciar Enfrentamientos, solo ser su blanco.'
    }
  };

  // Apoyos (Support) disponibles para un host.
  const APOYOS = {
    red: { nombre: 'Apoyo de tanques', tipoAv: 'red', av: 3, alcance: 2 },
    limited: { nombre: 'Apoyo de cazacarros', tipoAv: 'limited', av: 3, alcance: 2 },
    standoff: { nombre: 'Apoyo de cañones de 88', tipoAv: 'standoff', av: 4, alcance: 3 }
  };

  const COLOR_MA = { tac: '#c8221d', truck: '#141414', leg: '#ffffff' };

  // Símbolos OTAN dentro de una caja de 28x18 centrada en (0,0).
  function simbolo(tipo, relleno) {
    const caja = `<rect x="-14" y="-9" width="28" height="18" fill="${relleno}" stroke="#111" stroke-width="1.6"/>`;
    const x = '<path d="M-14 -9 L14 9 M14 -9 L-14 9" stroke="#111" stroke-width="1.5"/>';
    const ovalo = (w) => `<ellipse cx="0" cy="0" rx="${w}" ry="5" fill="none" stroke="#111" stroke-width="1.6"/>`;
    const texto = (t, s) => `<text x="0" y="${s * 0.36}" text-anchor="middle" font-size="${s}" font-weight="700" fill="#111" font-family="'Roboto Condensed','Arial Narrow',sans-serif">${t}</text>`;
    switch (tipo) {
      case 'inf': return caja + x;
      case 'mec': return caja + x + `<ellipse cx="0" cy="0" rx="9" ry="4.4" fill="${relleno}" stroke="#111" stroke-width="1.5"/>`;
      case 'blindado': return caja + ovalo(9.5);
      case 'recon': return caja + '<path d="M-14 9 L14 -9" stroke="#111" stroke-width="1.5"/>' + ovalo(8.5);
      case 'cocheblind': return caja + '<path d="M-14 9 L14 -9" stroke="#111" stroke-width="1.5"/>' + '<circle cx="-6" cy="5.6" r="2" fill="#111"/><circle cx="6" cy="5.6" r="2" fill="#111"/>';
      case 'td': return caja + `<rect x="-9" y="-6" width="18" height="12" rx="6" fill="none" stroke="#111" stroke-width="1.3"/>` + texto('TD', 8.5);
      case 'tgr': return caja + texto('TGR', 10);
      case 'c88': return caja + texto('88', 12);
      default: return caja;
    }
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // Dibuja la cifra del AV con el estilo de su tipo.
  function cifraAv(cara, x, y) {
    const v = cara.av;
    const fuente = `font-family="'Roboto Condensed','Arial Narrow',sans-serif" font-weight="700" font-size="25" text-anchor="middle"`;
    switch (cara.tipoAv) {
      case 'red': return `<text x="${x}" y="${y}" ${fuente} fill="#c8221d">${v}</text>`;
      case 'limited': return `<text x="${x}" y="${y}" ${fuente} fill="none" stroke="#1d3a12" stroke-width="1.2">${v}</text>`;
      case 'standoff': return `<text x="${x}" y="${y}" ${fuente} fill="#111">${v}</text>`;
      case 'light': return `<text x="${x}" y="${y}" ${fuente} fill="#fff" stroke="#111" stroke-width="0.8">${v}</text>`;
      default: return '';
    }
  }

  // u: unidad (de UNIDADES o copia), lado: 'd'|'m', opciones: { bando, pasos, tam, clase }
  function svgFicha(u, lado, op) {
    op = op || {};
    const b = BANDOS[op.bando || 'aliado'];
    const cara = u[lado || 'd'];
    const pasos = op.pasos !== undefined ? op.pasos : u.pasos;
    const tam = op.tam || 80;
    const uid = 'f' + Math.random().toString(36).slice(2, 8);
    const fuente = `font-family="'Roboto Condensed','Arial Narrow',sans-serif" font-weight="700"`;
    const relleno = u.duro ? '#f3d22b' : '#ffffff';
    let s = `<svg class="ficha ${op.clase || ''}" viewBox="0 0 80 80" width="${tam}" height="${tam}" role="img" aria-label="${esc(u.nombre + (lado === 'm' ? ', cara de movimiento' : ', cara desplegada'))}">`;
    s += `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b.claro}"/><stop offset="1" stop-color="${b.fondo}"/></linearGradient></defs>`;
    s += `<rect x="1" y="1" width="78" height="78" rx="5" fill="url(#${uid})" stroke="${b.oscuro}" stroke-width="1.5"/>`;
    s += `<rect x="3" y="57" width="74" height="17" fill="${b.barra}" opacity="0.9"/>`;
    // Pasos
    if (pasos > 0) {
      s += `<rect x="25" y="5" width="11" height="12" fill="#f3d22b" stroke="#c8221d" stroke-width="1.3"/>`;
      s += `<text x="30.5" y="15" text-anchor="middle" font-size="11" ${fuente} fill="#111">${pasos}</text>`;
    }
    // Tamaño de unidad
    s += `<text x="44" y="13" text-anchor="middle" font-size="7.5" ${fuente} fill="#111" letter-spacing="-0.5">${u.tamano === 'I' ? '|' : '||'}</text>`;
    // Símbolo
    s += `<g transform="translate(40 26)">${simbolo(u.simbolo, relleno)}</g>`;
    if (u.ruptura) s += `<text x="40" y="45" text-anchor="middle" font-size="6.5" ${fuente} fill="#111">BREAKTHROUGH</text>`;
    // Identificador en vertical a la izquierda y formación a la derecha
    s += `<text transform="translate(14 27) rotate(-90)" text-anchor="middle" font-size="10" ${fuente} fill="#111">${esc(u.id)}</text>`;
    s += `<text transform="translate(68 27) rotate(-90)" text-anchor="middle" font-size="9" ${fuente} fill="#111">${b === BANDOS.eje ? '21 Pz' : '4 Arm'}</text>`;
    // Fila inferior
    const yb = 73;
    if (cara.asalto) {
      s += `<path d="M9 72 L9 60 M5 64 L9 58 L13 64" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      s += `<path d="M9 72 L9 60 M5 64 L9 58 L13 64" stroke="#111" stroke-width="0.8" fill="none"/>`;
    }
    const tieneAv = cara.av !== undefined && cara.av !== null;
    if (tieneAv) s += cifraAv(cara, 24, yb);
    // AR (arriba) y alcance (abajo), entre el AV y el MA
    const xAr = tieneAv ? 37 : 34;
    s += `<text x="${xAr}" y="${tieneAv ? 61 : 66}" text-anchor="middle" font-size="${tieneAv ? 11 : 14}" ${fuente} fill="#111">${cara.ar}</text>`;
    if (tieneAv && cara.alcance && cara.alcance > 1) s += `<text x="${xAr}" y="74" text-anchor="middle" font-size="10" ${fuente} fill="#111">${cara.alcance}</text>`;
    // MA
    const colorMa = COLOR_MA[cara.claseMa];
    const borde = cara.claseMa === 'leg' ? ' stroke="#111" stroke-width="0.9"' : '';
    s += `<text x="${cara.ma >= 10 ? 59 : 57}" y="${yb + 1}" text-anchor="middle" font-size="25" ${fuente} fill="${colorMa}"${borde} letter-spacing="-1.5">${cara.ma}</text>`;
    s += '</svg>';
    return s;
  }

  // Marcadores de juego dibujados (OBJ, apoyos, Tráfico, PD, pérdida de pasos…).
  function svgMarcador(tipo, op) {
    op = op || {};
    const tam = op.tam || 44;
    const fuente = `font-family="'Roboto Condensed','Arial Narrow',sans-serif" font-weight="700" text-anchor="middle"`;
    const base = (fondo) => `<rect x="1" y="1" width="78" height="78" rx="5" fill="${fondo}" stroke="#555" stroke-width="1.5"/>`;
    let c = '';
    switch (tipo) {
      case 'obj': c = base('#fff') + `<text x="40" y="52" font-size="30" ${fuente} fill="#9b1c1c">OBJ</text>`; break;
      case 'dobleobj': c = base('#fff') + `<text x="40" y="36" font-size="21" ${fuente} fill="#9b1c1c">Double</text><text x="40" y="62" font-size="25" ${fuente} fill="#9b1c1c">OBJ</text>`; break;
      case 'red': case 'limited': case 'standoff': {
        const n = { red: 'Red', limited: 'Limited', standoff: 'Stand Off' }[tipo];
        const col = { red: '#9b1c1c', limited: '#fff', standoff: '#111' }[tipo];
        const st = tipo === 'limited' ? ' stroke="#555" stroke-width="1"' : '';
        c = base('#fff') + `<path d="M8 30 H28 A12 12 0 0 1 52 30 H72" stroke="#111" stroke-width="2.4" fill="none"/><path d="M40 30 L52 18" stroke="#111" stroke-width="4" stroke-linecap="round"/>`
          + `<text x="40" y="52" font-size="${tipo === 'standoff' ? 15 : 17}" ${fuente} fill="${col}"${st}>${n}</text><text x="40" y="69" font-size="15" ${fuente} fill="${col}"${st}>Support</text>`;
        break;
      }
      case 'drop': c = base('#a5b24a') + `<text transform="translate(40 46) rotate(-35)" font-size="17" ${fuente} fill="#9b1c1c">Dropped</text><text transform="translate(46 64) rotate(-35)" font-size="17" ${fuente} fill="#9b1c1c">Support</text>`; break;
      case 'trafico': c = base('#e9e3cf') + `<text x="40" y="34" font-size="19" ${fuente} fill="#111">Traffic</text><path d="M14 52 h52 M14 60 h52" stroke="#111" stroke-width="3" stroke-dasharray="7 4"/>`; break;
      case 'pd': c = base('#f5e6b8') + `<path d="M10 40 q10 -14 20 0 t20 0 t20 0" stroke="#7a4b12" stroke-width="3" fill="none"/><text x="40" y="62" font-size="13" ${fuente} fill="#7a4b12">Prepared</text><text x="40" y="74" font-size="12" ${fuente} fill="#7a4b12">Defense</text>`; break;
      case 'perdida': c = `<rect x="1" y="1" width="78" height="78" rx="5" fill="#fff" stroke="#c8221d" stroke-width="3"/><text x="40" y="58" font-size="44" ${fuente} fill="#c8221d">${op.n || 1}</text>`; break;
      case 'arty': c = base('#8c9a35') + `<rect x="16" y="12" width="48" height="30" fill="#7c8a26" stroke="#111" stroke-width="2"/><circle cx="40" cy="27" r="4" fill="#111"/><path d="M40 47 l5 9 l10 -2 l-6 8 l6 8 l-10 -2 l-5 9 l-5 -9 l-10 2 l6 -8 l-6 -8 l10 2z" fill="#f2a33a"/><text x="40" y="70" font-size="16" ${fuente} fill="#111">${op.n || 1}</text>`; break;
      case 'screen': c = base('#fff') + `<text transform="translate(42 52) rotate(-35)" font-size="22" ${fuente} fill="#c8221d">Screen</text>`; break;
      default: c = base('#fff');
    }
    return `<svg class="marcador" viewBox="0 0 80 80" width="${tam}" height="${tam}" role="img" aria-label="${esc(tipo)}">${c}</svg>`;
  }

  root.Fichas = { BANDOS, UNIDADES, APOYOS, svgFicha, svgMarcador, esc };
})(window);
