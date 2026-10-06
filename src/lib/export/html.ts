"use client";

import { saveAs } from "file-saver";
import type { PdfSection } from "./pdf";

// Exportação em HTML interativo (apresentável): um único arquivo, sem
// dependências externas, que abre em qualquer navegador. Recursos:
//  - tabelas com busca, ordenação por coluna e totais das colunas numéricas;
//  - gráfico de barras gerado a partir de cada tabela (primeira coluna de
//    texto x coluna numérica escolhida), com dica ao passar o mouse;
//  - modo apresentação: uma seção por tela, navegação por setas do teclado;
//  - tema claro/escuro automático e impressão limpa.

export interface HtmlExportOptions {
  subtitle?: string;
  logoDataUrl?: string;
  /** Indicadores de destaque no topo (cartões) */
  kpis?: { label: string; value: string; sub?: string }[];
}

export type HtmlSection = Pick<PdfSection, "title" | "columns" | "rows">;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildHtmlReport(title: string, sections: HtmlSection[], options: HtmlExportOptions = {}) {
  const data = {
    sections: sections.map((s) => ({
      title: s.title,
      columns: s.columns,
      rows: s.rows.map((r) => r.map((c) => String(c ?? ""))),
    })),
  };
  // </script> dentro dos dados quebraria o arquivo
  const json = JSON.stringify(data).replace(/</g, "\\u003c").replace(new RegExp("[\\u2028\\u2029]", "g"), "");
  const generated = new Date().toLocaleString("pt-BR");

  const kpiHtml = (options.kpis ?? [])
    .map(
      (k) =>
        `<div class="kpi"><span class="kpi-label">${escapeHtml(k.label)}</span><strong class="kpi-value">${escapeHtml(k.value)}</strong>${
          k.sub ? `<span class="kpi-sub">${escapeHtml(k.sub)}</span>` : ""
        }</div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{--bg:#f6f7f8;--card:#fff;--fg:#14202a;--muted:#5b6b78;--border:#dde3e8;--primary:#255474;--primary-subtle:#e5eef4;--bar:#255474;--hover:#f0f4f7}
@media (prefers-color-scheme:dark){:root{--bg:#10171d;--card:#18222a;--fg:#e8eef3;--muted:#98a8b5;--border:#2a3a46;--primary:#6fb0d8;--primary-subtle:#1d3444;--bar:#6fb0d8;--hover:#1f2c36}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{display:flex;align-items:center;gap:14px;padding:18px 28px;background:var(--card);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:5}
header img{width:44px;height:44px;object-fit:contain}
header h1{font-size:20px;margin:0}
header p{margin:2px 0 0;color:var(--muted);font-size:12px}
.spacer{flex:1}
button{font:inherit;border:1px solid var(--border);background:var(--card);color:var(--fg);padding:7px 12px;border-radius:6px;cursor:pointer}
button:hover{background:var(--hover)}
button.primary{background:var(--primary);color:#fff;border-color:var(--primary)}
main{max-width:1200px;margin:0 auto;padding:24px 28px 64px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:24px}
.kpi{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:2px}
.kpi-label{color:var(--muted);font-size:12px}.kpi-value{font-size:24px;font-variant-numeric:tabular-nums}.kpi-sub{color:var(--muted);font-size:12px}
section.slide{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:18px}
section.slide h2{margin:0 0 12px;font-size:16px}
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.tools input,.tools select{font:inherit;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--fg)}
.tools input{min-width:220px}
.count{color:var(--muted);font-size:12px;margin-left:auto}
.chart{margin:4px 0 16px;overflow-x:auto}
.chart svg{display:block;max-width:100%}
.chart text{fill:var(--muted);font-size:11px}
.chart rect.bar{fill:var(--bar);cursor:pointer}.chart rect.bar:hover{opacity:.8}
.tablewrap{overflow:auto;max-height:560px;border:1px solid var(--border);border-radius:8px}
table{border-collapse:collapse;width:100%}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
th{position:sticky;top:0;background:var(--primary-subtle);cursor:pointer;user-select:none;font-weight:600}
th.sorted::after{content:attr(data-arrow);margin-left:6px;color:var(--primary)}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
tr:hover td{background:var(--hover)}
tfoot td{font-weight:600;background:var(--primary-subtle);position:sticky;bottom:0}
.tip{position:fixed;pointer-events:none;background:#000d;color:#fff;padding:6px 9px;border-radius:6px;font-size:12px;display:none;z-index:20}
footer{color:var(--muted);font-size:12px;text-align:center;padding:12px}
body.present main{max-width:none;padding:24px 6vw}
body.present section.slide{display:none;min-height:70vh}
body.present section.slide.active{display:block}
body.present .tablewrap{max-height:48vh}
.nav{display:none;position:fixed;bottom:16px;left:50%;transform:translateX(-50%);gap:8px;align-items:center;background:var(--card);border:1px solid var(--border);padding:8px 12px;border-radius:999px;box-shadow:0 4px 18px #0003}
body.present .nav{display:flex}
@media print{header,.tools,.nav,.tip{display:none!important}body{background:#fff}.tablewrap{max-height:none;overflow:visible}section.slide{break-inside:avoid-page;border:none;padding:0}body.present section.slide{display:block}}
</style>
</head>
<body>
<header>
  ${options.logoDataUrl ? `<img alt="" src="${options.logoDataUrl}">` : ""}
  <div><h1>${escapeHtml(title)}</h1><p>${options.subtitle ? `${escapeHtml(options.subtitle)} · ` : ""}Gerado em ${escapeHtml(generated)}</p></div>
  <div class="spacer"></div>
  <button id="btn-present" class="primary" type="button">Modo apresentação</button>
  <button id="btn-print" type="button">Imprimir / PDF</button>
</header>
<main>
  ${kpiHtml ? `<div class="kpis">${kpiHtml}</div>` : ""}
  <div id="sections"></div>
</main>
<div class="nav"><button id="prev" type="button">←</button><span id="pos"></span><button id="next" type="button">→</button><button id="exit" type="button">Sair</button></div>
<div class="tip" id="tip"></div>
<footer>Grupo Mave CRM</footer>
<script>
const DATA=${json};
const $=(s,r=document)=>r.querySelector(s);
function parseNum(v){const t=String(v).trim();if(!/\\d/.test(t))return null;if(/[a-zA-ZÀ-ú]{2,}/.test(t.replace(/R\\$/g,'')))return null;
 let x=t.replace(/R\\$|%|\\s/g,'');if(/^-?\\d{1,3}(\\.\\d{3})*(,\\d+)?$/.test(x)||/^-?\\d+(,\\d+)?$/.test(x)){x=x.replace(/\\./g,'').replace(',','.');}else if(!/^-?\\d+(\\.\\d+)?$/.test(x))return null;
 const n=parseFloat(x);return isFinite(n)?n:null}
const fmt=(n,sample)=>/R\\$/.test(sample)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):/%/.test(sample)?n.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%':n.toLocaleString('pt-BR',{maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const tip=$('#tip');
function chart(box,sec,col,rows){
  const items=rows.map(r=>({label:r[0],v:parseNum(r[col]),raw:r[col]})).filter(i=>i.v!==null).slice(0,20);
  if(items.length<2){box.innerHTML='';return}
  const W=Math.max(520,items.length*54),H=230,pl=8,pb=58,pt=12,max=Math.max(...items.map(i=>Math.abs(i.v)))||1,bw=(W-pl*2)/items.length;
  let s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Gráfico de '+esc(sec.columns[col])+'">';
  items.forEach((i,k)=>{const h=Math.max(2,(Math.abs(i.v)/max)*(H-pb-pt)),x=pl+k*bw+bw*.15,y=H-pb-h;
    s+='<rect class="bar" x="'+x+'" y="'+y+'" width="'+bw*.7+'" height="'+h+'" rx="3" data-t="'+esc(i.label+': '+i.raw)+'"/>';
    const lab=String(i.label).length>12?String(i.label).slice(0,11)+'…':String(i.label);
    s+='<text transform="translate('+(x+bw*.35)+','+(H-pb+12)+') rotate(35)" text-anchor="start">'+esc(lab)+'</text>'});
  box.innerHTML=s+'</svg>';
  box.querySelectorAll('rect.bar').forEach(r=>{r.addEventListener('mousemove',e=>{tip.style.display='block';tip.textContent=r.dataset.t;tip.style.left=e.clientX+12+'px';tip.style.top=e.clientY+12+'px'});r.addEventListener('mouseleave',()=>tip.style.display='none')});
}
function build(sec,idx){
  const el=document.createElement('section');el.className='slide';el.id='s'+idx;
  const numCols=sec.columns.map((_,c)=>c).filter(c=>c>0&&sec.rows.length>0&&sec.rows.filter(r=>parseNum(r[c])!==null).length>=Math.max(1,sec.rows.length*.6));
  let state={q:'',sort:-1,dir:1,col:numCols[0]};
  el.innerHTML='<h2>'+esc(sec.title)+'</h2><div class="tools"><input type="search" placeholder="Buscar nesta tabela…" aria-label="Buscar">'+
   (numCols.length?'<select aria-label="Coluna do gráfico">'+numCols.map(c=>'<option value="'+c+'">Gráfico: '+esc(sec.columns[c])+'</option>').join('')+'</select>':'')+
   '<span class="count"></span></div><div class="chart"></div><div class="tablewrap"><table><thead></thead><tbody></tbody><tfoot></tfoot></table></div>';
  const body=$('tbody',el),head=$('thead',el),foot=$('tfoot',el),cnt=$('.count',el),box=$('.chart',el);
  function render(){
    let rows=sec.rows.filter(r=>!state.q||r.some(c=>c.toLowerCase().includes(state.q)));
    if(state.sort>=0){const c=state.sort;rows=[...rows].sort((a,b)=>{const x=parseNum(a[c]),y=parseNum(b[c]);const r=(x!==null&&y!==null)?x-y:String(a[c]).localeCompare(String(b[c]),'pt-BR');return r*state.dir})}
    head.innerHTML='<tr>'+sec.columns.map((h,c)=>'<th data-c="'+c+'" class="'+(numCols.includes(c)?'num ':'')+(state.sort===c?'sorted':'')+'" data-arrow="'+(state.dir>0?'▲':'▼')+'">'+esc(h)+'</th>').join('')+'</tr>';
    body.innerHTML=rows.map(r=>'<tr>'+r.map((v,c)=>'<td class="'+(numCols.includes(c)?'num':'')+'">'+esc(v)+'</td>').join('')+'</tr>').join('');
    const sums=numCols.filter(c=>sec.columns[c]&&!/%|taxa|média|medio|médio|ticket/i.test(sec.columns[c]));
    foot.innerHTML=sums.length&&rows.length>1?'<tr>'+sec.columns.map((_,c)=>{if(c===0)return'<td>Total</td>';if(!sums.includes(c))return'<td></td>';const t=rows.reduce((a,r)=>a+(parseNum(r[c])||0),0);return'<td class="num">'+esc(fmt(t,rows.find(r=>parseNum(r[c])!==null)?.[c]||''))+'</td>'}).join('')+'</tr>':'';
    cnt.textContent=rows.length+' de '+sec.rows.length+' linhas';
    if(numCols.length)chart(box,sec,state.col,rows);
    head.querySelectorAll('th').forEach(th=>th.onclick=()=>{const c=+th.dataset.c;state.dir=state.sort===c?-state.dir:1;state.sort=c;render()});
  }
  $('input',el).addEventListener('input',e=>{state.q=e.target.value.toLowerCase();render()});
  const sel=$('select',el);if(sel)sel.addEventListener('change',e=>{state.col=+e.target.value;render()});
  render();return el;
}
const host=$('#sections');const slides=DATA.sections.map(build);slides.forEach(s=>host.appendChild(s));
let cur=0;function show(i){cur=(i+slides.length)%slides.length;slides.forEach((s,k)=>s.classList.toggle('active',k===cur));$('#pos').textContent=(cur+1)+' / '+slides.length;window.scrollTo(0,0)}
function present(on){document.body.classList.toggle('present',on);if(on){show(cur);document.documentElement.requestFullscreen?.().catch(()=>{})}else{document.fullscreenElement&&document.exitFullscreen?.()}}
$('#btn-present').onclick=()=>present(!document.body.classList.contains('present'));
$('#btn-print').onclick=()=>window.print();
$('#prev').onclick=()=>show(cur-1);$('#next').onclick=()=>show(cur+1);$('#exit').onclick=()=>present(false);
addEventListener('keydown',e=>{if(!document.body.classList.contains('present')||/INPUT|SELECT/.test(document.activeElement.tagName))return;if(e.key==='ArrowRight'||e.key==='PageDown')show(cur+1);else if(e.key==='ArrowLeft'||e.key==='PageUp')show(cur-1);else if(e.key==='Escape')present(false)});
</script>
</body>
</html>`;
}

export function exportHtml(filename: string, title: string, sections: HtmlSection[], options?: HtmlExportOptions) {
  const html = buildHtmlReport(title, sections, options);
  saveAs(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
}
