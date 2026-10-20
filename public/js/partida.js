// Utilidades de partida: formaciones de cada bando, saco de activaciones (2.5l y 2.5m)
// y cuaderno de órdenes (2.4). Todo se guarda en localStorage, en 'bcs-partida'.
(function () {
  'use strict';
  const esc = Fichas.esc;
  const tr = I18N.t;
  const CLAVE = 'bcs-partida';
  const $ = (id) => document.getElementById(id);

  const ORDENES = {
    hq: { corto: 'HQ', nombre: tr('Mover HQ') },
    no: { corto: '—', nombre: tr('Sin órdenes') },
    pd: { corto: 'PD', nombre: tr('Defensa preparada') },
    rec: { corto: tr('Rec'), nombre: tr('Recuperación') }
  };
  const EJEMPLO = [
    { nombre: tr('EE. UU.'), formaciones: ['CCA / 4th Armored', 'CCB / 4th Armored', '35th Infantry'] },
    { nombre: tr('Alemania'), formaciones: ['11. Panzer', '21. Panzer', '15. Panzergrenadier', '559. Volksgrenadier'] }
  ];

  function nueva() {
    return {
      version: 1, turno: 1, sig: 1,
      bandos: [{ nombre: tr('Aliados'), formaciones: [] }, { nombre: tr('Eje'), formaciones: [] }],
      saco: { modo: 'modificada', turno: 1, usadas: [], sacadas: [], fuera: [] },
      ordenes: {},
      verBando: 0,
      secreto: false, reveladas: {}
    };
  }
  let E;
  try { E = JSON.parse(Comun.leer(CLAVE)); } catch (e) { E = null; }
  if (!E || E.version !== 1) E = nueva();
  E.reveladas = E.reveladas || {};

  function guardar() {
    Comun.guardar(CLAVE, JSON.stringify(E));
    const g = $('guardado');
    g.textContent = tr('Guardado en este navegador') + ' · ' + new Date().toLocaleTimeString(I18N.en ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  const todas = () => E.bandos.flatMap((b, i) => b.formaciones.map((f) => ({ ...f, bando: i })));
  const porId = (id) => todas().find((f) => f.id === id);
  const etiquetaBando = (i) => E.bandos[i].nombre || tr(i ? 'Bando 2' : 'Bando 1');

  // ---------- Bandos y formaciones ----------
  function pintarBandos() {
    $('bandos').innerHTML = E.bandos.map((b, i) => `
      <div class="tarjeta bando bando--${i}">
        <label class="bando__nombre"><span class="sr">${tr('Nombre del bando')}</span><input type="text" value="${esc(b.nombre)}" data-bando="${i}" maxlength="30" placeholder="${tr('Nombre del bando')}"></label>
        <ul class="formaciones">${b.formaciones.map((f) => `<li><span>${esc(f.nombre)}</span><button type="button" data-quitar="${f.id}" aria-label="${tr('Quitar {x}', { x: esc(f.nombre) })}">×</button></li>`).join('') || `<li class="vacio">${tr('Sin formaciones todavía')}</li>`}</ul>
        <form class="anadir" data-bando="${i}"><input type="text" placeholder="${tr('Nueva formación (p. ej. 11. Panzer)')}" maxlength="40" aria-label="${tr('Nueva formación de {x}', { x: esc(etiquetaBando(i)) })}"><button type="submit" class="boton boton--peq">${tr('Añadir')}</button></form>
      </div>`).join('');
  }
  $('bandos').addEventListener('input', (e) => {
    if (e.target.dataset.bando === undefined || e.target.closest('form')) return;
    E.bandos[+e.target.dataset.bando].nombre = e.target.value;
    guardar();
    pintarSaco();
    pintarCuaderno();
  });
  $('bandos').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = e.target.querySelector('input'), nombre = inp.value.trim();
    if (!nombre) return;
    E.bandos[+e.target.dataset.bando].formaciones.push({ id: 'f' + E.sig++, nombre });
    guardar();
    pintar();
    $('bandos').querySelector(`form[data-bando="${e.target.dataset.bando}"] input`).focus();
  });
  $('bandos').addEventListener('click', (e) => {
    const id = e.target.dataset.quitar;
    if (!id) return;
    E.bandos.forEach((b) => { b.formaciones = b.formaciones.filter((f) => f.id !== id); });
    ['usadas', 'sacadas', 'fuera'].forEach((k) => { E.saco[k] = E.saco[k].filter((x) => x !== id); });
    Object.values(E.ordenes).forEach((t) => delete t[id]);
    guardar();
    pintar();
  });

  // ---------- Turno ----------
  function cambiarTurno(n) {
    E.turno = Math.max(1, n);
    guardar();
    pintar();
  }
  $('turno-menos').addEventListener('click', () => cambiarTurno(E.turno - 1));
  $('turno-mas').addEventListener('click', () => cambiarTurno(E.turno + 1));
  // Controles de turno dentro de cada herramienta, para no tener que subir a «Tu partida»
  document.querySelectorAll('[data-turno]').forEach((b) => b.addEventListener('click', () => cambiarTurno(E.turno + Number(b.dataset.turno))));
  $('ejemplo').addEventListener('click', () => {
    if (todas().length && !confirm(tr('¿Sustituir las formaciones actuales por el ejemplo? Se borrarán las órdenes y el saco.'))) return;
    const n = nueva();
    n.bandos = EJEMPLO.map((b) => ({ nombre: b.nombre, formaciones: b.formaciones.map((f) => ({ id: 'f' + n.sig++, nombre: f })) }));
    E = n;
    guardar();
    pintar();
  });
  $('borrar').addEventListener('click', () => {
    if (!confirm(tr('¿Borrar la partida? Se perderán las formaciones, el saco y todas las órdenes guardadas en este navegador.'))) return;
    E = nueva();
    try { localStorage.removeItem(CLAVE); } catch (e) { /* sin almacenamiento */ }
    pintar();
    $('guardado').textContent = tr('Partida borrada.');
  });

  // ---------- Saco de activaciones ----------
  function sacoAlDia() {
    if (E.saco.turno !== E.turno) Object.assign(E.saco, { turno: E.turno, usadas: [], sacadas: [], fuera: [] });
  }
  const enVaso = () => todas().filter((f) => !E.saco.usadas.includes(f.id) && !E.saco.sacadas.includes(f.id) && !E.saco.fuera.includes(f.id));
  const azar = (lista, n) => {
    const l = lista.slice();
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l.slice(0, n);
  };
  const chit = (f, extra) => `<span class="chit chit--${f.bando}${extra || ''}"><small>${esc(etiquetaBando(f.bando))}</small>${esc(f.nombre)}</span>`;

  function pintarSaco() {
    sacoAlDia();
    document.querySelectorAll('#saco-modo button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === E.saco.modo));
    const vaso = enVaso(), fuera = E.saco.fuera.map(porId).filter(Boolean);
    const cuenta = E.bandos.map((b, i) => vaso.filter((f) => f.bando === i).length);
    $('vaso').innerHTML = `<div class="vaso__cab"><strong>${vaso.length}</strong> ${tr(vaso.length === 1 ? 'chit en el vaso' : 'chits en el vaso')}<span class="muted">${cuenta.map((c, i) => `${esc(etiquetaBando(i))}: ${c}`).join(' · ')}</span></div>
      <div class="vaso__fichas">${vaso.map((f) => `<button type="button" class="chit-btn" data-apartar="${f.id}" title="${tr('Apartar este turno (por ejemplo, si aún no ha llegado)')}">${chit(f, ' chit--peq')}</button>`).join('') || `<span class="muted">${tr('Vacío')}</span>`}</div>
      ${fuera.length ? `<div class="vaso__fuera"><span class="muted">${tr('Fuera este turno:')}</span> ${fuera.map((f) => `<button type="button" class="chit-btn" data-volver="${f.id}" title="${tr('Devolver al vaso')}">${chit(f, ' chit--peq chit--fuera')}</button>`).join('')}</div>` : ''}`;

    const sac = E.saco.sacadas.map(porId).filter(Boolean);
    let mesa;
    if (!todas().length) mesa = `<p class="muted mb0">${tr('Añade las formaciones de cada bando arriba para llenar el vaso.')}</p>`;
    else if (sac.length) {
      const votos = [0, 1].map((i) => sac.filter((f) => f.bando === i).length);
      const may = votos[0] > votos[1] ? 0 : 1;
      mesa = `<p class="mesa__aviso">${tr('<b class="b{c}">{x}</b> tiene mayoría ({n} de 3) y elige qué formación se activa. Las otras dos vuelven al vaso.', { c: may, x: esc(etiquetaBando(may)), n: votos[may] })}</p>
        <div class="mesa__tres">${sac.map((f) => `<button type="button" class="chit-btn chit-btn--grande" data-activar="${f.id}">${chit(f, f.bando === may ? ' chit--mayoria' : '')}<span class="chit-btn__accion">${tr('Activar')}</span></button>`).join('')}</div>`;
    } else if (E.saco.usadas.length) {
      const u = porId(E.saco.usadas[E.saco.usadas.length - 1]);
      mesa = u ? `<p class="mesa__aviso">${tr('Se activa:')}</p><div class="mesa__tres">${chit(u, ' chit--grande')}</div>` : '';
      if (!vaso.length) mesa += `<p class="mesa__aviso" style="margin-top:14px">${tr('Todas las formaciones han actuado este turno.')}</p>`;
    } else mesa = `<p class="muted mb0">${tr(E.saco.modo === 'modificada' ? 'Saca tres chits: el bando con mayoría elige cuál activa.' : 'Saca un chit: esa formación se activa.')}</p>`;
    $('sacadas').innerHTML = mesa;

    const sacar = $('sacar');
    const finTurno = todas().length && !vaso.length && !sac.length;
    sacar.textContent = finTurno ? tr('Empezar el turno {n}', { n: E.turno + 1 }) : tr(sac.length ? 'Elige una formación' : E.saco.modo === 'modificada' && vaso.length >= 3 ? 'Sacar 3 chits' : 'Sacar 1 chit');
    sacar.disabled = !todas().length || sac.length > 0;
    $('deshacer').disabled = !sac.length && !E.saco.usadas.length;
    $('usadas').innerHTML = E.saco.usadas.map(porId).filter(Boolean).map((f) => `<li>${chit(f, ' chit--peq')}</li>`).join('') || `<li class="muted">${tr('Ninguna todavía')}</li>`;
  }
  $('saco-modo').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || E.saco.sacadas.length) return;
    E.saco.modo = b.dataset.m;
    guardar();
    pintarSaco();
  });
  $('sacar').addEventListener('click', () => {
    const vaso = enVaso();
    if (!vaso.length) { cambiarTurno(E.turno + 1); return; }
    if (E.saco.modo === 'modificada' && vaso.length >= 3) E.saco.sacadas = azar(vaso, 3).map((f) => f.id);
    else {
      const id = azar(vaso, 1)[0].id;
      E.saco.usadas.push(id);
      revelar(id, true);
    }
    guardar();
    pintarSaco();
  });
  $('sacadas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-activar]');
    if (!b) return;
    E.saco.usadas.push(b.dataset.activar);
    E.saco.sacadas = [];
    revelar(b.dataset.activar, true);
    guardar();
    pintarSaco();
  });
  $('vaso').addEventListener('click', (e) => {
    const a = e.target.closest('[data-apartar]'), v = e.target.closest('[data-volver]');
    if (a) E.saco.fuera.push(a.dataset.apartar);
    else if (v) E.saco.fuera = E.saco.fuera.filter((x) => x !== v.dataset.volver);
    else return;
    guardar();
    pintarSaco();
  });
  $('deshacer').addEventListener('click', () => {
    if (E.saco.sacadas.length) E.saco.sacadas = [];
    else E.saco.usadas.pop();
    guardar();
    pintarSaco();
  });

  // ---------- Cuaderno de órdenes ----------
  // Una orden sigue vigente hasta que se cambie (2.4f)
  function vigente(t, id) {
    for (let k = t; k >= 1; k--) {
      const o = E.ordenes[k] && E.ordenes[k][id];
      if (o) return Object.assign({}, o, { desde: k });
    }
    return { o: ['no'], ruta: '', nota: '', desde: 0 };
  }
  function fijar(id, cambio) {
    const v = vigente(E.turno, id);
    const nuevo = { o: v.o.slice(), ruta: v.ruta || '', nota: v.nota || '' };
    cambio(nuevo);
    (E.ordenes[E.turno] = E.ordenes[E.turno] || {})[id] = nuevo;
    guardar();
  }
  // Modo secreto: cada orden está tapada hasta que se revela (al activarse la formación o a mano).
  // Al empezar otro turno todas vuelven a estar tapadas.
  const revelada = (id) => (E.reveladas[E.turno] || []).includes(id);
  const oculta = (id) => E.secreto && !revelada(id);
  function revelar(id, v) {
    const l = (E.reveladas[E.turno] || []).filter((x) => x !== id);
    if (v) l.push(id);
    E.reveladas[E.turno] = l;
    guardar();
    pintarCuaderno();
  }
  const textoOrden = (v) => v.o.map((x) => ORDENES[x].nombre).join(' + ') + (v.o.includes('hq') && v.ruta ? ` (${tr('ruta')}: ${v.ruta})` : '');

  function pintarCuaderno() {
    document.querySelectorAll('[data-turno-n]').forEach((e) => { e.textContent = E.turno; });
    document.querySelectorAll('[data-turno="-1"]').forEach((b) => { b.disabled = E.turno <= 1; });
    const btn = $('ocultar');
    btn.setAttribute('aria-pressed', E.secreto);
    btn.textContent = tr(E.secreto ? 'Desactivar el modo secreto' : 'Modo secreto');
    $('revelar-todas').hidden = !E.secreto;
    $('cuaderno').classList.toggle('secreto', E.secreto);
    $('cuaderno-bando').innerHTML = E.bandos.map((b, i) => `<button type="button" data-b="${i}" aria-pressed="${E.verBando === i}">${esc(etiquetaBando(i))}</button>`).join('');
    const fs = E.bandos[E.verBando].formaciones;
    $('cuaderno-lista').innerHTML = fs.length ? fs.map((f) => {
      const v = vigente(E.turno, f.id), propia = v.desde === E.turno;
      const estado = propia ? (v.desde > 1 && JSON.stringify(vigente(E.turno - 1, f.id).o) !== JSON.stringify(v.o) ? `<span class="estado nueva">${tr('Cambiada este turno')}</span>` : `<span class="estado nueva">${tr('Anotada este turno')}</span>`)
        : v.desde ? `<span class="estado">${tr('Vigente desde el turno {n}', { n: v.desde })}</span>` : `<span class="estado">${tr('Por defecto')}</span>`;
      const tapada = oculta(f.id);
      const ojo = E.secreto ? `<button type="button" class="ojo" data-revelar="${f.id}" aria-pressed="${!tapada}">${tr(tapada ? 'Revelar' : 'Ocultar')}</button>` : '';
      return `<div class="orden${tapada ? ' orden--oculta' : ''}" data-f="${f.id}">
        <div class="orden__cab"><strong>${esc(f.nombre)}</strong>${tapada ? `<span class="estado">${tr('Orden secreta')}</span>` : estado}</div>${ojo}
        <div class="orden__botones" role="group" aria-label="${tr('Orden de {x}', { x: esc(f.nombre) })}">${Object.entries(ORDENES).map(([k, o]) => `<button type="button" class="orden-chip ${k}" data-o="${k}" aria-pressed="${v.o.includes(k)}">${o.nombre}</button>`).join('')}</div>
        <div class="orden__campos">
          ${v.o.includes('hq') ? `<label><span>${tr('Ruta del HQ')}</span><input type="text" data-campo="ruta" value="${esc(v.ruta || '')}" placeholder="${tr('Puntos de paso y hex final: por 12.08 y 15.10 hasta 18.12')}" maxlength="160"></label>` : ''}
          <label><span>${tr('Notas')}</span><input type="text" data-campo="nota" value="${esc(v.nota || '')}" placeholder="${tr('Opcional: intención, objetivos…')}" maxlength="200"></label>
        </div>
      </div>`;
    }).join('') : `<p class="muted mb0">${tr('No hay formaciones para {x}. Añádelas en «Tu partida».', { x: esc(etiquetaBando(E.verBando)) })}</p>`;

    // Historial: una columna por turno, con las órdenes de ese bando
    const ultimo = Math.max(E.turno, ...Object.keys(E.ordenes).map(Number), 1);
    const cols = Array.from({ length: ultimo }, (_, i) => i + 1);
    $('historial').innerHTML = fs.length ? `<thead><tr><th>${tr('Formación')}</th>${cols.map((t) => `<th class="num">T${t}</th>`).join('')}</tr></thead><tbody>${fs.map((f) => `<tr><td>${esc(f.nombre)}</td>${cols.map((t) => {
      const v = vigente(t, f.id), propia = v.desde === t;
      if (t === E.turno && oculta(f.id)) return `<td class="num heredada" title="${tr('Orden secreta')}">?</td>`;
      return `<td class="num${propia ? '' : ' heredada'}" title="${esc(textoOrden(v))}">${v.o.map((x) => ORDENES[x].corto).join('+')}</td>`;
    }).join('')}</tr>`).join('')}</tbody>` : '';
  }
  $('cuaderno-bando').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    E.verBando = +b.dataset.b;
    guardar();
    pintarCuaderno();
  });
  $('cuaderno-lista').addEventListener('click', (e) => {
    const r = e.target.closest('[data-revelar]');
    if (r) { revelar(r.dataset.revelar, !revelada(r.dataset.revelar)); return; }
    const b = e.target.closest('[data-o]');
    if (!b) return;
    const id = b.closest('.orden').dataset.f, k = b.dataset.o;
    fijar(id, (n) => {
      if (k === 'hq' || k === 'no') n.o = [k];
      else if (n.o.includes('hq') || n.o.includes('no')) n.o = [k];
      else {
        // Defensa preparada y recuperación son la única combinación permitida (2.4a)
        n.o = n.o.includes(k) ? n.o.filter((x) => x !== k) : n.o.concat(k);
        if (!n.o.length) n.o = ['no'];
      }
      n.o.sort((a, c) => Object.keys(ORDENES).indexOf(a) - Object.keys(ORDENES).indexOf(c));
    });
    pintarCuaderno();
  });
  $('cuaderno-lista').addEventListener('input', (e) => {
    const c = e.target.dataset.campo;
    if (!c) return;
    fijar(e.target.closest('.orden').dataset.f, (n) => { n[c] = e.target.value; });
    const est = e.target.closest('.orden').querySelector('.estado');
    est.className = 'estado nueva';
    est.textContent = tr('Anotada este turno');
  });
  $('ocultar').addEventListener('click', () => {
    E.secreto = !E.secreto;
    if (E.secreto) E.reveladas[E.turno] = [];
    guardar();
    pintarCuaderno();
  });
  $('revelar-todas').addEventListener('click', () => {
    const fs = E.bandos[E.verBando].formaciones.map((f) => f.id);
    const todas = fs.every(revelada);
    E.reveladas[E.turno] = (E.reveladas[E.turno] || []).filter((x) => !fs.includes(x)).concat(todas ? [] : fs);
    guardar();
    pintarCuaderno();
  });
  $('copiar').addEventListener('click', async (e) => {
    const txt = [tr('Órdenes · turno {n}', { n: E.turno })].concat(E.bandos.flatMap((b, i) => b.formaciones.length ? ['', etiquetaBando(i)].concat(b.formaciones.map((f) => {
      const v = vigente(E.turno, f.id);
      return `- ${f.nombre}: ${textoOrden(v)}${v.nota ? ' · ' + v.nota : ''}`;
    })) : [])).join('\n');
    const btn = e.currentTarget, antes = btn.textContent;
    try { await navigator.clipboard.writeText(txt); btn.textContent = tr('Copiadas'); } catch (err) { prompt(tr('Copia las órdenes:'), txt); }
    setTimeout(() => { btn.textContent = antes; }, 1600);
  });
  $('vaciar-ordenes').addEventListener('click', () => {
    if (!confirm(tr('¿Borrar las órdenes de todos los turnos y de los dos bandos?'))) return;
    E.ordenes = {};
    guardar();
    pintarCuaderno();
  });

  function pintar() {
    $('turno').textContent = E.turno;
    pintarBandos();
    pintarSaco();
    pintarCuaderno();
  }
  pintar();
  $('guardado').textContent = tr(todas().length ? 'Partida recuperada de este navegador.' : 'Se guardará solo en este navegador.');
})();
