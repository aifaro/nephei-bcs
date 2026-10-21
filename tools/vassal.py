# Genera public/js/juegos-<juego>.js y public/fichas/<juego>/ a partir del módulo de VASSAL de un juego.
# uso (desde la raíz del repo): python tools/vassal.py <juego> "<ruta del .vmod>" [--hojas <carpeta>]
#   juegos: ip (Inflection Point), arr (Arracourt), df (Danger Forward), vot (Valley of Tears, solo el Golán)
#
# Del módulo salen las formaciones, los nombres, los pasos, las imágenes de cada cara, los chits de
# activación y, de las partidas .vsav que trae, qué unidades y chits usa cada escenario. Los valores
# impresos (AV, AR, alcance, MA) no están en el módulo: se leyeron a ojo de cada ficha y están en
# tools/valores/<juego>.txt, numerados en el orden en que este script recorre las unidades.
# Con --hojas hace hojas de contacto numeradas (anverso | reverso) para transcribir esos valores.
import json, os, re, sys, zipfile
sys.stdout.reconfigure(encoding='utf-8')
juego, vmod = sys.argv[1], sys.argv[2]
hojas = sys.argv[sys.argv.index('--hojas') + 1] if '--hojas' in sys.argv else None
aqui = os.path.dirname(os.path.abspath(__file__))
pub = os.path.join(aqui, '..', 'public')

# Por juego: nombre, bandos (el primero es el bando 0 de la partida) y a cuál va cada rama del módulo,
# mapa de cada rama (si hay varios), escenarios (archivo .vsav, nombre) y si solo entran las
# unidades que salen en esos escenarios.
JUEGOS = {
    'ip': dict(nombre='Inflection Point', bandos=['URSS', 'Alemania'],
               bando={'Russian': 0, 'Chir Russians': 0, 'German': 1, 'Chir Germans': 1},
               mapa={'German': 'Kalach', 'Russian': 'Kalach', 'Chir Germans': 'Chir', 'Chir Russians': 'Chir'},
               escenarios=[('Kalach 5.1.vsav', 'Kalach 5.1'), ('Kalach 5.2.vsav', 'Kalach 5.2'),
                           ('Chir 5.1.vsav', 'Chir 5.1'), ('Chir 5.2.vsav', 'Chir 5.2')]),
    'arr': dict(nombre='Arracourt', bandos=['Aliados', 'Alemania'], bando={'Allies': 0, 'Axis': 1},
                escenarios=[('Arracourt Campaign.vsav', 'Campaign'), ('Arracourt 5.2 Saga Pz Bdes.vsav', '5.2 Saga of the Panzer Brigades'),
                            ('Arracourt 5.3 Luneville.vsav', '5.3 Lunéville'), ('Arracourt 5.4 Patton Vanguard.vsav', '5.4 Patton’s Vanguard'),
                            ('Arracourt 5.5 Battle Arracourt.vsav', '5.5 The Battle of Arracourt'), ('Arracourt 5.6 Ghost Division.vsav', '5.6 Ghost Division')]),
    'df': dict(nombre='Danger Forward', bandos=['EE. UU.', 'Eje'], bando={'American': 0, 'Axis': 1},
               escenarios=[('Gela 5.1 Setupa.vsav', 'Gela 5.1'), ('Gela 5.2 Setupa.vsav', 'Gela 5.2'), ('Gela 5.3 Setupa.vsav', 'Gela 5.3'),
                           ('Gela 5.4 Setupa.vsav', 'Gela 5.4'), ('Gela 5.5 Setupa.vsav', 'Gela 5.5')]),
    'vot': dict(nombre='Valley of Tears', bandos=['Israel', 'Árabes'],
                bando={'Israeli': 0, 'Syrian': 1, 'Iraqi': 1, 'Jordanian': 1, 'Arab Minor': 1},
                escenarios=[('VoT 6.3.vsav', '6.3 Syrians at the Border'), ('VoT 6.4.vsav', '6.4 Duel for the Golan'),
                            ('VoT 6.5.vsav', '6.5 Iraqi Intervention')], solo_escenarios=True),
}
J = JUEGOS[juego]
z = zipfile.ZipFile(vmod)
s = z.read('buildFile.xml').decode('utf8')

# ---------- Piezas de la ventana de fichas, con su ruta de pestañas y listas ----------
i = s.index('<VASSAL.build.module.PieceWindow'); j = s.index('</VASSAL.build.module.PieceWindow>', i)
pila, piezas = [], []
for m in re.finditer(r'<(/?)VASSAL\.build\.widget\.(PanelWidget|ListWidget|TabWidget|BoxWidget|PieceSlot)([^>]*?)(/?)>([^<]*)', s[i:j]):
    cierre, tipo, attrs, auto, cuerpo = m.groups()
    nm = re.search(r'entryName="([^"]*)"', attrs); nm = nm.group(1).replace('&amp;', '&') if nm else ''
    if tipo == 'PieceSlot':
        if cierre: continue
        protos = re.findall(r'prototype;([^\t\\]+)', cuerpo)
        pares = re.findall(r'([\w() .-]+\.(?:png|gif|jpg)),([\w() .-]+\.(?:png|gif|jpg))', cuerpo)
        sueltas = re.findall(r'([\w() .-]+\.(?:png|gif|jpg))', cuerpo)
        if not pares:   # imagen base en el rasgo piece y el reverso como capa Flip con la primera vacía (Danger Forward)
            base = re.search(r'piece;;;([\w() .-]+\.(?:png|gif|jpg));', cuerpo)
            capa = re.search(r'emb2;Flip;[^	]*?;,([\w() .-]+\.(?:png|gif|jpg));', cuerpo)
            if base and capa: pares = [(base.group(1), capa.group(1))]
        piezas.append(dict(ruta=[x for x in pila if x], nombre=re.sub(r'\s+', ' ', nm).strip(), bruto=nm, protos=protos,
                           img=list(pares[0]) if pares else sueltas[:1], todas=sueltas,
                           pasos=next((int(p.split()[0]) for p in protos if re.match(r'\d+ Steps?$', p)), 1)))
    elif cierre: pila.pop()
    elif not auto: pila.append(nm)

def bando(p):
    return next((J['bando'][r] for r in p['ruta'] if r in J['bando']), None)
NO_COMBATE = re.compile(r'Markers|Mats|Activation|Order|^Air$|Arab Air|Naval|SAM')
def es_chit(p): return re.search(r'Act(ivation)? Markers', p['ruta'][-1]) is not None
def es_combate(p):
    return (bando(p) is not None and not any(NO_COMBATE.search(r) for r in p['ruta'])
            and not any('HQ' in x for x in p['protos']) and not re.search(r'\bHQ\b', p['nombre']) and not re.search(r'(Train|\bCT)$', p['nombre']))

# ---------- Escenarios: qué piezas hay en cada partida guardada ----------
def descifrar(b):
    if not b.startswith(b'!VCSK'): return b.decode('utf8', 'replace')
    k = int(b[5:7], 16); h = b[7:]
    return bytes(int(h[x:x + 2], 16) ^ k for x in range(0, len(h) - 1, 2)).decode('utf8', 'replace')
en_partida = []
for archivo, _ in J['escenarios']:
    txt = descifrar(zipfile.ZipFile(z.open(archivo)).read('savedGame'))
    nombres = {m.replace('\\/', '/') for m in re.findall(r'piece;;;[^;\t]*;((?:[^/\\\t]|\\/)*)/', txt)}
    en_partida.append({k for k, p in enumerate(piezas) if p['bruto'] in nombres})
todas_en_partida = set().union(*en_partida)

unidades = [k for k, p in enumerate(piezas) if es_combate(p) and (not J.get('solo_escenarios') or k in todas_en_partida)]
num = {k: n for n, k in enumerate(unidades)}

# ---------- Formaciones: chit de activación (o, si no tiene, su HQ) ----------
def fichas_de(texto): return set(re.findall(r'[a-z]+|\d+', texto.lower().replace('/', ' ')))
formaciones = {}
for k in unidades:
    p = piezas[k]
    formaciones.setdefault(p['ruta'][-1], dict(bando=bando(p), mapa=J.get('mapa', {}).get(p['ruta'][0], ''), chit=None, hq=None))
chits = [k for k, p in enumerate(piezas) if es_chit(p)]
from collections import Counter
comunes = Counter(im for k in chits for im in set(piezas[k]['todas']))
chit_de = {}
GENERICAS = {'div', 'bde', 'grp', 'arm', 'inf', 'tk', 'mech', 'mtn', 'cav', 'pz', 'kg', 'corps', 'rfl', 'gd'}
def peso(t): return sum(1 if x in GENERICAS else 2 for x in t)
for k in chits:
    p = piezas[k]
    # El anverso del chit (el reverso suele ser el mismo para todo un bando)
    propia = (next((im for im in p['todas'] if re.search(r'(-f_|F_)\d', im)), None)
              or next((im for im in p['todas'] if comunes[im] == 1), None) or (p['todas'][0] if p['todas'] else None))
    t = fichas_de(re.sub(r'\s*Chit$', '', p['nombre']))
    nums = {x for x in t if x.isdigit()}
    cands = [f for f, d in formaciones.items() if d['bando'] == bando(p) and nums <= fichas_de(f) and peso(fichas_de(f) & t) >= 2]
    if len(cands) > 1 and J.get('mapa'):
        cands = [f for f in cands if formaciones[f]['mapa'] == J['mapa'].get(p['ruta'][0])] or cands
    if cands and propia:
        f = max(cands, key=lambda f: (peso(fichas_de(f) & t), -len(fichas_de(f) - t)))
        nota = peso(fichas_de(f) & t)
        if nota > formaciones[f].get('nota', 0):          # cada formación se queda con el chit que mejor le encaja
            for k2 in [k2 for k2, f2 in chit_de.items() if f2 == f]: del chit_de[k2]
            formaciones[f]['chit'] = propia; formaciones[f]['nota'] = nota; chit_de[k] = f
for k, p in enumerate(piezas):
    if bando(p) is not None and (any('HQ' in x for x in p['protos']) or re.search(r'\bHQ\b', p['nombre'])) and p['ruta'][-1] in formaciones:
        formaciones[p['ruta'][-1]]['hq'] = formaciones[p['ruta'][-1]]['hq'] or p['img'][0]

# ---------- Hojas de contacto ----------
if hojas:
    from PIL import Image, ImageDraw, ImageFont
    import io
    os.makedirs(hojas, exist_ok=True)
    W, POR, COLS = 225, 24, 6
    font = ImageFont.truetype('arial.ttf', 22)
    for h in range(0, len(unidades), POR):
        grupo = unidades[h:h + POR]
        im = Image.new('RGB', (COLS * (2 * W + 16), ((len(grupo) + COLS - 1) // COLS) * (W + 34)), 'white')
        dr = ImageDraw.Draw(im)
        for x0, k in enumerate(grupo):
            p = piezas[k]; x = (x0 % COLS) * (2 * W + 16); y = (x0 // COLS) * (W + 34)
            dr.text((x + 4, y + 4), f"#{num[k]} {p['nombre'][:24]} ({p['pasos']})", fill='black', font=font)
            for c, nombre_img in enumerate((p['img'] + p['img'])[:2] if len(p['img']) == 1 else p['img']):
                if len(p['img']) == 1 and c == 1: continue
                f = Image.open(io.BytesIO(z.read('images/' + nombre_img))).convert('RGB').resize((W, W), Image.LANCZOS)
                im.paste(f, (x + c * W, y + 32))
        im.save(os.path.join(hojas, f'{juego}-{h // POR:02d}.png'))
    print('hojas:', (len(unidades) + POR - 1) // POR)
    for f, d in formaciones.items(): print('  ', f, d)
    sys.exit()

# ---------- Valores leídos de las fichas ----------
valores = {}
for l in open(os.path.join(aqui, 'valores', juego + '.txt'), encoding='utf8'):
    m = re.match(r'(\d+):\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(\S*)\s*$', l)
    if m: valores[int(m.group(1))] = (m.group(2), m.group(3), m.group(4))
assert len(valores) == len(unidades), (len(valores), len(unidades))

# ---------- Salida ----------
dest = os.path.join(pub, 'fichas', juego)
os.makedirs(dest, exist_ok=True)
def copiar(im):
    if im:
        with open(os.path.join(dest, im), 'wb') as f: f.write(z.read('images/' + im))
    return im
filas = []
for k in unidades:
    p = piezas[k]; n = num[k]
    d, mv, rasgos = valores[n]
    recon = any('Recon' in x for x in p['protos']) or bool(re.search(r'\b(Krd|Aufk)\b', p['nombre']))
    img = p['img'][::-1] if 'I' in rasgos and len(p['img']) > 1 else p['img']   # I: el módulo da primero la cara de movimiento
    rasgos = rasgos.replace('I', '')
    caras = [img[0], img[1] if mv != '-' and len(img) > 1 else img[0]]
    for im in set(caras): copiar(im)
    filas.append([n, bando(p), formaciones[p['ruta'][-1]]['mapa'], p['ruta'][-1], p['nombre'], p['pasos'], caras[0], caras[1], d, mv, rasgos + ('R' if recon else '')])
forms = {f: [d['bando'], d['mapa'], copiar(d['chit']), copiar(d['hq'])] for f, d in formaciones.items()}
escenarios = []
for (archivo, nombre), ks in zip(J['escenarios'], en_partida):
    us = [num[k] for k in unidades if k in ks]
    con_chit = [chit_de[k] for k in chits if k in ks and k in chit_de]
    lados = [[], []]
    for f in dict.fromkeys(con_chit): lados[formaciones[f]['bando']].append(f)
    escenarios.append({'id': re.sub(r'[^a-z0-9.]+', '-', nombre.lower()).strip('-'), 'nombre': nombre, 'bandos': lados, 'unidades': us})

js = [f"// Generado por tools/vassal.py desde el módulo de VASSAL de {J['nombre']} (© MMP / The Gamers). No editar a mano:",
      f'// los valores de las fichas están en tools/valores/{juego}.txt.',
      '// Unidad: [n, bando, mapa, formación, nombre, pasos, imagen d, imagen m, cara d, cara m, rasgos]',
      '// Caras: A flecha de asalto · R/L/S/W AV rojo, limited, stand off o light · a AR · r alcance (si va impreso)',
      '// · T/K/P MA táctico, camión o a pie · SUP cara de apoyo · - sin reverso. Rasgos: H hard, B ruptura, R reconocimiento.',
      '// Formación: [bando, mapa, chit de activación, HQ]. Escenario: formaciones con chit de cada bando y unidades que salen.',
      '(function (root) {', "  'use strict';",
      f"  (root.JUEGOS_DATOS = root.JUEGOS_DATOS || {{}}).{juego} = {{",
      f"    nombre: {json.dumps(J['nombre'], ensure_ascii=False)},",
      f"    bandos: {json.dumps(J['bandos'], ensure_ascii=False)},",
      '    formaciones: ' + json.dumps(forms, ensure_ascii=False) + ',',
      '    escenarios: [', *['      ' + json.dumps(e, ensure_ascii=False) + ',' for e in escenarios], '    ],',
      '    unidades: [', *['      ' + json.dumps(f, ensure_ascii=False) + ',' for f in filas], '    ]', '  };', '})(window);', '']
open(os.path.join(pub, 'js', f'juegos-{juego}.js'), 'w', encoding='utf8', newline='\n').write('\n'.join(js))
print(len(filas), 'unidades;', len(os.listdir(dest)), 'imágenes;', sum(1 for d in forms.values() if d[2]), 'de', len(forms), 'formaciones con chit')
for e in escenarios: print('  ', e['nombre'], [len(x) for x in e['bandos']], len(e['unidades']), 'unidades')
