// Pruebas de los datos de los juegos (fichas leídas de los módulos de VASSAL): node tests/juegos.test.js
'use strict';
const assert = require('assert');
global.window = { document: { documentElement: { lang: 'es' } } };
require('../public/js/i18n.js');
require('../public/js/fichas.js');
['arr', 'df', 'ip', 'vot'].forEach((j) => require('../public/js/juegos-' + j + '.js'));
require('../public/js/juegos.js');
const { Fichas: F, Juegos: J } = window;
const fs = require('fs'), path = require('path');

let n = 0;
Object.values(J.JUEGOS).forEach((j) => {
  assert(j.unidades.length > 0, j.id + ' sin unidades');
  j.unidades.forEach((k) => {
    const u = F.UNIDADES[k];
    ['d', 'm'].forEach((l) => {
      const c = u[l];
      assert(c.ar >= 0 && c.ar <= 5, k + ' AR ' + c.ar);
      assert(c.ma >= 0 && ['tac', 'truck', 'leg'].includes(c.claseMa), k + ' MA');
      if (c.av !== undefined) assert(['red', 'limited', 'standoff', 'light'].includes(c.tipoAv) && c.alcance >= 1, k + ' AV');
      assert(fs.existsSync(path.join(__dirname, '..', 'public', u.img[l])), k + ' sin imagen ' + u.img[l]);
    });
    assert(u.pasos >= 1 && u.pasos <= 9, k + ' pasos');
    assert(F.BANDOS[u.bando], k + ' bando');
    n++;
  });
  j.escenarios.forEach((e) => {
    assert(e.bandos.every((b) => b.formaciones.length), j.id + ' ' + e.id + ' sin formaciones');
    assert(e.unidades.length > 0, j.id + ' ' + e.id + ' sin unidades');
    e.bandos.forEach((b) => b.formaciones.forEach((f) => {
      assert(f.icono && fs.existsSync(path.join(__dirname, '..', 'public', f.icono)), j.id + ': ' + f.nombre + ' sin icono');
    }));
  });
});
console.log(n + ' unidades OK');
