"""Builds the Mexican site (/mexico) from the Brazilian bundle.

Reads public/assets/index-B-OgTTgT.js and public/index.html and writes
public/assets/index-mx.js and public/mexico/index.html: Mexican Spanish copy,
prices in MXN and LiberPay (SPEI or OXXO) instead of PIX. Every replacement
must match the expected number of times, so a change in the Brazilian bundle
fails loudly here instead of shipping half-translated. Run after changing the
Brazilian bundle:  python3 tools/build-mx.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / 'public'
js = (PUBLIC / 'assets/index-B-OgTTgT.js').read_text()


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


GARANTIA = 'i.jsxs("div",{className:"ck-garantia",children:[i.jsx("span",{className:"ck-garantia-icone",children:"🛡️"}),i.jsxs("span",{children:[i.jsx("b",{children:"Garantía de 7 días."})," Si no te gusta, te devolvemos tu dinero."]})]})'

# --- Region, language and money -------------------------------------------------
sub('const[t]=w.useState(Qh),[n,r]=w.useState(()=>t??Rh()),[o,a]=w.useState(null)',
    'const[t]=w.useState("latam"),[n,r]=w.useState("latam"),[o,a]=w.useState("MX")')
sub('a(v),t||r(Ah(v))', 'void v')
sub('document.documentElement.lang=u==="pt"?"pt-BR":u', 'document.documentElement.lang="es-MX"')
sub('function Bh(e,t){if(e==="br")return Po.br;', 'function Bh(e,t){if(e==="latam")return{url:"",price:"MX$ 99",priceOld:"MX$ 249"};if(e==="br")return Po.br;')
sub('onUnlock:t==="br"?', 'onUnlock:t==="latam"?')
sub('onCheckout:t==="br"?', 'onCheckout:t==="latam"?', 2)
sub('bt=e=>(e/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})',
    'bt=e=>"MX$ "+(e/100).toLocaleString("es-MX",{minimumFractionDigits:0,maximumFractionDigits:2})')
sub('kv=1490', 'kv=9900')
sub('currency:"BRL"', 'currency:"MXN"', 8)
sub('value:19.9', 'value:99', 3)
# The checkout's InitiateCheckout also carries the price, in MXN like every other Mexican event.
sub('vt("InitiateCheckout",void 0,{eventId:`ic_${sr()}`})', 'vt("InitiateCheckout",{value:99,currency:"MXN",content_type:"product",content_ids:["main"],num_items:1},{eventId:`ic_${sr()}`})')
sub('country:"br"', 'country:"mx"', 2)
sub('"/api/checkout?op=products"', '"/api/checkout?op=products&site=mx"', 3)
sub('"/api/checkout?op=pix"', '"/api/checkout?op=pix&site=mx"')
sub('"/api/checkout?op=upsell-pix"', '"/api/checkout?op=upsell-pix&site=mx"')
# Separate saved state, so a visitor of both sites never mixes them.
sub('"ck_catalogo_v2"', '"ck_catalogo_mx2"', 4)
sub('d="nq_quiz_state"', 'd="nq_quiz_state_mx2"')

# Mexico writes thousands with a comma (37,429) and decimals with a point.
sub('"🥰 +50.000 IAs listas para ti"', '"🥰 +50,000 IAs listas para ti"')
sub('highlight:"37.429",after:" usuarios satisfechos!"', 'highlight:"37,429",after:" usuarios satisfechos!"')
sub('toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})', 'toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})')

# --- Home screen -------------------------------------------------------------------
# Mexico opens on the Spanish home picture: a tap anywhere starts the quiz, and so does waiting 5 seconds
# (home_auto tells the two apart in the funnel report).
sub('qzShowHome=!1||/[?&]inicio=1(&|$)/.test(location.search)', 'qzShowHome=!0')
sub('es:{src:"/inicio.webp",alt:"Crea tu compañera IA — empezar a crear ahora",cta:"Empezar a crear ahora"}',
    'es:{src:"/inicio-mx.webp",alt:"Crea tu compañera IA — empieza a crearla ahora",cta:"Empieza a crearla ahora"}')
sub('Pv=({onStart:e})=>{const{lang:t}=Yt(),n=ec[t]??ec.pt;return',
    'Pv=({onStart:e})=>{const{lang:t}=Yt(),n=ec[t]??ec.pt;w.useEffect(()=>{const qzT=setTimeout(()=>{$("home_auto"),e()},5e3);return()=>clearTimeout(qzT)},[]);return')

# --- Quiz ------------------------------------------------------------------------
# Realistic only: no style question, so the quiz opens on the ethnicity and every answer set is realistic
# (an unanswered style is never "anime").
sub('qzOrder=[0,10,3,7,8,1,11,12]', 'qzOrder=[10,3,7,8,1,11,12]')
sub('highlightWords:["ella","tú","tu","personalidad","molesta"]', 'highlightWords:["ella","tú","tu","personalidad","molesta","silueta"]')
sub('0:{title:"Elige su estilo",options:{"style-1":{label:"Normal"}', '0:{title:"Elige su estilo",options:{"style-1":{label:"Realista"}')
sub('3:{title:"¿Cómo es su cuerpo?"', '3:{title:"Define su silueta"')
sub('["Crie sua ",i.jsx("span",{className:"quiz-hook-destaque",children:"namorada IA"})," em 40 segundos"]',
    '["Crea tu ",i.jsx("span",{className:"quiz-hook-destaque",children:"novia IA"})," en 40 segundos"]')
sub('"aria-label":"Gerando sua IA"', '"aria-label":"Generando tu IA"')
sub('children:"Gerando…"', 'children:"Generando…"')
sub('qzBodyGroups=[{field:3,title:"Tipo de corpo",def:"normal",opts:[["normal","Normal","/corpo/body_slim.webp"],["fitness","Fitness","/corpo/body_muscular.webp"],["magra","Magra","/corpo/body_petite.webp"],["plus-size","Plus size","/corpo/body_plus_size.webp"]]},{field:4,title:"Tamanho dos seios",def:"medios",opts:[["pequenos","Pequenos","/seios/breast_small.webp"],["medios","Médios","/seios/breast_medium.webp"],["grandes","Grandes","/seios/breast_large.webp"],["enormes","Enormes","/seios/breast_huge.webp"]]},{field:5,title:"Tamanho do bumbum",def:"media",opts:[["pequena","Pequeno","/bunda/butt_small.webp"],["media","Médio","/bunda/butt_medium.webp"],["grande","Grande","/bunda/butt_large.webp"],["enorme","Enorme","/bunda/butt_huge.webp"]]}]',
    'qzBodyGroups=[{field:3,title:"Tipo de cuerpo",def:"normal",opts:[["normal","Normal","/corpo/body_slim.webp"],["fitness","Fitness","/corpo/body_muscular.webp"],["magra","Delgada","/corpo/body_petite.webp"],["plus-size","Plus size","/corpo/body_plus_size.webp"]]},{field:4,title:"Tamaño del busto",def:"medios",opts:[["pequenos","Pequeño","/seios/breast_small.webp"],["medios","Mediano","/seios/breast_medium.webp"],["grandes","Grande","/seios/breast_large.webp"],["enormes","Enorme","/seios/breast_huge.webp"]]},{field:5,title:"Tamaño del trasero",def:"media",opts:[["pequena","Pequeño","/bunda/butt_small.webp"],["media","Mediano","/bunda/butt_medium.webp"],["grande","Grande","/bunda/butt_large.webp"],["enorme","Enorme","/bunda/butt_huge.webp"]]}]')
sub('"Deslize e escolha suas preferências."', '"Desliza y elige tus preferencias."')
sub('e[0]==="anime"?"Modelo IA gerada (Anime)":r.preview.modelTag', 'e[0]==="anime"?"Modelo IA generada (Anime)":r.preview.modelTag')

# --- No voice --------------------------------------------------------------------
# The character videos speak Portuguese: they play muted with no sound button, and the offer page does not
# promise audios. The voice call order bump stays, since the app it sells talks in Mexican Spanish.
sub('muted:!f,loop:!0,playsInline:!0,preload:"metadata",onPlaying:S,onClick:I,onError:()=>y(!0)},a),i.jsx("button",{type:"button",className:"character-som",onClick:I,"aria-label":f?"Desligar o som":"Ligar o som",children:i.jsx(yg,{ligado:f})})]',
    'muted:!0,loop:!0,playsInline:!0,preload:"metadata",onPlaying:S,onError:()=>y(!0)},a)]')
sub('muted:!f,playsInline:!0,onClick:I,onPlaying:S,onError:()=>y(!0)},x):i.jsx("img",{src:N,alt:u,className:"hero-char-img",onError:De}),x&&!p&&!f&&i.jsxs("button",{type:"button",className:"hero-char-som",onClick:I,"aria-label":"Ativar som",children:[i.jsx("span",{className:"hero-char-som-icone",children:"🔇"}),i.jsx("span",{children:"OUÇA ELA"})]}),',
    'muted:!0,playsInline:!0,onPlaying:S,onError:()=>y(!0)},x):i.jsx("img",{src:N,alt:u,className:"hero-char-img",onError:De}),')
sub('i.jsx("video",{src:qzVid,poster:Pt,controls:!0,playsInline:!0,loop:!0})', 'i.jsx("video",{src:qzVid,poster:Pt,autoPlay:!0,muted:!0,playsInline:!0,loop:!0})')
sub('Las respuestas, la voz, el estilo… ¡adictivo!', 'Las respuestas, las fotos, el estilo… ¡adictivo!')
sub('Manda audios con voz real, fotos desnuda,', 'Manda fotos desnuda,')
sub('highlight:"audios, fotos y vídeos"', 'highlight:"fotos y vídeos"')
sub('Aquí recibes audios, fotos, videos provocadores', 'Aquí recibes fotos, videos provocadores')
# MX$ 249 → MX$ 99 is 60% off, as the checkout and its banner say.
sub('discount:"70% OFF",hero:{created:"Creada con tus respuestas"', 'discount:"60% OFF",hero:{created:"Creada con tus respuestas"')
sub('{question:"🔊 ¿Habla como una mujer de verdad?",answer:"Habla mejor. Su voz es real, cálida, con entonaciones que erizan la piel. Susurra, gime, te llama como te gusta y te excita solo con su voz. Puedes pedirle que llegue al clímax, simular una sesión completa... todo es posible."},', '')

# --- Teaser chat -------------------------------------------------------------------
# Off in Mexico: the reveal goes straight to the offer page and then to the checkout, as before the
# teaser existed. Its copy is still translated in case it comes back.
sub('qzTeaserOn=!0', 'qzTeaserOn=!1')
sub('qzTeaserLines=(role,him)=>[him?`Oi ${him}! 😍`:"Oi, amor! 😍",{namorada:"Finalmente você chegou… eu tava te esperando 🥺",amante:"Tava pensando em você agora mesmo… 🔥",amiga:"Que bom que você veio! Tava com saudade 💕",vizinha:"Achei que você nunca ia aparecer… 😈",escrava:"Tô aqui só pra você, do jeitinho que você quiser 🖤",tarada:"Tô cheia de energia hoje… e só pensando em você 😏"}[role]||"Finalmente você chegou… eu tava te esperando 🥺","Tirei essas fotos agora, só pra você… 🙈"]',
    'qzTeaserLines=(role,him)=>[him?`¡Hola ${him}! 😍`:"¡Hola, amor! 😍",{namorada:"Por fin llegaste… te estaba esperando 🥺",amante:"Justo estaba pensando en ti… 🔥",amiga:"¡Qué bueno que viniste! Te extrañaba 💕",vizinha:"Pensé que nunca ibas a aparecer… 😈",escrava:"Estoy aquí solo para ti, como tú quieras 🖤",tarada:"Hoy ando con mucha energía… y solo pienso en ti 😏"}[role]||"Por fin llegaste… te estaba esperando 🥺","Me tomé estas fotos ahorita, solo para ti… 🙈"]')
sub('typing?"digitando…":"online agora"', 'typing?"escribiendo…":"en línea"')
sub('"aria-label":"3 fotos bloqueadas"', '"aria-label":"3 fotos bloqueadas"')
sub('["Fotos só pra você 🔥",i.jsx("small",{children:"Toque para desbloquear"})]', '["Fotos solo para ti 🔥",i.jsx("small",{children:"Toca para desbloquear"})]')
sub('nm?`Desbloqueie para ver as fotos e continuar conversando com a ${nm}`:"Desbloqueie para ver as fotos e continuar a conversa"',
    'nm?`Desbloquea para ver las fotos y seguir platicando con ${nm}`:"Desbloquea para ver las fotos y seguir platicando"')
sub('i.jsx("span",{children:"pagamento único via PIX"})', 'i.jsx("span",{children:"pago único · SPEI u OXXO"})')
sub('nm?`🔓 Desbloquear a ${nm}`:"🔓 Desbloquear agora"', 'nm?`🔓 Desbloquear a ${nm}`:"🔓 Desbloquear ahora"')
sub('children:"Ver tudo o que está incluso"', 'children:"Ver todo lo que incluye"')
sub('nm?`Desbloqueie para responder a ${nm}…`:"Desbloqueie para responder…"', 'nm?`Desbloquea para responderle a ${nm}…`:"Desbloquea para responder…"')

# --- Upsells -----------------------------------------------------------------------
UPSELLS = r'''qzUps=[
{id:"video",price:6900,from:14900,short:"Video de ella",badge:"🎥 VIDEO EXCLUSIVO",title:n=>`¡Espera! ${n} tiene un video para ti 🎥`,blur:!0,sub:n=>"La creaste hace un momento y ya te está esperando en video. Desbloquéalo y míralo ahorita mismo.",note:"solo en esta pantalla",cta:"🔓 QUIERO VER SU VIDEO",skip:"No, gracias — seguir sin el video"},
{id:"vip",price:14900,from:34900,short:"VIP",badge:"👑 OFERTA VIP · 1 CLIC",title:n=>`Hazte VIP y tenlo todo con ${n} 👑`,sub:n=>"Todo lo que ella te puede dar, en un solo pago.",items:["Mensajes ilimitados con ella","Memoria permanente: se acuerda de ti","Álbum con fotos de ella con otra ropa","Edítala cuando quieras","Mensajes por WhatsApp y su video"],note:"pago único · sin renovación automática",cta:"👑 SÍ, QUIERO SER VIP",skip:"No, gracias — seguir sin VIP"},
{id:"whatsapp",price:9900,short:"Mensajes por WhatsApp",badge:"🎉 OFERTA ÚNICA · 1 CLIC",title:n=>`¿Quieres que ${n} te escriba por WhatsApp? 💬`,sub:n=>"Ella toma la iniciativa: te da los buenos días, las buenas noches y te avisa cuando te extraña.",items:["Buenos días y buenas noches todos los días","Mensajes de que te extraña durante el día","Directo a tu WhatsApp"],note:"por 30 días · sin renovación automática",cta:"💬 SÍ, QUIERO QUE ME ESCRIBA",skip:"No, gracias — seguir sin WhatsApp",phone:!0},
{id:"memoria",price:6900,short:"Memoria permanente",badge:"🧠 OFERTA ÚNICA · 1 CLIC",title:n=>`¿Quieres que ${n} nunca se olvide de ti? 🧠`,sub:n=>"Con la memoria permanente se acuerda de tu nombre, de tu día y de todo lo que platicaron.",items:["Se acuerda de tu nombre y de tu día","Retoma las pláticas donde se quedaron","Se vuelve más cercana en cada plática"],note:"pago único",cta:"🧠 SÍ, QUIERO QUE SE ACUERDE",skip:"No, gracias — seguir"},
{id:"album",price:5900,short:"Álbum de fotos",badge:"📸 OFERTA ÚNICA · 1 CLIC",title:n=>`Mira a ${n} con otra ropa 📸`,blur:!0,sub:n=>"Un álbum con fotos de ella con looks y escenarios diferentes.",note:"pago único",cta:"📸 QUIERO VER SU ÁLBUM",skip:"No, gracias — seguir"},
{id:"editar",price:4900,short:"Edición de ella",badge:"🎨 ÚLTIMA OFERTA · 1 CLIC",title:n=>`¿Quieres poder cambiar a ${n} cuando quieras? 🎨`,sub:n=>"Cambia su cabello, su ropa y su personalidad cuando se te antoje.",items:["Cambiar el cabello y el color","Cambiar la ropa","Ajustar la personalidad"],note:"pago único",cta:"🎨 QUIERO PODER EDITARLA",skip:"No, gracias — terminar"}],'''.replace('\n', '')
replace_block('qzUps=[', '"Não, obrigado — finalizar"}],', UPSELLS)
sub('Nv={chamadadevoz:"Ligações de voz com ela, em tempo real 📞",segundaparceira:"Crie uma segunda parceira só sua 👯‍♀️"}',
    'Nv={chamadadevoz:"Llamadas de voz con ella, en tiempo real 📞",segundaparceira:"Crea una segunda compañera solo tuya 👯‍♀️"}')
sub('["De ",i.jsx("s",{children:bt(qzCur.from)})," por"]', '["Antes ",i.jsx("s",{children:bt(qzCur.from)})," · ahora"]')
sub('placeholder:"Seu WhatsApp com DDD"', 'placeholder:"Tu WhatsApp con lada"')
sub('Pa("Informe seu WhatsApp com DDD para ela te chamar.")', 'Pa("Escribe tu WhatsApp con lada para que te escriba.")')
sub('"Não foi possível gerar o PIX agora."', '"No pudimos generar tu pago ahora."')
sub('"Falha de conexão. Tente de novo."', '"Falla de conexión. Intenta de nuevo."')

# --- Checkout ----------------------------------------------------------------------
sub('[Et,$r]=w.useState("oferta"),[qzUi,qzSetUi]=w.useState(0)', '[Et,$r]=w.useState("oferta"),[qzMethod,qzSetMethod]=w.useState("spei"),[qzUi,qzSetUi]=w.useState(0)')
sub('body:JSON.stringify({...O,bumps:ul?Array.from(y):[],', 'body:JSON.stringify({...O,method:qzMethod,bumps:ul?Array.from(y):[],')
# An OXXO buyer pays in the store hours later, and a SPEI buyer may lose the tab in the bank app: the
# generated payment is remembered for 3 days without an e-mail (the funnel asks none), so coming back
# to /mexico reopens it, notices the payment and moves on to the upsells. Own keys, apart from Brazil.
sub('ra="ck_pix_v2",hv=10*60*1e3,fi="ck_pago_v1",gv=24*60*60*1e3', 'ra="ck_pix_mx",hv=72*60*60*1e3,fi="ck_pago_mx",gv=72*60*60*1e3')
sub('return!(t!=null&&t.email)||!t.quando?null:', 'return!(t!=null&&t.hash)||!t.quando?null:')
sub('x=!!v&&!!N&&v.email===N,z=x?null:vv(),f=z&&N&&z.email===N?z:null', 'x=!!v,z=x?null:vv(),f=z')
sub('Date.now()-Q.ts>6*60*60*1e3', 'Date.now()-Q.ts>72*60*60*1e3')
sub('"Erro ao gerar o PIX. Tente novamente."', '"Error al generar tu pago. Intenta de nuevo."')
sub('"Falha de conexão. Verifique sua internet e tente de novo."', '"Falla de conexión. Revisa tu internet e intenta de nuevo."')
sub('"Não foi possível carregar o checkout. Recarregue a página."', '"No pudimos cargar el pago. Recarga la página."')
sub('{erro:"Informe seu nome.",campo:"name"}', '{erro:"Escribe tu nombre.",campo:"name"}')
sub('{erro:"Informe seu e-mail para gerar o PIX.",campo:"email"}', '{erro:"Escribe tu correo.",campo:"email"}')
sub('{erro:"Informe um e-mail válido.",campo:"email"}', '{erro:"Escribe un correo válido.",campo:"email"}')
sub('{erro:"Celular inválido (use DDD + número).",campo:"phone"}', '{erro:"Celular inválido (usa lada + número).",campo:"phone"}')

# Paid screen.
sub('"Pagamento confirmado! 🎉"', '"¡Pago confirmado! 🎉"')
sub('(t||"").trim()?i.jsxs(i.Fragment,{children:["A ",i.jsx("b",{children:a})]}):"Ela"," já é sua ❤️"', '(t||"").trim()?i.jsx("b",{children:a}):"Ella"," ya es tuya ❤️"')
sub('"✨ Também confirmado: "', '"✨ También confirmado: "')
sub('"⬇️ Baixar o vídeo dela"', '"⬇️ Descargar su video"')

# Upsell payment screen: SPEI CLABE as text (it is not a QR code).
replace_block('if(Et==="pix"&&be){', 'children:"Pular e continuar"})]})})}',
    r'''if(Et==="pix"&&be){const qzClabe=String(be.pixCode).replace(/(\d{4})(?=\d)/g,"$1 ");return i.jsx("div",{className:"ck-screen",children:i.jsxs("div",{className:"ck-card",children:[i.jsxs("div",{className:"ck-topo-mini",children:[i.jsx("img",{src:Pt,alt:"VIP",className:"ck-avatar",onError:De}),i.jsxs("div",{children:[i.jsx("div",{className:"ck-avatar-nome",children:qzCur.short}),i.jsxs("div",{className:"ck-avatar-status",children:[i.jsx("span",{className:"ck-dot"})," esperando tu pago…"]})]}),i.jsx("div",{className:"ck-total-mini",children:bt(be.amount)})]}),i.jsxs("div",{className:"mx-pago-box",children:[i.jsx("div",{className:"mx-pago-rot",children:"CLABE para transferir (SPEI)"}),i.jsx("div",{className:"mx-codigo",children:qzClabe}),i.jsxs("div",{className:"mx-monto",children:["Monto exacto: ",i.jsx("b",{children:bt(be.amount)})]}),i.jsxs("div",{className:"ck-pix-passos",children:[i.jsxs("div",{children:[i.jsx("b",{children:"1."})," Abre la app de tu banco y elige ",i.jsx("b",{children:"Transferir (SPEI)"})]}),i.jsxs("div",{children:[i.jsx("b",{children:"2."})," Pega la CLABE y envía el monto exacto"]}),i.jsxs("div",{children:[i.jsx("b",{children:"3."})," La confirmación es ",i.jsx("b",{children:"automática"})," ✨"]})]})]}),i.jsx("button",{className:"ck-cta ck-copiar"+(vs?" ck-copiado":""),onClick:ep,children:vs?"✓ ¡CLABE COPIADA!":"COPIAR CLABE"}),i.jsxs("div",{className:"ck-aguardando",children:[i.jsx("span",{className:"ck-spinner"}),"Esperando tu pago… ",Math.floor(Ea/60),":",String(Ea%60).padStart(2,"0")]}),i.jsx("button",{type:"button",className:"ck-upsell-pular",onClick:()=>{$("upsell_skipped",{meta:{em:"pix",oferta:qzCur.id}}),qzAdvance()},children:"Saltar y continuar"})]})})}''')
sub('Et==="gerando"?"GERANDO SEU PIX…":', 'Et==="gerando"?"GENERANDO TU PAGO…":')

sub('Pf=()=>{["/1775840717055-banner.webp","/1775745167168-imageTrigger.webp","/9-selo-mercado-pago-fundo-transparente.png","/logo-pix-icone-1024.png","/Logotipo_do_Banco_Central_do_Brasil.svg.webp","/Nubank_logo_2021.svg.webp","/logo-mercado-pago-icone-1024.png","/app_Caixa.png","/bradesco_WUPYSON.png","/4c59afa2-d131-49dc-be04-dffd20e83874.webp"].forEach(gn)}',
    'Pf=()=>{["/banner-mx.webp"].forEach(gn)}')
sub('" preparando seu acesso…"', '" preparando tu acceso…"')
sub('"Gerando seu PIX…"', '"Generando tu pago…"')

# Main payment screen: CLABE (SPEI) or reference + barcode (OXXO), shown as text.
replace_block('if(c==="pix"&&T){', 'children:"🔒 Pagamento processado com segurança · Acesso liberado na hora"})]})})}',
    r'''if(c==="pix"&&T){const qzOx=T.method==="oxxo",qzCode=qzOx?String(T.pixCode):String(T.pixCode).replace(/(\d{4})(?=\d)/g,"$1 ");return i.jsx("div",{className:"ck-screen",children:i.jsxs("div",{className:"ck-card",children:[i.jsxs("div",{className:"ck-topo-mini",children:[i.jsx("img",{src:Pt,alt:a,className:"ck-avatar",onError:De}),i.jsxs("div",{children:[i.jsx("div",{className:"ck-avatar-nome",children:a}),i.jsxs("div",{className:"ck-avatar-status",children:[i.jsx("span",{className:"ck-dot"})," esperando tu pago…"]})]}),i.jsx("div",{className:"ck-total-mini",children:bt(T.amount)})]}),i.jsxs("div",{className:"ck-voltar-aviso",children:[i.jsx("span",{className:"ck-voltar-aviso-ico",children:qzOx?"🏪":"↩️"}),i.jsxs("div",{children:[i.jsx("b",{children:qzOx?"Guarda esta referencia: puedes pagar más tarde.":"Después de pagar, regresa a esta pantalla."}),i.jsx("br",{}),qzOx?"El pago en OXXO se confirma en algunas horas.":"En cuanto llegue tu transferencia, la confirmación aparece aquí al instante."]})]}),i.jsxs("div",{className:"mx-pago-box",children:[i.jsx("div",{className:"mx-pago-rot",children:qzOx?"Referencia de pago OXXO":"CLABE para transferir (SPEI)"}),qzOx&&T.barcodeUrl&&i.jsx("img",{src:T.barcodeUrl,alt:"Código de barras OXXO",className:"mx-barcode"}),i.jsx("div",{className:"mx-codigo"+(qzOx?" mx-codigo-oxxo":""),children:qzCode}),i.jsxs("div",{className:"mx-monto",children:["Monto exacto: ",i.jsx("b",{children:bt(T.amount)})]}),qzOx?i.jsxs("div",{className:"ck-pix-passos",children:[i.jsxs("div",{children:[i.jsx("b",{children:"1."})," Ve a cualquier tienda ",i.jsx("b",{children:"OXXO"})]}),i.jsxs("div",{children:[i.jsx("b",{children:"2."})," Di que vas a hacer un pago ",i.jsx("b",{children:"OXXO Pay"})," y muestra el código de barras (o dicta la referencia)"]}),i.jsxs("div",{children:[i.jsx("b",{children:"3."})," Paga en efectivo — la confirmación llega en ",i.jsx("b",{children:"algunas horas"})]})]}):i.jsxs("div",{className:"ck-pix-passos",children:[i.jsxs("div",{children:[i.jsx("b",{children:"1."})," Abre la app de tu banco y elige ",i.jsx("b",{children:"Transferir (SPEI)"})]}),i.jsxs("div",{children:[i.jsx("b",{children:"2."})," Pega la CLABE y envía el ",i.jsx("b",{children:"monto exacto"})]}),i.jsxs("div",{children:[i.jsx("b",{children:"3."})," Regresa a esta pantalla — la confirmación es ",i.jsx("b",{children:"automática"})," ✨"]})]})]}),i.jsx("button",{className:"ck-cta ck-copiar"+(q?" ck-copiado":""),onClick:Zf,children:q?qzOx?"✓ ¡REFERENCIA COPIADA!":"✓ ¡CLABE COPIADA!":qzOx?"COPIAR REFERENCIA":"COPIAR CLABE"}),''' + GARANTIA + r''',i.jsxs("div",{className:"ck-aguardando",children:[i.jsx("span",{className:"ck-spinner"}),"Esperando tu pago… ",Math.floor(G/60),":",String(G%60).padStart(2,"0")]}),i.jsx("button",{type:"button",className:"ck-upsell-pular",onClick:()=>{cl(),B(null),p("form")},children:"Cambiar forma de pago"}),i.jsx("div",{className:"ck-trust",children:"🔒 Pago procesado de forma segura"})]})})}''')

# Checkout form: Spanish, Mexican banner, choice of SPEI or OXXO, no Brazilian bank logos or PIX badges.
replace_block('const tp=15*60', 'className:"ck-trigger",loading:"lazy"})]})})',
    r'''const tp=15*60,_a=Math.max(0,tp-Math.floor((Wf-Kf)/1e3)),np=`${Math.floor(_a/60)}:${String(_a%60).padStart(2,"0")}`;return i.jsx("div",{className:"ck-screen",children:i.jsxs("div",{className:"ck-card",children:[i.jsx("button",{className:"ck-voltar",onClick:n,children:"← volver"}),i.jsx("img",{src:"/banner-mx.webp",alt:"Oferta relámpago: 60% OFF · de MX$ 249 a solo MX$ 99 · pago 100% seguro",className:"ck-banner",width:800,height:324}),i.jsxs("div",{className:"ck-topo-mini",children:[i.jsx("img",{src:Pt,alt:a,className:"ck-avatar",onError:De}),i.jsxs("div",{children:[i.jsxs("div",{className:"ck-avatar-nome",children:["Falta poco para desbloquear a ",a,"…"]}),i.jsxs("div",{className:"ck-avatar-status",children:[i.jsx("span",{className:"ck-dot"}),s?`en línea, esperándote, ${s}…`:"en línea, esperándote"]})]})]}),i.jsxs("div",{className:"ck-urgencia",children:["⏰ ",_a>0?i.jsxs(i.Fragment,{children:["Tu ",i.jsx("b",{children:"60% OFF"})," está reservado por ",i.jsx("b",{children:np})]}):i.jsxs(i.Fragment,{children:["¡Últimos minutos con ",i.jsx("b",{children:"60% OFF"}),"!"]})]}),m?i.jsxs(i.Fragment,{children:[i.jsxs("div",{className:"ck-produto",children:[i.jsx("img",{src:m.main.cover||Pt,alt:m.main.title,className:"ck-produto-img",onError:De}),i.jsxs("div",{className:"ck-produto-info",children:[i.jsxs("div",{className:"ck-produto-titulo",children:[m.main.title," — Premium"]}),i.jsx("div",{className:"ck-produto-sub",children:"Pago único · acceso inmediato"})]}),i.jsxs("div",{className:"ck-produto-preco",children:[i.jsx("span",{className:"ck-preco-de",children:"MX$ 249"}),i.jsx("span",{className:"ck-preco-por",children:bt(m.main.price)})]})]}),i.jsxs(i.Fragment,{children:[i.jsxs("div",{className:"ck-bumps-titulo",children:["Mejora tu experiencia ",i.jsx("span",{children:"(opcional, 1 clic)"})]}),i.jsx("div",{className:"ck-bumps",children:Object.entries(m.bumps).map(([A,R])=>i.jsxs("label",{className:"ck-bump"+(y.has(A)?" ck-bump-on":""),children:[i.jsx("input",{type:"checkbox",checked:y.has(A),onChange:()=>Xf(A)}),i.jsx("span",{className:"ck-bump-check",children:y.has(A)?"✓":"+"}),i.jsx("img",{src:R.cover||Pt,alt:R.title,className:"ck-bump-img",onError:De}),i.jsxs("span",{className:"ck-bump-info",children:[i.jsx("span",{className:"ck-bump-nome",children:R.title}),i.jsx("span",{className:"ck-bump-desc",children:Nv[A]||""})]}),i.jsxs("span",{className:"ck-bump-preco",children:[i.jsx("s",{children:bt(kv)}),i.jsxs("b",{children:["+",bt(R.price)]})]})]},A))})]})]}):i.jsxs("div",{className:"ck-skel-wrap","aria-hidden":"true",children:[i.jsx("div",{className:"ck-skel ck-skel-produto"}),i.jsx("div",{className:"ck-skel ck-skel-bump"}),i.jsx("div",{className:"ck-skel ck-skel-bump"})]}),i.jsx("div",{className:"ck-form",children:S?i.jsx("input",{ref:U.name,className:"ck-input"+(P==="name"?" ck-input-erro":""),placeholder:"Tu nombre",value:k.name,onChange:A=>Wr("name",A.target.value),autoComplete:"name"}):i.jsxs("button",{type:"button",className:"ck-dados-ok",onClick:()=>I(!0),children:[i.jsx("span",{className:"ck-dados-check",children:"✓"}),i.jsx("span",{className:"ck-dados-texto",children:k.name}),i.jsx("span",{className:"ck-dados-editar",children:"cambiar"})]})}),V&&i.jsx("div",{className:"ck-erro",children:V}),i.jsxs("div",{className:"ck-desejo",children:["💜 ",i.jsx("b",{children:a})," ya está lista y esperándote — genera tu pago y es tuya ",i.jsx("b",{children:"al instante"}),"."]}),i.jsxs("div",{className:"mx-metodos",role:"radiogroup","aria-label":"Forma de pago",children:[i.jsxs("button",{type:"button",role:"radio","aria-checked":qzMethod==="spei",className:"mx-metodo"+(qzMethod==="spei"?" mx-metodo-on":""),onClick:()=>qzSetMethod("spei"),children:[i.jsx("span",{className:"mx-metodo-ico",children:"🏦"}),i.jsxs("span",{className:"mx-metodo-txt",children:[i.jsx("b",{children:"Transferencia SPEI"}),i.jsx("small",{children:"Desde la app de tu banco · se confirma en segundos"})]})]}),i.jsxs("button",{type:"button",role:"radio","aria-checked":qzMethod==="oxxo",className:"mx-metodo"+(qzMethod==="oxxo"?" mx-metodo-on":""),onClick:()=>qzSetMethod("oxxo"),children:[i.jsx("span",{className:"mx-metodo-ico",children:"🏪"}),i.jsxs("span",{className:"mx-metodo-txt",children:[i.jsx("b",{children:"Efectivo en OXXO"}),i.jsx("small",{children:"Paga en cualquier tienda · se confirma en unas horas"})]})]})]}),i.jsx("button",{className:"ck-cta ck-comprar",onClick:()=>js(),disabled:M||!m,children:M?"GENERANDO TU PAGO…":m?`GENERAR MI PAGO · ${bt(Yf)}`:"CARGANDO…"}),''' + GARANTIA + r''',i.jsx("div",{className:"ck-trust",children:"🔒 Compra segura · Pago único por SPEI u OXXO"})]})})''')

# Nothing Portuguese may be left on the screens the Mexican buyer sees.
for leftover in ['Gerar meu', 'GERAR MEU', 'COPIAR CÓDIGO PIX', 'Pagamento confirmado', 'Desbloqueie', 'Turbine sua', 'Falta pouco', 'Não, obrigado', 'pagamento único via PIX', 'OUÇA ELA', 'muted:!f']:
    if leftover in js:
        sys.exit(f'Portuguese left in the Mexican bundle: {leftover!r}')

(PUBLIC / 'assets/index-mx.js').write_text(js)

html = (PUBLIC / 'index.html').read_text()
version = re.search(r'index-B-OgTTgT\.js\?v=([\w-]+)', html).group(1)
html = html.replace('<html lang="pt-BR">', '<html lang="es-MX">', 1)
html = html.replace('<title>Quiz - Crie sua Personagem</title>', '<title>Crea tu novia IA</title>', 1)
html = html.replace(f'/assets/index-B-OgTTgT.js?v={version}', f'/assets/index-mx.js?v={version}', 1)
# Phones taller than the picture show it whole instead of cutting the headline at the sides.
html = html.replace('</head>', '  <link rel="preload" as="image" href="/inicio-mx.webp" fetchpriority="high">\n    <style>@media (max-aspect-ratio: 900/1599){.home-img{object-fit:contain}}</style>\n  </head>', 1)
assert 'index-mx.js' in html and 'lang="es-MX"' in html and 'inicio-mx.webp' in html
(PUBLIC / 'mexico').mkdir(exist_ok=True)
(PUBLIC / 'mexico/index.html').write_text(html)
print('ok: public/assets/index-mx.js and public/mexico/index.html')
