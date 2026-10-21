// Juegos de la serie con sus fichas reales: lee los datos generados por tools/vassal.py
// (juegos-<juego>.js), registra cada unidad en Fichas.UNIDADES con la misma forma que las
// de ejemplo y da al simulador y a la partida los escenarios, las formaciones y sus chits.
(function (root) {
  'use strict';
  const t = root.I18N.t, RAIZ = root.I18N.raiz, F = root.Fichas;
  const DATOS = root.JUEGOS_DATOS || {};
  // Orden en los selectores
  const ORDEN = ['arr', 'df', 'ip', 'vot'];

  const CLASE = { T: 'tac', K: 'truck', P: 'leg' };
  const TIPO_AV = { R: 'red', L: 'limited', S: 'standoff', W: 'light' };

  // «A R3 a5 r2 T4» → { asalto, av, tipoAv, ar, alcance, ma, claseMa }
  function cara(txt) {
    const c = { asalto: false };
    txt.split(/\s+/).forEach((x) => {
      if (x === 'A') c.asalto = true;
      else if (TIPO_AV[x[0]] && /^\d+$/.test(x.slice(1))) { c.av = +x.slice(1); c.tipoAv = TIPO_AV[x[0]]; }
      else if (x[0] === 'a') c.ar = +x.slice(1);
      else if (x[0] === 'r') c.alcance = +x.slice(1);
      else if (CLASE[x[0]]) { c.ma = +x.slice(1); c.claseMa = CLASE[x[0]]; }
    });
    if (c.av !== undefined && !c.alcance) c.alcance = 1;   // 1.1a: sin número impreso, alcance 1
    return c;
  }

  // Qué es la unidad, para el selector (el módulo no lo dice: se deduce de sus valores y su nombre)
  function tipo(nombre, d, m, rasgos) {
    if (!d.ma) return t('Posición fija');
    if (rasgos.includes('H') && d.av) return d.asalto ? t('Tanques con infantería') : rasgos.includes('B') ? t('Tanques pesados') : t('Tanques');
    if (d.tipoAv === 'standoff') return t('Cañones (Stand Off)');
    if (d.tipoAv === 'limited') return t('Antitanque');
    if (rasgos.includes('R') || (d.av && d.ma === 16)) return t('Reconocimiento');
    if (d.av || m.av !== undefined) return t('Infantería mecanizada');
    if (/\bPio\b|Eng/.test(nombre)) return t('Zapadores');
    if (d.ma === 2 && d.claseMa === 'leg') return t('Ametralladoras');
    return t('Infantería');
  }

  const img = (id, f) => f ? RAIZ + 'fichas/' + id + '/' + f : null;
  const JUEGOS = {};
  ORDEN.concat(Object.keys(DATOS).filter((id) => !ORDEN.includes(id))).filter((id) => DATOS[id]).forEach((id) => {
    const j = DATOS[id];
    const bandos = j.bandos.map((nombre, i) => {
      const k = id + ':' + i;
      F.BANDOS[k] = { nombre: t(nombre) };
      return k;
    });
    const formaciones = {};
    Object.entries(j.formaciones).forEach(([nombre, [b, mapa, chit, hq]]) => {
      root.I18N.literal(nombre);
      formaciones[nombre] = { nombre, bando: bandos[b], mapa, chit: img(id, chit), hq: img(id, hq), icono: img(id, chit || hq) };
    });
    const unidades = [], porNum = {};
    j.unidades.forEach(([n, b, mapa, form, nombre, pasos, imgD, imgM, txtD, txtM, rasgos]) => {
      if (txtD.startsWith('SUP') && txtM === '-') return;           // solo apoyo: no es una unidad de combate
      const soloReal = txtD.startsWith('SUP');                       // anverso de apoyo: se usa la cara real
      const unaCara = soloReal || txtM === '-';
      const d = cara(soloReal ? txtM : txtD), m = unaCara ? d : cara(txtM);
      const imagen = soloReal ? imgM : imgD;
      const k = id + '-' + n;
      root.I18N.literal(nombre);
      F.UNIDADES[k] = {
        juego: id, mapa, formacion: form, bando: bandos[b], lado: b, pasos, id: form, nombre,
        tipo: tipo(nombre, d, m, rasgos), duro: rasgos.includes('H'), ruptura: rasgos.includes('B'), recon: rasgos.includes('R'), unaCara,
        img: { d: img(id, imagen), m: img(id, unaCara ? imagen : imgM) }, d, m
      };
      unidades.push(k); porNum[n] = k;
    });
    const escenarios = j.escenarios.map((e) => ({
      id: e.id, nombre: e.nombre,
      bandos: e.bandos.map((fs, i) => ({ nombre: F.BANDOS[bandos[i]].nombre, formaciones: fs.map((f) => formaciones[f]) })),
      unidades: e.unidades.map((n) => porNum[n]).filter(Boolean)
    }));
    JUEGOS[id] = { id, nombre: j.nombre, bandos, formaciones, escenarios, unidades };
  });

  // Etiqueta para los selectores: las de un juego llevan su designación y su tipo
  const etiquetaBase = F.etiqueta;
  F.etiqueta = (u) => u.juego ? u.nombre + ' · ' + u.tipo : etiquetaBase(u);

  // Unidades agrupadas por bando y formación (para <optgroup>)
  function grupos(ks) {
    const g = new Map();
    ks.forEach((k) => {
      const u = F.UNIDADES[k], clave = F.BANDOS[u.bando].nombre + ' · ' + u.formacion;
      if (!g.has(clave)) g.set(clave, []);
      g.get(clave).push(k);
    });
    return [...g.entries()];
  }

  root.Juegos = { JUEGOS, ORDEN: Object.keys(JUEGOS), grupos, cara };
})(window);
