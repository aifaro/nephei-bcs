// Efectos de mesa para las utilidades de partida: sonidos sintetizados (sin archivos),
// fichas que vuelan de un sitio a otro, chispas y texto a máquina de escribir.
// El sonido se puede apagar; la preferencia se guarda en localStorage, en 'bcs-sonido'.
(function (root) {
  'use strict';
  const CLAVE = 'bcs-sonido';
  const quieto = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let activo = true;
  try { activo = root.localStorage.getItem(CLAVE) !== 'no'; } catch (e) { /* sin almacenamiento */ }

  // ---------- Sonido ----------
  let ac = null, ruido = null;
  function ctx() {
    if (!activo) return null;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    if (!ac) {
      ac = new AC();
      ruido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = ruido.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  // Ráfaga de ruido filtrado: la base de golpes, roces y papel
  function rafaga(a, t, { dur = 0.05, vol = 0.3, f = 2000, q = 1, tipo = 'bandpass', f2 } = {}) {
    const src = a.createBufferSource(), fil = a.createBiquadFilter(), g = a.createGain();
    src.buffer = ruido;
    fil.type = tipo;
    fil.frequency.setValueAtTime(f, t);
    if (f2) fil.frequency.exponentialRampToValueAtTime(f2, t + dur);
    fil.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fil).connect(g).connect(a.destination);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function tono(a, t, { f = 440, f2, dur = 0.2, vol = 0.2, tipo = 'sine' } = {}) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const SONIDOS = {
    // Fichas de cartón chocando dentro del saco
    sacudir(a, t, n = 18, dur = 0.65) {
      for (let i = 0; i < n; i++) rafaga(a, t + Math.random() * dur, { dur: 0.025 + Math.random() * 0.03, vol: 0.12 + Math.random() * 0.18, f: 1800 + Math.random() * 2600, q: 2.5 });
      rafaga(a, t, { dur, vol: 0.05, f: 600, q: 0.7 });
    },
    // Una ficha cae sobre la mesa
    clac(a, t) {
      rafaga(a, t, { dur: 0.045, vol: 0.5, f: 2600, q: 1.8 });
      tono(a, t, { f: 210, f2: 120, dur: 0.07, vol: 0.18, tipo: 'triangle' });
    },
    // Una ficha vuelve al saco
    plop(a, t) {
      rafaga(a, t, { dur: 0.08, vol: 0.25, f: 900, q: 1.2, f2: 400 });
      rafaga(a, t + 0.05, { dur: 0.03, vol: 0.12, f: 3000, q: 3 });
    },
    // Se activa una formación
    activar(a, t) {
      tono(a, t, { f: 523, dur: 0.18, vol: 0.12, tipo: 'triangle' });
      tono(a, t + 0.09, { f: 784, dur: 0.22, vol: 0.12, tipo: 'triangle' });
      tono(a, t + 0.18, { f: 1047, dur: 0.4, vol: 0.1, tipo: 'sine' });
    },
    // El sello cae sobre el lacre caliente
    lacre(a, t) {
      tono(a, t, { f: 140, f2: 55, dur: 0.22, vol: 0.45 });
      rafaga(a, t, { dur: 0.09, vol: 0.35, f: 700, q: 0.8, tipo: 'lowpass' });
      rafaga(a, t + 0.04, { dur: 0.35, vol: 0.05, f: 5000, q: 0.5, tipo: 'highpass' });
    },
    // Se rompe el lacre
    romper(a, t) {
      rafaga(a, t, { dur: 0.06, vol: 0.45, f: 3200, q: 2 });
      rafaga(a, t + 0.05, { dur: 0.04, vol: 0.3, f: 2200, q: 3 });
      rafaga(a, t + 0.1, { dur: 0.03, vol: 0.2, f: 4200, q: 3 });
    },
    // Papel que se desliza o se dobla
    papel(a, t, dur = 0.45) {
      rafaga(a, t, { dur, vol: 0.16, f: 1200, f2: 4500, q: 0.6 });
    },
    // Tecla de la máquina de escribir
    tecla(a, t) {
      rafaga(a, t, { dur: 0.018, vol: 0.22 + Math.random() * 0.1, f: 3200 + Math.random() * 1500, q: 4 });
      tono(a, t, { f: 90, dur: 0.03, vol: 0.06, tipo: 'square' });
    },
    // Fin de línea: la campanilla del carro
    campanilla(a, t) {
      tono(a, t, { f: 2093, dur: 0.5, vol: 0.07 });
      tono(a, t, { f: 3136, dur: 0.35, vol: 0.03 });
    }
  };
  function sonar(nombre, retraso, ...args) {
    const a = ctx();
    if (!a || !SONIDOS[nombre]) return;
    try { SONIDOS[nombre](a, a.currentTime + (retraso || 0) / 1000, ...args); } catch (e) { /* audio no disponible */ }
  }
  function sonido(v) {
    if (v !== undefined) {
      activo = !!v;
      try { root.localStorage.setItem(CLAVE, activo ? 'si' : 'no'); } catch (e) { /* sin almacenamiento */ }
    }
    return activo;
  }

  // ---------- Movimiento ----------
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  // Lleva una copia de `html` desde el rectángulo `desde` al rectángulo `hasta` por un arco.
  // voltear: sale boca abajo (el dorso) y se da la vuelta en el aire.
  function volar({ html, desde, hasta, dur = 700, arco = 80, giro = 0, voltear = false, dorso = '', escalaIni, escalaFin = 1, retraso = 0, clase = '' }) {
    if (quieto() || !desde || !hasta) return Promise.resolve();
    const el = root.document.createElement('div');
    el.className = 'vuelo ' + clase;
    el.innerHTML = `<div class="vuelo__giro"><div class="vuelo__cara">${html}</div>${voltear ? `<div class="vuelo__dorso">${dorso}</div>` : ''}</div>`;
    Object.assign(el.style, { left: hasta.left + 'px', top: hasta.top + 'px', width: hasta.width + 'px', height: hasta.height + 'px' });
    root.document.body.appendChild(el);
    const a = centro(desde), b = centro(hasta);
    const s0 = escalaIni !== undefined ? escalaIni : Math.max(0.2, Math.min(1.5, desde.width / Math.max(1, hasta.width)));
    // Bézier cuadrática con el punto de control por encima de los dos extremos
    const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - arco;
    const fr = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * cx + t * t * b.x - b.x;
      const y = u * u * a.y + 2 * u * t * cy + t * t * b.y - b.y;
      const s = s0 + (escalaFin - s0) * t + Math.sin(t * Math.PI) * 0.25;
      fr.push({ transform: `translate(${x}px, ${y}px) rotate(${giro * u}deg) scale(${s})`, offset: t });
    }
    const vuelo = el.animate(fr, { duration: dur, delay: retraso, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
    if (voltear) el.firstChild.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.35 }, { transform: 'rotateY(360deg)' }], { duration: dur, delay: retraso, easing: 'ease-in-out', fill: 'both' });
    return vuelo.finished.catch(() => {}).then(() => el.remove());
  }

  // Chispas que saltan desde un punto (x, y de la ventana)
  function chispas(x, y, { n = 14, color = '#f2b33d', dist = 70 } = {}) {
    if (quieto()) return;
    for (let i = 0; i < n; i++) {
      const p = root.document.createElement('span');
      p.className = 'chispa';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = color;
      root.document.body.appendChild(p);
      const ang = Math.random() * Math.PI * 2, d = dist * (0.5 + Math.random() * 0.7);
      p.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * d}px), calc(-50% + ${Math.sin(ang) * d + 20}px)) scale(.2)`, opacity: 0 }
      ], { duration: 500 + Math.random() * 350, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => p.remove(), () => p.remove());
    }
  }

  // Escribe el texto de cada elemento [data-maquina] de `cont`, letra a letra.
  // Devuelve una función que lo termina de golpe (al tocar la carta). alFin se llama al acabar.
  function maquina(cont, { total = 2400, alFin } = {}) {
    const els = [...cont.querySelectorAll('[data-maquina]')];
    const textos = els.map((e) => e.textContent);
    if (quieto() || !els.length) { if (alFin) alFin(); return () => {}; }
    const largo = textos.reduce((s, t) => s + t.length, 0);
    // Varias letras por golpe si el texto es largo: los temporizadores no bajan de ~4 ms
    const porGolpe = Math.max(1, Math.ceil(largo * 12 / total));
    const paso = 12;
    els.forEach((e) => { e.textContent = ''; e.classList.add('escribiendo'); });
    let parar = false, i = 0, j = 0, ultimaTecla = 0;
    const acabar = () => {
      if (parar) return;
      parar = true;
      els.forEach((e, k) => { e.textContent = textos[k]; e.classList.remove('escribiendo'); });
      if (alFin) alFin();
    };
    function sig() {
      if (parar) return;
      if (i >= els.length) { acabar(); return; }
      const t = textos[i];
      j = Math.min(t.length, j + porGolpe);
      els[i].textContent = t.slice(0, j);
      const ahora = performance.now();
      if (t[j - 1] !== ' ' && ahora - ultimaTecla > 55) { sonar('tecla'); ultimaTecla = ahora; }
      if (j >= t.length) {
        els[i].classList.remove('escribiendo');
        i++; j = 0;
        if (i < els.length) { els[i].classList.add('escribiendo'); sonar('campanilla'); }
        setTimeout(sig, paso * 6);
      } else setTimeout(sig, paso);
    }
    els.forEach((e, k) => { if (k) e.classList.remove('escribiendo'); });
    setTimeout(sig, 120);
    return acabar;
  }

  root.Efectos = { sonar, sonido, volar, chispas, maquina, espera, quieto };
})(typeof window !== 'undefined' ? window : globalThis);
