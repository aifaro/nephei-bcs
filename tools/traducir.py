# Genera public/en/<página> a partir de public/<página> con los pares de tr/<página>.py
# uso (desde la raíz del repo): python tools/traducir.py public <página.html>
# Reescribe public/en/<página>: los cambios hechos a mano en la versión inglesa se pierden.
import sys, re, os, runpy
pub, pag = sys.argv[1], sys.argv[2]
aqui = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(pub, pag), encoding='utf8').read()
pares = runpy.run_path(os.path.join(aqui, 'tr', pag.replace('.html', '.py')))['PARES']

fallos = []
for a, b in pares:
    if a not in s:
        fallos.append(a[:90])
        continue
    s = s.replace(a, b)

# Rutas: la página vive en /en/
s = s.replace('<html lang="es">', '<html lang="en">')
s = re.sub(r'(href|src)="(css|js|fichas)/', r'\1="../\2/', s)
s = s.replace('href="favicon.svg"', 'href="../favicon.svg"')
s = re.sub(r"(['\"`])fichas/", r"\1../fichas/", s)          # rutas dentro de los scripts
s = s.replace('<script src="../js/i18n.js"></script>', '<script src="../js/en.js"></script>\n<script src="../js/i18n.js"></script>')
os.makedirs(os.path.join(pub, 'en'), exist_ok=True)
open(os.path.join(pub, 'en', pag), 'w', encoding='utf8', newline='\n').write(s)

# Castellano que se haya quedado sin traducir (texto visible y cadenas de los scripts)
txt = re.sub(r'<(style|svg)[^>]*>.*?</\1>', ' ', s, flags=re.S)
txt = re.sub(r'<[^>]+>', '\n', txt)
sosp = []
for l in txt.split('\n'):
    l = l.strip()
    if re.search(r'[áéíóúñ¿¡]|\b(de|la|el|los|las|del|una|que|por|para|con|sin|cada|unidad|unidades)\b', l):
        sosp.append(l[:120])
print(f'{pag}: {len(pares) - len(fallos)}/{len(pares)} pares')
for f in fallos: print('  NO ENCONTRADO:', f)
for l in sosp[:60]: print('  ¿ES?:', l)
