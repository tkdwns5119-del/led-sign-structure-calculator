(function(root){
  'use strict';
  const colors={edge:'#36b9a0',vertical:'#ffb45f',horizontal:'#b3a1ed',side:'#6cbce6',tie:'#6cbce6',extra:'#e8d1a0',screen:'#1677ba'};
  const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>value.toLocaleString('ko-KR',{maximumFractionDigits:1});
  function geometry(project,result,{posts=false,screen=false,limit=350}={}){
    const boxes=[],g=result.general,materials=new Map(project.materials.map(m=>[m.id,m]));let omitted=0;
    const profile=ref=>{const m=materials.get(ref.materialId);return {face:ref.rotation?m.depth:m.face,depth:ref.rotation?m.face:m.depth};};
    const add=(x,y,z,w,h,d,kind,name,part='')=>{
      if(boxes.length>=limit){omitted++;return;}
      if([x,y,z,w,h,d].every(Number.isFinite)&&w>0&&h>0&&d>0)boxes.push({x,y,z,w,h,d,kind,name,part,color:colors[kind]});
    };
    for(const key of ['front',...(g.planes===2?['back']:[])]){
      const p=result.panels[key],e=p.edges,back=key==='back',z=depth=>back?g.depth-depth:0,label=back?'뒷면':'앞면';
      add(0,0,z(e.left.depth),e.left.face,g.height,e.left.depth,'edge',label+' 좌측 외곽','material');
      add(g.width-e.right.face,0,z(e.right.depth),e.right.face,g.height,e.right.depth,'edge',label+' 우측 외곽');
      add(p.x1,0,z(e.top.depth),p.x2-p.x1,e.top.face,e.top.depth,'edge',label+' 상단 외곽');
      add(p.x1,g.height-e.bottom.face,z(e.bottom.depth),p.x2-p.x1,e.bottom.face,e.bottom.depth,'edge',label+' 하단 외곽');
      const editable=key==='front'||project.backLinked?'front':null;
      for(const part of p.vertical)add(part.start,p.y1,z(part.profile.depth),part.end-part.start,p.y2-p.y1,part.profile.depth,'vertical',label+' 세로 보강 '+part.id,editable?editable+'.vertical':'');
      for(const part of p.horizontal)for(const gap of p.gaps)add(gap.start,part.start,z(part.profile.depth),gap.end-gap.start,part.end-part.start,part.profile.depth,'horizontal',label+' 가로 보강 '+part.id,editable?editable+'.horizontal':'');
    }
    if(g.planes===2)for(const key of ['left','right']){
      const p=result.panels[key],right=key==='right',label=right?'우측면':'좌측면';
      for(const [end,y] of [['top',0],['bottom',g.height-p.edges.bottom.face]]){
        const ref=project[key==='right'&&project.rightLinked?'left':key][end],q=profile(ref);
        add(right?g.width-q.depth:0,y,p.x1,q.depth,p.edges[end].face,p.x2-p.x1,'side',label+' '+(end==='top'?'상단':'하단')+' 연결재');
      }
      const editable=key==='left'||project.rightLinked?'left':null;
      for(const part of p.vertical){const q=profile(part);add(right?g.width-q.face:0,p.y1,part.start,q.face,p.y2-p.y1,part.end-part.start,'side',label+' 세로 보강 '+part.id,editable?editable+'.vertical':'');}
      for(const part of p.horizontal)for(const gap of p.gaps)add(right?g.width-part.profile.depth:0,part.start,gap.start,part.profile.depth,part.end-part.start,gap.end-gap.start,'side',label+' 가로 보강 '+part.id,editable?editable+'.horizontal':'');
    }
    for(const c of result.depthConnectors||[])add(c.x,c.y,c.z,c.width,c.height,c.depth,'tie',c.name+' · '+number(c.depth)+'mm','tie');
    let column=g.width+Math.max(g.width*.09,200),extraSamples=0;
    project.extras.forEach(extra=>{
      const q=profile(extra),sample=Math.min(extra.quantity,4);
      for(let i=0;i<sample;i++){
        const x=posts?g.width*(i+1)/(sample+1)-q.face/2:column+i*(q.face+Math.max(70,g.width*.018));
        add(x,posts?g.height:0,0,q.face,extra.length,q.depth,'extra',extra.name+' · '+number(extra.length)+'mm · 대당 '+extra.quantity+'개');extraSamples++;
      }
      column+=sample*(q.face+Math.max(70,g.width*.018))+Math.max(100,g.width*.05);
    });
    if(screen)add(0,0,-30,g.width,g.height,20,'screen','전광판 화면 · 외형 예시');
    const bounds={min:[0,0,0],max:[g.width,g.height,g.planes===2?g.depth:result.panels.front.edges.left.depth]};
    for(const b of boxes)for(let axis=0;axis<3;axis++){const start=[b.x,b.y,b.z][axis],end=start+[b.w,b.h,b.d][axis];bounds.min[axis]=Math.min(bounds.min[axis],start);bounds.max[axis]=Math.max(bounds.max[axis],end);}
    return {boxes,bounds,omitted,extraSamples,depthTieCount:result.depthConnectors?.length||0,general:g,memberCount:result.rows.reduce((sum,row)=>sum+row.count/g.quantity,0)};
  }
  function projectPoint(point,center,yaw,pitch){
    const x=point[0]-center[0],y=center[1]-point[1],z=point[2]-center[2],a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);
    return [a,-(y*Math.cos(pitch)-b*Math.sin(pitch)),y*Math.sin(pitch)+b*Math.cos(pitch)];
  }
  const corners=b=>[[b.x,b.y,b.z],[b.x+b.w,b.y,b.z],[b.x+b.w,b.y+b.h,b.z],[b.x,b.y+b.h,b.z],[b.x,b.y,b.z+b.d],[b.x+b.w,b.y,b.z+b.d],[b.x+b.w,b.y+b.h,b.z+b.d],[b.x,b.y+b.h,b.z+b.d]];
  function render(model,state){
    const center=model.bounds.min.map((v,i)=>(v+model.bounds.max[i])/2),project=p=>projectPoint(p,center,state.yaw,state.pitch),all=model.boxes.flatMap(b=>corners(b).map(project));
    const minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
    const scale=Math.min(560/Math.max(1,maxX-minX),320/Math.max(1,maxY-minY))*state.zoom;
    const map=p=>[320+(p[0]-(minX+maxX)/2)*scale,210+(p[1]-(minY+maxY)/2)*scale,p[2]];
    const faces=[],indices=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
    for(const box of model.boxes){const points=corners(box).map(project).map(map);indices.forEach((ids,i)=>{const p=ids.map(id=>points[id]);
      const cross=(p[1][0]-p[0][0])*(p[2][1]-p[1][1])-(p[1][1]-p[0][1])*(p[2][0]-p[1][0]);
      if(cross>=0)return;faces.push({points:p,depth:p.reduce((s,q)=>s+q[2],0)/4,box,index:i});
    });}
    // The display is a single broad cover; draw it on the visible side of the
    // assembly to avoid average-depth ordering exposing beams through it.
    faces.sort((a,b)=>a.box.kind==='screen'&&b.box.kind!=='screen'?(Math.cos(state.yaw)>=0?1:-1):b.box.kind==='screen'&&a.box.kind!=='screen'?(Math.cos(state.yaw)>=0?-1:1):b.depth-a.depth);
    const g=model.general,description=`가로 ${number(g.width)}mm, 세로 ${number(g.height)}mm, ${g.planes===2?'전체 깊이 '+number(g.depth)+'mm, 앞뒤 프레임과 측면 연결재':'단면 프레임'}. 세로 보강은 주황색, 가로 보강은 보라색.`;
    return `<svg class="frame-3d-svg" viewBox="0 0 640 420" role="img" tabindex="0" aria-label="${safe(description)} 드래그나 방향키로 회전, 더하기·빼기 키로 확대·축소" data-yaw="${state.yaw.toFixed(3)}" data-pitch="${state.pitch.toFixed(3)}"><title>${safe(description)}</title><defs><radialGradient id="frame3d-glow"><stop stop-color="#345367"/><stop offset="1" stop-color="#152c3f"/></radialGradient></defs><rect width="640" height="420" rx="12" fill="url(#frame3d-glow)"/><ellipse cx="320" cy="380" rx="235" ry="14" fill="#071924" opacity=".38"/>${faces.map(face=>`<polygon points="${face.points.map(p=>p.slice(0,2).map(v=>v.toFixed(2)).join(',')).join(' ')}" fill="${face.box.color}" stroke="#132b3a" stroke-width=".65" stroke-linejoin="round" data-kind="${face.box.kind}" data-frame-part="${face.box.part}" data-selected="${Boolean(state.selectedPart&&face.box.part===state.selectedPart)}" opacity="${state.selectedPart&&face.box.part!==state.selectedPart ? .3 : 1}"><title>${safe(face.box.name)}</title></polygon>${[1,3,5].includes(face.index)?`<polygon points="${face.points.map(p=>p.slice(0,2).map(v=>v.toFixed(2)).join(',')).join(' ')}" fill="#000" opacity="${[.10,.18,.27][Math.floor(face.index/2)]}" pointer-events="none"/>`:''}`).join('')}</svg>`;
  }
  const exported={geometry,projectPoint,render};
  if(typeof module==='object'){module.exports=exported;return;}
  let currentProject=null,currentResult=null,example='current',model=null,drag=null,scheduled=false;
    const state={yaw:-.48,pitch:.24,zoom:1,screen:false,view:'3d',selectedPart:''};
  function markup(){return `<div class="frame-3d-widget"><div class="frame-3d-mode"><button type="button" data-frame-preview="3d" aria-pressed="true">3D 입체 보기</button><button type="button" data-frame-preview="2d" aria-pressed="false">2D 배치도</button></div><div class="frame-3d-output"></div><details class="frame-3d-tools" id="frame-3d-tools"><summary>보기 도구·예시</summary><label class="frame-3d-example">이런 모습이에요<select data-frame-example aria-label="3D 예시 선택"><option value="current">내가 입력한 구조물</option><option value="flat">기본 단면 예시</option><option value="depth">앞뒤·측면 예시</option><option value="posts">지주 2개 설치 예시</option></select></label><div class="frame-3d-controls"><div><button type="button" data-frame-camera="angle" aria-pressed="true">입체</button><button type="button" data-frame-camera="front" aria-pressed="false">정면</button><button type="button" data-frame-camera="side" aria-pressed="false">측면</button></div><div><button type="button" data-frame-zoom="out" aria-label="3D 축소">−</button><button type="button" data-frame-zoom="in" aria-label="3D 확대">＋</button><button type="button" data-frame-camera="reset">원래 보기</button></div></div><label class="frame-3d-screen"><input type="checkbox" data-frame-screen>전광판 화면 덮어 보기</label></details><p class="frame-3d-help">드래그로 회전 · 보강재를 눌러 개수 조절. 방향키로도 회전할 수 있습니다.</p><p class="frame-3d-caption" role="status"></p><div class="frame-3d-legend"><span style="--part:#36b9a0">외곽</span><button type="button" data-frame-part="front.vertical" style="--part:#ffb45f">세로 보강 조절</button><button type="button" data-frame-part="front.horizontal" style="--part:#b3a1ed">가로 보강 조절</button><button type="button" data-frame-part="tie" style="--part:#6cbce6">앞뒤 연결</button><span style="--part:#e8d1a0">지주·추가 부재</span></div></div>`;}
  function buildModel(){
    model=null;if(!currentResult)return;
    let p=currentProject,r=currentResult;
    if(example!=='current'){
      p=root.FramePlanner.createProject();p.general.planes=example==='depth'?2:1;
      if(example==='posts'){p.extras=[{id:'example-post',name:'예시 지주',materialId:'m1',rotation:0,length:2500,quantity:2}];p.materials[0]=root.FramePlanner.material('100');}
      r=root.FramePlanner.calculate(p);
    }
    model=geometry(p,r,{posts:example==='posts',screen:state.screen});
  }
  function paint(){
    scheduled=false;
    document.querySelectorAll('.frame-3d-widget').forEach(widget=>{
      const output=widget.querySelector('.frame-3d-output'),focused=output.contains(document.activeElement);
      output.innerHTML=model?render(model,state):'<p class="frame-3d-error">입력 오류를 수정하면 3D 모양을 확인할 수 있습니다.</p>';
      output.hidden=state.view!=='3d';if(focused)output.querySelector('svg')?.focus({preventScroll:true});
      const flat=widget.parentElement.querySelector('.frame-flat-diagram');if(flat)flat.hidden=state.view!=='2d';
      const live=widget.parentElement.querySelector('#frame-live-size');if(live)live.hidden=state.view==='3d';
      const heading=widget.parentElement.querySelector('[data-frame-preview-title]');if(heading)heading.textContent=state.view==='2d'?'입력한 구조물 배치도':example==='current'?'입력한 구조물 3D':'구조물 3D 예시';
      widget.querySelector('[data-frame-example]').value=example;widget.querySelector('[data-frame-screen]').checked=state.screen;
      widget.querySelector('.frame-3d-tools').hidden=state.view!=='3d';
      for(const b of widget.querySelectorAll('button[data-frame-part]')){b.hidden=b.dataset.framePart==='tie'&&model?.general.planes!==2;b.disabled=example!=='current'||root.FrameUX?.getState().mode!=='simple';b.setAttribute('aria-pressed',String(b.dataset.framePart===state.selectedPart));}
      for(const b of widget.querySelectorAll('[data-frame-preview]'))b.setAttribute('aria-pressed',String(b.dataset.framePreview===state.view));
      for(const b of widget.querySelectorAll('[data-frame-camera]:not([data-frame-camera=reset])')){const c=b.dataset.frameCamera,angle=c==='front'?0:c==='side'?-Math.PI/2:-.48,pitch=c==='angle'?.24:0;b.setAttribute('aria-pressed',String(Math.abs(state.yaw-angle)<.001&&Math.abs(state.pitch-pitch)<.001));}
      for(const selector of ['.frame-3d-example','.frame-3d-controls','.frame-3d-screen','.frame-3d-help','.frame-3d-caption','.frame-3d-legend'])widget.querySelector(selector).hidden=state.view!=='3d';
      const caption=widget.querySelector('.frame-3d-caption'),captionText=!model?'':(example==='current'?'내 입력 · ':'예시만 보기 · 입력값은 유지됩니다. ')+number(model.general.width)+' × '+number(model.general.height)+(model.general.planes===2?' × '+number(model.general.depth):'')+' mm · 1대 기준'+(model.depthTieCount?' · 보강 상하 연결재 '+model.depthTieCount+'개':'')+(model.extraSamples?(example==='posts'?' · 지주 위치는 설치 모습 예시':' · 추가 부재는 오른쪽에 별도 표시, 종류당 최대 4개'):'')+(model.omitted?' · 부재가 많아 일부는 간략 표시':'');
      if(caption.textContent!==captionText)caption.textContent=captionText;
    });
  }
  const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(paint);}};
  function update(p,r){if(currentProject&&currentProject.id!==p.id){example='current';state.selectedPart='';}currentProject=p;currentResult=r;buildModel();paint();}
  function selectPart(part){const next=part||'';if(state.selectedPart===next&&(example==='current'||!next))return;if(next){example='current';state.view='3d';}state.selectedPart=next;buildModel();paint();}
  document.addEventListener('click',event=>{
    const part=event.target.closest('button[data-frame-part]');if(part&&example==='current')root.FrameUX?.focusPart(part.dataset.framePart);
    const b=event.target.closest('.frame-3d-widget button');if(!b)return;
    if(b.dataset.framePreview){state.view=b.dataset.framePreview;paint();}
    if(b.dataset.frameCamera){const camera=b.dataset.frameCamera;state.yaw=camera==='front'?0:camera==='side'?-Math.PI/2:-.48;state.pitch=['front','side'].includes(camera)?0:.24;if(camera==='reset')state.zoom=1;paint();}
    if(b.dataset.frameZoom){state.zoom=Math.max(.6,Math.min(2,state.zoom*(b.dataset.frameZoom==='in'?1.2:1/1.2)));paint();}
  });
  document.addEventListener('change',event=>{
    if(event.target.hasAttribute('data-frame-example')){example=event.target.value;state.selectedPart='';state.view='3d';state.zoom=1;buildModel();paint();}
    if(event.target.hasAttribute('data-frame-screen')){state.screen=event.target.checked;buildModel();paint();}
  });
  document.addEventListener('pointerdown',event=>{
    const svg=event.target.closest('.frame-3d-svg');if(!svg||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:state.yaw,pitch:state.pitch,part:event.target.closest('[data-frame-part]')?.dataset.framePart,moved:false,widget:svg.closest('.frame-3d-widget')};
    // The SVG is redrawn during rotation; retain pointer capture on its stable host.
    const host=svg.closest('.frame-3d-output');host.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});event.preventDefault();
  });
  document.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;if(!drag.moved)return;state.yaw=drag.yaw+(event.clientX-drag.x)*.009;state.pitch=Math.max(-1.15,Math.min(1.15,drag.pitch+(event.clientY-drag.y)*.007));schedule();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{if(drag?.id!==event.pointerId)return;const previous=drag;drag=null;if(type==='pointerup'&&!previous.moved&&previous.part&&example==='current')root.FrameUX?.focusPart(previous.part);});
  document.addEventListener('keydown',event=>{
    if(!event.target.matches('.frame-3d-svg'))return;let handled=true;
    if(event.key==='ArrowLeft')state.yaw-=.12;else if(event.key==='ArrowRight')state.yaw+=.12;else if(event.key==='ArrowUp')state.pitch=Math.max(-1.15,state.pitch-.10);else if(event.key==='ArrowDown')state.pitch=Math.min(1.15,state.pitch+.10);else if(['+','=','-'].includes(event.key))state.zoom=Math.max(.6,Math.min(2,state.zoom*(event.key==='-'?1/1.2:1.2)));else if(event.key==='Home'){state.yaw=-.48;state.pitch=.24;state.zoom=1;}else handled=false;
    if(handled){event.preventDefault();paint();}
  });
  root.Frame3D={...exported,markup,update,selectPart,getState:()=>({...state,example,boxes:model?.boxes.length||0})};
})(typeof globalThis==='object'?globalThis:this);
