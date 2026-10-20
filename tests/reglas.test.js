// Pruebas del motor de reglas: node tests/reglas.test.js
'use strict';
const assert = require('assert');
const R = require('../public/js/reglas.js');

const inf = { nombre: 'inf' }, infD = { asalto: true, ar: 3, ma: 4, claseMa: 'leg' }, infM = { asalto: false, ar: 2, ma: 8, claseMa: 'leg' };
const panther = { nombre: 'panther', duro: true }, pantherD = { av: 5, tipoAv: 'red', ar: 4, alcance: 3, ma: 4, claseMa: 'tac' };
const sherman = { nombre: 'sherman' }, shermanD = { av: 3, tipoAv: 'red', ar: 3, alcance: 2, ma: 5, claseMa: 'tac' };
const tiger = { nombre: 'tiger', duro: true, ruptura: true }, tigerD = { av: 5, tipoAv: 'red', ar: 4, alcance: 3, ma: 4, claseMa: 'tac' };
const flakD = { av: 5, tipoAv: 'standoff', ar: 4, alcance: 3, ma: 2, claseMa: 'truck' };
const tdD = { av: 3, tipoAv: 'limited', ar: 4, alcance: 3, ma: 6, claseMa: 'tac' };

function ctx(o) {
  return Object.assign({ tipo: 'regular', atacante: { unidad: inf, cara: infD, apoyo: null }, asistente: null,
    defensor: { unidad: inf, cara: infD, apoyo: null }, numDefensores: 1, terreno: 'abierto' }, o);
}
let n = 0;
function caso(nombre, f) {
  try { f(); n++; } catch (e) { console.error('FALLA: ' + nombre); throw e; }
}

caso('ataque regular con apoyo, supresión y asistencia', () => {
  const m = R.modificadoresCombate(ctx({ atacante: { unidad: inf, cara: infD, apoyo: 'red' }, supresion: true, asistente: { unidad: sherman, cara: shermanD } }));
  assert.strictEqual(m.totalA, 3 + 1 + 2 + 1);
  assert.strictEqual(m.totalD, 3);
  assert.strictEqual(m.neto, 4);
});
caso('el apoyo Limited no ayuda al atacante pero sí al defensor', () => {
  const m = R.modificadoresCombate(ctx({ atacante: { unidad: inf, cara: infD, apoyo: 'limited' }, defensor: { unidad: inf, cara: infD, apoyo: 'limited' } }));
  assert.strictEqual(m.totalA, 3);
  assert.strictEqual(m.totalD, 4);
  assert.ok(m.avisos.length);
});
caso('Hard Red AV en abierto +2, no si está en PD', () => {
  assert.strictEqual(R.modificadoresCombate(ctx({ defensor: { unidad: panther, cara: pantherD } })).totalD, 6);
  assert.strictEqual(R.modificadoresCombate(ctx({ defensor: { unidad: panther, cara: pantherD }, pdDefensor: true })).totalD, 5);
});
caso('infantería en ciudad con PD y dos unidades', () => {
  assert.strictEqual(R.modificadoresCombate(ctx({ terreno: 'ciudad', pdDefensor: true, numDefensores: 2 })).totalD, 3 + 1 + 1 + 2);
  assert.strictEqual(R.modificadoresCombate(ctx({ numDefensores: 3 })).totalD, 1);
});
caso('AV en urbano -3, salvo Stand Off desplegado (que gana +2)', () => {
  assert.strictEqual(R.modificadoresCombate(ctx({ terreno: 'urbano', defensor: { unidad: sherman, cara: shermanD } })).totalD, 0);
  assert.strictEqual(R.modificadoresCombate(ctx({ terreno: 'urbano', defensor: { unidad: { nombre: 'flak' }, cara: flakD } })).totalD, 6);
});
caso('choque de ruptura: +2 y supresión +1, sin asistencia', () => {
  const m = R.modificadoresCombate(ctx({ tipo: 'shock', atacante: { unidad: tiger, cara: tigerD }, supresion: true, asistente: { unidad: sherman, cara: shermanD } }));
  assert.strictEqual(m.totalA, 4 + 2 + 1);
  const r = R.requisitosCombate(ctx({ tipo: 'shock', atacante: { unidad: tiger, cara: tigerD }, defensorConAv: false }));
  assert.ok(r.every((x) => x.ok));
  const r2 = R.requisitosCombate(ctx({ tipo: 'shock', atacante: { unidad: inf, cara: infD } }));
  assert.ok(r2.some((x) => !x.ok), 'la infantería a pie no hace choque');
});
caso('la infantería en marcha no puede atacar', () => {
  const r = R.requisitosCombate(ctx({ atacante: { unidad: inf, cara: infM } }));
  assert.ok(r.some((x) => !x.ok));
});
caso('enfrentamiento Sherman contra Panther', () => {
  const c = { tirador: { cara: shermanD }, blanco: { cara: pantherD }, distancia: 2 };
  assert.strictEqual(R.modificadoresEnfrentamiento(c).neto, 6 - 9);
  const c2 = { tirador: { cara: tdD }, blanco: { cara: flakD }, distancia: 1 };
  assert.strictEqual(R.modificadoresEnfrentamiento(c2).neto, (3 + 4 - 1) - (5 + 4 + 1));
});
caso('enfrentamiento contra apoyo usa el AR del host', () => {
  const c = { tirador: { cara: shermanD }, blancoEsApoyo: true, apoyo: { av: 4, alcance: 3 }, host: { cara: infD }, distancia: 2, variosApoyos: true, pdBlanco: true };
  assert.strictEqual(R.modificadoresEnfrentamiento(c).totalT, 4 + 3 + 1);
});
caso('fuera del alcance del blanco se ignora la pérdida del tirador', () => {
  const c = { tirador: { cara: pantherD }, blanco: { cara: shermanD }, distancia: 3 };
  const r = R.resolverEnfrentamiento(R.TABLA_ENFRENTAMIENTO_REAL[0], c);
  assert.strictEqual(r.perdidaTirador, 0);
  const r2 = R.resolverEnfrentamiento(R.TABLA_ENFRENTAMIENTO_REAL[1], Object.assign({}, c, { distancia: 2 }));
  assert.strictEqual(r2.perdidaTirador, 1);
  assert.strictEqual(r2.perdidaBlanco, 1);
});
caso('blanco en terreno: solo adyacente; Light AV no dispara', () => {
  const c = { tirador: { cara: pantherD }, blanco: { cara: shermanD }, distancia: 2, terrenoBlanco: true };
  assert.ok(R.requisitosEnfrentamiento(c).some((x) => !x.ok));
  assert.ok(R.requisitosEnfrentamiento(Object.assign({}, c, { distancia: 1 })).every((x) => x.ok));
  assert.ok(R.requisitosEnfrentamiento({ tirador: { cara: { av: 0, tipoAv: 'light', ar: 3 } }, blanco: { cara: shermanD }, distancia: 1 }).some((x) => !x.ok));
});
caso('distribuciones', () => {
  const d = R.distribucion(R.TABLA_COMBATE, 0);
  assert.ok(Math.abs(d.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(Math.abs(d[0] - 6 / 36) < 1e-9);
  assert.ok(Math.abs(d[5]) < 1e-9);
  assert.ok(Math.abs(R.distribucion(R.TABLA_COMBATE, 1)[5] - 1 / 36) < 1e-9);
  assert.strictEqual(R.filaDe(R.TABLA_COMBATE, 9), 3);
  assert.strictEqual(R.filaDe(R.TABLA_COMBATE, 13), 5);
});
caso('Combat Table: [A1] y retirada situacional', () => {
  const f = R.TABLA_COMBATE[3];
  assert.strictEqual(R.resolverCombate(f, { pdDefensor: true }).perdidaAtacante, 1);
  assert.strictEqual(R.resolverCombate(f, {}).perdidaAtacante, 0);
  assert.strictEqual(R.resolverCombate(f, { claveTerreno: true }).perdidaPorUnidad, 1);
  assert.strictEqual(R.resolverCombate(f, {}).retirada, 'tres');
  assert.strictEqual(R.resolverCombate(R.TABLA_COMBATE[4], { defensorClaseMa: 'leg' }).retirada, 'hq');
});
caso('Barrage Table: la fila con menos probabilidad', () => {
  assert.strictEqual(R.filaBombardeo({ duro: true }, { terreno: 'ciudad' }).arty, 6);
  assert.strictEqual(R.filaBombardeo({}, { terreno: 'ciudad', pd: true }).arty, 5);
  assert.strictEqual(R.filaBombardeo({}, { terreno: 'abierto', pd: true }).fuego, 5);
  assert.strictEqual(R.filaBombardeo({}, { terreno: 'abierto' }).arty, 3);
  const b = R.binomial(3, 0.5);
  assert.ok(Math.abs(b[0] - 0.125) < 1e-9 && Math.abs(b[2] - 0.375) < 1e-9);
});
caso('SNAFU', () => {
  assert.strictEqual(R.resultadoSnafu(2).fila.clave, 'fail');
  assert.strictEqual(R.resultadoSnafu(7).fila.clave, 'full');
  assert.strictEqual(R.resultadoSnafu(9, true).fila.clave, 'partial');
});
caso('tipos funcionales', () => {
  assert.strictEqual(R.tipoFuncional(infM), 'unprepared');
  assert.strictEqual(R.tipoFuncional({ asalto: true, av: 1, tipoAv: 'red', ar: 4 }), 'dual');
  assert.strictEqual(R.tipoFuncional(tdD), 'limited');
  assert.ok(!R.puedeSerHost({ asalto: true, av: 1, tipoAv: 'red' }));
});
console.log(n + ' casos OK');
