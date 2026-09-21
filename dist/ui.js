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
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const color=code=>colors[code[0]]||'#506d9b';
function buildMemberCards(overrides={}){
  const options='<option value="inherit">기본 규격 사용</option>'+Object.entries(engine.families).filter(([f])=>f!=='custom').map(([f,name])=>`<optgroup label="${name}">${Object.entries(engine.presets).filter(([,p])=>p.family===f).map(([id,p])=>`<option value="${id}">${p.label} · ${p.unitWeight} kg/m</option>`).join('')}<option value="custom:${f}">${name} · 직접 입력</option></optgroup>`).join('')+'<option value="custom:custom">기타 · 직접 입력</option>';
  $('memberCards').innerHTML=Object.entries(engine.roles).map(([role,name],i)=>`<div class="member-card" id="card-${role}" data-side="${i>=6}"><label class="member-name" for="member-${role}"><span class="part-code" style="background:${color(engine.roleCodes[role])}">${engine.roleCodes[role]}</span>${name}</label><select id="member-${role}" data-role="${role}" data-prop="section">${options}</select><div class="member-fields" id="fields-${role}" hidden><label>놓는 방향<select id="rotation-${role}" data-role="${role}" data-prop="rotation" aria-label="${name} 방향"><option value="0">기본 방향</option><option value="1">90° 회전</option></select></label>${[['face','정면 폭 b','mm'],['sectionDepth','깊이 폭 d','mm'],['unitWeight','단위중량','kg/m'],['stockLength','원자재 1본','mm']].map(([k,label,unit])=>`<label>${label} (${unit})<input id="${k}-${role}" data-role="${role}" data-prop="${k}" type="number" step="any" min="${engine.limits[k][0]}" max="${engine.limits[k][1]}" aria-label="${name} ${label}"></label>`).join('')}<label id="name-field-${role}" class="material-name">직접 입력 규격 구분 이름<input id="materialName-${role}" data-role="${role}" data-prop="materialName" maxlength="60" placeholder="예: SS400 50×50×3.2t" aria-label="${name} 규격 구분 이름"></label><p class="member-source" id="source-${role}"></p></div><p class="member-summary" id="summary-${role}"></p></div>`).join('');
  for(const[role,p]of Object.entries(overrides)){
    $('member-'+role).value=p.section==='custom'?'custom:'+p.family:p.section;
    for(const k of ['rotation','face','sectionDepth','unitWeight','stockLength','materialName'])$(k+'-'+role).value=p[k]??'';
  }
}
function readInput(){
  const input=Object.fromEntries(Object.keys(engine.defaults).map(k=>[k,$(k).value.trim()===''?NaN:Number($(k).value)]));
  input.baseProfile={family:$('family').value,section:$('section').value,rotation:Number($('rotation').value)};
  input.members={};
  for(const role of Object.keys(engine.roles)){
    const selected=$('member-'+role).value;
    if(selected==='inherit')continue;
    const p={section:selected.startsWith('custom:')?'custom':selected,family:engine.presets[selected]?.family||selected.split(':')[1],materialName:$('materialName-'+role).value};
    for(const key of ['rotation','face','sectionDepth','unitWeight','stockLength'])p[key]=$(key+'-'+role).value.trim()===''?NaN:Number($(key+'-'+role).value);
    input.members[role]=p;
  }
  return input;
}
function syncMemberFields(){
  for(const role of Object.keys(engine.roles)){
    const selected=$('member-'+role).value,inherit=selected==='inherit',p=engine.presets[selected];
    $('fields-'+role).hidden=inherit;$('name-field-'+role).hidden=!selected.startsWith('custom:');
    $('card-'+role).hidden=$('card-'+role).dataset.side==='true'&&$('planes').value!=='2';
    $('source-'+role).innerHTML=p?`단위중량 출처: <a href="${engine.sources[p.source].url}" target="_blank" rel="noopener noreferrer">${esc(engine.sources[p.source].label)}</a>`:'';
  }
}
function onMemberInput(e){
  const role=e.target.dataset.role,key=e.target.dataset.prop;if(!role)return;
  const select=$('member-'+role),value=select.value;
  if(key==='section'&&value!=='inherit'){
    $('rotation-'+role).value='0';
    const p=engine.presets[value]?engine.presetValues(value,0):{face:Number($('face').value),sectionDepth:Number($('sectionDepth').value),unitWeight:Number($('unitWeight').value)};
    for(const[k,n]of Object.entries(p))$(k+'-'+role).value=n;
    $('stockLength-'+role).value=$('stockLength').value;$('materialName-'+role).value='';
  }
  if(['face','sectionDepth','unitWeight'].includes(key)&&engine.presets[value])select.value='custom:'+engine.presets[value].family;
  if(key==='rotation'){
    const p=engine.presets[value]?engine.presetValues(value,Number(e.target.value)):{face:Number($('sectionDepth-'+role).value),sectionDepth:Number($('face-'+role).value)};
    for(const[k,n]of Object.entries(p))$(k+'-'+role).value=n;
  }
  render();
}
function draw(result){
  const v=result.input,m=result.members,g=result.geometry,s=Math.min(570/v.width,218/v.height),w=v.width*s,h=v.height*s,x=(740-w)/2,y=43+(218-h)/2;
  const rect=(rx,ry,rw,rh,code)=>`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${code}"/>`;
  const left=m.outerLeft.face*s,right=m.outerRight.face*s,top=m.outerTop.face*s,bottom=m.outerBottom.face*s,vb=m.innerVertical.face*s,hb=m.innerHorizontal.face*s,bay=g.clearWidth*s;
  let members=rect(x,y,left,h,'#dfebfa')+rect(x+w-right,y,right,h,'#dfebfa')+rect(x+left,y,w-left-right,top,'#dfebfa')+rect(x+left,y+h-bottom,w-left-right,bottom,'#dfebfa');
  for(let i=0;i<v.vertical;i++)members+=rect(x+left+bay*(i+1)+vb*i,y+top,vb,h-top-bottom,'#ffbc6f');
  for(let j=0;j<v.horizontal;j++)for(let i=0;i<=v.vertical;i++)members+=rect(x+left+(bay+vb)*i,y+top+g.clearHeight*s*(j+1)+hb*j,bay,hb,'#ffbc6f');
  const line=(a,b,c,d)=>`<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#92a8c3"/>`;
  const dims=line(x,y-18,x+w,y-18)+line(x,y-25,x,y-7)+line(x+w,y-25,x+w,y-7)+line(x-24,y,x-24,y+h)+line(x-31,y,x-12,y)+line(x-31,y+h,x-12,y+h);
  $('drawing').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 310" role="img" aria-label="정면 배치도. 가로 ${v.width}mm, 세로 ${v.height}mm, 부위별 규격 반영">${members}${dims}<g fill="#d4e1f0" font-family="system-ui,sans-serif" font-size="14"><text x="370" y="${y-27}" text-anchor="middle">${fmt(v.width,0)} mm</text><text transform="translate(${x-36},${y+h/2}) rotate(-90)" text-anchor="middle">${fmt(v.height,0)} mm</text><text x="370" y="${Math.min(296,y+h+30)}" text-anchor="middle" fill="#9bb2ce" font-size="13">${v.vertical+1}칸 × ${v.horizontal+1}칸 · 균등 배치</text></g></svg>`;
  $('drawingView').textContent=v.planes===2?'정면 + 좌우 측면도 · 1대 기준':'정면 · 1대 기준';$('sideDrawing').hidden=v.planes!==2;
  if(v.planes===2){
    const scale=Math.min(240/v.depth,196/v.height),sw=v.depth*scale,sh=v.height*scale;
    const panel=(side,center)=>{
      const a=g.sides[side],edge=m['outer'+side].sectionDepth*scale,vt=m['side'+side+'Vertical'].sectionDepth*scale,ht=m['side'+side+'Horizontal'].face*scale,t=m.depthTop.face*scale,b=m.depthBottom.face*scale,sx=center-sw/2,sy=62+(196-sh)/2;
      let shapes=rect(sx,sy,edge,sh,'#dfebfa')+rect(sx+sw-edge,sy,edge,sh,'#dfebfa')+rect(sx+edge,sy,sw-2*edge,t,'#69b6b2')+rect(sx+edge,sy+sh-b,sw-2*edge,b,'#69b6b2');
      for(let i=0;i<v.sideVertical;i++)shapes+=rect(sx+edge+(a.clearDepth*scale+vt)*i+a.clearDepth*scale,sy+t,vt,sh-t-b,'#b2a6e2');
      for(let j=0;j<v.sideHorizontal;j++)for(let i=0;i<=v.sideVertical;i++)shapes+=rect(sx+edge+(a.clearDepth*scale+vt)*i,sy+t+(a.clearHeight*scale+ht)*j+a.clearHeight*scale,a.clearDepth*scale,ht,'#eda6d1');
      return `<text x="${center}" y="25" text-anchor="middle" fill="#e1eaf6" font-size="15">${side==='Left'?'좌':'우'}측면</text><text x="${center}" y="48" text-anchor="middle" fill="#b9cbe0" font-size="13">깊이 ${fmt(v.depth,1)} mm</text>${shapes}<text x="${center}" y="285" text-anchor="middle" fill="#b9cbe0" font-size="12">세로 ${v.sideVertical}개 · 가로 ${v.sideHorizontal}열</text>`;
    };
    $('sideDrawing').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 310" role="img" aria-label="좌우 측면도. 상단·하단 및 좌우 부재 규격 각각 반영" font-family="system-ui,sans-serif">${panel('Left',195)}${panel('Right',545)}</svg><p>흰색: 앞뒤 외곽재 · 청록: 상단·하단 연결재 · 보라: 측면 세로재 · 분홍: 측면 가로재</p>`;
  }
}
function renderPurchase(result){
  const p=result.purchase,ready=p.status==='ready';$('purchaseContent').hidden=!ready;$('purchaseWarning').hidden=ready;
  if(!ready){$('purchaseWarning').textContent=p.message;$('purchasePeek').textContent='원자재 조건을 확인하세요.';return;}
  $('purchasePeek').textContent=`원자재 ${fmt(p.stockCount,0)}본 = 기본 ${fmt(p.baseStockCount,0)} + 연장 추가 ${fmt(p.additionalStockCount,0)} · 연장 조각 ${fmt(p.extensionLength,2)} m`;
  $('stockCount').textContent=`${fmt(p.stockCount,0)} 본`;$('purchaseWeight').textContent=`${fmt(p.purchaseWeight,1)} kg`;$('utilization').textContent=`${fmt(p.utilization,1)} %`;
  $('stockBreakdown').textContent=`기본 ${fmt(p.baseStockCount,0)}본 + 연장용 추가 ${fmt(p.additionalStockCount,0)}본 = 총 ${fmt(p.stockCount,0)}본`;
  $('lossSummary').textContent=`구매 ${fmt(p.grossLength,3)} m = 완성 부재 ${fmt(result.totalLength,3)} m + 겹침 ${fmt(p.overlapLength,3)} m + 톱날 ${fmt(p.kerfLoss,3)} m + 양끝 정리 ${fmt(p.trimLoss,3)} m + 잔재 ${fmt(p.remainder,3)} m`;
  $('materialPurchases').innerHTML=`<table class="material-table"><caption class="sr-only">규격별 원자재 구매 수량</caption><thead><tr><th>규격</th><th>원자재<small>mm / 본</small></th><th>기본<small>본</small></th><th>연장 추가<small>본</small></th><th>총 구매<small>본</small></th><th>구매 중량<small>kg</small></th></tr></thead><tbody>${p.groups.map(g=>`<tr><th><span class="material-id">${g.id}</span><span class="wrap-label">${esc(g.label)}</span></th><td>${fmt(g.stockLength,0)}</td><td>${g.baseStockCount}</td><td>${g.additionalStockCount}</td><td><strong>${g.stockCount}</strong></td><td>${fmt(g.purchaseWeight,2)}</td></tr>`).join('')}</tbody></table>`;
  $('extensionSummary').textContent=p.extensions.length?`연장 조각 ${fmt(p.extensionLength,3)} m · 이음 ${fmt(p.jointCount,0)}개소. 기본 본수의 잔재에서 ${fmt(p.reusedExtensionLength,3)} m를 활용하고, 부족분에 ${fmt(p.additionalStockCount,0)}본을 추가합니다.`:'원자재보다 긴 부재가 없습니다. 연장용 추가 본수는 0본입니다.';
  $('extensionRows').innerHTML=p.extensions.length?`<table><caption class="sr-only">부재별 연장 길이와 분할 수량</caption><thead><tr><th>부재 · 규격</th><th>완성 길이<small>mm / 개</small></th><th>수량<small>개</small></th><th>1개당 분할 길이<small>mm × 조각 수</small></th><th>연장 조각 합계<small>m / 전체 수량</small></th></tr></thead><tbody>${p.extensions.map(e=>`<tr><th>${esc(e.name)}<small>${e.groupId} · ${e.code}</small></th><td>${fmt(e.length,1)}</td><td>${e.count}</td><td>${e.segments.map(s=>`${fmt(s.length,1)} × ${s.count}`).join(' + ')}<small>1개당 연장 ${fmt(e.extensionCutLength,1)} mm · 이음 ${e.jointsPerPiece}개소</small></td><td>${fmt(e.totalExtensionLength,3)}</td></tr>`).join('')}</tbody></table><p class="extension-note">첫 조각은 원자재에서 양끝 정리 여유를 뺀 길이입니다. 분할 길이는 물량 산출용이며 이음 위치·접합 상세는 제작 도면으로 확정하세요.</p>`:'';
  $('patternCount').textContent=`${p.patterns.length}가지`;
  $('cutPatterns').innerHTML=p.patterns.map((pattern,i)=>{
    const bar=pattern.cuts.map(c=>`<span style="width:${100*c.length*c.count/pattern.stockLength}%;background:${color(c.code)}" title="${esc(c.name)} ${c.extension?'연장':'본체'} ${fmt(c.length,3)}mm × ${c.count}개">${c.code}${c.extension?'+':''}</span>`).join('');
    return `<div class="cut-pattern"><div class="pattern-heading"><strong>${pattern.groupId} · 패턴 ${i+1} <span>× ${fmt(pattern.repeat,0)}본 · ${pattern.extensionOnly?'연장용 추가':'기본 본수'}</span></strong><span>잔재 ${fmt(pattern.remainder,1)} mm / 본</span></div><div class="cut-bar" aria-hidden="true"><span style="width:${100*pattern.trimLoss/pattern.stockLength}%" class="cut-waste"></span>${bar}<span class="cut-waste" style="width:${100*pattern.kerfLoss/pattern.stockLength}%"></span><span class="cut-remainder" style="width:${100*pattern.remainder/pattern.stockLength}%"></span></div><p class="cut-labels">${pattern.cuts.map(c=>`<span><i style="background:${color(c.code)}">${c.code}${c.extension?'+':''}</i> ${c.extension?'연장 ':''}${fmt(c.length,3)} mm × ${c.count}개</span>`).join('')}</p></div>`;
  }).join('');
}
function render(){
  const two=$('planes').value==='2';$('depthField').hidden=!two;$('depthHint').hidden=!two;$('sideFields').hidden=!two;drawProfile();syncMemberFields();
  for(const key of Object.keys(engine.defaults))$(key).removeAttribute('aria-invalid');
  try{
    const input=readInput();
    if(!two&&(!Number.isFinite(input.depth)||input.depth<1||input.depth>100000))input.depth=engine.defaults.depth;
    for(const[key,[min,max,integer]]of Object.entries(engine.limits))if(!Number.isFinite(input[key])||input[key]<min||input[key]>max||(integer&&!Number.isInteger(input[key])))$(key).setAttribute('aria-invalid','true');
    current=engine.calculate(input);$('error').hidden=true;$('download').disabled=false;$('save').disabled=false;
    $('totalWeight').textContent=fmt(current.totalWeight,1);$('mobileWeight').textContent=`${fmt(current.totalWeight,1)} kg`;$('totalLength').textContent=fmt(current.totalLength);$('totalPieces').textContent=fmt(current.totalPieces,0);
    $('weightDetail').textContent=`부재 ${fmt(current.frameWeight,1)} + 기타 ${fmt(current.equipmentWeight,1)} kg${input.spliceAllowance?' · 겹침 중량 포함':''}`;
    $('area').textContent=`전면 면적 ${fmt(current.area)} m² / 대`;
    $('tableSubtitle').textContent=`${fmt(input.frames,0)}대 · ${two?'앞뒤 + 좌우 측면':'단면 1면'} · 구매 규격 ${current.purchase.groups.length}종`;
    $('rows').innerHTML=current.rows.map(r=>`<tr><th scope="row"><span class="part-code" style="background:${color(r.code)}">${r.code}</span>${esc(r.name)}<small class="row-material">${r.groupId} · ${esc(r.materialLabel)} · b ${r.profile.face} / d ${r.profile.sectionDepth}</small></th><td>${fmt(r.length,3)}${r.jointCount?'<small>연장 이음 포함</small>':''}</td><td>${fmt(r.count,0)}</td><td>${fmt(r.totalLength,3)}</td><td>${fmt(r.weight,2)}</td></tr>`).join('');
    for(const[role,p]of Object.entries(current.members))$('summary-'+role).textContent=`${$('member-'+role).value==='inherit'?'기본 · ':''}${engine.materialLabel(p)} / ${fmt(p.stockLength,0)} mm 원자재`;
    $('sumPieces').textContent=fmt(current.totalPieces,0);$('sumLength').textContent=fmt(current.totalLength,3);$('sumWeight').textContent=fmt(current.frameWeight,2);draw(current);renderPurchase(current);
  }catch(e){
    current=null;$('error').textContent=e.message;$('error').hidden=false;$('download').disabled=true;$('save').disabled=true;$('purchasePeek').textContent='입력값을 확인하세요.';
    ['totalWeight','totalLength','totalPieces','sumPieces','sumLength','sumWeight','mobileWeight'].forEach(id=>$(id).textContent='—');
    $('weightDetail').textContent='입력값을 확인하세요';$('rows').replaceChildren();$('drawing').textContent='유효한 치수를 입력하면 배치도가 표시됩니다.';$('sideDrawing').hidden=true;$('area').textContent='—';$('tableSubtitle').textContent='입력값 확인 필요';$('purchaseContent').hidden=true;$('purchaseWarning').textContent='입력값을 확인하면 구매 본수를 계산합니다.';$('purchaseWarning').hidden=false;
    for(const role of Object.keys(engine.roles))$('summary-'+role).textContent='입력값 확인 필요';
  }
}
function applyInput(input,section='custom',family='custom',rotation=0){
  for(const[k,value]of Object.entries(engine.defaults))$(k).value=input[k]??value;
  $('family').value=engine.presets[section]?.family||family;$('rotation').value=rotation;sectionOptions($('family').value,section);buildMemberCards(input.members);render();
}
function status(message,isError=false){$('projectStatus').textContent=message;$('projectStatus').hidden=false;$('projectStatus').classList.toggle('is-error',isError);}
function downloadFile(text,type,name){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
$('inputs').addEventListener('submit',e=>e.preventDefault());
$('memberCards').addEventListener('input',onMemberInput);
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
$('save').addEventListener('click',()=>{if(!current)return;downloadFile(JSON.stringify({type:'led-frame-project',version:4,family:$('family').value,section:$('section').value,rotation:Number($('rotation').value),input:current.input},null,2),'application/json',`전광판_설정_${current.input.width}x${current.input.height}.json`);status('부위별 규격과 연장 조건을 포함한 설정 파일 다운로드를 요청했습니다.');});
$('load').addEventListener('click',()=>$('projectFile').click());
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>100000)throw new Error('설정 파일은 100KB 이하만 불러올 수 있습니다.');const p=engine.parseProject(await file.text());applyInput(p.input,p.section,p.family,p.rotation);status('저장한 부위별 규격과 설정을 불러왔습니다.');}catch(err){status(`${err.message} 기존 입력값은 유지됩니다.`,true);}finally{e.target.value='';}});
applyInput(engine.defaults,'50');
if(document.modelContext?.registerTool){
  const numericSchema=Object.fromEntries(Object.entries(engine.limits).map(([k,[minimum,maximum,integer]])=>[k,{type:integer?'integer':'number',minimum,maximum,description:engine.labels[k]}]));
  const profileSchema={type:'object',properties:{section:{type:'string',enum:[...Object.keys(engine.presets),'custom']},family:{type:'string',enum:Object.keys(engine.families)},rotation:{type:'integer',enum:[0,1]},face:numericSchema.face,sectionDepth:numericSchema.sectionDepth,unitWeight:numericSchema.unitWeight,stockLength:numericSchema.stockLength,materialName:{type:'string',maxLength:60}},additionalProperties:false};
  try{Promise.resolve(document.modelContext.registerTool({name:'calculate_frame',title:'부위별 규격·연장 길이·구매 본수 계산',description:'화면을 갱신하고 부위별 물량, 원자재를 초과한 연장 조각, 잔재 활용 및 추가 구매 본수를 계산합니다. 구조 안전성 검토는 포함하지 않습니다.',inputSchema:{type:'object',properties:{...numericSchema,baseProfile:profileSchema,members:{type:'object',properties:Object.fromEntries(Object.keys(engine.roles).map(role=>[role,profileSchema])),additionalProperties:false}},required:Object.keys(engine.defaults),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const verified=engine.calculate(input),p=verified.input.baseProfile;applyInput(verified.input,p.section,p.family,p.rotation);return {totalWeight:current.totalWeight,totalLength:current.totalLength,totalPieces:current.totalPieces,rows:current.rows,purchase:current.purchase};}})).catch(()=>{});}catch{}
}
