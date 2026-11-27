// SolidCraft script export: the frame members (Frame3D boxes) and, when given, the foundation (footings,
// necks, grout, base plates and steel posts) as a JSON command list that SolidCraft runs with
// `solidcraft-cli run model.json --out model.step` or from its script runner.
// SolidCraft axes: X along the board width (centred), Y depth (front of the board at −Y), Z up from
// the ground line (GL = 0), millimetres.
(function(root){
  'use strict';
  const MATERIALS={
    steel:{name:'전광판 강재 (7.85 g/cm³)',density_g_cm3:7.85,color:'#64878f',opacity:1},
    post:{name:'전광판 기둥 강재 (7.85 g/cm³)',density_g_cm3:7.85,color:'#3f5f6b',opacity:1},
    concrete:{name:'기초 콘크리트 (2.4 g/cm³ 가정)',density_g_cm3:2.4,color:'#c3c8cd',opacity:0.35},
    grout:{name:'무수축 그라우트 (2.2 g/cm³ 가정)',density_g_cm3:2.2,color:'#9aa3ab',opacity:0.6}
  };
  const round=v=>Math.round(v*1000)/1000;
  const finite=(...v)=>v.every(Number.isFinite);

  function writer(){
    // shapes: the same parts as plain boxes (cylinders as their square envelope) for the on-screen 3D preview.
    const commands=[],bodies=new Map(),used=new Set(),shapes=[];
    const unique=name=>{let base=String(name).replace(/\s+/g,' ').trim()||'부재',out=base,i=2;while(used.has(out))out=`${base} (${i++})`;used.add(out);return out;};
    const own=(kind,name)=>{if(!bodies.has(kind))bodies.set(kind,[]);bodies.get(kind).push(name);};
    return {
      commands,bodies,shapes,
      box(kind,name,[x,y,z],[l,w,h],color=null){
        if(!finite(x,y,z,l,w,h)||l<=0||w<=0||h<=0)return null;
        const body=unique(name);shapes.push({kind,name:body,x,y,z,l,w,h,color});
        commands.push({command:'solid.box',params:{corner:[round(x),round(y),round(z)],length:round(l),width:round(w),height:round(h),name:body,body_name:body}});
        own(kind,body);return body;
      },
      cut(name,body,[x,y,z],[l,w,h]){commands.push({command:'solid.box',params:{corner:[round(x),round(y),round(z)],length:round(l),width:round(w),height:round(h),operation:'cut',targets:[body],name:unique(name)}});},
      join(name,body,[x,y,z],[l,w,h]){commands.push({command:'solid.box',params:{corner:[round(x),round(y),round(z)],length:round(l),width:round(w),height:round(h),operation:'join',targets:[body],name:unique(name)}});},
      cylinder(kind,name,[x,y,z],diameter,height){
        if(!finite(x,y,z,diameter,height)||diameter<=0||height<=0)return null;
        const body=unique(name);shapes.push({kind,name:body,x:x-diameter/2,y:y-diameter/2,z,l:diameter,w:diameter,h:height,round:true});
        commands.push({command:'solid.cylinder',params:{diameter:round(diameter),height:round(height),base:[round(x),round(y),round(z)],axis:'Z',name:body,body_name:body}});
        own(kind,body);return body;
      },
      cutCylinder(name,body,[x,y,z],diameter,height){commands.push({command:'solid.cylinder',params:{diameter:round(diameter),height:round(height),base:[round(x),round(y),round(z)],axis:'Z',operation:'cut',targets:[body],name:unique(name)}});}
    };
  }

  // Frame members: Frame3D boxes are x from the left, y down from the top, z back from the front face.
  // Extra members drawn beside the frame are samples without a real position, so they are left out.
  function frameMembers(w,geometry,base){
    const width=geometry.general.width,height=geometry.general.height,depth=geometry.bounds.max[2]-geometry.bounds.min[2],front=geometry.bounds.min[2];
    let count=0;
    for(const b of geometry.boxes){
      if(b.kind==='extra'||b.kind==='screen')continue;
      if(w.box('steel',b.name,[b.x-width/2,b.z-front-depth/2,base+height-b.y-b.h],[b.w,b.d,b.h],b.color))count++;
    }
    return count;
  }

  // Steel post section standing at (cx, 0) from z0 to z1.
  function post(w,p,name,cx,z0,z1){
    const h=z1-z0;if(!(h>0))return null;
    const t=p.columnThickness;
    if(p.columnShape==='circle'){
      const body=w.cylinder('post',name,[cx,0,z0],p.columnDiameter,h);
      if(body&&t>0&&2*t<p.columnDiameter)w.cutCylinder(name+' 속',body,[cx,0,z0],p.columnDiameter-2*t,h);
      return body;
    }
    if(p.columnShape==='h'&&t>0&&p.columnFlange>0){
      const bf=p.columnWidth,d=p.columnDepth,tf=p.columnFlange;
      // Web along the front wind (Y): flanges are the front and back plates.
      const body=w.box('post',name,[cx-bf/2,-d/2,z0],[bf,tf,h]);
      if(body){w.join(name+' 웹',body,[cx-t/2,-d/2+tf,z0],[t,d-2*tf,h]);w.join(name+' 뒤 플랜지',body,[cx-bf/2,d/2-tf,z0],[bf,tf,h]);}
      return body;
    }
    const bw=p.columnShape==='rect'?p.columnWidth:150,bd=p.columnShape==='rect'?p.columnDepth:150;
    const body=w.box('post',p.columnShape==='schematic'?name+' (개략 150각)':name,[cx-bw/2,-bd/2,z0],[bw,bd,h]);
    if(body&&p.columnShape==='rect'&&t>0&&2*t<Math.min(bw,bd))w.cut(name+' 속',body,[cx-bw/2+t,-bd/2+t,z0],[bw-2*t,bd-2*t,h]);
    return body;
  }

  // Foundation of one board: footing(s), neck(s), grout, base plate(s) and post(s). Posts rise from the
  // plate to `postTop` (frame post length when the frame marks one, else the bottom of the screen).
  function foundationMembers(w,r,{postTop}){
    const {p,g}=r,shared=r.supports?.shared&&p.type==='single',footings=shared?p.qty:1;
    const spacing=shared?p.foundationSpacing:0,depth=g.depth*1000,embed=g.embed*1000;
    const centers=Array.from({length:footings},(_,i)=>(i-(footings-1)/2)*spacing);
    const necks=p.type==='combined'?[-p.postSpacing/2,p.postSpacing/2]:g.neck?[0]:[];
    const plateL=p.plateShape==='circle'?p.plateDiameter:p.plateL,plateW=p.plateShape==='circle'?p.plateDiameter:p.plateW,plateT=p.plateThickness>0?p.plateThickness:20,grout=p.groutThickness||0;
    let posts=0;
    centers.forEach((cx,i)=>{
      const tag=footings>1?` ${i+1}`:'';
      w.box('concrete',`기초${tag} 푸팅`,[cx-g.L/2,-g.W/2,-depth],[g.L,g.W,g.H]);
      for(const [j,dx] of necks.entries()){
        const x=cx+dx,ntag=tag+(necks.length>1?`-${j+1}`:'');
        w.box('concrete',`기초${ntag} 목`,[x-g.cL/2,-g.cW/2,-embed],[g.cL,g.cW,g.cH]);
        const top=g.above;
        if(grout>0)w.box('grout',`그라우트${ntag}`,[x-plateL/2,-plateW/2,top],[plateL,plateW,grout]);
        if(p.plateShape==='circle')w.cylinder('steel',`베이스플레이트${ntag}`,[x,0,top+grout],p.plateDiameter,plateT);
        else w.box('steel',`베이스플레이트${ntag}`,[x-plateL/2,-plateW/2,top+grout],[plateL,plateW,plateT]);
        if(post(w,p,`기둥${ntag}`,x,top+grout+plateT,postTop))posts++;
      }
    });
    return {footings,posts};
  }

  function materialCommands(w){
    const out=[];
    for(const [kind,list] of w.bodies){const m=MATERIALS[kind];if(!m||!list.length)continue;out.push({command:'material.create',params:{...m}},{command:'material.assign',params:{material:m.name,bodies:list}});}
    return out;
  }

  // frame: {geometry (Frame3D.geometry), project?, result?}; foundation: engine result (optional).
  function script({frame=null,foundation=null}={}){
    if(!frame?.geometry&&!foundation)throw Error('내보낼 구조물이나 기초가 없습니다.');
    const w=writer(),base=foundation?foundation.p.bottom*1000:0;
    const members=frame?.geometry?frameMembers(w,frame.geometry,base):0;
    let found=null;
    if(foundation){
      const frameHeight=frame?.geometry?.general.height||foundation.p.signH;
      const fp=frame?.result?.posts,plateTop=foundation.g.above+(foundation.p.groutThickness||0)+(foundation.p.plateThickness>0?foundation.p.plateThickness:20);
      // A frame post's length runs up from the plate; otherwise the post stops under the screen.
      const postTop=fp?.length>0?plateTop+fp.length:Math.max(base,plateTop+1);
      found=foundationMembers(w,foundation,{postTop,frameHeight});
    }
    const commands=[...w.commands,...materialCommands(w)];
    if(!commands.length)throw Error('내보낼 형상이 없습니다.');
    return {commands,members,foundation:found,bodies:[...w.bodies.values()].flat()};
  }
  const json=options=>JSON.stringify({commands:script(options).commands},null,1);
  // On-screen 3D preview of the same model in Frame3D's axes (x right, y down from the top, z back from
  // the front), so Frame3D.render can draw frame, posts, plates and footings together.
  const COLORS={steel:'#7f9fb0',post:'#2f5d73',concrete:'#b9c2ca',grout:'#8f99a2'};
  function scene(options){
    const w=writer(),{frame=null,foundation=null}=options,base=foundation?foundation.p.bottom*1000:0;
    if(frame?.geometry)frameMembers(w,frame.geometry,base);
    if(foundation){const fp=frame?.result?.posts,plateTop=foundation.g.above+(foundation.p.groutThickness||0)+(foundation.p.plateThickness>0?foundation.p.plateThickness:20);foundationMembers(w,foundation,{postTop:fp?.length>0?plateTop+fp.length:Math.max(base,plateTop+1)});}
    if(!w.shapes.length)return null;
    const top=Math.max(...w.shapes.map(s=>s.z+s.h)),ground=top;
    // emphasize: thin members are drawn at least 1/90 of the model size so the frame reads next to the footings.
    if(options.emphasize){const size=Math.max(...['x','y','z'].map((k,i)=>Math.max(...w.shapes.map(s=>s[k]+[s.l,s.w,s.h][i]))-Math.min(...w.shapes.map(s=>s[k])))),m=size/90;
      for(const s of w.shapes)for(const [pos,len] of [['x','l'],['y','w'],['z','h']])if(s[len]<m){s[pos]-=(m-s[len])/2;s[len]=m;}}
    const palette=options.theme==='twin'?{steel:'#7fd3e6',post:'#4fc3f7',concrete:'#8fa3b3',grout:'#6f8796',frame:'#5fe0c6'}:COLORS;
    const boxes=w.shapes.map(s=>({x:s.x,y:top-s.z-s.h,z:s.y,w:s.l,h:s.h,d:s.w,kind:s.kind==='steel'&&s.color?'frame':s.kind,name:s.name,info:s.name,part:'',color:options.theme==='twin'&&s.kind==='steel'&&s.color?palette.frame:s.color||palette[s.kind]||'#9aa3ab',...(options.theme==='twin'&&s.kind==='concrete'?{opacity:.45}:{})}));
    // The LED screen itself, a thin dark panel in front of the frame (dashboard view only).
    if(options.screen&&frame?.geometry){const fb=boxes.filter(b=>b.kind==='frame');if(fb.length){const x0=Math.min(...fb.map(b=>b.x)),x1=Math.max(...fb.map(b=>b.x+b.w)),y0=Math.min(...fb.map(b=>b.y)),y1=Math.max(...fb.map(b=>b.y+b.h)),z0=Math.min(...fb.map(b=>b.z));
      boxes.push({x:x0,y:y0,z:z0-Math.max(40,(x1-x0)/120),w:x1-x0,h:y1-y0,d:Math.max(40,(x1-x0)/120),kind:'screen',name:'LED 화면',info:'LED 화면',part:'',color:'#1d6fa5',opacity:.82});}}
    const bounds={min:[0,0,0].map((_,i)=>Math.min(...boxes.map(b=>[b.x,b.y,b.z][i]))),max:[0,0,0].map((_,i)=>Math.max(...boxes.map(b=>[b.x+b.w,b.y+b.h,b.z+b.d][i])))};
    const g=frame?.geometry?.general||{width:foundation.p.signW,height:foundation.p.signH,planes:1,depth:0};
    return {boxes,bounds,general:g,groundY:ground,omitted:0,extraSamples:0,depthTieCount:0,memberCount:boxes.length};
  }
  const HELP='SolidCraft(무료 3D CAD)에서 이 파일을 스크립트로 실행하면 3D 모델이 만들어집니다. 명령줄: solidcraft-cli run 파일.json --out 모델.step · 단위 mm, Z가 위, 지면(GL)=0, 전광판 정면이 −Y입니다. 형상 확인용이며 구조 검토 결과가 아닙니다.';

  const api={MATERIALS,HELP,script,json,scene};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SolidCraftExport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
