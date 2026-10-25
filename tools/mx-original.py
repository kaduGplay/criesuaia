"""Use the captured Brazilian quiz inside the Mexican payment/tracking shell.

No remote scripts execute at build time. Keep the existing checkout and verified
payment handling; import the public questionnaire, translations and navigation.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'source/brasil-2026-10-22/index-BR-QfwKO.js'
VERSION = 'mx-br-20261022-sin-whatsapp'


def between(text, start, end):
    assert text.count(start) == 1, start
    a = text.index(start)
    b = text.index(end, a)
    return text[a:b]


def adapt(js, html):
    original = SOURCE.read_text()
    # Separate email, visitor name and character name, using Mexican copy.
    modal = (ROOT / 'tools/mx-lead-modal.js').read_text().strip()
    modal += ',' + (ROOT / 'tools/mx-quiz-state.js').read_text().strip()
    js = js.replace(between(js, 'cg=({onDone:', ',dg='), modal, 1)
    js = js.replace('||"sua namorada"', '||"tu novia"')
    # Restore the original preparation illustration and the two original name
    # screens: character name first, visitor name second (even on a return visit).
    js = js.replace(between(js, 'dg=({onComplete:', ',_o='),
                    between(original, 'dg=({onComplete:', ',_o='), 1)
    js = js.replace('[h,v]=w.useState(()=>{try{return localStorage.getItem("nq_nome")||""}catch{return""}})',
                    '[h,v]=w.useState("")', 1)
    js = js.replace('m(!h.trim()),t(l.trim())', 'm(!0),t(l.trim())', 1)
    # Reuse the published Spanish preview copy rather than a rewritten variant.
    def preview_copy(text):
        start = text.index('preview:{', text.index('es:{highlightWords'))
        end = text.index('},offer:', start) + 1
        return text[start:end]
    js = js.replace(preview_copy(js), preview_copy(original), 1)
    # Keep the main checkout at MX$ 99. Offer the former order bumps only
    # after confirmed payment, then keep the existing VIP offer last.
    old = 'const qzL=e[0]==="anime"?qzUps.filter(u=>u.id!=="video"):qzUps'
    assert old in js
    js = js.replace(old, 'const qzL=["chamadadevoz","segundaparceira","vip"].map(id=>qzUps.find(u=>u.id===id))', 1)
    # No hidden required WhatsApp field in the main checkout. The gateway
    # accepts an empty phone; never substitute somebody else's phone number.
    phone_input = ',i.jsx("input",{ref:U.phone,type:"tel",inputMode:"tel",autoComplete:"tel",className:"ck-input"+(P==="phone"?" ck-input-erro":""),placeholder:"Tu WhatsApp (ej. 33 1234 5678)",value:k.phone,onChange:A=>Wr("phone",A.target.value)})'
    phone_validation = 'const n=e.phone.replace(/\\D/g,"");if(n.length<8)return{erro:"Escribe tu número de WhatsApp.",campo:"phone"};'
    for old, new in [(phone_input, ''), (phone_validation, ''), ('const O=Zu(k);Zt.current=O;', 'const O=Zu({...k,phone:""});Zt.current=O;')]:
        assert js.count(old) == 1, old
        js = js.replace(old, new, 1)
    # Import the actual published questions, their complete option sets and
    # translations, rather than recreating them from screenshots.
    questions = between(original, 'tc=[', ',Av=()=>')
    questions = questions.replace('label:"Normal",value:"normal",imagePath:"/escolha/',
                                  'label:"Realista",value:"normal",imagePath:"/escolha/')
    questions = questions.replace('"style-1":{label:"Normal"}', '"style-1":{label:"Realista"}')
    a = js.index('tc=[')
    b = js.index(',qzOrder=', a)
    js = js[:a] + questions + js[b:]

    renderer = between(original, '$h=({question:', ',Wh=')
    # Rapid double taps should select once, never jump over the next question.
    renderer = renderer.replace('=>{var C;const{t:a}',
        '=>{var C;const qzLock=w.useRef(!1);w.useEffect(()=>{qzLock.current=!1},[e.id]);const{t:a}', 1)
    renderer = renderer.replace('g=(S,I,P)=>{if(',
        'g=(S,I,P)=>{if(e.type==="single"&&!s){if(qzLock.current)return;qzLock.current=!0}if(', 1)
    renderer = renderer.replace('a.highlightWords.includes(V)?P.push(i.jsx("span",{className:"highlight-word",children:L},U))',
        'a.highlightWords.includes(V)?(U>0&&P.push(" "),P.push(i.jsx("span",{className:"highlight-word",children:L},U)))')
    old_renderer = between(js, '$h=({question:', ',Wh=')
    js = js.replace(old_renderer, renderer, 1)

    root = original[original.index('Av=()=>'):]
    state_start = 'const Q=JSON.parse(q);return!Q||!Q.phase||!Q.ts||Date.now()-Q.ts>6*60*60*1e3?null:((Q.phase==="chat"||Q.phase==="offer")&&(Q.phase=Yu?"chat":"offer"),Q)'
    assert root.count(state_start) == 1
    root = root.replace(state_start, 'return mxQuizState(q,tc.filter(q=>![4,5,6,8,9,16].includes(q.id)).length)', 1)
    replacements = {
        'd="nq_quiz_state"': 'd="nq_quiz_state_mx_br_v4"',
        'Rt("ViewContent"': 'vt("ViewContent"',
        'value:19.9,currency:"BRL"': 'value:99,currency:"MXN"',
        'onCheckout:t==="br"?()=>h("checkout")':
            'onCheckout:t==="latam"?()=>{stopFunnelMedia();h("checkout")}',
        # Anime only has these three recovered result colors.
        'return{...q,options:Xe,headerImage:G}':
            'return{...q,options:q.id===8&&Xe?Xe.filter(v=>["preto","castanho","loiro"].includes(v.value)):Xe,headerImage:G}',
        'children:i.jsx("div",{className:"progress-fill",style:{width:`${U}%`}})':
            'role:"progressbar","aria-label":"Progreso de tu IA","aria-valuemin":0,"aria-valuemax":L,"aria-valuenow":v+1,children:i.jsx("div",{className:"progress-fill",style:{width:`${U}%`}})',
        'ug()},[])': 'ug(),$("funnel_version",{meta:{version:"'+VERSION+'"}})},[])',
        'Sg();fl.createRoot': 'document.readyState==="complete"?Sg():window.addEventListener("load",()=>setTimeout(Sg,300),{once:!0});vt("PageView");fl.createRoot',
    }
    for old, new in replacements.items():
        assert old in root, old
        root = root.replace(old, new)
    # The unused alert from the public bundle must never be a purchase path.
    root = root.replace('E=()=>{console.log("Compra iniciada!",{answers:x,characterName:f}),alert("Redirecionando para pagamento...")}',
                        'E=()=>{stopFunnelMedia();h("checkout")}')
    root = root.replace('r.highlightWords.includes(Je)?G.push(i.jsx("span",{className:"highlight-word",children:Xe},Qe))',
        'r.highlightWords.includes(Je)?(Qe>0&&G.push(" "),G.push(i.jsx("span",{className:"highlight-word",children:Xe},Qe)))')
    # Drop the old seven-step selection and its unused grouping/teaser helpers.
    js = js[:js.index(',qzOrder=')] + ',qzAskEmail=!0,qzAskPhone=!1,' + root

    # The Brazilian home advances on a tap. Never move a reader off the home
    # picture automatically, and don't claim the longer quiz takes 40 seconds.
    js = js.replace('w.useEffect(()=>{const qzT=setTimeout(()=>{$("home_auto"),e()},5e3);return()=>clearTimeout(qzT)},[]);', '')
    html = re.sub(r'(?<=\?v=)[\w-]+', VERSION, html)
    html = html.replace('src="/local-runtime.js"', f'src="/local-runtime.js?v={VERSION}"')
    # Replace inherited broken comments with a short, auditable document.
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'\n\s*\n', '\n', html)
    assert 'onCheckout:t==="br"' not in js
    assert 'd="nq_quiz_state_mx_br_v4"' in js
    assert 'tc.filter(q=>q.id!==16)' in js
    return js, html
