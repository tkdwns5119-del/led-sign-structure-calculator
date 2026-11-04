(function(root){
  'use strict';
  const colors={edge:'#36b9a0',vertical:'#ffb45f',horizontal:'#b3a1ed',side:'#6cbce6',tie:'#6cbce6',extra:'#e8d1a0',screen:'#1677ba'};
  const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>value.toLocaleString('ko-KR',{maximumFractionDigits:1});
  const ZOOM={min:.5,max:8,step:1.2};
  function geometry(project,result,{posts=false,screen=false,limit=350}={}){
    const boxes=[],g=result.general,materials=new Map(project.materials.map(m=>[m.id,m]));let omitted=0;
    const profile=ref=>{const m=materials.get(ref.materialId);return {face:ref.rotation?m.depth:m.face,depth:ref.rotation?m.face:m.depth};};
    const nameOf=id=>materials.get(id)?.name||'';
    // info: hover text — member name, cut length (longest side) and material or section.
    const add=(x,y,z,w,h,d,kind,name,part='',material='')=>{
      if(boxes.length>=limit){omitted++;return;}
      if(![x,y,z,w,h,d].every(Number.isFinite)||w<=0||h<=0||d<=0)return;
      const dims=[w,h,d].sort((a,b)=>b-a),info=kind==='screen'?name:[name,'길이 '+number(dims[0])+'mm',material||'단면 '+number(dims[1])+' × '+number(dims[2])+'mm'].join(' · ');
      boxes.push({x,y,z,w,h,d,kind,name,info,part,color:colors[kind]});
    };
    for(const key of ['front',...(g.planes===2?['back']:[])]){
      const p=result.panels[key],e=p.edges,back=key==='back',z=depth=>back?g.depth-depth:0,label=back?'뒷면':'앞면';
      add(0,0,z(e.left.depth),e.left.face,g.height,e.left.depth,'edge',label+' 좌측 외곽','material',e.left.name);
      add(g.width-e.right.face,0,z(e.right.depth),e.right.face,g.height,e.right.depth,'edge',label+' 우측 외곽','',e.right.name);
      add(p.x1,0,z(e.top.depth),p.x2-p.x1,e.top.face,e.top.depth,'edge',label+' 상단 외곽','',e.top.name);
      add(p.x1,g.height-e.bottom.face,z(e.bottom.depth),p.x2-p.x1,e.bottom.face,e.bottom.depth,'edge',label+' 하단 외곽','',e.bottom.name);
      const editable=key==='front'||project.backLinked?'front':null;
      for(const part of p.vertical)add(part.start,p.y1,z(part.profile.depth),part.end-part.start,p.y2-p.y1,part.profile.depth,'vertical',label+' 세로 보강 '+part.id,editable?editable+'.vertical':'',part.profile.name);
      for(const part of p.horizontal)for(const gap of p.gaps)add(gap.start,part.start,z(part.profile.depth),gap.end-gap.start,part.end-part.start,part.profile.depth,'horizontal',label+' 가로 보강 '+part.id,editable?editable+'.horizontal':'',part.profile.name);
    }
    if(g.planes===2)for(const key of ['left','right']){
      const p=result.panels[key],right=key==='right',label=right?'우측면':'좌측면';
      for(const [end,y] of [['top',0],['bottom',g.height-p.edges.bottom.face]]){
        const ref=project[key==='right'&&project.rightLinked?'left':key][end],q=profile(ref);
        add(right?g.width-q.depth:0,y,p.x1,q.depth,p.edges[end].face,p.x2-p.x1,'side',label+' '+(end==='top'?'상단':'하단')+' 연결재','',nameOf(ref.materialId));
      }
      const editable=key==='left'||project.rightLinked?'left':null;
      for(const part of p.vertical){const q=profile(part);add(right?g.width-q.face:0,p.y1,part.start,q.face,p.y2-p.y1,part.end-part.start,'side',label+' 세로 보강 '+part.id,editable?editable+'.vertical':'',nameOf(part.materialId)||part.profile?.name);}
      for(const part of p.horizontal)for(const gap of p.gaps)add(right?g.width-part.profile.depth:0,part.start,gap.start,part.profile.depth,part.end-part.start,gap.end-gap.start,'side',label+' 가로 보강 '+part.id,editable?editable+'.horizontal':'',part.profile.name);
    }
    for(const c of result.depthConnectors||[])add(c.x,c.y,c.z,c.width,c.height,c.depth,'tie',c.name,'tie',nameOf(c.materialId));
    let column=g.width+Math.max(g.width*.09,200),extraSamples=0;
    project.extras.forEach(extra=>{
      const q=profile(extra),sample=Math.min(extra.quantity,4);
      for(let i=0;i<sample;i++){
        const x=posts?g.width*(i+1)/(sample+1)-q.face/2:column+i*(q.face+Math.max(70,g.width*.018));
        add(x,posts?g.height:0,0,q.face,extra.length,q.depth,'extra',extra.name+' · 대당 '+extra.quantity+'개','',nameOf(extra.materialId));extraSamples++;
      }
      column+=sample*(q.face+Math.max(70,g.width*.018))+Math.max(100,g.width*.05);
    });
    if(screen)add(0,0,-30,g.width,g.height,20,'screen','전광판 화면 · 외형 예시');
    const bounds={min:[0,0,0],max:[g.width,g.height,g.planes===2?g.depth:result.panels.front.edges.left.depth]};
    for(const b of boxes)for(let axis=0;axis<3;axis++){const start=[b.x,b.y,b.z][axis],end=start+[b.w,b.h,b.d][axis];bounds.min[axis]=Math.min(bounds.min[axis],start);bounds.max[axis]=Math.max(bounds.max[axis],end);}
    return {boxes,bounds,omitted,extraSamples,depthTieCount:result.depthConnectors?.length||0,general:g,memberCount:result.rows.reduce((sum,row)=>sum+row.count/g.quantity,0)};
  }
  // World axes: x right, y down, z toward the back. Output: screen x, screen y (down), depth (larger = farther).
  // Positive pitch looks down on the frame from above, so higher members are nearer to the viewer.
  function projectPoint(point,center,yaw,tilt){
    const pitch=-tilt,x=point[0]-center[0],y=center[1]-point[1],z=point[2]-center[2],a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);
    return [a,-(y*Math.cos(pitch)-b*Math.sin(pitch)),y*Math.sin(pitch)+b*Math.cos(pitch)];
  }
  const corners=b=>[[b.x,b.y,b.z],[b.x+b.w,b.y,b.z],[b.x+b.w,b.y+b.h,b.z],[b.x,b.y+b.h,b.z],[b.x,b.y,b.z+b.d],[b.x+b.w,b.y,b.z+b.d],[b.x+b.w,b.y+b.h,b.z+b.d],[b.x,b.y+b.h,b.z+b.d]];
  const FACES=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]],NORMALS=[[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];
  // Light comes from the viewer's upper left, so the visible faces keep a readable contrast at any angle.
  const LIGHT=(v=>{const n=Math.hypot(...v);return v.map(x=>x/n);})([-.45,-.8,-.4]);
  function shade(hex,factor){
    const c=parseInt(hex.slice(1),16),channel=shift=>Math.round(Math.min(255,((c>>shift)&255)*factor)).toString(16).padStart(2,'0');
    return '#'+channel(16)+channel(8)+channel(0);
  }
  // Painter's order for axis-aligned boxes: for each pair whose screen footprints overlap, an axis plane
  // that separates them tells which one is nearer to the viewer. Boxes are then drawn far to near.
  function drawOrder(boxes,screen,axisDepth){
    const n=boxes.length,after=Array.from({length:n},()=>[]),indegree=new Array(n).fill(0),eps=.01;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const a=screen[i],b=screen[j];
      if(a.maxX<=b.minX+.01||b.maxX<=a.minX+.01||a.maxY<=b.minY+.01||b.maxY<=a.minY+.01)continue;
      const A=boxes[i],B=boxes[j],amin=[A.x,A.y,A.z],amax=[A.x+A.w,A.y+A.h,A.z+A.d],bmin=[B.x,B.y,B.z],bmax=[B.x+B.w,B.y+B.h,B.z+B.d];
      let best=null;
      for(let k=0;k<3;k++){
        const weight=Math.abs(axisDepth[k]);if(weight<1e-9)continue;
        const side=amax[k]<=bmin[k]+eps?-1:bmax[k]<=amin[k]+eps?1:0;
        if(side&&(!best||weight>best.weight))best={k,side,weight};
      }
      if(!best)continue;
      // side -1: A lies on the low side of the plane. Low side is nearer when depth grows with the axis.
      const aNearer=best.side<0?axisDepth[best.k]>0:axisDepth[best.k]<0,far=aNearer?j:i,near=aNearer?i:j;
      after[far].push(near);indegree[near]++;
    }
    const order=[],done=new Array(n).fill(false),byDepth=[...Array(n).keys()].sort((p,q)=>screen[q].depth-screen[p].depth);
    for(let count=0;count<n;count++){
      let pick=byDepth.find(i=>!done[i]&&indegree[i]===0);
      if(pick===undefined)pick=byDepth.find(i=>!done[i]); // a cycle (intersecting boxes): fall back to depth
      done[pick]=true;order.push(pick);for(const next of after[pick])indegree[next]--;
    }
    return order;
  }
  function render(model,state){
    const center=model.bounds.min.map((v,i)=>(v+model.bounds.max[i])/2),project=p=>projectPoint(p,center,state.yaw,state.pitch);
    const projected=model.boxes.map(b=>corners(b).map(project)),all=projected.flat();
    const minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
    const zoom=state.zoom||1,panX=state.panX||0,panY=state.panY||0;
    const scale=Math.min(560/Math.max(1,maxX-minX),320/Math.max(1,maxY-minY))*zoom;
    const map=p=>[320+panX+(p[0]-(minX+maxX)/2)*scale,210+panY+(p[1]-(minY+maxY)/2)*scale,p[2]];
    const origin=project([0,0,0]),axisDepth=[[1,0,0],[0,1,0],[0,0,1]].map(e=>project(e)[2]-origin[2]);
    const viewNormals=NORMALS.map(n=>{const p=project(n);return [p[0]-origin[0],p[1]-origin[1],p[2]-origin[2]];});
    const screens=projected.map(points=>{const m=points.map(map),xs=m.map(p=>p[0]),ys=m.map(p=>p[1]);return {points:m,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),depth:m.reduce((s,p)=>s+p[2],0)/8};});
    const order=drawOrder(model.boxes,screens,axisDepth),hover=state.hover??-1;
    const polygons=[];
    for(const index of order){
      const box=model.boxes[index],points=screens[index].points,selected=Boolean(state.selectedPart&&box.part===state.selectedPart),dim=state.selectedPart&&!selected;
      FACES.forEach((ids,face)=>{
        const p=ids.map(id=>points[id]),cross=(p[1][0]-p[0][0])*(p[2][1]-p[1][1])-(p[1][1]-p[0][1])*(p[2][0]-p[1][0]);
        if(cross>=0)return;
        const nv=viewNormals[face],light=Math.max(0,nv[0]*LIGHT[0]+nv[1]*LIGHT[1]+nv[2]*LIGHT[2]),fill=shade(box.color,.62+.5*light);
        const base=selected?'#ffffff':shade(box.color,.38),baseWidth=selected?1.6:.7,hovered=index===hover;
        polygons.push(`<polygon points="${p.map(q=>q[0].toFixed(2)+','+q[1].toFixed(2)).join(' ')}" fill="${fill}" stroke="${hovered?'#ffffff':base}" stroke-width="${hovered?1.6:baseWidth}" stroke-linejoin="round" data-stroke="${base}" data-width="${baseWidth}"${hovered?' data-hover="true"':''} data-index="${index}" data-kind="${box.kind}" data-frame-part="${box.part}" data-selected="${selected}"${dim?' opacity=".3"':''}></polygon>`);
      });
    }
    const g=model.general,description=`가로 ${number(g.width)}mm, 세로 ${number(g.height)}mm, ${g.planes===2?'전체 깊이 '+number(g.depth)+'mm, 앞뒤 프레임과 측면 연결재':'단면 프레임'}. 세로 보강은 주황색, 가로 보강은 보라색.`;
    return `<svg class="frame-3d-svg" viewBox="0 0 640 420" role="img" tabindex="0" aria-label="${safe(description)} 드래그나 방향키로 회전, 마우스 휠이나 더하기·빼기 키로 확대·축소, Shift+드래그로 이동" data-yaw="${state.yaw.toFixed(3)}" data-pitch="${state.pitch.toFixed(3)}"><title>${safe(description)}</title><defs><radialGradient id="frame3d-glow"><stop stop-color="#345367"/><stop offset="1" stop-color="#152c3f"/></radialGradient></defs><rect width="640" height="420" rx="12" fill="url(#frame3d-glow)"/><ellipse cx="${(320+panX).toFixed(1)}" cy="${(380+panY).toFixed(1)}" rx="${(235*Math.min(zoom,2)).toFixed(1)}" ry="14" fill="#071924" opacity=".38"/>${polygons.join('')}</svg>`;
  }
  const exported={geometry,projectPoint,render,drawOrder};
  if(typeof module==='object'){module.exports=exported;return;}
  let currentProject=null,currentResult=null,example='current',model=null,drag=null,scheduled=false;
  const DEFAULT_VIEW={yaw:-.48,pitch:.24,zoom:1,panX:0,panY:0};
  const state={...DEFAULT_VIEW,screen:false,view:'3d',selectedPart:'',expanded:false,hover:null};
  function markup(){return `<div class="frame-3d-widget"><div class="frame-3d-mode"><button type="button" data-frame-preview="3d" aria-pressed="true">3D 입체 보기</button><button type="button" data-frame-preview="2d" aria-pressed="false">2D 배치도</button><button type="button" class="frame-3d-expand" data-frame-expand aria-pressed="false">크게 보기</button></div><div class="frame-3d-output"></div><div class="frame-3d-tip" role="tooltip" hidden></div><details class="frame-3d-tools" id="frame-3d-tools"><summary>보기 도구·예시</summary><label class="frame-3d-example">이런 모습이에요<select data-frame-example aria-label="3D 예시 선택"><option value="current">내가 입력한 구조물</option><option value="flat">기본 단면 예시</option><option value="depth">앞뒤·측면 예시</option><option value="posts">지주 2개 설치 예시</option></select></label><div class="frame-3d-controls"><div><button type="button" data-frame-camera="angle" aria-pressed="true">입체</button><button type="button" data-frame-camera="front" aria-pressed="false">정면</button><button type="button" data-frame-camera="side" aria-pressed="false">측면</button></div><div><button type="button" data-frame-zoom="out" aria-label="3D 축소">−</button><button type="button" data-frame-zoom="in" aria-label="3D 확대">＋</button><button type="button" data-frame-camera="reset">원래 보기</button></div></div><label class="frame-3d-screen"><input type="checkbox" data-frame-screen>전광판 화면 덮어 보기</label></details><p class="frame-3d-help">드래그로 회전 · 휠로 확대 · Shift+드래그(또는 오른쪽 버튼)로 이동 · 부재에 마우스를 올리면 이름·길이·규격 표시 · 보강재를 눌러 개수 조절</p><p class="frame-3d-caption" role="status"></p><div class="frame-3d-legend"><span style="--part:#36b9a0">외곽</span><button type="button" data-frame-part="front.vertical" style="--part:#ffb45f">세로 보강 조절</button><button type="button" data-frame-part="front.horizontal" style="--part:#b3a1ed">가로 보강 조절</button><button type="button" data-frame-part="tie" style="--part:#6cbce6">앞뒤 연결</button><span style="--part:#e8d1a0">지주·추가 부재</span></div></div>`;}
  function buildModel(){
    model=null;state.hover=null;if(!currentResult)return;
    let p=currentProject,r=currentResult;
    if(example!=='current'){
      p=root.FramePlanner.createProject();p.general.planes=example==='depth'?2:1;
      if(example==='posts'){p.extras=[{id:'example-post',name:'예시 지주',materialId:'m1',rotation:0,length:2500,quantity:2}];p.materials[0]=root.FramePlanner.material('100');}
      r=root.FramePlanner.calculate(p);
    }
    model=geometry(p,r,{posts:example==='posts',screen:state.screen});
  }
  // Hover only restyles the hovered box's polygons; repainting would replace the node under the pointer.
  function highlight(index){
    state.hover=index;
    document.querySelectorAll('.frame-3d-svg').forEach(svg=>{
      svg.querySelectorAll('polygon[data-hover="true"]').forEach(p=>{p.setAttribute('stroke',p.dataset.stroke);p.setAttribute('stroke-width',p.dataset.width);p.removeAttribute('data-hover');});
      if(index!==null)svg.querySelectorAll(`polygon[data-index="${index}"]`).forEach(p=>{p.setAttribute('stroke','#ffffff');p.setAttribute('stroke-width','1.6');p.dataset.hover='true';});
    });
  }
  function hideTip(){document.querySelectorAll('.frame-3d-tip').forEach(tip=>{tip.hidden=true;});}
  function paint(){
    scheduled=false;
    document.querySelectorAll('.frame-3d-widget').forEach(widget=>{
      const output=widget.querySelector('.frame-3d-output'),focused=output.contains(document.activeElement);
      output.innerHTML=model?render(model,state):'<p class="frame-3d-error">입력 오류를 수정하면 3D 모양을 확인할 수 있습니다.</p>';
      output.hidden=state.view!=='3d';if(focused)output.querySelector('svg')?.focus({preventScroll:true});
      widget.classList.toggle('is-expanded',state.expanded&&state.view==='3d');document.documentElement.classList.toggle('frame-3d-locked',state.expanded&&state.view==='3d');
      const expand=widget.querySelector('[data-frame-expand]');expand.hidden=state.view!=='3d';expand.setAttribute('aria-pressed',String(state.expanded));expand.textContent=state.expanded?'작게 보기':'크게 보기';
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
  const clampZoom=z=>Math.max(ZOOM.min,Math.min(ZOOM.max,z));
  function setView(view){Object.assign(state,view);}
  // Zoom about an SVG point so the spot under the cursor stays put.
  function zoomAt(factor,sx=320,sy=210){
    const z1=state.zoom,z2=clampZoom(z1*factor);if(z2===z1)return false;
    state.panX=sx-320-(sx-320-state.panX)*(z2/z1);state.panY=sy-210-(sy-210-state.panY)*(z2/z1);state.zoom=z2;return true;
  }
  const svgPoint=(svg,event)=>{const r=svg.getBoundingClientRect();return [(event.clientX-r.left)/r.width*640,(event.clientY-r.top)/r.height*420,640/r.width];};
  function update(p,r){if(currentProject&&currentProject.id!==p.id){example='current';state.selectedPart='';}currentProject=p;currentResult=r;buildModel();paint();}
  function selectPart(part){const next=part||'';if(state.selectedPart===next&&(example==='current'||!next))return;if(next){example='current';state.view='3d';}state.selectedPart=next;buildModel();paint();}
  document.addEventListener('click',event=>{
    const part=event.target.closest('button[data-frame-part]');if(part&&example==='current')root.FrameUX?.focusPart(part.dataset.framePart);
    const b=event.target.closest('.frame-3d-widget button');if(!b)return;
    if(b.dataset.framePreview){state.view=b.dataset.framePreview;if(state.view!=='3d')state.expanded=false;paint();}
    if(b.hasAttribute('data-frame-expand')){state.expanded=!state.expanded;hideTip();paint();b.closest('.frame-3d-widget').querySelector('.frame-3d-svg')?.focus({preventScroll:true});}
    if(b.dataset.frameCamera){const camera=b.dataset.frameCamera;state.yaw=camera==='front'?0:camera==='side'?-Math.PI/2:-.48;state.pitch=['front','side'].includes(camera)?0:.24;if(camera==='reset')setView(DEFAULT_VIEW);paint();}
    if(b.dataset.frameZoom){zoomAt(b.dataset.frameZoom==='in'?ZOOM.step:1/ZOOM.step);paint();}
  });
  document.addEventListener('change',event=>{
    if(event.target.hasAttribute('data-frame-example')){example=event.target.value;state.selectedPart='';state.view='3d';setView({zoom:1,panX:0,panY:0});buildModel();paint();}
    if(event.target.hasAttribute('data-frame-screen')){state.screen=event.target.checked;buildModel();paint();}
  });
  document.addEventListener('wheel',event=>{
    const svg=event.target.closest?.('.frame-3d-svg');if(!svg)return;event.preventDefault();
    const [sx,sy]=svgPoint(svg,event);if(zoomAt(Math.pow(ZOOM.step,-Math.sign(event.deltaY)*Math.min(3,Math.abs(event.deltaY)/100||1)),sx,sy))schedule();
  },{passive:false});
  document.addEventListener('contextmenu',event=>{if(event.target.closest?.('.frame-3d-svg'))event.preventDefault();});
  document.addEventListener('pointerdown',event=>{
    const svg=event.target.closest('.frame-3d-svg');if(!svg||![0,1,2].includes(event.button))return;
    const pan=event.button!==0||event.shiftKey;hideTip();
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:state.yaw,pitch:state.pitch,panX:state.panX,panY:state.panY,pan,unit:svgPoint(svg,event)[2],part:event.target.closest('[data-frame-part]')?.dataset.framePart,moved:false,widget:svg.closest('.frame-3d-widget')};
    // The SVG is redrawn during rotation; retain pointer capture on its stable host.
    const host=svg.closest('.frame-3d-output');host.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});event.preventDefault();
  });
  function showTip(event){
    const polygon=event.target.closest?.('.frame-3d-svg polygon[data-index]'),svg=event.target.closest?.('.frame-3d-svg');
    const widget=svg?.closest('.frame-3d-widget'),tip=widget?.querySelector('.frame-3d-tip');
    if(!polygon||!model){if(state.hover!==null)highlight(null);hideTip();return;}
    const index=Number(polygon.dataset.index),box=model.boxes[index];if(!box)return;
    tip.textContent=box.info;tip.hidden=false;
    const area=widget.getBoundingClientRect(),x=event.clientX-area.left+14,y=event.clientY-area.top+16;
    tip.style.left=Math.min(x,area.width-tip.offsetWidth-6)+'px';tip.style.top=y+'px';
    if(state.hover!==index)highlight(index);
  }
  document.addEventListener('pointermove',event=>{
    if(!drag){if(event.pointerType!=='touch')showTip(event);return;}
    if(drag.id!==event.pointerId)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;if(!drag.moved)return;
    if(drag.pan){state.panX=drag.panX+(event.clientX-drag.x)*drag.unit;state.panY=drag.panY+(event.clientY-drag.y)*drag.unit;}
    else{state.yaw=drag.yaw+(event.clientX-drag.x)*.009;state.pitch=Math.max(-1.15,Math.min(1.15,drag.pitch+(event.clientY-drag.y)*.007));}
    schedule();
  });
  document.addEventListener('pointerout',event=>{if(!drag&&event.target.isConnected&&event.target.closest?.('.frame-3d-svg')&&!event.relatedTarget?.closest?.('.frame-3d-svg')){hideTip();if(state.hover!==null)highlight(null);}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,event=>{if(drag?.id!==event.pointerId)return;const previous=drag;drag=null;if(type==='pointerup'&&!previous.moved&&!previous.pan&&previous.part&&example==='current')root.FrameUX?.focusPart(previous.part);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&state.expanded){state.expanded=false;paint();return;}
    if(!event.target.matches('.frame-3d-svg'))return;let handled=true;const step=24;
    if(event.shiftKey&&event.key.startsWith('Arrow')){if(event.key==='ArrowLeft')state.panX-=step;else if(event.key==='ArrowRight')state.panX+=step;else if(event.key==='ArrowUp')state.panY-=step;else state.panY+=step;}
    else if(event.key==='ArrowLeft')state.yaw-=.12;else if(event.key==='ArrowRight')state.yaw+=.12;else if(event.key==='ArrowUp')state.pitch=Math.max(-1.15,state.pitch-.10);else if(event.key==='ArrowDown')state.pitch=Math.min(1.15,state.pitch+.10);
    else if(['+','=','-'].includes(event.key))zoomAt(event.key==='-'?1/ZOOM.step:ZOOM.step);
    else if(event.key==='Home')setView(DEFAULT_VIEW);else handled=false;
    if(handled){event.preventDefault();hideTip();paint();}
  });
  root.Frame3D={...exported,markup,update,selectPart,getState:()=>({...state,example,boxes:model?.boxes.length||0})};
})(typeof globalThis==='object'?globalThis:this);
