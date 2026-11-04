(function(){
  'use strict';
  const E=FoundationEngine,W=FoundationWind,C=FoundationEstimate,$=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=2)=>v===null||v===undefined?'—':v===Infinity?'∞':v===-Infinity?'−∞':Number.isFinite(v)?v.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'산출 불가';
  // Each screen owns its autosave key. V4 kept 'foundation-project-v4'; V7 reads it once only when no V7 save exists,
  // and the copy embedded in the integrated calculator uses its own key so standalone and integrated work never overwrite each other.
  const STORE=(()=>{const embedded=window.LED_SUITE_EMBEDDED===true,key=embedded?'led-suite-foundation-project-v7':'foundation-project-v7',legacy=embedded?null:'foundation-project-v4';
    const get=k=>{try{return window.localStorage.getItem(k);}catch{return null;}};
    return {embedded,key,read(){const text=get(key);if(text)return {text,legacy:false};const old=legacy&&get(legacy);return old?{text:old,legacy:true}:null;},write(text){try{window.localStorage.setItem(key,text);return true;}catch{return false;}}};})();
  const optionsBar=Object.keys(E.bars).map(v=>[v,'D'+v]);
  const spec={
    'sign-fields':[
      ['signW','전광판 가로','mm',100],['signH','전광판 세로','mm',100],['signDepth','전광판 깊이','mm',50],['bottom','하단 높이 / GL 기준','m',0.1],
      ['panelKgM2','전광판 면적당 중량','kg/m²',1],['postKg','전광판 1대의 지주·프레임 총중량','kg',10],['extraKg','추가 고정중량','kg',10],['qty','기초 수량','개',1]
    ],
    'site-fields':[
      ['windMode','정면 풍하중 입력','', [['pressure','유효 풍압 직접 입력'],['velocity','설계풍속으로 단순 추정']],true],
      ['pressure','정면 유효 풍압','kPa',0.1],['sidePressure','측면 유효 풍압','kPa',0.1],
      ['velocity','설계풍속 (기본풍속 아님)','m/s',1],['cf','풍력계수 Cf','',0.1],['gust','가스트 계수 G','',0.1],
      ['qa','총 허용지지력 qa','kPa',10],['mu','저면 마찰계수 μ','',0.05],['waterDepth','지하수위 / GL 아래','m',0.1],
      ['eccX','상부 자중 X편심','m',0.05],['eccY','상부 자중 Y편심','m',0.05],['extraForce','추가 정면 수평력','kN',1],['extraForceZ','추가 수평력 높이','m',0.1]
    ],
    'geometry-fields':[
      ['type','기초 형식','',Object.entries(E.types).map(([k,v])=>[k,v.label]),true],
      ['mode','치수 설정','',[['auto','자동 후보 검토'],['manual','수동 치수 검토']]],['aspect','자동 후보 L / W','',0.1],
      ['autoMax','자동 최대 평면치수','mm',100],['autoHMax','자동 최대 두께','mm',100]
    ],
    'foundation-dims':[
      ['L','푸팅 가로 L / X','mm',100],['W','푸팅 세로 W / Y','mm',100],['H','푸팅 두께 H','mm',100],
      ['cL','목 가로 cL / X','mm',50],['cW','목 세로 cW / Y','mm',50],['cH','목 전체 높이','mm',50],['above','목 지상 노출고','mm',50],['postSpacing','2주 중심 간격 / X','mm',100]
    ],
    'rebar-fields':[
      ['rebarMode','배근 설정','',[['auto','자동 격자 초안'],['manual','직경·간격 직접 입력']],true],
      ['fck','콘크리트 강도 fck','MPa',1],['fy','철근 항복강도 fy','MPa',10],['cover','푸팅 외측 피복','mm',5],['neckCover','목 띠근 외측 피복','mm',5],
      ['bar','푸팅 철근 직경','',optionsBar],['spacing','푸팅 최대 간격','mm',25],['maxSpacing','자동 격자 최대 간격','mm',25],
      ['neckBar','목 주근 직경','',optionsBar],['neckNX','목 X면당 주근','본',1],['neckNY','목 Y면당 주근','본',1],['tieBar','띠근·보조띠 직경','',[[10,'D10'],[13,'D13'],[16,'D16']]],['tieSpacing','목 띠근 최대 간격','mm',25]
    ],
    'design-fields':[
      ['gammaC','콘크리트 단위중량','kN/m³',0.5],['stabilize','안정용 자중계수','',0.05],['fsTarget','활동·전도 목표 안전율','',0.1],
      ['deadFactor','강도용 고정하중계수','',0.1],['windFactor','강도용 풍하중계수','',0.1],['phiFlex','휨 강도감소계수','',0.05],['phiShear','전단 강도감소계수','',0.05],
      ['rho','설정 최소 푸팅 철근비','',0.0001],['aggregate','굵은골재 최대치수','mm',5],['ld','직선근 요구 정착길이','mm',50],['dowelEmbed','목 주근 푸팅 근입길이','mm',50],['dowelTail','목 주근 수평 꼬리길이','mm',50]
    ],
    'quantity-fields':[
      ['ow','버림·잡석 좌우 여유','mm',10],['lean','버림 두께','mm',10],['stone','잡석 두께','mm',50],['work','굴착 바닥 작업 여유','mm',50],['slope','굴착 물매 / 수평:수직','m : 1',0.1],
      ['soilL','토량 팽창계수 L','',0.05],['soilC','토량 다짐계수 C','',0.05],['concWaste','콘크리트 주문 할증','%',1],['rebarWaste','철근 수량 할증','%',1],['oldRatio','원본 비교용 철근비','kg/m³',5]
    ]
  };
  spec['accessory-fields']=[['anchorCount','지지부당 앵커 수','조',4],['anchorDiameter','앵커 호칭 M','mm',1],['plateL','플레이트 가로','mm',50],['plateW','플레이트 세로','mm',50],['anchorEdge','플레이트 끝~앵커 중심','mm',5],['groutThickness','그라우트 두께','mm',5],['groutYield','25kg 제품 수율','L/포',0.5],['groutWaste','그라우트 손실률','%',1],['groundRods','기초당 접지 조수','조',1],['elpLength','기초당 ELP 길이','m',1],['vat','부가세율','%',1]];
  const take=(section,keys)=>{const rows=spec[section].filter(r=>keys.includes(r[0]));spec[section]=spec[section].filter(r=>!keys.includes(r[0]));return rows;};
  spec['connection-fields']=[
    ['columnShape','강재 기둥 단면','',[['schematic','단면 미입력 · 개념 표시'],['circle','원형 기둥'],['rect','사각 기둥']],true],
    ['columnDiameter','기둥 외경 Ø','mm',10],['columnWidth','기둥 가로','mm',10],['columnDepth','기둥 세로','mm',10],
    ['plateShape','베이스플레이트 모양','',[['rect','사각 플레이트'],['circle','원형 플레이트']],true],
    ...take('accessory-fields',['plateL','plateW']),['plateDiameter','플레이트 지름 Ø','mm',50],
    ...take('accessory-fields',['anchorCount','anchorDiameter','anchorEdge']),['anchorAngle','첫 앵커 배치 각도','°',5]
  ];
  spec['sign-detail-fields']=take('sign-fields',['signDepth','panelKgM2','postKg','extraKg']);
  spec['site-detail-fields']=take('site-fields',['waterDepth','eccX','eccY','extraForce','extraForceZ']);
  spec['wind-fields']=take('site-fields',['pressure','sidePressure','velocity','cf','gust']);
  take('site-fields',['windMode']);
  spec['map-fields']=[['windPoint','지도 기준지점','',[['','미선택 / 직접 입력'],...W.points.map(p=>[p.id,`${p.name} · ${p.v} m/s`])],true],['windMode','풍하중 적용 방식','',[['regional','지도 기본풍속으로 계산'],['pressure','유효 풍압 직접 입력'],['velocity','설계풍속 직접 입력']],true],['basicWind','기본풍속 V₀','m/s',1],['exposure','주변 지표면','',[['A','A · 고층·밀집 시가지'],['B','B · 주택·수목 지역'],['C','C · 저층건물·수목 산재'],['D','D · 해안·평탄 개방지']]]];
  spec['wind-fields'].push(['sideMode','측면 풍압','',[['linked','정면 풍압과 연동'],['manual','측면 풍압 직접 입력']],true],['topography','지형계수 Kzt','',0.05],['importance','중요도계수 Iw','',0.05],['direction','풍향계수 KD','',0.05]);
  spec['geometry-detail-fields']=take('geometry-fields',['aspect','autoMax','autoHMax']);
  spec['wind-fields'].push(...take('map-fields',['windMode','basicWind']));
  spec['precise-sign-fields']=take('sign-fields',['signW','signH']);
  for(const row of spec['sign-fields'])if(row[0]==='bottom')row[1]='화면 하단 높이';
  spec['sign-fields'].push(['installMode','전광판 배치','',[['shared','전광판 1대 아래 기둥·기초 늘리기'],['repeat','같은 전광판을 여러 곳에 설치']],true],['foundationSpacing','기초 중심 간격 / X','mm',100,true]);
  const place=spec['map-fields'].find(row=>row[0]==='windPoint');place[1]='설치지역';place[3]=[['','지역을 골라주세요'],...W.points.map(p=>[p.id,p.name])];
  const surroundings=spec['map-fields'].find(row=>row[0]==='exposure');surroundings[1]='주변 모습';surroundings[3]=[['A','고층 건물이 빽빽한 도심'],['B','주택·나무가 모여 있는 곳'],['C','낮은 건물·나무가 띄엄띄엄 있는 곳'],['D','장애물이 거의 없는 해안·평지']];surroundings[4]=true;
  const all=Object.values(spec).flat(),labels=Object.fromEntries(all.map(s=>[s[0],s[1]]));
  for(const [section,fields]of Object.entries(spec))$(section).innerHTML=fields.map(([key,label,unit,step,wide])=>{
    const select=Array.isArray(step),limit=E.limits[key];
    return `<div class="field ${wide?'wide':''}" data-field="${key}"><label for="${key}">${label}<span class="unit">${unit}</span></label>${select?`<select id="${key}" name="${key}">${step.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>`:`<input type="number" id="${key}" name="${key}" min="${limit[0]}" max="${limit[1]}" step="${step}" required>`}</div>`;
  }).join('');
  function fill(p){for(const [k]of all)$(k).value=p[k];}
  function read(){const p={};for(const [k,,,step]of all){const v=$(k).value;p[k]=typeof E.defaults[k]==='number'?(v.trim()===''?NaN:Number(v)):v;}return p;}
  function visibility(p){
    for(const k of ['columnDiameter'])document.querySelector(`[data-field="${k}"]`).hidden=p.columnShape!=='circle';
    for(const k of ['columnWidth','columnDepth'])document.querySelector(`[data-field="${k}"]`).hidden=p.columnShape!=='rect';
    for(const k of ['plateL','plateW'])document.querySelector(`[data-field="${k}"]`).hidden=p.plateShape!=='rect';
    document.querySelector('[data-field="plateDiameter"]').hidden=p.plateShape!=='circle';
    document.querySelector('[data-field="anchorAngle"]').hidden=p.plateShape!=='circle'||!p.anchorCount;
    document.querySelector('[data-field="anchorEdge"]').hidden=!p.anchorCount;
    $('anchorCount').setAttribute('step',p.plateShape==='circle'?'1':'4');
    const profile=C.column(p);
    $('connection-summary').textContent=`기둥 ${profile.label}${profile.known?' mm':''} · 플레이트 ${p.plateShape==='circle'?`원형 Ø${p.plateDiameter}`:`사각 ${p.plateL}×${p.plateW}`} mm${p.plateShape==='circle'&&p.anchorCount&&Number.isFinite(p.plateDiameter-2*p.anchorEdge)?` · 앵커 중심원 Ø${p.plateDiameter-2*p.anchorEdge} mm / ${p.anchorCount}조 균등 배치`:!p.anchorCount?' · 앵커 없음':''}`;
    document.querySelector('[data-field="velocity"]').hidden=p.windMode!=='velocity';
    for(const k of ['cf','gust'])document.querySelector(`[data-field="${k}"]`).hidden=p.windMode==='pressure';
    for(const k of ['basicWind','topography','importance','direction'])document.querySelector(`[data-field="${k}"]`).hidden=p.windMode!=='regional';
    $('exposure').disabled=p.windMode!=='regional';
    document.querySelector('[data-field="sidePressure"]').hidden=p.sideMode==='linked';
    document.querySelector('[data-field="pressure"]').hidden=p.windMode!=='pressure';
    for(const k of ['aspect','autoMax','autoHMax'])document.querySelector(`[data-field="${k}"]`).hidden=p.mode!=='auto';
    for(const k of ['L','W','H'])$(k).disabled=p.mode==='auto';
    $('mode').options[0].disabled=!E.canScreen(p);
    document.querySelector('[data-field="foundationSpacing"]').hidden=!E.sharedSupports(p);
    $('qty').max=p.installMode==='shared'?32:1000;
    if(getNotes().inputMode!=='detailed')$('dimension-details').open=p.mode==='manual';
    for(const k of ['cL','cW','cH','above','neckCover','neckBar','neckNX','neckNY','tieBar','tieSpacing','dowelEmbed','dowelTail'])document.querySelector(`[data-field="${k}"]`).hidden=!E.types[p.type].neck;
    document.querySelector('[data-field="postSpacing"]').hidden=p.type!=='combined';
    for(const k of ['bar','spacing','neckBar','neckNX','neckNY'])$(k).disabled=p.rebarMode==='auto';
    document.querySelector('[data-field="maxSpacing"]').hidden=p.rebarMode!=='auto';
    $('mode-note').textContent=E.sharedSupports(p)?'전광판 1대를 여러 기초로 받치는 배치입니다. 입력한 동일 치수로 수량과 배근 초안을 계산하며 기초별 반력 분배·구조 검토는 별도입니다.':p.type!=='single'?'이 형식은 수동 치수로 물량·배근 초안을 산출합니다. 형식에 맞는 구조해석과 반력 분배가 필요합니다.':p.mode==='auto'?'푸팅 두께 1,500mm 이상에서 100mm 단위 후보를 검토합니다. 목 단면은 입력값을 유지하며, 자동 치수는 푸팅에 적용합니다.':'치수를 직접 입력하면 검토값과 물량·배근도가 바로 갱신됩니다.';
  }
  let itemSequence=0;
  function createItemId(){return window.crypto?.randomUUID?.()||`foundation-${Date.now().toString(36)}-${(++itemSequence).toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
  let result=null,timer=null,lastInputs=null,prices={...C.defaultPrices},project={name:'전광판 기초 프로젝트',active:0,items:[{id:createItemId(),name:'기초 1',p:{...E.defaults}}]},projectResults=[];
  const invalidRates=new Map();
  function cleanNotes(n={}){if(!n||typeof n!=='object')n={};return {groundKnown:n.groundKnown===true,windManual:n.windManual===true,windExample:n.windExample===true,inputMode:n.inputMode==='detailed'?'detailed':'simple'};}
  function getNotes(){return cleanNotes(project.items[project.active].ui);}
  function notifyUX(){window.FoundationUX?.updated(result);if(typeof window.CustomEvent==='function')window.dispatchEvent(new window.CustomEvent('calculatorchange'));}
  function recalc(){
    clearTimeout(timer);timer=null;
    const p=read();if(!E.canScreen(p)&&p.mode==='auto'){p.mode='manual';$('mode').value='manual';}
    visibility(p);$('error').hidden=true;for(const [k]of all)$(k).classList.remove('invalid');
    try {
      result=E.calculate(p);result.estimate=C.calculate(result,prices);$('outputs').classList.remove('stale');for(const id of ['xlsx','csv','drawing','drawing-svg','print'])$(id).disabled=false;
      if(p.mode==='auto'&&result.search.found)for(const k of ['L','W','H'])$(k).value=result.g[k];
      if(p.rebarMode==='auto'){
        const effective={bar:result.r.code,spacing:result.r.s};
        if(result.r.neck)Object.assign(effective,{neckBar:result.r.neck.bar,neckNX:result.r.neck.nx,neckNY:result.r.neck.ny});
        for(const [key,value]of Object.entries(effective)){$(key).value=value;result.p[key]=value;}
      }
      project.items[project.active].p={...result.p,L:result.g.L,W:result.g.W,H:result.g.H};
      render(result);renderWind(result);renderEstimate(result);refreshProject();rateValidity();persist();
    }catch(err){
      result=null;$('error').hidden=false;let msg=err.message;
      for(const [k,label]of Object.entries(labels)){if(msg.startsWith(k+':')){msg=label+msg.slice(k.length);$(k).classList.add('invalid');break;}}
      $('error').textContent=msg+' 입력 오류가 해소되면 결과가 다시 갱신됩니다.';$('outputs').classList.add('stale');for(const id of ['xlsx','csv','drawing','drawing-svg','print','save'])$(id).disabled=true;$('save-state').textContent='입력 확인 필요 · 마지막 정상 저장본 유지';
    }
    lastInputs=read();notifyUX();
  }
  $('form').addEventListener('submit',e=>e.preventDefault());
  function scheduleFlush(){clearTimeout(timer);timer=setTimeout(flush,180);$('save-state').textContent='입력 중 · 변경 내용을 저장합니다.';}
  $('form').addEventListener('input',e=>{if(['width-m','height-m'].includes(e.target.id))return;scheduleFlush();});
  $('type').addEventListener('change',()=>{
    const t=E.types[$('type').value];for(const k of ['L','W','H','cL','cW','cH','above'])$(k).value=t[k];$('plateL').value=Math.min(500,t.neck?t.cL:t.L);$('plateW').value=Math.min(500,t.neck?t.cW:t.W);$('mode').value=$('type').value==='single'?'auto':'manual';recalc();
  });
  $('form').addEventListener('change',flush);
  $('reset').addEventListener('click',()=>{project.items[project.active].ui=cleanNotes({inputMode:getNotes().inputMode});fill(E.defaults);recalc();toast('현재 작업을 예시 조건으로 되돌렸습니다.');});
  const views=['drawing','check','rebar','boq','cost'];
  for(const view of views)$('tab-'+view).addEventListener('click',()=>{const changed=$('view-'+view).hidden;for(const id of views){$('view-'+id).hidden=id!==view;$('tab-'+id).classList[id===view?'add':'remove']('active');$('tab-'+id).setAttribute('aria-pressed',String(id===view));}if(changed)window.FoundationMotion?.reveal($('view-'+view),'switch');});
  function selectPoint(id){
    const point=W.getPoint(id);if(!point)return;
    project.items[project.active].ui={...getNotes(),windExample:false,windManual:false};$('windPoint').value=id;$('basicWind').value=point.v;$('windMode').value='regional';$('sideMode').value='linked';recalc();
    toast(`${point.name} 기준 ${point.v} m/s 적용 · 현장 지형과 지반값은 직접 확인하세요.`);
  }
  $('windPoint').addEventListener('change',()=>selectPoint($('windPoint').value));
  function pointEvent(e){const target=e.target.closest('[data-point]');if(target){selectPoint(target.getAttribute('data-point'));return;}if(e.type==='keydown')return;
    const b=$('wind-map').getBoundingClientRect(),point=W.nearest((e.clientX-b.left)/b.width*790,(e.clientY-b.top)/b.height*1090);
    if(point&&point.distance<75)selectPoint(point.id);else toast('이 위치에는 기준값이 없습니다. 기준지점을 선택하거나 기본풍속을 직접 입력하세요.');
  }
  $('wind-map').addEventListener('click',pointEvent);
  $('wind-map').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pointEvent(e);}});
  function renderWind(r){
    const point=W.getPoint(r.p.windPoint),d=r.l.windDetail;
    if(!$('map-pins').innerHTML)$('map-pins').innerHTML=W.points.map(p=>`<g id="pin-${p.id}" tabindex="0" role="button" data-point="${p.id}" aria-label="${p.name} 기준풍속 ${p.v} m/s 적용"><title>${p.name} · ${p.v} m/s · ${p.kind}</title><circle cx="${p.x}" cy="${p.y}" r="34" fill="transparent"/><circle id="dot-${p.id}" cx="${p.x}" cy="${p.y}" r="11" fill="#087f73" stroke="white" stroke-width="3"/><text x="${p.x+(['incheon','ulleung','dokdo'].includes(p.id)?-20:20)}" y="${p.y+(p.id==='suwon'?25:p.id==='dokdo'?36:-12)}" text-anchor="${['incheon','ulleung','dokdo'].includes(p.id)?'end':'start'}" style="font:700 26px 'Malgun Gothic',Arial;fill:#07685e;stroke:white;stroke-width:5px;paint-order:stroke fill;pointer-events:none">${p.name}</text></g>`).join('');
    for(const p of W.points){const selected=p.id===r.p.windPoint;$('pin-'+p.id).setAttribute('aria-pressed',String(selected));$('dot-'+p.id).setAttribute('r',selected?'17':'11');$('dot-'+p.id).setAttribute('fill',selected?'#eb743b':'#087f73');}
    const location=point?`${point.name} 기준지점 · 지도 판독 ${point.v} m/s`:'지도 기준지점 미선택';
    $('map-caption').textContent=location;
    const title=d?`적용 풍압 ${fmt(d.pressure,3)} kPa`:`적용 풍압 ${fmt(r.l.pressure,3)} kPa · 직접 입력`;
    const detail=d?`${location}${point&&point.v!==r.p.basicWind?' / 기본풍속 사용자 보정':''}<br>V₀ ${r.p.basicWind} → V ${fmt(d.velocity,2)} m/s · 지표 ${r.p.exposure} · 높이 ${fmt(d.height,2)}m<br>Kzr ${fmt(d.kzr,3)} · Kzt ${r.p.topography} · Iw ${r.p.importance} · KD ${r.p.direction}<br>Cf ${r.p.cf} · G ${r.p.gust} / 2022 지도 예비 계산`:'직접 입력한 풍압 또는 설계풍속을 적용합니다. 지도 지점을 선택하면 지도 계산으로 바뀝니다.';
    $('wind-status').innerHTML=`<strong>${title}</strong><small>${detail}</small>`;
    $('print-wind').innerHTML=`<p>${title}<br>${detail}<br>지도는 기준지점 판독값입니다. 정밀 좌표 GIS·현장 풍하중 확정값이 아닙니다.</p>`;
  }
  function renderEstimate(r){
    const c=r.estimate;
    $('cost-table').innerHTML=c.rows.map(row=>`<tr><td>${esc(row.name)}<small>${esc(row.formula)}</small></td><td>${row.unit}</td><td class="number">${fmt(row.quantity,3)}</td><td><input id="price-${row.id}" data-price="${row.id}" class="price-input" type="number" min="0" max="1000000000" step="1" value="${esc(invalidRates.has(row.id)?invalidRates.get(row.id):row.unitPrice)}" aria-label="${esc(row.name)} 단가 원"></td><td id="amount-${row.id}" class="number">${fmt(row.amount,0)}</td></tr>`).join('');
    renderCostTotals(c);
  }
  function renderCostTotals(c){
    $('cost-total').innerHTML=`<span>공급가 <b>${fmt(c.subtotal,0)}원</b></span><span>부가세 <b>${fmt(c.vat,0)}원</b></span><strong>합계 ${fmt(c.total,0)}원</strong>`;
    $('cost-note').textContent=c.note+(c.unpriced.length?` 단가 미입력: ${c.unpriced.join(', ')}.`:'');
  }
  function rateValidity(){
    for(const id of ['xlsx','csv','print','save'])$(id).disabled=!result||invalidRates.size>0;
    if(invalidRates.size){$('cost-total').textContent='단가 입력을 완료하세요. 이전 합계는 유효하지 않습니다.';$('project-total').textContent='단가 오류로 프로젝트 합계 계산이 중지되었습니다.';$('save-state').textContent='입력 확인 필요 · 마지막 정상 저장본 유지';for(const id of invalidRates.keys()){$('amount-'+id).textContent='—';$('price-'+id).setAttribute('aria-invalid','true');}}
    for(const id of Object.keys(prices))if(!invalidRates.has(id))$('price-'+id).setAttribute('aria-invalid','false');
    notifyUX();
  }
  // Update totals in place so typing a rate does not replace the focused input.
  $('cost-table').addEventListener('input',e=>{
    const id=e.target.getAttribute('data-price');if(!Object.hasOwn(prices,id)||!result)return;
    const value=e.target.value.trim()===''?NaN:Number(e.target.value);
    if(!Number.isFinite(value)||value<0||value>1e9){invalidRates.set(id,e.target.value);e.target.setCustomValidity('0~1,000,000,000원을 입력하세요.');rateValidity();return;}
    invalidRates.delete(id);e.target.setCustomValidity('');prices[id]=value;
    result.estimate=C.calculate(result,prices);for(const row of result.estimate.rows)$('amount-'+row.id).textContent=fmt(row.amount,0);
    renderCostTotals(result.estimate);refreshProject();rateValidity();persist();
  });
  $('prices-reset').addEventListener('click',()=>{prices={...C.defaultPrices};invalidRates.clear();recalc();toast('첨부 파일의 예시 단가로 복원했습니다.');});
  const cachedItems=new Map();
  function refreshProject(){
    projectResults=project.items.map((item,i)=>{if(i===project.active)return {name:item.name,r:result};
      const key=JSON.stringify(item.p);if(!cachedItems.has(key)){const r=E.calculate(item.p);if(cachedItems.size>100)cachedItems.clear();cachedItems.set(key,r);}const r=cachedItems.get(key);r.estimate=C.calculate(r,prices);return {name:item.name,r};
    });
    $('project-table').innerHTML=projectResults.map(({name,r})=>`<tr><td>${esc(name)}<small>전광판 ${r.supports.boards}대 · ${r.p.installMode==='shared'?'한 화면 지지 배치':'반복 설치'}</small></td><td>${r.g.L}×${r.g.W}×${r.g.H}</td><td class="number">${r.p.qty}</td><td class="number">${r.supports.known?r.supports.total+'본':'미지정'}</td><td class="number">${fmt(r.estimate.subtotal,0)}</td><td class="number">${fmt(r.estimate.total,0)}</td></tr>`).join('');
    const sum=projectResults.reduce((s,{r})=>({qty:s.qty+r.p.qty,posts:s.posts+(r.supports.total||0),unknown:s.unknown||!r.supports.known,subtotal:s.subtotal+r.estimate.subtotal,total:s.total+r.estimate.total}),{qty:0,posts:0,unknown:false,subtotal:0,total:0});
    $('project-total').textContent=`${project.name} · ${project.items.length}종 / 기초 ${sum.qty}개 · 기둥 ${sum.posts}본${sum.unknown?' + 미지정 항목 있음':''} · 공급가 ${fmt(sum.subtotal,0)}원 · VAT 포함 ${fmt(sum.total,0)}원`;
  }
  function itemMenu(){
    $('item-select').innerHTML=project.items.map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('');$('item-select').value=project.active;$('item-name').value=project.items[project.active].name;$('project-name').value=project.name;$('item-delete').disabled=project.items.length===1;
  }
  function snapshot(){return {format:'foundation-project',version:1,project,prices};}
  function setProjectName(name){
    const next=String(name??'').trim().slice(0,80)||'전광판 기초 프로젝트',changed=project.name!==next;
    $('project-name').value=next;if(!changed)return next;
    project.name=next;if(result)refreshProject();persist();notifyUX();return next;
  }
  function commitNames(){
    const item=project.items[project.active],itemName=$('item-name').value.trim().slice(0,60)||`기초 ${project.active+1}`,projectName=$('project-name').value.trim().slice(0,80)||'전광판 기초 프로젝트';
    const changed=item.name!==itemName||project.name!==projectName;
    if(changed){item.name=itemName;project.name=projectName;itemMenu();}
    return changed;
  }
  // Saving and leaving the page must include the final keystroke, before blur or debounce.
  // An unchanged flush emits no change event so integrated autosave cannot reschedule itself.
  function flush(){
    const pending=timer!==null;clearTimeout(timer);timer=null;
    const namesChanged=commitNames(),p=read(),inputsChanged=all.some(([key])=>!Object.is(p[key],lastInputs?.[key]));
    if(pending||inputsChanged)recalc();
    else if(namesChanged){if(result)refreshProject();persist();notifyUX();}
    return result&&!invalidRates.size?snapshot():null;
  }
  function persist(){
    if(!result||invalidRates.size){$('save-state').textContent='입력 확인 필요 · 마지막 정상 저장본 유지';return;}
    if(STORE.write(JSON.stringify(snapshot())))$('save-state').textContent=STORE.embedded?'통합 작업에 함께 저장됨':'이 브라우저에 저장됨';else $('save-state').textContent='파일 저장으로 보관하세요';
  }
  function validateProject(raw){
    if(raw?.format!=='foundation-project'||raw.version!==1||!raw.project||!Array.isArray(raw.project.items)||raw.project.items.length<1||raw.project.items.length>50)throw new Error('지원하지 않는 프로젝트 형식입니다.');
    const cleanPrices={...C.defaultPrices,...raw.prices},clean={name:String(raw.project.name||'프로젝트').slice(0,80),active:0,items:[]},ids=new Set();
    for(const item of raw.project.items){if(!item.p||typeof item.p!=='object')throw new Error('기초 입력 조건이 없습니다.');const p={...E.defaults,installMode:item.p.qty>1?'repeat':'shared'};for(const key of Object.keys(E.defaults))if(Object.hasOwn(item.p,key))p[key]=item.p[key];const r=E.calculate(p);C.calculate(r,cleanPrices);let id=typeof item.id==='string'&&/^[A-Za-z0-9_-]{1,120}$/.test(item.id)?item.id:createItemId();while(ids.has(id))id=createItemId();ids.add(id);clean.items.push({id,name:String(item.name||'기초').slice(0,60),p:r.p,ui:cleanNotes(item.ui)});}
    if(Number.isInteger(raw.project.active)&&raw.project.active>=0&&raw.project.active<clean.items.length)clean.active=raw.project.active;
    return {format:'foundation-project',version:1,project:clean,prices:cleanPrices};
  }
  function loadProject(raw){
    const clean=validateProject(raw);project=clean.project;prices=clean.prices;invalidRates.clear();cachedItems.clear();itemMenu();fill(project.items[project.active].p);recalc();return snapshot();
  }
  $('item-select').addEventListener('change',()=>{const next=Number($('item-select').value);if(!flush()){$('item-select').value=project.active;toast('입력 오류를 먼저 수정하세요.');return;}project.active=next;itemMenu();fill(project.items[project.active].p);recalc();});
  $('item-add').addEventListener('click',()=>{if(!flush()){toast('입력 오류를 먼저 수정하세요.');return;}if(project.items.length>=50){toast('기초는 최대 50종까지 보관할 수 있습니다.');return;}project.items.push({id:createItemId(),name:`기초 ${project.items.length+1}`,p:{...project.items[project.active].p},ui:getNotes()});project.active=project.items.length-1;itemMenu();fill(project.items[project.active].p);recalc();});
  $('item-delete').addEventListener('click',()=>{if(project.items.length===1)return;project.items.splice(project.active,1);project.active=Math.min(project.active,project.items.length-1);itemMenu();fill(project.items[project.active].p);recalc();});
  for(const id of ['item-name','project-name']){$(id).addEventListener('input',scheduleFlush);$(id).addEventListener('change',flush);}
  $('save').addEventListener('click',()=>{const current=flush();if(!current){toast('입력 오류를 먼저 수정하세요.');return;}download('전광판_기초_프로젝트.json','application/json',JSON.stringify(current,null,2));toast('입력 조건·기초 목록·단가를 저장했습니다.');});
  $('load').addEventListener('click',()=>$('load-file').click());
  $('load-file').addEventListener('change',async()=>{const file=$('load-file').files[0];if(!file)return;try{if(file.size>1024*1024)throw new Error('1MB 이하의 프로젝트 JSON을 선택하세요.');loadProject(JSON.parse(await file.text()));toast('프로젝트를 불러왔습니다.');}catch(err){toast('불러오기 실패: '+err.message);}$('load-file').value='';});
  function render(r){
    const {p,g,q,l}=r,rb=r.r;
    const fail=r.checks.filter(c=>c.pass===false).length;
    const unsupported=!E.canScreen(p),noCandidate=r.search&&!r.search.found;
    const title=unsupported?'수량·배근 초안 / 구조 미검토':noCandidate?'자동 후보 없음 / 수동 치수 표시':r.screenOK?'계산 항목 충족 / 상세검토 필요':`계산 항목 ${fail}개 미충족 / 치수 재검토`;
    $('summary').className='summary '+(unsupported?'neutral':!r.screenOK?'bad':'');
    $('summary').innerHTML=`<div><strong>${title}</strong><small>${E.types[p.type].label} · ${p.qty}개소 · ${r.search&&r.search.found?`100mm 격자 / ${r.search.count}개 후보 평가`:'수동 치수'} · 시공용 확정도면 아님</small></div><div class="dims">${g.L.toLocaleString()} × ${g.W.toLocaleString()} × ${g.H.toLocaleString()}<span>푸팅 L × W × H (mm)</span></div>`;
    $('metrics').innerHTML=[['구조 콘크리트',r.total.concrete,'m³',`주문 ${fmt(r.total.orderedConcrete,3)} m³`,3],['철근 · 할증 포함',r.total.rebarGross,'kg',`순물량 ${fmt(r.total.rebarNet,1)} kg`,1],['굴착 물량',r.total.excavation,'m³',`GL 이하 ${fmt(q.depth,2)} m`,2],['거푸집 면적',r.total.form,'m²',`${p.qty}개소 전체 수량`,2]].map(([label,value,unit,sub,d])=>`<div class="metric"><label>${label}</label><strong>${fmt(value,d)}</strong><span class="unit">${unit}</span><small>${sub}</small></div>`).join('');
    $('load-summary').innerHTML=[['전광판 면적',`${fmt(l.area)} m²`],['전광판 중량',`${fmt(l.panelKg,1)} kg`],['정면 풍하중',`${fmt(l.front)} kN`],['측면 풍하중',`${fmt(l.side)} kN`],['적용 정면 풍압',`${fmt(l.pressure,3)} kPa`],[unsupported?'부력 추정':'안정용 유효하중',`${fmt(unsupported?q.buoyancy:l.N)} kN`]].map(([label,value])=>`<div>${label}<b>${value}</b></div>`).join('');
    $('checks').innerHTML=r.checks.map(c=>`<tr><td>${c.label}<small>${c.detail}</small></td><td class="number">${unsupported?'—':fmt(c.demand)}</td><td class="number">${unsupported?'—':fmt(c.capacity)}</td><td class="status"><span class="${c.pass===null||unsupported?'unknown':c.pass?'good':'bad'}">${unsupported?'미검토':c.status}</span></td></tr>`).join('');
    $('rebar-caption').textContent=`푸팅 D${rb.code} / 최대 @${rb.s} / 상·하부 각 2방향`;
    $('quantity-caption').textContent=`동일 기초 ${p.qty}개소 · 전광판 ${r.supports.boards}대 · 기둥 ${r.supports.known?r.supports.total+'본':'미지정'}`;
    $('rebar-table').innerHTML=rb.rows.map(row=>`<tr><td><b>${row.code}</b> · ${row.name}<small>${row.note}</small></td><td>D${row.bar}</td><td class="number">${row.count}</td><td class="number">${fmt(row.length,1)}</td><td class="number">${fmt(row.kg*p.qty,2)}</td></tr>`).join('');
    $('rebar-total').textContent=`전체 순물량 ${fmt(r.total.rebarNet,2)} kg + 할증 ${p.rebarWaste}% = ${fmt(r.total.rebarGross,2)} kg / 원본 철근비 방식 비교 ${fmt(r.oldRebar,2)} kg`;
    const a=r.estimate.a;
    r.accessoryBoq=[{name:`앵커 M${p.anchorDiameter}`,unit:'조',total:a.anchors,formula:`지지부 ${a.mounts}개 × ${p.anchorCount}조 × ${p.qty}개소${a.boltCircleDiameter!==null?` / 중심원 Ø${a.boltCircleDiameter} mm`:''}`},{name:'앵커 템플릿 상·하 묶음',unit:'세트',total:a.templates,formula:'1세트 = 상·하 2장'},{name:'그라우트 순체적',unit:'L',total:a.liters,formula:`${a.plateLabel} 면적${a.round?' (πD²/4)':''} × 두께 ${p.groutThickness} mm`},{name:'그라우트 25kg 주문',unit:'포',value:Math.max(0,Math.ceil(a.volume*1000*(1+p.groutWaste/100)/p.groutYield-1e-9)),total:a.groutBags,formula:`수율 ${p.groutYield}L/포 · 손실 ${p.groutWaste}% · 1기초와 현재 기초 종류 전체를 각각 올림`},{name:'접지 동봉·배선',unit:'조',total:a.groundRods,formula:'기초당 입력 조수 × 개소'},{name:'ELP 매설',unit:'m',total:a.elpLength,formula:'기초당 입력 길이 × 개소'}].map(row=>({...row,value:row.value??row.total/p.qty}));
    $('boq').innerHTML=[...r.boq,...r.accessoryBoq].map(row=>`<tr><td>${row.name}</td><td>${row.unit}</td><td class="number">${fmt(row.value,3)}</td><td class="number">${fmt(row.total,3)}</td><td>${row.formula}</td></tr>`).join('');
    $('warnings').innerHTML=r.warnings.map(w=>`<li>${esc(w)}</li>`).join('');
    $('print-inputs').innerHTML=`<div class="print-input-grid">${all.map(([k,label,unit,step])=>{const value=Array.isArray(step)?step.find(x=>String(x[0])===String(p[k]))?.[1]:p[k];return `<div>${label}<br><b>${esc(['L','W','H'].includes(k)?g[k]:value)} ${unit}</b></div>`;}).join('')}</div>`;
    const drawingParts=[[r.supports.shared?'전광판 1대 · 전체 기둥·기초 배치 (X방향)':'전광판 정면 · 기초 1개 형상 (X방향)',elevation(r)],['푸팅 1개 하부 평면 배근도',plan(r,false)],['푸팅 1개 상부 평면 배근도',plan(r,true)],['기초 1개 Y방향 단면 · 목 정착 초안',section(r)]];
    if(rb.neck)drawingParts.push(['목 평면 · 주근 / 폐쇄 띠근 / 보조띠',neckPlan(r)]);
    const box=([title,svg])=>`<div class="drawing-box"><div class="drawing-title">${title}</div>${svg}</div>`;
    $('drawings').innerHTML=box(drawingParts[0])+`<details id="reinforcement-drawings" class="reinforcement-detail"><summary>철근 배근도 ${drawingParts.length-1}장 펼쳐보기</summary><div class="drawings">${drawingParts.slice(1).map(box).join('')}</div></details>`;
    r.drawingParts=drawingParts;
  }
  function svgStart(w,h){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="기초 배근 초안"><style>text{font-family:'Malgun Gothic',Arial,sans-serif;fill:#39536b;font-size:11px} .dim{stroke:#647e94;stroke-width:1;fill:none}.concrete{fill:#dce7ef;stroke:#456580;stroke-width:1.5}.soil{fill:#f0eade;stroke:#bda87d}.bottom{stroke:#177dcc;fill:none;stroke-width:2}.top{stroke:#dc6b38;fill:none;stroke-width:2}.main{stroke:#099282;fill:none;stroke-width:2}</style><rect width="${w}" height="${h}" fill="#f8fbfd"/>`;}
  const line=(x,y,xx,yy,cls='dim',extra='')=>`<line x1="${x}" y1="${y}" x2="${xx}" y2="${yy}" class="${cls}" ${extra}/>`;
  const text=(x,y,s,anchor='start',size=11)=>`<text x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px">${esc(s)}</text>`;
  const rect=(x,y,w,h,cls)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}"/>`;
  function columnPlan(profile,cx,cy,scale){
    if(!profile.known)return '';
    const style='fill="#dce7ef" fill-opacity=".7" stroke="#456580" stroke-width="1.5"';
    return profile.shape==='circle'?`<circle data-column-shape="circle" cx="${cx}" cy="${cy}" r="${profile.width*scale/2}" ${style}/>`:`<rect data-column-shape="rect" x="${cx-profile.width*scale/2}" y="${cy-profile.depth*scale/2}" width="${profile.width*scale}" height="${profile.depth*scale}" ${style}/>`;
  }
  function hdim(x,x2,y,label){return line(x,y,x2,y)+line(x,y-4,x,y+4)+line(x2,y-4,x2,y+4)+text((x+x2)/2,y-6,label,'middle');}
  function vdim(y,y2,x,label){return line(x,y,x,y2)+line(x-4,y,x+4,y)+line(x-4,y2,x+4,y2)+text(x+7,(y+y2)/2+4,label);}
  function elevation(r){
    const {p,g,q,l}=r,profile=r.estimate.a.column,ww=920,hh=340;
    const shared=r.supports.shared,count=shared?p.qty:1,span=(count-1)*p.foundationSpacing/1000;
    const centers=Array.from({length:count},(_,i)=>(i-(count-1)/2)*p.foundationSpacing/1000);
    const width=Math.max(p.signW/1000,q.topL+span,g.L/1000+span)+1.7;
    const height=p.bottom+p.signH/1000+q.depth+1.2,scale=Math.min(740/width,270/height),cx=440,top=35;
    const ground=top+(p.bottom+p.signH/1000+.35)*scale,Y=z=>ground-z*scale;
    let s=svgStart(ww,hh);
    const below=q.depth*scale;s+=rect(70,ground,750,below,'soil')+line(55,ground,825,ground)+text(65,ground-7,'GL ±0.000');
    const ftop=ground+g.embed*scale,fh=g.H/1000*scale,fw=g.L/1000*scale;
    const stemTop=Y(g.above/1000);
    for(let i=0;i<count;i++){
      const centerX=cx+centers[i]*scale;s+=`<g data-foundation="${i+1}">`;
      s+=`<path d="M${centerX-q.topL*scale/2} ${ground} L${centerX-q.botL*scale/2} ${ground+below} L${centerX+q.botL*scale/2} ${ground+below} L${centerX+q.topL*scale/2} ${ground}" fill="none" stroke="#b76565" stroke-dasharray="5 4"/>`;
      s+=rect(centerX-fw/2,ftop,fw,fh,'concrete');
      s+=rect(centerX-q.subL*scale/2,ftop+fh,q.subL*scale,p.lean/1000*scale,'soil');
      s+=rect(centerX-q.subL*scale/2,ftop+fh+p.lean/1000*scale,q.subL*scale,p.stone/1000*scale,'soil');
      if(g.neck)for(let j=0;j<g.pedestals.length;j++){
        const x=centerX+g.pedestals[j]/1000*scale;
        s+=rect(x-g.cL/2000*scale,stemTop,g.cL/1000*scale,g.cH/1000*scale,'concrete');
        const postW=profile.known?profile.width/1000*scale:8;
        s+=`<rect ${r.supports.known?`data-column="${i+1}-${j+1}"`:''} data-column-shape="${profile.shape}" x="${x-postW/2}" y="${Y(p.bottom)}" width="${postW}" height="${Math.max(0,stemTop-Y(p.bottom))}" class="concrete"/>`;
        if(profile.shape==='circle')s+=line(x,Y(p.bottom),x,stemTop,'dim','stroke-dasharray="5 3"');
      }else s+=rect(centerX-4,Y(p.bottom),8,Math.max(0,ground-Y(p.bottom)),'concrete');
      s+='</g>';
    }
    if(shared&&r.supports.known){const extra=p.type==='combined'?p.postSpacing/2000:0;s+=line(cx+(centers[0]-extra)*scale,Y(p.bottom),cx+(centers[count-1]+extra)*scale,Y(p.bottom),'dim','stroke-width="5"');}
    const boardX=cx-p.signW/2000*scale,boardY=Y(p.bottom+p.signH/1000),boardW=p.signW/1000*scale,boardH=p.signH/1000*scale;
    s+=`<rect data-board="1" x="${boardX}" y="${boardY}" width="${boardW}" height="${boardH}" rx="2" fill="#143751" stroke="#16797c" stroke-width="2"/>`;
    for(let i=1;i<8;i++)s+=line(boardX+boardW*i/8,boardY,boardX+boardW*i/8,boardY+boardH,'dim','stroke-opacity=".4"');
    s+=`<text x="${cx}" y="${boardY+boardH/2+4}" text-anchor="middle" fill="white" style="fill:white;font-size:13px">${p.signW} × ${p.signH} mm</text>`;
    s+=hdim(boardX,boardX+boardW,boardY-13,`전광판 W ${p.signW}`);
    s+=vdim(boardY,boardY+boardH,boardX+boardW+15,`${p.signH}`);
    s+=vdim(Y(p.bottom),ground,Math.max(120,boardX-22),`하단 ${p.bottom.toFixed(2)} m`);
    const dimX=cx+centers[Math.floor((count-1)/2)]*scale;
    s+=hdim(dimX-fw/2,dimX+fw/2,ftop+fh+30,`기초 1개 L ${g.L} / 두께 ${g.H}`);
    s+=text(900,24,shared?'전광판 1대 · 전체 기초 배치':'도면은 기초 1개 기준','end',12);
    s+=text(900,45,`정면 풍압 ${fmt(l.pressure,2)} kPa`,'end')+text(900,64,`전광판 1대 풍하중 ${fmt(l.front,2)} kN`,'end')+text(900,83,shared?'기초별 반력 분배 · 구조 미검토':'정면풍은 화면에 수직 작용','end')+text(900,102,`GL 이하 굴착 ${fmt(q.depth,2)} m`,'end')+text(900,123,`전체 기초 ${p.qty}개 · 기둥 ${r.supports.known?r.supports.total+'본':'미지정'}`,'end');
    if(shared)s+=text(900,142,`기초 중심 간격 ${p.foundationSpacing} mm`,'end');
    if(profile.known)s+=text(900,shared?161:142,`강재 기둥 ${profile.label} mm`,'end');
    return s+'</svg>';
  }
  function plan(r,upper){
    const {g,p}=r,rb=r.r,scale=Math.min(315/g.L,270/g.W),cx=220,cy=177,w=g.L*scale,h=g.W*scale,x=cx-w/2,y=cy-h/2;
    let s=svgStart(460,380)+rect(x,y,w,h,'concrete');
    const cls=upper?'top':'bottom';
    for(let i=0;i<rb.x.n;i++){const yy=y+(rb.x.start+i*rb.x.actual)*scale;s+=line(x+p.cover*scale,yy,x+(g.L-p.cover)*scale,yy,cls);}
    for(let i=0;i<rb.y.n;i++){const xx=x+(rb.y.start+i*rb.y.actual)*scale;s+=line(xx,y+p.cover*scale,xx,y+(g.W-p.cover)*scale,cls);}
    if(g.neck)for(const off of g.pedestals)s+=`<rect x="${cx+off*scale-g.cL*scale/2}" y="${cy-g.cW*scale/2}" width="${g.cL*scale}" height="${g.cW*scale}" fill="white" fill-opacity=".85" stroke="#199584" stroke-dasharray="4 3"/>`;
    if(g.neck&&r.supports.known)for(const off of g.pedestals)s+=columnPlan(r.estimate.a.column,cx+off*scale,cy,scale);
    s+=hdim(x,x+w,y+h+22,`X / L = ${g.L}`)+vdim(y,y+h,x+w+14,`${g.W}`);
    s+=text(17,21,`${upper?'F3 / F4 상부':'F1 / F2 하부'} 각 2방향 / D${rb.code}`)+text(17,40,`X ${rb.x.n}본 @${fmt(rb.x.actual,1)} / Y ${rb.y.n}본 @${fmt(rb.y.actual,1)}`);
    s+=text(17,351,`X근 길이 ${g.L-2*p.cover} / Y근 길이 ${g.W-2*p.cover} mm`)+text(17,370,`피복 ${p.cover} mm / ${upper?'X근 위에 Y근':'X근 아래, Y근 위'} · 실제 간격 표기`);
    return s+'</svg>';
  }
  function section(r){
    const {g,p,q}=r,rb=r.r,scale=Math.min(300/g.W,220/(g.H+g.cH+p.lean+p.stone+150)),cx=195,baseY=280;
    const fw=g.W*scale,fh=g.H*scale,ftop=baseY-fh,ntop=ftop-g.cH*scale,ground=ftop-g.embed*1000*scale;
    let s=svgStart(460,390)+rect(cx-fw/2,ground,fw,baseY-ground,'soil')+line(22,ground,412,ground)+text(25,ground-5,'GL');
    s+=rect(cx-fw/2,ftop,fw,fh,'concrete');
    s+=rect(cx-q.subW*1000*scale/2,baseY,q.subW*1000*scale,p.lean*scale,'soil')+rect(cx-q.subW*1000*scale/2,baseY+p.lean*scale,q.subW*1000*scale,p.stone*scale,'soil');
    if(g.neck)s+=rect(cx-g.cW*scale/2,ntop,g.cW*scale,g.cH*scale,'concrete');
    const d=rb.b.d,lo=baseY-(p.cover+d/2)*scale,hi=ftop+(p.cover+d/2)*scale,edge=fw/2-p.cover*scale;
    s+=line(cx-edge,lo-d*scale,cx+edge,lo-d*scale,'bottom')+line(cx-edge,hi+d*scale,cx+edge,hi+d*scale,'top');
    for(let i=0;i<rb.x.n;i++){const xx=cx-fw/2+(rb.x.start+i*rb.x.actual)*scale;s+=`<circle cx="${xx}" cy="${lo}" r="2" fill="#177dcc"/><circle cx="${xx}" cy="${hi}" r="2" fill="#dc6b38"/>`;}
    if(rb.neck){const n=rb.neck,yend=ftop+p.dowelEmbed*scale,ystart=ntop+p.neckCover*scale,x1=cx-g.cW*scale/2+n.start*scale,x2=cx+g.cW*scale/2-n.start*scale;
      s+=`<path d="M${x1} ${ystart} V${yend} H${x1-p.dowelTail*scale} M${x2} ${ystart} V${yend} H${x2+p.dowelTail*scale}" class="main" fill="none"/>`;
      for(let i=0;i<n.ties.n;i++){const y=ntop+(n.ties.start+i*n.ties.actual)*scale;s+=line(cx-n.tieY*scale/2,y,cx+n.tieY*scale/2,y,'main');}
      s+=text(12,20,`목 주근 ${n.longN}-D${n.bar} / 목당`)+text(12,39,`띠근 D${p.tieBar} @${fmt(n.ties.actual,1)} / ${n.ties.n}단`);
      s+=vdim(ntop,ftop,cx+g.cW*scale/2+12,`목 ${g.cH}`);
    }else s+=text(12,20,'목 없음 / 상·하부 격자근 초안');
    s+=vdim(ftop,baseY,cx+fw/2+14,`H ${g.H}`)+hdim(cx-fw/2,cx+fw/2,baseY+38,`Y / W ${g.W}`);
    s+=text(12,347,`푸팅 D${rb.code} / 피복 ${p.cover} / 유효깊이 ${fmt(rb.fx.d,1)} mm`)+text(12,366,`정착 근입 ${p.dowelEmbed} + 꼬리 ${p.dowelTail} mm (입력값)`)+text(12,383,'목·앵커 전달 및 정착 상세 별도 / 절곡 형상은 개략');
    return s+'</svg>';
  }
  function neckPlan(r){
    const {g,p}=r,n=r.r.neck,a=r.estimate.a,scale=Math.min(260/g.cL,230/g.cW),cx=215,cy=181,w=g.cL*scale,h=g.cW*scale,x=cx-w/2,y=cy-h/2;
    let s=svgStart(460,390)+rect(x,y,w,h,'concrete');
    const tx=n.tieX*scale,ty=n.tieY*scale;
    s+=`<rect x="${cx-tx/2}" y="${cy-ty/2}" width="${tx}" height="${ty}" class="main" fill="none" style="fill:none"/>`;
    const startX=x+n.start*scale,endX=x+(g.cL-n.start)*scale,startY=y+n.start*scale,endY=y+(g.cW-n.start)*scale;
    for(let i=0;i<n.nx;i++){const xx=startX+i*n.sx*scale;for(const yy of [startY,endY])s+=`<circle cx="${xx}" cy="${yy}" r="3.5" fill="#099282"/>`;if(i>0&&i<n.nx-1)s+=line(xx,cy-ty/2,xx,cy+ty/2,'main','stroke-dasharray="4 3" stroke-opacity=".55"');}
    for(let i=1;i<n.ny-1;i++){const yy=startY+i*n.sy*scale;for(const xx of [startX,endX])s+=`<circle cx="${xx}" cy="${yy}" r="3.5" fill="#099282"/>`;s+=line(cx-tx/2,yy,cx+tx/2,yy,'main','stroke-dasharray="4 3" stroke-opacity=".55"');}
    s+=a.round?`<circle data-plate-shape="circle" cx="${cx}" cy="${cy}" r="${p.plateDiameter*scale/2}" fill="none" stroke="#c87431" stroke-dasharray="5 4"/>`:`<rect data-plate-shape="rect" x="${cx-p.plateL*scale/2}" y="${cy-p.plateW*scale/2}" width="${p.plateL*scale}" height="${p.plateW*scale}" fill="none" stroke="#c87431" stroke-dasharray="5 4"/>`;
    if(a.round&&p.anchorCount)s+=`<circle data-bolt-circle="${a.boltCircleDiameter}" cx="${cx}" cy="${cy}" r="${a.boltCircleDiameter*scale/2}" fill="none" stroke="#c87431" stroke-opacity=".45" stroke-dasharray="2 4"/>`;
    if(r.supports.known)s+=columnPlan(a.column,cx,cy,scale);
    for(const [xx,yy]of a.positions)s+=`<circle data-anchor="1" cx="${cx+xx*scale}" cy="${cy-yy*scale}" r="${Math.max(3,p.anchorDiameter*scale/2)}" fill="#e67f3a" stroke="white"/>`;
    s+=text(12,21,`${n.longN}-D${n.bar} / X면 ${n.nx}본, Y면 ${n.ny}본 (모서리 공유)`)+text(12,40,`${a.column.known?`기둥 ${a.column.label} mm / `:''}주근비 ${fmt(n.rho*100,2)}% / 단면 P–M 검토 필요`,'start',a.column.known?10:11)+hdim(x,x+w,y+h+22,`cL ${g.cL}`)+vdim(y,y+h,x+w+13,`${g.cW}`);
    s+=text(12,349,`띠근 D${p.tieBar} / 피복 ${p.neckCover} / 주황 앵커 ${p.anchorCount}-M${p.anchorDiameter}`)+text(12,368,`플레이트 ${a.plateLabel}${a.boltCircleDiameter!==null?` / 앵커 중심원 Ø${a.boltCircleDiameter}`:''} / 목 ${g.n}개 동일 초안`,'start',10)+text(12,385,'앵커·주근 간섭, 갈고리·내진·횡지지 상세 확정 필요');
    return s+'</svg>';
  }
  function download(name,mime,content){const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function getExcelPacket(){
    if(!flush())throw new Error('입력 오류를 먼저 수정하세요.');
    const r=result,notes=getNotes(),point=W.getPoint(r.p.windPoint),mapped=r.p.windMode==='regional'&&point;
    const groups={'sign-fields':'설치','sign-detail-fields':'제품','precise-sign-fields':'화면','map-fields':'지역','wind-fields':'풍하중','site-fields':'지반','site-detail-fields':'추가 하중','geometry-fields':'기초 설정','geometry-detail-fields':'탐색 범위','foundation-dims':'치수','rebar-fields':'재료·철근','design-fields':'검토 계수','quantity-fields':'굴착·할증','accessory-fields':'앵커·부속','connection-fields':'기둥·플레이트'};
    return {r,projectName:project.name,itemName:project.items[project.active].name,active:project.active,items:projectResults,bars:E.bars,canScreen:E.canScreen(r.p),typeLabel:E.types[r.p.type].label,dateLabel:new Date().toLocaleDateString('ko-KR'),
      groundLabel:notes.groundKnown?'사용자가 자료 입력 선택':'미확인 / 예시 입력',
      windLabel:mapped?(point.v===r.p.basicWind?point.name+' 지도 예비값':point.name+' 기준 / 사용자 풍속 보정'):notes.windManual?'사용자가 직접 입력값 확인':'미확인 / 예시 입력',
      windSource:r.l.windDetail?W.source:null,
      resultLabel:!E.canScreen(r.p)?'구조 미검토':r.search&&!r.search.found?'자동 후보 없음':r.screenOK?'계산 항목 충족 / 상세검토 필요':'미충족 또는 미검토',
      inputs:Object.entries(spec).flatMap(([group,fields])=>fields.map(([k,label,unit,step])=>({key:k,label,unit,group:groups[group]||'입력',value:['L','W','H'].includes(k)?r.g[k]:Array.isArray(step)?step.find(x=>String(x[0])===String(r.p[k]))?.[1]||String(r.p[k]):r.p[k]})))};
  }
  $('xlsx').addEventListener('click',()=>{
    try{const report=FoundationExcel.model(getExcelPacket());download('전광판_기초_철근_산출서.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',FoundationExcel.bytes(report));toast('요약·물량·철근·견적·프로젝트·검토 입력을 서식 엑셀로 저장했습니다.');}
    catch(err){toast('엑셀 저장 실패: '+err.message);}
  });
  function exportRows(r){
    const notes=getNotes(),mapped=r.p.windMode==='regional'&&r.p.windPoint,windLabel=mapped?(W.getPoint(r.p.windPoint).v===r.p.basicWind?'지도 기준점의 예비값':'지도 기준점에서 사용자 풍속 보정'):notes.windManual?'사용자가 직접 입력값 확인':'미확인 또는 예시값';
    const rows=[['전광판 기초·철근 계산기 간편·상세 V7','예비 검토·배근 초안 / 시공 승인 아님'],['프로젝트',project.name],['현재 기초',project.items[project.active].name],['지반자료 확인',notes.groundKnown?'사용자가 자료 입력 선택':'미확인 입력값으로 예비 계산'],['풍하중 선택',windLabel],['기초 형식',E.types[r.p.type].label],['배치 방식',r.p.installMode==='shared'?'전광판 1대 아래 기둥·기초':'전광판 반복 설치'],['전광판 전체 수량',r.supports.boards,'대'],['기초 전체 수량',r.p.qty,'개'],['기초 1개당 기둥',r.supports.known?r.supports.perFoundation:'미지정','본'],['기둥 전체 수량',r.supports.known?r.supports.total:'미지정','본'],['결과',r.search&&!r.search.found?'자동 후보 없음 / 수동값':r.screenOK?'계산 항목 충족 / 상세검토 필요':'미충족 또는 미검토'],['입력명','입력값','단위']];
    for(const [k,label,unit,step]of all){const value=Array.isArray(step)?step.find(x=>String(x[0])===String(r.p[k]))?.[1]:r.p[k];rows.push([label,['L','W','H'].includes(k)?r.g[k]:value,unit]);}
    rows.push([],['적용 정면 풍압',r.l.pressure,'kPa'],['적용 측면 풍압',r.l.sidePressure,'kPa']);
    if(r.l.windDetail)rows.push(['풍속 지도 출처',W.source.title,W.source.year,W.source.figure,W.source.url],['지도 기준지점',W.getPoint(r.p.windPoint)?.name||'미선택'],['Kzr',r.l.windDetail.kzr],['설계풍속 V',r.l.windDetail.velocity,'m/s'],['지도 범위','기준지점 판독 예비값 / 정밀 좌표 GIS 판정 아님']);
    rows.push([],['물량','단위','1기초','전체','산출근거']);for(const row of [...r.boq,...r.accessoryBoq])rows.push([row.name,row.unit,row.value,row.total,row.formula]);
    rows.push([],['철근번호','부위','규격','본수/1기초','개략길이 mm','총본수','전체순중량 kg','설명']);for(const row of r.r.rows)rows.push([row.code,row.name,'D'+row.bar,row.count,row.length,row.count*r.p.qty,row.kg*r.p.qty,row.note]);
    rows.push([],['검토','계산값','기준/용량','판정','설명']);for(const row of r.checks)rows.push([row.label,E.canScreen(r.p)?fmt(row.demand,4):'',E.canScreen(r.p)?fmt(row.capacity,4):'',E.canScreen(r.p)?row.status:'미검토',row.detail]);
    rows.push([],['견적 공종','단위','수량','단가 원','금액 원','산출근거']);for(const row of r.estimate.rows)rows.push([row.name,row.unit,row.quantity,row.unitPrice,row.amount,row.formula]);
    rows.push(['공급가',r.estimate.subtotal],['부가세',r.estimate.vat],['합계',r.estimate.total],['견적 범위',r.estimate.note]);
    rows.push([],['프로젝트 기초 이름','치수 L×W×H','기초 수량','전광판 대수','기둥 본수','공급가','VAT 포함']);for(const {name,r:pr}of projectResults)rows.push([name,`${pr.g.L}×${pr.g.W}×${pr.g.H}`,pr.p.qty,pr.supports.boards,pr.supports.known?pr.supports.total:'미지정',pr.estimate.subtotal,pr.estimate.total]);
    rows.push([],['검토 범위']);for(const w of r.warnings)rows.push([w]);return rows;
  }
  $('csv').addEventListener('click',()=>{if(!flush())return;const csv=exportRows(result).map(row=>row.map(v=>'"'+(typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'":'')+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');download('전광판_기초_철근_산출서.csv','text/csv;charset=utf-8','\ufeff'+csv);toast('입력·검토·물량·철근표·견적을 저장했습니다.');});
  $('drawing').addEventListener('click',()=>{
    flush();if(!result)return;
    try{
      const r=result,notes=getNotes(),point=W.getPoint(r.p.windPoint);
      const context={projectName:project.name,itemName:project.items[project.active].name,groundLabel:notes.groundKnown?'지반자료 사용자 입력':'지반자료 미확인',windLabel:r.l.windDetail?(point?.name||'직접 V0')+' 기준 / 지도 판독 예비값':'직접 풍하중 입력'};
      const drawing=FoundationDXF.create(r,context);
      download('전광판_기초_철근_배근초안.dxf','application/dxf',drawing.content);toast('CAD 도면을 DXF로 저장했습니다. 형상 단위는 mm이며 선·문자·치수를 편집할 수 있습니다.');
    }catch(err){toast('DXF 저장 실패: '+err.message);}
  });
  $('drawing-svg').addEventListener('click',()=>{
    flush();if(!result)return;const r=result,svgWidth=1000,H=1290;let svg=svgStart(svgWidth,H);
    svg+=text(25,30,'전광판 기초 · 철근 배근 초안 / 시공용 확정도면 아님','start',19)+text(25,53,`전광판 ${r.supports.boards}대 / 기초 ${r.p.qty}개 / 기둥 ${r.supports.known?r.supports.total+'본':'미지정'} / L×W×H ${r.g.L}×${r.g.W}×${r.g.H} mm`,'start',13);
    svg+=text(25,70,`${project.items[project.active].name} / 풍압 ${fmt(r.l.pressure,3)} kPa / ${r.l.windDetail?(W.getPoint(r.p.windPoint)?.name||'직접 V₀')+' 기준 · 지도 판독 예비값':'직접 풍하중 입력'}`);
    const places=[[30,90,920,340],[25,460,460,380],[515,460,460,380],[25,870,460,390],[515,870,460,390]];
    r.drawingParts.forEach(([title,part],i)=>{const[x,y,w,h]=places[i];svg+=text(x,y-10,title);svg+=part.replace('<svg xmlns="http://www.w3.org/2000/svg"',`<svg x="${x}" y="${y}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"`);});
    svg+=text(25,1280,`정착·목·앵커·뚫림 모멘트·내진·침하 별도 검토 / 개략 전개길이 / ${getNotes().groundKnown?'지반자료 사용자 입력':'지반자료 미확인'}`)+'</svg>';
    download('전광판_기초_철근_배근초안.svg','image/svg+xml;charset=utf-8',svg);toast('평면·단면·목 배근 초안을 SVG로 저장했습니다.');
  });
  $('print').addEventListener('click',()=>{if(flush()){const restore=window.FoundationUX?.preparePrint();window.print();restore?.();}});
  function toast(msg){$('toast').textContent=msg;$('toast').hidden=false;window.FoundationMotion?.reveal($('toast'),'switch','label');setTimeout(()=>$('toast').hidden=true,3200);}
  window.FoundationUI={read,recalc,flush,setProjectName,selectPoint,snapshot,validateProject,loadProject,getResult:()=>result,getExcelPacket,getNotes,setNotes:patch=>{project.items[project.active].ui=cleanNotes({...getNotes(),...patch});persist();notifyUX();},hasRateErrors:()=>invalidRates.size>0};
  window.addEventListener?.('beforeunload',flush);window.addEventListener?.('pagehide',flush);window.document?.addEventListener?.('visibilitychange',()=>{if(window.document.visibilityState==='hidden')flush();});
  if(STORE.embedded){const summary=document.querySelector('.file-tools>summary');if(summary)summary.textContent='기초 단독 출력';}
  itemMenu();fill(E.defaults);
  let restored=false;try{const saved=STORE.read();if(saved){loadProject(JSON.parse(saved.text));restored=true;if(saved.legacy){persist();toast('이전 버전(V4) 자동 저장 작업을 가져왔습니다. 이후 V7 작업은 따로 저장되어 V4 화면과 서로 덮어쓰지 않습니다.');}}}catch{}
  if(!restored)recalc();
})();
