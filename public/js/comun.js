// Cabecera, pie, tema y buscador, comunes a todas las páginas.
(function () {
  'use strict';

  const PAGINAS = [
    ['index.html', 'Inicio'],
    ['fichas.html', 'Fichas y unidades'],
    ['combate.html', 'Combate'],
    ['simulador.html', 'Simulador', 'nav__sim'],
    ['secuencia.html', 'Secuencia'],
    ['tablas.html', 'Tablas'],
    ['glosario.html', 'Glosario']
  ];

  const ICONOS = {
    buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  const LOGO = '<svg class="marca__logo" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 9v14l-12 7-12-7V9z" fill="#8c9a35" stroke="#f2b33d" stroke-width="1.6"/><path d="M9 11h14v10H9z" fill="#fff" stroke="#111" stroke-width="1.4"/><path d="M9 11l14 10M23 11 9 21" stroke="#111" stroke-width="1.3"/></svg>';

  function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // Tema: claro, oscuro o el del sistema
  const temaGuardado = leer('bcs-tema');
  if (temaGuardado) document.documentElement.dataset.theme = temaGuardado;
  function temaActual() {
    return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  }

  function cabecera() {
    const actual = location.pathname.split('/').pop() || 'index.html';
    const enlaces = PAGINAS.map(([href, txt, cls]) => {
      const sel = href === actual || (actual === '' && href === 'index.html') ? ' aria-current="page"' : '';
      return `<a href="${href}"${sel}${cls ? ` class="${cls}"` : ''}>${txt}</a>`;
    }).join('');
    const h = document.createElement('header');
    h.className = 'cabecera';
    h.innerHTML = `<div class="wrap cabecera__fila">
      <a class="marca" href="index.html">${LOGO}<span class="marca__txt">BCS · Referencia<small>Battalion Combat Series v2.0</small></span></a>
      <nav class="nav" id="nav" aria-label="Secciones">${enlaces}</nav>
      <div class="acciones">
        <button class="boton-icono" id="btn-buscar" type="button" aria-label="Buscar">${ICONOS.buscar}<span class="buscar-txt">Buscar</span> <kbd class="buscar-txt">Ctrl K</kbd></button>
        <button class="boton-icono" id="btn-tema" type="button" aria-label="Cambiar tema"></button>
        <button class="boton-icono menu-movil" id="btn-menu" type="button" aria-label="Menú" aria-expanded="false" aria-controls="nav">${ICONOS.menu}</button>
      </div>
    </div>`;
    document.body.prepend(h);

    const btnTema = h.querySelector('#btn-tema');
    const pintarTema = () => { btnTema.innerHTML = temaActual() === 'dark' ? ICONOS.sol : ICONOS.luna; };
    pintarTema();
    btnTema.addEventListener('click', () => {
      const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = nuevo;
      guardar('bcs-tema', nuevo);
      pintarTema();
    });
    const btnMenu = h.querySelector('#btn-menu');
    btnMenu.addEventListener('click', () => {
      const nav = h.querySelector('#nav');
      const abierta = nav.classList.toggle('abierta');
      btnMenu.setAttribute('aria-expanded', abierta);
    });
    h.querySelector('#btn-buscar').addEventListener('click', abrirBuscador);
  }

  function pie() {
    const f = document.createElement('footer');
    f.className = 'pie';
    f.innerHTML = `<div class="wrap pie__fila">
      <div>
        <p><strong>BCS · Referencia</strong> es una ayuda de juego no oficial, hecha por un aficionado. Resume las reglas de la serie (v2.0) sin entrar en las reglas propias de cada juego.</p>
        <p><em>Battalion Combat Series</em>, sus reglas, tablas y fichas son © Multi-Man Publishing / The Gamers. Las reglas completas y vigentes están en <a href="https://www.multimanpublishing.com/" rel="noopener">multimanpublishing.com</a>. Las fichas que se muestran vienen de los módulos de VASSAL de <em>Arracourt</em>, <em>Danger Forward</em> y <em>Valley of Tears</em>.</p>
      </div>
      <div><p><a href="https://nephei.org">nephei.org</a> · <a href="https://rpg.nephei.org">rpg.nephei.org</a></p></div>
    </div>`;
    document.body.append(f);
  }

  // ---------- Buscador ----------
  let buscador, entrada, lista, resultados = [], activo = 0;

  function indice() {
    const items = [];
    (window.Datos ? Datos.SECCIONES : []).forEach(([t, href, donde]) => items.push({ t, href, donde, d: '' }));
    (window.Datos ? Datos.GLOSARIO : []).forEach(([t, es, d]) => items.push({ t: t + (es && es !== t ? ' · ' + es : ''), href: 'glosario.html#' + Datos.slug(t), donde: 'Glosario', d }));
    return items;
  }
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function resaltar(txt, q) {
    if (!q) return Fichas.esc(txt);
    const i = norm(txt).indexOf(norm(q));
    if (i < 0) return Fichas.esc(txt);
    return Fichas.esc(txt.slice(0, i)) + '<mark>' + Fichas.esc(txt.slice(i, i + q.length)) + '</mark>' + Fichas.esc(txt.slice(i + q.length));
  }

  function crearBuscador() {
    buscador = document.createElement('div');
    buscador.className = 'buscador';
    buscador.hidden = true;
    buscador.innerHTML = `<div class="buscador__caja" role="dialog" aria-modal="true" aria-label="Buscar en la referencia">
      <div class="buscador__entrada">${ICONOS.buscar}<input type="search" placeholder="Busca un término, una tabla o una regla…" aria-label="Buscar" autocomplete="off"><kbd>Esc</kbd></div>
      <ul role="listbox"></ul></div>`;
    document.body.append(buscador);
    entrada = buscador.querySelector('input');
    lista = buscador.querySelector('ul');
    const todos = indice();
    const pintar = () => {
      const q = entrada.value.trim();
      const nq = norm(q);
      resultados = q ? todos.filter((i) => norm(i.t + ' ' + i.d).includes(nq))
        .sort((a, b) => (norm(a.t).includes(nq) ? 0 : 1) - (norm(b.t).includes(nq) ? 0 : 1)).slice(0, 12)
        : todos.filter((i) => i.donde !== 'Glosario').slice(0, 10);
      activo = 0;
      lista.innerHTML = resultados.length ? resultados.map((r, i) => `<li><a href="${r.href}" class="${i === 0 ? 'activo' : ''}"><span class="donde">${r.donde}</span><strong>${resaltar(r.t, q)}</strong>${r.d ? `<p>${resaltar(r.d, q)}</p>` : ''}</a></li>`).join('')
        : '<li class="buscador__vacio">Nada con ese nombre. Prueba con el término en inglés.</li>';
    };
    entrada.addEventListener('input', pintar);
    entrada.addEventListener('keydown', (e) => {
      const as = lista.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!as.length) return;
        as[activo].classList.remove('activo');
        activo = (activo + (e.key === 'ArrowDown' ? 1 : as.length - 1)) % as.length;
        as[activo].classList.add('activo');
        as[activo].scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter' && as[activo]) { e.preventDefault(); as[activo].click(); }
    });
    lista.addEventListener('click', (e) => { if (e.target.closest('a')) cerrarBuscador(); });
    buscador.addEventListener('click', (e) => { if (e.target === buscador) cerrarBuscador(); });
    pintar();
  }
  function abrirBuscador() {
    if (!buscador) crearBuscador();
    buscador.hidden = false;
    entrada.value = '';
    entrada.dispatchEvent(new Event('input'));
    entrada.focus();
  }
  function cerrarBuscador() { if (buscador) buscador.hidden = true; }

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrirBuscador(); }
    else if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); abrirBuscador(); }
    else if (e.key === 'Escape') cerrarBuscador();
  });

  cabecera();
  pie();
  window.Comun = { guardar, leer };
})();
