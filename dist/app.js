'use strict';
const $=id=>document.getElementById(id);
const engine=globalThis.FrameCalculator;
const fmt=(n,d=2)=>n.toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:d});
const presets={'50':{face:50,unitWeight:3.44},'75':{face:75,unitWeight:7.21},'100':{face:100,unitWeight:9.73}};
let current=null;
function readInput(){return Object.fromEntries(Object.keys(engine.defaults).map(k=>[k,$(k).value.trim()===''?NaN:Number($(k).value)]));}
function draw(result){
  const v=result.input,scale=Math.min(570/v.width,218/v.height),w=v.width*scale,h=v.height*scale,b=v.face*scale,x=(740-w)/2,y=43+(218-h)/2;
  const rect=(rx,ry,rw,rh,color)=>`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${color}"/>`;
  let members=rect(x,y,b,h,'#dfebfa')+rect(x+w-b,y,b,h,'#dfebfa')+rect(x+b,y,w-2*b,b,'#dfebfa')+rect(x+b,y+h-b,w-2*b,b,'#dfebfa');
  const bay=result.clearWidth*scale,verticals=[];
  for(let i=0;i<v.vertical;i++){const vx=x+b+bay*(i+1)+b*i;verticals.push(vx);members+=rect(vx,y+b,b,h-2*b,'#ffbc6f');}
  for(let j=0;j<v.horizontal;j++){const hy=y+b+result.clearHeight*scale*(j+1)+b*j;for(let i=0;i<=v.vertical;i++)members+=rect(x+b+(bay+b)*i,hy,bay,b,'#ffbc6f');}
  const dimColor='#92a8c3';
  const line=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${dimColor}" stroke-width="1"/>`;
  let dims=line(x,y-18,x+w,y-18)+line(x,y-25,x,y-7)+line(x+w,y-25,x+w,y-7)+line(x-24,y,x-24,y+h)+line(x-31,y,x-12,y)+line(x-31,y+h,x-12,y+h);
  $('drawing').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 740 310" role="img" aria-label="가로 ${v.width}mm, 세로 ${v.height}mm. 세로 보강재 ${v.vertical}개, 가로 보강재 ${v.horizontal}열인 사각 프레임 정면 배치도"><g>${members}${dims}</g><g fill="#d4e1f0" font-family="system-ui, sans-serif" font-size="14"><text x="370" y="${y-27}" text-anchor="middle">${fmt(v.width,0)} mm</text><text transform="translate(${x-36},${y+h/2}) rotate(-90)" text-anchor="middle">${fmt(v.height,0)} mm</text><text x="370" y="${Math.min(296,y+h+30)}" text-anchor="middle" fill="#9bb2ce" font-size="13">${v.vertical+1}칸 × ${v.horizontal+1}칸 · 균등 배치</text></g></svg>`;
}
function render(){
  for(const key of Object.keys(engine.defaults)) $(key).removeAttribute('aria-invalid');
  try{
    const input=readInput();
    for(const [key,[min,max,integer]] of Object.entries(engine.limits)) if(!Number.isFinite(input[key]) || input[key]<min || input[key]>max || (integer&&!Number.isInteger(input[key]))) $(key).setAttribute('aria-invalid','true');
    current=engine.calculate(input);$('error').hidden=true;$('download').disabled=false;
    $('totalWeight').textContent=fmt(current.totalWeight,1);$('totalLength').textContent=fmt(current.totalLength);$('totalPieces').textContent=fmt(current.totalPieces,0);
    $('weightDetail').textContent=`각관 ${fmt(current.frameWeight,1)} + 기타 ${fmt(current.equipmentWeight,1)} kg`;
    $('area').textContent=`전면 면적 ${fmt(current.area)} m² / 대`;
    $('tableSubtitle').textContent=`${fmt(input.frames,0)}대 합계 · 단위중량 ${fmt(input.unitWeight,3)} kg/m`;
    $('rows').innerHTML=current.rows.map(r=>`<tr><th scope="row">${r.name}</th><td>${fmt(r.length,1)}</td><td>${fmt(r.count,0)}</td><td>${fmt(r.totalLength,3)}</td><td>${fmt(r.weight,2)}</td></tr>`).join('');
    $('sumPieces').textContent=fmt(current.totalPieces,0);$('sumLength').textContent=fmt(current.totalLength,3);$('sumWeight').textContent=fmt(current.frameWeight,2);draw(current);
  }catch(e){current=null;$('error').textContent=e.message;$('error').hidden=false;$('download').disabled=true;['totalWeight','totalLength','totalPieces','sumPieces','sumLength','sumWeight'].forEach(id=>$(id).textContent='—');$('weightDetail').textContent='입력값을 확인하세요';$('rows').replaceChildren();$('drawing').textContent='유효한 치수를 입력하면 배치도가 표시됩니다.';$('area').textContent='—';$('tableSubtitle').textContent='입력값 확인 필요';}
}
$('inputs').addEventListener('submit',e=>e.preventDefault());
$('inputs').addEventListener('input',e=>{if(['face','unitWeight'].includes(e.target.id))$('section').value='custom';render();});
$('section').addEventListener('change',()=>{const preset=presets[$('section').value];if(preset){$('face').value=preset.face;$('unitWeight').value=preset.unitWeight;}render();});
$('reset').addEventListener('click',()=>{for(const[k,v]of Object.entries(engine.defaults))$(k).value=v;$('section').value='50';render();});
function csvText(result){
  const v=result.input,section=$('section').selectedOptions[0].textContent;
  const data=[['전광판 사각 프레임 자재 산출표'],['가로(mm)',v.width,'세로(mm)',v.height,'제작 수량(대)',v.frames],['각관 규격',section,'부재 폭(mm)',v.face,'단위중량(kg/m)',v.unitWeight],['세로 보강재(개/대)',v.vertical,'가로 보강재(열/대)',v.horizontal],[],['부재','절단 길이(mm)','수량(개)','총길이(m)','중량(kg)'],...result.rows.map(r=>[r.name,r.length.toFixed(3),r.count,r.totalLength.toFixed(6),r.weight.toFixed(6)]),['각관 합계','',result.totalPieces,result.totalLength.toFixed(6),result.frameWeight.toFixed(6)],['전광판·기타 중량(kg)',result.equipmentWeight.toFixed(6)],['전체 예상 중량(kg)',result.totalWeight.toFixed(6)],[],['계산 기준','단일 평면. 외곽 세로재 전체 높이, 가로재는 세로재 사이 연결. 가로 보강재는 분할 연결.'],['포함 범위','후면·깊이 연결재·지주·판재·볼트·용접량·절단 손실 제외. 구매 본수 및 구조 안전성 별도 검토.'],['단위중량','규격 선택 시 예시값. 실제 납품업체 단위중량으로 수정 필요.'],['표시 정밀도','화면과 CSV 표시 자릿수가 다를 수 있으며 합계는 반올림 전 값으로 계산.']];
  return '\ufeff'+data.map(row=>row.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
$('download').addEventListener('click',()=>{if(!current)return;const url=URL.createObjectURL(new Blob([csvText(current)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`전광판_자재산출_${current.input.width}x${current.input.height}_${current.input.frames}대.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
render();
if(document.modelContext?.registerTool){
  try{Promise.resolve(document.modelContext.registerTool({name:'calculate_frame',title:'프레임 수량·중량 계산',description:'프레임 치수와 물량 조건을 입력하고 화면과 계산 결과를 갱신합니다. 단일 평면이며 구조 안전성 검토는 포함하지 않습니다.',inputSchema:{type:'object',properties:Object.fromEntries(Object.entries(engine.limits).map(([k,[min,max,integer]])=>[k,{type:integer?'integer':'number',minimum:min,maximum:max}])),required:Object.keys(engine.defaults),additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){const verified=engine.calculate(input);for(const[k,v]of Object.entries(verified.input))if(k in engine.defaults)$(k).value=v;$('section').value='custom';render();return {totalWeight:current.totalWeight,frameWeight:current.frameWeight,totalLength:current.totalLength,totalPieces:current.totalPieces,rows:current.rows};}})).catch(()=>{});}catch{}
}
