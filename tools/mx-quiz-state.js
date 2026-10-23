mxQuizState=(raw,count)=>{
 try{
  const state=JSON.parse(raw);
  if(!state||typeof state!=="object"||Array.isArray(state)||
     !["home","questions","loading","preview","offer","chat","checkout"].includes(state.phase)||
     !Number.isFinite(state.ts)||state.ts<=0||Date.now()-state.ts>72*60*60*1e3)return null;
  const index=Number.isInteger(state.currentQuestion)?state.currentQuestion:0;
  return {...state,
   phase:state.phase==="chat"?"offer":state.phase,
   currentQuestion:Math.max(0,Math.min(count-1,index)),
   answers:state.answers&&typeof state.answers==="object"&&!Array.isArray(state.answers)?state.answers:{},
   characterName:typeof state.characterName==="string"?state.characterName:""
  };
 }catch{return null}
}
