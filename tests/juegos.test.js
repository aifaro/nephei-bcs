// Pruebas de los datos de los juegos (fichas leídas de los módulos de VASSAL): node tests/juegos.test.js
'use strict';
const assert = require('assert');
global.window = { document: { documentElement: { lang: 'es' } } };
require('../public/js/i18n.js');
require('../public/js/fichas.js');
require('../public/js/juegos-ip.js');
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
      assert(c.ma > 0 && ['tac', 'truck', 'leg'].includes(c.claseMa), k + ' MA');
      if (c.av !== undefined) assert(['red', 'limited', 'standoff', 'light'].includes(c.tipoAv) && c.alcance >= 1, k + ' AV');
      assert(fs.existsSync(path.join(__dirname, '..', 'public', u.img[l])), k + ' sin imagen ' + u.img[l]);
    });
    assert(u.pasos >= 1 && u.pasos <= 9, k + ' pasos');
    assert(F.BANDOS[u.bando], k + ' bando');
    if (u.duro) assert(u.d.av !== undefined, k + ' hard sin AV');
    n++;
  });
  j.escenarios.forEach((e) => {
    assert(e.eje.length && e.sov.length, e.id + ' sin formaciones');
    e.eje.concat(e.sov).forEach((f) => assert(j.unidades.some((k) => F.UNIDADES[k].formacion === f), e.id + ': ' + f));
  });
});
console.log(n + ' unidades OK');
