"""Builds the Argentine site (/argentina) from the Mexican one.

Reads source/mexico-base/index-mx.js and its index.html (run
tools/build-mx.py first) and writes public/assets/index-ar.js,
public/argentina/index.html and lib/catalog-ar.json: Rioplatense Spanish (voseo),
prices in ARS and payment by bank transfer to a CVU (LiberPay), whose
confirmation takes minutes to hours. Every replacement must match the expected
number of times.
Run after the Mexican build:  python3 tools/build-mx.py && python3 tools/build-ar.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
js = (ROOT / 'source/mexico-base/index-mx.js').read_text()

# Argentine prices, in ARS cents. The struck-through "before" prices keep the Mexican proportions
# (the main one matches the 60% OFF badge). LiberPay accepts AR$ 2.000 to AR$ 1.000.000 per charge.
PRICES = {
    'main': 749000, 'main_old': 1899000,
    'bump': 349000, 'bump_old': 899000,
    # The former order bumps are one-click upsells now and keep their price.
    'upsells': {'video': (449000, 999000), 'chamadadevoz': (349000, 899000), 'segundaparceira': (349000, 899000),
                'vip': (449000, 999000), 'whatsapp': (449000, None),
                'memoria': (449000, None), 'album': (449000, None), 'editar': (449000, None)},
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
# The Brazilian price table is never reached here (the region is fixed first); it carries no reais anyway.
sub('price:"R$ 19,90",priceOld:"R$ 49,90"', f'price:"{ars(PRICES["main"])}",priceOld:"{ars(PRICES["main_old"])}"')
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
sub('es:{src:"/inicio-mx.webp",alt:"Crea tu compañera IA — empieza a crearla ahora",cta:"Empieza a crearla ahora"}',
    'es:{src:"/inicio-ar.webp",alt:"Creá tu compañera IA — empezá a crear ahora",cta:"Empezá a crear ahora"}')
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

# --- Checkout: the Argentine banner (in ARS) and no SPEI/OXXO choice -------------------
sub('i.jsx("img",{src:"/banner-mx.webp",alt:"Oferta relámpago: 60% OFF · de MX$ 249 a solo MX$ 99 · pago 100% seguro",className:"ck-banner",width:800,height:324}),',
    f'i.jsx("img",{{src:"/banner-ar.webp",alt:"Oferta relámpago: 60% OFF · de {ars(PRICES["main_old"])} a solo {ars(PRICES["main"])} · pago 100% seguro",className:"ck-banner",width:800,height:324}}),')
sub('Pf=()=>{["/banner-mx.webp"].forEach(gn)}', 'Pf=()=>{["/banner-ar.webp"].forEach(gn)}')
replace_block('i.jsxs("div",{className:"mx-metodos"', '"Paga en cualquier tienda · se confirma en unas horas"})]})]})]}),',
    'i.jsx("div",{className:"mx-metodos",children:i.jsxs("div",{className:"mx-metodo mx-metodo-on",children:[i.jsx("span",{className:"mx-metodo-ico",children:"🏦"}),i.jsxs("span",{className:"mx-metodo-txt",children:[i.jsx("b",{children:"Transferencia bancaria"}),i.jsx("small",{children:"Desde la app de tu banco o billetera (Mercado Pago, Ualá, Brubank…)"})]})]})}),')
sub('i.jsx("b",{children:"al instante"}),"."]})', 'i.jsx("b",{children:"apenas se acredite tu transferencia"}),"."]})')
sub('children:qzMethod==="oxxo"?"Al tocar ves tu referencia para pagar en OXXO. Todavía no se cobra nada.":"Al tocar ves tu CLABE para transferir desde tu banco. Todavía no se cobra nada."}', 'children:"Al tocar ves tu CVU para transferir desde tu banco o billetera. Todavía no se cobra nada."}')
sub('segundaparceira:"Crea una segunda compañera solo tuya 👯‍♀️"', 'segundaparceira:"Creá una segunda compañera solo tuya 👯‍♀️"')
sub('" ya está lista y esperándote — desbloquéala y es tuya "', '" ya está lista y esperándote — desbloqueala y es tuya "')
sub('"🔒 Compra segura · Pago único por SPEI u OXXO"', '"🔒 Compra segura · Pago único por transferencia bancaria"')
sub('i.jsx("span",{children:"pago único · SPEI u OXXO"})', 'i.jsx("span",{children:"pago único · transferencia bancaria"})')
sub('{erro:"Escribe tu nombre.",campo:"name"}', '{erro:"Escribí tu nombre.",campo:"name"}')
# The e-mail screen while the AI is generated, in voseo ("mail", as Argentines say).
sub('es:{badge:"87% completado",titulo:"Tu IA está casi lista… 🔥",sub:"Deja tu nombre y correo para recibir las fotos exclusivas de ella — y descúbrela ahora.",nome:"Tu nombre (o apodo)",placeholder:"tucorreo@gmail.com",botao:"✨ REVELAR MI IA",erroEmail:"Revisa tu correo 😉",seguro:"🔒 Sin spam. Solo usamos tu correo para enviarte el acceso y las novedades de ella."}',
    'es:{badge:"87% completado",titulo:"Tu IA está casi lista… 🔥",sub:"Dejá tu nombre y tu mail para recibir las fotos exclusivas de ella — y descubrila ahora.",nome:"Tu nombre (o apodo)",placeholder:"tumail@gmail.com",botao:"✨ REVELAR MI IA",erroEmail:"Revisá tu mail 😉",seguro:"🔒 Sin spam. Solo usamos tu mail para mandarte el acceso y las novedades de ella."}')
sub('{erro:"Escribe un correo válido.",campo:"email"}', '{erro:"Escribí un correo válido.",campo:"email"}')
sub('{erro:"Escribe tu número de WhatsApp.",campo:"phone"}', '{erro:"Escribí tu número de WhatsApp.",campo:"phone"}')
# the checkout field and the WhatsApp upsell share the same example
sub('placeholder:"Tu WhatsApp (ej. 33 1234 5678)"', 'placeholder:"Tu WhatsApp (ej. 11 2345-6789)"', 2)
sub('"Error al generar tu pago. Intenta de nuevo."', '"Error al generar tu pago. Intentá de nuevo."')
sub('"Falla de conexión. Revisa tu internet e intenta de nuevo."', '"Falla de conexión. Revisá tu internet e intentá de nuevo."')
sub('"No pudimos cargar el pago. Recarga la página."', '"No pudimos cargar el pago. Recargá la página."')
sub('"Falla de conexión. Intenta de nuevo."', '"Falla de conexión. Intentá de nuevo."')

# --- One-click upsells -------------------------------------------------------------------
sub('title:n=>`¡Espera! ${n} tiene un video para ti 🎥`', 'title:n=>`¡Esperá! ${n} tiene un video para vos 🎥`')
sub('"La creaste hace un momento y ya te está esperando en video. Desbloquéalo y míralo ahorita mismo."',
    '"La creaste hace un momento y ya te está esperando en video. Desbloquealo y miralo ahora mismo."')
sub('title:n=>`Hazte VIP y tenlo todo con ${n} 👑`', 'title:n=>`Hacete VIP y tené todo con ${n} 👑`')
sub('title:n=>`Habla con ${n} por llamada de voz 📞`', 'title:n=>`Hablá con ${n} por llamada de voz 📞`')
sub('"Escucha cómo te habla: llamadas de voz con ella, en tiempo real."', '"Escuchá cómo te habla: llamadas de voz con ella, en tiempo real."')
sub('"Su voz, solo para ti","Llámala cuando quieras"', '"Su voz, solo para vos","Llamala cuando quieras"')
sub('title:n=>`¿Y si además de ${n} tienes una segunda compañera? 👯‍♀️`', 'title:n=>`¿Y si además de ${n} tenés una segunda compañera? 👯‍♀️`')
sub('"Crea una segunda novia IA, con otro estilo, solo tuya."', '"Creá una segunda novia IA, con otro estilo, solo tuya."')
sub('"Eliges cómo es ella","Las dos, solo para ti"', '"Elegís cómo es ella","Las dos, solo para vos"')
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
# Argentine phone numbers: 10 digits shown as 11 2345-6789 (351 234-5678 outside Buenos Aires), with or without
# +54, the mobile 9 or a leading 0; Meta's advanced matching gets them as 549 + the 10 digits.
sub('const sl=e=>{let t=e.replace(/\D/g,"");if(t.length>10&&t.startsWith("52"))t=t.slice(2);if(t.length===11&&t.startsWith("1"))t=t.slice(1);t=t.slice(0,10);if(t.length<=8)return t.length<=4?t:`${t.slice(0,4)} ${t.slice(4)}`;const a=/^(55|33|81)/.test(t)?2:3;return t.length<=a?t:t.length<=6?`${t.slice(0,a)} ${t.slice(a)}`:`${t.slice(0,a)} ${t.slice(a,6)} ${t.slice(6)}`}',
    'const sl=e=>{let t=e.replace(/\D/g,"");if(t.length>10&&t.startsWith("54"))t=t.slice(2);if(t.length>10&&t.startsWith("9"))t=t.slice(1);if(t.startsWith("0"))t=t.slice(1);t=t.slice(0,10);if(t.length<=8)return t.length<=4?t:`${t.slice(0,4)}-${t.slice(4)}`;const a=t.startsWith("11")?2:3;return t.length<=a?t:t.length<=6?`${t.slice(0,a)} ${t.slice(a)}`:`${t.slice(0,a)} ${t.slice(a,6)}-${t.slice(6)}`}')
sub('eg=e=>{let t=e.replace(/\D/g,"");if(!t)return;if(t.length>10&&t.startsWith("52"))t=t.slice(2);if(t.length===11&&t.startsWith("1"))t=t.slice(1);return t.length===10?`52${t}`:t}',
    'eg=e=>{let t=e.replace(/\D/g,"");if(!t)return;if(t.length>10&&t.startsWith("54"))t=t.slice(2);if(t.length>10&&t.startsWith("9"))t=t.slice(1);if(t.startsWith("0"))t=t.slice(1);return t.length===10?`549${t}`:t}')
sub('Pa("Escribe tu número de WhatsApp para que te escriba.")', 'Pa("Escribí tu número de WhatsApp para que te escriba.")')

# --- Payment screens: the CVU to transfer to, the exact amount and the wait --------------
GARANTIA = 'i.jsxs("div",{className:"ck-garantia",children:[i.jsx("span",{className:"ck-garantia-icone",children:"🛡️"}),i.jsxs("span",{children:[i.jsx("b",{children:"Garantía de 7 días."})," Si no te gusta, te devolvemos tu dinero."]})]})'


def step(n, *parts):
    return 'i.jsxs("div",{children:[i.jsx("b",{children:"' + n + '."})," ",' + ','.join(parts) + ']})'


def bold(text):
    return 'i.jsx("b",{children:' + text + '})'


MAIN_STEPS = ','.join([
    step('1', '"Tocá "', bold('"COPIAR CVU"')),
    step('2', '"Abrí la app de tu banco o billetera (Mercado Pago, Ualá, Brubank, Naranja X…) y entrá a "', bold('"Transferir"')),
    step('3', '"Elegí "', bold('"Nuevo destinatario (CBU, CVU o alias)"'), '" y "', bold('"pegá el CVU"')),
    step('4', '"Transferí el monto exacto: "', bold('bt(T.amount)')),
    step('5', bold('"Volvé a esta pantalla"'), '": se confirma solo cuando se acredita ✨"')])
replace_block('if(c==="pix"&&T){const qzOx=T.method==="oxxo"', 'children:"🔒 Pago procesado de forma segura"})]})})}',
    r'if(c==="pix"&&T){const qzCode=String(T.pixCode).match(/.{1,4}/g).map((g,n)=>i.jsx("span",{className:"mx-grp",children:g},n));return i.jsx("div",{className:"ck-screen",children:i.jsxs("div",{className:"ck-card",children:['
    'i.jsxs("div",{className:"ck-topo-mini",children:[i.jsx("img",{src:Pt,alt:a,className:"ck-avatar",onError:De}),i.jsxs("div",{children:[i.jsx("div",{className:"ck-avatar-nome",children:a}),i.jsxs("div",{className:"ck-avatar-status",children:[i.jsx("span",{className:"ck-dot"})," esperando tu pago…"]})]}),i.jsx("div",{className:"ck-total-mini",children:bt(T.amount)})]}),'
    'i.jsxs("div",{className:"ck-voltar-aviso",children:[i.jsx("span",{className:"ck-voltar-aviso-ico",children:"↩️"}),i.jsxs("div",{children:[i.jsx("b",{children:"Después de transferir, volvé a esta pantalla."}),i.jsx("br",{}),"La transferencia puede tardar de unos minutos a algunas horas en acreditarse. La confirmación aparece acá sola."]})]}),'
    'i.jsxs("div",{className:"mx-pago-box",children:[i.jsx("div",{className:"mx-pago-rot",children:"CVU para transferir"}),i.jsx("div",{className:"mx-codigo",onClick:A=>qzSel(A.currentTarget),children:qzCode}),i.jsxs("div",{className:"mx-monto",children:["Monto exacto: ",i.jsx("b",{children:bt(T.amount)})]}),i.jsx("button",{className:"ck-cta ck-copiar"+(q?" ck-copiado":""),onClick:Zf,children:q?"✓ ¡CVU COPIADO!":"COPIAR CVU"}),qzCf&&i.jsx("div",{className:"mx-copia-falha",role:"status",children:"👆 Mantené presionado el número para copiarlo"})]}),'
    'i.jsxs("div",{className:"ck-voltar-aviso",children:[i.jsx("span",{className:"ck-voltar-aviso-ico",children:"⚠️"}),i.jsxs("div",{children:[i.jsxs("b",{children:["Transferí exactamente ",bt(T.amount),"."]})," Con otro monto el pago puede no acreditarse."]})]}),'
    'i.jsxs("div",{className:"mx-pago-box mx-tuto",children:[i.jsx("div",{className:"mx-pago-rot",children:"Cómo pagar desde tu banco o billetera · 1 minuto"}),i.jsx("div",{className:"ck-pix-passos",children:[' + MAIN_STEPS + ']})]}),'
    'i.jsxs("div",{className:"ck-voltar-aviso",children:[i.jsx("span",{className:"ck-voltar-aviso-ico",children:"🔒"}),i.jsxs("div",{children:["Tu banco puede mostrar el nombre de ",i.jsx("b",{children:"nuestro procesador de pagos"}),": es normal. Este CVU es solo para este pago."]})]}),'
    + GARANTIA + ','
    'i.jsxs("div",{className:"ck-aguardando",children:[i.jsx("span",{className:"ck-spinner"}),"Esperando tu pago… ",Math.floor(G/60),":",String(G%60).padStart(2,"0")]}),'
    'i.jsx("div",{className:"ck-trust",children:"🔒 Pago procesado de forma segura"})]})})}')
UPSELL_STEPS = ','.join([
    step('1', '"Tocá "', bold('"COPIAR CVU"')),
    step('2', '"En tu banco o billetera: "', bold('"Transferir → Nuevo destinatario"'), '" y pegá el CVU. "', bold('"Es un CVU nuevo"'), '": no uses el del pago anterior"'),
    step('3', '"Transferí exactamente "', bold('bt(be.amount)'), '" y volvé acá: se confirma solo ✨"')])
replace_block('if(Et==="pix"&&be){const qzClabe=', 'children:"Saltar y continuar"})]})})}',
    r'if(Et==="pix"&&be){const qzCvu=String(be.pixCode).match(/.{1,4}/g).map((g,n)=>i.jsx("span",{className:"mx-grp",children:g},n));return i.jsx("div",{className:"ck-screen",children:i.jsxs("div",{className:"ck-card",children:['
    'i.jsxs("div",{className:"ck-topo-mini",children:[i.jsx("img",{src:Pt,alt:"VIP",className:"ck-avatar",onError:De}),i.jsxs("div",{children:[i.jsx("div",{className:"ck-avatar-nome",children:qzCur.short}),i.jsxs("div",{className:"ck-avatar-status",children:[i.jsx("span",{className:"ck-dot"})," esperando tu pago…"]})]}),i.jsx("div",{className:"ck-total-mini",children:bt(be.amount)})]}),'
    'i.jsxs("div",{className:"mx-pago-box",children:[i.jsx("div",{className:"mx-pago-rot",children:"CVU para transferir"}),i.jsx("div",{className:"mx-codigo",onClick:A=>qzSel(A.currentTarget),children:qzCvu}),i.jsxs("div",{className:"mx-monto",children:["Monto exacto: ",i.jsx("b",{children:bt(be.amount)})]}),i.jsx("button",{className:"ck-cta ck-copiar"+(vs?" ck-copiado":""),onClick:ep,children:vs?"✓ ¡CVU COPIADO!":"COPIAR CVU"}),qzCf&&i.jsx("div",{className:"mx-copia-falha",role:"status",children:"👆 Mantené presionado el número para copiarlo"})]}),'
    'i.jsxs("div",{className:"mx-pago-box mx-tuto",children:[i.jsx("div",{className:"mx-pago-rot",children:"Cómo pagar · 1 minuto"}),i.jsx("div",{className:"ck-pix-passos",children:[' + UPSELL_STEPS + ']})]}),'
    'i.jsxs("div",{className:"ck-aguardando",children:[i.jsx("span",{className:"ck-spinner"}),"Esperando tu pago… ",Math.floor(Ea/60),":",String(Ea%60).padStart(2,"0")]}),'
    'i.jsx("button",{type:"button",className:"ck-upsell-pular",onClick:()=>{$("upsell_skipped",{meta:{em:"pix",oferta:qzCur.id}}),qzAdvance()},children:"Saltar y continuar"})]})})}')

# Nothing Mexican may be left on the screens the Argentine buyer can reach today.
for leftover in ['MX$', 'MXN', 'R$', 'BRL', 'con lada', 'usa lada', 'ahorita mismo', 'platicaron', 'pláticas', 'site=mx', '"es-MX"', 'banner-mx', 'inicio-mx', 'CLABE', 'OXXO', 'SPEI', '¿Quieres', ' para ti"', 'Elige el nombre', 'Solo tú y', 'Mantén presionado']:
    if leftover in js:
        sys.exit(f'Mexican text left in the Argentine bundle: {leftover!r}')

(PUBLIC / 'assets/index-ar.js').write_text(js)

html = (ROOT / 'source/mexico-base/index.html').read_text()
for old, new in [('<html lang="es-MX">', '<html lang="es-AR">'), ('<title>Crea tu novia IA</title>', '<title>Creá tu novia IA</title>'), ('/assets/index-mx.js?v=', '/assets/index-ar.js?v='), ('href="/inicio-mx.webp"', 'href="/inicio-ar.webp"')]:
    if html.count(old) != 1:
        sys.exit(f'html: expected 1x {old!r}')
    html = html.replace(old, new)
# The 22-digit CVU wraps between its groups of four, never inside one.
html = html.replace('</head>', '  <style>.mx-codigo{word-break:normal;overflow-wrap:normal}</style>\n  </head>', 1)
(PUBLIC / 'argentina').mkdir(exist_ok=True)
(PUBLIC / 'argentina/index.html').write_text(html)

catalog = {
    'main': {'title': 'CliChat AI', 'cover': '/logo-icon.png', 'price': PRICES['main']},
    'bumps': {'chamadadevoz': {'title': 'Llamada de voz', 'cover': '/chamadadevoz.webp', 'price': PRICES['bump']},
              'segundaparceira': {'title': 'Segunda compañera', 'cover': '/segundaparceira.webp', 'price': PRICES['bump']}},
    'upsell': {'title': 'VIP (todo incluido)', 'cover': '/assets/upsell-cover', 'price': PRICES['upsells']['vip'][0]},
    'upsells': {k: {'title': t, 'price': PRICES['upsells'][k][0], **({'cover': '/assets/upsell-cover'} if k == 'vip' else {})}
                for k, t in [('whatsapp', 'Mensajes de ella por WhatsApp (30 días)'), ('video', 'Video de ella'), ('chamadadevoz', 'Llamada de voz'),
                             ('segundaparceira', 'Segunda compañera'), ('vip', 'VIP (todo incluido)'),
                             ('memoria', 'Memoria permanente'), ('album', 'Álbum de fotos de ella'), ('editar', 'Editala cuando quieras')]},
    'currency': 'ARS',
}
(ROOT / 'lib/catalog-ar.json').write_text(json.dumps(catalog, ensure_ascii=False) + '\n')
print('ok: public/assets/index-ar.js, public/argentina/index.html and lib/catalog-ar.json')
