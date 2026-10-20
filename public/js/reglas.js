// Motor de reglas del BCS v2.0: las tablas transcritas y los cálculos de
// modificadores. No toca el DOM, así que también se carga en Node para las
// pruebas (tests/reglas.test.js).
(function (root) {
  'use strict';
  // Traducción (js/i18n.js en el navegador; en Node, los textos quedan en castellano)
  const t = (root.I18N && root.I18N.t) || ((x, v) => (v ? x.replace(/\{(\w+)\}/g, (m, k) => v[k]) : x));

  // ---------- Dados ----------

  // Probabilidad de cada suma de 2d6 (2..12).
  const DOS_DADOS = {};
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) DOS_DADOS[a + b] = (DOS_DADOS[a + b] || 0) + 1 / 36;

  function tirar(n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(1 + Math.floor(Math.random() * 6));
    return out;
  }

  // Reparte la probabilidad de 2d6 + drm entre las filas de una tabla.
  // Cada fila es { hasta } (inclusive; la última sin tope).
  function distribucion(filas, drm) {
    const p = filas.map(() => 0);
    for (let s = 2; s <= 12; s++) p[filaDe(filas, s + drm)] += DOS_DADOS[s];
    return p;
  }

  function filaDe(filas, total) {
    for (let i = 0; i < filas.length; i++) {
      if (filas[i].hasta === undefined || total <= filas[i].hasta) return i;
    }
    return filas.length - 1;
  }

  // ---------- Tablas (BCS v2.0 Charts & Tables) ----------

  const TABLA_COMBATE = [
    { hasta: 4, rango: '4 o menos', perdida: 'A2', retirada: null, trafico: false },
    { hasta: 6, rango: '5-6', perdida: 'A1', retirada: null, trafico: false },
    { hasta: 8, rango: '7-8', perdida: 'A1', retirada: 'situacional', trafico: true },
    { hasta: 10, rango: '9-10', perdida: '[A1]', retirada: 'situacional', trafico: true },
    { hasta: 12, rango: '11-12', perdida: 'D1', retirada: 'retirada', trafico: false },
    { rango: '13 o más', perdida: 'D2', retirada: 'retirada', trafico: false }
  ];

  const TABLA_ENFRENTAMIENTO_REAL = [
    { hasta: 5, rango: '5 o menos', clave: 'firer', texto: 'Pérdida del tirador y Tráfico' },
    { hasta: 8, rango: '6-8', clave: 'ambos', texto: 'Pérdida para ambos' },
    { rango: '9 o más', clave: 'target', texto: 'Pérdida del blanco y retirada' }
  ];

  const TABLA_ENFRENTAMIENTO_APOYO = [
    { hasta: 3, rango: '3 o menos', clave: 'firer', texto: 'Pérdida del tirador y Tráfico' },
    { hasta: 5, rango: '4-5', clave: 'nada', texto: 'Sin resultado' },
    { hasta: 10, rango: '6-10', clave: 'drop', texto: 'El blanco pierde el apoyo (Drop)' },
    { rango: '11 o más', clave: 'loss-drop', texto: 'Pérdida del blanco y Drop' }
  ];

  // Barrage Table: el número mínimo del d6 que causa una baja.
  // Si aplican varias filas se usa la de MENOS probabilidad de pérdida.
  const TABLA_BOMBARDEO = [
    { id: 'duro', texto: 'Unidad Hard, Stand Off desplegada o hex Urbano', arty: 6, fuego: 6 },
    { id: 'ciudad', texto: 'Hex de Ciudad', arty: 5, fuego: 6 },
    { id: 'terreno', texto: 'Hex con Terrain o Prepared Defense', arty: 4, fuego: 5 },
    { id: 'nada', texto: 'Ninguno de los anteriores', arty: 3, fuego: 4 }
  ];

  const TABLA_SNAFU = [
    { hasta: 2, rango: '2 o menos', clave: 'fail', texto: 'Fail' },
    { hasta: 6, rango: '3-6', clave: 'partial', texto: 'Partial' },
    { rango: '7 o más', clave: 'full', texto: 'Full' }
  ];

  const FATIGA = [
    { id: 'obj', texto: 'Se colocó algún OBJ de combate', max: 1 },
    { id: 'fuego', texto: 'Enfrentamientos, Ataques por fuego o Segunda Activación', max: 2 },
    { id: 'ataque', texto: 'Se ejecutó la secuencia de ataque', max: 3 }
  ];

  // ---------- Unidades ----------
  // Una cara de ficha: { av, tipoAv: 'red'|'limited'|'standoff'|'light'|null,
  //   ar, alcance, ma, claseMa: 'tac'|'truck'|'leg', asalto }
  // y en la unidad: duro, ruptura (Breakthrough), recon, soloApoyo.

  function tieneAv(cara) { return cara && cara.av !== null && cara.av !== undefined; }
  function esCapazDeAtacar(cara) { return !!(cara && cara.asalto); }
  function esDual(cara) { return esCapazDeAtacar(cara) && tieneAv(cara); }
  function esInfanteria(cara) { return !tieneAv(cara); }
  function esDesprevenida(cara) { return !esCapazDeAtacar(cara) && !tieneAv(cara); }
  function esDuroRojo(u, cara) { return u.duro && cara.tipoAv === 'red'; }

  // Tipo funcional de una cara, como lo usa el Unit Capabilities Chart.
  function tipoFuncional(cara) {
    if (esDesprevenida(cara)) return 'unprepared';
    if (esDual(cara)) return 'dual';
    if (tieneAv(cara)) return cara.tipoAv; // red, limited, standoff, light
    return 'attack-capable';
  }

  // Un host es una unidad con capacidad de ataque sin AV propio (1.5a, 1.5h).
  function puedeSerHost(cara) { return esCapazDeAtacar(cara) && !tieneAv(cara); }

  function rango(n) { return Math.max(1, n || 1); }

  // ---------- Combat Table (5.1) ----------
  // ctx = {
  //   tipo: 'regular'|'shock',
  //   atacante: { unidad, cara, apoyo: null|'red'|'limited'|'standoff' },
  //   asistente: null | { unidad, cara },
  //   defensor: { unidad, cara, apoyo, }   // la unidad que da el AR
  //   numDefensores, terreno: 'abierto'|'terreno'|'ciudad'|'urbano',
  //   claveTerreno, ladoHex, pdDefensor, pdAtacante, msrAtacante, msrDefensor,
  //   dobleObj, supresion, desdeFuera, fuegoPrevio
  // }
  function modificadoresCombate(ctx) {
    const a = [], d = [], avisos = [];
    const shock = ctx.tipo === 'shock';
    const ca = ctx.atacante.cara, ua = ctx.atacante.unidad;
    const cd = ctx.defensor.cara, ud = ctx.defensor.unidad;

    a.push({ id: 'ar', texto: t('Action Rating de {u}', { u: ua.nombre }), valor: ca.ar, base: true });
    d.push({ id: 'ar', texto: t('Action Rating de {u}', { u: ud.nombre }), valor: cd.ar, base: true });

    // Comunes
    const apoyoAtacante = ctx.atacante.apoyo === 'red' && puedeSerHost(ca);
    if (esDual(ca)) a.push({ id: 'dual', texto: t('Unidad Dual'), valor: 1 });
    else if (apoyoAtacante) a.push({ id: 'apoyo', texto: t('Apoyo Red AV'), valor: 1 });
    else if (ctx.atacante.apoyo && ctx.atacante.apoyo !== 'red' && puedeSerHost(ca)) {
      avisos.push(t('Al atacante solo le vale el apoyo Red AV; el {a} no da modificador al ataque.', { a: nombreApoyo(ctx.atacante.apoyo) }));
    }
    if (ctx.msrAtacante) a.push({ id: 'msr', texto: t('Marcador MSR Blocked'), valor: -1 });

    const apoyoDefensor = !!ctx.defensor.apoyo && puedeSerHost(cd);
    if (esDual(cd)) d.push({ id: 'dual', texto: t('Unidad Dual'), valor: 1 });
    else if (apoyoDefensor) d.push({ id: 'apoyo', texto: t('Apoyo ({a})', { a: nombreApoyo(ctx.defensor.apoyo) }), valor: 1 });
    if (ctx.msrDefensor) d.push({ id: 'msr', texto: t('Marcador MSR Blocked'), valor: -1 });

    // Solo atacante
    if (ctx.dobleObj) a.push({ id: 'dobleobj', texto: t('Double OBJ Zone'), valor: 1 });
    if (ctx.pdAtacante) a.push({ id: 'pdatt', texto: t('La formación atacante está en Prepared Defense'), valor: -1 });
    if (ctx.supresion) a.push({ id: 'supresion', texto: t('Bombardeo de supresión'), valor: shock ? 1 : 2 });
    if (!shock && ctx.asistente) a.push({ id: 'assist', texto: t('Asistencia de {u}', { u: ctx.asistente.unidad.nombre }), valor: 1 });
    if (!shock && ctx.desdeFuera) a.push({ id: 'offmap', texto: t('Ataque desde fuera del mapa'), valor: 2 });
    if (shock && ctx.fuegoPrevio) a.push({ id: 'abf', texto: t('Precedido de Ataque por fuego'), valor: 1 });
    if (shock && tieneAv(ca)) {
      if (ua.ruptura) a.push({ id: 'ruptura', texto: t('Unidad AV de ruptura (Breakthrough)'), valor: 2 });
      else if (esDuroRojo(ua, ca)) a.push({ id: 'durorojo', texto: t('Unidad Hard Red AV'), valor: 1 });
    }

    // Solo defensor
    const pdValida = ctx.pdDefensor && ctx.defensorDesplegado !== false;
    if (pdValida) d.push({ id: 'pd', texto: t('Prepared Defense'), valor: 1 });
    if (ctx.numDefensores === 2) d.push({ id: 'dos', texto: t('Exactamente dos unidades de combate'), valor: 1 });
    if (ctx.numDefensores > 2) d.push({ id: 'sobre', texto: t('Más de dos unidades (sobreapilado)'), valor: -2 });
    if (ctx.ladoHex) d.push({ id: 'lado', texto: t('El atacante cruza un lado de hex con Terrain'), valor: 1 });

    const standoffReal = cd.tipoAv === 'standoff';
    if (esDual(cd) || esInfanteria(cd) || standoffReal) {
      if (ctx.terreno === 'terreno') d.push({ id: 'terr', texto: t('En hex de Terrain'), valor: 1 });
      if (ctx.terreno === 'ciudad' || ctx.terreno === 'urbano') d.push({ id: 'terr', texto: t('En hex de Ciudad o Urbano'), valor: 2 });
    }
    if (esDuroRojo(ud, cd) && !esDual(cd) && !pdValida && ctx.terreno === 'abierto') {
      d.push({ id: 'duroabierto', texto: t('Hard Red AV en terreno abierto'), valor: 2 });
    }
    if (tieneAv(cd) && ctx.terreno === 'urbano' && !(standoffReal && ctx.defensorDesplegado !== false)) {
      d.push({ id: 'avurbano', texto: t('Unidad AV en hex Urbano'), valor: -3 });
    }

    const suma = (l) => l.reduce((s, m) => s + m.valor, 0);
    const totalA = suma(a), totalD = suma(d);
    return { atacante: a, defensor: d, totalA, totalD, neto: totalA - totalD, avisos };
  }

  function nombreApoyo(t) {
    return { red: 'Red AV', limited: 'Limited AV', standoff: 'Stand Off', light: 'Light AV' }[t] || t;
  }

  // Requisitos del ataque (5.1c, 5.1h, 5.1i, 5.1m). Devuelve [{ ok, texto }].
  function requisitosCombate(ctx) {
    const r = [];
    const ca = ctx.atacante.cara, ua = ctx.atacante.unidad;
    const ok = (cond, texto) => r.push({ ok: !!cond, texto });
    if (ctx.tipo === 'regular') {
      ok(esCapazDeAtacar(ca), t('La unidad atacante tiene la flecha de asalto (Attack-Capable)'));
      ok(ca.ma > 0, t('La unidad atacante tiene MA mayor que 0'));
      if (ctx.asistente) {
        const cs = ctx.asistente.cara;
        ok(esCapazDeAtacar(cs) || tieneAv(cs), t('El asistente tiene capacidad de ataque o un AV a la vista'));
      }
      ok(ctx.numDefensores >= 1, t('El hex defensor tiene al menos una unidad enemiga'));
    } else {
      ok(ca.claseMa === 'tac', t('La unidad atacante tiene MA táctico (rojo)'));
      const habilitada = esCapazDeAtacar(ca) || ca.tipoAv === 'red' || ca.tipoAv === 'light' || ua.ruptura;
      ok(habilitada, t('Muestra flecha de asalto, Red AV, Light AV o es de ruptura'));
      ok(!ctx.defensorConAv, t('El hex defensor no contiene ningún AV (ni real ni de apoyo)'));
      ok(ctx.costeMp !== false, t('El hex defensor cuesta 3 MP o menos para MA táctico'));
      ok(!ctx.detenida, t('La unidad no está STOPPED y le queda un Fire Event'));
    }
    ok(!ctx.sobreapilado, t('La unidad atacante no está sobreapilada'));
    ok(ctx.enZonaObj !== false, t('El hex defensor está dentro de una OBJ Zone'));
    return r;
  }

  // Interpreta una fila de la Combat Table con el estado del defensor.
  // Devuelve { perdidaAtacante, perdidaDefensor, retirada, perdidaPorUnidad, trafico, notas }
  function resolverCombate(fila, ctx) {
    const res = { perdidaAtacante: 0, perdidaDefensor: 0, perdidaPorUnidad: 0, retirada: null, trafico: false, notas: [] };
    const p = fila.perdida;
    if (p === 'A2') res.perdidaAtacante = 2;
    if (p === 'A1') res.perdidaAtacante = 1;
    if (p === '[A1]') {
      if (ctx.pdDefensor) { res.perdidaAtacante = 1; res.notas.push(t('[A1]: el defensor está en Prepared Defense, así que el atacante pierde un paso.')); }
      else res.notas.push(t('[A1]: sin Prepared Defense del defensor, el atacante no pierde nada.'));
    }
    if (p === 'D1') res.perdidaDefensor = 1;
    if (p === 'D2') res.perdidaDefensor = 2;

    if (fila.retirada === 'situacional') {
      if (ctx.pdDefensor || ctx.claveTerreno) {
        res.retirada = null;
        res.perdidaPorUnidad = 1;
        res.notas.push(t(ctx.pdDefensor ? 'Retirada situacional: el defensor está en Prepared Defense, aguanta en el hex y cada unidad pierde un paso.' : 'Retirada situacional: el defensor está en Key Terrain, aguanta en el hex y cada unidad pierde un paso.'));
      } else {
        res.retirada = 'tres';
        res.notas.push(t('Retirada situacional: el defensor se retira 3 hexes y voltea a su cara de movimiento.'));
      }
    }
    if (fila.retirada === 'retirada') {
      res.retirada = ctx.defensorClaseMa === 'tac' ? 'tres' : 'hq';
      res.notas.push(t(res.retirada === 'tres'
        ? 'Retirada automática: con MA táctico, el defensor se retira 3 hexes y voltea a cara de movimiento.'
        : 'Retirada automática: con MA a pie o de camión, el defensor se retira junto a su HQ (HQ Refuge) o, si no puede, sale del mapa y vuelve el turno siguiente.'));
    }
    res.trafico = fila.trafico;
    return res;
  }

  // ---------- Engagement Table (5.2) ----------
  // ctx = { tirador: {unidad, cara}, blanco: {unidad, cara} | apoyo,
  //   blancoEsApoyo, apoyo: {av, tipoAv, alcance}, host: {unidad, cara},
  //   distancia, dobleObj, pdBlanco, variosApoyos, terrenoBlanco }
  function modificadoresEnfrentamiento(ctx) {
    const f = [], bl = [];
    const cf = ctx.tirador.cara;
    f.push({ id: 'av', texto: t('AV del tirador'), valor: cf.av, base: true });
    f.push({ id: 'ar', texto: t('Action Rating del tirador'), valor: cf.ar, base: true });
    if (ctx.dobleObj) f.push({ id: 'dobleobj', texto: t('Blanco en Double OBJ Zone'), valor: 1 });
    if (cf.tipoAv === 'limited') f.push({ id: 'limited', texto: t('El tirador es Limited AV'), valor: -1 });

    if (ctx.blancoEsApoyo) {
      bl.push({ id: 'av', texto: t('AV del apoyo'), valor: ctx.apoyo.av, base: true });
      bl.push({ id: 'ar', texto: t('Action Rating del host'), valor: ctx.host.cara.ar, base: true });
    } else {
      const cb = ctx.blanco.cara;
      bl.push({ id: 'av', texto: t('AV del blanco'), valor: cb.av, base: true });
      bl.push({ id: 'ar', texto: t('Action Rating del blanco'), valor: cb.ar, base: true });
      if (cb.tipoAv === 'standoff') bl.push({ id: 'standoff', texto: t('Blanco Stand Off (no en apoyo)'), valor: 1 });
    }
    const varios = ctx.blancoEsApoyo && ctx.variosApoyos;
    if (ctx.pdBlanco || varios) {
      bl.push({ id: 'pd', texto: t(ctx.pdBlanco && varios ? 'Prepared Defense y varios apoyos' : (ctx.pdBlanco ? 'Prepared Defense' : 'Varios apoyos en la formación')), valor: 1 });
    }
    const suma = (l) => l.reduce((s, m) => s + m.valor, 0);
    const totalF = suma(f), totalT = suma(bl);
    return { tirador: f, blanco: bl, totalF, totalT, neto: totalF - totalT };
  }

  function alcanceBlanco(ctx) {
    return rango(ctx.blancoEsApoyo ? ctx.apoyo.alcance : ctx.blanco.cara.alcance);
  }

  function requisitosEnfrentamiento(ctx) {
    const r = [];
    const ok = (cond, texto) => r.push({ ok: !!cond, texto });
    const cf = ctx.tirador.cara;
    ok(tieneAv(cf), t('El tirador es una unidad AV real (no en apoyo)'));
    ok(cf.tipoAv !== 'light', t('El tirador no es Light AV (los Light AV solo pueden ser blanco)'));
    ok(!ctx.pantallaTirador, t('El tirador no está en Screen'));
    ok(ctx.distancia <= rango(cf.alcance), t('El blanco está dentro del alcance del tirador ({n})', { n: rango(cf.alcance) }));
    if (ctx.terrenoBlanco || ctx.pdBlanco) ok(ctx.distancia <= 1, t('Blanco en Terrain o Prepared Defense: el tirador tiene que estar adyacente'));
    if (ctx.blancoEsApoyo) ok(puedeSerHost(ctx.host.cara), t('El host es infantería con capacidad de ataque (puede llevar apoyo)'));
    return r;
  }

  function resolverEnfrentamiento(fila, ctx) {
    const fueraDeAlcance = ctx.distancia > alcanceBlanco(ctx);
    const res = { perdidaTirador: 0, perdidaBlanco: 0, retiradaBlanco: false, drop: false, traficoTirador: false, notas: [] };
    let clave = fila.clave;
    if (clave === 'ambos' && ctx.opcionalLejos && ctx.distancia > 1) {
      clave = 'nada';
      res.notas.push(t('Regla opcional 5.2f: a más de un hex, "Pérdida para ambos" pasa a "Sin efecto".'));
    }
    if (clave === 'ambos' && ctx.blancoPantalla) {
      clave = 'pantalla';
      res.notas.push(t('El blanco está en Screen: "Pérdida para ambos" pasa a "Sin pérdidas, el blanco se retira 3 hexes".'));
      res.retiradaBlanco = true;
    }
    if (clave === 'firer') { res.perdidaTirador = 1; res.traficoTirador = true; }
    if (clave === 'ambos') { res.perdidaTirador = 1; res.perdidaBlanco = 1; }
    if (clave === 'target') { res.perdidaBlanco = 1; res.retiradaBlanco = true; }
    if (clave === 'drop') res.drop = true;
    if (clave === 'loss-drop') { res.perdidaBlanco = 1; res.drop = true; }
    if (fueraDeAlcance && (res.perdidaTirador || res.traficoTirador)) {
      res.perdidaTirador = 0; res.traficoTirador = false;
      res.notas.push(t('El tirador está fuera del alcance del blanco ({n}), así que se ignora cualquier resultado contra el tirador.', { n: alcanceBlanco(ctx) }));
    }
    if (ctx.blancoEsApoyo && res.perdidaBlanco) res.notas.push(t('La pérdida la sufre la unidad de apoyo, nunca el host.'));
    if (res.drop) res.notas.push(t('Drop: todas las unidades del hex del blanco pierden el apoyo hasta que acabe esta activación.'));
    return res;
  }

  // ---------- Barrage Table (5.3, 5.4) ----------
  // blanco = { duro, standoffDesplegado }, hex = { terreno, pd }
  function filaBombardeo(blanco, hex) {
    if (blanco.duro || blanco.standoffDesplegado || hex.terreno === 'urbano') return TABLA_BOMBARDEO[0];
    if (hex.terreno === 'ciudad') return TABLA_BOMBARDEO[1];
    if (hex.terreno === 'terreno' || hex.pd) return TABLA_BOMBARDEO[2];
    return TABLA_BOMBARDEO[3];
  }

  // Probabilidad de 0..n bajas con n dados que aciertan con p cada uno.
  function binomial(n, p) {
    const out = [];
    for (let k = 0; k <= n; k++) out.push(comb(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k));
    return out;
  }
  function comb(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }

  // ---------- SNAFU (3.2) ----------
  function resultadoSnafu(total, pd) {
    let fila = TABLA_SNAFU[filaDe(TABLA_SNAFU, total)];
    if (pd && fila.clave === 'full') return { fila: TABLA_SNAFU[1], rebajado: true };
    return { fila, rebajado: false };
  }

  const api = {
    DOS_DADOS, tirar, distribucion, filaDe,
    TABLA_COMBATE, TABLA_ENFRENTAMIENTO_REAL, TABLA_ENFRENTAMIENTO_APOYO, TABLA_BOMBARDEO, TABLA_SNAFU, FATIGA,
    tieneAv, esCapazDeAtacar, esDual, esInfanteria, esDesprevenida, tipoFuncional, puedeSerHost, nombreApoyo,
    modificadoresCombate, requisitosCombate, resolverCombate,
    modificadoresEnfrentamiento, requisitosEnfrentamiento, resolverEnfrentamiento, alcanceBlanco,
    filaBombardeo, binomial, resultadoSnafu
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Reglas = api;
})(typeof window !== 'undefined' ? window : globalThis);
