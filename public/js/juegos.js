// Juegos de la serie con sus fichas reales: lee los datos generados (juegos-ip.js…),
// registra cada unidad en Fichas.UNIDADES con la misma forma que las de ejemplo
// y da los escenarios a las utilidades de partida.
(function (root) {
  'use strict';
  const t = root.I18N.t, RAIZ = root.I18N.raiz, F = root.Fichas;
  const DATOS = root.JUEGOS_DATOS || {};

  F.BANDOS.sov = { nombre: t('URSS') };
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
  function tipo(nombre, d, rasgos) {
    if (rasgos.includes('H') && d.av) return d.asalto ? t('Tanques con infantería') : rasgos.includes('B') ? t('Tanques pesados') : t('Tanques');
    if (d.tipoAv === 'standoff') return t('Cañones (Stand Off)');
    if (d.tipoAv === 'limited') return t('Antitanque');
    if (rasgos.includes('R')) return t('Reconocimiento');
    if (d.av) return t('Infantería mecanizada');
    if (/\bPio\b/.test(nombre)) return t('Zapadores');
    if (d.ma === 2 && d.claseMa === 'leg') return t('Ametralladoras');
    return t('Infantería');
  }

  const JUEGOS = {};
  Object.entries(DATOS).forEach(([id, j]) => {
    const unidades = [];
    j.unidades.forEach(([n, bando, mapa, form, nombre, pasos, imgD, imgM, txtD, txtM, rasgos]) => {
      if (txtD.startsWith('SUP') && txtM === '-') return;           // solo apoyo: no es una unidad de combate
      const soloReal = txtD.startsWith('SUP');                       // anverso de apoyo: se usa la cara real
      const unaCara = soloReal || txtM === '-';
      const d = cara(soloReal ? txtM : txtD), m = unaCara ? d : cara(txtM);
      const img = soloReal ? imgM : imgD;
      const k = id + '-' + n;
      root.I18N.literal(nombre);
      F.UNIDADES[k] = {
        juego: id, mapa, formacion: form, bando, pasos, id: form, nombre,
        tipo: tipo(nombre, d, rasgos), duro: rasgos.includes('H'), ruptura: rasgos.includes('B'), recon: rasgos.includes('R'), unaCara,
        img: { d: RAIZ + 'fichas/' + id + '/' + img, m: RAIZ + 'fichas/' + id + '/' + (unaCara ? img : imgM) }, d, m
      };
      unidades.push(k);
    });
    JUEGOS[id] = { id, nombre: j.nombre, mapas: j.mapas, escenarios: j.escenarios, unidades };
  });

  // Etiqueta para los selectores: las de un juego llevan su designación y su tipo
  const etiquetaBase = F.etiqueta;
  F.etiqueta = (u) => u.juego ? u.nombre + ' · ' + u.tipo : etiquetaBase(u);

  // Unidades de un juego agrupadas por mapa, bando y formación (para <optgroup>)
  function grupos(id, filtro) {
    const g = new Map();
    JUEGOS[id].unidades.filter((k) => !filtro || filtro(F.UNIDADES[k], k)).forEach((k) => {
      const u = F.UNIDADES[k], clave = JUEGOS[id].mapas[u.mapa] + ' · ' + F.BANDOS[u.bando].nombre + ' · ' + u.formacion;
      if (!g.has(clave)) g.set(clave, []);
      g.get(clave).push(k);
    });
    return [...g.entries()];
  }

  root.Juegos = { JUEGOS, grupos, cara };
})(window);
