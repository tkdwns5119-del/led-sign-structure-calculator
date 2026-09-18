'use strict';
const $=id=>document.getElementById(id);
const engine=globalThis.FrameCalculator;
const fmt=(n,d=2)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d});
const colors={A:'#506d9b',B:'#284b79',C:'#df9b43',D:'#efc078',E:'#388685'};
let current=null;
function readInput(){return Object.fromEntries(Object.keys(engine.defaults).map(k=>[k,$(k).value.trim()===''?NaN:Number($(k).value)]));}
function draw(result){
  const v=result.input,scale=Math.min(570/v.width,218/v.height),w=v.width*scale,h=v.height*scale,b=v.face*scale,x=(740-w)/2,y=43+(218-h)/2;
  const rect=(rx,ry,rw,rh,color)=>`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${color}"/>`;
  let members=rect(x,y,b,h,'#dfebfa')+rect(x+w-b,y,b,h,'#dfebfa')+rect(x+b,y,w-2*b,b,'#dfebfa')+rect(x+b,y+h-b,w-2*b,b,'#dfebfa');
  const bay=result.clearWidth*scale;
  for(let i=0;i<v.vertical;i++)members+=rect(x+b+bay*(i+1)+b*i,y+b,b,h-2*b,'#ffbc6f');
  for(let j=0;j<v.horizontal;j++){const hy=y+b+result.clearHeight*scale*(j+1)+b*j;for(let i=0;i<=v.vertical;i++)members+=rect(x+b+(bay+b)*i,hy,bay,b,'#ffbc6f');}
  const line=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#92a8c3" stroke-width="1"/>`;
  const dims=line(x,y-18,x+w,y-18)+line(x,y-25,x,y-7)+line(x+w,y-25,x+w,y-7)+line(x-24,y,x-24,y+h)+line(x-31,y,x-12,y)+line(x-31,y+h,x-12,y+h);
  $('drawing').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 310" role="img" aria-label="가로 ${v.width}mm, 세로 ${v.height}mm. 세로 보강재 ${v.vertical}개, 가로 보강재 ${v.horizontal}열인 프레임 정면 배치도"><g>${members}${dims}</g><g fill="#d4e1f0" font-family="system-ui,sans-serif" font-size="14"><text x="370" y="${y-27}" text-anchor="middle">${fmt(v.width,0)} mm</text><text transform="translate(${x-36},${y+h/2}) rotate(-90)" text-anchor="middle">${fmt(v.height,0)} mm</text><text x="370" y="${Math.min(296,y+h+30)}" text-anchor="middle" fill="#9bb2ce" font-size="13">${v.vertical+1}칸 × ${v.horizontal+1}칸 · 균등 배치</text></g></svg>`;
  $('drawingView').textContent=v.planes===2?'정면 + 측면 개념도 · 1대 기준':'정면 · 1대 기준';
  $('sideDrawing').hidden=v.planes!==2;
  if(v.planes===2)$('sideDrawing').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 160" role="img" aria-label="측면 개념도. 앞뒤 프레임 전체 깊이 ${v.depth}mm, 연결재 길이 ${v.depth-2*v.face}mm. 모서리 연결재 총4개. 축척 생략"><g fill="none" stroke="#dfebfa" stroke-width="8"><path d="M255 30v96 M485 30v96"/></g><g stroke="#69b6b2" stroke-width="6"><path d="M259 36h222 M259 120h222"/></g><g fill="#d4e1f0" font-size="14" text-anchor="middle" font-family="system-ui,sans-serif"><text x="370" y="20">전체 깊이 ${fmt(v.depth,1)} mm</text><text x="370" y="77">연결재 ${fmt(v.depth-2*v.face,1)} mm × 4개</text><text x="255" y="150">앞면</text><text x="485" y="150">뒷면</text><text x="635" y="145" fill="#9bb2ce" font-size="12">축척 생략</text></g></svg>`;
}
function renderPurchase(result){
  const p=result.purchase,v=result.input,ready=p.status==='ready';
  $('purchaseContent').hidden=!ready;$('purchaseWarning').hidden=ready;
  if(!ready){$('purchaseWarning').textContent=p.message;return;}
  $('stockCount').textContent=`${fmt(p.stockCount,0)} 본`;$('purchaseWeight').textContent=`${fmt(p.purchaseWeight,1)} kg`;$('utilization').textContent=`${fmt(p.utilization,1)} %`;
  $('lossSummary').textContent=`구매 ${fmt(p.grossLength,3)} m = 부재 ${fmt(result.totalLength,3)} m + 톱날 손실 ${fmt(p.kerfLoss,3)} m + 양끝 정리 ${fmt(p.trimLoss,3)} m + 잔재 ${fmt(p.remainder,3)} m`;
  $('patternCount').textContent=`${p.patterns.length}가지`;
  $('cutPatterns').innerHTML=p.patterns.map((pattern,i)=>{
    const bar=pattern.cuts.map(c=>`<span style="width:${100*c.length*c.count/v.stockLength}%;background:${colors[c.code]}" title="${c.name} ${fmt(c.length,3)}mm × ${c.count}개">${c.code}</span>`).join('');
    const trim=pattern.trimLoss/v.stockLength*100,loss=pattern.kerfLoss/v.stockLength*100,remainder=pattern.remainder/v.stockLength*100;
    return `<div class="cut-pattern"><div class="pattern-heading"><strong>패턴 ${i+1} <span>× ${fmt(pattern.repeat,0)}본</span></strong><span>1본당 잔재 ${fmt(pattern.remainder,1)} mm</span></div><div class="cut-bar" aria-hidden="true"><span style="width:${trim}%" class="cut-waste"></span>${bar}<span class="cut-waste" style="width:${loss}%"></span><span class="cut-remainder" style="width:${remainder}%"></span></div><p class="cut-labels">${pattern.cuts.map(c=>`<span><i style="background:${colors[c.code]}">${c.code}</i> ${fmt(c.length,3)} mm × ${c.count}개</span>`).join('')}</p></div>`;
  }).join('');
}
function render(){
  const two=$('planes').value==='2';$('depthField').hidden=!two;$('depthHint').hidden=!two;
  for(const key of Object.keys(engine.defaults))$(key).removeAttribute('aria-invalid');
  try{
    const input=readInput();
    if(!two&&(!Number.isFinite(input.depth)||input.depth<1||input.depth>100000))input.depth=engine.defaults.depth;
    for(const[key,[min,max,integer]]of Object.entries(engine.limits))if(!Number.isFinite(input[key])||input[key]<min||input[key]>max||(integer&&!Number.isInteger(input[key])))$(key).setAttribute('aria-invalid','true');
    current=engine.calculate(input);$('error').hidden=true;$('download').disabled=false;$('save').disabled=false;
    $('totalWeight').textContent=fmt(current.totalWeight,1);$('mobileWeight').textContent=`${fmt(current.totalWeight,1)} kg`;$('totalLength').textContent=fmt(current.totalLength);$('totalPieces').textContent=fmt(current.totalPieces,0);
    $('weightDetail').textContent=`각관 ${fmt(current.frameWeight,1)} + 기타 ${fmt(current.equipmentWeight,1)} kg`;
    $('area').textContent=`전면 면적 ${fmt(current.area)} m² / 대`;
    $('tableSubtitle').textContent=`${fmt(input.frames,0)}대 · ${input.planes===2?'앞뒤 2면 + 연결재':'단면 1면'} · ${fmt(input.unitWeight,3)} kg/m`;
    $('rows').innerHTML=current.rows.map(r=>`<tr><th scope="row"><span class="part-code" style="background:${colors[r.code]}">${r.code}</span>${r.name}</th><td>${fmt(r.length,3)}</td><td>${fmt(r.count,0)}</td><td>${fmt(r.totalLength,3)}</td><td>${fmt(r.weight,2)}</td></tr>`).join('');
    $('sumPieces').textContent=fmt(current.totalPieces,0);$('sumLength').textContent=fmt(current.totalLength,3);$('sumWeight').textContent=fmt(current.frameWeight,2);draw(current);renderPurchase(current);
  }catch(e){
    current=null;$('error').textContent=e.message;$('error').hidden=false;$('download').disabled=true;$('save').disabled=true;
    ['totalWeight','totalLength','totalPieces','sumPieces','sumLength','sumWeight','mobileWeight'].forEach(id=>$(id).textContent='—');
    $('weightDetail').textContent='입력값을 확인하세요';$('rows').replaceChildren();$('drawing').textContent='유효한 치수를 입력하면 배치도가 표시됩니다.';$('sideDrawing').hidden=true;$('area').textContent='—';$('tableSubtitle').textContent='입력값 확인 필요';$('purchaseContent').hidden=true;$('purchaseWarning').textContent='입력값을 확인하면 구매 본수를 계산합니다.';$('purchaseWarning').hidden=false;
  }
}
function applyInput(input,section='custom'){for(const[k,v]of Object.entries(input))if(k in engine.defaults)$(k).value=v;$('section').value=section;render();}
function status(message,isError=false){$('projectStatus').textContent=message;$('projectStatus').hidden=false;$('projectStatus').classList.toggle('is-error',isError);}
function downloadFile(text,type,name){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('inputs').addEventListener('submit',e=>e.preventDefault());
$('inputs').addEventListener('input',e=>{if(['face','unitWeight'].includes(e.target.id))$('section').value='custom';if(e.target.id==='section'){const p=engine.presets[$('section').value];if(p){$('face').value=p.face;$('unitWeight').value=p.unitWeight;}}render();});
$('reset').addEventListener('click',()=>{applyInput(engine.defaults,'50');status('예시값으로 초기화했습니다.');});
$('download').addEventListener('click',()=>{if(current)downloadFile(engine.toCSV(current,$('section').selectedOptions[0].textContent),'text/csv;charset=utf-8',`전광판_자재산출_${current.input.width}x${current.input.height}_${current.input.frames}대.csv`);});
$('save').addEventListener('click',()=>{if(!current)return;downloadFile(JSON.stringify({type:'led-frame-project',version:2,section:$('section').value,input:current.input},null,2),'application/json',`전광판_설정_${current.input.width}x${current.input.height}.json`);status('설정 파일 다운로드를 요청했습니다. 다음 작업 때 ‘설정 불러오기’로 이어서 계산할 수 있습니다.');});
$('load').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw new Error('설정 파일은 100KB 이하만 불러올 수 있습니다.');const project=engine.parseProject(await file.text());applyInput(project.input,project.section);status('저장한 설정을 불러왔습니다.');}catch(err){status(`${err.message} 기존 입력값은 유지됩니다.`,true);}finally{e.target.value='';}});
render();
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'calculate_frame',title:'프레임 수량·중량과 구매 본수 계산',description:'치수와 절단 조건을 입력해 화면을 갱신하고 부재 수량, 중량, 참고 구매 본수를 반환합니다. 구조 안전성 검토는 포함하지 않습니다.',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(engine.limits).map(([k,[min,max,integer]])=>[k,{type:integer?'integer':'number',minimum:min,maximum:max,description:engine.labels[k]}])),required:Object.keys(engine.defaults),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const verified=engine.calculate(input);applyInput(verified.input);return {totalWeight:current.totalWeight,frameWeight:current.frameWeight,totalLength:current.totalLength,totalPieces:current.totalPieces,rows:current.rows,purchase:current.purchase};}})).catch(()=>{});}catch{}
}
