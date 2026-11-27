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

  // ----- markup (short labels; details live in the designer screens and the printed reference) -----
  const radio=(name,value,checked,title,note='')=>`<label class="g-choice"><input type="radio" name="${name}" value="${esc(value)}" ${checked?'checked':''}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span></label>`;
  const field=(name,label,value,{unit='',step='any',min=''}={})=>`<label class="g-field"><span>${esc(label)}</span><span class="g-input"><input name="${name}" type="number" inputmode="decimal" step="${step}" ${min!==''?`min="${min}"`:''} value="${Number.isFinite(value)?value:''}">${unit?`<em>${esc(unit)}</em>`:''}</span></label>`;
  const SHORT_EXPOSURE={A:['도심','고층 밀집'],B:['시가지','주택·나무'],C:['건물 드문 곳','잘 모르면'],D:['바닷가·평지','막힘 없음']};
  function stepPlace(a){
    const W=kids().foundWin.FoundationWind;
    return `<h2>설치 장소</h2>
<label class="g-field"><span>가까운 지역</span><select name="region"><option value="">지역을 고르세요</option>${W.points.map(p=>`<option value="${p.id}" ${a.region===p.id?'selected':''}>${esc(p.name)} (${p.v} m/s)</option>`).join('')}</select></label>
<fieldset class="g-group"><legend>주변 모습</legend><div class="g-choices two">${Object.entries(SHORT_EXPOSURE).map(([k,[t,n]])=>radio('exposure',k,a.exposure===k,t,n)).join('')}</div></fieldset>
<fieldset class="g-group"><legend>지반조사 값</legend><div class="g-choices two">${radio('ground','unknown',!a.groundKnown,'모름','예시값으로')}${radio('ground','known',a.groundKnown,'있음','값 입력')}</div>${a.groundKnown?field('qa','허용지지력',a.qa,{unit:'kPa'}):''}</fieldset>`;
  }
  function stepSign(a){
    const cab=a.weightMode==='cabinet';
    return `<h2>전광판</h2>
<fieldset class="g-group"><legend>모양</legend><div class="g-choices two">${radio('planes','1',a.planes!==2,'한 겹')}${radio('planes','2',a.planes===2,'상자형')}</div></fieldset>
<div class="g-row">${cab?'':field('width','가로',a.width,{unit:'m'})+field('height','세로',a.height,{unit:'m'})}${a.planes===2?field('depth','앞뒤 두께',a.depth,{unit:'m'}):''}${field('bottom','땅~화면 아래',a.bottom,{unit:'m'})}${field('boards','설치 대수',a.boards,{unit:'대',step:'1',min:1})}</div>
<fieldset class="g-group"><legend>제품 무게</legend><div class="g-choices three">${radio('weight','kgm2',a.weightMode==='kgm2','kg/m²')}${radio('weight','cabinet',cab,'캐비닛')}${radio('weight','unknown',a.weightMode==='unknown','모름',`예시 ${EXAMPLE_KGM2}`)}</div>
${a.weightMode==='kgm2'?field('kgm2','1 m²당 무게',a.kgm2,{unit:'kg/m²'}):''}
${cab?`<div class="g-row">${field('cab-w','캐비닛 가로',a.cabinet.w,{unit:'mm'})}${field('cab-h','캐비닛 세로',a.cabinet.h,{unit:'mm'})}${field('cab-cols','가로 개수',a.cabinet.cols,{unit:'열',step:'1'})}${field('cab-rows','세로 개수',a.cabinet.rows,{unit:'행',step:'1'})}${field('cab-kg','1개 무게',a.cabinet.kg,{unit:'kg'})}</div>`:''}</fieldset>`;
  }
  function stepSupport(a){
    return `<h2>기둥·기초</h2>
<fieldset class="g-group"><legend>기둥 수 (전광판 1대)</legend><div class="g-choices two">${radio('posts','1',a.posts!==2,'1개','가운데')}${radio('posts','2',a.posts===2,'2개','양쪽')}</div>${a.posts===2?field('spacing','기둥 간격',a.spacing,{unit:'m'}):''}</fieldset>
<label class="g-field"><span>기둥 규격</span><select name="column"><option value="" ${!a.column?'selected':''}>모름 (기둥 검토 생략)</option>${columnOptions().map(([id,t])=>`<option value="${id}" ${a.column===id?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
<p class="g-note">기초 크기·바닥판·앵커볼트는 자동으로 정합니다.</p>`;
  }
  function stepResult(){
    const {foundWin,foundation}=kids(),r=foundation.getResult(),PL=foundWin.FoundationPlain;
    if(!r)return `<h2>결과</h2><p class="g-error">입력 오류가 있습니다. 앞 단계를 확인하세요.</p>`;
    const p=r.p,c=r.connection?.found?r.connection.values:null,s=PL.summarize(r,foundation.getNotes()),L=PL.LIGHTS;
    return `<h2>결과</h2><p class="dash-verdict plain-${s.overall}">${L[s.overall].icon} <b>${L[s.overall].word}</b> <span>${esc(s.headline)}</span></p>
<dl class="g-key"><div><dt>기초 1개</dt><dd>${num(r.g.L/1000)} × ${num(r.g.W/1000)} × ${num(r.g.H/1000)} m</dd></div><div><dt>기초 개수</dt><dd>${r.supports?.shared?`대당 ${p.qty}개`:'대당 1개'}</dd></div><div><dt>기둥</dt><dd>${esc(foundWin.FoundationEstimate.column(p).label)}</dd></div>${c?`<div><dt>바닥판 · 앵커</dt><dd>${c.plateL}×${c.plateW}×${c.plateThickness} · M${c.anchorDiameter}×${c.anchorCount}</dd></div>`:''}</dl>
<div class="g-buttons"><button type="button" class="primary" data-guide-click="suite-report">의뢰용 참고자료 (PDF)</button><button type="button" data-guide-click="suite-solidcraft">3D 파일</button><button type="button" data-guide-click="suite-xlsx">엑셀</button><button type="button" data-guide-click="suite-save">저장</button></div>
<details class="g-more"><summary>판정 자세히${s.unconfirmed.length?` · 확인 안 된 자료 ${s.unconfirmed.length}개`:''}</summary>${PL.cardsHTML(s)}<p class="g-note">세부 수정: <button type="button" class="link" data-view="frame">01 구조물</button> <button type="button" class="link" data-view="foundation">02 기초·철근</button> <button type="button" class="link" data-view="overview">03 전체 요약</button></p></details>
<p class="g-note">참고용 결과 · 설치 전 구조기술사 확인 필요</p>`;
  }

  // ----- dashboard: full-screen 3D with labels pinned to the model, KPIs left, gauges below -----
  const VIEWS={angle:{yaw:-.62,pitch:.32},front:{yaw:0,pitch:0},side:{yaw:-Math.PI/2,pitch:0}};
  const view3d={...VIEWS.angle,zoom:1,panX:0,panY:0,theme:'twin'};let sceneModel=null,drag3d=null,frame3d=0,observer=null;
  function buildScene(){
    const {frameWin,frame,foundation}=kids(),r=frame.getResult(),f=foundation.getResult();if(!r&&!f)return null;
    const project=frame.getProject(),geometry=r?frameWin.Frame3D.geometry(project,r,{limit:5000}):null;
    return frameWin.SolidCraftExport.scene({frame:geometry?{geometry,project,result:r}:null,foundation:f,emphasize:true,theme:'twin',screen:true});
  }
  function stageState(stage){
    const wide=innerWidth>900,left=wide?(stage.parentElement.querySelector('.dash-left')?.offsetWidth||0):0,right=wide?(stage.parentElement.querySelector('.dash-right')?.offsetWidth||0):0;
    const W=Math.max(280,stage.clientWidth),H=Math.max(240,stage.clientHeight),b=sceneModel.bounds;
    const pad=Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2])*0.45,ground=sceneModel.groundY??b.min[1];
    return {...view3d,width:W,height:H,fit:wide?[Math.max(.3,(W-left-right-80)/W),.62]:[.86,.74],offsetX:(left-right)/2,offsetY:wide?-H*0.04:0,
      grid:{y:b.max[1]-(b.max[1]-ground)+0,x0:b.min[0]-pad,x1:b.max[0]+pad,z0:b.min[2]-pad,z1:b.max[2]+pad,step:1000}};
  }
  function callouts(stage,state){
    const box=stage.querySelector('.dash-callouts');if(!box||!sceneModel)return;
    const {frameWin,foundation}=kids(),F3=frameWin.Frame3D,r=foundation.getResult(),PL=kids().foundWin.FoundationPlain,L=PL.LIGHTS;
    const s=r?PL.summarize(r,foundation.getNotes()):null,group=id=>s?.groups.find(g=>g.id===id),tag=(g,label)=>g?`<em class="plain-${g.light}">${L[g.light].icon} ${label} ${L[g.light].word}${g.worst?` ${Math.round(g.worst.ratio*100)}%`:''}</em>`:'';
    const pick=k=>sceneModel.boxes.filter(b=>b.kind===k),list=[];
    const screen=pick('screen')[0]||pick('frame')[0],posts=pick('post'),footings=pick('concrete').sort((a,b)=>b.w*b.h*b.d-a.w*a.h*a.d);
    if(screen&&r)list.push({at:[screen.x+screen.w,screen.y+screen.h*.35,screen.z],title:'전광판',text:`${num(r.p.signW/1000)} × ${num(r.p.signH/1000)} m · 대당 ${num(r.l.upper/9.80665*1000,0)} kg`});
    if(screen&&r)list.push({at:[screen.x,screen.y+screen.h*.6,screen.z],title:'바람',text:`${num(r.l.pressure)} kPa · 미는 힘 ${num(r.l.front,1)} kN`,extra:tag(group('stability'),'넘어짐')});
    if(posts[0]&&r)list.push({at:[posts[0].x+posts[0].w/2,posts[0].y+posts[0].h*.6,posts[0].z+posts[0].d/2],title:'기둥',text:esc(kids().foundWin.FoundationEstimate.column(r.p).label),extra:tag(group('steel'),'기둥·앵커')});
    if(footings[0]&&r)list.push({at:[footings[0].x+footings[0].w,footings[0].y+footings[0].h*.5,footings[0].z+footings[0].d/2],title:'기초',text:`${num(r.g.L/1000)} × ${num(r.g.W/1000)} × ${num(r.g.H/1000)} m`,extra:tag(group('ground'),'땅')+tag(group('concrete'),'콘크리트')});
    // Labels sit above-right or above-left of their point; overlapping labels are lifted until they clear.
    const W=200,H=c=>c.extra?(c.extra.match(/<em/g)||[]).length*18+58:46,placed=[];
    const items=list.map(c=>{const [x,y]=F3.screenPoint(sceneModel,state,c.at);return {...c,x,y,side:x>state.width*.55?'left':'right'};}).filter(c=>c.x>0&&c.y>0&&c.x<state.width&&c.y<state.height).sort((a,b)=>b.y-a.y);
    for(const c of items){
      const h=H(c),x0=c.side==='right'?c.x+18:c.x-18-W;let dy=0;
      for(let guard=0;guard<12;guard++){const top=c.y-26-dy-h,hit=placed.find(p=>x0<p.x1&&x0+W>p.x0&&top<p.y1&&top+h>p.y0);if(!hit)break;dy+=top+h-hit.y0+8;}
      c.dy=Math.max(0,dy);placed.push({x0,x1:x0+W,y0:c.y-26-c.dy-h,y1:c.y-26-c.dy});
    }
    box.innerHTML=items.map(c=>`<div class="callout ${c.side}" style="left:${c.x.toFixed(0)}px;top:${c.y.toFixed(0)}px;--dy:${c.dy.toFixed(0)}px"><i></i><div><b>${c.title}</b><span>${c.text}</span>${c.extra||''}</div></div>`).join('');
  }
  function repaint3d(){
    frame3d=0;const stage=$('dash-stage');if(!stage)return;const view=stage.querySelector('.g-3d-view');
    if(!sceneModel){view.innerHTML='<p class="g-error">입력 오류를 고치면 3D가 나옵니다.</p>';stage.querySelector('.dash-callouts').innerHTML='';return;}
    const state=stageState(stage);view.innerHTML=kids().frameWin.Frame3D.render(sceneModel,state);callouts(stage,state);
  }
  const schedule3d=()=>{if(!frame3d)frame3d=requestAnimationFrame(repaint3d);};
  document.addEventListener('pointerdown',e=>{const v=e.target.closest?.('#dash-stage .g-3d-view');if(!v||!sceneModel)return;drag3d={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:view3d.yaw,pitch:view3d.pitch};v.setPointerCapture(e.pointerId);e.preventDefault();});
  document.addEventListener('pointermove',e=>{if(!drag3d||drag3d.id!==e.pointerId)return;view3d.yaw=drag3d.yaw+(e.clientX-drag3d.x)*.009;view3d.pitch=Math.max(-1.1,Math.min(1.1,drag3d.pitch+(e.clientY-drag3d.y)*.007));schedule3d();});
  for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{if(drag3d?.id===e.pointerId)drag3d=null;});
  document.addEventListener('wheel',e=>{if(!e.target.closest?.('#dash-stage .g-3d-view'))return;e.preventDefault();view3d.zoom=Math.max(.5,Math.min(6,view3d.zoom*(e.deltaY<0?1.12:1/1.12)));schedule3d();},{passive:false});

  const kpi=(icon,label,value,unit='')=>`<div class="kpi"><span class="kpi-icon" aria-hidden="true">${icon}</span><div><small>${esc(label)}</small><b>${value}${unit?` <em>${esc(unit)}</em>`:''}</b></div></div>`;
  function paintSide(){
    const err=$('guide-error');if(err){err.textContent=error;err.hidden=!error;}
    const {foundWin,foundation}=kids(),r=foundation.getResult(),PL=foundWin.FoundationPlain,L=PL.LIGHTS;
    sceneModel=buildScene();
    const left=$('dash-left'),bottom=$('dash-bottom');
    if(left)left.innerHTML=r?`<h3>현장 요약</h3>${kpi('🌬','기본풍속',r.l.windDetail?num(r.l.windDetail.basicWind,0):'예시',r.l.windDetail?'m/s':'')}${kpi('💨','설계 풍압',num(r.l.pressure),'kPa')}${kpi('➡','바람이 미는 힘',num(r.l.front,1),'kN')}${kpi('⚖','전광판 1대 무게',num(r.l.upper/9.80665*1000,0),'kg')}${kpi('▦','기초 1개',`${num(r.g.L/1000,1)}×${num(r.g.W/1000,1)}×${num(r.g.H/1000,1)}`,'m')}${kpi('🧱','콘크리트',num(r.total.orderedConcrete,1),'m³')}${kpi('🔩','철근',num(r.total.rebarGross,0),'kg')}`:'<p class="g-error">입력 오류</p>';
    if(bottom){
      if(r){const s=PL.summarize(r,foundation.getNotes());
        bottom.innerHTML=s.groups.map(g=>{const u=g.worst?g.worst.ratio:null;return `<div class="tile plain-${g.light}"><div class="ring" style="--p:${u===null?0:Math.min(100,u*100).toFixed(0)}"><span>${u===null?'—':Math.round(u*100)+'%'}</span></div><div><small>${esc(g.short)}</small><b>${L[g.light].icon} ${L[g.light].word}</b></div></div>`;}).join('')+`<div class="tile overall plain-${s.overall}"><div><small>종합 · 참고용</small><b>${L[s.overall].icon} ${L[s.overall].word}</b><span>${s.unconfirmed.length?`확인 안 된 자료 ${s.unconfirmed.length}개`:'자료 확인됨'}</span></div></div>`;}
      else bottom.innerHTML='';
    }
    repaint3d();
  }
  function render(){
    const root=$('guide-root');if(!root||!S()?.getState().ready)return;
    let a;try{a=answers();}catch{return;}
    const body=step===1?stepPlace(a):step===2?stepSign(a):step===3?stepSupport(a):stepResult();
    kids().foundWin.FoundationPlain.ensureStyle(document);kids().foundWin.FoundationPlain.bindTerms(document);
    root.innerHTML=`<div class="dash">
<div id="dash-stage" class="dash-stage"><div class="g-3d-view" aria-label="설치 모습 3D 예시 · 끌어서 회전"></div><div class="dash-callouts" aria-hidden="true"></div></div>
<ol class="g-steps dash-steps" aria-label="진행 단계">${STEPS.map(([,t],i)=>`<li><button type="button" data-guide-step="${i+1}" ${i+1===step?'aria-current="step"':''}><span>${i+1}</span>${esc(t)}</button></li>`).join('')}</ol>
<aside id="dash-left" class="dash-left glass" aria-live="polite"></aside>
<section class="dash-right glass"><form class="g-form" novalidate>${body}<p id="guide-error" class="g-error" role="alert" hidden></p></form>
<div class="g-nav">${step>1?'<button type="button" data-guide-move="-1">← 이전</button>':'<span></span>'}<span class="g-count">${step} / 4</span>${step<4?`<button type="button" class="primary" data-guide-move="1">${step===3?'결과 보기':'다음'} →</button>`:'<span></span>'}</div></section>
<div id="dash-bottom" class="dash-bottom"></div>
<div class="g-3d-tools dash-tools" role="group" aria-label="3D 보기 조정">${[['angle','입체'],['front','정면'],['side','측면']].map(([k,t])=>`<button type="button" data-g3d="${k}">${t}</button>`).join('')}<button type="button" data-g3d="out" aria-label="축소">−</button><button type="button" data-g3d="in" aria-label="확대">＋</button></div>
</div>`;
    paintSide();
    observer?.disconnect();if(window.ResizeObserver){observer=new ResizeObserver(schedule3d);observer.observe($('dash-stage'));}
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
    else if(b.dataset.g3d){const k=b.dataset.g3d;if(VIEWS[k])Object.assign(view3d,VIEWS[k]);else view3d.zoom=Math.max(.5,Math.min(6,view3d.zoom*(k==='in'?1.2:1/1.2)));repaint3d();}
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
