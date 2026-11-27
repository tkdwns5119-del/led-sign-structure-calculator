// 「간편 진행」: one guided flow (설치 장소 → 전광판 → 기둥·기초 → 결과) on top of the two calculators.
// Every answer is written straight into the frame and foundation calculators and the frame is applied to
// the foundation in the background, so nothing is entered twice. The designer screens stay as they are.
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
  const STEPS=[['place','설치 장소'],['sign','전광판'],['support','기둥·기초'],['result','결과']];
  const EXAMPLE_KGM2=45;
  const EXPOSURE_WORDS={A:['도심','고층 건물이 빽빽한 곳'],B:['시가지','주택·나무가 많은 곳'],C:['건물 드문 곳','저층 건물·나무가 띄엄띄엄 (잘 모르면 이것)'],D:['바닷가·평지','바람을 막는 것이 거의 없는 곳']};
  let step=1,timer=null,busy=false,error='';
  // Product weight answer is remembered in the frame project (ui.guideWeight) so a reload shows the same choice.
  const S=()=>window.CalculatorSuite;
  const kids=()=>{const s=S();return {frameWin:s.frames.frame.contentWindow,foundWin:s.frames.foundation.contentWindow,frame:s.getFrame(),foundation:s.getFoundation()};};

  // Current answers, read back from the two calculators.
  function answers(){
    const {frame,foundation}=kids(),fp=frame.getProject(),p=foundation.read(),notes=foundation.getNotes(),g=fp.general,c=fp.cabinet;
    const post=fp.extras.find(x=>x.post),material=post&&fp.materials.find(m=>m.id===post.materialId);
    const area=g.width*g.height/1e6,weightMode=fp.ui?.guideWeight||(c.enabled&&c.weightEach>0?'cabinet':g.extraEquipment>0?'kgm2':'unknown');
    return {region:p.windMode==='regional'?p.windPoint:'',exposure:p.exposure,groundKnown:notes.groundKnown,qa:p.qa,
      planes:g.planes,width:g.width/1000,height:g.height/1000,depth:g.depth/1000,bottom:p.bottom,boards:g.quantity,
      weightMode,kgm2:weightMode==='kgm2'&&area>0?Math.round(g.extraEquipment/area*10)/10:EXAMPLE_KGM2,cabinet:{w:c.width,h:c.height,cols:c.columns,rows:c.rows,kg:c.weightEach},
      posts:p.installMode==='shared'&&p.type==='single'&&p.qty===2?2:1,spacing:(p.foundationSpacing||g.width*0.6)/1000,column:material?.section&&material.section!=='custom'?material.section:''};
  }
  function columnOptions(){
    const P=kids().frameWin.FramePlanner,list=Object.entries(P.legacy.presets).filter(([,x])=>['pipe','square','rect','h'].includes(x.family));
    return list.map(([id,x])=>[id,`${P.legacy.families[x.family]} ${x.label}`]);
  }

  // Write the answers into both calculators, then apply the frame to the foundation silently.
  function apply(a){
    const {frameWin,frame,foundation}=kids(),P=frameWin.FramePlanner,fp=frame.getProject(),g=fp.general;
    fp.ui={...(fp.ui||{}),guideWeight:a.weightMode};
    g.planes=a.planes;g.quantity=Math.max(1,Math.round(a.boards));g.depth=Math.round(a.depth*1000);
    if(a.weightMode==='cabinet'){Object.assign(fp.cabinet,{enabled:true,width:a.cabinet.w,height:a.cabinet.h,columns:a.cabinet.cols,rows:a.cabinet.rows,weightEach:a.cabinet.kg});g.extraEquipment=0;}
    else{fp.cabinet.enabled=false;g.width=Math.round(a.width*1000);g.height=Math.round(a.height*1000);g.extraEquipment=Math.round((a.weightMode==='kgm2'?a.kgm2:EXAMPLE_KGM2)*g.width*g.height/1e6*10)/10;}
    // Posts: one material per chosen section, flagged so its section reaches the foundation column check.
    fp.extras=fp.extras.filter(x=>!x.post);
    if(a.column){
      let m=fp.materials.find(x=>x.section===a.column);
      if(!m){let i=fp.materials.length+1;while(fp.materials.some(x=>x.id==='m'+i))i++;m=P.material(a.column,'m'+i);fp.materials.push(m);}
      const above=foundation.read().above||300,width=a.weightMode==='cabinet'?a.cabinet.w*a.cabinet.cols:g.width,height=a.weightMode==='cabinet'?a.cabinet.h*a.cabinet.rows:g.height;
      fp.extras.push({id:'guide-post',name:'기초 지주',materialId:m.id,rotation:0,length:Math.max(500,Math.round(a.bottom*1000-above+height)),quantity:a.posts,post:true});
      if(a.posts===2&&!(a.spacing>0))a.spacing=width*0.6/1000;
    }
    frame.loadProject(fp);
    S().applyFrame({silent:true,product:a.weightMode!=='unknown',posts:true});
    const shared=a.posts===2;
    const values={exposure:a.exposure,bottom:a.bottom,mode:'auto',installMode:shared?'shared':'repeat',qty:shared?2:g.quantity,foundationSpacing:Math.round((a.spacing||3)*1000),type:'single',connectionMode:a.column?'auto':'manual'};
    if(!a.column)Object.assign(values,{columnShape:'schematic',columnThickness:0});
    if(a.groundKnown)values.qa=a.qa;
    const current=foundation.read();
    if(a.region&&(current.windPoint!==a.region||current.windMode!=='regional'))foundation.selectPoint(a.region);
    foundation.patch(values,{groundKnown:a.groundKnown,weightExample:a.weightMode==='unknown',...(a.region?{windExample:false}:{})});
    // Two posts per board: the board count becomes the repeat count of this foundation layout.
    const count=$('installation-count');
    if(count){const want=String(shared?g.quantity:1);if(count.value!==want){count.value=want;count.dispatchEvent(new Event('change',{bubbles:true}));}}
    S().update();S().scheduleSave();
  }

  function read(){
    const a=answers(),root=$('guide-root'),val=name=>root.querySelector(`[name="${name}"]:checked`)?.value??root.querySelector(`[name="${name}"]`)?.value;
    // A field that a choice has just revealed is not on screen yet: keep the current value for it.
    const n=(name,fallback)=>{const el=root.querySelector(`[name="${name}"]`);if(!el)return fallback;const v=el.value.trim()===''?NaN:Number(el.value);return Number.isFinite(v)?v:NaN;};
    if(step===1){a.region=val('region')||'';a.exposure=val('exposure')||'C';a.groundKnown=val('ground')==='known';if(a.groundKnown)a.qa=n('qa',a.qa);}
    if(step===2){a.planes=Number(val('planes'))||1;a.width=n('width',a.width);a.height=n('height',a.height);a.depth=a.planes===2?n('depth',a.depth>0?a.depth:0.6):a.depth;a.bottom=n('bottom',a.bottom);a.boards=n('boards',a.boards);a.weightMode=val('weight')||'unknown';
      if(a.weightMode==='kgm2')a.kgm2=n('kgm2',a.kgm2);if(a.weightMode==='cabinet'){const c=a.cabinet;a.cabinet={w:n('cab-w',c.w),h:n('cab-h',c.h),cols:n('cab-cols',c.cols),rows:n('cab-rows',c.rows),kg:n('cab-kg',c.kg)};}}
    if(step===3){a.posts=Number(val('posts'))||1;a.column=val('column')||'';a.spacing=n('spacing',a.spacing);}
    return a;
  }
  function check(a){
    const bad=[];
    if(step===2){if(a.weightMode!=='cabinet'){if(!(a.width>=0.1&&a.width<=50))bad.push('가로는 0.1~50 m로 입력하세요.');if(!(a.height>=0.1&&a.height<=30))bad.push('세로는 0.1~30 m로 입력하세요.');}
      if(!(a.bottom>=0&&a.bottom<=50))bad.push('땅에서 화면 아래까지 높이는 0~50 m로 입력하세요.');if(!(Number.isInteger(a.boards)&&a.boards>=1&&a.boards<=1000))bad.push('설치 대수는 1~1000대로 입력하세요.');
      if(a.weightMode==='kgm2'&&!(a.kgm2>0&&a.kgm2<=1000))bad.push('1 m²당 무게를 0보다 크게 입력하세요.');
      if(a.weightMode==='cabinet'&&![a.cabinet.w,a.cabinet.h,a.cabinet.cols,a.cabinet.rows].every(v=>v>0))bad.push('캐비닛 가로·세로와 배열을 입력하세요.');}
    if(step===1&&a.groundKnown&&!(a.qa>=1&&a.qa<=5000))bad.push('허용지지력은 1~5000 kPa로 입력하세요.');
    if(step===3&&a.posts===2&&!(a.spacing>0))bad.push('기둥 간격을 입력하세요.');
    return bad;
  }
  function commit(){
    clearTimeout(timer);timer=null;const a=read(),bad=check(a);error=bad.join(' ');
    if(!bad.length){try{busy=true;apply(a);}catch(e){error=e.message;}finally{busy=false;}}
    paintSide();return !error;
  }
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(commit,350);};

  // ----- markup -----
  const radio=(name,value,checked,title,note='')=>`<label class="g-choice"><input type="radio" name="${name}" value="${esc(value)}" ${checked?'checked':''}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span></label>`;
  const field=(name,label,value,{unit='',step='any',hint='',min='',max=''}={})=>`<label class="g-field"><span>${esc(label)}</span><span class="g-input"><input name="${name}" type="number" inputmode="decimal" step="${step}" ${min!==''?`min="${min}"`:''} ${max!==''?`max="${max}"`:''} value="${Number.isFinite(value)?value:''}">${unit?`<em>${esc(unit)}</em>`:''}</span>${hint?`<small>${esc(hint)}</small>`:''}</label>`;
  function stepPlace(a){
    const W=kids().foundWin.FoundationWind;
    return `<h2>어디에 설치하나요?</h2><p class="g-lead">지역과 주변 모습으로 바람의 세기를 정합니다.</p>
<label class="g-field"><span>설치 지역 (가까운 곳)</span><select name="region"><option value="">지역을 고르세요</option>${W.points.map(p=>`<option value="${p.id}" ${a.region===p.id?'selected':''}>${esc(p.name)} · 기본풍속 ${p.v} m/s</option>`).join('')}</select><small>목록에 없으면 가장 가까운 곳을 고르세요. 바닷가·섬일수록 바람이 셉니다.</small></label>
<fieldset class="g-group"><legend>주변 모습</legend><div class="g-choices">${Object.entries(EXPOSURE_WORDS).map(([k,[t,n]])=>radio('exposure',k,a.exposure===k,t,n)).join('')}</div></fieldset>
<fieldset class="g-group"><legend>땅(지반) 정보</legend><div class="g-choices two">${radio('ground','unknown',!a.groundKnown,'아직 모름','예시값 150 kPa로 계산 · 결과에 "확인 필요" 표시')}${radio('ground','known',a.groundKnown,'지반조사 값 있음','허용지지력을 입력합니다')}</div>${a.groundKnown?field('qa','허용지지력',a.qa,{unit:'kPa',hint:'지반조사 보고서의 허용지지력 값'}):''}</fieldset>`;
  }
  function stepSign(a){
    const cab=a.weightMode==='cabinet';
    return `<h2>전광판은 어떤가요?</h2><p class="g-lead">크기와 무게만 넣으면 철골 구조물과 기초 하중을 함께 계산합니다.</p>
<fieldset class="g-group"><legend>모양</legend><div class="g-choices two">${radio('planes','1',a.planes!==2,'한 겹 프레임','앞면 한 장으로 만드는 구조물')}${radio('planes','2',a.planes===2,'깊이 있는 프레임','앞뒤 프레임을 연결한 상자형')}</div></fieldset>
<div class="g-row">${cab?'':field('width','가로',a.width,{unit:'m',hint:'예: 6'})+field('height','세로',a.height,{unit:'m',hint:'예: 3'})}${a.planes===2?field('depth','앞뒤 두께',a.depth,{unit:'m'}):''}${field('bottom','땅에서 화면 아래까지',a.bottom,{unit:'m',hint:'예: 3'})}${field('boards','설치 대수',a.boards,{unit:'대',step:'1',min:1})}</div>
<fieldset class="g-group"><legend>전광판 제품 무게</legend><div class="g-choices three">${radio('weight','kgm2',a.weightMode==='kgm2','1 m²당 무게','제품 카탈로그의 kg/m²')}${radio('weight','cabinet',cab,'캐비닛으로 입력','캐비닛 크기·배열·개당 무게')}${radio('weight','unknown',a.weightMode==='unknown','아직 모름',`예시 ${EXAMPLE_KGM2} kg/m²로 계산 · "확인 필요" 표시`)}</div>
${a.weightMode==='kgm2'?field('kgm2','1 m²당 무게',a.kgm2,{unit:'kg/m²',hint:'LED 전광판은 보통 30~60 kg/m²'}):''}
${cab?`<div class="g-row">${field('cab-w','캐비닛 가로',a.cabinet.w,{unit:'mm'})}${field('cab-h','캐비닛 세로',a.cabinet.h,{unit:'mm'})}${field('cab-cols','가로 개수',a.cabinet.cols,{unit:'열',step:'1'})}${field('cab-rows','세로 개수',a.cabinet.rows,{unit:'행',step:'1'})}${field('cab-kg','캐비닛 1개 무게',a.cabinet.kg,{unit:'kg'})}</div><p class="g-note">전광판 크기는 캐비닛 크기 × 개수로 정해집니다.</p>`:''}</fieldset>`;
  }
  function stepSupport(a){
    return `<h2>기둥과 기초는 어떻게 할까요?</h2><p class="g-lead">기초 크기, 바닥판(베이스플레이트), 앵커볼트는 자동으로 정합니다.</p>
<fieldset class="g-group"><legend>전광판 1대를 받치는 기둥 수</legend><div class="g-choices two">${radio('posts','1',a.posts!==2,'기둥 1개','가운데 기둥 하나 (T자형)')}${radio('posts','2',a.posts===2,'기둥 2개','양쪽 두 기둥 · 기초도 2개')}</div>${a.posts===2?field('spacing','기둥 간격 (중심~중심)',a.spacing,{unit:'m',hint:'보통 전광판 가로의 50~70%'}):''}</fieldset>
<label class="g-field"><span>기둥 규격</span><select name="column"><option value="" ${!a.column?'selected':''}>아직 모름 · 기둥 검토는 빼고 계산</option>${columnOptions().map(([id,t])=>`<option value="${id}" ${a.column===id?'selected':''}>${esc(t)}</option>`).join('')}</select><small>규격을 고르면 기둥·앵커·바닥판까지 미리 확인합니다. 큰 전광판은 원형 강관 Ø216 이상부터 비교해 보세요.</small></label>`;
  }
  function stepResult(){
    const {foundWin,foundation}=kids(),r=foundation.getResult(),PL=foundWin.FoundationPlain;
    if(!r)return `<h2>결과</h2><p class="g-error">입력 오류가 있어 결과를 만들 수 없습니다. 앞 단계를 확인하세요.</p>`;
    const notes=foundation.getNotes(),p=r.p,c=r.connection?.found?r.connection.values:null,shared=r.supports?.shared;
    return `<h2>결과 · 구조계산 의뢰 전 참고</h2><div class="g-result-top"><section class="g-facts"><h3>설치 모습 3D 예시</h3>${view3dHTML(true)}</section>
<section class="g-facts"><h3>기초와 기둥</h3><dl>
<div><dt>기초 1개 크기</dt><dd>가로 ${num(r.g.L/1000)} × 세로 ${num(r.g.W/1000)} × 두께 ${num(r.g.H/1000)} m${r.search&&!r.search.found?' <em>(자동 후보 없음 · 설계자 확인 필요)</em>':''}</dd></div>
<div><dt>기초 개수</dt><dd>${shared?`전광판 1대에 ${p.qty}개 (기둥 간격 ${num(p.foundationSpacing/1000)} m)`:`전광판 1대에 1개`}</dd></div>
<div><dt>기둥</dt><dd>${esc(kids().foundWin.FoundationEstimate.column(p).label)}</dd></div>
${c?`<div><dt>바닥판 · 앵커볼트</dt><dd>${c.plateL}×${c.plateW}×${c.plateThickness} mm · M${c.anchorDiameter} ${c.anchorCount}개 (묻힘 ${c.anchorEmbed} mm)</dd></div>`:''}
<div><dt>콘크리트 · 철근 (전체)</dt><dd>약 ${num(r.total.orderedConcrete,1)} m³ · 약 ${num(r.total.rebarGross,0)} kg${shared?' (전광판 1대 기준)':''}</dd></div>
<div><dt>바람</dt><dd>설계 풍압 ${num(r.l.pressure)} kPa · 전광판 1대가 받는 힘 약 ${num(r.l.front,1)} kN</dd></div>
</dl></section></div>${PL.cardsHTML(PL.summarize(r,notes))}
<section class="g-outputs"><h3>출력과 저장</h3><div class="g-buttons"><button type="button" class="primary" data-guide-click="suite-report">의뢰용 참고자료 (A4·PDF)</button><button type="button" data-guide-click="suite-solidcraft">3D 파일 (SolidCraft)</button><button type="button" data-guide-click="suite-xlsx">통합 엑셀</button><button type="button" data-guide-click="suite-save">작업 저장</button></div>
<p class="g-note">세부 값을 고치거나 검토 표를 보려면 설계자 상세 화면을 쓰세요. <button type="button" class="link" data-view="frame">01 구조물</button> <button type="button" class="link" data-view="foundation">02 기초·철근</button> <button type="button" class="link" data-view="overview">03 전체 요약</button></p></section>`;
  }
  // Live 3D of the whole installation (frame, posts, plates, footings) from the SolidCraft export's parts.
  const VIEWS={angle:{yaw:-.55,pitch:.3},front:{yaw:0,pitch:0},side:{yaw:-Math.PI/2,pitch:0}};
  const view3d={...VIEWS.angle,zoom:1,panX:0,panY:0};let sceneModel=null,drag3d=null,frame3d=0;
  function buildScene(){
    const {frameWin,frame,foundation}=kids(),r=frame.getResult(),f=foundation.getResult();if(!r&&!f)return null;
    const project=frame.getProject(),geometry=r?frameWin.Frame3D.geometry(project,r,{limit:5000}):null;
    return frameWin.SolidCraftExport.scene({frame:geometry?{geometry,project,result:r}:null,foundation:f});
  }
  const draw3d=()=>sceneModel?kids().frameWin.Frame3D.render(sceneModel,view3d):'<p class="g-error">입력 오류를 고치면 3D 모양이 나옵니다.</p>';
  function view3dHTML(big=false){
    sceneModel=buildScene();
    return `<div class="g-3d${big?' big':''}"><div class="g-3d-view" aria-label="설치 모습 3D 예시">${draw3d()}</div><div class="g-3d-tools" role="group" aria-label="3D 보기 조정">${[['angle','입체'],['front','정면'],['side','측면']].map(([k,t])=>`<button type="button" data-g3d="${k}">${t}</button>`).join('')}<button type="button" data-g3d="out" aria-label="축소">−</button><button type="button" data-g3d="in" aria-label="확대">＋</button></div><p class="g-note">끌어서 돌려 보세요 · 회색 블록이 땅속 기초, 진한 기둥이 지주입니다 · 형상 확인용 예시</p></div>`;
  }
  function repaint3d(){frame3d=0;for(const v of document.querySelectorAll('#guide-root .g-3d-view'))v.innerHTML=draw3d();}
  const schedule3d=()=>{if(!frame3d)frame3d=requestAnimationFrame(repaint3d);};
  document.addEventListener('pointerdown',e=>{const v=e.target.closest?.('#guide-root .g-3d-view');if(!v||!sceneModel)return;drag3d={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:view3d.yaw,pitch:view3d.pitch};v.setPointerCapture(e.pointerId);e.preventDefault();});
  document.addEventListener('pointermove',e=>{if(!drag3d||drag3d.id!==e.pointerId)return;view3d.yaw=drag3d.yaw+(e.clientX-drag3d.x)*.009;view3d.pitch=Math.max(-1.1,Math.min(1.1,drag3d.pitch+(e.clientY-drag3d.y)*.007));schedule3d();});
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{if(drag3d?.id===e.pointerId)drag3d=null;});
  document.addEventListener('wheel',e=>{if(!e.target.closest?.('#guide-root .g-3d-view'))return;e.preventDefault();view3d.zoom=Math.max(.5,Math.min(6,view3d.zoom*(e.deltaY<0?1.15:1/1.15)));schedule3d();},{passive:false});
  // Side panel: live lights and the 3D example while answering.
  function paintSide(){
    const side=$('guide-side');if(!side)return;
    const {foundWin,foundation}=kids(),r=foundation.getResult(),PL=foundWin.FoundationPlain;
    const err=$('guide-error');if(err){err.textContent=error;err.hidden=!error;}
    if(!r){side.innerHTML='<h3>미리보기</h3>'+view3dHTML()+'<p class="g-error">기초 입력 오류를 고치면 신호등이 나옵니다.</p>';return;}
    const s=PL.summarize(r,foundation.getNotes()),L=PL.LIGHTS;
    side.innerHTML=`<h3>미리보기</h3><p class="g-overall plain-${s.overall}">${L[s.overall].icon} <b>${L[s.overall].word}</b> · ${esc(s.headline)}</p>${view3dHTML()}<ul class="g-lights">${s.groups.map(g=>`<li>${L[g.light].icon} ${esc(g.short)} <em>${L[g.light].word}</em></li>`).join('')}</ul><p class="g-note">기초 1개 ${num(r.g.L/1000)} × ${num(r.g.W/1000)} × ${num(r.g.H/1000)} m</p>`;
  }
  function render(){
    const root=$('guide-root');if(!root||!S()?.getState().ready)return;
    let a;try{a=answers();}catch{return;}
    const body=step===1?stepPlace(a):step===2?stepSign(a):step===3?stepSupport(a):stepResult();
    kids().foundWin.FoundationPlain.ensureStyle(document);kids().foundWin.FoundationPlain.bindTerms(document);
    root.innerHTML=`<ol class="g-steps" aria-label="진행 단계">${STEPS.map(([,t],i)=>`<li><button type="button" data-guide-step="${i+1}" ${i+1===step?'aria-current="step"':''}><span>${i+1}</span>${esc(t)}</button></li>`).join('')}</ol>
<div class="g-layout${step===4?' result':''}"><form class="g-form" novalidate>${body}<p id="guide-error" class="g-error" role="alert" hidden></p></form>${step<4?'<aside id="guide-side" class="g-side" aria-live="polite"></aside>':''}</div>
<div class="g-nav">${step>1?'<button type="button" data-guide-move="-1">← 이전</button>':'<span></span>'}<span class="g-count">${step} / 4</span>${step<4?`<button type="button" class="primary" data-guide-move="1">${step===3?'결과 보기':'다음'} →</button>`:'<span></span>'}</div>`;
    paintSide();
  }
  function go(next){
    if(next>step&&step<4&&!commit()){$('guide-error')?.focus?.();return;}
    if(next<step&&step<4)commit();
    step=Math.min(4,Math.max(1,next));render();S().scheduleSave();
    $('guide-root').querySelector('h2')?.setAttribute('tabindex','-1');$('guide-root').querySelector('h2')?.focus({preventScroll:true});
    $('panel-guide').scrollTop=0;
  }
  document.addEventListener('input',e=>{if(e.target.closest?.('#guide-root .g-form'))schedule();});
  document.addEventListener('change',e=>{
    if(!e.target.closest?.('#guide-root .g-form'))return;
    // Choices that show or hide fields re-render the step after applying.
    if(['ground','planes','weight','posts'].includes(e.target.name)){commit();render();}else schedule();
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#guide-root button');if(!b)return;
    if(b.dataset.guideMove)go(step+Number(b.dataset.guideMove));
    else if(b.dataset.guideStep)go(Number(b.dataset.guideStep));
    else if(b.dataset.g3d){const k=b.dataset.g3d;if(VIEWS[k])Object.assign(view3d,VIEWS[k]);else view3d.zoom=Math.max(.5,Math.min(6,view3d.zoom*(k==='in'?1.25:1/1.25)));repaint3d();}
    else if(b.dataset.guideClick){const target=$(b.dataset.guideClick);if(target&&!target.disabled)target.click();}
  });
  // Header menus close once an item is chosen, and when clicking elsewhere.
  document.addEventListener('click',e=>{
    const item=e.target.closest?.('.suite-bar .project-menu>div button');
    if(item){setTimeout(()=>{const menu=item.closest('details');if(menu)menu.open=false;},0);return;}
    for(const menu of document.querySelectorAll('.suite-bar .project-menu[open]'))if(!menu.contains(e.target))menu.open=false;
  });
  window.SuiteGuide={render,getStep:()=>step,setStep(n){step=Number.isInteger(n)&&n>=1&&n<=4?n:1;},commit,answers};
  // First paint once both calculators are ready.
  const wait=setInterval(()=>{if(S()?.getState().ready){clearInterval(wait);if(document.body.dataset.view==='guide')render();}},100);
})();
