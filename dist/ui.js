'use strict';
const $=id=>document.getElementById(id);
const engine=globalThis.FrameCalculator;
const fmt=(n,d=2)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d});
const colors={A:'#506d9b',B:'#284b79',C:'#df9b43',D:'#efc078',E:'#388685',F:'#7067a5',G:'#ac6797'};
let current=null;
function sectionOptions(family,selected){
  $('section').replaceChildren();
  for(const[id,p]of Object.entries(engine.presets))if(p.family===family){const option=document.createElement('option');option.value=id;option.textContent=`${p.label} · ${p.unitWeight} kg/m`;$('section').append(option);}
  const custom=document.createElement('option');custom.value='custom';custom.textContent='직접 입력';$('section').append(custom);
  if([...$('section').options].some(o=>o.value===selected))$('section').value=selected;
}
function selectedValues(){const p=engine.presets[$('section').value];if(p)for(const[k,v]of Object.entries(engine.presetValues($('section').value,Number($('rotation').value))))$(k).value=v;}
function sectionLabel(){const p=engine.presets[$('section').value];return `${engine.families[$('family').value]} · ${p?p.label:'사용자 지정'} · ${$('rotation').value==='1'?'90° 회전':'기본 방향'}`;}
function drawProfile(){
  const p=engine.presets[$('section').value],family=$('family').value;
  const face=Number($('face').value),depth=Number($('sectionDepth').value),rotation=Number($('rotation').value);
  if(!Number.isFinite(face)||!Number.isFinite(depth)||face<=0||depth<=0){$('profilePreview').textContent='유효한 부재 치수를 입력하세요.';return;}
  const scale=84/Math.max(face,depth),w=face*scale,h=depth*scale,x=(260-w)/2,y=(130-h)/2;
  let shape='';
  if(family==='hbeam'){
    const bw=rotation?h:w,bh=rotation?w:h,tf=Math.min(bh/3,Math.max(3,(p?.flange||8)*scale)),tw=Math.min(bw/3,Math.max(3,(p?.web||6)*scale));
    shape=`<g transform="translate(130 65) rotate(${rotation*90})"><path d="M${-bw/2},${-bh/2}h${bw}v${tf}h${-(bw-tw)/2}v${bh-2*tf}h${(bw-tw)/2}v${tf}h${-bw}v${-tf}h${(bw-tw)/2}v${-(bh-2*tf)}h${-(bw-tw)/2}Z" fill="#4f719f"/></g>`;
  }else shape=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#4f719f" stroke-width="${Math.min(Math.min(w,h)/3,Math.max(3,(p?.thickness||2.3)*scale))}"/>`;
  $('profilePreview').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 142" role="img" aria-label="${engine.families[family]} 단면 형태 예시, 정면 폭 ${face}mm, 깊이 방향 폭 ${depth}mm">${shape}<g fill="#3f5674" font-size="12" text-anchor="middle" font-family="system-ui,sans-serif"><text x="130" y="133">b = ${fmt(face,1)} mm</text><text transform="translate(32 65) rotate(-90)">d = ${fmt(depth,1)} mm</text></g></svg><span>부재 단면 예시 · 모서리 상세 생략</span>`;
  $('profileSource').replaceChildren();
  if(p){const source=engine.sources[p.source];const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.label;$('profileSource').append('단위중량 출처: ',a,document.createTextNode(' · 공급사 규격표 참고값'));}
  else $('profileSource').textContent='사용자 지정 치수·단위중량을 적용합니다. 단면 그림은 선택 종류의 형태만 나타냅니다.';
}
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
  $('drawingView').textContent=v.planes===2?'정면 + 좌우 측면도 · 1대 기준':'정면 · 1대 기준';
  $('sideDrawing').hidden=v.planes!==2;
  if(v.planes===2){
    const s=Math.min(240/v.depth,196/v.height),sw=v.depth*s,sh=v.height*s,sb=v.face*s,sd=v.sectionDepth*s;
    const panel=(center,title)=>{const sx=center-sw/2,sy=62+(196-sh)/2;let parts=rect(sx,sy,sd,sh,'#dfebfa')+rect(sx+sw-sd,sy,sd,sh,'#dfebfa')+rect(sx+sd,sy,sw-2*sd,sb,'#69b6b2')+rect(sx+sd,sy+sh-sb,sw-2*sd,sb,'#69b6b2');
      for(let i=0;i<v.sideVertical;i++)parts+=rect(sx+sd+(result.sideClearDepth*s+sd)*i+result.sideClearDepth*s,sy+sb,sd,sh-2*sb,'#b2a6e2');
      for(let j=0;j<v.sideHorizontal;j++)for(let i=0;i<=v.sideVertical;i++)parts+=rect(sx+sd+(result.sideClearDepth*s+sd)*i,sy+sb+(result.sideClearHeight*s+sb)*j+result.sideClearHeight*s,result.sideClearDepth*s,sb,'#eda6d1');
      return `<text x="${center}" y="25" text-anchor="middle" fill="#e1eaf6" font-size="15">${title}</text><text x="${center}" y="48" text-anchor="middle" fill="#b9cbe0" font-size="13">깊이 ${fmt(v.depth,1)} mm</text>${parts}<text x="${center}" y="285" text-anchor="middle" fill="#b9cbe0" font-size="12">세로 ${v.sideVertical}개 · 가로 ${v.sideHorizontal}열</text>`;};
    $('sideDrawing').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 310" role="img" aria-label="좌우 측면도. 전체 깊이 ${v.depth}mm. 한쪽당 세로 보강재 ${v.sideVertical}개, 가로 보강재 ${v.sideHorizontal}열. 흰색 앞뒤 프레임, 청록색 모서리 연결재, 보라색 세로 보강재, 분홍색 가로 보강재." font-family="system-ui,sans-serif">${panel(195,'좌측면')}${panel(545,'우측면')}</svg><p>흰색: 기존 앞뒤 프레임 · 청록: 모서리 연결재 · 보라: 측면 세로재 · 분홍: 측면 가로재</p>`;
  }
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
  const two=$('planes').value==='2';$('depthField').hidden=!two;$('depthHint').hidden=!two;$('sideFields').hidden=!two;drawProfile();
  for(const key of Object.keys(engine.defaults))$(key).removeAttribute('aria-invalid');
  try{
    const input=readInput();
    if(!two&&(!Number.isFinite(input.depth)||input.depth<1||input.depth>100000))input.depth=engine.defaults.depth;
    if(!two)for(const k of ['sideVertical','sideHorizontal'])if(!Number.isInteger(input[k])||input[k]<0||input[k]>100)input[k]=engine.defaults[k];
    for(const[key,[min,max,integer]]of Object.entries(engine.limits))if(!Number.isFinite(input[key])||input[key]<min||input[key]>max||(integer&&!Number.isInteger(input[key])))$(key).setAttribute('aria-invalid','true');
    current=engine.calculate(input);$('error').hidden=true;$('download').disabled=false;$('save').disabled=false;
    $('totalWeight').textContent=fmt(current.totalWeight,1);$('mobileWeight').textContent=`${fmt(current.totalWeight,1)} kg`;$('totalLength').textContent=fmt(current.totalLength);$('totalPieces').textContent=fmt(current.totalPieces,0);
    $('weightDetail').textContent=`부재 ${fmt(current.frameWeight,1)} + 기타 ${fmt(current.equipmentWeight,1)} kg`;
    $('area').textContent=`전면 면적 ${fmt(current.area)} m² / 대`;
    $('tableSubtitle').textContent=`${fmt(input.frames,0)}대 · ${input.planes===2?'앞뒤 + 좌우 측면':'단면 1면'} · ${sectionLabel()} · ${fmt(input.unitWeight,3)} kg/m`;
    $('rows').innerHTML=current.rows.map(r=>`<tr><th scope="row"><span class="part-code" style="background:${colors[r.code]}">${r.code}</span>${r.name}</th><td>${fmt(r.length,3)}</td><td>${fmt(r.count,0)}</td><td>${fmt(r.totalLength,3)}</td><td>${fmt(r.weight,2)}</td></tr>`).join('');
    $('sumPieces').textContent=fmt(current.totalPieces,0);$('sumLength').textContent=fmt(current.totalLength,3);$('sumWeight').textContent=fmt(current.frameWeight,2);draw(current);renderPurchase(current);
  }catch(e){
    current=null;$('error').textContent=e.message;$('error').hidden=false;$('download').disabled=true;$('save').disabled=true;
    ['totalWeight','totalLength','totalPieces','sumPieces','sumLength','sumWeight','mobileWeight'].forEach(id=>$(id).textContent='—');
    $('weightDetail').textContent='입력값을 확인하세요';$('rows').replaceChildren();$('drawing').textContent='유효한 치수를 입력하면 배치도가 표시됩니다.';$('sideDrawing').hidden=true;$('area').textContent='—';$('tableSubtitle').textContent='입력값 확인 필요';$('purchaseContent').hidden=true;$('purchaseWarning').textContent='입력값을 확인하면 구매 본수를 계산합니다.';$('purchaseWarning').hidden=false;
  }
}
function applyInput(input,section='custom',family='custom',rotation=0){for(const[k,v]of Object.entries(input))if(k in engine.defaults)$(k).value=v;$('family').value=engine.presets[section]?.family||family;$('rotation').value=rotation;sectionOptions($('family').value,section);render();}
function status(message,isError=false){$('projectStatus').textContent=message;$('projectStatus').hidden=false;$('projectStatus').classList.toggle('is-error',isError);}
function downloadFile(text,type,name){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('inputs').addEventListener('submit',e=>e.preventDefault());
$('inputs').addEventListener('input',e=>{
  const id=e.target.id;
  if(['face','sectionDepth','unitWeight'].includes(id))$('section').value='custom';
  if(id==='family'){const initial={square:'50',rect:'r100x50',hbeam:'h100',custom:'custom'}[$('family').value];sectionOptions($('family').value,initial);$('rotation').value='0';selectedValues();}
  if(id==='section')selectedValues();
  if(id==='rotation'){if($('section').value==='custom'){const b=$('face').value;$('face').value=$('sectionDepth').value;$('sectionDepth').value=b;}else selectedValues();}
  render();
});
$('reset').addEventListener('click',()=>{applyInput(engine.defaults,'50');status('예시값으로 초기화했습니다.');});
$('download').addEventListener('click',()=>{if(current)downloadFile(engine.toCSV(current,sectionLabel()),'text/csv;charset=utf-8',`전광판_자재산출_${current.input.width}x${current.input.height}_${current.input.frames}대.csv`);});
$('save').addEventListener('click',()=>{if(!current)return;downloadFile(JSON.stringify({type:'led-frame-project',version:3,family:$('family').value,section:$('section').value,rotation:Number($('rotation').value),input:current.input},null,2),'application/json',`전광판_설정_${current.input.width}x${current.input.height}.json`);status('설정 파일 다운로드를 요청했습니다. 다음 작업 때 ‘설정 불러오기’로 이어서 계산할 수 있습니다.');});
$('load').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw new Error('설정 파일은 100KB 이하만 불러올 수 있습니다.');const project=engine.parseProject(await file.text());applyInput(project.input,project.section,project.family,project.rotation);status('저장한 설정을 불러왔습니다.');}catch(err){status(`${err.message} 기존 입력값은 유지됩니다.`,true);}finally{e.target.value='';}});
applyInput(engine.defaults,'50');
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'calculate_frame',title:'프레임 수량·중량과 구매 본수 계산',description:'치수와 절단 조건을 입력해 화면을 갱신하고 부재 수량, 중량, 참고 구매 본수를 반환합니다. 구조 안전성 검토는 포함하지 않습니다.',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(engine.limits).map(([k,[min,max,integer]])=>[k,{type:integer?'integer':'number',minimum:min,maximum:max,description:engine.labels[k]}])),required:Object.keys(engine.defaults),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const verified=engine.calculate(input);applyInput(verified.input);return {totalWeight:current.totalWeight,frameWeight:current.frameWeight,totalLength:current.totalLength,totalPieces:current.totalPieces,rows:current.rows,purchase:current.purchase};}})).catch(()=>{});}catch{}
}
