// Sobres de órdenes (2.4): el sobre lacrado, el borrador que rellena el jugador y la carta
// del Estado Mayor que sale al abrirlo. Solo construye HTML; el estado lo lleva partida.js.
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = root.I18N.t;
  const RAIZ = root.I18N.raiz;

  // Variante fija para cada formación y turno: la carta no cambia cada vez que se abre
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const elegir = (lista, semilla, sal) => lista[hash(semilla + '·' + sal) % lista.length];

  const SITUACION = [
    'El enemigo mantiene la presión en todo el frente. Los informes de reconocimiento señalan movimientos de vehículos en los accesos a su sector.',
    'La situación general no ha cambiado de forma sensible desde el último parte. Se esperan contactos en las próximas horas.',
    'Las comunicaciones con las unidades vecinas son irregulares. Reduzca al mínimo las transmisiones por radio.',
    'Los partes de la noche indican actividad de patrullas enemigas frente a su línea. Las formaciones de los flancos mantienen sus posiciones.',
    'La artillería apoyará según disponibilidad. No cuente con refuerzos inmediatos: el esfuerzo principal está en otro sector.',
    'El tiempo ha empeorado y los caminos están cargados de tráfico. Prevea retrasos en el suministro.'
  ];
  const MISION = {
    hq: [
      'Trasladará su cuartel general por la ruta que se indica hasta su punto final. Al activarse, fije allí el objetivo de marcha y avance hacia él sin apartarse del itinerario: puede quedarse corto, pero no cambiar de dirección.',
      'Se ordena el desplazamiento de su puesto de mando siguiendo el itinerario adjunto, sin desviarse de él. Sus unidades mantendrán el enlace dentro del radio de mando durante el movimiento.'
    ],
    no: [
      'Sin cambios en su misión. El cuartel general permanecerá en su emplazamiento actual y solo lo abandonará en retirada voluntaria si la situación lo exige. Sus unidades actuarán según su criterio dentro del radio de mando.',
      'No hay órdenes nuevas para su formación. Mantenga el puesto de mando donde está; sus batallones conservan plena libertad de acción.',
      'Este Estado Mayor no tiene instrucciones particulares para usted en esta fase. El cuartel general no se moverá. Consolide, informe y esté preparado para recibir nuevas órdenes.'
    ],
    pd: [
      'Organizará el terreno en defensa preparada. Al activarse, la formación establecerá o mantendrá la defensa y no podrá renunciar a ella; el cuartel general no hará retirada voluntaria.',
      'Resistirá en sus posiciones actuales. Atrinchérese, cubra sus flancos y no ceda terreno sin orden expresa: la defensa preparada es obligatoria y el cuartel general no se retirará.'
    ],
    rec: [
      'Su formación dedicará su próxima activación a reponerse: recupere a la tropa, reorganice las unidades y restablezca el suministro.',
      'Se concede un respiro a su formación. Aproveche la activación para descansar a la tropa y recuperar su capacidad de combate.'
    ]
  };
  // Párrafo de más cuando la orden es escueta
  const RELLENO = [
    'Aproveche la pausa para revisar el estado de sus unidades y remitir a este Cuartel General un parte de bajas y de municiones.',
    'Mantenga patrullas en contacto con el enemigo y comunique de inmediato cualquier movimiento de importancia.',
    'Se recuerda la obligación de mantener la disciplina de luces y de ruidos durante la noche.'
  ];
  const CIERRE = [
    'Acuse recibo por el enlace. Cumpla.',
    'Destruya este documento una vez leído.',
    'Informe de la ejecución a este Cuartel General.',
    'Sin más novedades. Buena suerte.'
  ];
  const NOMBRE = { hq: 'Mover HQ', no: 'Sin órdenes', pd: 'Defensa preparada', rec: 'Recuperación' };

  // Textos de la carta para una orden { o, ruta, nota }
  function texto(v, f, turno) {
    const s = f.id + '·' + turno;
    const mision = v.o.map((k, i) => (i ? tr('Además: ') : '') + tr(elegir(MISION[k], s, k)));
    const escueta = v.o.length === 1 && v.o[0] === 'no' && !v.nota;
    return {
      situacion: tr(elegir(SITUACION, s, 'sit')),
      mision,
      relleno: escueta ? tr(elegir(RELLENO, s, 'rel')) : '',
      ruta: v.o.includes('hq') ? (v.ruta || tr('Itinerario sin especificar: confírmelo con este Cuartel General antes de mover.')) : '',
      nota: v.nota || '',
      cierre: tr(elegir(CIERRE, s, 'fin')),
      asunto: v.o.map((k) => tr(NOMBRE[k])).join(' + ')
    };
  }

  // Lacre: una gota irregular con el sello en relieve. Las dos mitades se separan al romperlo.
  const gota = (id) => `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="lg${id}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#d4473b"/><stop offset=".55" stop-color="#9c1d17"/><stop offset="1" stop-color="#5c0b08"/></radialGradient></defs>
    <path d="M50 3c9 0 13 6 21 7s12 6 14 13 9 11 9 20-5 13-5 20-6 13-13 17-13 5-20 9-13 6-21 2-9-6-16-9-12-9-13-17-7-13-6-21 1-12 5-18 6-11 13-14 13-9 21-9z" fill="url(#lg${id})"/>
    <circle cx="50" cy="50" r="28" fill="none" stroke="#5c0b08" stroke-width="3" opacity=".55"/>
    <circle cx="50" cy="50" r="28" fill="none" stroke="#ef7a6c" stroke-width="1.2" opacity=".5" transform="translate(-1 -1)"/>
    <path d="M50 31l5.3 11.6 12.7 1.4-9.4 8.6 2.6 12.5L50 58.8l-11.2 6.3 2.6-12.5-9.4-8.6 12.7-1.4z" fill="#6e100c" opacity=".75"/>
    <path d="M50 31l5.3 11.6 12.7 1.4-9.4 8.6 2.6 12.5L50 58.8l-11.2 6.3 2.6-12.5-9.4-8.6 12.7-1.4z" fill="none" stroke="#f08b7e" stroke-width=".8" opacity=".55" transform="translate(-.8 -.8)"/>
    <ellipse cx="34" cy="26" rx="12" ry="6" fill="#fff" opacity=".18" transform="rotate(-30 34 26)"/></svg>`;
  const lacre = (id) => `<div class="lacre" aria-hidden="true"><div class="lacre__mitad lacre__mitad--izq">${gota(id + 'a')}</div><div class="lacre__mitad lacre__mitad--der">${gota(id + 'b')}</div></div>`;
  // El chit de activación de la formación hace de sello de correos
  const sello = (f) => f.icono ? `<span class="sobre__sello"><img src="${RAIZ + f.icono}" alt="" draggable="false"></span>` : '';

  // d: { f, bando (nombre), turno, abierto, mini }
  function sobre(d) {
    const { f } = d;
    return `<div class="sobre${d.abierto ? ' sobre--abierto' : ''}${d.mini ? ' sobre--mini' : ''}" data-sobre="${esc(f.id)}">
      <div class="sobre__fondo"></div>
      <div class="sobre__papel"><i></i><i></i><i></i></div>
      <div class="sobre__frente">
        <span class="sobre__clasif">${tr('Secreto')}</span>
        ${sello(f)}
        <div class="sobre__dest">
          <small>${tr('Estado Mayor · {x}', { x: esc(d.bando) })}</small>
          <span>${tr('Al comandante de')}</span>
          <strong>${esc(f.nombre)}</strong>
          <em>${tr('Turno {n} · Abrir al activarse', { n: d.turno })}</em>
        </div>
      </div>
      <div class="sobre__solapa"></div>
      ${lacre(esc(f.id) + (d.mini ? 'm' : ''))}
    </div>`;
  }

  const escudo = `<svg class="carta__escudo" viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 37 8v14c0 11-7 18-17 22C10 40 3 33 3 22V8z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M20 12l2.9 6.4 7 .7-5.2 4.7 1.5 6.9L20 27.2l-6.2 3.5 1.5-6.9-5.2-4.7 7-.7z" fill="currentColor"/></svg>`;
  const firma = `<svg class="carta__rubrica" viewBox="0 0 220 60" aria-hidden="true"><path d="M8 42c14-30 22-34 24-24s-8 26-2 24 14-30 20-26-6 22 0 22 10-18 16-18-2 16 4 16 8-12 14-12 0 10 6 10 12-16 20-14-4 14 4 12 22-10 30-8M30 50c40-6 90-10 170-12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const numero = (d) => `${d.turno}/${String(d.n + 1).padStart(2, '0')}`;
  function membrete(d, tampon) {
    return `<header class="carta__membrete">${escudo}<div><b>${tr('Cuartel General · {x}', { x: esc(d.bando) })}</b><span>${tr('Estado Mayor · Sección de Operaciones')}</span></div><span class="tampon tampon--clasif">${tampon}</span></header>`;
  }
  const datos = (d, asunto) => `<dl class="carta__datos">
      <dt>${tr('Orden n.º')}</dt><dd>${numero(d)}</dd>
      <dt>${tr('Fecha')}</dt><dd>${tr('Turno {n}', { n: d.turno })}</dd>
      <dt>${tr('A')}</dt><dd>${tr('Comandante, {x}', { x: esc(d.f.nombre) })}</dd>
      ${asunto !== undefined ? `<dt>${tr('Asunto')}</dt><dd class="carta__asunto">${asunto}</dd>` : ''}
    </dl>`;

  // La carta: d = { f, bando, turno, n, v }
  function carta(d) {
    const t = texto(d.v, d.f, d.turno);
    let k = 1;
    const sec = (tit, cuerpo) => `<h4>${k++}. ${tit}</h4>${cuerpo}`;
    return `<article class="carta" data-carta="${esc(d.f.id)}">
      ${membrete(d, tr('Secreto'))}
      ${datos(d, esc(t.asunto))}
      <div class="carta__cuerpo">
        ${sec(tr('Situación'), `<p data-maquina>${esc(t.situacion)}</p>`)}
        ${sec(tr('Misión'), t.mision.map((m) => `<p data-maquina>${esc(m)}</p>`).join('') + (t.relleno ? `<p data-maquina>${esc(t.relleno)}</p>` : ''))}
        ${t.ruta ? sec(tr('Itinerario'), `<p data-maquina class="carta__ruta">${esc(t.ruta)}</p>`) : ''}
        ${t.nota ? sec(tr('Observaciones'), `<p data-maquina class="carta__nota">${esc(t.nota)}</p>`) : ''}
        <p data-maquina class="carta__cierre">${esc(t.cierre)}</p>
      </div>
      <footer class="carta__firma"><span>${tr('Por orden del Jefe del Estado Mayor')}</span>${firma}<span>${tr('El Jefe de Operaciones')}</span></footer>
      <span class="tampon tampon--orden">${esc(t.asunto)}</span>
    </article>`;
  }

  // El borrador que rellena el jugador: d = { f, bando, turno, n, v, ordenes: { k: nombre } }
  function borrador(d) {
    const v = d.v;
    return `<article class="carta carta--borrador" data-borrador="${esc(d.f.id)}">
      ${membrete(d, tr('Borrador'))}
      ${datos(d)}
      <div class="borrador__ordenes" role="group" aria-label="${tr('Orden de {x}', { x: esc(d.f.nombre) })}">
        ${Object.entries(d.ordenes).map(([k, o]) => `<button type="button" class="casilla" data-o="${k}" aria-pressed="${v.o.includes(k)}"><span class="casilla__caja" aria-hidden="true"></span>${o}</button>`).join('')}
      </div>
      <p class="borrador__regla">${tr('Solo Defensa preparada y Recuperación se pueden combinar (2.4a).')}</p>
      ${v.o.includes('hq') ? `<label class="borrador__campo"><span>${tr('Itinerario del HQ')}</span><input type="text" class="manuscrito" data-campo="ruta" value="${esc(v.ruta || '')}" placeholder="${tr('por 12.08 y 15.10 hasta 18.12')}" maxlength="160"></label>` : ''}
      <label class="borrador__campo"><span>${tr('Observaciones')}</span><input type="text" class="manuscrito" data-campo="nota" value="${esc(v.nota || '')}" placeholder="${tr('intención, objetivos…')}" maxlength="200"></label>
    </article>`;
  }

  root.Sobres = { sobre, carta, borrador, texto, lacre };
})(typeof window !== 'undefined' ? window : globalThis);
