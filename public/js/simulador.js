// Simulador de ataques: estado, mapa de hexes, modificadores, probabilidades
// y tirada con sus efectos sobre las fichas.
(function () {
  'use strict';

  const R = Reglas, F = Fichas, U = Fichas.UNIDADES;
  const $ = (s) => document.querySelector(s);
  const esc = F.esc;
  const t = I18N.t;

  // ---------- Modos ----------
  const MODOS = {
    regular: { nombre: t('Ataque regular'), sub: 'Combat Table · 2d6', regla: '5.1', tabla: 'Combat Table',
      explica: t('Un asalto preparado: la unidad atacante con flecha de asalto entra en el hex enemigo con ayuda de una asistencia y de la artillería. Al terminar, atacante y asistente quedan FINISHED.') },
    shock: { nombre: t('Ataque de choque'), sub: 'Combat Table · 2d6', regla: '5.1m', tabla: 'Combat Table',
      explica: t('Un mecanizado con MA táctico arrolla un hex sin ningún AV, ni real ni de apoyo. Gasta un Fire Event, no admite asistencia y, si no queda detenida, la unidad sigue moviendo después.') },
    enfrentamiento: { nombre: t('Enfrentamiento'), sub: 'Engagement Table · 2d6', regla: '5.2', tabla: 'Engagement Table',
      explica: t('Duelo entre blindados: una unidad AV dispara a otra unidad AV o al apoyo de un host. No conquista terreno, pero causa bajas, quita el apoyo enemigo y abre paso a tus otras unidades.') },
    fuego: { nombre: t('Ataque por fuego'), sub: 'Barrage Table · 1d6', regla: '5.3', tabla: 'Barrage Table · Attack by Fire',
      explica: t('Una unidad AV dispara explosivo contra un hex adyacente sin AV. Se tira un dado por cada unidad del hex, en la columna Attack by Fire del Barrage Table.') },
    bombardeo: { nombre: t('Bombardeo'), sub: 'Barrage Table · 1d6', regla: '5.4', tabla: 'Barrage Table · Arty',
      explica: t('Artillería o aviación contra un hex en una OBJ Zone, con un observador. Bombardeo de destrucción: un dado por cada punto y por cada unidad del hex.') }
  };

  // Juego y escenario de los que salen las fichas (juegos.js)
  const JG = Juegos.JUEGOS;
  let juego = Juegos.ORDEN[0], escenario = 0;
  const pool = () => JG[juego].escenarios[escenario].unidades;
  function rol(nombre) {
    const ks = pool();
    if (nombre === 'av') return ks.filter((k) => R.tieneAv(U[k].d) || R.tieneAv(U[k].m));
    if (nombre === 'host') return ks.filter((k) => R.puedeSerHost(U[k].d));
    return ks;
  }
  // Unidad del escenario para cada papel de los valores iniciales: [bando, qué tiene que ser]
  const PAPEL = {
    'inf-us': [0, (u) => u.d.asalto && u.d.av === undefined && u.d.ma > 0 && u.d.ar >= 3],
    'tq-us': [0, (u) => u.d.tipoAv === 'red' && u.duro && u.d.ar >= 3],
    'mec-us': [0, (u) => u.m.asalto && u.m.claseMa === 'tac'],
    'inf-de': [1, (u) => u.d.asalto && u.d.av === undefined && u.m.av === undefined && u.d.ma > 0],   // sin AV en ninguna cara: vale para el choque y el fuego
    panther: [1, (u) => u.d.tipoAv === 'red' && u.duro],
    flak: [1, (u) => u.d.av !== undefined]
  };
  function eq(k) {
    const [lado, f] = PAPEL[k], ks = pool(), ok = (x) => f(U[x]);
    return ks.find((x) => U[x].lado === lado && ok(x)) || ks.find(ok) || ks.find((x) => U[x].lado === lado) || ks[0];
  }

  function nueva(k, lado) { k = eq(k); return { k, lado: lado || 'd', pasos: U[k].pasos }; }

  function estadoInicial(modo) {
    const base = { modo, juego, escenario, terreno: 'abierto', claveTerreno: false, ladoHex: false, pdDef: false, pdAtt: false, msrAtt: false, msrDef: false,
      dobleObj: false, bombardeo: 'ninguno', puntos: 1, desdeFuera: false, fuegoPrevio: false, costeMp: true, arDef: 0,
      apoyoAtt: null, apoyoDef: null, asistente: null };
    switch (modo) {
      case 'regular': return Object.assign(base, { atacante: nueva('inf-us'), apoyoAtt: 'red', asistente: nueva('tq-us'), defensores: [nueva('inf-de')], apoyoDef: null, bombardeo: 'supresion' });
      case 'shock': return Object.assign(base, { atacante: nueva('mec-us', 'm'), apoyoAtt: 'red', defensores: [nueva('inf-de', 'm')] });
      case 'enfrentamiento': return Object.assign(base, { tirador: nueva('tq-us'), blancoTipo: 'real', blanco: nueva('panther'), host: nueva('inf-de'), apoyoBlanco: 'standoff', distancia: Math.min(2, U[eq('tq-us')].d.alcance || 1), variosApoyos: false, pantalla: false, opcionalLejos: false });
      case 'fuego': return Object.assign(base, { tirador: nueva('tq-us'), defensores: [nueva('inf-de'), nueva('inf-de', 'm')] });
      case 'bombardeo': return Object.assign(base, { defensores: [nueva('inf-de'), nueva('flak')], puntos: 1, enAtaque: false });
    }
  }

  let S = cargar();
  if (S) { juego = S.juego; escenario = S.escenario; } else S = estadoInicial('regular');
  let resultado = null;     // efectos de la última tirada sobre el mapa
  let animando = false;
  let historial = [];
  try { historial = JSON.parse(Comun.leer('bcs-sim-hist' + (I18N.en ? '-en' : '')) || '[]'); } catch (e) { historial = []; }

  function guardar() { Comun.guardar('bcs-sim', JSON.stringify(S)); }
  function cargar() {
    try {
      const s = JSON.parse(Comun.leer('bcs-sim'));
      const insts = [s.atacante, s.asistente, s.tirador, s.blanco, s.host].concat(s.defensores || []).filter(Boolean);
      if (s && MODOS[s.modo] && JG[s.juego] && JG[s.juego].escenarios[s.escenario] && insts.every((i) => U[i.k] && U[i.k].juego === s.juego)) return s;
    } catch (e) { /* estado ilegible */ }
    return null;
  }

  // ---------- Ayudas de unidades ----------
  function cara(i) { return U[i.k][i.lado]; }
  function unidad(i) { return U[i.k]; }
  function vivos(lista) { return lista.filter((i) => i.pasos > 0); }
  function conNombre(i) { return Object.assign({}, U[i.k], { nombre: I18N.en ? U[i.k].nombre : U[i.k].nombre.toLowerCase() }); }

  // ---------- Contextos para el motor ----------
  function ctxCombate() {
    const defs = S.defensores;
    const arIdx = Math.min(S.arDef, defs.length - 1);
    const arU = defs[arIdx];
    const pdDef = S.pdDef && arU.lado === 'd';
    return {
      tipo: S.modo === 'shock' ? 'shock' : 'regular',
      atacante: { unidad: conNombre(S.atacante), cara: cara(S.atacante), apoyo: S.apoyoAtt },
      asistente: S.modo === 'regular' && S.asistente ? { unidad: conNombre(S.asistente), cara: cara(S.asistente) } : null,
      defensor: { unidad: conNombre(arU), cara: cara(arU), apoyo: S.apoyoDef },
      numDefensores: vivos(defs).length,
      terreno: S.terreno, claveTerreno: S.claveTerreno, ladoHex: S.ladoHex,
      pdDefensor: pdDef, defensorDesplegado: arU.lado === 'd', pdAtacante: S.pdAtt,
      msrAtacante: S.msrAtt, msrDefensor: S.msrDef, dobleObj: S.dobleObj,
      supresion: S.bombardeo === 'supresion', desdeFuera: S.desdeFuera, fuegoPrevio: S.fuegoPrevio,
      defensorConAv: defs.some((i) => R.tieneAv(cara(i))) || !!S.apoyoDef,
      costeMp: S.costeMp, defensorClaseMa: cara(arU).claseMa
    };
  }

  function ctxEnfrentamiento() {
    const apoyo = S.blancoTipo === 'apoyo';
    const blanco = apoyo ? S.host : S.blanco;
    return {
      tirador: { unidad: conNombre(S.tirador), cara: cara(S.tirador) },
      blancoEsApoyo: apoyo,
      blanco: { unidad: conNombre(S.blanco), cara: cara(S.blanco) },
      apoyo: F.APOYOS[S.apoyoBlanco],
      host: { unidad: conNombre(S.host), cara: cara(S.host) },
      distancia: S.distancia, dobleObj: S.dobleObj,
      pdBlanco: S.pdDef && blanco.lado === 'd',
      variosApoyos: S.variosApoyos, terrenoBlanco: S.terreno !== 'abierto',
      blancoPantalla: !apoyo && S.pantalla, opcionalLejos: S.opcionalLejos
    };
  }

  // Fila del Barrage Table para cada unidad objetivo.
  function filaPara(i) {
    const c = cara(i);
    return R.filaBombardeo({ duro: unidad(i).duro, standoffDesplegado: c.tipoAv === 'standoff' && i.lado === 'd' }, { terreno: S.terreno, pd: S.pdDef && i.lado === 'd' });
  }

  function requisitosFuego() {
    const r = [];
    const ok = (c, t) => r.push({ ok: !!c, texto: t });
    const c = cara(S.tirador);
    ok(R.tieneAv(c), t('El tirador es una unidad AV real (no en apoyo)'));
    ok(!S.defensores.some((i) => R.tieneAv(cara(i))) && !S.apoyoDef, t('El hex objetivo no contiene ningún AV, ni real ni de apoyo'));
    ok(true, t('Tirador y objetivo son adyacentes, y el objetivo está en una OBJ Zone'));
    ok(true, t('El tirador puede estar STOPPED, pero no FINISHED; gasta un Fire Event'));
    return r;
  }
  function requisitosBombardeo() {
    return [
      { ok: true, texto: t('El hex objetivo está en una OBJ Zone y contiene una unidad enemiga') },
      { ok: true, texto: t('Un observador de la formación, a 4 hexes o menos y con línea de visión, que empezó la fase dentro del radio de mando') },
      { ok: S.enAtaque || S.puntos <= 1, texto: S.enAtaque ? t('Dentro de un ataque regular: hasta 3 puntos') : t('Fuera de un ataque: un solo punto (el observador queda STOPPED)') },
      { ok: true, texto: t('Solo un bombardeo por hex y activación (salvo en hexes Urbanos)') }
    ];
  }

  // ---------- Colores de resultados ----------
  const COL_COMBATE = ['#8f1d17', '#d6453a', '#e9893c', '#e9bf3c', '#8cc265', '#3f9d58'];
  const COL_ENF_REAL = ['#d6453a', '#e9a13c', '#3f9d58'];
  const COL_ENF_APOYO = ['#d6453a', '#8a8f86', '#8cc265', '#3f9d58'];

  const TXT_COMBATE = [
    t('El atacante pierde 2 pasos'),
    t('El atacante pierde 1 paso'),
    t('Atacante -1 y retirada situacional del defensor'),
    t('[A1] y retirada situacional del defensor'),
    t('El defensor pierde 1 paso y se retira'),
    t('El defensor pierde 2 pasos y se retira')
  ];

  // ---------- Pintado general ----------
  function pintarTodo() {
    pintarModos();
    pintarMapa();
    pintarSlots();
    pintarCirc();
    pintarCalculo();
    guardar();
  }

  function pintarModos() {
    const c = $('#modos');
    c.innerHTML = Object.entries(MODOS).map(([k, m]) => `<button class="modo" type="button" data-m="${k}" aria-pressed="${k === S.modo}"><strong>${m.nombre}</strong><span>${m.sub}</span></button>`).join('');
    c.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (animando || b.dataset.m === S.modo) return;
      S = estadoInicial(b.dataset.m); resultado = null; limpiarTirada(); pintarTodo();
    }));
    $('#explica').textContent = MODOS[S.modo].explica;
    $('#regla-tabla').textContent = MODOS[S.modo].tabla + ' · ' + MODOS[S.modo].regla;
    $('#t-mod-txt').textContent = S.modo === 'fuego' || S.modo === 'bombardeo' ? t('Fila de la tabla') : t('Modificadores');
  }

  // ---------- Mapa ----------
  const HR = 50, HW = Math.sqrt(3) * HR, COLS = 7, FILAS = 3, PAD = 6;
  const VBW = HW * COLS + HW / 2 + PAD * 2, VBH = HR * 2 + HR * 1.5 * (FILAS - 1) + PAD * 2;
  function centro(c, r) { return [PAD + HW / 2 + c * HW + (r % 2 ? HW / 2 : 0), PAD + HR + r * HR * 1.5]; }
  function pct(x, y) { return ['left:' + (x / VBW * 100).toFixed(3) + '%', 'top:' + (y / VBH * 100).toFixed(3) + '%']; }
  function poligono(c, r) {
    const [cx, cy] = centro(c, r), p = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i - 30); p.push((cx + HR * Math.cos(a)).toFixed(1) + ',' + (cy + HR * Math.sin(a)).toFixed(1)); }
    return p.join(' ');
  }

  // Describe la escena según el modo: hexes especiales, pilas, marcadores y flechas.
  function escena() {
    const e = { terrenos: {}, pilas: [], marcas: [], flechas: [], etiquetas: [], zona: [], ladoHex: null };
    const tdef = S.terreno;
    if (S.modo === 'regular' || S.modo === 'shock') {
      e.terrenos['2,1'] = tdef;
      e.pilas.push({ id: 'att', c: 1, r: 1, unidades: [S.atacante], bando: 'aliado' });
      if (S.modo === 'regular' && S.asistente) e.pilas.push({ id: 'ast', c: 2, r: 0, unidades: [S.asistente], bando: 'aliado' });
      e.pilas.push({ id: 'def', c: 2, r: 1, unidades: S.defensores, bando: 'eje' });
      e.flechas.push({ de: [1, 1], a: [2, 1], tipo: 'ataque' });
      if (S.modo === 'regular' && S.asistente) e.flechas.push({ de: [2, 0], a: [2, 1], tipo: 'asist' });
      e.etiquetas.push({ c: 1, r: 1, t: t('Atacante'), cls: 'a' }, { c: 2, r: 1, t: t('Defensor'), cls: 'd' });
      if (S.modo === 'regular' && S.asistente) e.etiquetas.push({ c: 2, r: 0, t: t('Asistente'), cls: 'a' });
      e.marcas.push({ tipo: S.dobleObj ? 'dobleobj' : 'obj', c: 2, r: 1, dx: 0.42, dy: -0.5 });
      if (S.apoyoAtt && R.puedeSerHost(cara(S.atacante))) e.marcas.push({ tipo: S.apoyoAtt, c: 1, r: 1, dx: -0.48, dy: -0.42 });
      if (S.apoyoDef && R.puedeSerHost(cara(S.defensores[S.arDef] || S.defensores[0]))) e.marcas.push({ tipo: S.apoyoDef, c: 2, r: 1, dx: -0.48, dy: -0.42 });
      if (S.pdDef) e.marcas.push({ tipo: 'pd', c: 2, r: 1, dx: 0.45, dy: 0.42 });
      if (S.bombardeo !== 'ninguno') e.marcas.push({ tipo: 'arty', n: S.bombardeo === 'supresion' ? 1 : S.puntos, c: 0, r: 0, dx: 0, dy: 0, grande: true });
      if (S.ladoHex) e.ladoHex = [1, 1];
    } else if (S.modo === 'enfrentamiento') {
      const tc = 1 + S.distancia;
      e.terrenos[tc + ',1'] = tdef;
      e.pilas.push({ id: 'tir', c: 1, r: 1, unidades: [S.tirador], bando: 'aliado' });
      e.pilas.push({ id: 'bla', c: tc, r: 1, unidades: [S.blancoTipo === 'apoyo' ? S.host : S.blanco], bando: 'eje' });
      const alc = S.terreno !== 'abierto' || S.pdDef ? 1 : Math.max(1, cara(S.tirador).alcance || 1);
      for (let c = 2; c <= Math.min(COLS - 1, 1 + alc); c++) e.zona.push([c, 1]);
      e.flechas.push({ de: [1, 1], a: [tc, 1], tipo: 'fuego' });
      e.etiquetas.push({ c: 1, r: 1, t: t('Tirador'), cls: 'a' }, { c: tc, r: 1, t: S.blancoTipo === 'apoyo' ? t('Host + apoyo') : t('Blanco'), cls: 'd' });
      if (S.blancoTipo === 'apoyo') e.marcas.push({ tipo: S.apoyoBlanco, c: tc, r: 1, dx: -0.48, dy: -0.42 });
      if (S.dobleObj) e.marcas.push({ tipo: 'dobleobj', c: tc, r: 1, dx: 0.42, dy: -0.5 });
      if (S.pdDef) e.marcas.push({ tipo: 'pd', c: tc, r: 1, dx: 0.45, dy: 0.42 });
      if (S.pantalla && S.blancoTipo !== 'apoyo') e.marcas.push({ tipo: 'screen', c: tc, r: 1, dx: 0.45, dy: 0.42 });
    } else if (S.modo === 'fuego') {
      e.terrenos['2,1'] = tdef;
      e.pilas.push({ id: 'tir', c: 1, r: 1, unidades: [S.tirador], bando: 'aliado' });
      e.pilas.push({ id: 'def', c: 2, r: 1, unidades: S.defensores, bando: 'eje' });
      e.flechas.push({ de: [1, 1], a: [2, 1], tipo: 'fuego' });
      e.etiquetas.push({ c: 1, r: 1, t: t('Tirador'), cls: 'a' }, { c: 2, r: 1, t: t('Objetivo'), cls: 'd' });
      e.marcas.push({ tipo: 'obj', c: 2, r: 1, dx: 0.42, dy: -0.5 });
      if (S.pdDef) e.marcas.push({ tipo: 'pd', c: 2, r: 1, dx: 0.45, dy: 0.42 });
    } else {
      e.terrenos['4,1'] = tdef;
      e.pilas.push({ id: 'obs', c: 1, r: 1, unidades: [nueva('inf-us')], bando: 'aliado' });
      e.pilas.push({ id: 'def', c: 4, r: 1, unidades: S.defensores, bando: 'eje' });
      e.marcas.push({ tipo: 'arty', n: S.puntos, c: 0, r: 0, dx: 0, dy: 0, grande: true });
      e.marcas.push({ tipo: 'obj', c: 4, r: 1, dx: 0.42, dy: -0.5 });
      if (S.pdDef) e.marcas.push({ tipo: 'pd', c: 4, r: 1, dx: 0.45, dy: 0.42 });
      e.flechas.push({ de: [0, 0], a: [4, 1], tipo: 'arty' }, { de: [1, 1], a: [4, 1], tipo: 'vista' });
      e.etiquetas.push({ c: 1, r: 1, t: t('Observador'), cls: 'a' }, { c: 4, r: 1, t: t('Objetivo'), cls: 'd' }, { c: 0, r: 0, t: t('Artillería'), cls: 'n' });
    }
    return e;
  }

  function patrones() {
    return `<defs>
      <pattern id="p-terreno" width="22" height="22" patternUnits="userSpaceOnUse"><rect width="22" height="22" fill="#cfd29a"/><circle cx="6" cy="7" r="5" fill="#86a352"/><circle cx="17" cy="16" r="4.5" fill="#7a9a49"/><circle cx="16" cy="5" r="2.5" fill="#93ad60"/></pattern>
      <pattern id="p-ciudad" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#e6dcb8"/><rect x="2" y="3" width="7" height="6" fill="#a9998a"/><rect x="11" y="2" width="6" height="8" fill="#9c8d7e"/><rect x="4" y="12" width="9" height="6" fill="#a9998a"/></pattern>
      <pattern id="p-urbano" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#b9ad9a"/><rect x="1" y="1" width="6" height="5" fill="#857565"/><rect x="8" y="1" width="5" height="5" fill="#7a6b5c"/><rect x="1" y="8" width="5" height="5" fill="#7a6b5c"/><rect x="8" y="8" width="5" height="5" fill="#857565"/></pattern>
      <marker id="m-at" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#d98a12"/></marker>
      <marker id="m-as" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 10 5 0 10z" fill="#a8690f"/></marker>
      <marker id="m-fu" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#c8221d"/></marker>
      <marker id="m-re" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path d="M0 0 10 5 0 10z" fill="#2c5a9c"/></marker>
    </defs>`;
  }

  const FILL = { abierto: '#e8dfb5', terreno: 'url(#p-terreno)', ciudad: 'url(#p-ciudad)', urbano: 'url(#p-urbano)' };

  function pintarMapa() {
    const e = escena();
    let s = `<svg viewBox="0 0 ${VBW.toFixed(1)} ${VBH.toFixed(1)}" aria-hidden="true">${patrones()}`;
    for (let r = 0; r < FILAS; r++) for (let c = 0; c < COLS; c++) {
      const t = e.terrenos[c + ',' + r];
      const base = (c * 7 + r * 3) % 5 === 0 ? '#e2d8a9' : '#e8dfb5';
      s += `<polygon points="${poligono(c, r)}" fill="${t ? FILL[t] : base}" stroke="#9a8f66" stroke-width="1.1"/>`;
    }
    e.zona.forEach(([c, r]) => { s += `<polygon points="${poligono(c, r)}" fill="rgba(200,34,29,0.12)" stroke="rgba(200,34,29,0.45)" stroke-width="1.4" stroke-dasharray="4 3"/>`; });
    // Carretera de adorno en la fila de abajo
    const [x0, y0] = centro(0, 2), [x1, y1] = centro(COLS - 1, 2);
    s += `<path d="M${x0 - 60} ${y0 + 22} C ${x0 + 120} ${y0 - 10}, ${x1 - 160} ${y1 + 30}, ${x1 + 60} ${y1 + 4}" stroke="#b49a5c" stroke-width="6" fill="none" opacity=".75"/><path d="M${x0 - 60} ${y0 + 22} C ${x0 + 120} ${y0 - 10}, ${x1 - 160} ${y1 + 30}, ${x1 + 60} ${y1 + 4}" stroke="#efe2b0" stroke-width="2.4" fill="none" opacity=".9"/>`;
    if (e.ladoHex) {
      const [cx, cy] = centro(e.ladoHex[0], e.ladoHex[1]);
      const x = cx + HW / 2;
      s += `<path d="M${x} ${cy - HR / 2 - 2} L${x} ${cy + HR / 2 + 2}" stroke="#3d78c2" stroke-width="7" stroke-linecap="round"/><path d="M${x} ${cy - HR / 2} L${x} ${cy + HR / 2}" stroke="#7fb2ea" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    e.flechas.forEach((f) => { s += flecha(f); });
    s += '<g id="capa-efectos"></g></svg>';
    const m = $('#mapa');
    m.innerHTML = s;
    const tamFicha = HW * 0.72 / VBW * 100;
    e.pilas.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'pila'; d.dataset.id = p.id;
      const [x, y] = centro(p.c, p.r);
      d.style.cssText = pct(x, y).join(';') + `;width:${tamFicha}%;aspect-ratio:1`;
      p.unidades.forEach((u, i) => {
        const n = p.unidades.length;
        const off = (i - (n - 1) / 2) * 9;
        const div = document.createElement('div');
        div.className = 'unidad' + (u.pasos <= 0 ? ' muerta' : '');
        div.style.transform = `translate(${-off}%, ${-off}%)`;
        div.style.zIndex = 10 + (n - i);
        div.innerHTML = F.ficha(U[u.k], u.lado, { pasos: Math.max(0, u.pasos) });
        d.appendChild(div);
      });
      m.appendChild(d);
    });
    e.marcas.forEach((k) => ponerMarca(k));
    e.etiquetas.forEach((t) => {
      const [x, y] = centro(t.c, t.r);
      const el = document.createElement('span');
      el.className = 'etiqueta-hex ' + t.cls;
      el.style.cssText = pct(x, y + HR * 0.62).join(';');
      el.textContent = t.t;
      m.appendChild(el);
    });
    const ley = { regular: [['#d98a12', t('Ataque')], ['#a8690f', t('Asistencia')], ['#3d78c2', t('Lado de hex con terreno (río)')]], shock: [['#d98a12', t('Choque')], ['#3d78c2', t('Lado de hex con terreno')]],
      enfrentamiento: [['#c8221d', t('Línea de fuego')], ['rgba(200,34,29,.5)', t('Alcance del tirador')]], fuego: [['#c8221d', t('Ataque por fuego')]], bombardeo: [['#c8221d', t('Fuego de artillería')], ['#6b6b5a', t('Línea de visión del observador')]] }[S.modo];
    $('#leyenda').innerHTML = ley.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('') + '<span style="margin-left:auto">' + t('Terreno del objetivo') + ': <strong>' + { abierto: t('abierto'), terreno: t('Terrain (bosque)'), ciudad: t('Ciudad'), urbano: t('Urbano') }[S.terreno] + '</strong></span>';
  }

  function ponerMarca(k, nueva) {
    const m = $('#mapa');
    const [cx, cy] = centro(k.c, k.r);
    const x = cx + (k.dx || 0) * HW, y = cy + (k.dy || 0) * HR;
    const el = document.createElement('div');
    el.className = 'marca-hex' + (nueva ? ' nueva' : '');
    el.dataset.tipo = k.tipo;
    el.style.cssText = pct(x, y).join(';') + `;width:${(HW * (k.grande ? 0.5 : 0.32) / VBW * 100)}%`;
    el.innerHTML = F.marcador(k.tipo, { n: k.n });
    m.appendChild(el);
    return el;
  }

  function flecha(f) {
    const [x1, y1] = centro(f.de[0], f.de[1]);
    const [x2, y2] = centro(f.a[0], f.a[1]);
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;
    const ini = f.tipo === 'arty' ? 30 : HR * 0.55, fin = HR * 0.6;
    const ax = x1 + ux * ini, ay = y1 + uy * ini, bx = x2 - ux * fin, by = y2 - uy * fin;
    switch (f.tipo) {
      case 'ataque': return `<path d="M${ax} ${ay} L${bx} ${by}" stroke="#d98a12" stroke-width="6" stroke-linecap="round" marker-end="url(#m-at)"/>`;
      case 'asist': return `<path d="M${ax} ${ay} L${bx} ${by}" stroke="#a8690f" stroke-width="4" stroke-dasharray="6 5" stroke-linecap="round" marker-end="url(#m-as)"/>`;
      case 'fuego': return `<path d="M${ax} ${ay} L${bx} ${by}" stroke="#c8221d" stroke-width="3.5" stroke-dasharray="10 6" stroke-linecap="round" marker-end="url(#m-fu)"/>`;
      case 'arty': {
        const mx = (ax + bx) / 2, my = Math.min(ay, by) - 70;
        return `<path d="M${ax} ${ay} Q ${mx} ${my} ${bx} ${by}" stroke="#c8221d" stroke-width="3" fill="none" stroke-dasharray="3 6" stroke-linecap="round" marker-end="url(#m-fu)"/>`;
      }
      case 'vista': return `<path d="M${ax} ${ay} L${bx} ${by}" stroke="#6b6b5a" stroke-width="1.6" stroke-dasharray="2 5"/>`;
      case 'retirada': return `<path d="M${ax} ${ay} L${bx} ${by}" stroke="#2c5a9c" stroke-width="4" stroke-dasharray="8 6" stroke-linecap="round" marker-end="url(#m-re)"/>`;
      case 'avance': return `<path d="M${ax} ${ay} L${bx} ${by}" stroke="#d98a12" stroke-width="4" stroke-dasharray="2 7" stroke-linecap="round" marker-end="url(#m-at)"/>`;
    }
    return '';
  }

  // ---------- Editor de unidades ----------
  function selectorUnidad(valor, opciones, al) {
    const sel = document.createElement('select');
    const opt = (k) => `<option value="${k}"${k === valor ? ' selected' : ''}>${esc(F.etiqueta(U[k]))}</option>`;
    const fuera = opciones.includes(valor) ? '' : opt(valor);      // la unidad actual, aunque no encaje en este papel
    sel.innerHTML = fuera + Juegos.grupos(opciones).map(([g, ks]) => `<optgroup label="${esc(g)}">${ks.map(opt).join('')}</optgroup>`).join('');
    sel.addEventListener('change', () => al(sel.value));
    return sel;
  }
  function selectorApoyo(valor, al, rotulo) {
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', rotulo || t('Apoyo'));
    sel.innerHTML = `<option value="">${t('Sin apoyo')}</option>` + Object.entries(F.APOYOS).map(([k, a]) => `<option value="${k}"${k === valor ? ' selected' : ''}>${esc(t(a.nombre))} (${R.nombreApoyo(k)} ${a.av})</option>`).join('');
    sel.addEventListener('change', () => al(sel.value || null));
    return sel;
  }

  function slot(rol, cls, inst, opciones, extra) {
    extra = extra || {};
    const d = document.createElement('div');
    d.className = 'slot';
    const u = U[inst.k];
    d.innerHTML = `<div class="slot__ficha">${F.ficha(u, inst.lado, { pasos: inst.pasos, tam: 54 })}</div><div><div class="slot__cab"><span class="slot__rol ${cls}">${rol}</span></div><div class="slot__controles"></div></div>`;
    const cab = d.querySelector('.slot__cab'), ctl = d.querySelector('.slot__controles');
    cab.appendChild(selectorUnidad(inst.k, opciones, (k) => { inst.k = k; inst.lado = 'd'; inst.pasos = U[k].pasos; cambio(); }));
    if (extra.quitar) {
      const x = document.createElement('button'); x.type = 'button'; x.className = 'x-quitar'; x.textContent = '✕'; x.setAttribute('aria-label', t('Quitar {x}', { x: rol }));
      x.addEventListener('click', extra.quitar); cab.appendChild(x);
    }
    // Cara
    const mini = document.createElement('div'); mini.className = 'mini'; mini.setAttribute('role', 'group'); mini.setAttribute('aria-label', t('Cara visible'));
    [['d', t('Desplegada')], ['m', t('Movimiento')]].forEach(([l, t]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', inst.lado === l);
      if (u.unaCara) b.disabled = l === 'm';
      b.addEventListener('click', () => { inst.lado = l; cambio(); });
      mini.appendChild(b);
    });
    ctl.appendChild(mini);
    // Pasos
    const pc = document.createElement('div'); pc.className = 'pasos-ctrl';
    pc.innerHTML = `<button type="button" aria-label="${t('Quitar un paso')}">−</button><span>${t(u.pasos === 1 ? '{a} de {b} paso' : '{a} de {b} pasos', { a: inst.pasos, b: u.pasos })}</span><button type="button" aria-label="${t('Añadir un paso')}">+</button>`;
    const [menos, mas] = pc.querySelectorAll('button');
    menos.disabled = inst.pasos <= 1; mas.disabled = inst.pasos >= u.pasos;
    menos.addEventListener('click', () => { inst.pasos = Math.max(1, inst.pasos - 1); cambio(); });
    mas.addEventListener('click', () => { inst.pasos = Math.min(u.pasos, inst.pasos + 1); cambio(); });
    ctl.appendChild(pc);
    if (extra.apoyo) {
      if (R.puedeSerHost(cara(inst))) ctl.appendChild(selectorApoyo(extra.apoyo.valor, extra.apoyo.al));
      else { const n = document.createElement('span'); n.className = 'muted'; n.style.fontSize = '.78rem'; n.textContent = R.esDual(cara(inst)) ? t('Dual: no usa apoyo') : (R.tieneAv(cara(inst)) ? t('AV: no usa apoyo') : t('Desprevenida: sin apoyo')); ctl.appendChild(n); }
    }
    if (extra.ar) {
      const l = document.createElement('label'); l.className = 'radio-ar';
      l.innerHTML = `<input type="radio" name="ar" ${extra.ar.marcado ? 'checked' : ''}> ${t('Da el AR')}`;
      l.querySelector('input').addEventListener('change', extra.ar.al);
      ctl.appendChild(l);
    }
    return d;
  }

  function pintarJuego() {
    const sj = $('#juego'), se = $('#escenario');
    sj.innerHTML = Object.values(JG).map((j) => `<option value="${j.id}">${esc(j.nombre)}</option>`).join('');
    sj.value = juego;
    se.innerHTML = JG[juego].escenarios.map((e, i) => `<option value="${i}">${esc(e.nombre)}</option>`).join('');
    se.value = String(escenario);
  }
  function cambiarFichas(j, e) {
    if (animando) { pintarJuego(); return; }
    juego = j; escenario = e;
    S = estadoInicial(S.modo); resultado = null; limpiarTirada(); pintarTodo();
  }
  $('#juego').addEventListener('change', (e) => cambiarFichas(e.target.value, 0));
  $('#escenario').addEventListener('change', (e) => cambiarFichas(juego, +e.target.value));

  function pintarSlots() {
    pintarJuego();
    const c = $('#slots');
    c.innerHTML = '';
    const m = S.modo;
    if (m === 'regular' || m === 'shock') {
      c.appendChild(slot(t('Atacante'), 'a', S.atacante, rol('todas'), { apoyo: { valor: S.apoyoAtt, al: (v) => { S.apoyoAtt = v; cambio(); } } }));
      if (m === 'regular') {
        if (S.asistente) c.appendChild(slot(t('Asistente'), 'a', S.asistente, rol('todas'), { quitar: () => { S.asistente = null; cambio(); } }));
        else c.appendChild(botonAnadir(t('+ Añadir asistencia'), () => { S.asistente = nueva('tq-us'); cambio(); }));
      }
    }
    if (m === 'enfrentamiento') {
      c.appendChild(slot(t('Tirador'), 'a', S.tirador, rol('av')));
      const tipo = document.createElement('div'); tipo.className = 'campo';
      tipo.innerHTML = `<span class="muted">${t('El blanco es')}</span>`;
      const mini = document.createElement('div'); mini.className = 'mini';
      [['real', t('una unidad AV real')], ['apoyo', t('el apoyo de un host')]].forEach(([v, t]) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', S.blancoTipo === v);
        b.addEventListener('click', () => { S.blancoTipo = v; cambio(); }); mini.appendChild(b);
      });
      tipo.appendChild(mini); c.appendChild(tipo);
      if (S.blancoTipo === 'real') c.appendChild(slot(t('Blanco'), 'd', S.blanco, rol('av')));
      else {
        c.appendChild(slot(t('Host'), 'd', S.host, rol('host')));
        const sa = document.createElement('div'); sa.className = 'campo';
        sa.innerHTML = `<span class="muted">${t('Apoyo de la formación del host:')}</span>`;
        const sel = selectorApoyo(S.apoyoBlanco, (v) => { S.apoyoBlanco = v || 'red'; cambio(); });
        sel.querySelector('option[value=""]').remove();
        sa.appendChild(sel); c.appendChild(sa);
      }
    }
    if (m === 'fuego') c.appendChild(slot(t('Tirador'), 'a', S.tirador, rol('av')));
    if (m !== 'enfrentamiento') {
      const etiqueta = m === 'fuego' || m === 'bombardeo' ? t('Objetivo') : t('Defensor');
      S.defensores.forEach((inst, i) => {
        const extra = { quitar: S.defensores.length > 1 ? () => { S.defensores.splice(i, 1); S.arDef = 0; cambio(); } : null };
        if (m === 'regular' || m === 'shock') {
          extra.ar = { marcado: S.arDef === i, al: () => { S.arDef = i; cambio(); } };
          if (i === S.arDef) extra.apoyo = { valor: S.apoyoDef, al: (v) => { S.apoyoDef = v; cambio(); } };
        }
        c.appendChild(slot(etiqueta + (S.defensores.length > 1 ? ' ' + (i + 1) : ''), 'd', inst, rol('todas'), extra));
      });
      if (S.defensores.length < 3) c.appendChild(botonAnadir(t('+ Añadir otra unidad al hex') + (S.defensores.length === 2 ? ' ' + t('(sobreapilar)') : ''), () => { S.defensores.push(nueva('inf-de')); cambio(); }));
    }
  }
  function botonAnadir(t, al) {
    const d = document.createElement('div'); d.className = 'anadir';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'boton boton--peq'; b.textContent = t;
    b.addEventListener('click', al); d.appendChild(b);
    return d;
  }

  // ---------- Circunstancias ----------
  function op(texto, valor, activo, al, opc) {
    opc = opc || {};
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'op' + (opc.def ? ' def' : '');
    b.setAttribute('aria-pressed', !!activo);
    b.innerHTML = esc(texto) + (valor ? ` <span class="v">${valor}</span>` : '');
    if (opc.desactivado) b.disabled = true;
    if (opc.titulo) b.title = opc.titulo;
    b.addEventListener('click', al);
    return b;
  }
  function grupo(c, titulo, botones) {
    const g = document.createElement('div'); g.className = 'grupo-op';
    g.innerHTML = `<h3>${titulo}</h3>`;
    const o = document.createElement('div'); o.className = 'opciones';
    botones.forEach((b) => b && o.appendChild(b));
    g.appendChild(o); c.appendChild(g);
    return o;
  }
  const alternar = (k) => () => { S[k] = !S[k]; cambio(); };

  function pintarCirc() {
    const c = $('#circ');
    c.innerHTML = '';
    const m = S.modo;
    const terrenos = [['abierto', t('Abierto')], ['terreno', t('Terrain (bosque, monte…)')], ['ciudad', t('Ciudad')], ['urbano', t('Urbano')]];
    grupo(c, m === 'enfrentamiento' ? t('Terreno del blanco') : t('Terreno del hex objetivo'), terrenos.map(([v, t]) => op(t, '', S.terreno === v, () => { S.terreno = v; cambio(); }, { def: true })));

    if (m === 'regular' || m === 'shock') {
      const atac = [
        op('Double OBJ Zone', '+1', S.dobleObj, alternar('dobleObj')),
        op(t('Formación atacante en Prepared Defense'), '−1', S.pdAtt, alternar('pdAtt')),
        op(t('Atacante con MSR Blocked'), '−1', S.msrAtt, alternar('msrAtt'))
      ];
      if (m === 'regular') atac.push(op(t('Ataque desde fuera del mapa'), '+2', S.desdeFuera, alternar('desdeFuera')));
      else atac.push(op(t('Precedido de ataque por fuego de la misma unidad'), '+1', S.fuegoPrevio, alternar('fuegoPrevio')));
      grupo(c, t('Atacante'), atac);
      const maxPts = m === 'regular' ? 3 : 1;
      const bo = grupo(c, t('Artillería del atacante'), [
        op(t('Sin bombardeo'), '', S.bombardeo === 'ninguno', () => { S.bombardeo = 'ninguno'; cambio(); }),
        op(t('Supresión (1 punto)'), m === 'regular' ? '+2' : '+1', S.bombardeo === 'supresion', () => { S.bombardeo = 'supresion'; cambio(); }),
        op(t('Destrucción'), t('sin DRM'), S.bombardeo === 'destruccion', () => { S.bombardeo = 'destruccion'; S.puntos = Math.min(S.puntos, maxPts); cambio(); })
      ]);
      if (S.bombardeo === 'destruccion' && maxPts > 1) {
        [1, 2, 3].forEach((n) => bo.appendChild(op(t(n === 1 ? '{n} punto' : '{n} puntos', { n }), '', S.puntos === n, () => { S.puntos = n; cambio(); })));
      }
      const def = [
        op('Prepared Defense', '+1', S.pdDef, alternar('pdDef'), { def: true }),
        op('Key Terrain', t('aguanta'), S.claveTerreno, alternar('claveTerreno'), { def: true }),
        op(t('El ataque cruza un lado de hex con Terrain'), '+1', S.ladoHex, alternar('ladoHex'), { def: true }),
        op(t('Defensor con MSR Blocked'), '−1', S.msrDef, alternar('msrDef'), { def: true })
      ];
      if (m === 'shock') def.push(op(t('El hex cuesta 3 MP o menos (táctico)'), '', S.costeMp, alternar('costeMp'), { def: true }));
      grupo(c, t('Defensor'), def);
    }
    if (m === 'enfrentamiento') {
      const d = document.createElement('div'); d.className = 'grupo-op';
      d.innerHTML = `<h3>${t('Distancia')}</h3><div class="campo"><input class="rango" type="range" min="1" max="4" value="${S.distancia}" aria-label="${t('Distancia en hexes')}"><strong>${t(S.distancia === 1 ? '{n} hex (adyacente)' : '{n} hexes', { n: S.distancia })}</strong></div>`;
      d.querySelector('input').addEventListener('input', (e) => { S.distancia = +e.target.value; cambio(); });
      c.appendChild(d);
      grupo(c, t('Tirador'), [op(t('Blanco en Double OBJ Zone'), '+1', S.dobleObj, alternar('dobleObj'))]);
      const bl = [op('Prepared Defense', '+1', S.pdDef, alternar('pdDef'), { def: true })];
      if (S.blancoTipo === 'apoyo') bl.push(op(t('La formación tiene varios apoyos al alcance'), '+1', S.variosApoyos, alternar('variosApoyos'), { def: true }));
      else bl.push(op(t('El blanco está en Screen'), '', S.pantalla, alternar('pantalla'), { def: true }));
      grupo(c, t('Blanco'), bl);
      grupo(c, t('Reglas opcionales'), [op(t('5.2f: «Pérdida para ambos» a más de 1 hex no tiene efecto'), '', S.opcionalLejos, alternar('opcionalLejos'))]);
    }
    if (m === 'fuego' || m === 'bombardeo') {
      const g = [op('Prepared Defense', t('fila'), S.pdDef, alternar('pdDef'), { def: true })];
      grupo(c, t('Objetivo'), g);
    }
    if (m === 'bombardeo') {
      const o = grupo(c, t('Puntos de artillería o aviación'), [1, 2, 3].map((n) => op(t(n === 1 ? '{n} punto' : '{n} puntos', { n }), '', S.puntos === n, () => { S.puntos = n; if (n > 1) S.enAtaque = true; cambio(); })));
      o.appendChild(op(t('Forma parte de un ataque regular'), '', S.enAtaque, () => { S.enAtaque = !S.enAtaque; if (!S.enAtaque) S.puntos = 1; cambio(); }));
    }
  }

  // ---------- Cálculo: modificadores, requisitos, probabilidades ----------
  function signo(v) { return (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v); }
  function claseV(v, base) { return base ? '' : v > 0 ? 'drm--pos' : v < 0 ? 'drm--neg' : ''; }

  function ladoDrm(cls, titulo, lista, total) {
    return `<div class="lado-drm ${cls}"><h3><span>${titulo}</span></h3><ul>${lista.map((m) => `<li class="${m.base ? 'base' : ''}"><span>${esc(m.texto)}</span><span class="v drm ${claseV(m.valor, m.base)}">${m.base ? m.valor : signo(m.valor)}</span></li>`).join('')}</ul><div class="total"><span>${t('Total')}</span><span class="v">${total}</span></div></div>`;
  }

  let calculo = null;

  function pintarCalculo() {
    const m = S.modo;
    let reqs, avisos = [];
    if (m === 'regular' || m === 'shock') {
      const ctx = ctxCombate();
      const mod = R.modificadoresCombate(ctx);
      reqs = R.requisitosCombate(ctx);
      avisos = mod.avisos.slice();
      if (S.bombardeo === 'destruccion') avisos.push(t('El bombardeo de destrucción se tira antes del Combat Table y no da modificador. Si destruye a todo el hex, el atacante avanza sin tirar en la tabla.'));
      if (S.pdDef && S.defensores[S.arDef].lado === 'm') avisos.push(t('La unidad que da el AR está en su cara de movimiento: no puede usar la Prepared Defense.'));
      calculo = { tipo: 'combate', ctx, mod, filas: R.TABLA_COMBATE, colores: COL_COMBATE, textos: TXT_COMBATE };
      $('#balanza').innerHTML = `<div class="balanza">${ladoDrm('a', t('Atacante'), mod.atacante, mod.totalA)}<div class="neto"><small>${t('DRM neto')}</small><strong>${signo(mod.neto)}</strong><span>${t('atacante − defensor')}</span></div>${ladoDrm('d', t('Defensor'), mod.defensor, mod.totalD)}</div>`;
    } else if (m === 'enfrentamiento') {
      const ctx = ctxEnfrentamiento();
      const mod = R.modificadoresEnfrentamiento(ctx);
      reqs = R.requisitosEnfrentamiento(ctx);
      const alcB = R.alcanceBlanco(ctx);
      if (ctx.distancia > alcB) avisos.push(t('Estás fuera del alcance del blanco ({n}): si sale un resultado contra el tirador, se ignora.', { n: alcB }));
      if (ctx.blancoEsApoyo) avisos.push(t('Contra un apoyo se usa la parte baja del Engagement Table, con el AV del apoyo y el Action Rating del host.'));
      const filas = ctx.blancoEsApoyo ? R.TABLA_ENFRENTAMIENTO_APOYO : R.TABLA_ENFRENTAMIENTO_REAL;
      calculo = { tipo: 'enfrentamiento', ctx, mod, filas, colores: ctx.blancoEsApoyo ? COL_ENF_APOYO : COL_ENF_REAL, textos: filas.map((f) => f.texto) };
      $('#balanza').innerHTML = `<div class="balanza">${ladoDrm('a', t('Tirador'), mod.tirador, mod.totalF)}<div class="neto"><small>${t('DRM neto')}</small><strong>${signo(mod.neto)}</strong><span>${t('tirador − blanco')}</span></div>${ladoDrm('d', ctx.blancoEsApoyo ? t('Apoyo') : t('Blanco'), mod.blanco, mod.totalT)}</div>`;
    } else {
      const col = m === 'fuego' ? 'fuego' : 'arty';
      reqs = m === 'fuego' ? requisitosFuego() : requisitosBombardeo();
      const dadosPor = m === 'fuego' ? 1 : S.puntos;
      const filasU = S.defensores.map((i) => ({ i, fila: filaPara(i) }));
      calculo = { tipo: 'barrage', col, dadosPor, filasU };
      $('#balanza').innerHTML = '<div class="tabla-wrap"><table class="t"><thead><tr><th>' + t('Objetivo') + '</th><th class="num">' + (col === 'fuego' ? 'Attack by Fire' : 'Arty') + '</th></tr></thead><tbody>' +
        R.TABLA_BOMBARDEO.map((f) => `<tr class="${filasU.some((x) => x.fila === f) ? 'sel-fila' : ''}"><td>${esc(t(f.texto))}</td><td class="num">${f[col] === 6 ? '6' : f[col] + '-6'}</td></tr>`).join('') +
        '</tbody></table></div><p class="muted" style="font-size:.84rem;margin:10px 0 0">' + t(m === 'fuego' ? 'Se tira un dado por cada unidad del hex. Si a una unidad le valen varias filas, se usa la de menos probabilidad de baja.' : 'Se tira un dado por cada punto y por cada unidad del hex. Si a una unidad le valen varias filas, se usa la de menos probabilidad de baja.') + '</p>';
    }
    $('#requisitos').innerHTML = reqs.map((r) => `<li class="${r.ok ? '' : 'no'}">${esc(r.texto)}</li>`).join('');
    $('#avisos').innerHTML = avisos.map((a) => `<p class="nota" style="margin:8px 0 0;font-size:.86rem">${esc(a)}</p>`).join('');
    calculo.bloqueado = reqs.filter((r) => !r.ok);
    const btn = $('#btn-tirar');
    btn.disabled = calculo.bloqueado.length > 0 || animando;
    btn.title = calculo.bloqueado.length ? t('No se cumple: ') + calculo.bloqueado.map((r) => r.texto).join('; ') : '';
    pintarProbs();
  }

  function pintarProbs(salioSuma) {
    const c = $('#probs');
    if (calculo.tipo === 'barrage') { pintarProbsBarrage(c); return; }
    const neto = calculo.mod.neto;
    const filas = calculo.filas;
    const dist = R.distribucion(filas, neto);
    const maxP = 6 / 36;
    let h = '<div class="histo" role="img" aria-label="' + t('Probabilidad de cada suma de dos dados y su resultado') + '">';
    for (let s = 2; s <= 12; s++) {
      const f = R.filaDe(filas, s + neto);
      h += `<div class="col"><div class="barra${salioSuma === s ? ' salio' : ''}" style="height:${(R.DOS_DADOS[s] / maxP * 100).toFixed(1)}%;background:${calculo.colores[f]}"><span class="tot">${s + neto}</span></div></div>`;
    }
    h += '</div><div class="histo-eje">' + Array.from({ length: 11 }, (_, i) => `<span>${i + 2}</span>`).join('') + '</div>';
    h += `<div class="histo-pie"><span>${t('Arriba: total con el DRM ({d})', { d: signo(neto) })}</span><span>${t('Abajo: lo que sale en 2d6')}</span></div>`;
    h += '<div class="resultados">' + filas.map((f, i) => `<div class="res-fila${resultado && resultado.fila === i ? ' salio' : ''}" style="color:${calculo.colores[i]}"><span class="sw" style="background:${calculo.colores[i]}"></span><span class="r">${t(f.rango)}</span><span style="color:var(--text)">${esc(t(calculo.textos[i]))}<div class="bar" style="width:${(dist[i] * 100).toFixed(1)}%"></div></span><span class="p">${(dist[i] * 100).toFixed(1)}%</span></div>`).join('') + '</div>';
    if (calculo.tipo === 'combate') {
      const pd = calculo.ctx.pdDefensor;
      const pierdeA = dist[0] + dist[1] + dist[2] + (pd ? dist[3] : 0);
      const defenso = dist[2] + dist[3] + dist[4] + dist[5];
      h += `<div class="resumen-prob"><div><strong style="color:var(--def)">${(defenso * 100).toFixed(0)}%</strong><span>${t('de que el defensor pierda pasos o se retire')}</span></div><div><strong style="color:var(--att)">${(pierdeA * 100).toFixed(0)}%</strong><span>${t('de que el atacante pierda algún paso')}</span></div></div>`;
      resumen([[t('DRM neto'), signo(neto), 'amber'], [t('Defensor afectado'), (defenso * 100).toFixed(0) + '%', 'blue'], [t('Atacante pierde'), (pierdeA * 100).toFixed(0) + '%', 'red']]);
    } else {
      const pF = calculo.filas.reduce((s, f, i) => s + (f.clave === 'firer' || f.clave === 'ambos' ? dist[i] : 0), 0);
      const pT = calculo.filas.reduce((s, f, i) => s + (['target', 'ambos', 'loss-drop', 'drop'].includes(f.clave) ? dist[i] : 0), 0);
      h += `<div class="resumen-prob"><div><strong style="color:var(--def)">${(pT * 100).toFixed(0)}%</strong><span>${t('de dañar al blanco (baja o Drop)')}</span></div><div><strong style="color:var(--att)">${(pF * 100).toFixed(0)}%</strong><span>${t('de que el tirador pierda un paso')}${calculo.ctx.distancia > R.alcanceBlanco(calculo.ctx) ? t(' (se ignoraría: fuera de alcance)') : ''}</span></div></div>`;
      resumen([[t('DRM neto'), signo(neto), 'amber'], [t('Daña al blanco'), (pT * 100).toFixed(0) + '%', 'blue'], [t('Tirador pierde'), calculo.ctx.distancia > R.alcanceBlanco(calculo.ctx) ? '0%' : (pF * 100).toFixed(0) + '%', 'red']]);
    }
    c.innerHTML = h;
  }

  function pintarProbsBarrage(c) {
    const n = calculo.dadosPor;
    const colores = ['#8a8f86', '#e9bf3c', '#e9893c', '#d6453a'];
    let h = `<p class="muted" style="font-size:.86rem;margin-top:0">${t(n === 1 ? '{n} dado por unidad. Cada dado en el rango causa una baja.' : '{n} dados por unidad. Cada dado en el rango causa una baja.', { n })}</p><div class="dados-unidad">`;
    calculo.filasU.forEach(({ i, fila }, idx) => {
      const minimo = fila[calculo.col];
      const p = (7 - minimo) / 6;
      const b = R.binomial(n, p);
      h += `<div class="du" data-idx="${idx}">${F.ficha(U[i.k], i.lado, { pasos: i.pasos, tam: 46 })}<div><strong style="color:var(--heading);font-size:.9rem">${esc(t(U[i.k].nombre))}${i.lado === 'm' ? t(' · en marcha') : ''}</strong><div class="fila-tabla">${t('Fila: {f} · baja con {r} ({p}% por dado)', { f: esc(t(fila.texto)), r: minimo === 6 ? '6' : minimo + '-6', p: (p * 100).toFixed(0) })}</div><div class="barras">${b.map((q, k) => q > 0.0005 ? `<div style="width:${(q * 100).toFixed(2)}%;background:${colores[Math.min(k, 3)]}" title="${t(k === 1 ? '{k} baja' : '{k} bajas', { k })}: ${(q * 100).toFixed(1)}%">${q > 0.09 ? t(k === 1 ? '{k} baja' : '{k} bajas', { k }) + ' ' + Math.round(q * 100) + '%' : ''}</div>` : '').join('')}</div></div></div>`;
    });
    c.innerHTML = h + '</div>';
    const esperadas = calculo.filasU.reduce((s, x) => s + n * (7 - x.fila[calculo.col]) / 6, 0);
    resumen([[t('Dados'), n * calculo.filasU.length, 'amber'], [t('Bajas esperadas'), I18N.num(esperadas, 2), 'blue']]);
  }

  function resumen(items) {
    $('#resumen-tirada').innerHTML = items.map(([t, v, c]) => `<span class="chip chip--${c}">${t} <strong>${v}</strong></span>`).join('');
  }

  function cambio() {
    if (animando) return;
    resultado = null;
    limpiarTirada();
    pintarTodo();
  }

  // ---------- Dados ----------
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function htmlDado(v, cls) {
    return `<div class="dado ${cls || ''}" aria-label="${v}">${Array.from({ length: 9 }, (_, i) => `<i style="visibility:${PIPS[v].includes(i) ? 'visible' : 'hidden'}"></i>`).join('')}</div>`;
  }
  function rodar(cont, n, cls, ms) {
    return new Promise((res) => {
      const t0 = Date.now();
      const tick = () => {
        cont.innerHTML = Array.from({ length: n }, () => htmlDado(1 + Math.floor(Math.random() * 6), (cls || '') + ' rodando')).join('');
        if (Date.now() - t0 < ms) setTimeout(tick, 80); else res();
      };
      tick();
    });
  }
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  function limpiarTirada() { $('#dados').innerHTML = ''; $('#veredicto').innerHTML = ''; }

  // ---------- Efectos sobre el mapa ----------
  function pila(id) { return document.querySelector(`#mapa .pila[data-id="${id}"]`); }
  function golpe(id, n, idx) {
    const p = pila(id); if (!p) return;
    const g = document.createElement('div');
    g.className = 'golpe';
    g.textContent = '−' + n;
    g.style.left = p.style.left; g.style.top = p.style.top;
    if (idx) g.style.marginLeft = (idx * 22) + 'px';
    $('#mapa').appendChild(g);
    setTimeout(() => g.remove(), 1900);
  }
  function bocadillo(id, txt, dy) {
    const p = pila(id); if (!p) return;
    const b = document.createElement('div');
    b.className = 'bocadillo'; b.textContent = txt;
    b.style.left = p.style.left;
    b.style.top = `calc(${p.style.top} - ${dy || 34}px)`;
    $('#mapa').appendChild(b);
  }
  function repintarPila(id, unidades, bando) {
    const p = pila(id); if (!p) return;
    p.querySelectorAll('.unidad').forEach((div, i) => {
      const u = unidades[i]; if (!u) return;
      div.innerHTML = F.ficha(U[u.k], u.lado, { pasos: Math.max(0, u.pasos) });
      if (u.pasos <= 0) div.classList.add('muerta');
    });
  }
  function moverPila(id, c, r) {
    const p = pila(id); if (!p) return;
    const [x, y] = centro(c, r);
    p.style.left = (x / VBW * 100) + '%';
    p.style.top = (y / VBH * 100) + '%';
  }
  function flechaEfecto(f) {
    const capa = document.querySelector('#capa-efectos');
    if (capa) capa.insertAdjacentHTML('beforeend', flecha(f));
  }
  function aplicarPerdidas(lista, n, primero) {
    // La primera baja va a la unidad indicada; el resto, a las demás vivas por orden.
    const orden = [primero].concat(lista.map((_, i) => i).filter((i) => i !== primero));
    let k = 0, guard = 0;
    const tocadas = {};
    while (n > 0 && guard++ < 20) {
      const idx = orden[k % orden.length];
      if (lista[idx].pasos > 0) { lista[idx].pasos--; n--; tocadas[idx] = (tocadas[idx] || 0) + 1; }
      k++;
      if (vivos(lista).length === 0) break;
    }
    return tocadas;
  }

  // ---------- Tirada ----------
  async function tirarDados() {
    if (animando || calculo.bloqueado.length) return;
    animando = true;
    $('#btn-tirar').disabled = true;
    $('#veredicto').innerHTML = '';
    pintarMapa();
    try {
      if (calculo.tipo === 'combate') await tiradaCombate();
      else if (calculo.tipo === 'enfrentamiento') await tiradaEnfrentamiento();
      else await tiradaBarrage();
    } finally {
      animando = false;
      $('#btn-tirar').disabled = false;
      $('#btn-tirar').lastChild.textContent = t('Tirar otra vez');
    }
  }

  function registrar(txt, codigo) {
    historial.unshift({ m: MODOS[S.modo].nombre, txt, codigo, t: Date.now() });
    historial = historial.slice(0, 30);
    Comun.guardar('bcs-sim-hist' + (I18N.en ? '-en' : ''), JSON.stringify(historial));
    pintarHistorial();
  }

  function veredicto(titulo, codigo, puntos, bloq) {
    $('#veredicto').innerHTML = `<div class="veredicto${bloq ? ' bloqueado' : ''}"><span class="codigo">${esc(codigo)}</span><h3>${esc(titulo)}</h3><ul>${puntos.map((p) => `<li>${p}</li>`).join('')}</ul></div>`;
  }

  async function tiradaCombate() {
    const shock = S.modo === 'shock';
    // Copia de trabajo: la tirada no cambia la configuración guardada.
    const att = Object.assign({}, S.atacante);
    const defs = S.defensores.map((d) => Object.assign({}, d));
    const notas = [];
    const dadosEl = $('#dados');

    // Paso 5: bombardeo de destrucción antes del Combat Table
    if (S.bombardeo === 'destruccion') {
      const pts = shock ? 1 : S.puntos;
      const tiradas = [];
      defs.forEach((d, idx) => { if (d.pasos > 0) for (let k = 0; k < pts; k++) tiradas.push({ idx, v: 0 }); });
      await rodar(dadosEl, tiradas.length, 'rojo', 700);
      let bajas = 0;
      tiradas.forEach((t) => { t.v = R.tirar(1)[0]; const f = filaPara(defs[t.idx]); t.ok = t.v >= f.arty; });
      dadosEl.innerHTML = tiradas.map((t) => htmlDado(t.v, 'rojo ' + (t.ok ? 'acierto' : 'fallo'))).join('');
      tiradas.forEach((t) => { if (t.ok && defs[t.idx].pasos > 0) { defs[t.idx].pasos--; bajas++; } });
      if (bajas) { golpe('def', bajas); repintarPila('def', defs, 'eje'); }
      notas.push(t('Bombardeo de destrucción ({p}): {b}.', { p: t(pts === 1 ? '{n} punto' : '{n} puntos', { n: pts }), b: bajas ? t(bajas === 1 ? '{k} baja' : '{k} bajas', { k: bajas }) : t('sin bajas') }));
      await espera(1100);
      if (vivos(defs).length === 0) {
        moverPila('att', 2, 1);
        flechaEfecto({ de: [1, 1], a: [2, 1], tipo: 'avance' });
        notas.push(t('El bombardeo ha destruido el hex: el atacante avanza sin tirar en el Combat Table. Las unidades del ataque quedan igualmente FINISHED.'));
        veredicto(t('El bombardeo barre el hex'), t('Sin tirada en el Combat Table'), notas);
        registrar(t('Bombardeo destruye el hex'), '—');
        return;
      }
    }

    // Recalcula el DRM con las unidades que quedan
    const S2 = Object.assign({}, S, { defensores: defs });
    const guardado = S; S = S2;
    let arIdx = Math.min(S.arDef, defs.length - 1);
    if (defs[arIdx].pasos <= 0) { arIdx = defs.findIndex((d) => d.pasos > 0); S.arDef = arIdx; }
    const ctx = ctxCombate();
    const mod = R.modificadoresCombate(ctx);
    S = guardado;
    if (mod.neto !== calculo.mod.neto) notas.push(t('Tras el bombardeo el DRM neto pasa a {d}.', { d: signo(mod.neto) }));

    await rodar(dadosEl, 2, '', 900);
    const [d1, d2] = R.tirar(2);
    const suma = d1 + d2, total = suma + mod.neto;
    const filaIdx = R.filaDe(R.TABLA_COMBATE, total);
    const fila = R.TABLA_COMBATE[filaIdx];
    dadosEl.innerHTML = htmlDado(d1) + htmlDado(d2) + `<span class="suma">${suma} ${signo(mod.neto)} = <strong>${total}</strong></span>`;
    resultado = { fila: filaIdx };
    pintarProbs(suma);

    const res = R.resolverCombate(fila, ctx);
    await espera(400);

    // Pérdidas del atacante
    if (res.perdidaAtacante) {
      att.pasos = Math.max(0, att.pasos - res.perdidaAtacante);
      golpe('att', res.perdidaAtacante);
      repintarPila('att', [att], 'aliado');
    }
    const atacanteMuerto = att.pasos <= 0;
    // Pérdidas del defensor
    if (res.perdidaDefensor) { aplicarPerdidas(defs, res.perdidaDefensor, arIdx); golpe('def', res.perdidaDefensor); }
    if (res.perdidaPorUnidad && !atacanteMuerto) {
      let n = 0; defs.forEach((d) => { if (d.pasos > 0) { d.pasos--; n++; } });
      golpe('def', n);
    }
    repintarPila('def', defs, 'eje');
    await espera(700);

    let retirada = atacanteMuerto ? null : res.retirada;
    if (atacanteMuerto && fila.retirada) notas.push(t('La unidad atacante ha muerto: se ignora cualquier retirada.'));
    if (res.perdidaPorUnidad && atacanteMuerto) notas.push(t('Al morir el atacante tampoco se aplican las pérdidas de la retirada situacional.'));
    const vivosDef = vivos(defs);
    let hexVacio = vivosDef.length === 0;
    if (retirada && vivosDef.length) {
      // En la retirada automática cada unidad va según su MA; el simulador mueve la pila según la mayoría.
      const tac = vivosDef.filter((d) => cara(d).claseMa === 'tac').length;
      const tipo = fila.retirada === 'retirada' ? (tac >= vivosDef.length / 2 ? 'tres' : 'hq') : 'tres';
      if (fila.retirada === 'retirada' && tac && tac < vivosDef.length) notas.push(t('Pila mixta: las unidades con MA táctico se retiran 3 hexes y las demás van junto a su HQ.'));
      defs.forEach((d) => { if (!U[d.k].unaCara) d.lado = 'm'; });
      repintarPila('def', defs, 'eje');
      if (tipo === 'tres') { moverPila('def', 5, 1); flechaEfecto({ de: [2, 1], a: [5, 1], tipo: 'retirada' }); }
      else { moverPila('def', 6, 1); flechaEfecto({ de: [2, 1], a: [6, 1], tipo: 'retirada' }); setTimeout(() => { const p = pila('def'); if (p) p.classList.add('huida'); }, 700); }
      hexVacio = true;
      await espera(1000);
      if (tipo === 'hq') bocadillo('def', t('Al HQ'), 30);
    }
    if (hexVacio && fila.trafico) ponerMarca({ tipo: 'trafico', c: 2, r: 1, dx: 0.4, dy: 0.42 }, true);
    if (hexVacio && !atacanteMuerto) {
      await espera(350);
      moverPila('att', 2, 1);
      flechaEfecto({ de: [1, 1], a: [2, 1], tipo: 'avance' });
      notas.push(t('El hex ha quedado vacío: la unidad atacante avanza tras el combate (obligatorio, sin coste de MP).') + (shock ? ' ' + t('Después puede seguir moviendo si no está detenida.') : ''));
      if (fila.trafico) notas.push(t('Se coloca un marcador de Tráfico en el hex del defensor: la unidad que avanza queda STOPPED allí.'));
    } else if (fila.trafico && !hexVacio) {
      notas.push(t('El marcador de Tráfico solo se pone si el defensor se retira o es destruido; aquí no.'));
    }
    if (!shock && !atacanteMuerto) notas.push(t(S.asistente ? 'Atacante y asistente quedan FINISHED.' : 'Atacante queda FINISHED.'));
    if (shock && !atacanteMuerto) notas.push(t('El choque ha gastado un Fire Event; si era el último, la unidad queda STOPPED.'));
    if (atacanteMuerto) notas.push(t('La unidad atacante ha perdido todos sus pasos.'));
    vivos(defs).length === 0 && !retirada && notas.push(t('El defensor ha sido destruido.'));

    const titulo = t(TXT_COMBATE[filaIdx]);
    veredicto(titulo, `${t(fila.rango)} · ${fila.perdida}${fila.retirada ? ' · D: ' + (fila.retirada === 'situacional' ? 'Situational' : 'Retreat') : ''}${fila.trafico ? ' · Traffic' : ''}`, res.notas.map(esc).concat(notas.map(esc)));
    registrar(titulo, total + ' → ' + fila.perdida);
  }

  async function tiradaEnfrentamiento() {
    const ctx = calculo.ctx, mod = calculo.mod;
    const dadosEl = $('#dados');
    await rodar(dadosEl, 2, '', 900);
    const [d1, d2] = R.tirar(2);
    const suma = d1 + d2, total = suma + mod.neto;
    const filas = calculo.filas;
    const filaIdx = R.filaDe(filas, total);
    const fila = filas[filaIdx];
    dadosEl.innerHTML = htmlDado(d1) + htmlDado(d2) + `<span class="suma">${suma} ${signo(mod.neto)} = <strong>${total}</strong></span>`;
    resultado = { fila: filaIdx };
    pintarProbs(suma);
    const res = R.resolverEnfrentamiento(fila, ctx);
    await espera(400);
    const tir = Object.assign({}, S.tirador);
    const bla = Object.assign({}, ctx.blancoEsApoyo ? S.host : S.blanco);
    const tc = 1 + S.distancia;
    const notas = [];
    if (res.perdidaTirador) { tir.pasos = Math.max(0, tir.pasos - 1); golpe('tir', 1); repintarPila('tir', [tir], 'aliado'); }
    if (res.traficoTirador) ponerMarca({ tipo: 'trafico', c: 1, r: 1, dx: 0.4, dy: 0.42 }, true);
    if (res.perdidaBlanco) {
      if (ctx.blancoEsApoyo) {
        const mk = document.querySelector(`#mapa .marca-hex[data-tipo="${S.apoyoBlanco}"]`);
        if (mk) { mk.style.transform = 'translate(-50%,-50%) scale(1.25)'; setTimeout(() => { mk.style.transform = ''; }, 500); }
        golpe('bla', 1);
        notas.push(t('El apoyo pierde un paso. Si se queda sin pasos, la formación pierde ese apoyo.'));
      } else { bla.pasos = Math.max(0, bla.pasos - 1); golpe('bla', 1); repintarPila('bla', [bla], 'eje'); }
    }
    if (res.drop) {
      const mk = document.querySelector(`#mapa .marca-hex[data-tipo="${S.apoyoBlanco}"]`);
      if (mk) mk.style.opacity = 0;
      ponerMarca({ tipo: 'drop', c: tc, r: 1, dx: -0.42, dy: -0.4 }, true);
    }
    await espera(700);
    if (res.retiradaBlanco && bla.pasos > 0) {
      if (!U[bla.k].unaCara) bla.lado = 'm';
      repintarPila('bla', [bla], 'eje');
      const dest = Math.min(COLS - 1, tc + 3);
      moverPila('bla', dest, 1);
      flechaEfecto({ de: [tc, 1], a: [dest, 1], tipo: 'retirada' });
      notas.push(t('El blanco se retira 3 hexes y voltea a su cara de movimiento.') + (tc + 3 > COLS - 1 ? ' ' + t('(En el mapa no caben los 3 hexes.)') : ''));
    }
    if (res.traficoTirador) notas.push(t('Marcador de Tráfico en el hex del tirador.'));
    if (tir.pasos <= 0) notas.push(t('El tirador ha perdido su último paso.'));
    if (!ctx.blancoEsApoyo && bla.pasos <= 0) notas.push(t('El blanco ha sido destruido.'));
    notas.push(t('El enfrentamiento ha gastado un Fire Event del tirador. No hay avance tras el combate.'));
    veredicto(t(fila.texto), `${t(fila.rango)} · ${ctx.blancoEsApoyo ? 'Target is Support' : 'Target is Real AV'}`, res.notas.map(esc).concat(notas.map(esc)));
    registrar(t(fila.texto), total + ' → ' + t(fila.rango));
  }

  async function tiradaBarrage() {
    const dadosEl = $('#dados');
    const defs = S.defensores.map((d) => Object.assign({}, d));
    const n = calculo.dadosPor;
    const tiradas = [];
    defs.forEach((d, idx) => { for (let k = 0; k < n; k++) tiradas.push({ idx }); });
    await rodar(dadosEl, tiradas.length, S.modo === 'bombardeo' ? 'rojo' : '', 900);
    tiradas.forEach((t) => { t.v = R.tirar(1)[0]; t.ok = t.v >= calculo.filasU[t.idx].fila[calculo.col]; });
    dadosEl.innerHTML = tiradas.map((t) => htmlDado(t.v, (S.modo === 'bombardeo' ? 'rojo ' : '') + (t.ok ? 'acierto' : 'fallo'))).join('');
    // Resalta los dados de cada unidad en su tarjeta
    calculo.filasU.forEach((_, idx) => {
      const du = document.querySelector(`.du[data-idx="${idx}"] > div`);
      if (du) du.insertAdjacentHTML('beforeend', '<div class="dados" style="min-height:0;margin-top:8px;gap:6px">' + tiradas.filter((t) => t.idx === idx).map((t) => htmlDado(t.v, (S.modo === 'bombardeo' ? 'rojo ' : '') + (t.ok ? 'acierto' : 'fallo')).replace('class="dado', 'style="width:30px;height:30px;padding:4px;border-radius:7px" class="dado')).join('') + '</div>');
    });
    await espera(500);
    let total = 0;
    const porUnidad = defs.map(() => 0);
    tiradas.forEach((t) => { if (t.ok && defs[t.idx].pasos > 0) { defs[t.idx].pasos--; porUnidad[t.idx]++; total++; } });
    if (total) golpe('def', total);
    repintarPila('def', defs, 'eje');
    await espera(700);
    const notas = defs.map((d, i) => `${esc(t(U[d.k].nombre))}: ${porUnidad[i] ? t(porUnidad[i] === 1 ? '{k} baja' : '{k} bajas', { k: porUnidad[i] }) : t('sin bajas')}${d.pasos <= 0 ? ' — ' + t('destruida') : ''}.`);
    if (S.modo === 'fuego') notas.push(t('El ataque por fuego ha gastado un Fire Event del tirador. Se puede repetir contra el mismo hex: no cuenta como bombardeo.'));
    else notas.push(S.enAtaque ? t('Bombardeo dentro de un ataque: si no queda nadie, el atacante avanza sin tirar en el Combat Table.') : t('Bombardeo suelto: el observador queda STOPPED. Ese hex ya no puede recibir otro bombardeo en esta activación.'));
    const titulo = total ? t(total === 1 ? '{k} baja en el objetivo' : '{k} bajas en el objetivo', { k: total }) : t('Sin bajas');
    veredicto(titulo, `${t(tiradas.length === 1 ? '{n} dado' : '{n} dados', { n: tiradas.length })} · ${MODOS[S.modo].tabla}`, notas);
    registrar(titulo, tiradas.map((t) => t.v).join(' '));
  }

  function pintarHistorial() {
    const h = $('#historial');
    h.innerHTML = historial.length ? historial.map((x, i) => `<li><span class="n">${historial.length - i}</span><span><strong style="color:var(--heading)">${esc(x.m)}</strong> · ${esc(x.txt)}</span><span class="t">${esc(x.codigo)}</span></li>`).join('') : `<li class="vacio" style="background:none">${t('Todavía no has tirado.')}</li>`;
  }

  // ---------- Arranque ----------
  $('#btn-tirar').addEventListener('click', tirarDados);
  $('#btn-reiniciar').addEventListener('click', () => { if (!animando) { resultado = null; limpiarTirada(); $('#btn-tirar').lastChild.textContent = t('Tirar los dados'); pintarTodo(); } });
  $('#btn-borrar-hist').addEventListener('click', () => { historial = []; Comun.guardar('bcs-sim-hist' + (I18N.en ? '-en' : ''), '[]'); pintarHistorial(); });
  pintarTodo();
  pintarHistorial();
})();
