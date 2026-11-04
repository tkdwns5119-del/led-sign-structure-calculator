(function(){
  'use strict';
  const api=window.FoundationUI,E=FoundationEngine,W=FoundationWind,$=id=>document.getElementById(id);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,d=2)=>Number(v).toLocaleString('ko-KR',{maximumFractionDigits:d});
  let step=1,furthest=1,inputMode=null,renderedStep=null,renderedMode=null;
  const detailedGroups=['wind-settings','connection-settings','product-settings','advanced-settings','dimension-details','rebar-settings','design-settings','site-settings','quantity-settings','accessory-settings'];
  const previousOpen=new Map();
  const windReady=()=>{const p=api.read(),n=api.getNotes();return !!(p.windMode==='regional'&&p.windPoint||n.windManual||n.windExample);};
  function syncInputMode(next){
    if(inputMode===next)return;
    inputMode=next;const detailed=next==='detailed';
    $('inputs').classList[detailed?'add':'remove']('detailed-input');
    for(const mode of ['simple','detailed'])$('input-'+mode).setAttribute('aria-pressed',String(mode===next));
    $('wizard-nav').hidden=detailed;$('detail-nav').hidden=!detailed;
    $('wizard-progress').hidden=detailed;
    $('input-mode-buttons').setAttribute('data-mode',next);
    $('detail-shortcuts').hidden=!detailed;
    $('input-mode-note').textContent=detailed?'제품 무게, 기초 치수, 철근, 풍하중과 굴착 조건을 직접 수정할 수 있습니다. 아래 항목을 눌러 이동하세요.':'설치 장소 → 전광판 크기 → 결과 확인 순서로 입력합니다. 상세 입력으로 바꿔도 작성한 값은 유지됩니다.';
    $('calculate-simple').textContent=detailed?'입력한 조건으로 결과 보기 →':'기초와 자재 계산하기 →';
    $('edit-size').textContent=detailed?'← 상세 조건 수정':'← 크기 수정';
    $('location-next').textContent=detailed?'전광판 크기로 이동 ↓':'다음 · 크기 입력 →';
    $('use-current-wind').textContent=detailed?'입력한 풍하중 사용':'직접 입력한 값으로 진행';
    for(const id of detailedGroups){
      const node=$(id);
      if(detailed){previousOpen.set(id,!!node.open);node.open=true;}
      else if(previousOpen.has(id))node.open=previousOpen.get(id);
    }
    if(!detailed&&api.read().mode==='manual')$('dimension-details').open=true;
    showStep(step===3&&api.getResult()?3:detailed?2:step);
  }
  for(const mode of ['simple','detailed'])$('input-'+mode).addEventListener('click',()=>api.setNotes({inputMode:mode}));
  $('detail-input').addEventListener('click',()=>showStep(2));
  $('detail-result').addEventListener('click',()=>{api.recalc();showStep(3);});
  for(const [button,target]of [['jump-wind','wind-settings'],['jump-connection','connection-settings'],['jump-product','product-settings'],['jump-foundation','dimension-details'],['jump-rebar','rebar-settings'],['jump-site','site-settings'],['jump-quantity','quantity-settings'],['jump-accessory','accessory-settings']]){
    $(button).addEventListener('click',()=>{
      showStep(2);$('advanced-settings').open=true;$(target).open=true;
      window.FoundationMotion?.scrollTo($(target));
      $(target).focus?.({preventScroll:true});
    });
  }
  function showStep(next){
    const detailed=inputMode==='detailed';
    if((detailed?next===3:next>1)&&!windReady()){$('location-error').hidden=false;$('location-error').textContent='설치지역을 선택하거나 직접 입력한 풍하중 사용을 눌러주세요. 모르면 “예시로 보기”로 시작할 수 있습니다.';next=detailed?2:1;}
    if(next===3&&!api.getResult())return false;
    const changed=renderedStep!==next||renderedMode!==inputMode;
    const direction=renderedStep!==null&&next<renderedStep?'backward':next>renderedStep?'forward':'switch';
    step=next;furthest=Math.max(furthest,step);
    $('location-step').hidden=detailed?step===3:step!==1;$('size-step').hidden=detailed?step===3:step!==2;$('outputs').hidden=step!==3;
    for(let i=1;i<=3;i++){$('step-'+i).setAttribute('aria-current',i===step?'step':'false');$('step-'+i).classList[i===step?'add':'remove']('current');$('step-'+i).classList[i<step?'add':'remove']('complete');$('step-'+i).disabled=i>furthest;}
    $('wizard-progress').setAttribute('data-step',String(step));
    $('workflow-count').textContent=detailed?'상세 모드':`${String(step).padStart(2,'0')} / 03`;
    $('workflow-label').textContent=step===3?'결과 확인':detailed?'조건 작성':step===1?'설치 장소':'전광판 크기';
    $('detail-input').setAttribute('aria-pressed',String(step!==3));$('detail-result').setAttribute('aria-pressed',String(step===3));
    $('detail-result').disabled=!api.getResult();$('detail-shortcuts').hidden=!detailed||step===3;
    $('mode-eyebrow').textContent=detailed?'필요한 조건을 직접 입력':'3단계로 미리 계산';
    $('step-description').textContent=step===3?'기초 크기와 필요한 자재를 확인하고 작업을 저장하세요.':detailed?'항목별로 조건을 수정한 뒤 “입력한 조건으로 결과 보기”를 누르세요.':step===1?'설치지역과 주변 환경부터 골라주세요.':'화면의 가로·세로와 땅에서의 높이를 입력하세요.';
    $('wizard-title').textContent=step===3?'필요한 기초와 자재를 확인하세요.':detailed?'조건을 직접 입력하세요.':step===1?'어디에 설치하나요?':'전광판은 얼마나 큰가요?';
    if(!detailed)$('step-'+step).focus?.({preventScroll:true});
    if(changed&&renderedStep!==null){
      for(const id of ['location-step','size-step','outputs'])if(!$(id).hidden)window.FoundationMotion?.reveal($(id),direction);
      window.FoundationMotion?.reveal($('wizard-title'),'switch','label');
    }
    renderedStep=step;renderedMode=inputMode;
    return true;
  }
  for(let i=1;i<=3;i++)$('step-'+i).addEventListener('click',()=>showStep(i));
  $('location-next').addEventListener('click',()=>{showStep(2);if(inputMode==='detailed')window.FoundationMotion?.scrollTo($('size-step'));});
  $('example-site').addEventListener('click',()=>{
    // Explicit example choice; no site data is invented or overwritten.
    api.setNotes({windExample:true,windManual:false});
    if(api.read().windMode==='regional'&&!api.read().windPoint){$('windMode').value='pressure';api.recalc();}
    $('location-error').hidden=true;showStep(2);
  });
  $('use-current-wind').addEventListener('click',()=>{api.recalc();if(!api.getResult())return;api.setNotes({windManual:true,windExample:false});showStep(2);});
  $('size-back').addEventListener('click',()=>showStep(1));$('edit-size').addEventListener('click',()=>showStep(2));
  $('edit-multi-foundation').addEventListener('click',()=>{$('advanced-settings').open=true;$('dimension-details').open=true;window.FoundationMotion?.scrollTo($('dimension-details'));$('L').focus?.({preventScroll:true});});
  $('calculate-simple').addEventListener('click',()=>{api.recalc();if(api.getResult())showStep(3);});
  $('ground-status').addEventListener('change',()=>api.setNotes({groundKnown:$('ground-status').value==='provided'}));
  for(const [proxy,key]of [['width-m','signW'],['height-m','signH']]){
    const update=()=>{$(key).value=$(proxy).value.trim()===''?'':Number($(proxy).value)*1000;api.recalc();};
    $(proxy).addEventListener('input',update);$(proxy).addEventListener('change',update);
  }
  // A changed direct wind entry needs a new explicit confirmation.
  for(const key of ['windMode','pressure','velocity','cf','gust','sidePressure','sideMode'])$(key).addEventListener('change',()=>api.setNotes({windManual:false,windExample:false}));
  $('reset').addEventListener('click',()=>{furthest=1;showStep(inputMode==='detailed'?2:1);});
  function updated(r){
    const p=api.read(),n=api.getNotes(),point=W.getPoint(p.windPoint),supports=E.supportCounts(p);
    syncInputMode(n.inputMode);
    for(const [proxy,key]of [['width-m','signW'],['height-m','signH']]){if(document.activeElement!==$(proxy))$(proxy).value=Number.isFinite(p[key])?p[key]/1000:'';$(proxy).setAttribute('aria-invalid',String(!Number.isFinite(p[key])||p[key]<E.limits[key][0]||p[key]>E.limits[key][1]));}
    $('guide-width').textContent=Number.isFinite(p.signW)?`가로 ${num(p.signW/1000,3)}m`:'가로';$('guide-height').textContent=Number.isFinite(p.signH)?`${num(p.signH/1000,3)}m`:'세로';$('guide-bottom').textContent=Number.isFinite(p.bottom)?`${num(p.bottom)}m`:'하단';
    const validQty=Number.isInteger(p.qty)&&p.qty>=1&&p.qty<=(p.installMode==='shared'?32:1000);
    $('support-counts').textContent=validQty?`전광판 ${supports.boards}대 · 기초 ${p.qty}개 · 기둥 ${supports.known?supports.total+'본':'수량 미지정'}`:'기초 수량을 올바르게 입력하세요.';
    $('quantity-help').textContent=p.installMode==='shared'?supports.shared?'한 전광판 아래 기둥과 기초를 함께 늘립니다. 기초별 하중 분배는 미검토이며, 기초 치수를 직접 입력해 물량·배근 초안을 계산합니다.':'수량을 늘리면 이 전광판 아래 기둥과 기초가 함께 늘어납니다. 독립 1주 형식은 기초 1개당 기둥 1본입니다.':'같은 전광판 설치를 반복합니다. 화면 그림은 설치 1개 기준이고 전체 물량은 입력 수량만큼 합산됩니다.';
    $('edit-multi-foundation').hidden=!supports.shared;
    const guideCount=p.installMode==='shared'&&validQty?p.qty:1,per=supports.known?supports.perFoundation:0;
    const guideParts=[];
    for(let i=0;i<guideCount;i++){
      const x=guideCount===1?154:87+i*133/(guideCount-1),footWidth=Math.min(30,Math.max(3,125/guideCount));
      for(let j=0;j<per;j++){
        const colX=x+(j-(per-1)/2)*Math.min(12,footWidth/2),colWidth=Math.max(1.2,Math.min(8,footWidth/(per+1)));
        guideParts.push(`<rect data-guide-column="${i+1}-${j+1}" x="${colX-colWidth/2}" y="125" width="${colWidth}" height="62" fill="#91b5c1"/>`);
      }
      guideParts.push(`<rect data-guide-foundation="${i+1}" x="${x-footWidth/2}" y="185" width="${footWidth}" height="14" rx="1" fill="#c6d9e1" stroke="#68889a"/>`);
    }
    $('guide-columns').innerHTML=guideParts.join('');
    $('size-guide').setAttribute('aria-label',p.installMode==='shared'?`전광판 1대와 기초 ${guideCount}개의 입력 위치 그림`:'전광판 설치 1개 기준의 입력 위치 그림');
    $('ground-status').value=n.groundKnown?'provided':'unknown';$('ground-values').hidden=!n.groundKnown;
    $('ground-note').textContent=n.groundKnown?'입력한 지반자료로 미리 계산합니다. 적용값은 설계자가 확인해야 합니다.':'지반값은 확인 전입니다. 초기 예시값으로 미리 계산하며 결과에 “지반 확인 전”을 표시합니다.';
    const mapped=p.windMode==='regional'&&point;
    $('location-message').textContent=mapped?`${point.name} 기준값을 적용했습니다. 주변 모습도 확인하세요.`:n.windManual?'직접 입력한 풍하중을 사용합니다.':n.windExample?'현재 풍하중 값으로 예시 계산을 합니다.':'지역을 선택하면 바람 조건이 자동으로 입력됩니다.';
    if(windReady())$('location-error').hidden=true;
    $('setup-note').textContent=`현재: ${E.types[p.type].label} · ${p.mode==='auto'?'기초 크기 자동 후보':'기초 크기 직접 입력'} · ${p.rebarMode==='auto'?'철근 자동 초안':'철근 직접 입력'}`;
    $('calculate-simple').disabled=!r;
    $('detail-result').disabled=!r;
    if(!r){
      if(!Number.isFinite(p.signW)||p.signW<100||p.signW>50000)$('error').textContent='화면 가로를 0.1~50m 범위로 입력하세요. 예: 4,000mm는 4m입니다.';
      else if(!Number.isFinite(p.signH)||p.signH<100||p.signH>30000)$('error').textContent='화면 세로를 0.1~30m 범위로 입력하세요. 예: 2,000mm는 2m입니다.';
      $('overview').innerHTML='<div class="overview-note bad">입력 오류를 수정하면 결과가 다시 표시됩니다.</div>';return;
    }
    let headline=!n.groundKnown?'지반 확인 전 · 예비 계산 결과':'입력 조건으로 계산한 기초 후보';
    if(r.supports.shared)headline='전광판 1대 · 다중 기초 수량 초안 / 하중 분배 미검토';
    else if(r.p.type!=='single')headline='자재량 계산 결과 · 구조 검토 필요';
    else if(r.search&&!r.search.found)headline='자동 후보를 찾지 못했습니다 · 표시 치수 재검토';
    else if(!r.screenOK)headline='계산 조건을 충족하지 못했습니다 · 기초 재검토';
    const warning=!!(r.search&&!r.search.found)||!r.screenOK||!E.canScreen(p),c=r.estimate;
    const layoutMessage=r.supports.shared?r.warnings.filter(w=>w.startsWith('기초 중심 간격')||w.startsWith('바깥 기둥')).map(w=>`<p class="layout-warning">${esc(w)}</p>`).join(''):'';
    const geo=`${num(r.g.L/1000,3)} × ${num(r.g.W/1000,3)} × ${num(r.g.H/1000,3)}`;
    $('overview').innerHTML=`<section class="overview-card"><div class="overview-kicker">${mapped?esc(point.name)+' 기준점':n.windManual?'직접 입력한 바람 조건':'바람 조건 예시'} · ${num(p.signW/1000,3)} × ${num(p.signH/1000,3)}m · 전광판 ${r.supports.boards}대 · 기초 ${p.qty}개 · 기둥 ${r.supports.known?r.supports.total+"본":"미지정"}</div><h2>${headline}</h2>${layoutMessage}<div class="foundation-size ${warning?'unresolved':''} "><span>${r.search&&!r.search.found?'자동 후보 없음 · 입력되어 있던 크기':'기초 1개의 가로 × 세로 × 두께'}</span><strong>${geo} <small>m</small></strong><p>${r.g.L.toLocaleString()} × ${r.g.W.toLocaleString()} × ${r.g.H.toLocaleString()} mm${r.search&&!r.search.found?' · 자동 후보가 아닌 수동 입력 치수':''}</p></div><div class="simple-totals"><div><span>콘크리트 주문량</span><b>${num(r.total.orderedConcrete,3)} <small>m³</small></b></div><div><span>철근 주문량</span><b>${num(r.total.rebarGross,1)} <small>kg</small></b></div><div><span>예시 단가의 예상 금액 · VAT 포함</span><b>${api.hasRateErrors()?'단가 확인 필요':num(c.total,0)+'원'}</b></div></div><p class="overview-note ${warning?'bad':''}">${!n.groundKnown?'지반자료 미확인. ':''}${mapped?'지도 기준점의 예비 풍속 적용. ':!n.windManual?'풍하중 미확인·예시값 적용. ':''}${warning?'검토 항목에서 미충족·미검토 내용을 확인하세요. ':'계산된 치수와 철근은 초안입니다. '}시공 전 구조전문가 확인이 필요합니다.</p><details class="assumptions"><summary>미리 계산에 사용한 조건 확인</summary><p>지반 지지력 ${num(p.qa)}kPa · 마찰계수 ${num(p.mu)} · 전광판 ${num(p.panelKgM2)}kg/m² · 지주·프레임 ${num(p.postKg)}kg · 풍압 ${num(r.l.pressure,3)}kPa. 제품 중량·기초 상세·단가에는 초기 예시가 포함될 수 있습니다. 위 숫자는 설치지역만으로 확인되는 값이 아닙니다.</p></details></section>`;
    $('print-context').textContent=`전광판 ${r.supports.boards}대 · 기초 ${p.qty}개 · 기둥 ${r.supports.known?r.supports.total+'본':'미지정'}. ${r.supports.shared?'기초별 반력 분배 미검토. ':''}지반자료: ${n.groundKnown?'사용자가 자료 입력 선택':'미확인 · 예비 계산'}. 풍하중: ${mapped?'지도 기준점 예비값':n.windManual?'사용자 직접 입력':'미확인 또는 예시값'}.`;
    if(step>1&&!windReady()&&(inputMode!=='detailed'||step===3))showStep(inputMode==='detailed'?2:1);
  }
  function preparePrint(){const node=$('reinforcement-drawings'),opened=node?.open;if(node)node.open=true;return ()=>{if(node)node.open=opened;};}
  window.FoundationUX={updated,showStep,getStep:()=>step,getInputMode:()=>inputMode,preparePrint};
  updated(api.getResult());showStep(inputMode==='detailed'?2:1);
})();
