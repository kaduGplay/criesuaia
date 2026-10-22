"""Use the captured Brazilian quiz inside the Mexican payment/tracking shell.

No remote scripts execute at build time. Keep the existing checkout and verified
payment handling; import the public questionnaire, translations and navigation.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'source/brasil-2026-10-22/index-BR-QfwKO.js'
VERSION = 'mx-br-20261022-modal-original'


def between(text, start, end):
    assert text.count(start) == 1, start
    a = text.index(start)
    b = text.index(end, a)
    return text[a:b]


def adapt(js, html):
    original = SOURCE.read_text()
    # Import the original email-only modal and preserve its Spanish copy.
    modal = between(original, 'cg=({onDone:', ',dg=').replace('Rt("Lead")', 'vt("Lead")')
    js = js.replace(between(js, 'cg=({onDone:', ',dg='), modal, 1)
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
    replacements = {
        'd="nq_quiz_state"': 'd="nq_quiz_state_mx_br_v1"',
        'Date.now()-Q.ts>6*60*60*1e3': 'Date.now()-Q.ts>72*60*60*1e3',
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
    # Replace inherited broken comments with a short, auditable document.
    html = re.sub(r'<!--.*?-->', '', html, flags=re.S)
    html = re.sub(r'\n\s*\n', '\n', html)
    assert 'onCheckout:t==="br"' not in js
    assert 'd="nq_quiz_state_mx_br_v1"' in js
    assert 'tc.filter(q=>q.id!==16)' in js
    return js, html
