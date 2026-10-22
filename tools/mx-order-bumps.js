m&&ul&&i.jsxs(i.Fragment,{children:[
 i.jsxs("div",{className:"ck-bumps-titulo",children:["Mejora tu experiencia ",i.jsx("span",{children:"(opcional, 1 clic)"})]}),
 i.jsx("div",{className:"ck-bumps",children:Object.entries(m.bumps).map(([id,product])=>i.jsxs("label",{className:"ck-bump"+(y.has(id)?" ck-bump-on":""),children:[
  i.jsx("input",{type:"checkbox",checked:y.has(id),onChange:()=>Xf(id)}),
  i.jsx("span",{className:"ck-bump-check",children:y.has(id)?"✓":"+"}),
  i.jsx("img",{src:product.cover||Pt,alt:product.title,className:"ck-bump-img",onError:De}),
  i.jsxs("span",{className:"ck-bump-info",children:[i.jsx("span",{className:"ck-bump-nome",children:product.title}),i.jsx("span",{className:"ck-bump-desc",children:Nv[id]||""})]}),
  i.jsxs("span",{className:"ck-bump-preco",children:[i.jsx("s",{children:bt(kv)}),i.jsxs("b",{children:["+",bt(product.price)]})]})
 ]},id))})
]})
