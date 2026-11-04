(function(){
  'use strict';
  const E=CalculatorSuiteEngine,$=id=>document.getElementById(id),KEY='led-integrated-project-v1',copy=E.clone;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
  const frames={frame:$('frame-calculator'),foundation:$('foundation-calculator')},views=['frame','foundation','overview'];
  let frame,foundation,foundationEngine,estimate,view='frame',link=null,massReview=null,installationCounts={},priceReview=null,costReview=null;
  let ready=false,loading=false,syncingName=false,saveTimer,updateTimer,storageWritable=true,countKey=null,countPending=false,aggregateCache=null,candidates=null,previewSource=null;
  const row=(label,value,id='',style='')=>`<div><dt>${label}</dt><dd${id?` id="${id}"`:''}${style?` class="${style}"`:''}>${value}</dd></div>`;
  function message(text,error=false){$('suite-message').innerHTML=text?`<button type="button" data-dismiss aria-label="안내 닫기">×</button>${esc(text)}`:'';$('suite-message').hidden=!text;$('suite-message').classList.toggle('error',error);}
  function valid(){return ready&&!!frame.getResult()&&!!foundation.getResult()&&!foundation.hasRateErrors()&&!countPending;}
  function syncName(value){if(syncingName||!ready)return;syncingName=true;try{const input=String(value).slice(0,80),name=input.trim()||'전광판 통합 프로젝트';$('suite-name').value=input;frame.setName(name);foundation.setProjectName(name);}finally{syncingName=false;}}
  function commitCount(){
    if(!countPending)return;const raw=$('installation-count').value,n=Number(raw);
    if(!raw||!Number.isInteger(n)||n<1||n>1000){$('installation-count').setAttribute('aria-invalid','true');throw Error('반복 설치 횟수는 1~1,000의 정수로 입력하세요.');}
    if(countKey)installationCounts[countKey]=n;countPending=false;$('installation-count').removeAttribute('aria-invalid');aggregateCache=null;
  }
  function flush(){frame.flush();foundation.flush();commitCount();}
  function capture(){
    flush();if(!valid())throw Error('두 계산기의 치수·중량·단가 입력 오류를 먼저 수정하세요.');
    const f=foundation.snapshot();installationCounts=E.cleanCounts(installationCounts,f);
    return {format:'led-integrated-project',version:1,name:$('suite-name').value.trim()||'전광판 통합 프로젝트',view,frame:frame.getProject(),foundation:copy(f),link:copy(link),massReview:copy(massReview),installationCounts:copy(installationCounts),priceReview:copy(priceReview),costReview};
  }
  function saveLocal(){
    if(!ready||loading||!storageWritable)return;
    try{const state=capture();localStorage.setItem(KEY,JSON.stringify(state));$('suite-save-status').textContent='자동 저장 · '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});}
    catch(error){$('suite-save-status').textContent=valid()?'자동 저장 실패 · 작업 파일로 보관하세요':'입력 확인 필요 · 마지막 정상 저장본 유지';}
  }
  function scheduleSave(){if(loading)return;clearTimeout(saveTimer);saveTimer=setTimeout(saveLocal,450);}
  function aggregate(f){const source=JSON.stringify({foundation:f,installationCounts});if(aggregateCache?.source===source)return aggregateCache.value;const value=E.aggregate(f,foundationEngine,estimate,installationCounts);aggregateCache={source,value};return value;}
  function priceState(f,total){
    const source=JSON.stringify(f.prices),review=priceReview?.source===source?priceReview:null;
    const missing=total.unpriced.filter(q=>!review?.included.includes(q.id)),confirmed=review?.confirmed===true;
    const label=foundation.hasRateErrors()?'단가 입력 오류':missing.length?`단가 미입력 · 0원 항목 ${missing.length}개`:confirmed?'현장 단가 확인됨':'예시 단가 · 현장 확인 필요';
    return {source,review,missing,confirmed,label,complete:confirmed&&!missing.length&&!foundation.hasRateErrors()};
  }
  function currentLink(r,f){if(!r)return {patch:null,synced:false};const patch=E.transfer(r,foundationEngine.limits,{keepProduct:link?.keepProduct===true});return {patch,synced:!!foundation.getResult()&&E.isLinked(link,frame.getProject(),patch,f)};}
  function massSource(r,patch){
    // Keep confirmation tied to the registered components as well as their total.
    const p=frame.getProject(),text=JSON.stringify({cabinet:p.cabinet,extras:p.extras,accessories:p.accessories});let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
    return E.fingerprint(p,patch)+'|components:'+hash;
  }
  function massState(r,f){
    try{const linked=currentLink(r,f),source=massSource(r,linked.patch),review=linked.synced&&massReview?.source===source?massReview:null;
      const missing=[['product','전광판 제품·캐비닛'],['posts','지주·프레임'],['accessories','판재·앵커·장비']].filter(([key])=>!review?.[key]).map(([,name])=>name);
      return {label:missing.length?'중량 확인 필요':'등록 중량 구성 확인됨',missing,source,synced:linked.synced};
    }catch{return {label:'중량 확인 필요',missing:['구조물 입력·연동값'],source:null,synced:false};}
  }
  function costSource(r,total,prices){return JSON.stringify({cost:r?.costs,accessories:r?.accessories,foundation:total.cost,boards:total.boards,items:total.items.map(x=>[x.key,x.repeats,x.total]),prices:prices.source,included:prices.review?.included||[]});}
  function combinedCost(r,total,prices){return r?.costs.total!==null&&Number.isFinite(r?.costs.total)&&prices.complete&&costReview===costSource(r,total,prices)?r.costs.total+total.cost:null;}
  function overview(r,f){
    const item=f.project.items[f.project.active],current=foundation.getResult(),mass=massState(r,f),data=E.dataStatus(item),s=E.effectiveStatus(E.status(current,foundationEngine),data,mass.missing),ratesInvalid=foundation.hasRateErrors(),gov=E.governing(current),uplift=E.upliftReference(current,foundationEngine);
    let total,error;if(!current)error='현재 기초 입력 오류를 먼저 수정하세요. 오류가 있는 동안 이전 전체 물량은 표시하지 않습니다.';else try{total=aggregate(f);}catch(e){error=e.message;}
    const price=total?priceState(f,total):null,combined=total?combinedCost(r,total,price):null;
    const a=r?row('가로 × 세로',fmt(r.general.width)+' × '+fmt(r.general.height)+' mm')+row('제작 수량',fmt(r.general.quantity,0)+'대')+row('완성품 대당 중량',fmt(r.totalWeight/r.general.quantity,3)+' kg')+row('제작 전체 중량',fmt(r.totalWeight,3)+' kg')+row('신규 원자재 구매',fmt(r.purchase.purchaseCount,0)+'본'+(r.purchase.status==='ready'?'':' · 일부 미충족'))+row('구조물 입력 금액',r.costs.total===null?'단가 미입력 · 미확정':fmt(r.costs.total,0)+'원','',r.costs.total===null?'pending-value':'cost'):'<p>구조물 입력 오류를 수정하면 요약이 표시됩니다.</p>';
    const b=current?row('현재 기초 항목',esc(item.name))+row('푸팅 가로 × 세로 × 두께',fmt(current.g.L)+' × '+fmt(current.g.W)+' × '+fmt(current.g.H)+' mm')+row('배치 1회 수량','전광판 '+fmt(current.supports.boards,0)+'대 · 기초 '+fmt(current.p.qty,0)+'개')+row('현재 배치 반복 횟수',fmt(installationCounts[E.itemKey(item,f.project.active)]??1,0)+'회')+row('배치 1회 기둥',current.supports.known?fmt(current.supports.total,0)+'본':'미지정')+(gov?row('지배 조건 (사용률)',esc(gov.label)+' · '+fmt(gov.ratio,2),'governing-check'):'')+(foundationEngine.canScreen(current.p)?row('강도 검토 하중조합',`${fmt(current.p.deadFactor,2)}D + ${fmt(current.p.windFactor,2)}W (입력값)`):''):'<p>기초 입력 오류를 수정하면 요약이 표시됩니다.</p>';
    const upliftNote=uplift?`<div id="uplift-reference" class="status" data-state="${uplift.pass?'confirmed':'pending'}"><strong>참고 · 0.9D + ${fmt(uplift.windFactor,2)}W 계수하중 전면 접지 ${fmt(uplift.kern,2)} / 1.00</strong><br>자중이 유리하게 작용하는 조합의 참고값이며 치수 선정에는 반영하지 않았습니다. 적용 하중조합은 구조 담당자가 확정하세요.</div>`:'';
    let html=`<article class="overview-card"><h3>구조물 제작</h3><dl>${a}</dl><div id="weight-review-status" class="status" data-state="${mass.missing.length?'pending':'confirmed'}"><strong>${mass.label}</strong>${mass.missing.length?'<br>'+esc(mass.missing.join(' · ')):''}${!mass.synced?'<br>구조물 값을 현재 기초에 적용하거나 변경값을 다시 확인하세요.':''}</div><p>등록되지 않은 제품·지주·부속의 무게는 포함되지 않습니다. 실제 설치 중량과 구성 내역을 확인하세요.</p><button type="button" data-view="frame">구조물 입력·산출표</button></article><article class="overview-card"><h3>현재 기초 · 검토 상태</h3><div id="foundation-status" class="status" data-state="${s.code}"><strong>${s.label}</strong><br>${s.detail}</div><div id="foundation-data-status" class="status" data-state="${data.length?'pending':'confirmed'}">${data.length?esc(data.join(' · ')):'지반·풍하중 입력 확인 표시됨'}</div><dl>${b}</dl>${upliftNote}<button type="button" data-view="foundation">기초 입력·검토 표</button></article>`;
    if(total){
      const mismatch=r&&r.general.quantity!==total.boards;
      html+=`<article class="overview-card wide"><h3>전체 설치 · 주문 물량</h3><dl>${row('전체 전광판 설치',''+fmt(total.boards,0)+'대','project-boards')}${row('전체 기초',fmt(total.foundations,0)+'개','project-foundations')}${row('전체 기둥',fmt(total.posts,0)+'본'+(total.unknownPosts?' · 미지정 항목 포함':''))}${row('콘크리트 주문량',fmt(total.concrete,3)+' m³','project-concrete')}${row('철근 주문량',fmt(total.rebar,3)+' kg','project-rebar')}${row('앵커볼트',fmt(total.anchors,0)+'조')}</dl>${mismatch?`<div class="status">제작 ${fmt(r.general.quantity,0)}대 · 설치 ${fmt(total.boards,0)}대 — 수량이 다릅니다. 각 항목의 배치 수량과 반복 횟수를 확인하세요.</div>`:''}<p>각 기초 배치의 물량 × 반복 횟수를 합산했습니다. 기초별 하중·배근 검토는 배치 1회 조건입니다. 기초 화면의 개별 도면·출력은 1회 기준입니다.</p><div class="table-scroll"><table><thead><tr><th scope="col">기초 항목</th><th scope="col">배치 × 반복</th><th scope="col">전체 물량</th><th scope="col">계산·자료 상태</th><th scope="col">입력 금액</th></tr></thead><tbody>${total.items.map(x=>`<tr><td>${esc(x.name)}</td><td>전광판 ${x.r.supports.boards}대 · 기초 ${x.r.p.qty}개<br>× ${x.repeats}회</td><td>콘크리트 ${fmt(x.concrete,3)} m³<br>철근 ${fmt(x.rebar,3)} kg</td><td><span class="state-chip" data-state="${E.effectiveStatus(x.status,x.data).code}">${E.effectiveStatus(x.status,x.data).label}</span><small>${esc(x.data.join(' · ')||'자료 확인 표시됨')}</small></td><td class="numeric">${ratesInvalid?'단가 오류 · 금액 미확정':fmt(x.total,0)+'원'}<small>입력 세율 포함</small></td></tr>`).join('')}</tbody></table></div></article>`;
      html+=`<article class="overview-card"><h3>단가 · 기초 금액 확인</h3><div id="foundation-price-status" class="status" data-state="${price.complete?'confirmed':'pending'}"><strong>${price.label}</strong>${price.missing.length?'<br>'+esc(price.missing.map(x=>x.name).join(' · ')):''}</div><dl>${row('기초 금액 소계',ratesInvalid?'단가 오류 · 금액 미확정':fmt(total.subtotal,0)+'원')}${row('기초 입력 세율 적용액',ratesInvalid?'단가 오류 · 금액 미확정':fmt(total.vat,0)+'원')}${row('전체 기초 입력 금액',foundation.hasRateErrors()?'단가 오류 · 금액 미확정':fmt(total.cost,0)+'원','project-cost','cost')}</dl><div class="check-list"><label class="check-line"><input id="prices-confirmed" type="checkbox" ${price.confirmed?'checked':''}>현장 단가를 확인했습니다</label>${total.unpriced.map(x=>`<label class="check-line"><input id="price-included-${esc(x.id)}" type="checkbox" data-included-price="${esc(x.id)}" ${price.review?.included.includes(x.id)?'checked':''}>${esc(x.name)} 0원: 다른 공종 포함·무상 확인</label>`).join('')}</div><p>초기 단가는 예시입니다. 0원 항목은 금액 합계에서 제외됩니다. 단가를 변경하면 확인 표시를 다시 설정해야 합니다.</p></article><article class="overview-card"><h3>합산 금액 · 중복 확인</h3><dl>${row('입력 금액 합산',combined===null?'비용 확인 후 표시':fmt(combined,0)+'원','combined-cost','cost')}</dl><label class="check-line"><input id="cost-confirmed" type="checkbox" ${costReview===costSource(r,total,price)?'checked':''}>판재·앵커·운반 등 비용의 중복을 확인했습니다</label><p>구조물 단가와 현장 기초 단가를 입력·확인하고 중복 검토를 표시하면 합산합니다. 각 계산기에 입력한 세율을 포함한 합계이며 최종 견적은 별도로 확정하세요.</p><p>제작 ${r?fmt(r.general.quantity,0):'—'}대 / 설치 ${fmt(total.boards,0)}대${mismatch?' · 수량 확인 필요':''}</p></article>`;
    }else html+=`<article class="overview-card wide"><h3>전체 설치 물량</h3><div class="status">전체 항목 입력 확인 필요: ${esc(error)}</div></article>`;
    const explanation=current?`${current.p.mode==='auto'?(current.search?.found?'자동 탐색에서 조건을 충족한 후보 중 콘크리트량이 작은 치수를 선택했습니다.':'자동 후보 없음: 표시 치수는 기존 수동 치수입니다. 치수 재검토가 필요합니다.'):'수동 치수로 고정되어 있습니다. 하중·지반 조건을 바꿔도 치수를 다시 찾지 않습니다.'} 선택 치수 ${fmt(current.g.L)} × ${fmt(current.g.W)} × ${fmt(current.g.H)} mm. 자동 탐색은 100mm 단계와 기존 최소 치수·상한·검토 조건을 사용합니다.`:'기초 입력을 수정하면 치수 선택 근거를 확인할 수 있습니다.';
    const restoreAuto=current&&current.p.mode==='manual'&&foundationEngine.canScreen(current.p)?'<button id="restore-auto" type="button">자동 치수 탐색으로 되돌리기</button>':'';
    html+=`<article class="overview-card wide"><h3>기초 치수 선택 · 인접 후보 비교</h3><p id="candidate-explanation">${esc(explanation)}${gov?' 지배 조건: '+esc(gov.label)+'(사용률 '+fmt(gov.ratio,2)+', 1 이하 충족).':''}</p>${restoreAuto}<p>현재 두께와 ±100mm의 후보를 같은 하중·지반·단가로 비교합니다. 콘크리트량·철근량·입력 금액과 예비 계산 조건을 확인할 수 있습니다.</p><button id="compare-candidates" type="button" ${!current||!foundationEngine.canScreen(current.p)?'disabled':''}>두께별 후보 3개 비교</button><div id="candidate-results"></div></article>`;
    const focus=document.activeElement?.id;$('suite-overview').innerHTML=html;if(focus&&$(focus))$(focus).focus({preventScroll:true});$('report-title').textContent=($('suite-name').value.trim()||'전광판 통합 프로젝트')+' · 전체 요약';renderCandidates();
  }
  function update(){
    if(!ready||loading)return;const r=frame.getResult(),f=foundation.snapshot(),item=f.project.items[f.project.active],key=E.itemKey(item,f.project.active);
    if(countKey!==key){try{commitCount();}catch(e){message(e.message,true);}countKey=key;countPending=false;$('installation-count').removeAttribute('aria-invalid');}
    if(!countPending&&document.activeElement!==$('installation-count'))$('installation-count').value=installationCounts[key]??1;
    for(const id of ['suite-save','suite-xlsx','suite-csv','suite-print'])$(id).disabled=!valid();$('suite-transfer').disabled=!r;$('match-installations').disabled=!r;
    $('transfer-size').textContent=r?fmt(r.general.width)+' × '+fmt(r.general.height)+' mm':'입력 확인 필요';$('transfer-weight').textContent=r?fmt(r.totalWeight/r.general.quantity,3)+' kg':'—';$('transfer-quantity').textContent=r?fmt(r.general.quantity,0)+'대':'—';
    const node=$('suite-link-status');try{const {synced}=currentLink(r,f);node.dataset.state=synced?'linked':link?'stale':'unlinked';node.textContent=synced?'현재 기초에 구조물 값 적용됨':link?'값 변경됨 · 다시 적용하세요':'구조물 값을 기초에 적용할 수 있습니다.';$('suite-transfer').dataset.state=node.dataset.state;const labels=synced?['기초 적용됨 ✓ 다시 확인','적용됨 ✓']:link?['변경값 기초에 다시 적용 →','다시 적용 →']:['기초 적용값 확인 →','기초 적용 →'];$('suite-transfer').innerHTML=`<span class="long">${labels[0]}</span><span class="short" aria-hidden="true">${labels[1]}</span>`;}catch(error){node.dataset.state='stale';node.textContent=error.message;$('suite-transfer').disabled=true;}
    if(!valid())$('suite-save-status').textContent='입력 확인 필요 · 마지막 정상 저장본 유지';overview(r,f);
  }
  function changed(){if(loading)return;clearTimeout(updateTimer);updateTimer=setTimeout(()=>{update();scheduleSave();},30);}
  function showView(next){if(!views.includes(next))return;if(ready){try{flush();}catch(e){message(e.message,true);}}view=next;document.body.dataset.view=next;for(const name of views){$('panel-'+name).hidden=name!==next;$('tab-'+name).setAttribute('aria-selected',String(name===next));$('tab-'+name).tabIndex=name===next?0:-1;}if(ready){update();scheduleSave();}}
  function transferWarnings(r,p,keepProduct){
    const q=r.general.quantity,current=p.signW*p.signH/1e6*p.panelKgM2+p.postKg+p.extraKg,product=r.cabinetWeight/q,posts=(r.frameWeight+r.accessoryWeight)/q;
    const next=keepProduct?r.totalWeight/q-product+r.general.width*r.general.height/1e6*p.panelKgM2:r.totalWeight/q,list=[];
    if(product<=0&&!keepProduct)list.push('구조물에 전광판 제품·캐비닛 중량이 없습니다(0kg). 그대로 적용하면 기초 상부 중량에서 제품 무게가 빠집니다.');
    if(posts<=0)list.push('지주·프레임 중량이 0kg입니다.');
    if(current>0&&next<current*0.5)list.push(`대당 설치 중량이 ${fmt(current,3)} kg → ${fmt(next,3)} kg으로 ${fmt((1-next/current)*100,0)}% 줄어듭니다. 빠진 무게가 없는지 확인하세요.`);
    return {list,next};
  }
  function renderTransferState(){
    const r=frame.getResult(),f=foundation.snapshot(),p=f.project.items[f.project.active].p,keep=$('keep-product').checked,w=transferWarnings(r,p,keep);
    $('transfer-warnings').innerHTML=w.list.length?`<strong>적용 전 확인</strong><ul>${w.list.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';$('transfer-warnings').hidden=!w.list.length;
    $('transfer-next-weight').textContent=fmt(w.next,3)+' kg';
    const unchecked=['product','posts','accessories'].filter(k=>!$('mass-'+k).checked).length;
    $('transfer-confirm').textContent=unchecked||w.list.length?`확인 항목 ${unchecked+w.list.length}개를 남기고 적용`:'확인한 값을 현재 기초에 적용';
    $('transfer-confirm').classList.toggle('caution',!!(unchecked||w.list.length));
  }
  function prepareTransfer(){
    flush();if(!valid())throw Error('입력 오류를 먼저 수정하세요.');const r=frame.getResult(),f=foundation.snapshot(),item=f.project.items[f.project.active],patch=E.transfer(r,foundationEngine.limits),p=item.p;
    previewSource=massSource(r,patch);const review=massReview?.source===previewSource?massReview:null,q=r.general.quantity,product=r.cabinetWeight/q;
    $('transfer-preview').innerHTML=`<p><strong>${esc(item.name)}</strong>에 적용합니다. 배치 기초 ${p.qty}개와 현장 조건을 유지합니다.</p><table><thead><tr><th scope="col">항목</th><th scope="col">현재 기초</th><th scope="col">적용 후</th></tr></thead><tbody><tr><th scope="row">크기</th><td>${fmt(p.signW)} × ${fmt(p.signH)} mm</td><td>${fmt(patch.signW)} × ${fmt(patch.signH)} mm</td></tr>${patch.signDepth!==undefined?`<tr><th scope="row">깊이</th><td>${fmt(p.signDepth)} mm</td><td>${fmt(patch.signDepth)} mm</td></tr>`:''}<tr><th scope="row">대당 설치 중량</th><td>${fmt(p.signW*p.signH/1e6*p.panelKgM2+p.postKg+p.extraKg,3)} kg</td><td id="transfer-next-weight"></td></tr></tbody></table><p>구조물 대당 구성: 프레임 ${fmt(r.frameWeight/q,3)} kg · 판재·부속 ${fmt(r.accessoryWeight/q,3)} kg · 제품·캐비닛 ${fmt(product,3)} kg · 기타 장비 ${fmt((r.equipmentWeight-r.cabinetWeight)/q,3)} kg</p>`;
    $('keep-product-text').textContent=`제품 무게를 아직 모릅니다 · 기초의 기존 제품 중량(${fmt(p.panelKgM2,1)} kg/m²)을 유지`;
    $('keep-product').checked=product<=0&&link?.keepProduct===true;$('keep-product').closest('label').hidden=product>0;
    for(const key of ['product','posts','accessories'])$('mass-'+key).checked=!!review?.[key];renderTransferState();$('transfer-dialog').showModal();
  }
  function applyFrame(flags={}){
    flush();if(!valid())throw Error('입력 오류를 먼저 수정하세요.');const r=frame.getResult(),keepProduct=flags.keepProduct===true&&r.cabinetWeight<=0,patch=E.transfer(r,foundationEngine.limits,{keepProduct}),next=copy(foundation.snapshot());Object.assign(next.project.items[next.project.active].p,patch);
    const verified=foundation.validateProject(next);foundation.loadProject(verified);link={source:E.fingerprint(frame.getProject(),patch),active:verified.project.active,itemId:verified.project.items[verified.project.active].id,appliedAt:new Date().toISOString(),keepProduct};massReview={source:massSource(r,patch),product:flags.product===true,posts:flags.posts===true,accessories:flags.accessories===true};candidates=null;
    showView('foundation');update();saveLocal();const applied=verified.project.items[verified.project.active].p;message(`현재 기초에 ${fmt(r.general.width)} × ${fmt(r.general.height)} mm와 대당 ${fmt(applied.signW*applied.signH/1e6*applied.panelKgM2+applied.postKg+applied.extraKg,3)} kg을 적용했습니다.${keepProduct?' 제품 중량은 기초의 기존 값을 유지했습니다.':''} 중량 구성 확인 상태는 전체 요약에 표시됩니다.`);return copy(patch);
  }
  function load(raw){
    if(!ready)throw Error('계산기를 준비하고 있습니다.');let verified;
    if(raw?.format==='led-integrated-project')verified=E.validate(raw,frame,foundation);
    else if(raw?.type==='led-frame-project'||raw?.format==='foundation-project'){
      const isFrame=raw.type==='led-frame-project',next=isFrame?frame.validateProject(raw):foundation.validateProject(raw);
      loading=true;try{if(isFrame)frame.loadProject(next);else{foundation.loadProject(next);installationCounts={};priceReview=null;costReview=null;countKey=null;countPending=false;}link=null;massReview=null;candidates=null;aggregateCache=null;syncName(isFrame?next.name:next.project.name);}finally{loading=false;}
      storageWritable=true;showView(isFrame?'frame':'foundation');update();saveLocal();message('기존 '+(isFrame?'구조물':'기초')+' 작업을 불러왔습니다. 연동값과 확인 상태를 다시 확인하세요.');return valid()?capture():null;
    }
    else throw Error('통합 작업 또는 기존 구조물·기초 계산기의 JSON 파일을 선택하세요.');
    loading=true;try{frame.loadProject(verified.frame);foundation.loadProject(verified.foundation);link=verified.link;massReview=verified.massReview;installationCounts=verified.installationCounts;priceReview=verified.priceReview;costReview=verified.costReview;countKey=null;countPending=false;candidates=null;aggregateCache=null;syncName(verified.name);view=verified.view;}finally{loading=false;}
    storageWritable=true;showView(view);update();saveLocal();message('구조물·기초·단가·반복 수량·확인 상태를 함께 불러왔습니다.');return capture();
  }
  function fileDownload(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=($('suite-name').value.trim()||'전광판 통합 프로젝트').replace(/[\\/:*?"<>|]/g,'_')+name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function download(){const state=capture();fileDownload(JSON.stringify(state,null,2),'_구조물_기초_통합.json','application/json;charset=utf-8');saveLocal();message('마지막 입력과 모든 항목의 반복 횟수·확인 상태를 통합 작업 파일에 저장했습니다.');}
  const round=(v,d=3)=>typeof v==='number'&&Number.isFinite(v)?Math.round(v*10**d)/10**d:v;
  const joinNotes=(...parts)=>parts.filter(x=>x&&String(x).trim()).join(' / ');
  function reportSheets(){
    const state=capture(),r=frame.getResult(),total=aggregate(state.foundation),price=priceState(state.foundation,total),mass=massState(r,state.foundation),combined=combinedCost(r,total,price);
    const priceNames={};for(const x of total.items)for(const q of x.cost.rows)if(q.id&&q.name&&!priceNames[q.id])priceNames[q.id]=q.name;
    const statusOf=(x,massMissing=[])=>E.effectiveStatus(x.status,x.data,massMissing);
    const active=total.items[state.foundation.project.active];
    return [{name:'통합요약',rows:[['항목','값','단위'],['프로젝트',state.name,''],['출력 시각',new Date().toLocaleString('ko-KR'),''],['계산기 버전',globalThis.CalculatorSuiteBuild?.label||'',''],['제작 수량',r.general.quantity,'대'],['설치 수량',total.boards,'대'],['전체 기초',total.foundations,'개'],['콘크리트 주문량',round(total.concrete),'m³'],['철근 주문량',round(total.rebar),'kg'],['앵커볼트',total.anchors,'조'],['현재 기초 상태',active?statusOf(active,mass.missing).label:'',''],['등록 중량 확인',joinNotes(mass.label,mass.missing.join(' · ')),''],['기초 단가 상태',joinNotes(price.label,price.missing.map(x=>x.name).join(' · ')),''],['구조물 입력 금액',r.costs.total===null?'단가 미입력':round(r.costs.total,0),'원'],['전체 기초 입력 금액',round(total.cost,0),'원'],['입력 금액 합산',combined===null?'단가·중복 비용 확인 필요':round(combined,0),'원'],['수량 상태',r.general.quantity===total.boards?'제작·설치 수량 일치':'제작·설치 수량 다름',''],['산출 범위','각 배치 물량 × 반복 횟수. 개별 기초 화면·도면·출력은 배치 1회 기준.',''],['계산 범위','제작 물량·중량 및 기초 예비 계산 초안. 지주·앵커·접합부·전체 구조와 현장 지반은 별도 검토.','']]},
      {name:'전체기초항목',rows:[['항목','반복 횟수','전광판(대)','기초(개)','콘크리트 주문(m³)','철근 주문(kg)','입력 금액(원)','계산 상태','자료 상태','치수 L×W×H(mm)','지배 조건(사용률)'],...total.items.map(x=>{const s=statusOf(x),g=E.governing(x.r);return [x.name,x.repeats,x.boards,x.foundations,round(x.concrete),round(x.rebar),round(x.total,0),joinNotes(s.label,s.detail),x.data.join(' · ')||'자료 확인 표시됨',`${x.r.g.L} × ${x.r.g.W} × ${x.r.g.H}`,g?`${g.label} · 사용률 ${round(g.ratio,2)}`:'해당 없음'];})]},
      {name:'기초통합물량',rows:[['공종','단위','전체 수량','산출 근거'],...total.boq.map(q=>[q.name,q.unit,round(q.quantity),q.notes.join(' / ')])]},
      {name:'기초철근',rows:[['기초 항목','반복 횟수','기호','이름','규격','배치 1회 본수','전개 길이(mm)','배치 1회 중량(kg)','전체 본수','전체 중량(kg)','비고'],...total.items.flatMap(x=>x.r.r.rows.map(b=>[x.name,x.repeats,b.code,b.name,'D'+b.bar,b.count*x.r.p.qty,round(b.length,0),round(b.kg*x.r.p.qty),b.count*x.r.p.qty*x.repeats,round(b.kg*x.r.p.qty*x.repeats),b.note])),['','','','할증 전 순물량 기준입니다. 주문량은 기초통합물량의 철근 · 할증 포함 행을 사용하세요.','','','','','','','']]},
      {name:'기초검토',rows:[['기초 항목','검토 항목','요구·작용','성능·기준','판정','설명'],...total.items.flatMap(x=>x.r.checks.map(c=>[x.name,c.label,c.demand===null?'—':round(c.demand),c.capacity===null?'—':round(c.capacity),c.status,c.detail])),...total.items.map(x=>{const u=E.upliftReference(x.r,foundationEngine);return u?[x.name,`참고 · 0.9D + ${u.windFactor}W 계수하중 전면 접지`,round(u.kern),1,u.pass?'참고 충족':'참고 미충족','치수 선정에 반영하지 않은 참고값 · 적용 하중조합은 구조 담당 확정']:null;}).filter(Boolean)]},
      {name:'단가확인',rows:[['항목','단가(원)','확인 상태'],...Object.entries(state.foundation.prices).map(([id,value])=>[priceNames[id]||estimate.labels?.[id]||id,value,value===0?(price.review?.included.includes(id)?'다른 공종 포함·무상 확인':'0원 단가 · 확인 필요'):price.confirmed?'현장 단가 확인':'예시 단가 · 확인 필요'])]},...frames.frame.contentWindow.FrameExport.sheets(state.frame,r)];
  }
  function exportReport(format){const tables=reportSheets();if(format==='xlsx')fileDownload(frames.frame.contentWindow.FrameExport.workbook(tables),'_통합산출서.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');else if(format==='csv'){const csv='\ufeff'+tables.flatMap(s=>[[s.name],...s.rows,[]]).map(row=>row.map(v=>{let x=String(v??'');if(/^[=+@-]/.test(x))x="'"+x;return '"'+x.replaceAll('"','""')+'"';}).join(',')).join('\r\n');fileDownload(csv,'_통합산출서.csv','text/csv;charset=utf-8');}else throw Error('지원하지 않는 산출서 형식입니다.');return tables;}
  function renderCandidates(){
    const node=$('candidate-results');if(!node||!candidates)return;const f=foundation.snapshot(),p=f.project.items[f.project.active].p,now=foundation.getResult(),isCurrent=c=>!!now&&c.g.L===now.g.L&&c.g.W===now.g.W&&c.g.H===now.g.H;
    if(!foundation.getResult()){node.innerHTML='<p class="status">기초 입력 오류를 수정한 뒤 후보를 다시 비교하세요.</p>';return;}
    if(candidates.source!==JSON.stringify({p,prices:f.prices})){node.innerHTML='<p class="status">입력 조건이 변경되었습니다. 후보를 다시 비교하세요.</p>';return;}
    node.innerHTML=`<p>${esc(candidates.note)} (${candidates.evaluated}개 치수 검토)</p><div class="table-scroll"><table><thead><tr><th scope="col">두께</th><th scope="col">후보 치수</th><th scope="col">배치 콘크리트</th><th scope="col">배치 철근</th><th scope="col">배치 입력 금액</th><th scope="col">선택</th></tr></thead><tbody>${candidates.alternatives.map((x,i)=>x.r?`<tr${isCurrent(x.r)?' class="current" aria-current="true"':''}><td>${x.H} mm${isCurrent(x.r)?'<small>현재 치수</small>':''}</td><td>${x.r.g.L} × ${x.r.g.W} × ${x.r.g.H} mm<small>예비 계산 항목 충족</small></td><td>${fmt(x.r.total.orderedConcrete,3)} m³</td><td>${fmt(x.r.total.rebarGross,3)} kg</td><td>${foundation.hasRateErrors()?'단가 오류 · 금액 미확정':fmt(x.estimate.total,0)+'원'}</td><td>${isCurrent(x.r)?'<span class="state-chip" data-state="confirmed">현재 적용 중</span>':`<button type="button" data-apply-candidate="${i}">이 치수로 고정</button>`}</td></tr>`:`<tr><td>${x.H} mm</td><td colspan="5">설정 상한 내 후보 없음 · 치수·조건 검토 필요</td></tr>`).join('')}</tbody></table></div><p>단가 확인 전 금액은 입력값 기준입니다. ‘이 치수로 고정’은 현재 항목을 수동 치수로 바꿉니다. 이후 조건이 바뀌면 ‘자동 치수 탐색으로 되돌리기’로 다시 찾을 수 있습니다.</p>`;
  }
  function safe(action){try{return action();}catch(error){message(error.message,true);update();return null;}}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;if(b.hasAttribute('data-dismiss'))message('');if(b.dataset.view)showView(b.dataset.view);
    if(b.id==='compare-candidates')safe(()=>{flush();const f=foundation.snapshot();candidates=E.compareCandidates(f.project.items[f.project.active].p,foundationEngine,estimate,f.prices);renderCandidates();});
    if(b.dataset.foundationExport)safe(()=>{flush();if(!foundation.getResult())throw Error('기초 입력 오류를 먼저 수정하세요.');const id=b.dataset.foundationExport;b.closest('.project-menu').open=false;if(id==='print')showView('foundation');frames.foundation.contentWindow.document.getElementById(id).click();});
    if(b.id==='restore-auto')safe(()=>{flush();const f=copy(foundation.snapshot());f.project.items[f.project.active].p.mode='auto';foundation.loadProject(f);candidates=null;update();saveLocal();message('자동 치수 탐색으로 되돌렸습니다. 현재 조건에서 다시 찾은 치수를 확인하세요.');});
    if(b.dataset.applyCandidate!==undefined)safe(()=>{flush();const f=copy(foundation.snapshot()),item=f.project.items[f.project.active];if(candidates?.source!==JSON.stringify({p:item.p,prices:f.prices}))throw Error('입력이 변경되었습니다. 후보를 다시 비교하세요.');const c=candidates.alternatives[Number(b.dataset.applyCandidate)]?.r;if(!c)throw Error('적용할 후보가 없습니다.');Object.assign(item.p,{mode:'manual',L:c.g.L,W:c.g.W,H:c.g.H});foundation.loadProject(f);candidates=null;update();saveLocal();message('후보 치수로 고정했습니다(수동 치수). 하중·지반을 바꾸면 자동 탐색으로 되돌려 다시 확인하세요.');});
  });
  $('suite-overview').addEventListener('change',event=>{
    const node=event.target;safe(()=>{const f=foundation.snapshot(),total=aggregate(f),price=priceState(f,total);
      if(node.id==='prices-confirmed'){priceReview={source:price.source,confirmed:node.checked,included:price.review?.included||[]};costReview=null;}
      if(node.dataset.includedPrice){const included=new Set(price.review?.included||[]);node.checked?included.add(node.dataset.includedPrice):included.delete(node.dataset.includedPrice);priceReview={source:price.source,confirmed:price.confirmed,included:[...included]};costReview=null;}
      if(node.id==='cost-confirmed')costReview=node.checked?costSource(frame.getResult(),total,price):null;update();saveLocal();
    });
  });
  $('suite-tabs').addEventListener('keydown',event=>{const tab=event.target.closest('[role="tab"]');if(!tab)return;const i=views.indexOf(tab.dataset.view);let next;if(event.key==='ArrowRight')next=(i+1)%views.length;if(event.key==='ArrowLeft')next=(i+views.length-1)%views.length;if(event.key==='Home')next=0;if(event.key==='End')next=views.length-1;if(next!==undefined){event.preventDefault();showView(views[next]);$('tab-'+views[next]).focus();}});
  $('suite-name').addEventListener('input',()=>{syncName($('suite-name').value);changed();});
  $('installation-count').addEventListener('input',()=>{countPending=true;$('suite-save').disabled=true;});$('installation-count').addEventListener('change',()=>safe(()=>{commitCount();update();saveLocal();}));
  $('match-installations').addEventListener('click',()=>safe(()=>{flush();const f=foundation.snapshot(),total=aggregate(f),current=total.items[f.project.active],remaining=frame.getResult().general.quantity-(total.boards-current.boards),n=remaining/current.r.supports.boards;if(!Number.isInteger(n)||n<1||n>1000)throw Error('현재 배치를 정수 횟수로 반복해 제작 수량과 맞출 수 없습니다. 기초 항목별 배치 수량을 확인하세요.');installationCounts[current.key]=n;update();saveLocal();message('다른 기초 항목을 제외한 제작 잔여 수량에 현재 배치 반복 횟수를 맞췄습니다.');}));
  $('suite-transfer').addEventListener('click',()=>safe(prepareTransfer));$('transfer-cancel').addEventListener('click',()=>$('transfer-dialog').close());
  $('transfer-confirm').addEventListener('click',()=>safe(()=>{flush();const r=frame.getResult(),patch=E.transfer(r,foundationEngine.limits);if(previewSource!==massSource(r,patch))throw Error('구조물 값이 변경되었습니다. 적용값을 다시 확인하세요.');const flags={keepProduct:$('keep-product').checked};for(const key of ['product','posts','accessories'])flags[key]=$('mass-'+key).checked;applyFrame(flags);$('transfer-dialog').close();}));
  $('transfer-dialog').addEventListener('change',()=>safe(renderTransferState));
  $('suite-save').addEventListener('click',()=>safe(download));$('suite-load').addEventListener('click',()=>$('suite-file').click());
  $('suite-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('10MB 이하 작업 JSON을 선택하세요.');load(JSON.parse(await file.text()));}catch(error){message('불러오기 실패: '+error.message+' 기존 작업을 유지합니다.',true);}finally{event.target.value='';}});
  $('suite-new').addEventListener('click',()=>safe(()=>{download();const fresh={format:'foundation-project',version:1,project:{name:'새 전광판 통합 작업',active:0,items:[{name:'기초 1',p:copy(foundationEngine.defaults)}]},prices:{...estimate.defaultPrices}};load({format:'led-integrated-project',version:1,name:'새 전광판 통합 작업',view:'frame',frame:frames.frame.contentWindow.FramePlanner.createProject(),foundation:fresh,link:null});$('suite-new').closest('.project-menu').open=false;message('이전 작업을 백업 파일로 저장하고 새 작업을 시작했습니다.');}));
  $('suite-xlsx').addEventListener('click',()=>safe(()=>exportReport('xlsx')));$('suite-csv').addEventListener('click',()=>safe(()=>exportReport('csv')));$('suite-print').addEventListener('click',()=>safe(()=>{capture();showView('overview');update();window.print();}));
  function initialize(){
    if(!frame||!foundation||ready)return;ready=true;$('suite-loading').hidden=true;const build=globalThis.CalculatorSuiteBuild;if(build?.label){$('suite-build').textContent=build.label;$('suite-build-menu').textContent=build.label;}$('suite-load').disabled=false;$('suite-new').disabled=false;
    window.CalculatorSuite={snapshot:capture,load,applyFrame,showView,reportSheets,exportReport,getState:()=>({ready,view,linked:$('suite-link-status').dataset.state==='linked'}),getFrame:()=>frame,getFoundation:()=>foundation};
    let saved;try{saved=localStorage.getItem(KEY);}catch{storageWritable=false;}
    if(saved){try{load(JSON.parse(saved));}catch(error){storageWritable=false;message('저장된 통합 작업을 읽지 못했습니다. 기존 저장본을 보존합니다. '+error.message,true);}}
    else syncName($('suite-name').value);update();if(storageWritable)scheduleSave();
  }
  for(const name of ['frame','foundation']){const node=frames[name];node.addEventListener('load',()=>{try{const child=node.contentWindow;if(name==='frame'){frame=child.FrameUI;if(!frame)throw Error('구조물 계산기를 준비하지 못했습니다.');}else{foundation=child.FoundationUI;foundationEngine=child.FoundationEngine;estimate=child.FoundationEstimate;if(!foundation)throw Error('기초 계산기를 준비하지 못했습니다.');}
    child.addEventListener('calculatorchange',changed);for(const type of ['change','input'])child.document.addEventListener(type,event=>{if(!loading&&(event.target.id==='projectName'||event.target.id==='project-name'))syncName(event.target.value);changed();});initialize();
  }catch(error){$('suite-loading').textContent='계산기를 불러오지 못했습니다. 통합 HTML 파일을 다시 열어주세요.';message(error.message,true);}});node.srcdoc=CalculatorSuiteSources[name];}
  window.addEventListener('beforeunload',saveLocal);window.addEventListener('pagehide',saveLocal);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveLocal();});
})();
