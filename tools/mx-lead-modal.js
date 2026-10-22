cg=({onDone})=>{
 const [name,setName]=w.useState(()=>{try{return localStorage.getItem("nq_nome")||""}catch{return""}});
 const [email,setEmail]=w.useState("");
 const [error,setError]=w.useState(null);
 const nameRef=w.useRef(null),emailRef=w.useRef(null),submitted=w.useRef(!1);
 w.useEffect(()=>{const timer=setTimeout(()=>{(name.trim()?emailRef.current:nameRef.current)?.focus()},350);return()=>clearTimeout(timer)},[]);
 const submit=event=>{
  event.preventDefault();
  const cleanName=name.trim(),cleanEmail=email.trim().toLowerCase();
  if(cleanName.length<2){setError("name");nameRef.current?.focus();return}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)){setError("email");emailRef.current?.focus();return}
  if(submitted.current)return;
  try{localStorage.setItem("nq_nome",cleanName);localStorage.setItem("nq_email",cleanEmail)}catch{}
  submitted.current=!0;
  $("user_name_submitted");
  // The existing event dispatcher records Lead once per session, including
  // later checkout submissions. Do not send a second Lead from this dialog.
  $("email_submitted");
  Se("email_capturado");
  onDone();
 };
 return i.jsx("div",{className:"eg-overlay",role:"dialog","aria-modal":"true","aria-labelledby":"mx-lead-title",children:i.jsxs("form",{className:"eg-modal",onSubmit:submit,children:[
  i.jsx("h2",{id:"mx-lead-title",className:"eg-titulo",children:"Tu IA está casi lista… 🔥"}),
  i.jsx("p",{className:"eg-sub",children:"Deja tu nombre y el correo que más usas para revelar a tu IA."}),
  i.jsx("input",{ref:nameRef,type:"text",name:"name",autoComplete:"given-name","aria-label":"Tu nombre (o apodo)","aria-invalid":error==="name",className:"eg-input eg-input-nome"+(error==="name"?" eg-input-erro":""),placeholder:"Tu nombre (o apodo)",value:name,maxLength:30,onChange:event=>{setName(event.target.value);if(error==="name")setError(null)}}),
  i.jsx("input",{ref:emailRef,type:"email",name:"email",inputMode:"email",autoComplete:"email",autoCapitalize:"none",spellCheck:!1,"aria-label":"Tu correo más usado","aria-invalid":error==="email",className:"eg-input"+(error==="email"?" eg-input-erro":""),placeholder:"Tu correo más usado",value:email,maxLength:254,onChange:event=>{setEmail(event.target.value);if(error==="email")setError(null)}}),
  error&&i.jsx("div",{className:"eg-erro",role:"alert",children:error==="name"?"Escribe tu nombre o apodo (mínimo 2 caracteres).":"Revisa tu correo 😉"}),
  i.jsx("button",{type:"submit",className:"eg-botao",children:"✨ REVELAR MI IA"})
 ]})});
}
