'use strict';
const P=globalThis.FramePlanner,E=globalThis.FrameExport,$=id=>document.getElementById(id);
const esc=E.xml,n=(x,d=2)=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
const uid=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
// The copy embedded in the integrated calculator keeps its own key so it never overwrites the standalone frame calculator.
const KEY=globalThis.LED_SUITE_EMBEDDED===true?'led-suite-frame-projects-v5':'led-frame-projects-v5';let db={projects:[],activeId:null},project=P.createProject(),result=null,tab='design',selectedFace='front',selectedMaterial=null,selectedSplice=null,saveTimer;
const countDrafts=new Map(),detailStates=new Map();let countDraftProject=project.id,rendering=false;
const invalidCount=input=>input.value===''||!Number.isInteger(Number(input.value))||Number(input.value)<0||Number(input.value)>100;
function rememberCountDrafts(){
 if(countDraftProject!==project.id){countDrafts.clear();detailStates.clear();countDraftProject=project.id;return;}
 document.querySelectorAll('[data-count]').forEach(input=>{const path=input.dataset.count;if(invalidCount(input))countDrafts.set(path,{value:input.value,label:input.dataset.label||'보강재 개수'});else countDrafts.delete(path);});
 document.querySelectorAll('#content details[id]').forEach(details=>detailStates.set(details.id,details.open));
}
function clearCountDrafts(){countDrafts.clear();detailStates.clear();countDraftProject=null;}
function loadDatabase(){try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed.projects))throw Error('목록 형식');db=parsed;const saved=db.projects.find(x=>x.project.id===db.activeId);if(saved)project=P.migrate(saved.project);}}catch{notice('저장된 프로젝트를 읽지 못했습니다. 새 계산을 시작하며 기존 저장 데이터는 덮어쓰지 않습니다.',true);db={projects:[],activeId:null};storageWritable=false;}}
let storageWritable=true;
const get=path=>path.split('.').reduce((o,k)=>o?.[k],project);
function put(path,value){const keys=path.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw Error('허용하지 않는 입력입니다.');let o=project;for(const k of keys.slice(0,-1))o=o[k];o[keys.at(-1)]=value;}
function notice(message,error=false){$('notice').textContent=message;$('notice').hidden=!message;$('notice').className=error?'notice error':'notice';}
function saveNow(){if(!result||!storageWritable)return;const record=db.projects.find(x=>x.project.id===project.id);const entry={project:P.clone(project),updated:new Date().toISOString(),baseline:record?.baseline||null,history:record?.history||[]};if(record)db.projects[db.projects.indexOf(record)]=entry;else db.projects.push(entry);db.activeId=project.id;try{localStorage.setItem(KEY,JSON.stringify(db));$('saveStatus').textContent='이 기기에 자동 저장 · '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});}catch{$('saveStatus').textContent='자동 저장 실패 · JSON 파일로 저장하세요';}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,600);}
function fieldRule(path){
 const rules=[
  [/^general\.(width|height|depth)$/,100,100000],[/^general\.quantity$/,1,1000,true],[/^general\.extraEquipment$/,0,1e6],
  [/^cabinet\.(width|height)$/,1,10000],[/^cabinet\.(columns|rows)$/,1,101,true],[/^cabinet\.weightEach$/,0,100000],
  [/^cut\.kerf$/,0,20],[/^cut\.(endTrim|overlap)$/,0,1000],
  [/^materials\.\d+\.(face|depth)$/,1,1000],[/^materials\.\d+\.t1$/,0.01,1000],[/^materials\.\d+\.t2$/,0,1000],[/^materials\.\d+\.kgm$/,0.001,10000],
  [/^materials\.\d+\.stocks\.\d+\.length$/,100,100000],[/^extras\.\d+\.length$/,1,100000],[/^extras\.\d+\.quantity$/,1,100000,true],
  [/^(front|back|left|right)\.(vertical|horizontal)\.\d+\.position$/,0,100000],
  [/^inventory\.\d+\.length$/,1,100000],[/^inventory\.\d+\.quantity$/,1,1e6,true],[/^inventory\.\d+\.trim$/,0,1000],
  [/^accessories\.\d+\.quantity$/,1,100000,true],[/^accessories\.\d+\.(width|height|thickness)$/,0.01,100000],[/^accessories\.\d+\.density$/,1,30000],[/^accessories\.\d+\.weightEach$/,0,100000],
  [/^cost\.taxRate$/,0,100]
 ];
 const rule=rules.find(([pattern])=>pattern.test(path));
 return rule?{min:rule[1],max:rule[2],integer:!!rule[3]}:{min:0,max:1e9,integer:false};
}
const fieldId=path=>'frame-field-'+path.replace(/\./g,'-');
function field(path,label,options={}){
 const value=Object.hasOwn(options,'value')?options.value:get(path),type=options.type||'number',id=fieldId(path),rule=fieldRule(path);
 const limits=type==='number'?`min="${rule.min}" max="${rule.max}" step="${rule.integer?'1':'any'}" ${options.nullable?'':'required'} inputmode="${rule.integer?'numeric':'decimal'}"`:`maxlength="${/\.(grade|finish)$/.test(path)?60:100}"`;
 return `<label class="field">${esc(label)}<input id="${id}" data-path="${path}" data-label="${esc(label)}" type="${type}" value="${esc(value??'')}" ${limits} ${options.nullable?'data-nullable="true"':''} ${options.disabled?'disabled':''} ${options.placeholder?`placeholder="${esc(options.placeholder)}"`:''}><span id="${id}-error" class="field-error" hidden></span></label>`;
}
function select(path,label,options,attributes={}){const value=get(path);return `<label class="field">${esc(label)}<select id="${fieldId(path)}" data-path="${path}" data-label="${esc(label)}" ${attributes.disabled?'disabled':''}>${options.map(([v,t])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;}
function check(path,label){return `<label class="check"><input id="${fieldId(path)}" type="checkbox" data-path="${path}" ${get(path)?'checked':''}>${esc(label)}</label>`;}
function button(action,label,attrs='',secondary=true){return `<button type="button" data-action="${action}" ${attrs} class="button ${secondary?'secondary':'primary'}">${label}</button>`;}
function materialOptions(){return project.materials.map(m=>[m.id,`${m.name} · ${m.grade} · ${m.finish}`]);}
function refFields(path,label){return `<div class="ref-fields">${select(path+'.materialId',label,materialOptions())}${select(path+'.rotation','방향',[[0,'기본'],[1,'90° 회전']])}</div>`;}
function design(){
 const g=project.general,two=g.planes===2;
 if(!two&&selectedFace!=='front')selectedFace='front';
 if(selectedFace==='back'&&project.backLinked)selectedFace='front';if(selectedFace==='right'&&project.rightLinked)selectedFace='left';
 const f=selectedFace,isSide=['left','right'].includes(f),name={front:'앞면',back:'뒷면',left:'좌측면',right:'우측면'}[f],data=project[f];
 const edges=isSide?['top','bottom']:['left','right','top','bottom'],edgeName={left:'좌측 외곽재',right:'우측 외곽재',top:isSide?'상단 연결재':'상단 외곽재',bottom:isSide?'하단 연결재':'하단 외곽재'};
 const group=axis=>`<section class="subsection"><div class="section-line"><h3>${axis==='vertical'?'세로':'가로'} 보강재 · ${data[axis].length}개${axis==='horizontal'?' 열':''}</h3><div class="count-control"><label>개수 <input type="number" min="0" max="100" step="1" value="${data[axis].length}" id="frame-count-${f}-${axis}" data-count="${f}.${axis}" data-label="${name} ${axis==='vertical'?'세로':'가로'} 보강재 개수"></label></div></div><p class="hint">중심선은 ${axis==='vertical'?'왼쪽':'위쪽'} 바깥면에서의 거리(mm)입니다. 비워 두면 실제 부재 폭을 반영해 균등 배치합니다.</p>${data[axis].length?`<div class="reinforcement-list">${data[axis].map((x,i)=>`<div class="reinforcement"><strong>${axis==='vertical'?'V':'H'} · ${esc(x.id)}</strong>${refFields(`${f}.${axis}.${i}`,'자재')}${field(`${f}.${axis}.${i}.position`,'중심선 (mm)',{nullable:true,placeholder:'자동 배치'})}</div>`).join('')}</div>`:'<p class="empty">보강재가 없습니다. 개수를 입력하면 추가됩니다.</p>'}</section>`;
 return `<div class="design-grid"><section class="panel"><h2>구조물과 전광판</h2><div class="fields">${select('general.planes','구성',[[1,'단면'],[2,'앞뒤 + 좌우 측면']])}${field('general.quantity','제작 수량 (대)')}${field('general.width','가로 (mm)',{disabled:project.cabinet.enabled})}${field('general.height','세로 (mm)',{disabled:project.cabinet.enabled})}${field('general.depth','전체 깊이 (mm)',{disabled:!two})}${field('general.extraEquipment','기타 장비 중량 (kg/대)')}</div>${two?check('general.verticalDepthTies','세로 보강재 위·아래 앞뒤 연결재 자동 추가')+'<p id="frame-depth-tie-info" class="hint"></p>':''}<p class="hint">캐비닛과 판재·부속품은 별도로 합산합니다. 여기에는 그 외 장비만 입력하세요.</p><details><summary>캐비닛으로 크기·중량 계산</summary>${check('cabinet.enabled','캐비닛 치수와 배열로 전체 크기 결정')}<div class="fields">${field('cabinet.width','캐비닛 가로 (mm)')}${field('cabinet.height','캐비닛 세로 (mm)')}${field('cabinet.columns','가로 배열 (열)')}${field('cabinet.rows','세로 배열 (행)')}${field('cabinet.weightEach','개당 중량 (kg)')}</div>${check('cabinet.midHorizontal','가운데 가로재도 배치 (캐비닛 행 경계)')}${button('cabinet-grid','캐비닛 경계에 보강재 배치')}<p class="hint">세로재는 캐비닛 열 경계에 놓고, 가로재는 상·하부만 둡니다. 가운데 가로재는 위 선택을 켤 때만 캐비닛 행 경계에 놓습니다. 버튼을 누르면 현재 앞·뒷면 보강재 배치를 교체합니다.</p></details><details><summary>절단·이음 조건</summary><div class="fields">${field('cut.kerf','톱날 손실 (mm/회)')}${field('cut.endTrim','신규 본당 양끝 정리 합계 (mm)')}${field('cut.overlap','이음부당 겹침 여유 (mm)')}${select('cut.precision','제작 길이 단위',[[0,'원치수 유지'],[0.1,'0.1mm 반올림'],[1,'1mm 반올림']])}${select('cut.objective','혼합 구매 배치 목표',[['bars','본수 줄이기'],['waste','잔재 비율 줄이기'],['cost','비용 줄이기']])}</div><p class="hint">맞댐은 0mm입니다. 반올림한 제작 길이로 중량·구매량을 계산하고 설계 길이와의 차이를 표시합니다.</p></details></section><div><section class="drawing-panel"><div class="section-line"><h2 data-frame-preview-title>배치도와 부재 번호</h2><span>1대 기준 · 도식</span></div>${window.Frame3D?window.Frame3D.markup():''}<div id="diagram" class="frame-flat-diagram"></div></section><section class="panel"><h2>면별 구성</h2>${two?`<div class="link-options">${check('backLinked','뒷면을 앞면과 동일하게')}${check('rightLinked','우측면을 좌측면과 동일하게')}</div>`:''}<div class="face-tabs" role="tablist" aria-label="구조물 편집 면">${['front',...(two?['back','left','right']:[])].map(k=>button('face',{front:'앞면',back:'뒷면',left:'좌측면',right:'우측면'}[k]+((k==='back'&&project.backLinked)||(k==='right'&&project.rightLinked)?' · 연동':''),`data-face="${k}" id="frame-face-${k}" role="tab" aria-controls="frame-face-editor" aria-selected="${f===k}" tabindex="${f===k?0:-1}" ${(k==='back'&&project.backLinked)||(k==='right'&&project.rightLinked)?'aria-disabled="true"':''}`)).join('')}</div><div id="frame-face-editor" role="tabpanel" aria-labelledby="frame-face-${f}" tabindex="-1"><h3>${name} 외곽 · 연결재</h3><div class="fields">${edges.map(k=>refFields(`${f}.${isSide?'':'edges.'}${k}`,edgeName[k])).join('')}</div>${group('vertical')}${group('horizontal')}</div></section></div></div><section class="panel"><div class="section-line"><h2>추가 부재</h2>${button('add-extra','＋ 부재 추가')}</div><p class="hint">상하면 보강재, 대각재, 지주, 받침대 등을 등록하세요. 길이는 제작 도면 기준이며 수량은 대당입니다. 지주는 '기초 지주'를 표시하면 기초의 강재 기둥 검토로 단면이 전달됩니다. 추가 부재는 산출표에 포함되고 배치도에는 생략됩니다.</p>${project.extras.length?project.extras.map((x,i)=>`<div class="editable-row">${field('extras.'+i+'.name','부재명',{type:'text'})}${refFields('extras.'+i,'자재')}${field('extras.'+i+'.length','길이 (mm)')}${field('extras.'+i+'.quantity','수량 (개/대)')}${check('extras.'+i+'.post','기초 지주 · 단면을 기초 기둥 검토로 전달')}${button('remove-extra','삭제',`data-index="${i}"`)}</div>`).join(''):'<p class="empty">추가 등록된 부재가 없습니다.</p>'}</section>`;
}
function materialsView(){
 if(!project.materials.some(m=>m.id===selectedMaterial))selectedMaterial=project.materials[0].id;
 const i=project.materials.findIndex(m=>m.id===selectedMaterial),m=project.materials[i],path='materials.'+i;
 return `<section class="panel"><div class="section-line"><div><h2>자재 규격 · 공급 길이 · 단가</h2><p class="hint">부재와 재고는 같은 자재번호로 연결됩니다. 재질·두께·표면처리가 다르면 별도 자재로 등록하세요.</p></div>${button('add-material','＋ 자재 추가')}</div><div class="material-layout"><div class="material-list">${project.materials.map(a=>`<button data-action="material" data-id="${a.id}" aria-pressed="${a.id===m.id}"><strong>${esc(a.name)}</strong><span>${a.id} · ${esc(a.grade)} · ${esc(a.finish)}</span></button>`).join('')}</div><div><div class="fields three">${field(path+'.name','자재명 / 별칭',{type:'text'})}${select(path+'.section','규격 예시',[...Object.entries(P.legacy.presets).map(([id,p])=>[id,`${P.legacy.families[p.family]} ${p.label}`]),['custom','직접 입력']])}${select(path+'.family','단면 종류',Object.entries(P.legacy.families))}${field(path+'.grade','재질',{type:'text'})}${field(path+'.finish','표면처리',{type:'text'})}${field(path+'.face','기본 방향 정면 폭 b (mm)')}${field(path+'.depth','기본 방향 깊이 폭 d (mm)')}${field(path+'.t1','관 두께 / H 웹 두께 (mm)')}${field(path+'.t2','H 플랜지 두께 (mm, 관은 0)')}${field(path+'.kgm','단위중량 (kg/m)')}${select(path+'.priceMode','단가 기준',[['kg','kg당 단가'],['bar','길이별 본당 단가']])}${field(path+'.pricePerKg','kg당 단가 (원)',{nullable:true,disabled:m.priceMode!=='kg',placeholder:'미입력'})}</div><p class="hint">규격을 직접 변경할 때 단위중량도 실제 공급사 자료에 맞춰 입력하세요. 단가를 비워 두면 미입력으로 표시합니다.</p><div class="fields">${select(path+'.stockMode','구매 길이 사용 방식',[['selected','선택한 한 가지 길이'],['mixed','등록한 길이 혼합 사용']])}${select(path+'.selectedLength','선택 원자재 길이',m.stocks.map(s=>[s.length,n(s.length)+' mm']))}</div><h3>공급 가능한 원자재</h3>${m.stocks.map((s,j)=>`<div class="stock-row">${field(path+'.stocks.'+j+'.length','원자재 길이 (mm)')}${field(path+'.stocks.'+j+'.price','본당 단가 (원)',{nullable:true,disabled:m.priceMode!=='bar',placeholder:'미입력'})}${button('remove-stock','삭제',`data-material="${m.id}" data-index="${j}"`)}</div>`).join('')}${button('add-stock','＋ 공급 길이',`data-material="${m.id}"`)}<div class="section-line small"><span class="hint">사용 중인 자재는 삭제할 수 없습니다.</span>${button('remove-material','이 자재 삭제',`data-id="${m.id}"`)}</div></div></div></section><section class="panel"><div class="section-line"><h2>보유 원자재 · 잔재</h2>${button('add-inventory','＋ 보유 자재 등록')}</div><p class="hint">재계산은 사용 계획만 변경합니다. 창고 보유 수량은 자동 차감하지 않습니다. 짧은 재고부터 사용할 수 있는 조각을 배치합니다.</p>${project.inventory.length?project.inventory.map((x,i)=>`<div class="editable-row inventory-row"><strong>${x.id}</strong>${select('inventory.'+i+'.materialId','자재',materialOptions())}${field('inventory.'+i+'.length','실측 길이 (mm)')}${field('inventory.'+i+'.quantity','보유 수량 (본/개)')}${field('inventory.'+i+'.trim','양끝 정리 합계 (mm)')}${button('remove-inventory','삭제',`data-index="${i}"`)}</div>`).join(''):'<p class="empty">보유 자재를 등록하면 신규 발주량에서 활용분을 반영합니다.</p>'}</section>`;
}
function accessoriesView(){return `<section class="panel"><div class="section-line"><h2>판재 · 부속품</h2><div>${button('add-plate','＋ 판재')}${button('add-hardware','＋ 부속품')}</div></div><p class="hint">대당 수량을 입력합니다. 판재는 치수와 밀도로, 부속품은 개당 중량으로 합산합니다.</p>${project.accessories.map((a,i)=>`<div class="accessory-card"><div class="section-line"><strong>${a.type==='plate'?'판재':'부속품'} · ${a.id}</strong>${button('remove-accessory','삭제',`data-index="${i}"`)}</div><div class="fields three">${field('accessories.'+i+'.name','품명',{type:'text'})}${field('accessories.'+i+'.quantity','대당 수량')}${a.type==='plate'?['width','height','thickness','density'].map((k,j)=>field('accessories.'+i+'.'+k,['가로 (mm)','세로 (mm)','두께 (mm)','밀도 (kg/m³)'][j])).join(''):field('accessories.'+i+'.weightEach','개당 중량 (kg)')}${field('accessories.'+i+'.unitPrice','개당 단가 (원)',{nullable:true,placeholder:'미입력'})}</div></div>`).join('')||'<p class="empty">판재 또는 부속품을 추가하세요.</p>'}</section><section class="panel"><h2>작업 비용과 기타 비용</h2><div class="fields three">${Object.entries({cutFee:'절단 1회당 (원)',spliceFee:'이음 1개소당 (원)',fabrication:'제작비 전체 (원)',painting:'도장비 전체 (원)',transport:'운반비 전체 (원)',other:'기타 전체 (원)',taxRate:'적용 세율 (%)'}).map(([k,l])=>field('cost.'+k,l)).join('')}</div><p class="hint">전체 비용은 제작 대수 전체의 합계로 입력합니다. 재고의 과거 구매비는 신규 견적에서 제외합니다. 톱날 손실이 0mm여도 실제 절단 횟수에 절단비를 반영합니다. 양끝 정리 여유가 있으면 본당 정리 절단 2회를 포함합니다.</p><div id="costBreakdown"></div></section>`;}
function purchaseView(){return `<section class="panel"><h2>구매 수량과 재고 사용</h2><div id="purchaseTables"></div></section><section class="panel"><h2>원자재 길이별 비교</h2><p class="hint">각 비교안은 동일한 최초 재고에서 시작합니다. 단가가 없는 안은 비용을 비교하지 않습니다. 선택 버튼을 누르면 실제 계산에 적용됩니다.</p><div id="comparisons"></div></section><section class="panel"><h2>부재별 연장 설정</h2><p class="hint">자동 분할, 이음 금지, 길이 직접 지정을 선택합니다. 직접 지정은 쉼표로 조각 길이를 나열합니다. 조각 합계에서 이음부 겹침을 뺀 길이가 제작 길이와 같아야 합니다.</p><div id="spliceEditor"></div><div id="extensionTable"></div></section><section class="panel"><h2>절단 작업표</h2><div id="patternTable"></div><p class="hint">참고 배치이며 최소 비용·최소 본수를 보장하지 않습니다. 이음 위치와 접합 방법은 제작 도면으로 확정하세요.</p></section>`;}
function reportView(){return `<section class="panel"><div class="section-line"><h2>산출표와 출력</h2><div class="actions">${button('xlsx','Excel 내려받기')}${button('csv','CSV 내려받기')}<label class="field inline">출력 종류<select id="reportKind"><option value="all">전체 산출서</option><option value="order">발주서</option><option value="cut">절단 작업표</option><option value="quote">견적서</option></select></label>${button('print','PDF / 인쇄','',false)}</div></div><p class="hint">PDF는 인쇄 대화상자에서 ‘PDF로 저장’을 선택하세요. Excel은 입력 조건, 발주서, 부재 산출표, 절단·연장 계획, 재고, 부속품, 견적의 8개 시트입니다.</p><div id="bomTable"></div></section><section class="panel"><h2>판재·장비 중량과 비용</h2><div id="weightDetails"></div><div id="costBreakdown"></div></section><details class="panel"><summary>계산 기준</summary><p>부재 중심선과 실제 단면 폭을 기준으로 맞댐 길이를 산출합니다. 측면 연결재는 해당 앞·뒷면 외곽재 사이 길이이며 공유 외곽재는 중복 집계하지 않습니다. 가로 보강재는 세로 보강재 사이에서 분할됩니다.</p><p>반올림 시 제작 길이로 물량을 산출하므로 설계 길이 차이를 확인하세요. H형강 코핑·플랜지 간섭·접합 상세·용접량과 구조 안전성은 계산 범위에 포함하지 않습니다.</p></details>`;}
function projectsView(){const record=db.projects.find(x=>x.project.id===project.id);return `<section class="panel"><div class="section-line"><h2>프로젝트와 변경 비교</h2><div>${button('new','＋ 새 프로젝트')}${button('duplicate','현재 프로젝트 복제')}${button('baseline','현재 상태를 기준본으로 저장','',false)}</div></div><p class="hint">이 기기의 이 브라우저에 저장됩니다. 다른 기기로 옮기려면 JSON 설정 파일을 사용하세요. 입력 오류가 있는 동안 마지막 정상 저장본을 유지합니다.</p><div id="baselineCompare"></div>${record?.history?.length?`<details><summary>이전 기준본 ${record.history.length}개</summary>${record.history.map((b,i)=>`<div class="saved-row"><span>${new Date(b.at).toLocaleString('ko-KR')}</span>${button('restore-history','이 상태로 복제',`data-index="${i}"`)}</div>`).join('')}</details>`:''}<h3>저장된 프로젝트</h3>${db.projects.map(x=>`<div class="saved-row"><div><strong>${esc(x.project.name)}</strong><span>${new Date(x.updated).toLocaleString('ko-KR')} · ${x.project.general.quantity}대</span></div>${button('open-project',x.project.id===project.id?'현재 프로젝트':'불러오기',`data-id="${x.project.id}"`)}</div>`).join('')||'<p class="empty">첫 정상 계산 후 자동 저장됩니다.</p>'}</section>`;}
function table(head,rows){return `<div class="table-scroll"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>'<tr>'+row.map(cell=>`<td>${cell}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${head.length}" class="empty">해당 항목이 없습니다.</td></tr>`}</tbody></table></div>`;}
function svg(panel,key){
 const scale=Math.min(640/panel.width,290/panel.height),w=panel.width*scale,h=panel.height*scale,x=(740-w)/2,y=48+(290-h)/2,rect=(a,b,c,d,fill,title)=>`<rect x="${a}" y="${b}" width="${Math.max(c,.8)}" height="${Math.max(d,.8)}" fill="${fill}"><title>${esc(title)}</title></rect>`,e=panel.edges;
 let shapes=rect(x,y,e.left.face*scale,h,'#deebf8',key+'-L')+rect(x+w-e.right.face*scale,y,e.right.face*scale,h,'#deebf8',key+'-R')+rect(x+panel.x1*scale,y,(panel.x2-panel.x1)*scale,e.top.face*scale,'#6bc0b3',key+'-T')+rect(x+panel.x1*scale,y+h-e.bottom.face*scale,(panel.x2-panel.x1)*scale,e.bottom.face*scale,'#6bc0b3',key+'-B');
 for(const p of panel.vertical)shapes+=rect(x+p.start*scale,y+panel.y1*scale,(p.end-p.start)*scale,(panel.y2-panel.y1)*scale,'#ffbc6f',key+'-V-'+p.id)+`<text x="${x+p.center*scale}" y="${y+h+20}" text-anchor="middle">V-${esc(p.id)}</text>`;
 for(const p of panel.horizontal){for(const gap of panel.gaps)shapes+=rect(x+gap.start*scale,y+p.start*scale,(gap.end-gap.start)*scale,(p.end-p.start)*scale,'#c1b4e9',key+'-H-'+p.id);shapes+=`<text x="${x+w+7}" y="${y+p.center*scale+4}">H-${esc(p.id)}</text>`;}
 return `<svg viewBox="0 0 740 390" role="img" aria-label="${esc(panel.title)} 배치도, 부재 중심선과 규격 반영"><g font-family="system-ui,sans-serif" font-size="11" fill="#dce8f6"><text x="370" y="22" text-anchor="middle" font-size="17">${esc(panel.title)} · ${n(panel.width)} × ${n(panel.height)} mm</text>${shapes}<text x="${x+panel.x1*scale}" y="${y-9}" fill="#6bc0b3">${key}-T</text><text x="${x+panel.x1*scale}" y="${y+h+39}" fill="#6bc0b3">${key}-B</text><text x="${x-6}" y="${y+h/2}" text-anchor="end">L</text><text x="${x+w+5}" y="${y+h/2+18}">R</text></g></svg>`;
}
function updateOutputs(){
 const disable=!result;document.querySelectorAll('[data-action="xlsx"],[data-action="csv"],[data-action="json"],[data-action="print"]').forEach(x=>x.disabled=disable);
 if(!result){for(const id of ['diagram','purchaseTables','comparisons','extensionTable','patternTable','bomTable','weightDetails','costBreakdown','baselineCompare','spliceEditor'])if($(id))$(id).innerHTML='';$('metrics').innerHTML='<div class="metric"><span>입력값을 확인하면 결과가 표시됩니다.</span></div>';return;}
 const r=result,p=r.purchase,amount=r.costs.total===null?'미확정':n(r.costs.total,0)+' 원';
 $('metrics').innerHTML=`<div class="metric featured"><span>완성 총중량</span><strong>${n(r.totalWeight,1)} <small>kg</small></strong><em>프레임·부속품·전광판 전체</em></div><div class="metric"><span>신규 구매 ${p.status==='ready'?'':'· 일부 미충족'}</span><strong>${n(p.purchaseCount,0)} <small>본</small></strong><em>기본 ${p.baseStockCount} + 연장용 ${p.additionalStockCount}</em></div><div class="metric"><span>보유 자재 활용</span><strong>${n(p.inventoryUsed,0)} <small>본/개</small></strong><em>재고 사용 계획 · 자동 차감 없음</em></div><div class="metric"><span>총비용</span><strong class="money">${amount}</strong><em>${r.costs.complete?'입력 세율 포함':'단가 미입력 또는 조각 미충족'}</em></div>`;
 if($('diagram'))$('diagram').innerHTML=svg(r.panels[selectedFace]||r.panels.front,selectedFace);
 if($('purchaseTables')){
   $('purchaseTables').innerHTML=(p.blocked.length?`<div class="error"><strong>원자재로 충족하지 못한 조각이 있습니다.</strong>${table(['부재','조각 길이','미충족 수량'],p.blocked.map(b=>[esc(b.name),n(b.length)+' mm',b.count]))}<p>이음 금지·수동 분할 길이·재고 수량·공급 길이를 확인하세요. 아래 구매량은 배치 가능한 부분입니다.</p></div>`:'')+table(['자재','신규 기본','연장 추가','신규 합계','재고 사용','신규 중량','금액'],p.groups.map(g=>[esc(g.label),g.baseStockCount,g.additionalStockCount,g.purchaseCount,g.inventoryUsed,n(g.purchaseWeight)+' kg',g.purchaseCost===null?'단가 미입력':n(g.purchaseCost,0)+' 원']))+`<p class="hint">투입 ${n(p.grossLength,3)} m = 배치 완료 재료 ${n(p.allocatedLength,3)} + 톱날 ${n(p.kerfLoss,3)} + 정리 ${n(p.trimLoss,3)} + 잔재 ${n(p.remainder,3)} m. 신규 ${n(p.newLength,3)} m · 보유 ${n(p.inventoryLength,3)} m</p><h3>보유 자재 사용 계획</h3>`+table(['재고번호','자재','길이','보유','사용 계획','미사용'],p.inventoryStatus.map(i=>[esc(i.id),esc(project.materials.find(m=>m.id===i.materialId)?.name),n(i.length)+' mm',i.quantity,i.used,i.remaining]));
 }
 if($('comparisons'))$('comparisons').innerHTML=p.groups.map(g=>`<h3>${esc(g.label)}</h3>`+table(['사용 길이','신규 본수','재고 사용','구매 금액','잔재','이음 개소','적용'],(g.comparisons||[]).map(c=>[c.mode==='mixed'?'혼합':n(c.length)+' mm',c.status==='ready'?c.purchaseCount:'미충족',c.inventoryUsed,c.cost===null?'단가 미입력':n(c.cost,0)+' 원',n(c.remainder,3)+' m',c.joints,button('apply-stock','이 안 선택',`data-id="${g.materialId}" data-mode="${c.mode}" data-length="${c.length||''}" ${c.status!=='ready'?'disabled':''}`)]))).join('');
 if($('extensionTable'))$('extensionTable').innerHTML=table(['부재','제작 길이','수량','1개당 조각','연장 조각 전체','이음 개소'],p.extensions.map(e=>[esc(e.rowId),n(e.length)+' mm',e.count,e.segments.map(s=>n(s.length)+' × '+s.count).join(' + '),n(e.extensionLength,3)+' m',e.totalJoints]));
 if($('patternTable'))$('patternTable').innerHTML=table(['패턴','자재','투입','길이','반복 본수','절단 목록','잔재/본','절단/본'],p.patterns.map((a,i)=>[i+1,esc(a.materialId),a.source==='inventory'?'재고 '+esc(a.sourceId):a.extensionOnly?'연장용 신규':'기본 신규',n(a.length),a.repeat,a.cuts.map(c=>`<div class="cut-item"><b>${esc(c.rowId)}${c.extension?' +연장':''}</b> ${n(c.length)}mm × ${c.count}</div>`).join(''),n(a.remainder,2),a.cutCount]));
 if($('bomTable'))$('bomTable').innerHTML=(r.roundingRows.length?`<p class="notice">${r.roundingRows.length}개 산출 항목의 제작 길이가 반올림되었습니다. 설계 길이 차이를 확인하세요.</p>`:'')+table(['부재번호 / 이름','자재','설계 길이','제작 길이','차이','수량','총길이','중량'],r.rows.map(a=>[`<b>${esc(a.id)}</b><small>${esc(a.name)}</small>`,esc(a.materialLabel),n(a.designLength,3),n(a.length,3),Math.abs(a.delta)<1e-6?'—':n(a.delta,3),a.count,n(a.totalLength,3)+' m',n(a.weight,2)+' kg']));
 if($('weightDetails'))$('weightDetails').innerHTML=table(['구분','전체 중량'],[['구조 부재',n(r.frameWeight,2)+' kg'],['판재·부속품',n(r.accessoryWeight,2)+' kg'],['캐비닛',n(r.cabinetWeight,2)+' kg'],['기타 장비',n(r.equipmentWeight-r.cabinetWeight,2)+' kg']])+table(['부속품','개당 중량','전체 수량','전체 중량'],r.accessories.map(a=>[esc(a.name),n(a.weightEach,3)+' kg',a.count,n(a.weight,3)+' kg']));
 if($('costBreakdown'))$('costBreakdown').innerHTML=table(['비용 항목','금액'],Object.entries({materials:'신규 자재',accessories:'판재·부속품',cutting:'절단 작업',splicing:'이음 작업',fabrication:'제작비',painting:'도장비',transport:'운반비',other:'기타',knownSubtotal:'입력 완료 금액 소계',tax:'입력 세율 적용액',total:'전체 합계'}).map(([k,l])=>[l,r.costs[k]===null?'미확정':n(r.costs[k],0)+' 원']));
 if($('baselineCompare')){const b=db.projects.find(x=>x.project.id===project.id)?.baseline;if(!b)$('baselineCompare').innerHTML='<p class="empty">기준본을 저장하면 이후 규격·수량 변경에 따른 차이를 표시합니다.</p>';else{const a=P.summary(r);$('baselineCompare').innerHTML=`<p class="hint">기준본 ${new Date(b.at).toLocaleString('ko-KR')} · 제작 수량 ${b.summary.quantity}대 → 현재 ${a.quantity}대. 각 프로젝트 전체 수량 기준 비교입니다.</p>`+table(['항목','기준본','현재','변경'],[['weight','총중량 (kg)'],['purchaseCount','신규 본수'],['cost','총비용 (원)'],['length','부재 총길이 (m)']].map(([k,l])=>[l,b.summary[k]===null?'미확정':n(b.summary[k]),a[k]===null?'미확정':n(a[k]),b.summary[k]===null||a[k]===null?'—':n(a[k]-b.summary[k])]))+button('restore-baseline','기준본 상태로 새 프로젝트 복제');}}
}
function renderSplice(){if(!$('spliceEditor')||!result)return;if(!result.rows.some(r=>r.id===selectedSplice))selectedSplice=result.rows[0]?.id;const row=result.rows.find(r=>r.id===selectedSplice);if(!row)return;const s=project.splices[row.id]||{mode:'auto',segments:[]};$('spliceEditor').innerHTML=`<div class="splice-form"><label class="field">대상 부재<select id="spliceTarget">${result.rows.map(r=>`<option value="${r.id}" ${r.id===row.id?'selected':''}>${esc(r.id)} · ${esc(r.name)} · ${n(r.length)} mm</option>`).join('')}</select></label><label class="field">연장 방식<select id="spliceMode">${[['auto','자동 분할'],['none','이음 금지'],['manual','분할 길이 직접 지정']].map(([v,l])=>`<option value="${v}" ${s.mode===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">조각 길이 (mm, 쉼표 구분)<input id="spliceSegments" type="text" value="${esc(s.segments.join(', '))}" placeholder="예: 4950, 4950" ${s.mode!=='manual'?'disabled':''}></label>${button('save-splice','분할 설정 적용','',false)}${button('clear-splice','자동으로 복원')}</div><p class="hint">선택 부재: ${n(row.length,3)}mm × ${row.count}개. 배열 위치·폭을 변경하면 대상 구간이 달라질 수 있습니다.</p>`;}
let currentIssue=null;
const observedInputs=new WeakMap();
const controlValue=input=>input.type==='checkbox'?input.checked:input.value;
function rememberInputs(){document.querySelectorAll('[data-path],[data-count],#projectName').forEach(input=>observedInputs.set(input,controlValue(input)));}
function inputIssues(){
 rememberCountDrafts();
 const issues=[];
 document.querySelectorAll('[data-path],[data-count]').forEach(input=>{
  if(input.disabled||input.type!=='number')return;
  const path=input.dataset.path,count=input.dataset.count,rule=count?{min:0,max:100,integer:true}:fieldRule(path),value=input.value;
  if(value===''&&input.dataset.nullable)return;
  const number=value===''?NaN:Number(value);
  if(!Number.isFinite(number)||number<rule.min||number>rule.max||(rule.integer&&!Number.isInteger(number))){
   const label=input.dataset.label||(count?'보강재 개수':'입력값');
   issues.push({message:`${label}: ${rule.min.toLocaleString('ko-KR')}~${rule.max.toLocaleString('ko-KR')}${rule.integer?'의 정수':''}를 입력하세요.`,paths:path?[path]:[],counts:count?[count]:[]});
  }
 });
 for(const [path,draft] of countDrafts)if(!issues.some(issue=>issue.counts?.includes(path)))issues.push({message:`${draft.label}: 0~100의 정수를 입력하세요.`,paths:[],counts:[path],face:path.split('.')[0],view:'design'});
 return issues;
}
function issueFor(message){
 const issue={message,paths:[],counts:[],ids:[]};
 const add=(...paths)=>issue.paths.push(...paths);
 const numericIssues=(value,path='')=>{
  if(typeof value==='number'){const rule=fieldRule(path);if(!Number.isFinite(value)||value<rule.min||value>rule.max||(rule.integer&&!Number.isInteger(value)))add(path);}
  else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))numericIssues(item,path?path+'.'+key:key);
 };
 numericIssues(project);
 if(message.startsWith('프로젝트명'))issue.ids.push('projectName');
 if(/^가로:/.test(message))add('general.width');
 if(/^세로:/.test(message))add('general.height');
 if(/^깊이:/.test(message))add('general.depth');
 if(message.includes('캐비닛 전체 치수'))add('cabinet.width','cabinet.height','cabinet.columns','cabinet.rows');
 if(message.includes('겹침 여유'))add('cut.overlap','cut.precision');
 if(message.includes('원자재보다 큽니다'))add('cut.endTrim');
 if(message.includes('재고 정리 여유'))project.inventory.forEach((x,i)=>{if(x.trim>=x.length)add(`inventory.${i}.trim`,`inventory.${i}.length`);});
 const faces={앞면:'front',뒷면:project.backLinked?'front':'back',좌측면:'left',우측면:project.rightLinked?'left':'right'};
 for(const [name,face] of Object.entries(faces)){
  if(!message.startsWith(name))continue;
  issue.face=face;
  const axis=message.includes('세로')?'vertical':message.includes('가로')?'horizontal':null;
  if(axis){
   issue.counts.push(face+'.'+axis);
   project[face][axis].forEach((x,i)=>{if(x.position!==null)add(`${face}.${axis}.${i}.position`);});
   add(axis==='horizontal'?'general.height':(['left','right'].includes(face)?'general.depth':'general.width'));
  }else add('general.width','general.height','general.depth');
 }
 if(message.startsWith('좌우 '))add('general.width');
 if(message.startsWith('앞뒤 세로 보강 연결재'))add(message.includes('높이 공간')?'general.height':'general.depth');
 if(message.startsWith('세로 보강 연결재 자동'))add('general.verticalDepthTies');
 project.materials.forEach((m,i)=>{
  if(!message.startsWith(m.name))return;
  issue.material=m.id;
  if(message.includes('단면 폭'))add(`materials.${i}.face`,`materials.${i}.depth`);
  else if(message.includes('플랜지 두께'))add(`materials.${i}.t2`);
  else if(message.includes('두께'))add(`materials.${i}.t1`);
  else if(message.includes('단위중량'))add(`materials.${i}.kgm`);
  else if(message.includes('공급 길이가 중복'))m.stocks.forEach((s,j)=>{if(m.stocks.some((other,k)=>k!==j&&other.length===s.length))add(`materials.${i}.stocks.${j}.length`);});
  else if(message.includes('선택 원자재 길이'))add(`materials.${i}.selectedLength`);
  else if(message.includes('원자재 길이'))m.stocks.forEach((s,j)=>add(`materials.${i}.stocks.${j}.length`));
 });
 return issue;
}
function issueInputs(issue){
 if(!issue)return [];
 const inputs=[...document.querySelectorAll('[data-path],[data-count],#spliceSegments,#projectName')];
 return [...(issue.paths||[]).map(path=>inputs.find(input=>input.dataset.path===path)),...(issue.counts||[]).map(count=>inputs.find(input=>input.dataset.count===count)),...(issue.ids||[]).map(id=>$(id))].filter(Boolean);
}
function markIssues(issues){
 document.querySelectorAll('[aria-invalid="true"]').forEach(input=>{input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');});
 document.querySelectorAll('.field-error').forEach(span=>{span.hidden=true;span.textContent='';});
 for(const issue of issues)for(const input of issueInputs(issue)){
  input.setAttribute('aria-invalid','true');
  const inline=$(input.id+'-error');
  input.setAttribute('aria-describedby',inline?inline.id:'frame-error-message');
  if(inline){inline.textContent=issue.message;inline.hidden=false;}
 }
}
function showIssue(issue,issues=[issue]){
 currentIssue=issue;
 $('errorBox').innerHTML=`<p id="frame-error-message">${esc(issue.message)}</p>${issue.paths?.length||issue.counts?.length||issue.ids?.length?button('focus-error','문제 입력칸으로 이동'):''}`;
 $('errorBox').hidden=false;
 markIssues(issues);
}
function focusError(){
 const issue=currentIssue;if(!issue)return;
 let input=issueInputs(issue).find(control=>!control.disabled);
 if(!input&&window.FrameUX?.getState().mode==='simple'){
  window.FrameUX.revealIssue(issue);input=issueInputs(issue).find(control=>!control.disabled);
  if(!input)window.FrameUI.setInputMode('detailed');
 }
 if(!input){
  const path=issue.paths?.[0]||issue.counts?.[0]||'';
  tab=issue.view||(/^materials\.|^inventory\./.test(path)?'materials':/^accessories\.|^cost\./.test(path)?'accessories':'design');
  if(issue.face)selectedFace=issue.face;
  if(issue.material)selectedMaterial=issue.material;else if(/^materials\.\d+\./.test(path))selectedMaterial=project.materials[Number(path.split('.')[1])]?.id;
  render();input=issueInputs(issue).find(control=>!control.disabled);
 }
 if(!input)for(const path of issue.paths||[]){
  const dependency=/^general\.(width|height)$/.test(path)?'cabinet.enabled':path==='general.depth'?'general.planes':/^materials\.\d+\.(pricePerKg|stocks\.\d+\.price)$/.test(path)?path.split('.').slice(0,2).join('.')+'.priceMode':null;
  if(dependency){input=$(fieldId(dependency));if(input)break;}
 }
 if(!input)return;
 for(let ancestor=input.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;
 input.focus({preventScroll:true});input.scrollIntoView({block:'center',behavior:'auto'});
}
function recalculate(){
 const issues=inputIssues();
 try{
  if(issues.length)throw Error(issues[0].message);
  result=P.calculate(project,{compare:tab==='purchase'});currentIssue=null;$('errorBox').hidden=true;markIssues([]);updateOutputs();scheduleSave();
 }catch(error){
  result=null;showIssue(issues[0]||issueFor(error.message),issues.length?issues:[issueFor(error.message)]);$('saveStatus').textContent='입력 확인 필요 · 마지막 정상 저장본 유지';updateOutputs();
 }
 rememberInputs();
 window.FrameUX?.updated(project,result);
 window.Frame3D?.update(project,result);
 if(typeof window.CustomEvent==='function')window.dispatchEvent(new window.CustomEvent('calculatorchange'));
}
function render(){
 rememberCountDrafts();
 rendering=true;try{
 const active=document.activeElement,inside=$('content').contains(active),focus=inside?{path:active.dataset.path,count:active.dataset.count,id:active.id,start:active.selectionStart,end:active.selectionEnd}:null;
 $('projectName').value=project.name;
 document.querySelectorAll('[data-tab]').forEach(button=>{
  button.id='frame-tab-'+button.dataset.tab;button.setAttribute('role','tab');button.setAttribute('aria-controls','content');button.setAttribute('aria-selected',String(button.dataset.tab===tab));button.tabIndex=button.dataset.tab===tab?0:-1;
  button.closest('nav')?.setAttribute('role','tablist');
 });
 const simple=window.FrameUX&&project.ui?.inputMode!=='detailed';
 $('content').setAttribute('role',simple?'region':'tabpanel');$('content').setAttribute('aria-labelledby',simple?'frame-wizard-title':'frame-tab-'+tab);
 $('content').innerHTML=simple?window.FrameUX.view(project,result,{field,select,check,button,refFields,materialOptions,accessoriesView,reportView,svg}):({design,materials:materialsView,accessories:accessoriesView,purchase:purchaseView,report:reportView,projects:projectsView})[tab]();
 for(const input of document.querySelectorAll('[data-count]'))if(countDrafts.has(input.dataset.count))input.value=countDrafts.get(input.dataset.count).value;
 for(const details of document.querySelectorAll('#content details[id]'))if(detailStates.has(details.id))details.open=detailStates.get(details.id);
 recalculate();renderSplice();
 if(focus){
  const next=focus.path?$(fieldId(focus.path)):focus.count?document.querySelector(`[data-count="${focus.count}"]`):$(focus.id);
  if(next&&!next.disabled){next.focus({preventScroll:true});if(focus.start!==null&&focus.start!==undefined&&typeof next.setSelectionRange==='function')try{next.setSelectionRange(focus.start,focus.end);}catch{}}
 }
 }finally{rendering=false;}
}
function download(data,mime,name){const url=URL.createObjectURL(new Blob([data],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function filename(){return(project.name||'전광판').replace(/[\\/:*?"<>|]/g,'_');}
function printReport(){if(!result)return notice('입력값을 먼저 확인하세요.',true);const kind=$('reportKind')?.value||'all',sheets=E.sheets(project,result),choose=kind==='order'?[0,1]:kind==='cut'?[0,3,4]:kind==='quote'?[0,7]:sheets.map((_,i)=>i);$('printArea').innerHTML=`<h1>${esc(project.name)}</h1><p>전광판 구조물 ${kind==='quote'?'견적서':kind==='order'?'발주서':kind==='cut'?'절단 작업표':'산출서'} · ${new Date().toLocaleString('ko-KR')}</p>${choose.map(i=>`<section><h2>${esc(sheets[i].name)}</h2>${table(sheets[i].rows[0].map(esc),sheets[i].rows.slice(1).map(row=>row.map(v=>esc(typeof v==='number'?n(v,3):v))))}</section>`).join('')}${['all','cut'].includes(kind)?`<h2>부재 배치도 · 1대 기준</h2>${Object.entries(result.panels).map(([k,v])=>`<div class="print-drawing">${svg(v,k)}</div>`).join('')}`:''}`;window.print();}
function referenced(id){return JSON.stringify({front:project.front,back:project.back,left:project.left,right:project.right,extras:project.extras,inventory:project.inventory}).includes('"materialId":"'+id+'"');}
function applyCount(input){
 const length=Number(input.value);if(input.value===''||!Number.isInteger(length)||length<0||length>100)return false;
 const path=input.dataset.count,items=get(path),axis=path.split('.')[1],material=project.materials[0].id;
 if(items.length===length)return false;
 while(items.length<length){const prefix=axis==='vertical'?'v':'h';let index=1;while(items.some(x=>x.id===prefix+index))index++;items.push(P.reinforcement(prefix+index,material));}
 items.length=length;return true;
}
function applyField(input){
 const path=input.dataset.path;if(!path||input.disabled)return false;
 let value=input.type==='checkbox'?input.checked:input.type==='number'?(input.value===''?(input.dataset.nullable?null:NaN):Number(input.value)):input.value;
 if(input.tagName==='SELECT'&&(/\.rotation$|\.planes$|\.selectedLength$|\.precision$/.test(path)))value=Number(value);
 const old=get(path);if(Object.is(old,value))return false;put(path,value);
 if(path==='cabinet.midHorizontal'&&project.cabinet.enabled)P.cabinetHorizontal(project);
 if(path==='backLinked'&&!value)project.back=P.clone(project.front);if(path==='rightLinked'&&!value)project.right=P.clone(project.left);
 const match=path.match(/^materials\.(\d+)\.(.+)$/);if(match){const m=project.materials[+match[1]],key=match[2];if(key==='section'&&value!=='custom'){const p=P.material(value,m.id);Object.assign(m,{section:p.section,name:p.name,family:p.family,face:p.face,depth:p.depth,t1:p.t1,t2:p.t2,kgm:p.kgm});}else if(['face','depth','t1','t2','kgm','family'].includes(key))m.section='custom';if(/^stocks\.\d+\.length$/.test(key)&&m.selectedLength===old)m.selectedLength=value;}
 return true;
}
function flush(){
 // Track the last displayed values as well as project values. Some edits change
 // related project fields while their selects intentionally stay on screen.
 const pending=[...document.querySelectorAll('[data-path],[data-count],#projectName')].filter(input=>!input.disabled&&!Object.is(observedInputs.get(input),controlValue(input)));
 let changed=false,needsRender=false;
 for(const input of pending){
  if(input.id==='projectName'){if(input.value!==project.name){project.name=input.value;changed=true;}}
  else if(input.dataset.path&&applyField(input)){changed=true;if(input.type==='checkbox'||input.tagName==='SELECT'||/^materials\.\d+\.stocks\.\d+\.length$/.test(input.dataset.path))needsRender=true;}
 }
 document.querySelectorAll('[data-count]').forEach(input=>{if(applyCount(input)){changed=true;needsRender=true;}});
 if(needsRender)render();else if(changed||(pending.length&&(inputIssues().length||!result)))recalculate();
 rememberInputs();clearTimeout(saveTimer);saveNow();
}
document.addEventListener('input',e=>{
 if(rendering)return;
 if(e.target.dataset.count){recalculate();return;}
 const path=e.target.dataset.path;if(!path)return;
 applyField(e.target);
 if(e.target.tagName==='SELECT'||e.target.type==='checkbox')render();else recalculate();
});
document.addEventListener('change',e=>{if(rendering)return;if(/^materials\.\d+\.stocks\.\d+\.length$/.test(e.target.dataset.path||''))render();if(e.target.dataset.count){const changed=applyCount(e.target);if(changed&&window.FrameUX?.getState().mode!=='simple')render();else recalculate();}if(e.target.id==='spliceTarget'){selectedSplice=e.target.value;renderSplice();}if(e.target.id==='spliceMode')$('spliceSegments').disabled=e.target.value!=='manual';});
$('projectName').addEventListener('input',e=>{project.name=e.target.value;recalculate();});
document.addEventListener('keydown',e=>{
 const current=e.target.closest('[role="tab"]');if(!current||!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
 const buttons=[...current.closest('[role="tablist"]').querySelectorAll('[role="tab"]')].filter(button=>button.getAttribute('aria-disabled')!=='true');
 const index=buttons.indexOf(current);if(index<0)return;
 e.preventDefault();const next=e.key==='Home'?buttons[0]:e.key==='End'?buttons.at(-1):buttons[(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+buttons.length)%buttons.length];
 next.click();($(next.id)||next).focus();
});
document.addEventListener('click',e=>{const target=e.target.closest('button');if(!target)return;const d=target.dataset;if(d.tab){flush();tab=d.tab;render();return;}if(d.action==='focus-error'){focusError();return;}if(!d.action)return;try{
 const a=d.action,i=Number(d.index),first=project.materials[0].id;
 if(a==='apply-basic-material'){
  const id=$('frame-basic-material').value;if(!project.materials.some(m=>m.id===id))throw Error('적용할 자재를 선택하세요.');
  for(const face of [project.front,project.back])for(const ref of [...Object.values(face.edges),...face.vertical,...face.horizontal])ref.materialId=id;
  for(const face of [project.left,project.right])for(const ref of [face.top,face.bottom,...face.vertical,...face.horizontal])ref.materialId=id;
  notice('앞·뒤·측면 프레임에 선택 자재를 적용했습니다. 추가 부재와 중심선·회전 설정은 유지합니다.');
 }
 if(a==='face'){if(d.face==='back'&&project.backLinked){notice('뒷면은 앞면과 연동되어 있습니다. 독립 편집하려면 연동 체크를 해제하세요.');return;}if(d.face==='right'&&project.rightLinked){notice('우측면은 좌측면과 연동되어 있습니다. 독립 편집하려면 연동 체크를 해제하세요.');return;}selectedFace=d.face;}
 if(a==='cabinet-grid'){project.cabinet.enabled=true;P.cabinetGrid(project);notice(project.cabinet.midHorizontal?'세로재는 캐비닛 열 경계, 가로재는 상·하부와 캐비닛 행 경계에 배치했습니다.':'세로재는 캐비닛 열 경계에 배치하고, 가로재는 상·하부만 둡니다. 가운데 가로재가 필요하면 「가운데 가로재도 배치」를 켜세요.');}
 if(a==='add-extra')project.extras.push({id:uid('x'),name:'추가 부재 '+(project.extras.length+1),...P.ref(first),length:1000,quantity:1});
 if(a==='remove-extra')project.extras.splice(i,1);
 if(a==='add-material'){const m=P.material('50',uid('m'));m.name='새 자재 '+(project.materials.length+1);project.materials.push(m);selectedMaterial=m.id;}
 if(a==='material')selectedMaterial=d.id;
 if(a==='remove-material'){if(project.materials.length===1||referenced(d.id))throw Error('사용 중인 자재입니다. 부재·재고의 자재를 먼저 변경하세요.');project.materials=project.materials.filter(m=>m.id!==d.id);}
 if(a==='add-stock'){const m=project.materials.find(m=>m.id===d.material);let length=6000;while(m.stocks.some(s=>s.length===length))length+=1000;m.stocks.push({length,price:null});}
 if(a==='remove-stock'){const m=project.materials.find(m=>m.id===d.material);if(m.stocks.length===1)throw Error('공급 길이는 하나 이상 필요합니다.');const removed=m.stocks.splice(i,1)[0];if(m.selectedLength===removed.length)m.selectedLength=m.stocks[0].length;}
 if(a==='add-inventory')project.inventory.push({id:uid('stock'),materialId:first,length:6000,quantity:1,trim:0});
 if(a==='remove-inventory')project.inventory.splice(i,1);
 if(a==='add-plate')project.accessories.push({id:uid('plate'),type:'plate',name:'베이스플레이트',width:100,height:100,thickness:10,density:7850,quantity:1,unitPrice:null});
 if(a==='add-hardware')project.accessories.push({id:uid('part'),type:'hardware',name:'부속품',weightEach:0,quantity:1,unitPrice:null});
 if(a==='remove-accessory')project.accessories.splice(i,1);
 if(a==='apply-stock'){const m=project.materials.find(m=>m.id===d.id);m.stockMode=d.mode;if(d.mode==='selected')m.selectedLength=Number(d.length);}
 if(a==='save-splice'){const value=$('spliceSegments').value.trim(),mode=$('spliceMode').value;const segments=value?value.split(/[,+\s]+/).filter(Boolean).map(Number):[];const trial=P.clone(project);trial.splices[selectedSplice]={mode,segments};P.calculate(trial);project=trial;notice('분할 설정을 적용했습니다.');}
 if(a==='clear-splice')delete project.splices[selectedSplice];
 if(['xlsx','csv','json','print'].includes(a)){if(!result)throw Error('입력값을 먼저 확인하세요.');if(a==='xlsx')download(E.xlsx(project,result),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename()+'_산출서.xlsx');if(a==='csv')download(E.csv(project,result),'text/csv;charset=utf-8',filename()+'_산출서.csv');if(a==='json')download(JSON.stringify(project,null,2),'application/json',filename()+'_설정.json');if(a==='print')printReport();return;}
 if(a==='load'){$('projectFile').click();return;}
 if(['new','duplicate','open-project','restore-baseline','restore-history'].includes(a)){
   flush();let next;
   if(a==='new')next=P.createProject();if(a==='duplicate'){next=P.clone(project);next.name+=' 복사';}
   if(a==='open-project')next=P.migrate(db.projects.find(x=>x.project.id===d.id).project);
   if(a==='restore-baseline')next=P.clone(db.projects.find(x=>x.project.id===project.id).baseline.project);
   if(a==='restore-history')next=P.clone(db.projects.find(x=>x.project.id===project.id).history[i].project);
   if(a!=='open-project')next.id=uid('project');project=next;db.activeId=project.id;selectedSplice=null;selectedMaterial=null;selectedFace='front';
 }
 if(a==='baseline'){if(!result)throw Error('정상 계산 후 기준본을 저장하세요.');flush();const record=db.projects.find(x=>x.project.id===project.id);if(record.baseline)record.history.push(record.baseline);record.baseline={at:new Date().toISOString(),summary:P.summary(result),project:P.clone(project)};saveNow();notice('현재 상태를 비교 기준본으로 저장했습니다.');}
 render();
 if(['add-extra','add-plate','add-hardware'].includes(a)){
  const list=a==='add-extra'?'extras':'accessories',input=$(fieldId(list+'.'+(project[list].length-1)+'.name'));
  if(input){for(let ancestor=input.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true;input.focus({preventScroll:true});input.scrollIntoView({block:'nearest',behavior:'auto'});}
 }
 }catch(error){notice(error.message,true);if(d.action==='save-splice')showIssue({message:error.message,paths:[],counts:[],ids:['spliceSegments'],view:'purchase'});}});
$('projectFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error('설정 파일은 5MB 이하로 불러오세요.');const incoming=P.parse(await file.text());flush();incoming.id=uid('project');project=incoming;selectedFace='front';selectedSplice=null;selectedMaterial=null;render();notice('설정을 새 프로젝트로 불러왔습니다.');}catch(error){notice(error.message+' 기존 프로젝트를 유지합니다.',true);}finally{e.target.value='';}});
window.addEventListener('beforeunload',flush);window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
loadDatabase();render();
window.FrameUI={getProject:()=>P.clone(project),getResult:()=>result,validateProject:raw=>P.migrate(raw),setName(name){const value=String(name);if(value.length>100)throw Error('프로젝트명은 100자 이내로 입력하세요.');if(value===project.name)return false;project.name=value;$('projectName').value=value;recalculate();return true;},loadProject(raw){const next=P.migrate(raw);flush();project=next;clearCountDrafts();selectedFace='front';selectedMaterial=null;selectedSplice=null;render();return P.clone(project);},flush,refresh:render,focusError,getTab:()=>tab,
 setInputMode(mode){if(!['simple','detailed'].includes(mode))throw Error('입력 방식을 확인하세요.');flush();project.ui={...project.ui,inputMode:mode};render();},
 showTab(next){if(!['design','materials','accessories','purchase','report','projects'].includes(next))return;flush();tab=next;render();},
 hasCountErrors:()=>countDrafts.size>0||[...document.querySelectorAll('[data-count]')].some(invalidCount)
};
if(document.modelContext?.registerTool){try{
 const definitions=[{name:'get_frame_project',title:'현재 구조물 프로젝트 읽기',description:'현재 화면의 프로젝트 설정과 계산 요약을 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){return {project:P.clone(project),summary:result?P.summary(result):null};}},{name:'set_frame_project',title:'구조물 프로젝트 설정 적용',description:'버전 5 또는 이전 계산기의 전체 JSON 설정을 검증한 뒤 화면에 적용하고 이 기기에 자동 저장합니다. 실제 재고 차감이나 발주는 하지 않습니다.',inputSchema:{type:'object',properties:{project:{type:'object'}},required:['project'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){const next=P.migrate(input.project);P.calculate(next);project=next;clearCountDrafts();selectedFace='front';selectedMaterial=null;selectedSplice=null;render();return {summary:P.summary(result),status:result.purchase.status};}}];
 for(const definition of definitions)Promise.resolve(document.modelContext.registerTool(definition)).catch(()=>{});
}catch{}}
