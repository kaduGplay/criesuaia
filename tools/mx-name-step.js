mxPreview=props=>{
 const [known,setKnown]=w.useState(()=>{try{return !!localStorage.getItem("nq_nome")?.trim()}catch{return !1}});
 const [name,setName]=w.useState("");
 const [error,setError]=w.useState(!1);
 const input=w.useRef(null),submitted=w.useRef(!1);
 w.useEffect(()=>{if(known)return;const timer=setTimeout(()=>input.current?.focus(),350);return()=>clearTimeout(timer)},[known]);
 const submit=event=>{
  event.preventDefault();const value=name.trim();
  if(value.length<2){setError(!0);input.current?.focus();return}
  if(submitted.current)return;
  try{localStorage.setItem("nq_nome",value)}catch{}
  submitted.current=!0;
  $("user_name_submitted");
  setKnown(!0);
 };
 if(known)return i.jsx(xg,props);
 return i.jsx("div",{className:"preview-screen",children:i.jsx("div",{className:"preview-container",children:i.jsxs("div",{className:"name-input-section",children:[
  i.jsxs("div",{className:"logo-container",children:[i.jsx("img",{src:"/logo-icon.png",alt:"CliChat",className:"app-logo"}),i.jsxs("div",{className:"app-name",children:[i.jsx("span",{className:"app-name-we",children:"Cli"}),i.jsx("span",{className:"app-name-lover",children:"Chat"})]})]}),
  i.jsx("h2",{className:"preview-title",children:"¿Cómo te llamas?"}),
  i.jsx("p",{className:"preview-subtitle",children:"Dinos tu nombre o apodo para que ella sepa cómo llamarte."}),
  i.jsxs("form",{className:"name-form",onSubmit:submit,children:[
   i.jsx("input",{ref:input,type:"text",name:"name",autoComplete:"given-name",className:"name-input",placeholder:"Tu nombre (o apodo)","aria-label":"Tu nombre (o apodo)","aria-invalid":error,value:name,maxLength:30,onChange:event=>{setName(event.target.value);setError(!1)}}),
   i.jsx("button",{type:"submit",className:"submit-name-button",disabled:!name.trim(),children:"Continuar →"})
  ]}),
  error&&i.jsx("div",{className:"eg-erro",role:"alert",children:"Escribe tu nombre o apodo (mínimo 2 caracteres)."})
 ]})})});
}
