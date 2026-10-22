"""Builds the Argentine site (/argentina) from the Mexican one.

Reads public/assets/index-mx.js and public/mexico/index.html (run
tools/build-mx.py first) and writes public/assets/index-ar.js,
public/argentina/index.html and lib/catalog-ar.json: Rioplatense Spanish (voseo),
prices in ARS and no Mexican payment methods. Argentine payments are not
connected yet: the checkout shows the offer and the server answers that paying
is not enabled. Every replacement must match the expected number of times.
Run after the Mexican build:  python3 tools/build-mx.py && python3 tools/build-ar.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
js = (PUBLIC / 'assets/index-mx.js').read_text()

# Provisional prices in ARS cents, until the real Argentine values arrive.
PRICES = {
    'main': 790000, 'main_old': 1990000,
    'bump': 290000, 'bump_old': 790000,
    'upsells': {'video': (590000, 1290000), 'vip': (1290000, 2990000), 'whatsapp': (890000, None),
                'memoria': (590000, None), 'album': (490000, None), 'editar': (390000, None)},
}


def ars(cents):
    return '$ ' + f'{cents // 100:,}'.replace(',', '.')


def sub(old, new, count=1):
    global js
    found = js.count(old)
    if found != count:
        sys.exit(f'expected {count}x, found {found}x: {old[:100]!r}')
    js = js.replace(old, new)


def replace_block(start, end_marker, new):
    """Replaces from `start` up to and including `end_marker`."""
    global js
    if js.count(start) != 1:
        sys.exit(f'block start not unique: {start[:80]!r}')
    a = js.index(start)
    b = js.index(end_marker, a) + len(end_marker)
    js = js[:a] + new + js[b:]


# --- Country, language, money and own storage --------------------------------------
sub('[o,a]=w.useState("MX")', '[o,a]=w.useState("AR")')
sub('document.documentElement.lang="es-MX"', 'document.documentElement.lang="es-AR"')
sub('if(e==="latam")return{url:"",price:"MX$ 99",priceOld:"MX$ 249"};',
    f'if(e==="latam")return{{url:"",price:"{ars(PRICES["main"])}",priceOld:"{ars(PRICES["main_old"])}"}};')
sub('bt=e=>"MX$ "+(e/100).toLocaleString("es-MX",{minimumFractionDigits:0,maximumFractionDigits:2})',
    'bt=e=>"$ "+(e/100).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:2})')
sub('kv=9900', f'kv={PRICES["bump_old"]}')
sub('i.jsx("span",{className:"ck-preco-de",children:"MX$ 249"})', f'i.jsx("span",{{className:"ck-preco-de",children:"{ars(PRICES["main_old"])}"}})')
sub('currency:"MXN"', 'currency:"ARS"', 9)
sub('value:99', f'value:{PRICES["main"] // 100}', 4)
sub('country:"mx"', 'country:"ar"', 2)
sub('&site=mx"', '&site=ar"', 5)
sub('"ck_catalogo_mx2"', '"ck_catalogo_ar"', 4)
sub('d="nq_quiz_state_mx2"', 'd="nq_quiz_state_ar"')
sub('ra="ck_pix_mx"', 'ra="ck_pix_ar"')
sub('fi="ck_pago_mx"', 'fi="ck_pago_ar"')
sub('toLocaleTimeString("es-MX"', 'toLocaleTimeString("es-AR"')
# No Argentine pixel yet (public/meta-pixel.js starts none on /argentina).
sub('Gh="1641698144409525"', 'Gh=""')
for upsell, (price, old) in PRICES['upsells'].items():
    m = re.search(r'\{id:"' + upsell + r'",price:\d+(,from:\d+)?,', js)
    if not m:
        sys.exit(f'upsell not found: {upsell}')
    js = js.replace(m.group(0), f'{{id:"{upsell}",price:{price}' + (f',from:{old}' if old else '') + ',', 1)
# Argentina writes thousands with a point.
sub('"🥰 +50,000 IAs listas para ti"', '"🥰 +50.000 IAs listas para vos"')
sub('highlight:"37,429",after:" usuarios satisfechos!"', 'highlight:"37.429",after:" usuarios satisfechos!"')

# --- Home picture and quiz, in voseo ----------------------------------------------------
sub('alt:"Crea tu compañera IA — empieza a crearla ahora",cta:"Empieza a crearla ahora"',
    'alt:"Creá tu compañera IA — empezá a crearla ahora",cta:"Empezá a crearla ahora"')
sub('["Crea tu ",i.jsx("span",{className:"quiz-hook-destaque",children:"novia IA"})', '["Creá tu ",i.jsx("span",{className:"quiz-hook-destaque",children:"novia IA"})')
sub('highlightWords:["ella","tú","tu","personalidad","molesta","silueta"]', 'highlightWords:["ella","vos","tu","personalidad","molesta","silueta"]')
sub('3:{title:"Define su silueta"', '3:{title:"Definí su silueta"')
sub('"Desliza y elige tus preferencias."', '"Deslizá y elegí tus preferencias."')
sub('title:"Tamaño del trasero"', 'title:"Tamaño de la cola"')
sub('7:{title:"¿Cómo es su cabello? (estilo)"', '7:{title:"¿Cómo tiene el pelo? (estilo)"')
sub('8:{title:"¿De qué color es su cabello?"', '8:{title:"¿De qué color tiene el pelo?"')
sub('{label:"Rizado"}', '{label:"Enrulado"}')
sub('{label:"Moño"}', '{label:"Rodete"}')
sub('{label:"Coletas"}', '{label:"Colitas"}')
sub('1:{title:"¿Qué será ella para ti?"', '1:{title:"¿Qué va a ser ella para vos?"')
sub('description:"Entregada por completo, hace todo por ti."', 'description:"Entregada por completo, hace todo por vos."')
sub('11:{title:"¿Quieres recibir fotos de ella?"', '11:{title:"¿Querés recibir fotos de ella?"')
sub('12:{title:"¿Quieres recibir videos también?"', '12:{title:"¿Querés recibir videos también?"')

# --- Reveal ----------------------------------------------------------------------------------
sub('nameTitle:"¡Ahora ponle un nombre!",nameSubtitle:"Elige el nombre que quieras para ella ❤️",namePlaceholder:"Escribe su nombre"',
    'nameTitle:"¡Ahora ponele un nombre!",nameSubtitle:"Elegí el nombre que quieras para ella ❤️",namePlaceholder:"Escribí su nombre"')
sub('"Puede ser tu nombre o un apodo — así hablará contigo"', '"Puede ser tu nombre o un apodo — así va a hablar con vos"')
sub('privacyText:"Tu IA será privada. ¡Solo tú la verás!"', 'privacyText:"Tu IA va a ser privada. ¡Solo vos la vas a ver!"')
sub('`Te estoy esperando aquí, ${t}...`', '`Te estoy esperando acá, ${t}...`')
sub('"Te estoy esperando aquí..."', '"Te estoy esperando acá..."')

# --- Offer page --------------------------------------------------------------------------
sub('¿vienes a hablar conmigo?', '¿venís a hablar conmigo?')
sub('oncePay:"Paga una vez · Sin renovación automática"', 'oncePay:"Pagás una vez · Sin renovación automática"')
sub('memberTitle:{before:"¡Sé miembro y disfruta de "', 'memberTitle:{before:"¡Hacete miembro y disfrutá de "')
sub('personalizeTitle:{before:"Personaliza tu IA como quieras, recibe ",highlight:"fotos y vídeos",after:" siempre que lo desees!"}',
    'personalizeTitle:{before:"Personalizá tu IA como quieras y recibí ",highlight:"fotos y videos",after:" cuando quieras!"}')
sub('joinNow:"¡SÉ MIEMBRO AHORA!"', 'joinNow:"¡HACETE MIEMBRO AHORA!"')
sub('detail:"(Paga una sola vez);"', 'detail:"(Pagás una sola vez);"')
sub('detail:"(Solo accede y úsalo);"', 'detail:"(Entrás y lo usás);"')
sub('city:"Ciudad de México"', 'city:"Rosario"')
sub('city:"Bogotá",text:"Aquí puedo ser quien realmente soy.', 'city:"Córdoba",text:"Acá puedo ser quien realmente soy.')
sub('howTitle:{before:"¡Descubre ahora "', 'howTitle:{before:"¡Descubrí ahora "')
sub('title:"Obtén tu plan",text:"¡Ya definimos tu perfil! Solo adquiere tu Plan Premium y accede a la App."',
    'title:"Obtené tu plan",text:"¡Ya definimos tu perfil! Solo adquirí tu Plan Premium y entrá a la App."')
sub('"Descubre la colección hecha especialmente para ti, explora miles de personajes o crea tu propia IA."',
    '"Descubrí la colección hecha especialmente para vos, explorá miles de personajes o creá tu propia IA."')
sub('title:"Sumérgete en el placer",text:"Disfruta chats ilimitados,', 'title:"Sumergite en el placer",text:"Disfrutá chats ilimitados,')
sub('solo tú mandas.', 'solo vos mandás.')
sub('Puedes pedir lo que quieras... todo 100% exclusivo y generado solo para ti.', 'Podés pedir lo que quieras... todo 100% exclusivo y generado solo para vos.')
sub('Claro. Eliges todo: color de piel, cabello,', 'Claro. Elegís todo: color de piel, pelo,')
sub('Sí. Es sumisa cuando quieres, y salvaje cuando lo necesitas. Puedes pedirle que se masturbe para ti,',
    'Sí. Es sumisa cuando querés, y salvaje cuando lo necesitás. Podés pedirle que se masturbe para vos,')
sub('Aquí recibes fotos,', 'Acá recibís fotos,')
sub('te entregarás al placer', 'te vas a entregar al placer')
sub('Solo tú y ella,', 'Solo vos y ella,')
sub('"📸 Fotos y vídeos sin límites"', '"📸 Fotos y videos sin límites"')

# --- Checkout: no Mexican banner (it shows MX$) and no SPEI/OXXO choice ---------------
sub('i.jsx("img",{src:"/banner-mx.webp",alt:"Oferta relámpago: 60% OFF · de MX$ 249 a solo MX$ 99 · pago 100% seguro",className:"ck-banner",width:800,height:324}),', '')
sub('Pf=()=>{["/banner-mx.webp"].forEach(gn)}', 'Pf=()=>{}')
replace_block('i.jsxs("div",{className:"mx-metodos"', '"Paga en cualquier tienda · se confirma en unas horas"})]})]})]}),', '')
sub('"Mejora tu experiencia "', '"Mejorá tu experiencia "')
sub('segundaparceira:"Crea una segunda compañera solo tuya 👯‍♀️"', 'segundaparceira:"Creá una segunda compañera solo tuya 👯‍♀️"')
sub('" ya está lista y esperándote — genera tu pago y es tuya "', '" ya está lista y esperándote — generá tu pago y es tuya "')
sub('"🔒 Compra segura · Pago único por SPEI u OXXO"', '"🔒 Compra segura · Pago único en pesos argentinos"')
sub('{erro:"Escribe tu nombre.",campo:"name"}', '{erro:"Escribí tu nombre.",campo:"name"}')
sub('{erro:"Escribe tu correo.",campo:"email"}', '{erro:"Escribí tu correo.",campo:"email"}')
sub('{erro:"Escribe un correo válido.",campo:"email"}', '{erro:"Escribí un correo válido.",campo:"email"}')
sub('{erro:"Celular inválido (usa lada + número).",campo:"phone"}', '{erro:"Celular inválido (usá código de área + número).",campo:"phone"}')
sub('"Error al generar tu pago. Intenta de nuevo."', '"Error al generar tu pago. Intentá de nuevo."')
sub('"Falla de conexión. Revisa tu internet e intenta de nuevo."', '"Falla de conexión. Revisá tu internet e intentá de nuevo."')
sub('"No pudimos cargar el pago. Recarga la página."', '"No pudimos cargar el pago. Recargá la página."')
sub('"Falla de conexión. Intenta de nuevo."', '"Falla de conexión. Intentá de nuevo."')

# --- One-click upsells -------------------------------------------------------------------
sub('title:n=>`¡Espera! ${n} tiene un video para ti 🎥`', 'title:n=>`¡Esperá! ${n} tiene un video para vos 🎥`')
sub('"La creaste hace un momento y ya te está esperando en video. Desbloquéalo y míralo ahorita mismo."',
    '"La creaste hace un momento y ya te está esperando en video. Desbloquealo y miralo ahora mismo."')
sub('title:n=>`Hazte VIP y tenlo todo con ${n} 👑`', 'title:n=>`Hacete VIP y tené todo con ${n} 👑`')
sub('"Memoria permanente: se acuerda de ti"', '"Memoria permanente: se acuerda de vos"')
sub('"Edítala cuando quieras"', '"Editala cuando quieras"')
sub('title:n=>`¿Quieres que ${n} te escriba por WhatsApp? 💬`', 'title:n=>`¿Querés que ${n} te escriba por WhatsApp? 💬`')
sub('title:n=>`¿Quieres que ${n} nunca se olvide de ti? 🧠`', 'title:n=>`¿Querés que ${n} nunca se olvide de vos? 🧠`')
sub('de tu día y de todo lo que platicaron."', 'de tu día y de todo lo que charlaron."')
sub('"Retoma las pláticas donde se quedaron","Se vuelve más cercana en cada plática"', '"Retoma las charlas donde quedaron","Se vuelve más cercana en cada charla"')
sub('title:n=>`Mira a ${n} con otra ropa 📸`', 'title:n=>`Mirá a ${n} con otra ropa 📸`')
sub('title:n=>`¿Quieres poder cambiar a ${n} cuando quieras? 🎨`', 'title:n=>`¿Querés poder cambiar a ${n} cuando quieras? 🎨`')
sub('"Cambia su cabello, su ropa y su personalidad cuando se te antoje."', '"Cambiale el pelo, la ropa y la personalidad cuando se te antoje."')
sub('"Cambiar el cabello y el color"', '"Cambiar el pelo y el color"')
sub('placeholder:"Tu WhatsApp con lada"', 'placeholder:"Tu WhatsApp con código de área"')
sub('Pa("Escribe tu WhatsApp con lada para que te escriba.")', 'Pa("Escribí tu WhatsApp con código de área para que te escriba.")')

# Nothing Mexican may be left on the screens the Argentine buyer can reach today.
for leftover in ['MX$', 'MXN', 'con lada', 'usa lada', 'ahorita mismo', 'platicaron', 'pláticas', 'site=mx', '"es-MX"', 'banner-mx', 'mx-metodos', 'Pago único por SPEI', '¿Quieres', ' para ti"', 'Elige el nombre', 'Solo tú y']:
    if leftover in js:
        sys.exit(f'Mexican text left in the Argentine bundle: {leftover!r}')

(PUBLIC / 'assets/index-ar.js').write_text(js)

html = (PUBLIC / 'mexico/index.html').read_text()
for old, new in [('<html lang="es-MX">', '<html lang="es-AR">'), ('<title>Crea tu novia IA</title>', '<title>Creá tu novia IA</title>'), ('/assets/index-mx.js?v=', '/assets/index-ar.js?v=')]:
    if html.count(old) != 1:
        sys.exit(f'html: expected 1x {old!r}')
    html = html.replace(old, new)
(PUBLIC / 'argentina').mkdir(exist_ok=True)
(PUBLIC / 'argentina/index.html').write_text(html)

catalog = {
    'main': {'title': 'CliChat AI', 'cover': '/logo-icon.png', 'price': PRICES['main']},
    'bumps': {'chamadadevoz': {'title': 'Llamada de voz', 'cover': '/chamadadevoz.webp', 'price': PRICES['bump']},
              'segundaparceira': {'title': 'Segunda compañera', 'cover': '/segundaparceira.webp', 'price': PRICES['bump']}},
    'upsell': {'title': 'VIP (todo incluido)', 'cover': '/assets/upsell-cover', 'price': PRICES['upsells']['vip'][0]},
    'upsells': {k: {'title': t, 'price': PRICES['upsells'][k][0], **({'cover': '/assets/upsell-cover'} if k == 'vip' else {})}
                for k, t in [('whatsapp', 'Mensajes de ella por WhatsApp (30 días)'), ('video', 'Video de ella'), ('vip', 'VIP (todo incluido)'),
                             ('memoria', 'Memoria permanente'), ('album', 'Álbum de fotos de ella'), ('editar', 'Editala cuando quieras')]},
    'currency': 'ARS',
}
(ROOT / 'lib/catalog-ar.json').write_text(json.dumps(catalog, ensure_ascii=False) + '\n')
print('ok: public/assets/index-ar.js, public/argentina/index.html and lib/catalog-ar.json')
