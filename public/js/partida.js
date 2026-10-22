// Utilidades de partida: formaciones de cada bando, saco de activaciones (2.5l y 2.5m)
// y cuaderno de órdenes (2.4) con sobres lacrados y un despacho a pantalla completa.
// Todo se guarda en localStorage, en 'bcs-partida'. Los efectos están en efectos.js
// y el HTML de sobres y cartas en sobres.js.
(function () {
  'use strict';
  const esc = Fichas.esc;
  const tr = I18N.t;
  const CLAVE = 'bcs-partida';
  const $ = (id) => document.getElementById(id);
  const FX = Efectos;
  const COLOR = ['#4f8fd8', '#d0573f'];

  const ORDENES = {
    hq: { corto: 'HQ', nombre: tr('Mover HQ') },
    no: { corto: '—', nombre: tr('Sin órdenes') },
    pd: { corto: 'PD', nombre: tr('Defensa preparada') },
    rec: { corto: tr('Rec'), nombre: tr('Recuperación') }
  };
  const NOMBRES = Object.fromEntries(Object.entries(ORDENES).map(([k, o]) => [k, o.nombre]));
  // Juegos y escenarios (juegos.js): las formaciones con chit de activación que juegan en cada uno
  const JG = Juegos.JUEGOS;
  const RAIZ = I18N.raiz;
  const icono = (f, cls) => f.icono ? `<img class="${cls || 'f-icono'}" src="${RAIZ + f.icono}" alt="" draggable="false">` : '';
  function pintarEscenarios() {
    const j = JG[$('juego').value] || JG[Juegos.ORDEN[0]];
    $('escenario').innerHTML = j.escenarios.map((e, i) => `<option value="${i}">${esc(tr('{e} ({a} y {b} formaciones)', { e: e.nombre, a: e.bandos[0].formaciones.length, b: e.bandos[1].formaciones.length }))}</option>`).join('');
  }
  $('juego').innerHTML = Juegos.ORDEN.map((id) => `<option value="${id}">${esc(JG[id].nombre)}</option>`).join('');
  $('juego').addEventListener('change', pintarEscenarios);
  pintarEscenarios();

  function nueva() {
    return {
      version: 1, turno: 1, sig: 1,
      bandos: [{ nombre: tr('Aliados'), formaciones: [] }, { nombre: tr('Eje'), formaciones: [] }],
      saco: { modo: 'modificada', recipiente: 'bolsa', turno: 1, usadas: [], sacadas: [], fuera: [] },
      ordenes: {},
      verBando: 0,
      secreto: false, reveladas: {}, borradores: {}
    };
  }
  let E;
  try { E = JSON.parse(Comun.leer(CLAVE)); } catch (e) { E = null; }
  if (!E || E.version !== 1) E = nueva();
  E.reveladas = E.reveladas || {};
  E.borradores = E.borradores || {};
  E.saco.recipiente = E.saco.recipiente || 'bolsa';

  function guardar() {
    Comun.guardar(CLAVE, JSON.stringify(E));
    const g = $('guardado');
    g.textContent = tr('Guardado en este navegador') + ' · ' + new Date().toLocaleTimeString(I18N.en ? 'en-GB' : 'es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  const todas = () => E.bandos.flatMap((b, i) => b.formaciones.map((f) => ({ ...f, bando: i })));
  const porId = (id) => todas().find((f) => f.id === id);
  const etiquetaBando = (i) => E.bandos[i].nombre || tr(i ? 'Bando 2' : 'Bando 1');

  // ---------- Sonido ----------
  function pintarSonido() {
    document.querySelectorAll('[data-sonido]').forEach((b) => {
      b.setAttribute('aria-pressed', FX.sonido());
      b.title = tr(FX.sonido() ? 'Silenciar los efectos de sonido' : 'Activar los efectos de sonido');
    });
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-sonido]')) return;
    FX.sonido(!FX.sonido());
    pintarSonido();
    if (FX.sonido()) FX.sonar('clac');
  });

  // ---------- Bandos y formaciones ----------
  function pintarBandos() {
    $('bandos').innerHTML = E.bandos.map((b, i) => `
      <div class="tarjeta bando bando--${i}">
        <label class="bando__nombre"><span class="sr">${tr('Nombre del bando')}</span><input type="text" value="${esc(b.nombre)}" data-bando="${i}" maxlength="30" placeholder="${tr('Nombre del bando')}"></label>
        <ul class="formaciones">${b.formaciones.map((f) => `<li${f.reserva ? ' class="reserva"' : ''}><span class="f-nombre">${icono(f)}${esc(f.nombre)}</span><span class="f-ctl"><button type="button" class="f-juego" data-juego="${f.id}" aria-pressed="${!f.reserva}" title="${tr(f.reserva ? 'Meter en el saco: ya ha entrado en juego' : 'Sacar del saco hasta que entre en juego')}">${tr(f.reserva ? 'Fuera' : 'En juego')}</button><button type="button" data-quitar="${f.id}" aria-label="${tr('Quitar {x}', { x: esc(f.nombre) })}">×</button></span></li>`).join('') || `<li class="vacio">${tr('Sin formaciones todavía')}</li>`}</ul>
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
    if (e.target.dataset.juego) { meterEnJuego(e.target.dataset.juego); return; }
    const id = e.target.dataset.quitar;
    if (!id) return;
    E.bandos.forEach((b) => { b.formaciones = b.formaciones.filter((f) => f.id !== id); });
    ['usadas', 'sacadas', 'fuera'].forEach((k) => { E.saco[k] = E.saco[k].filter((x) => x !== id); });
    Object.values(E.ordenes).forEach((t) => delete t[id]);
    guardar();
    pintar();
  });

  // Formaciones que aún no han entrado en juego (refuerzos): fuera del saco y del cuaderno
  // hasta que se meten. A diferencia de «apartar este turno», dura hasta que se cambie.
  function meterEnJuego(id, v) {
    E.bandos.forEach((b) => b.formaciones.forEach((f) => { if (f.id === id) f.reserva = v === undefined ? !f.reserva : !v; }));
    if (E.saco.sacadas.includes(id)) E.saco.sacadas = [];         // los sacados vuelven al vaso
    E.saco.fuera = E.saco.fuera.filter((x) => x !== id);
    guardar();
    pintar();
  }

  // ---------- Turno ----------
  function cambiarTurno(n) {
    E.turno = Math.max(1, n);
    guardar();
    pintar();
  }
  $('turno-menos').addEventListener('click', () => cambiarTurno(E.turno - 1));
  $('turno-mas').addEventListener('click', () => cambiarTurno(E.turno + 1));
  // Controles de turno dentro de cada herramienta (y del despacho), para no tener que subir a «Tu partida»
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-turno]');
    if (b && !b.disabled) cambiarTurno(E.turno + Number(b.dataset.turno));
  });
  $('ejemplo').addEventListener('click', () => {
    if (todas().length && !confirm(tr('¿Sustituir las formaciones actuales por las del escenario? Se borrarán las órdenes y el saco.'))) return;
    const n = nueva();
    const esc0 = JG[$('juego').value].escenarios[+$('escenario').value];
    // El icono se guarda sin la raíz del idioma, para que sirva en las dos versiones
    n.bandos = esc0.bandos.map((b) => ({ nombre: b.nombre, formaciones: b.formaciones.map((f) => ({ id: 'f' + n.sig++, nombre: f.nombre, icono: f.icono ? f.icono.slice(RAIZ.length) : null })) }));
    n.saco.recipiente = E.saco.recipiente;
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
  const enJuego = () => todas().filter((f) => !f.reserva);
  const enVaso = () => enJuego().filter((f) => !E.saco.usadas.includes(f.id) && !E.saco.sacadas.includes(f.id) && !E.saco.fuera.includes(f.id));
  const azar = (lista, n) => {
    const l = lista.slice();
    for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; }
    return l.slice(0, n);
  };
  // data-fly marca cada chit con su formación y su sitio, para que vuele al cambiar de sitio
  const chit = (f, extra, zona) => `<span class="chit chit--${f.bando}${f.icono ? ' chit--img' : ''}${extra || ''}"${zona ? ` data-fly="${f.id}" data-zona="${zona}"` : ''}>${icono(f, 'chit__img')}<span class="chit__txt"><small>${esc(etiquetaBando(f.bando))}</small>${esc(f.nombre)}</span></span>`;
  const dorso = (b) => `<span class="dorso dorso--${b}"><span>BCS</span></span>`;

  // El recipiente: el fondo de la boca, el montón de chits que asoman y el cuerpo por delante
  const RECIPIENTE = {
    bolsa: {
      atras: '<ellipse cx="100" cy="64" rx="66" ry="17" fill="#160d0b"/><ellipse cx="100" cy="60" rx="58" ry="11" fill="#000" opacity=".55"/>',
      delante: `<defs><radialGradient id="tela" cx="40%" cy="35%" r="80%"><stop offset="0" stop-color="#9b3a2e"/><stop offset=".6" stop-color="#6b2119"/><stop offset="1" stop-color="#3d110c"/></radialGradient><pattern id="trama" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 4L4 0" stroke="#000" stroke-opacity=".12"/></pattern></defs>
        <path d="M34 64 Q100 88 166 64 C176 78 168 96 176 112 C196 150 186 204 100 210 C14 204 4 150 24 112 C32 96 24 78 34 64Z" fill="url(#tela)"/>
        <path d="M34 64 Q100 88 166 64 C176 78 168 96 176 112 C196 150 186 204 100 210 C14 204 4 150 24 112 C32 96 24 78 34 64Z" fill="url(#trama)"/>
        <path d="M60 96c-6 30-10 70 2 106M100 92c0 34-2 76 0 116M140 96c6 30 10 70-2 106M80 94c-2 20-8 50-4 70M122 94c2 20 8 50 4 70" fill="none" stroke="#2a0906" stroke-width="2.4" opacity=".35" stroke-linecap="round"/>
        <path d="M72 100c-4 26-6 60 4 98M128 100c4 26 6 60-4 98" fill="none" stroke="#e08b72" stroke-width="1.6" opacity=".25" stroke-linecap="round"/>
        <path d="M30 96 Q100 116 170 96" fill="none" stroke="#d9b36a" stroke-width="5" stroke-linecap="round"/>
        <path d="M30 96 Q100 116 170 96" fill="none" stroke="#7a5a22" stroke-width="5" stroke-dasharray="3 5" stroke-linecap="round"/>
        <path d="M150 103c10 8 14 22 8 40M156 104c14 6 22 18 22 36" fill="none" stroke="#d9b36a" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="158" cy="144" r="5" fill="#b8913f"/><circle cx="178" cy="141" r="5" fill="#b8913f"/>
        <path d="M34 64 Q100 88 166 64" fill="none" stroke="#c4614d" stroke-width="3" opacity=".6"/>`
    },
    taza: {
      atras: '<ellipse cx="100" cy="58" rx="74" ry="20" fill="#d8d2c4"/><ellipse cx="100" cy="60" rx="66" ry="15" fill="#1c1a17"/>',
      delante: `<defs><linearGradient id="loza" x1="0" x2="1"><stop offset="0" stop-color="#9aa39b"/><stop offset=".25" stop-color="#e9ebe3"/><stop offset=".55" stop-color="#fbfbf6"/><stop offset="1" stop-color="#8a938b"/></linearGradient></defs>
        <path d="M170 92c34-4 38 62 2 74" fill="none" stroke="#c9ccc2" stroke-width="15" stroke-linecap="round"/>
        <path d="M170 92c34-4 38 62 2 74" fill="none" stroke="#f4f4ee" stroke-width="5" stroke-linecap="round" opacity=".7"/>
        <path d="M26 58 Q100 92 174 58 L164 184 Q100 214 36 184Z" fill="url(#loza)"/>
        <path d="M26 58 Q100 92 174 58" fill="none" stroke="#fff" stroke-width="3"/>
        <path d="M36 166 Q100 192 164 166" fill="none" stroke="#3f6b45" stroke-width="5"/>
        <path d="M33 90 Q100 120 167 90" fill="none" stroke="#3f6b45" stroke-width="3"/>
        <g transform="translate(100 134)" fill="none" stroke="#3f6b45" stroke-width="3"><circle r="17"/><path d="M0-10l3 6.6 7.2.8-5.4 4.9 1.5 7.1L0 5.8l-6.3 3.6 1.5-7.1-5.4-4.9 7.2-.8z" fill="#3f6b45" stroke="none"/></g>`
    }
  };
  // Sitio de cada chit en el montón (fijo para cada formación, para que no baile al repintar)
  function sitio(id, i) {
    let h = 7;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { x: 8 + ((i * 41 + (h % 13)) % 70), y: (i % 3) * 6 + (h % 5), g: (h % 56) - 28 };
  }
  function htmlRecipiente(vaso) {
    const R = RECIPIENTE[E.saco.recipiente] || RECIPIENTE.bolsa;
    const monton = vaso.slice(0, 14).map((f, i) => {
      const s = sitio(f.id, i);
      return `<span class="monton__chit chit--${f.bando}" data-fly="${f.id}" data-zona="vaso" style="left:${s.x}%;top:${s.y}px;--g:${s.g}deg">${icono(f, 'monton__img')}</span>`;
    }).join('');
    return `<div class="recipiente recipiente--${E.saco.recipiente}" id="recipiente" role="img" aria-label="${tr(vaso.length === 1 ? 'Un chit en el vaso' : '{n} chits en el vaso', { n: vaso.length })}">
      <svg class="recipiente__atras" viewBox="0 0 200 220" aria-hidden="true">${R.atras}</svg>
      <div class="monton" id="boca">${monton}</div>
      <svg class="recipiente__delante" viewBox="0 0 200 220" aria-hidden="true">${R.delante}</svg>
      <span class="recipiente__cuenta"><strong>${vaso.length}</strong></span>
    </div>`;
  }

  function pintarSaco() {
    const antes = listo ? capturar() : null;
    sacoAlDia();
    document.querySelectorAll('#saco-modo button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === E.saco.modo));
    document.querySelectorAll('#saco-recipiente button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.r === E.saco.recipiente));
    const vaso = enVaso(), fuera = E.saco.fuera.map(porId).filter(Boolean), reserva = todas().filter((f) => f.reserva);
    const cuenta = E.bandos.map((b, i) => vaso.filter((f) => f.bando === i).length);
    $('vaso').innerHTML = `${htmlRecipiente(vaso)}
      <div class="vaso__cab"><span><strong>${vaso.length}</strong> ${tr(vaso.length === 1 ? 'chit en el vaso' : 'chits en el vaso')}</span><span class="muted">${cuenta.map((c, i) => `${esc(etiquetaBando(i))}: ${c}`).join(' · ')}</span></div>
      <details class="vaso__dentro"${abiertoDentro ? ' open' : ''}><summary>${tr('Lo que hay dentro')}</summary><div class="vaso__fichas">${vaso.map((f) => `<button type="button" class="chit-btn" data-apartar="${f.id}" title="${tr('Apartar este turno (por ejemplo, si aún no ha llegado)')}">${chit(f, ' chit--peq')}</button>`).join('') || `<span class="muted">${tr('Vacío')}</span>`}</div></details>
      ${fuera.length ? `<div class="vaso__fuera"><span class="muted">${tr('Fuera este turno:')}</span> ${fuera.map((f) => `<button type="button" class="chit-btn" data-volver="${f.id}" title="${tr('Devolver al vaso')}">${chit(f, ' chit--peq chit--fuera', 'fuera')}</button>`).join('')}</div>` : ''}
      ${reserva.length ? `<div class="vaso__fuera"><span class="muted">${tr('Aún no han entrado en juego:')}</span> ${reserva.map((f) => `<button type="button" class="chit-btn" data-entrar="${f.id}" title="${tr('Meter en el saco: ya ha entrado en juego')}">${chit(f, ' chit--peq chit--fuera', 'reserva')}</button>`).join('')}</div>` : ''}`;

    const sac = E.saco.sacadas.map(porId).filter(Boolean);
    let mesa;
    if (!enJuego().length) mesa = `<p class="muted mb0">${tr('Añade las formaciones de cada bando arriba para llenar el vaso.')}</p>`;
    else if (sac.length) {
      const votos = [0, 1].map((i) => sac.filter((f) => f.bando === i).length);
      const may = votos[0] > votos[1] ? 0 : 1;
      mesa = `<p class="mesa__aviso aparece">${tr('<b class="b{c}">{x}</b> tiene mayoría ({n} de 3) y elige qué formación se activa. Las otras dos vuelven al vaso.', { c: may, x: esc(etiquetaBando(may)), n: votos[may] })}</p>
        <div class="mesa__tres">${sac.map((f) => `<button type="button" class="chit-btn chit-btn--grande" data-activar="${f.id}">${chit(f, f.bando === may ? ' chit--mayoria' : '', 'mesa')}<span class="chit-btn__accion">${tr('Activar')}</span></button>`).join('')}</div>`;
    } else if (E.saco.usadas.length) {
      const u = porId(E.saco.usadas[E.saco.usadas.length - 1]);
      const sobre = u && E.secreto && !revelada(u.id) ? `<button type="button" class="boton boton--peq boton-sobre" data-abrir="${u.id}">${tr('Abrir su sobre de órdenes')}</button>` : '';
      mesa = u ? `<p class="mesa__aviso">${tr('Se activa:')}</p><div class="mesa__tres mesa__activa">${chit(u, ' chit--grande chit--activa', 'activa')}</div>${sobre}` : '';
      if (!vaso.length) mesa += `<p class="mesa__aviso mesa__fin aparece">${tr('Todas las formaciones han actuado este turno.')}</p>`;
    } else mesa = `<p class="muted mb0">${tr(E.saco.modo === 'modificada' ? 'Saca tres chits: el bando con mayoría elige cuál activa.' : 'Saca un chit: esa formación se activa.')}</p>`;
    $('sacadas').innerHTML = mesa;

    const sacar = $('sacar');
    const finTurno = enJuego().length && !vaso.length && !sac.length;
    sacar.textContent = finTurno ? tr('Empezar el turno {n}', { n: E.turno + 1 }) : tr(sac.length ? 'Elige una formación' : E.saco.modo === 'modificada' && vaso.length >= 3 ? 'Sacar 3 chits' : 'Sacar 1 chit');
    sacar.disabled = !enJuego().length || sac.length > 0 || agitando;
    $('deshacer').disabled = (!sac.length && !E.saco.usadas.length) || agitando;
    $('usadas').innerHTML = E.saco.usadas.map(porId).filter(Boolean).map((f) => `<li>${chit(f, ' chit--peq', 'usada')}</li>`).join('') || `<li class="muted">${tr('Ninguna todavía')}</li>`;
    if (antes) animarCambios(antes);
  }
  let listo = false, agitando = false, abiertoDentro = false;
  $('vaso').addEventListener('toggle', (e) => { if (e.target.matches('.vaso__dentro')) abiertoDentro = e.target.open; }, true);

  // Animación de los cambios: dónde estaba cada chit antes de repintar y dónde está ahora
  function capturar() {
    const els = [...$('saco').querySelectorAll('[data-fly]')].map((el) => ({ id: el.dataset.fly, zona: el.dataset.zona, r: el.getBoundingClientRect(), html: el.outerHTML }));
    const boca = $('boca');
    return { els, vaso: new Set(enVaso().map((f) => f.id)), boca: boca ? boca.getBoundingClientRect() : null };
  }
  const PRIORIDAD = { activa: 0, mesa: 1, usada: 2, fuera: 3, reserva: 3, vaso: 4 };
  function animarCambios(antes) {
    if (FX.quieto()) return;
    const ahora = [...$('saco').querySelectorAll('[data-fly]')].map((el) => ({ id: el.dataset.fly, zona: el.dataset.zona, el }));
    const k = (x) => x.id + '@' + x.zona;
    const viejas = new Set(antes.els.map(k)), nuevas = new Set(ahora.map(k));
    const idos = antes.els.filter((x) => !nuevas.has(k(x)));
    const llegan = ahora.filter((x) => !viejas.has(k(x))).sort((a, b) => PRIORIDAD[a.zona] - PRIORIDAD[b.zona]);
    const vasoAhora = new Set(enVaso().map((f) => f.id));
    const bocaR = () => { const b = $('boca'); return b ? b.getBoundingClientRect() : antes.boca; };
    const bocaChit = (r) => { const b = bocaR(); return b && new DOMRect(b.left + b.width / 2 - r.width * 0.2, b.top + 6, r.width * 0.4, r.height * 0.4); };
    let nSaca = 0, nMete = 0, nOtros = 0;
    const metidos = [];
    for (const n of llegan) {
      const i = idos.findIndex((o) => o.id === n.id && !o.usado);
      const origen = i >= 0 ? idos[i] : null;
      const deVaso = (origen && origen.zona === 'vaso') || (!origen && antes.vaso.has(n.id) && n.zona !== 'vaso');
      if (!origen && !deVaso) { n.el.classList.add('aterriza'); continue; }
      if (origen) origen.usado = true;
      const hasta = n.el.getBoundingClientRect();
      const desde = origen ? origen.r : bocaChit(hasta);
      if (!desde) continue;
      n.el.style.visibility = 'hidden';
      let p;
      if (n.zona === 'vaso') {
        // vuelve al saco: entra por la boca
        p = FX.volar({ html: origen.html, desde, hasta, dur: 620, arco: 90, retraso: nMete++ * 90, escalaFin: 0.7, clase: 'vuelo--mete' });
        metidos.push(p.then(() => FX.sonar('plop')));
      } else if (deVaso) {
        const d = nSaca++ * 260;
        p = FX.volar({ html: n.el.outerHTML, desde, hasta, dur: 760, arco: 130, giro: -40 + Math.random() * 80, voltear: true, dorso: dorso(porId(n.id) ? porId(n.id).bando : 0), escalaIni: 0.35, retraso: d });
        p.then(() => {
          FX.sonar('clac');
          const r = n.el.getBoundingClientRect(), f = porId(n.id);
          FX.chispas(r.left + r.width / 2, r.top + r.height / 2, { color: f ? COLOR[f.bando] : COLOR[0], n: 12 });
        });
      } else {
        if (n.zona === 'activa') FX.sonar('activar');
        p = FX.volar({ html: origen.html, desde, hasta, dur: 560, arco: 50, retraso: nOtros++ * 60 });
      }
      p.then(() => { n.el.style.visibility = ''; n.el.classList.add('aterriza'); });
    }
    // Lo que se fue sin aparecer en otro sitio y ha vuelto al vaso (sin hueco en el montón)
    for (const o of idos) {
      if (o.usado || o.zona === 'vaso' || !vasoAhora.has(o.id)) continue;
      const desde = o.r, b = bocaR();
      if (!b) continue;
      const hasta = new DOMRect(b.left + b.width / 2 - o.r.width / 2, b.top, o.r.width, o.r.height);
      metidos.push(FX.volar({ html: o.html, desde, hasta, dur: 620, arco: 90, retraso: nMete++ * 90, escalaFin: 0.3, clase: 'vuelo--mete' }).then(() => FX.sonar('plop')));
    }
    if (metidos.length) Promise.all(metidos).then(() => sacudir(metidos.length >= 3));
  }
  function sacudir(fuerte) {
    const r = $('recipiente');
    if (!r) return;
    r.classList.remove('agita', 'bote');
    void r.offsetWidth;
    r.classList.add(fuerte ? 'agita' : 'bote');
    if (fuerte) FX.sonar('sacudir', 0, 10, 0.4);
  }

  $('saco-modo').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || E.saco.sacadas.length) return;
    E.saco.modo = b.dataset.m;
    guardar();
    pintarSaco();
  });
  $('saco-recipiente').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    E.saco.recipiente = b.dataset.r;
    guardar();
    pintarSaco();
    sacudir(true);
  });
  $('sacar').addEventListener('click', async () => {
    const vaso = enVaso();
    if (!vaso.length) { cambiarTurno(E.turno + 1); return; }
    if (agitando) return;
    // Primero se agita el saco; luego salen los chits
    agitando = true;
    $('sacar').disabled = true;
    const r = $('recipiente');
    if (r && !FX.quieto()) {
      r.classList.remove('agita', 'bote');
      void r.offsetWidth;
      r.classList.add('agita');
      FX.sonar('sacudir');
      await FX.espera(620);
    }
    agitando = false;
    if (E.saco.modo === 'modificada' && vaso.length >= 3) E.saco.sacadas = azar(vaso, 3).map((f) => f.id);
    else E.saco.usadas.push(azar(vaso, 1)[0].id);
    guardar();
    pintarSaco();
    pintarCuaderno();
  });
  $('sacadas').addEventListener('click', (e) => {
    const s = e.target.closest('[data-abrir]');
    if (s) { Despacho.abrir(s.dataset.abrir, { abrirSobre: true }); return; }
    const b = e.target.closest('[data-activar]');
    if (!b) return;
    E.saco.usadas.push(b.dataset.activar);
    E.saco.sacadas = [];
    guardar();
    pintarSaco();
    pintarCuaderno();
  });
  $('vaso').addEventListener('click', (e) => {
    const a = e.target.closest('[data-apartar]'), v = e.target.closest('[data-volver]'), en = e.target.closest('[data-entrar]');
    if (en) { meterEnJuego(en.dataset.entrar, true); return; }
    if (a) E.saco.fuera.push(a.dataset.apartar);
    else if (v) E.saco.fuera = E.saco.fuera.filter((x) => x !== v.dataset.volver);
    else if (e.target.closest('#recipiente')) { sacudir(true); return; }
    else return;
    guardar();
    pintarSaco();
  });
  $('deshacer').addEventListener('click', () => {
    if (E.saco.sacadas.length) E.saco.sacadas = [];
    else E.saco.usadas.pop();
    guardar();
    pintarSaco();
    pintarCuaderno();
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
  function elegirOrden(id, k) {
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
  }
  // Modo secreto: cada orden va en un sobre. Por defecto está lacrado; mientras se redacta es
  // un borrador, y al abrirlo (a mano o cuando el saco activa la formación) queda revelada.
  // Al empezar otro turno todos los sobres vuelven a estar lacrados.
  const lista = (m, id) => (m[E.turno] || []).includes(id);
  function poner(m, id, v) {
    const l = (m[E.turno] || []).filter((x) => x !== id);
    if (v) l.push(id);
    m[E.turno] = l;
  }
  const revelada = (id) => lista(E.reveladas, id);
  const enBorrador = (id) => lista(E.borradores, id);
  const oculta = (id) => E.secreto && !revelada(id);
  const estadoSobre = (id) => !E.secreto ? 'abierta' : enBorrador(id) ? 'borrador' : revelada(id) ? 'revelada' : 'lacrada';
  const porAbrir = (id) => E.secreto && E.saco.turno === E.turno && E.saco.usadas.includes(id) && !revelada(id) && !enBorrador(id);
  const textoOrden = (v) => v.o.map((x) => ORDENES[x].nombre).join(' + ') + (v.o.includes('hq') && v.ruta ? ` (${tr('ruta')}: ${v.ruta})` : '');
  const enJuegoBando = (b) => E.bandos[b].formaciones.filter((f) => !f.reserva).map((f) => ({ ...f, bando: b }));

  function miniatura(f, n) {
    const st = estadoSobre(f.id);
    const v = vigente(E.turno, f.id);
    const vista = st === 'lacrada' ? Sobres.sobre({ f, bando: etiquetaBando(f.bando), turno: E.turno, mini: true })
      : st === 'borrador' ? `<span class="hoja-mini hoja-mini--borrador"><b>${tr('Borrador')}</b><i></i><i></i><i></i></span>`
        : `<span class="hoja-mini"><small>${tr('Orden n.º')} ${E.turno}/${String(n + 1).padStart(2, '0')}</small><b>${esc(textoOrden(v))}</b>${v.nota ? `<em>${esc(v.nota)}</em>` : '<i></i><i></i>'}</span>`;
    const txt = { lacrada: tr(porAbrir(f.id) ? '¡Activada! Abre su sobre' : 'Lacrada'), borrador: tr('En redacción'), revelada: tr('Abierta') }[st];
    return `<button type="button" class="sobre-mini sobre-mini--${st}${porAbrir(f.id) ? ' sobre-mini--activa' : ''}" data-abrir="${f.id}" aria-label="${esc(f.nombre)}: ${txt}">
      <span class="sobre-mini__vista">${vista}</span>
      <span class="sobre-mini__pie">${icono(f)}<span><strong>${esc(f.nombre)}</strong><small>${txt}</small></span></span>
    </button>`;
  }

  function pintarCuaderno() {
    document.querySelectorAll('[data-turno-n]').forEach((e) => { e.textContent = E.turno; });
    document.querySelectorAll('[data-turno="-1"]').forEach((b) => { b.disabled = E.turno <= 1; });
    const btn = $('ocultar');
    btn.setAttribute('aria-pressed', E.secreto);
    btn.textContent = tr(E.secreto ? 'Desactivar el modo secreto' : 'Modo secreto: sobres lacrados');
    $('revelar-todas').hidden = !E.secreto;
    $('cuaderno').classList.toggle('secreto', E.secreto);
    $('cuaderno-bando').innerHTML = E.bandos.map((b, i) => `<button type="button" data-b="${i}" aria-pressed="${E.verBando === i}">${esc(etiquetaBando(i))}</button>`).join('');
    const fs = enJuegoBando(E.verBando);
    const nRes = E.bandos[E.verBando].formaciones.length - fs.length;
    $('lacrar-todas').hidden = !E.secreto || !fs.some((f) => enBorrador(f.id));
    $('cuaderno-reserva').textContent = nRes ? tr(nRes === 1 ? '1 formación aún no ha entrado en juego y no sale aquí.' : '{n} formaciones aún no han entrado en juego y no salen aquí.', { n: nRes }) : '';
    $('cuaderno-reserva').hidden = !nRes;
    if (!fs.length) $('cuaderno-lista').innerHTML = `<p class="muted mb0">${tr('No hay formaciones para {x}. Añádelas en «Tu partida».', { x: esc(etiquetaBando(E.verBando)) })}</p>`;
    else if (E.secreto) $('cuaderno-lista').innerHTML = `<div class="sobres">${fs.map(miniatura).join('')}</div>`;
    else $('cuaderno-lista').innerHTML = fs.map((f) => {
      const v = vigente(E.turno, f.id), propia = v.desde === E.turno;
      const estado = propia ? (v.desde > 1 && JSON.stringify(vigente(E.turno - 1, f.id).o) !== JSON.stringify(v.o) ? `<span class="estado nueva">${tr('Cambiada este turno')}</span>` : `<span class="estado nueva">${tr('Anotada este turno')}</span>`)
        : v.desde ? `<span class="estado">${tr('Vigente desde el turno {n}', { n: v.desde })}</span>` : `<span class="estado">${tr('Por defecto')}</span>`;
      return `<div class="orden" data-f="${f.id}">
        <div class="orden__cab">${icono(f, 'orden__icono')}<strong>${esc(f.nombre)}</strong>${estado}</div>
        <div class="orden__botones" role="group" aria-label="${tr('Orden de {x}', { x: esc(f.nombre) })}">${Object.entries(ORDENES).map(([k, o]) => `<button type="button" class="orden-chip ${k}" data-o="${k}" aria-pressed="${v.o.includes(k)}">${o.nombre}</button>`).join('')}</div>
        <div class="orden__campos">
          ${v.o.includes('hq') ? `<label><span>${tr('Ruta del HQ')}</span><input type="text" data-campo="ruta" value="${esc(v.ruta || '')}" placeholder="${tr('Puntos de paso y hex final: por 12.08 y 15.10 hasta 18.12')}" maxlength="160"></label>` : ''}
          <label><span>${tr('Notas')}</span><input type="text" data-campo="nota" value="${esc(v.nota || '')}" placeholder="${tr('Opcional: intención, objetivos…')}" maxlength="200"></label>
        </div>
      </div>`;
    }).join('');

    // Historial: una columna por turno, con las órdenes de ese bando
    const ultimo = Math.max(E.turno, ...Object.keys(E.ordenes).map(Number), 1);
    const cols = Array.from({ length: ultimo }, (_, i) => i + 1);
    const fh = E.bandos[E.verBando].formaciones;   // en el historial también las que están fuera
    $('historial').innerHTML = fh.length ? `<thead><tr><th>${tr('Formación')}</th>${cols.map((t) => `<th class="num">T${t}</th>`).join('')}</tr></thead><tbody>${fh.map((f) => `<tr><td><span class="f-nombre">${icono(f)}${esc(f.nombre)}</span></td>${cols.map((t) => {
      const v = vigente(t, f.id), propia = v.desde === t;
      if (t === E.turno && oculta(f.id)) return `<td class="num heredada" title="${tr('Orden secreta')}">?</td>`;
      return `<td class="num${propia ? '' : ' heredada'}" title="${esc(textoOrden(v))}">${v.o.map((x) => ORDENES[x].corto).join('+')}</td>`;
    }).join('')}</tr>`).join('')}</tbody>` : '';
    Despacho.pintar();
  }
  $('cuaderno-bando').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    E.verBando = +b.dataset.b;
    guardar();
    pintarCuaderno();
  });
  $('cuaderno-lista').addEventListener('click', (e) => {
    const s = e.target.closest('[data-abrir]');
    if (s) { Despacho.abrir(s.dataset.abrir, { abrirSobre: porAbrir(s.dataset.abrir) }); return; }
    const b = e.target.closest('[data-o]');
    if (!b) return;
    elegirOrden(b.closest('.orden').dataset.f, b.dataset.o);
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
  // Al pasar al modo secreto, las órdenes de este turno quedan como borradores para redactarlas y lacrarlas
  function ponerSecreto(v) {
    E.secreto = v;
    if (v) {
      E.reveladas[E.turno] = [];
      E.borradores[E.turno] = enJuego().map((f) => f.id);
    }
    guardar();
    pintarCuaderno();
    pintarSaco();
  }
  $('ocultar').addEventListener('click', () => ponerSecreto(!E.secreto));
  $('revelar-todas').addEventListener('click', () => {
    const fs = enJuegoBando(E.verBando).map((f) => f.id);
    const abiertas = fs.every(revelada);
    E.reveladas[E.turno] = (E.reveladas[E.turno] || []).filter((x) => !fs.includes(x)).concat(abiertas ? [] : fs);
    E.borradores[E.turno] = (E.borradores[E.turno] || []).filter((x) => !fs.includes(x));
    guardar();
    pintarCuaderno();
    pintarSaco();
  });
  $('lacrar-todas').addEventListener('click', () => lacrarTodas());
  function lacrarTodas() {
    const fs = enJuegoBando(E.verBando).map((f) => f.id).filter(enBorrador);
    E.borradores[E.turno] = (E.borradores[E.turno] || []).filter((x) => !fs.includes(x));
    guardar();
    pintarCuaderno();
    // Cada sobre recibe su lacre, uno detrás de otro
    if (FX.quieto()) return;
    fs.forEach((id, i) => {
      const l = document.querySelector(`#cuaderno-lista [data-abrir="${id}"] .lacre`);
      if (!l) return;
      l.animate([{ transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(.9)', opacity: 1, offset: 0.7 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 380, delay: i * 140, easing: 'ease-in', fill: 'backwards' });
      FX.sonar('lacre', i * 140 + 260);
    });
  }
  $('abrir-despacho').addEventListener('click', () => Despacho.abrir(null, { completa: true }));
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

  // ---------- Despacho: las órdenes a pantalla completa, de una en una ----------
  const Despacho = (function () {
    const el = document.createElement('div');
    el.className = 'despacho';
    el.id = 'despacho';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', tr('Despacho de órdenes'));
    el.tabIndex = -1;
    const fsOk = !!(el.requestFullscreen || el.webkitRequestFullscreen);
    el.innerHTML = `
      <div class="despacho__barra">
        <div class="despacho__tit"><span class="antetitulo">${tr('Estado Mayor')}</span><b>${tr('Despacho de órdenes')}</b></div>
        <div class="conmutador despacho__bandos" id="despacho-bandos" role="group" aria-label="${tr('Bando')}"></div>
        <div class="despacho__ctl">
          <div class="turno-mini" role="group" aria-label="${tr('Turno de juego')}"><button type="button" data-turno="-1" aria-label="${tr('Turno anterior')}">−</button><span>${tr('Turno')} <strong data-turno-n>1</strong></span><button type="button" data-turno="1" aria-label="${tr('Turno siguiente')}">+</button></div>
          <button type="button" class="despacho__btn" id="despacho-secreto" aria-pressed="false" title="${tr('Modo secreto: sobres lacrados')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m3 7 9 7 9-7"/></svg><span>${tr('Sobres')}</span></button>
          <button type="button" class="despacho__btn" data-sonido aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path class="onda" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="mudo" d="m16 9 6 6m0-6-6 6"/></svg><span class="sr">${tr('Sonido')}</span></button>
          ${fsOk ? `<button type="button" class="despacho__btn" id="despacho-completa" title="${tr('Pantalla completa')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><span class="sr">${tr('Pantalla completa')}</span></button>` : ''}
          <button type="button" class="despacho__btn despacho__cerrar" id="despacho-cerrar" aria-label="${tr('Cerrar el despacho')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
        </div>
      </div>
      <div class="despacho__escena">
        <button type="button" class="despacho__flecha" id="despacho-prev" aria-label="${tr('Formación anterior')}">‹</button>
        <div class="despacho__mesa" id="despacho-mesa" aria-live="polite"></div>
        <button type="button" class="despacho__flecha" id="despacho-sig" aria-label="${tr('Formación siguiente')}">›</button>
      </div>
      <div class="despacho__pie">
        <div class="despacho__nav"><button type="button" class="despacho__flechita" data-nav="-1" aria-label="${tr('Formación anterior')}">‹</button><div class="despacho__quien" id="despacho-quien"></div><button type="button" class="despacho__flechita" data-nav="1" aria-label="${tr('Formación siguiente')}">›</button></div>
        <div class="despacho__puntos" id="despacho-puntos"></div>
        <div class="despacho__acciones" id="despacho-acciones"></div>
      </div>
      <div class="despacho__aviso" id="despacho-aviso" aria-live="polite"></div>`;
    document.body.appendChild(el);
    const D = { idx: 0, editando: false, ocupado: false };
    const q = (id) => el.querySelector('#' + id);

    function actual() {
      const fs = enJuegoBando(E.verBando);
      D.idx = Math.max(0, Math.min(D.idx, fs.length - 1));
      return { fs, f: fs[D.idx] };
    }
    const datos = (f) => ({ f, bando: etiquetaBando(f.bando), turno: E.turno, n: D.idx, v: vigente(E.turno, f.id), ordenes: NOMBRES });
    function htmlMesa(f) {
      const st = estadoSobre(f.id);
      if (st === 'lacrada') return `<div class="escena-sobre">${Sobres.sobre({ f, bando: etiquetaBando(f.bando), turno: E.turno })}<p class="escena-sobre__pista">${tr(porAbrir(f.id) ? '¡Formación activada! Toca el sobre para romper el lacre.' : 'Toca el sobre para romper el lacre.')}</p></div>`;
      if (st === 'borrador' || (st === 'abierta' && D.editando)) return Sobres.borrador(datos(f));
      return Sobres.carta(datos(f));
    }
    function acciones(f, fs) {
      const st = estadoSobre(f.id);
      const b = (id, txt, prim) => `<button type="button" class="boton${prim ? ' boton--primario' : ''}" data-accion="${id}">${txt}</button>`;
      const quedan = E.secreto && fs.filter((x) => enBorrador(x.id)).length;
      const r = {
        abierta: D.editando ? b('hecho', tr('Ver la orden'), true) : b('editar', tr('Redactar la orden'), true),
        borrador: b('lacrar', tr('Lacrar la orden'), true),
        lacrada: b('abrir', tr('Romper el lacre'), true) + b('cambiar', tr('Cambiar la orden')),
        revelada: b('guardar', tr('Volver a meterla en el sobre'))
      }[st];
      return r + (quedan > 1 ? b('lacrar-todas', tr('Lacrar los {n} borradores', { n: quedan })) : '');
    }
    function pintar(dir) {
      if (el.hidden) return;
      const { fs, f } = actual();
      q('despacho-bandos').innerHTML = E.bandos.map((b, i) => `<button type="button" data-b="${i}" aria-pressed="${E.verBando === i}">${esc(etiquetaBando(i))}</button>`).join('');
      q('despacho-secreto').setAttribute('aria-pressed', E.secreto);
      el.querySelectorAll('[data-turno-n]').forEach((e) => { e.textContent = E.turno; });
      el.querySelector('[data-turno="-1"]').disabled = E.turno <= 1;
      el.classList.toggle('despacho--secreto', E.secreto);
      if (!f) {
        q('despacho-mesa').innerHTML = `<p class="despacho__vacio">${tr('No hay formaciones para {x}. Añádelas en «Tu partida».', { x: esc(etiquetaBando(E.verBando)) })}</p>`;
        q('despacho-quien').innerHTML = q('despacho-puntos').innerHTML = q('despacho-acciones').innerHTML = '';
        return;
      }
      const mesa = q('despacho-mesa');
      mesa.innerHTML = htmlMesa(f);
      mesa.scrollTop = 0;
      if (dir && !FX.quieto()) mesa.firstElementChild.animate([{ transform: `translateX(${dir * 70}px) rotate(${dir * 2}deg)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.2,.8,.3,1)' });
      q('despacho-quien').innerHTML = `${icono(f, 'despacho__icono')}<span><strong>${esc(f.nombre)}</strong><small>${tr('{a} de {b}', { a: D.idx + 1, b: fs.length })} · ${esc(etiquetaBando(f.bando))}</small></span>`;
      q('despacho-puntos').innerHTML = fs.map((x, i) => `<button type="button" class="dpunto dpunto--${estadoSobre(x.id)}${i === D.idx ? ' dpunto--actual' : ''}${porAbrir(x.id) ? ' dpunto--activa' : ''}" data-ir="${i}" aria-label="${esc(x.nombre)}"></button>`).join('');
      q('despacho-acciones').innerHTML = acciones(f, fs);
      q('despacho-prev').disabled = el.querySelector('[data-nav="-1"]').disabled = D.idx === 0;
      q('despacho-sig').disabled = el.querySelector('[data-nav="1"]').disabled = D.idx >= fs.length - 1;
    }
    function ir(d) {
      const { fs } = actual();
      const n = Math.max(0, Math.min(fs.length - 1, D.idx + d));
      if (n === D.idx || D.ocupado) return;
      D.idx = n;
      D.editando = false;
      FX.sonar('papel', 0, 0.22);
      pintar(d);
    }
    function aviso(txt) {
      const a = q('despacho-aviso');
      a.textContent = txt;
      a.classList.remove('visible');
      void a.offsetWidth;
      a.classList.add('visible');
    }
    const anim = (n, fr, o) => (n && !FX.quieto() ? n.animate(fr, Object.assign({ fill: 'forwards', easing: 'ease-in-out' }, o)).finished.catch(() => {}) : Promise.resolve());

    // Lacrar: la hoja se dobla, entra en el sobre, se cierra la solapa y cae el lacre
    async function lacrar() {
      const { f } = actual();
      if (!f || D.ocupado) return;
      D.ocupado = true;
      const mesa = q('despacho-mesa');
      const hoja = mesa.querySelector('.carta');
      if (hoja && !FX.quieto()) {
        FX.sonar('papel');
        await anim(hoja, [{ transform: 'none' }, { transform: 'perspective(900px) rotateX(28deg) scaleY(.6)', offset: 0.45 }, { transform: 'perspective(900px) translateY(18%) scale(.42, .2)', opacity: 0.2 }], { duration: 520 });
        mesa.innerHTML = `<div class="escena-sobre">${Sobres.sobre({ f, bando: etiquetaBando(f.bando), turno: E.turno, abierto: true })}<p class="escena-sobre__pista">&nbsp;</p></div>`;
        const s = mesa.querySelector('.sobre'), papel = s.querySelector('.sobre__papel'), solapa = s.querySelector('.sobre__solapa'), lacreEl = s.querySelector('.lacre');
        lacreEl.style.opacity = 0;
        await anim(papel, [{ transform: 'translateY(-62%)' }, { transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(.5,0,.6,1)' });
        FX.sonar('papel', 0, 0.3);
        solapa.style.zIndex = 4;
        await anim(solapa, [{ transform: 'rotateX(180deg)' }, { transform: 'rotateX(0deg)' }], { duration: 380 });
        s.classList.remove('sobre--abierto');
        solapa.getAnimations().forEach((a) => a.cancel());
        solapa.style.zIndex = '';
        lacreEl.style.opacity = '';
        FX.sonar('lacre', 230);
        await anim(lacreEl, [{ transform: 'translate(-50%, -50%) scale(2.6) rotate(-25deg)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(.86, .8)', opacity: 1, offset: 0.72 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }], { duration: 330, easing: 'ease-in', fill: 'none' });
        const r = lacreEl.getBoundingClientRect();
        FX.chispas(r.left + r.width / 2, r.top + r.height / 2, { color: '#a3241c', n: 16, dist: 60 });
        anim(s, [{ transform: 'translateY(0)' }, { transform: 'translateY(5px) scale(.985)' }, { transform: 'none' }], { duration: 220, fill: 'none' });
        await FX.espera(450);
      }
      poner(E.borradores, f.id, false);
      poner(E.reveladas, f.id, false);
      guardar();
      D.ocupado = false;
      aviso(tr('Orden lacrada'));
      pintarCuaderno();
      const sig = q('despacho-sig');
      if (!sig.disabled) sig.classList.add('pulsa');
    }

    // Abrir: se rompe el lacre, se levanta la solapa, sale la carta y se escribe a máquina
    async function abrirSobre() {
      const { f } = actual();
      if (!f || D.ocupado || estadoSobre(f.id) !== 'lacrada') return;
      D.ocupado = true;
      const mesa = q('despacho-mesa');
      const s = mesa.querySelector('.sobre');
      if (s && !FX.quieto()) {
        const l = s.querySelector('.lacre'), izq = s.querySelector('.lacre__mitad--izq'), der = s.querySelector('.lacre__mitad--der');
        await anim(l, [{ transform: 'translate(-50%, -50%)' }, { transform: 'translate(-50%, -50%) rotate(-4deg)' }, { transform: 'translate(-50%, -50%) rotate(4deg)' }, { transform: 'translate(-50%, -50%)' }], { duration: 220, fill: 'none' });
        FX.sonar('romper');
        const r = l.getBoundingClientRect();
        FX.chispas(r.left + r.width / 2, r.top + r.height / 2, { color: '#8e1c15', n: 18, dist: 80 });
        anim(izq, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-40px, 70px) rotate(-50deg)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.4,0,.8,.6)' });
        await anim(der, [{ transform: 'none', opacity: 1 }, { transform: 'translate(46px, 80px) rotate(60deg)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.4,0,.8,.6)' });
        const solapa = s.querySelector('.sobre__solapa'), papel = s.querySelector('.sobre__papel');
        FX.sonar('papel', 0, 0.3);
        solapa.style.zIndex = 4;
        await anim(solapa, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)', offset: 0.5 }, { transform: 'rotateX(180deg)' }], { duration: 400 });
        solapa.style.zIndex = 1;
        papel.style.visibility = 'visible';
        FX.sonar('papel', 0, 0.5);
        await anim(papel, [{ transform: 'translateY(0)' }, { transform: 'translateY(-78%)' }], { duration: 480, easing: 'cubic-bezier(.3,.6,.4,1)' });
        await anim(s, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(60px) scale(.92)', opacity: 0 }], { duration: 300 });
      }
      poner(E.reveladas, f.id, true);
      guardar();
      D.ocupado = false;
      pintarCuaderno();
      pintarSaco();
      // La carta se despliega, se escribe y al final cae el sello con la orden
      const carta = mesa.querySelector('.carta');
      if (!carta || FX.quieto()) return;
      carta.classList.add('carta--nueva');
      await anim(carta, [{ transform: 'perspective(1000px) rotateX(-55deg) translateY(-40px) scaleY(.5)', opacity: 0, transformOrigin: 'top center' }, { transform: 'perspective(1000px) rotateX(8deg)', opacity: 1, offset: 0.7, transformOrigin: 'top center' }, { transform: 'none', opacity: 1, transformOrigin: 'top center' }], { duration: 560, fill: 'none' });
      const tampon = carta.querySelector('.tampon--orden');
      const fin = () => {
        if (!carta.isConnected || carta.classList.contains('carta--sellada')) return;
        carta.classList.add('carta--sellada');
        FX.sonar('lacre');
        anim(tampon, [{ transform: 'rotate(-14deg) scale(2.6)', opacity: 0 }, { transform: 'rotate(-14deg) scale(.94)', opacity: 0.92, offset: 0.75 }, { transform: 'rotate(-14deg) scale(1)', opacity: 0.88 }], { duration: 300, easing: 'ease-in', fill: 'none' });
      };
      const acabar = FX.maquina(carta, { alFin: () => setTimeout(fin, 250) });
      carta.addEventListener('click', acabar, { once: true });
    }

    function abrir(id, op = {}) {
      const fs = enJuegoBando(E.verBando);
      if (id) {
        const f = porId(id);
        if (f && f.bando !== E.verBando) { E.verBando = f.bando; guardar(); pintarCuaderno(); }
        D.idx = Math.max(0, enJuegoBando(E.verBando).findIndex((x) => x.id === id));
      } else if (D.idx >= fs.length) D.idx = 0;
      D.editando = false;
      el.hidden = false;
      document.documentElement.classList.add('con-despacho');
      if (op.completa && fsOk && !document.fullscreenElement) (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => {});
      pintar();
      if (!FX.quieto()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      FX.sonar('papel', 0, 0.3);
      el.focus({ preventScroll: true });
      if (op.abrirSobre) {
        // Si la formación se activa con la orden aún en borrador, se lacra tal cual y se abre
        const f = actual().f;
        if (f && enBorrador(f.id)) { poner(E.borradores, f.id, false); guardar(); pintarCuaderno(); }
        setTimeout(abrirSobre, 380);
      }
    }
    function cerrar() {
      if (document.fullscreenElement === el) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
      el.hidden = true;
      document.documentElement.classList.remove('con-despacho');
      D.ocupado = false;
      pintarCuaderno();
    }

    el.addEventListener('click', (e) => {
      const t = e.target;
      if (t.closest('#despacho-cerrar')) { cerrar(); return; }
      if (t.closest('#despacho-prev')) { ir(-1); return; }
      if (t.closest('#despacho-sig')) { t.closest('#despacho-sig').classList.remove('pulsa'); ir(1); return; }
      const nav = t.closest('[data-nav]');
      if (nav) { ir(+nav.dataset.nav); return; }
      if (t.closest('#despacho-completa')) {
        if (document.fullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document).catch(() => {});
        else (el.requestFullscreen || el.webkitRequestFullscreen).call(el).catch(() => {});
        return;
      }
      if (t.closest('#despacho-secreto')) { ponerSecreto(!E.secreto); return; }
      const bando = t.closest('#despacho-bandos [data-b]');
      if (bando) { E.verBando = +bando.dataset.b; D.idx = 0; guardar(); pintarCuaderno(); pintar(1); return; }
      const p = t.closest('[data-ir]');
      if (p) { const n = +p.dataset.ir; if (n !== D.idx) { const d = n > D.idx ? 1 : -1; D.idx = n; D.editando = false; pintar(d); } return; }
      const casilla = t.closest('.carta--borrador [data-o]');
      if (casilla) {
        const { f } = actual();
        elegirOrden(f.id, casilla.dataset.o);
        FX.sonar('tecla');
        pintar();
        pintarCuaderno();
        return;
      }
      if (t.closest('.escena-sobre .sobre')) { abrirSobre(); return; }
      const a = t.closest('[data-accion]');
      if (!a || D.ocupado) return;
      const { f } = actual();
      const acc = a.dataset.accion;
      if (acc === 'lacrar') lacrar();
      else if (acc === 'abrir') abrirSobre();
      else if (acc === 'lacrar-todas') { lacrarTodas(); aviso(tr('Órdenes lacradas')); pintar(); }
      else if (acc === 'cambiar') { poner(E.borradores, f.id, true); guardar(); pintarCuaderno(); pintar(); }
      else if (acc === 'guardar') { poner(E.reveladas, f.id, false); guardar(); FX.sonar('papel'); pintarCuaderno(); pintarSaco(); pintar(); }
      else if (acc === 'editar') { D.editando = true; pintar(); }
      else if (acc === 'hecho') { D.editando = false; pintar(); }
    });
    el.addEventListener('input', (e) => {
      const c = e.target.dataset.campo;
      if (!c) return;
      fijar(actual().f.id, (n) => { n[c] = e.target.value; });
    });
    // El teclado manda mientras el despacho está abierto, aunque el foco se haya perdido al repintar
    document.addEventListener('keydown', (e) => {
      if (el.hidden || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.matches('input, textarea, select')) { if (e.key === 'Enter') e.target.blur(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); ir(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ir(1); }
      else if (e.key === 'Escape' && !document.fullscreenElement) cerrar();
      else if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, a')) {
        e.preventDefault();
        const prim = q('despacho-acciones').querySelector('.boton--primario');
        if (prim) prim.click();
      }
    });
    // Deslizar a los lados para pasar de formación
    let x0 = null, y0 = 0;
    q('despacho-mesa').addEventListener('pointerdown', (e) => { if (!e.target.closest('input, button')) { x0 = e.clientX; y0 = e.clientY; } });
    q('despacho-mesa').addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(dx < 0 ? 1 : -1);
    });
    document.addEventListener('fullscreenchange', () => el.classList.toggle('despacho--completa', document.fullscreenElement === el));
    return { abrir, cerrar, pintar: () => pintar() };
  })();

  function pintar() {
    $('turno').textContent = E.turno;
    pintarBandos();
    pintarSaco();
    pintarCuaderno();
  }
  pintar();
  pintarSonido();
  listo = true;
  $('guardado').textContent = tr(todas().length ? 'Partida recuperada de este navegador.' : 'Se guardará solo en este navegador.');
})();
