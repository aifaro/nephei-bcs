// Cabecera, pie, tema y buscador, comunes a todas las páginas.
(function () {
  'use strict';
  const tr = I18N.t, EN = I18N.en;

  // El reglamento, en el orden de las Series Rules
  const CAPITULOS = [
    ['intro.html', tr('Antes de empezar'), tr('Qué es el BCS, cómo es un turno y el vocabulario básico')],
    ['fichas.html', tr('Fichas y unidades'), tr('Cómo leer una ficha, tipos de unidad, AV, apoyo y marcadores')],
    ['secuencia.html', tr('Secuencia y SNAFU'), tr('El turno, la activación, el SNAFU y la Segunda Activación')],
    ['mando.html', tr('Mando y suministro'), tr('Formaciones, HQ, trenes, MSR, OBJ, Safe Path y aislamiento')],
    ['movimiento.html', tr('Movimiento y ZOC'), tr('Terreno, apilamiento, ZOC, zonas de enfrentamiento y pantallas')],
    ['combate.html', tr('Combate'), tr('Ataques, enfrentamientos, fuego, bombardeos y retiradas')],
    ['opcionales.html', tr('Reglas opcionales'), tr('Órdenes, chits de activación, Planned Fatigue y otras')]
  ];
  // Rango que se gana al superar cada lección
  const RANGOS = [tr('Recluta'), tr('Soldado'), tr('Cabo'), tr('Sargento'), tr('Alférez'), tr('Teniente'), tr('Capitán'), tr('Comandante')];
  // Herramientas para la mesa
  const UTILIDADES = [
    ['simulador.html', tr('Simulador de ataques'), tr('Fichas en el mapa, probabilidades y tiradas animadas')],
    ['combate.html#elegir', tr('¿Qué ataque uso?'), tr('Elige tu unidad y el blanco, y te dice qué puedes hacer')],
    ['secuencia.html#snafu', tr('Calculadora de SNAFU'), tr('Modificadores y probabilidad de Full, Partial y Fail')],
    ['opcionales.html#chits', tr('Saco de activaciones'), tr('Saca chits de 3 en 3: el bando con mayoría elige')],
    ['opcionales.html#ordenes', tr('Cuaderno de órdenes'), tr('Anota las órdenes de cada formación, turno a turno')]
  ];
  const PAGINAS = [
    ['index.html', tr('Inicio')],
    ['reglamento', tr('Reglamento')],
    ['utilidades', tr('Utilidades')],
    ['tablas.html', tr('Tablas')],
    ['glosario.html', tr('Glosario')]
  ];
  const actual = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  const esActual = (href) => href.replace(/\.html$/, '') === actual;
  const capActual = CAPITULOS.findIndex(([h]) => esActual(h));
  const utilActual = actual === 'simulador';

  const ICONOS = {
    buscar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    flecha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
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

  // La misma página en el otro idioma: /x.html ↔ /en/x.html
  function otroIdioma() {
    const pag = (location.pathname.split('/').pop() || 'index.html') + location.hash;
    return EN ? '../' + pag : 'en/' + pag;
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.idioma');
    if (a) a.href = otroIdioma();
  });

  function cabecera() {
    const grupo = (txt, items, marca, actualGrupo) => `<div class="nav__grupo"><button type="button" class="nav__btn${actualGrupo ? ' actual' : ''}" aria-expanded="false">${txt} ${ICONOS.flecha}</button><div class="nav__menu" data-titulo="${txt}">${items.map(([h, t, d], i) => `<a href="${h}"${esActual(h) ? ' aria-current="page"' : ''}><span class="nav__n">${marca(i)}</span><span><strong>${t}</strong><small>${d}</small></span></a>`).join('')}</div></div>`;
    const enlaces = PAGINAS.map(([href, txt]) => {
      if (href === 'reglamento') return grupo(txt, CAPITULOS, (i) => i, capActual >= 0);
      if (href === 'utilidades') return grupo(txt, UTILIDADES, () => '›', utilActual);
      return `<a href="${href}"${esActual(href) ? ' aria-current="page"' : ''}>${txt}</a>`;
    }).join('');
    const h = document.createElement('header');
    h.className = 'cabecera';
    h.innerHTML = `<div class="wrap cabecera__fila">
      <a class="marca" href="index.html">${LOGO}<span class="marca__txt">${tr('Academia BCS')}<small>Battalion Combat Series v2.0</small></span></a>
      <nav class="nav" id="nav" aria-label="${tr('Secciones')}">${enlaces}</nav>
      <div class="acciones">
        <a class="idioma" href="${otroIdioma()}" hreflang="${EN ? 'es' : 'en'}" lang="${EN ? 'es' : 'en'}" title="${tr('Read this page in English')}"><span${EN ? '' : ' class="on"'}>ES</span><span${EN ? ' class="on"' : ''}>EN</span></a>
        <button class="boton-icono" id="btn-buscar" type="button" aria-label="${tr('Buscar')}">${ICONOS.buscar}<span class="buscar-txt">${tr('Buscar')}</span> <kbd class="buscar-txt">Ctrl K</kbd></button>
        <button class="boton-icono" id="btn-tema" type="button" aria-label="${tr('Cambiar tema')}"></button>
        <button class="boton-icono menu-movil" id="btn-menu" type="button" aria-label="${tr('Menú')}" aria-expanded="false" aria-controls="nav">${ICONOS.menu}</button>
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
    const grupos = [...h.querySelectorAll('.nav__grupo')];
    const abrirGrupo = (g, v) => { g.classList.toggle('abierto', v); g.querySelector('.nav__btn').setAttribute('aria-expanded', v); };
    grupos.forEach((g) => g.querySelector('.nav__btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const v = !g.classList.contains('abierto');
      grupos.forEach((o) => abrirGrupo(o, false));
      abrirGrupo(g, v);
    }));
    document.addEventListener('click', (e) => grupos.forEach((g) => { if (!g.contains(e.target)) abrirGrupo(g, false); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') grupos.forEach((g) => abrirGrupo(g, false)); });
  }

  // Hoja de servicio: lecciones superadas, guardadas en este navegador
  function lecciones() { try { return JSON.parse(leer('bcs-lecciones')) || []; } catch (e) { return []; } }
  function marcarLeccion(href, hecha) {
    const l = lecciones().filter((x) => x !== href);
    if (hecha) l.push(href);
    guardar('bcs-lecciones', JSON.stringify(l));
    return l;
  }
  function rango(n) { return RANGOS[Math.min(n, RANGOS.length - 1)]; }

  // Franja de capítulos bajo la cabecera de cada página del reglamento, y anterior/siguiente al final
  function capitulos() {
    if (capActual < 0) return;
    const hero = document.querySelector('main .hero');
    const tira = document.createElement('nav');
    tira.className = 'capitulos';
    tira.setAttribute('aria-label', tr('Capítulos del reglamento'));
    tira.innerHTML = `<div class="wrap"><ol>${CAPITULOS.map(([h, t], i) => `<li><a href="${h}"${i === capActual ? ' aria-current="page"' : ''}><span class="nav__n">${i}</span>${t}</a></li>`).join('')}</ol></div>`;
    if (hero) hero.after(tira);
    const ol = tira.querySelector('ol'), sel = ol.querySelector('[aria-current]').parentElement;
    ol.scrollLeft = sel.offsetLeft - (ol.clientWidth - sel.offsetWidth) / 2;
    const ant = CAPITULOS[capActual - 1], sig = CAPITULOS[capActual + 1];
    const pasar = document.createElement('nav');
    pasar.className = 'wrap pasar';
    pasar.setAttribute('aria-label', tr('Capítulo anterior y siguiente'));
    pasar.innerHTML = (ant ? `<a class="pasar__ant" href="${ant[0]}"><small>← ${tr('Lección {n}', { n: capActual - 1 })}</small><strong>${ant[1]}</strong></a>` : '<span></span>')
      + (sig ? `<a class="pasar__sig" href="${sig[0]}"><small>${tr('Lección {n}', { n: capActual + 1 })} →</small><strong>${sig[1]}</strong></a>` : `<a class="pasar__sig" href="simulador.html"><small>${tr('Para practicar')} →</small><strong>${tr('Simulador de ataques')}</strong></a>`);
    const href = CAPITULOS[capActual][0];
    const sello = document.createElement('div');
    sello.className = 'wrap sello';
    const pintarSello = () => {
      const l = lecciones(), hecha = l.includes(href);
      sello.innerHTML = `<div class="sello__caja${hecha ? ' hecha' : ''}"><div><span class="antetitulo">${tr('Lección {a} de {b}', { a: capActual, b: CAPITULOS.length - 1 })}</span><strong>${hecha ? tr('Lección superada') : tr('¿Lo tienes claro, recluta?')}</strong><p>${hecha ? tr('Rango actual: <b>{r}</b>. Sigue con la siguiente lección o repasa esta cuando quieras.', { r: rango(l.length) }) : tr('Márcala como superada y asciende a <b>{r}</b>. Se guarda solo en este navegador.', { r: rango(l.length + 1) })}</p></div>
        <button type="button" class="boton${hecha ? '' : ' boton--primario'}">${hecha ? tr('Desmarcar') : tr('✓ Lección superada')}</button></div>`;
      sello.querySelector('button').addEventListener('click', () => { marcarLeccion(href, !hecha); pintarSello(); });
    };
    pintarSello();
    document.querySelector('main').append(sello, pasar);
  }

  // ---------- Enlaces al glosario ----------
  // Enlaza la primera aparición de cada término en cada sección y muestra su definición al pasar por encima.
  // [expresión, término del glosario]
  const TERMINOS = [
    ['enfrentamientos?', 'Engagement'], ['Engagements?', 'Engagement'], ['ataques? por fuego', 'Attack by Fire'], ['Attacks? by Fire', 'Attack by Fire'],
    ['ataques? de choque', 'Shock Attack'], ['ataques? regular(?:es)?', 'Regular Attack'], ['Regular Attacks?', 'Regular Attack'], ['bombardeos?', 'Barrage'], ['Barrages?', 'Barrage'],
    ['retiradas? voluntarias?', 'Voluntary Retreat'], ['Voluntary Retreats?', 'Voluntary Retreat'], ['Segundas? Activaci(?:ón|ones)', 'Second Activation'], ['Second Activations?', 'Second Activation'], ['Recon', 'Recon'],
    ['Command Radius', 'Command Radius (CR)'], ['Reinforcements?', 'Reinforcements'], ['Replacements?', 'Replacements (Repls)'], ['Formations?', 'Formation'], ['Out of Command', 'Out of Command'],
    ['March OBJs?', 'March OBJ'], ['Planned Fatigue', 'Planned Fatigue'], ['Soft Jumps?', 'Soft Jump'], ['Unit Traffic', 'Unit Traffic'],
    ['Non-AV ZOC', 'Non-AV ZOC'], ['Real AV ZOC', 'Real AV ZOC'], ['Support AV ZOC', 'Support AV ZOC'],
    ['ZOC blindadas?', 'AV ZOC'], ['AV E?ZOCs?', 'AV ZOC'], ['E?ZOCs?', 'ZOC'],
    ['zonas? de enfrentamiento', 'Engagement Zone'], ['Engagement Zones?', 'Engagement Zone'],
    ['zonas? de OBJ doble', 'Double OBJ Zone'], ['Double OBJ', 'Double OBJ Zone'], ['zonas? de OBJ', 'OBJ Zone'], ['OBJ Zones?', 'OBJ Zone'],
    ['Stopping Engagements?', 'Stopping Engagement'], ['Safe Paths?', 'Safe Path'], ['camino seguro', 'Safe Path'], ['MSR', 'Main Supply Route (MSR)'],
    ['radio de mando', 'Command Radius (CR)'], ['Fire Events?', 'Fire Event'], ['SNAFU', 'SNAFU'],
    ['Prepared Defense', 'Prepared Defense (PD)'], ['defensa preparada', 'Prepared Defense (PD)'],
    ['STOP Terrain', 'STOP Terrain'], ['STOPPED', 'STOP'], ['STOP', 'STOP'], ['FINISHED', 'FINISHED'],
    ['hosts?', 'Host'], ['desprevenidas?', 'Unprepared'], ['Unprepared', 'Unprepared'],
    ['Shock Attacks?', 'Shock Attack'], ['Screen', 'Screen'], ['Over-Stack(?:ing|ed)', 'Over-Stacking'], ['sobreapilad[oa]s?', 'Over-Stacking'],
    ['Blocking Terrain', 'Blocking Terrain'], ['Key Terrain', 'Key Terrain'], ['terreno clave', 'Key Terrain'],
    ['Ghost', 'Ghost Trains'], ['Coordination', 'Coordination'], ['Dropped Support', 'Dropped Support'],
    ['Traffic', 'Traffic'], ['Jump(?:ed)?', 'Jump'], ['saltad[oa]s?', 'Jump'], ['Blob', 'Blob'],
    ['Breakthrough', 'Breakthrough Armor'], ['Dual', 'Dual'], ['Hard', 'Hard'], ['Fresh', 'Fresh'],
    ['aislamiento', 'Isolation'], ['Isolation', 'Isolation'], ['Limited AV', 'Limited AV'], ['Stand Off AV', 'Stand Off AV'], ['Light AV', 'Light AV'], ['Red AV', 'Red AV']
  ];
  // Términos en inglés que solo se enlazan escritos con mayúscula (Hard, Screen, Dual…)
  const SOLO_MAYUSCULA = /^[A-Z][a-z]/;
  let enlazar = () => {};
  function enlazarGlosario() {
    if (!window.Datos || actual === 'simulador') return;
    const defs = {};
    Datos.GLOSARIO.forEach((g) => { defs[g[0]] = g; });
    const reglas = TERMINOS.filter(([, t]) => defs[t]).map(([p, t]) => [new RegExp('^(?:' + p + ')$', 'i'), t, p]);
    const re = new RegExp('(^|[^\\wÀ-ÿ-])(' + reglas.map((r) => r[2]).join('|') + ')(?![\\wÀ-ÿ-])', 'gi');
    const PROHIBIDO = 'a, button, h1, h2, h3, h4, .regla, .en, svg, label, select, option, .chip, kbd, code, .antetitulo, script, style, .no-glosario, table.capacidades, figcaption strong, .orden-chip, .chit, .herramienta';
    // Enlaza los términos de cada contenedor; en el glosario, a su entrada y sin enlazar el propio término
    enlazar = (contenedores, enGlosario) => contenedores.forEach((sec) => {
      const vistos = new Set();
      if (enGlosario) { const yo = sec.closest('[data-termino]'); if (yo) vistos.add(yo.dataset.termino); }
      const andar = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => n.parentElement.closest(PROHIBIDO) || !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const nodos = [];
      while (andar.nextNode()) nodos.push(andar.currentNode);
      nodos.forEach((n) => {
        const txt = n.nodeValue;
        let ultimo = 0, frag = null, m;
        re.lastIndex = 0;
        while ((m = re.exec(txt))) {
          const palabra = m[2], ini = m.index + m[1].length;
          const r = reglas.find(([x]) => x.test(palabra));
          if (!r || vistos.has(r[1])) continue;
          if (SOLO_MAYUSCULA.test(r[2]) && !/[A-Z]/.test(palabra[0])) continue;
          // Siglas y palabras en mayúsculas (STOP, FINISHED, ZOC…) solo en mayúsculas
          if (/^[A-Z]{2}/.test(r[1]) && palabra.slice(0, 2) !== palabra.slice(0, 2).toUpperCase()) continue;
          vistos.add(r[1]);
          frag = frag || document.createDocumentFragment();
          frag.append(txt.slice(ultimo, ini));
          const a = document.createElement('a');
          a.className = 'g';
          a.href = (enGlosario ? '#' : 'glosario.html#') + Datos.slug(r[1]);
          a.dataset.g = r[1];
          a.textContent = palabra;
          frag.append(a);
          ultimo = ini + palabra.length;
        }
        if (frag) { frag.append(txt.slice(ultimo)); n.replaceWith(frag); }
      });
    });
    if (actual !== 'glosario') enlazar(document.querySelectorAll('main .seccion, main .bloque'));
    // Definición emergente
    const pop = document.createElement('div');
    pop.className = 'g-pop';
    pop.setAttribute('role', 'tooltip');
    pop.hidden = true;
    document.body.append(pop);
    let quitar;
    const enlace = (e) => e.target.closest && e.target.closest('a[data-g]');
    const mostrar = (a) => {
      const g = defs[a.dataset.g];
      if (!g) return;
      clearTimeout(quitar);
      pop.innerHTML = `<strong>${Fichas.esc(g[0])}</strong>${g[1] && g[1] !== g[0] ? ` <span class="es">${Fichas.esc(g[1])}</span>` : ''} <span class="regla">${Fichas.esc(g[3])}</span><p>${Fichas.esc(g[2])}</p>${Datos.DONDE && Datos.DONDE[g[0]] ? (() => { const i = CAPITULOS.findIndex((c) => c[0] === Datos.DONDE[g[0]].split('#')[0]); return i < 0 ? '' : `<span class="g-lec">${tr('Lección {n}', { n: i })} · ${Fichas.esc(CAPITULOS[i][1])}</span>`; })() : ''}`;
      pop.hidden = false;
      const r = a.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
      const y = r.top - h - 10 > 70 ? r.top - h - 10 : r.bottom + 10;
      pop.style.left = x + scrollX + 'px';
      pop.style.top = y + scrollY + 'px';
    };
    const ocultar = () => { quitar = setTimeout(() => { pop.hidden = true; }, 120); };
    document.addEventListener('mouseover', (e) => { const a = enlace(e); if (a) mostrar(a); });
    document.addEventListener('mouseout', (e) => { if (enlace(e)) ocultar(); });
    document.addEventListener('focusin', (e) => { const a = enlace(e); if (a) mostrar(a); });
    document.addEventListener('focusout', (e) => { if (enlace(e)) ocultar(); });
  }

  function pie() {
    const f = document.createElement('footer');
    f.className = 'pie';
    f.innerHTML = EN ? `<div class="wrap pie__fila">
      <div>
        <p><strong>BCS Academy</strong> is an unofficial, fan-made play aid: basic training for recruits and a quick reference for veterans. It summarises the series rules (v2.0) and leaves out each game's own rules.</p>
        <p><em>Battalion Combat Series</em>, its rules, charts and counters are © Multi-Man Publishing / The Gamers. The complete, current rules are at <a href="https://www.multimanpublishing.com/" rel="noopener">multimanpublishing.com</a>. The counters shown come from the VASSAL modules for <em>Arracourt</em>, <em>Danger Forward</em> and <em>Valley of Tears</em>.</p>
      </div>
      <div><p><a href="https://nephei.org">nephei.org</a> · <a href="https://rpg.nephei.org">rpg.nephei.org</a></p></div>
    </div>` : `<div class="wrap pie__fila">
      <div>
        <p><strong>Academia BCS</strong> es una ayuda de juego no oficial, hecha por un aficionado: instrucción para reclutas y consulta para veteranos. Resume las reglas de la serie (v2.0) sin entrar en las reglas propias de cada juego.</p>
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
    (window.Datos ? Datos.GLOSARIO : []).forEach(([t, es, d]) => items.push({ t: t + (es && es !== t ? ' · ' + es : ''), href: 'glosario.html#' + Datos.slug(t), donde: tr('Glosario'), d }));
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
    buscador.innerHTML = `<div class="buscador__caja" role="dialog" aria-modal="true" aria-label="${tr('Buscar en la referencia')}">
      <div class="buscador__entrada">${ICONOS.buscar}<input type="search" placeholder="${tr('Busca un término, una tabla o una regla…')}" aria-label="${tr('Buscar')}" autocomplete="off"><kbd>Esc</kbd></div>
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
        : todos.filter((i) => i.donde !== tr('Glosario')).slice(0, 10);
      activo = 0;
      lista.innerHTML = resultados.length ? resultados.map((r, i) => `<li><a href="${r.href}" class="${i === 0 ? 'activo' : ''}"><span class="donde">${r.donde}</span><strong>${resaltar(r.t, q)}</strong>${r.d ? `<p>${resaltar(r.d, q)}</p>` : ''}</a></li>`).join('')
        : `<li class="buscador__vacio">${tr('Nada con ese nombre. Prueba con el término en inglés.')}</li>`;
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
  capitulos();
  pie();
  enlazarGlosario();
  window.Comun = { guardar, leer, CAPITULOS, RANGOS, lecciones, marcarLeccion, rango, enlazar: (c) => enlazar(c, true) };
})();
