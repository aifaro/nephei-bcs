# Genera public/js/juegos-ip.js y public/fichas/ip/ a partir del módulo de VASSAL de Inflection Point.
# uso (desde la raíz del repo): python tools/vassal-ip.py "D:/Descargas/BCS Inflection Point-1.0.3.vmod"
#
# Del módulo salen las formaciones, los nombres, los pasos, las imágenes de cada cara y qué formaciones
# juegan cada escenario (de las partidas .vsav que trae). Los valores impresos (AV, AR, alcance, MA) no
# están en el módulo: se leyeron a ojo de cada ficha y están en tools/ip-valores.txt, en el mismo orden
# en que este script recorre las unidades (las HQ y los trenes no cuentan).
import json, os, re, sys, zipfile
sys.stdout.reconfigure(encoding='utf-8')
vmod = sys.argv[1]
aqui = os.path.dirname(os.path.abspath(__file__))
pub = os.path.join(aqui, '..', 'public')
z = zipfile.ZipFile(vmod)
s = z.read('buildFile.xml').decode('utf8')

# ---------- Piezas de la ventana de fichas: panel > formación > pieza ----------
i = s.index('<VASSAL.build.module.PieceWindow'); j = s.index('</VASSAL.build.module.PieceWindow>', i)
panel = lista = None
piezas = []
for m in re.finditer(r'<(/?)VASSAL\.build\.widget\.(PanelWidget|ListWidget|PieceSlot)([^>]*?)(/?)>([^<]*)', s[i:j]):
    cierre, tipo, attrs, _, cuerpo = m.groups()
    if cierre: continue
    nm = re.search(r'entryName="([^"]*)"', attrs); nm = nm.group(1).replace('&amp;', '&') if nm else ''
    bruto, nm = nm, re.sub(r'\s+', ' ', nm).strip()
    if tipo == 'PanelWidget': panel = nm
    elif tipo == 'ListWidget': lista = nm
    else:
        protos = re.findall(r'prototype;([^\t\\]+)', cuerpo)
        imgs = re.findall(r'(BCS-[\w-]+\.png),(BCS-[\w-]+\.png)', cuerpo)
        piezas.append(dict(panel=panel, form=lista, nombre=nm, bruto=bruto, protos=protos, img=list(imgs[0]) if imgs else [],
                           pasos=next((int(p.split()[0]) for p in protos if 'Step' in p), 1)))

BANDO = {'German': 'eje', 'Chir Germans': 'eje', 'Russian': 'sov', 'Chir Russians': 'sov'}
MAPA = {'German': 'kalach', 'Russian': 'kalach', 'Chir Germans': 'chir', 'Chir Russians': 'chir'}
unidades = [p for p in piezas if p['panel'] in BANDO and p['form'] != 'Formation Act Markers'
            and not any('HQ' in x for x in p['protos']) and not p['nombre'].endswith('Train')]
# Formaciones con chit de activación (las que entran en el saco)
chits = {(p['panel'], p['nombre'][:-5]) for p in piezas if p['form'] == 'Formation Act Markers' and p['nombre'].endswith(' Chit')}

# ---------- Valores leídos de las fichas ----------
valores = {}
for l in open(os.path.join(aqui, 'ip-valores.txt'), encoding='utf8'):
    m = re.match(r'(\d+):\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(\S*)\s*$', l)
    if m: valores[int(m.group(1))] = (m.group(2), m.group(3), m.group(4))
assert len(valores) == len(unidades), (len(valores), len(unidades))

# ---------- Escenarios: formaciones presentes en cada partida guardada ----------
def descifrar(b):
    if not b.startswith(b'!VCSK'): return b.decode('utf8', 'replace')
    k = int(b[5:7], 16); h = b[7:]
    return bytes(int(h[x:x + 2], 16) ^ k for x in range(0, len(h) - 1, 2)).decode('utf8', 'replace')

ESCENARIOS = [('kalach-5.1', 'Kalach 5.1.vsav'), ('kalach-5.2', 'Kalach 5.2.vsav'), ('chir-5.1', 'Chir 5.1.vsav'), ('chir-5.2', 'Chir 5.2.vsav')]
escenarios = []
for ident, archivo in ESCENARIOS:
    txt = descifrar(zipfile.ZipFile(z.open(archivo)).read('savedGame'))
    forms = {'eje': [], 'sov': []}
    for p in unidades:
        clave = 'piece;;;;' + p['bruto'].replace('/', '\\/') + '/'
        if clave in txt and (p['panel'], p['form']) in chits and p['form'] not in forms[BANDO[p['panel']]]:
            forms[BANDO[p['panel']]].append(p['form'])
    escenarios.append({'id': ident, 'mapa': ident.split('-')[0], 'nombre': archivo[:-5], 'eje': forms['eje'], 'sov': forms['sov']})

# ---------- Salida ----------
os.makedirs(os.path.join(pub, 'fichas', 'ip'), exist_ok=True)
filas = []
for n, p in enumerate(unidades):
    d, mv, rasgos = valores[n]
    recon = any('Recon' in x for x in p['protos']) or bool(re.search(r'\b(Krd|Aufk)\b', p['nombre']))
    caras = [p['img'][0], p['img'][1] if mv != '-' else p['img'][0]]
    for im in set(caras):
        with open(os.path.join(pub, 'fichas', 'ip', im), 'wb') as f: f.write(z.read('images/' + im))
    filas.append([n, BANDO[p['panel']], MAPA[p['panel']], p['form'], p['nombre'], p['pasos'], caras[0], caras[1], d, mv, rasgos + ('R' if recon else '')])

js = ['// Generado por tools/vassal-ip.py desde el módulo de VASSAL de Inflection Point (© MMP / The Gamers). No editar a mano:',
      '// los valores de las fichas están en tools/ip-valores.txt.',
      '// Unidad: [n, bando, mapa, formación, nombre, pasos, imagen d, imagen m, cara d, cara m, rasgos]',
      '// Caras: A flecha de asalto · R/L/S/W AV rojo, limited, stand off o light · a AR · r alcance (si va impreso)',
      '// · T/K/P MA táctico, camión o a pie · SUP cara de apoyo · - sin reverso. Rasgos: H hard, B ruptura, R reconocimiento.',
      '(function (root) {',
      "  'use strict';",
      '  (root.JUEGOS_DATOS = root.JUEGOS_DATOS || {}).ip = {',
      "    nombre: 'Inflection Point',",
      "    mapas: { kalach: 'Kalach', chir: 'Chir' },",
      '    escenarios: ' + json.dumps(escenarios, ensure_ascii=False) + ',',
      '    unidades: ['] + ['      ' + json.dumps(f, ensure_ascii=False) + ',' for f in filas] + ['    ]', '  };', '})(window);', '']
open(os.path.join(pub, 'js', 'juegos-ip.js'), 'w', encoding='utf8', newline='\n').write('\n'.join(js))
print(len(filas), 'unidades;', len(os.listdir(os.path.join(pub, 'fichas', 'ip'))), 'imágenes')
for e in escenarios: print(e['id'], len(e['eje']), 'contra', len(e['sov']), e['eje'], e['sov'])
