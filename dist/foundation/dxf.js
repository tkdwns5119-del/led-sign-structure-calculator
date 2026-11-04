(function(root){
  'use strict';
  const layers={0:7,FND_OUTLINE:7,FND_COLUMN:7,FND_CENTER:8,FND_SIGN:4,FND_EXCAVATION:8,FND_SUBBASE:8,FND_BOTTOM:5,FND_TOP:30,FND_NECK:3,FND_ANCHOR:1,FND_PLATE:40,FND_BOLT_CIRCLE:40,FND_DIM:8,FND_TEXT:7,FND_NOTE:8,FND_TABLE:8};
  const clean=s=>String(s??'').replace(/[\x00-\x1F\x7F]/g,' ');
  // AutoCAD 2000 ASCII DXF: Unicode escapes preserve Korean without a browser
  // code-page encoder. Escape literal backslashes and percent control sequences.
  const encode=s=>clean(s).split('').map(c=>c.charCodeAt(0)>126||c==='\\'||c==='%'?'\\U+'+c.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'):c).join('');
  const fmt=(v,d=1)=>Number(v.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d});
  function chunks(value,maxLength=240,maxChars=100){
    const out=[];let part='',size=0,width=0;
    for(const c of clean(value)){const length=encode(c).length,w=c.charCodeAt(0)>126?1:.58;
      if(part&&(size+length>maxLength||width+w>maxChars)){out.push(part);part='';size=0;width=0;}
      part+=c;size+=length;width+=w;
    }
    if(part||!out.length)out.push(part);return out;
  }
  class Drawing{
    constructor(){this.next=1;this.entities=[];this.blocks=[];this.dimensions=[];this.views=[];this.bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};this.owner=null;
      this.tables=Object.fromEntries(['VPORT','LTYPE','LAYER','STYLE','VIEW','UCS','DIMSTYLE','APPID','BLOCK_RECORD'].map(k=>[k,this.handle()]));
      this.ltypes=Object.fromEntries(['BYBLOCK','BYLAYER','CONTINUOUS','DASHED'].map(k=>[k,this.handle()]));
      this.layerIds=Object.fromEntries(Object.keys(layers).map(k=>[k,this.handle()]));this.style=this.handle();this.dimstyle=this.handle();this.appid=this.handle();
      this.model=this.handle();this.paper=this.handle();this.nod=this.handle();this.groups=this.handle();this.owner=this.model;
    }
    handle(){return(this.next++).toString(16).toUpperCase();}
    touch(x,y){if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('DXF 좌표가 유효하지 않습니다.');const b=this.bounds;b.minX=Math.min(b.minX,x);b.minY=Math.min(b.minY,y);b.maxX=Math.max(b.maxX,x);b.maxY=Math.max(b.maxY,y);}
    add(type,layer,data,extra={}){if(!Object.hasOwn(layers,layer))throw new Error('DXF 레이어가 유효하지 않습니다.');const e={type,layer,data,handle:this.handle(),owner:this.owner,...extra};this.entities.push(e);return e;}
    line(x1,y1,x2,y2,layer='FND_OUTLINE'){this.touch(x1,y1);this.touch(x2,y2);return this.add('LINE',layer,[100,'AcDbLine',10,x1,20,y1,30,0,11,x2,21,y2,31,0]);}
    poly(points,layer='FND_OUTLINE',closed=false){points.forEach(([x,y])=>this.touch(x,y));return this.add('LWPOLYLINE',layer,[100,'AcDbPolyline',90,points.length,70,closed?1:0,...points.flatMap(([x,y])=>[10,x,20,y])]);}
    rect(x,y,w,h,layer='FND_OUTLINE'){if(w<0||h<0)throw new Error('DXF 형상 치수가 유효하지 않습니다.');return this.poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],layer,true);}
    circle(x,y,r,layer='FND_NECK'){this.touch(x-r,y-r);this.touch(x+r,y+r);return this.add('CIRCLE',layer,[100,'AcDbCircle',10,x,20,y,30,0,40,r]);}
    text(x,y,value,height=80,layer='FND_TEXT',align=0,maxChars=100){
      const lines=chunks(value,240,maxChars);
      lines.forEach((s,i)=>{const yy=y-i*height*1.55,width=Array.from(s).reduce((n,c)=>n+(c.charCodeAt(0)>126?1:.58),0)*height;
        this.touch(x-(align===2?width:align===1?width/2:0),yy-height*.25);this.touch(x+(align===0?width:align===1?width/2:0),yy+height);
        this.add('TEXT',layer,[100,'AcDbText',10,x,20,yy,30,0,40,height,1,encode(s),50,0,41,1,7,'FND_KO',72,align,11,x,21,yy,31,0,100,'AcDbText',73,0],{text:s});
      });return lines.length*height*1.55;
    }
    dimension(a,b,offset,vertical=false,prefix='',height=80){
      const distance=Math.abs(vertical?b[1]-a[1]:b[0]-a[0]);if(distance<1e-7)return;
      const name='*D'+(this.blocks.length+1),record=this.handle(),block={name,record,start:this.handle(),end:this.handle(),entities:[]},previous=this.owner,start=this.entities.length;
      this.owner=record;const p=vertical?[offset,a[1]]:[a[0],offset],q=vertical?[offset,b[1]]:[b[0],offset],tick=height*.65;
      this.line(...a,...p,'FND_DIM');this.line(...b,...q,'FND_DIM');this.line(...p,...q,'FND_DIM');
      for(const [x,y]of [p,q])this.line(x-tick,y-tick,x+tick,y+tick,'FND_DIM');
      const tx=(p[0]+q[0])/2+(vertical?height*.7:0),ty=(p[1]+q[1])/2+(vertical?0:height*.7);
      this.text(tx,ty,prefix+fmt(distance,2),height,'FND_DIM',vertical?0:1);
      block.entities=this.entities.splice(start);this.blocks.push(block);this.owner=previous;
      const dim=this.add('DIMENSION','FND_DIM',[100,'AcDbDimension',2,name,10,q[0],20,q[1],30,0,11,tx,21,ty,31,0,70,32,1,encode(prefix)+'<>',3,'FND_MM',42,distance,100,'AcDbAlignedDimension',13,a[0],23,a[1],33,0,14,b[0],24,b[1],34,0,50,vertical?90:0,100,'AcDbRotatedDimension']);
      this.dimensions.push({handle:dim.handle,name,measurement:distance,a,b,vertical});
    }
    finish(){
      const groups=[],put=(...pairs)=>{for(let i=0;i<pairs.length;i+=2){const code=pairs[i],value=pairs[i+1];if(value===undefined||value===null||(typeof value==='number'&&!Number.isFinite(value)))throw new Error('DXF 값이 유효하지 않습니다.');groups.push(String(code),typeof value==='number'?String(Number(value.toFixed(8))):String(value));}};
      const empty=[{name:'*Model_Space',record:this.model,start:this.handle(),end:this.handle(),entities:[]},{name:'*Paper_Space',record:this.paper,start:this.handle(),end:this.handle(),entities:[]}];
      const b=this.bounds,entity=e=>put(0,e.type,5,e.handle,330,e.owner,100,'AcDbEntity',8,e.layer,...e.data);
      const table=(name,count,fn)=>{put(0,'TABLE',2,name,5,this.tables[name],330,'0',100,'AcDbSymbolTable',70,count);if(name==='DIMSTYLE')put(100,'AcDbDimStyleTable',71,0);fn();put(0,'ENDTAB');};
      put(0,'SECTION',2,'HEADER',9,'$ACADVER',1,'AC1015',9,'$DWGCODEPAGE',3,'ANSI_1252',9,'$INSUNITS',70,4,9,'$MEASUREMENT',70,1,9,'$LUNITS',70,2,9,'$LUPREC',70,2,9,'$DIMADEC',70,0,9,'$DIMASSOC',280,1,9,'$LTSCALE',40,1,9,'$TEXTSIZE',40,80,9,'$INSBASE',10,0,20,0,30,0,9,'$EXTMIN',10,b.minX,20,b.minY,30,0,9,'$EXTMAX',10,b.maxX,20,b.maxY,30,0,9,'$HANDSEED',5,this.next.toString(16).toUpperCase(),0,'ENDSEC');
      put(0,'SECTION',2,'TABLES');
      table('VPORT',0,()=>{});
      table('LTYPE',4,()=>{for(const [name,h]of Object.entries(this.ltypes))put(0,'LTYPE',5,h,330,this.tables.LTYPE,100,'AcDbSymbolTableRecord',100,'AcDbLinetypeTableRecord',2,name,70,0,3,name,72,65,73,name==='DASHED'?2:0,40,name==='DASHED'?150:0,...(name==='DASHED'?[49,100,74,0,49,-50,74,0]:[]));});
      table('LAYER',Object.keys(layers).length,()=>{for(const [name,color]of Object.entries(layers))put(0,'LAYER',5,this.layerIds[name],330,this.tables.LAYER,100,'AcDbSymbolTableRecord',100,'AcDbLayerTableRecord',2,name,70,0,62,color,6,['FND_EXCAVATION','FND_PLATE','FND_BOLT_CIRCLE','FND_CENTER'].includes(name)?'DASHED':'CONTINUOUS',370,name==='FND_OUTLINE'?25:15,390,'0');});
      table('STYLE',1,()=>put(0,'STYLE',5,this.style,330,this.tables.STYLE,100,'AcDbSymbolTableRecord',100,'AcDbTextStyleTableRecord',2,'FND_KO',70,0,40,0,41,1,50,0,71,0,42,80,3,'malgun.ttf',4,''));
      table('VIEW',0,()=>{});table('UCS',0,()=>{});
      table('DIMSTYLE',1,()=>put(0,'DIMSTYLE',105,this.dimstyle,330,this.tables.DIMSTYLE,100,'AcDbSymbolTableRecord',100,'AcDbDimStyleTableRecord',2,'FND_MM',70,0,40,1,41,48,42,20,44,40,140,80,144,1,147,30,171,2,176,256,177,256,178,256,271,2,278,46,280,0,281,0,282,0,283,0,284,8,340,this.style));
      table('APPID',1,()=>put(0,'APPID',5,this.appid,330,this.tables.APPID,100,'AcDbSymbolTableRecord',100,'AcDbRegAppTableRecord',2,'ACAD',70,0));
      table('BLOCK_RECORD',2+this.blocks.length,()=>{for(const v of [{name:'*Model_Space',record:this.model},{name:'*Paper_Space',record:this.paper},...this.blocks])put(0,'BLOCK_RECORD',5,v.record,330,this.tables.BLOCK_RECORD,100,'AcDbSymbolTableRecord',100,'AcDbBlockTableRecord',2,v.name,70,4,280,1,281,0);});
      put(0,'ENDSEC',0,'SECTION',2,'BLOCKS');
      for(const v of [...empty,...this.blocks]){
        put(0,'BLOCK',5,v.start,330,v.record,100,'AcDbEntity',8,'0',100,'AcDbBlockBegin',2,v.name,70,v.name.startsWith('*D')?1:0,10,0,20,0,30,0,3,v.name,1,'');
        v.entities.forEach(entity);put(0,'ENDBLK',5,v.end,330,v.record,100,'AcDbEntity',8,'0',100,'AcDbBlockEnd');
      }
      put(0,'ENDSEC',0,'SECTION',2,'ENTITIES');this.entities.forEach(entity);
      put(0,'ENDSEC',0,'SECTION',2,'OBJECTS',0,'DICTIONARY',5,this.nod,330,'0',100,'AcDbDictionary',281,1,3,'ACAD_GROUP',350,this.groups,0,'DICTIONARY',5,this.groups,330,this.nod,100,'AcDbDictionary',281,1,0,'ENDSEC',0,'EOF');
      return groups.join('\r\n')+'\r\n';
    }
  }
  function create(r,context={}){
    const d=new Drawing(),{p,g,q}=r,rb=r.r,n=rb.neck,a=r.estimate?.a;
    if(!a)throw new Error('앵커 배치 계산이 필요합니다.');
    const profile=a.column;
    const columnPlan=(cx,cy)=>{if(profile.known){if(profile.shape==='circle')d.circle(cx,cy,profile.width/2,'FND_COLUMN');else d.rect(cx-profile.width/2,cy-profile.depth/2,profile.width,profile.depth,'FND_COLUMN');}};
    const shared=r.supports.shared,count=shared?p.qty:1,centers=Array.from({length:count},(_,i)=>(i-(count-1)/2)*p.foundationSpacing);
    const half=(count-1)*p.foundationSpacing/2,halfWidth=Math.max(p.signW/2,half+q.topL*500)+1000;
    const footTop=-g.embed*1000,footBase=footTop-g.H,pitBase=-q.depth*1000,signTop=p.bottom*1000+p.signH,left=-halfWidth;
    d.text(left,signTop+2500,'전광판 기초 · 철근 배근 초안',180);
    const headingHeight=d.text(left,signTop+2150,`${context.projectName||'전광판 기초 프로젝트'} / ${context.itemName||'현재 기초'}`,110,'FND_TEXT',0,90);
    d.text(left,signTop+2150-headingHeight-80,'단위 mm · 형상 1:1 · 예비 검토 / 시공용 확정도면 아님',90,'FND_NOTE');
    d.text(left,signTop+650,shared?'01 정면도 / 전광판 1대 · 전체 기초 배치':'01 정면도 / 설치 1개 대표 형상',120);
    d.views.push({id:'elevation',centers:centers.slice(),count});
    d.line(-halfWidth,0,halfWidth,0,'FND_EXCAVATION');d.text(left,120,'GL ±0.000',80,'FND_NOTE');
    centers.forEach((cx,i)=>{
      d.rect(cx-g.L/2,footBase,g.L,g.H);
      d.rect(cx-q.subL*500,footBase-p.lean,q.subL*1000,p.lean,'FND_SUBBASE');
      d.rect(cx-q.subL*500,pitBase,q.subL*1000,p.stone,'FND_SUBBASE');
      d.poly([[cx-q.topL*500,0],[cx-q.botL*500,pitBase],[cx+q.botL*500,pitBase],[cx+q.topL*500,0]],'FND_EXCAVATION');
      if(g.neck)for(const off of g.pedestals){
        d.rect(cx+off-g.cL/2,footTop,g.cL,g.cH);
        // Unspecified profiles retain the existing 150 mm symbolic width.
        if(r.supports.known){d.rect(cx+off-profile.width/2,g.above,profile.width,p.bottom*1000-g.above,'FND_COLUMN');if(profile.shape==='circle')d.line(cx+off,g.above,cx+off,p.bottom*1000,'FND_CENTER');}
      }
      d.text(cx,footBase-180,shared?`기초 ${i+1}`:'기초 1개',80,'FND_NOTE',1);
    });
    if(shared&&r.supports.known){const extra=p.type==='combined'?p.postSpacing/2:0;d.line(centers[0]-extra,p.bottom*1000,centers[count-1]+extra,p.bottom*1000,'FND_COLUMN');}
    d.rect(-p.signW/2,p.bottom*1000,p.signW,p.signH,'FND_SIGN');
    d.text(0,p.bottom*1000+p.signH/2,`${p.signW} × ${p.signH}`,100,'FND_TEXT',1);
    d.dimension([-p.signW/2,signTop],[p.signW/2,signTop],signTop+300,false,'전광판 ');
    d.dimension([p.signW/2,p.bottom*1000],[p.signW/2,signTop],p.signW/2+400,true);
    d.dimension([-p.signW/2,0],[-p.signW/2,p.bottom*1000],-p.signW/2-450,true,'하단 ');
    d.dimension([centers[0]-g.L/2,footBase],[centers[0]+g.L/2,footBase],pitBase-480,false,'L = ');
    d.dimension([centers[count-1]+g.L/2,footBase],[centers[count-1]+g.L/2,footTop],centers[count-1]+g.L/2+450,true,'H = ');
    if(shared)for(let i=1;i<centers.length;i++)d.dimension([centers[i-1],footBase],[centers[i],footBase],pitBase-850,false,'중심간격 ');
    const groundLabel=context.groundLabel||'지반자료 미확인',windLabel=context.windLabel||'풍하중 입력값';
    const detailTop=pitBase-2600;
    d.text(left,pitBase-1250,`전체 전광판 ${r.supports.boards}대 / 기초 ${p.qty}개 / 기둥 ${r.supports.known?r.supports.total+'본':'미지정'} / ${shared?'기초별 반력 분배·구조 미검토':'대표 설치 1개 기준 도면'}`,80,'FND_NOTE',0,100);
    d.text(left,pitBase-1650,`${windLabel} / 정면 풍압 ${fmt(r.l.pressure,3)} kPa / ${groundLabel}`,80,'FND_NOTE',0,100);
    const panelWidth=Math.max(g.L+1800,g.W+1800,6400),gap=1000;
    for(let upper=0;upper<2;upper++){
      const x=left+upper*(panelWidth+gap),y=detailTop-g.W,layer=upper?'FND_TOP':'FND_BOTTOM';
      d.views.push({id:upper?'top-plan':'bottom-plan',x,y,width:g.L,height:g.W});
      d.text(x,detailTop+850,upper?'03 푸팅 상부 평면 배근도':'02 푸팅 하부 평면 배근도',120);
      d.text(x,detailTop+540,`${upper?'F3/F4':'F1/F2'} D${rb.code} / X ${rb.x.n}본 @${fmt(rb.x.actual)} / Y ${rb.y.n}본 @${fmt(rb.y.actual)}`,80);
      d.rect(x,y,g.L,g.W);
      for(let i=0;i<rb.x.n;i++){const yy=y+rb.x.start+i*rb.x.actual;d.line(x+p.cover,yy,x+g.L-p.cover,yy,layer);}
      for(let i=0;i<rb.y.n;i++){const xx=x+rb.y.start+i*rb.y.actual;d.line(xx,y+p.cover,xx,y+g.W-p.cover,layer);}
      if(g.neck)for(const off of g.pedestals)d.rect(x+g.L/2+off-g.cL/2,y+g.W/2-g.cW/2,g.cL,g.cW,'FND_NECK');
      if(g.neck&&r.supports.known)for(const off of g.pedestals)columnPlan(x+g.L/2+off,y+g.W/2);
      d.dimension([x,y],[x+g.L,y],y-420,false,'L = ');
      d.dimension([x+g.L,y],[x+g.L,y+g.W],x+g.L+400,true,'W = ');
      d.text(x,y-750,`피복 ${p.cover} / X근 길이 ${g.L-2*p.cover} / Y근 길이 ${g.W-2*p.cover} mm`,80,'FND_NOTE',0,75);
    }
    const sectionLeft=left+2*(panelWidth+gap),sectionTop=detailTop,sy=sectionTop-g.cH-g.H,sx=sectionLeft+g.W/2,sft=sy+g.H,gl=sft+g.embed*1000;
    d.views.push({id:'section',x:sectionLeft,y:sy,width:g.W,height:g.H+g.cH});
    d.text(sectionLeft,detailTop+850,'04 Y방향 단면 / 정착 초안',120);
    d.text(sectionLeft,detailTop+540,`푸팅 D${rb.code} / 피복 ${p.cover}${n?' / 목 주근 '+n.longN+'-D'+n.bar:''}`,80);
    d.rect(sectionLeft,sy,g.W,g.H);
    d.rect(sx-q.subW*500,sy-p.lean,q.subW*1000,p.lean,'FND_SUBBASE');
    d.rect(sx-q.subW*500,sy-p.lean-p.stone,q.subW*1000,p.stone,'FND_SUBBASE');
    d.line(sectionLeft-200,gl,sectionLeft+g.W+200,gl,'FND_EXCAVATION');d.text(sectionLeft-200,gl+110,'GL',80,'FND_NOTE');
    if(g.neck)d.rect(sx-g.cW/2,sft,g.cW,g.cH);
    const db=rb.b.d,lo=sy+p.cover+db/2,hi=sft-p.cover-db/2;
    d.line(sectionLeft+p.cover,lo+db,sectionLeft+g.W-p.cover,lo+db,'FND_BOTTOM');
    d.line(sectionLeft+p.cover,hi-db,sectionLeft+g.W-p.cover,hi-db,'FND_TOP');
    for(let i=0;i<rb.x.n;i++){const x=sectionLeft+rb.x.start+i*rb.x.actual;d.circle(x,lo,db/2,'FND_BOTTOM');d.circle(x,hi,db/2,'FND_TOP');}
    if(n){
      const start=sx-g.cW/2+n.start;
      for(let i=0;i<n.ny;i++){const x=start+i*n.sy,endY=sft-p.dowelEmbed,tail=x<sx?-p.dowelTail:p.dowelTail;d.poly([[x,sectionTop-p.neckCover],[x,endY],[x+tail,endY]],'FND_NECK');}
      for(let i=0;i<n.ties.n;i++){const y=sft+n.ties.start+i*n.ties.actual;d.line(sx-n.tieY/2,y,sx+n.tieY/2,y,'FND_NECK');}
      d.dimension([sx+g.cW/2,sft],[sx+g.cW/2,sectionTop],sx+g.cW/2+300,true,'목 ');
    }
    d.dimension([sectionLeft+g.W,sy],[sectionLeft+g.W,sft],sectionLeft+g.W+600,true,'H = ');
    d.dimension([sectionLeft,sy],[sectionLeft+g.W,sy],sy-p.lean-p.stone-420,false,'W = ');
    d.text(sectionLeft,sy-p.lean-p.stone-750,`정착 근입 ${p.dowelEmbed} + 꼬리 ${p.dowelTail} mm / 절곡·갈고리 개략`,80,'FND_NOTE',0,75);
    const lowerTop=detailTop-Math.max(g.W,g.H+g.cH+p.lean+p.stone)-2400;
    if(n){
      const x=left,y=lowerTop-g.cW,cx=x+g.cL/2,cy=y+g.cW/2;
      d.views.push({id:'neck-plan',x,y,width:g.cL,height:g.cW});
      d.text(x,lowerTop+850,'05 목 평면 / 앵커 배치 초안',120);
      d.text(x,lowerTop+530,`${n.longN}-D${n.bar} / 띠근 D${p.tieBar} @${fmt(n.ties.actual)} / ${n.ties.n}단`,80);
      d.rect(x,y,g.cL,g.cW);d.rect(cx-n.tieX/2,cy-n.tieY/2,n.tieX,n.tieY,'FND_NECK');
      for(let i=0;i<n.nx;i++){const xx=x+n.start+i*n.sx;for(const yy of [y+n.start,y+g.cW-n.start])d.circle(xx,yy,n.b.d/2);if(i>0&&i<n.nx-1)d.line(xx,cy-n.tieY/2,xx,cy+n.tieY/2,'FND_NECK');}
      for(let i=1;i<n.ny-1;i++){const yy=y+n.start+i*n.sy;for(const xx of [x+n.start,x+g.cL-n.start])d.circle(xx,yy,n.b.d/2);d.line(cx-n.tieX/2,yy,cx+n.tieX/2,yy,'FND_NECK');}
      if(a.round){d.circle(cx,cy,p.plateDiameter/2,'FND_PLATE');if(p.anchorCount)d.circle(cx,cy,a.boltCircleDiameter/2,'FND_BOLT_CIRCLE');}
      else d.rect(cx-p.plateL/2,cy-p.plateW/2,p.plateL,p.plateW,'FND_PLATE');
      if(r.supports.known)columnPlan(cx,cy);
      a.positions.forEach(([xx,yy])=>d.circle(cx+xx,cy+yy,p.anchorDiameter/2,'FND_ANCHOR'));
      d.dimension([x,y],[x+g.cL,y],y-300,false,'cL = ',60);d.dimension([x+g.cL,y],[x+g.cL,y+g.cW],x+g.cL+300,true,'cW = ',60);
      d.text(x,y-700,`지지부 1개 기준 / 앵커 ${p.anchorCount}-M${p.anchorDiameter} / 플레이트 ${a.plateLabel}`,80,'FND_NOTE',0,65);
      if(a.round&&p.anchorCount)d.text(x,y-1050,`앵커 중심원 Ø${a.boltCircleDiameter} / 시작 각도 ${p.anchorAngle}° / 반시계 방향 균등 배치`,80,'FND_NOTE',0,65);
      d.text(x,y-(a.round?1450:1100),'앵커·철근 간섭, 갈고리·횡지지 상세 확정 필요',80,'FND_NOTE',0,65);
    }
    const tableX=left+panelWidth+gap,tableTop=lowerTop+850,widths=[450,2700,650,1000,1200,1200,1400],totalWidth=widths.reduce((s,v)=>s+v,0),cols=[tableX];
    widths.forEach(w=>cols.push(cols[cols.length-1]+w));
    d.text(tableX,tableTop,'06 철근 수량표 / 개략 전개길이',120);let rowY=tableTop-350;
    const row=(values,header=false)=>{
      let used=240;values.forEach((v,i)=>{const hh=d.text(cols[i]+70,rowY-145,v,80,header?'FND_TEXT':'FND_NOTE',0,(widths[i]-140)/80);used=Math.max(used,hh+90);});
      d.line(tableX,rowY,tableX+totalWidth,rowY,'FND_TABLE');cols.forEach(xx=>d.line(xx,rowY,xx,rowY-used,'FND_TABLE'));rowY-=used;
    };
    row(['번호','부위','규격','본수/1기초','길이 mm','전체 본수','전체 kg'],true);
    rb.rows.forEach(v=>row([v.code,v.name,'D'+v.bar,fmt(v.count,0),fmt(v.length,2),fmt(v.count*p.qty,0),fmt(v.kg*p.qty,2)]));
    d.line(tableX,rowY,tableX+totalWidth,rowY,'FND_TABLE');
    d.text(tableX,rowY-250,`철근 전체 순수량 ${fmt(r.total.rebarNet,2)} kg / 할증 ${p.rebarWaste}% / 주문량 ${fmt(r.total.rebarGross,2)} kg`,90,'FND_TEXT',0,100);
    const bottom=Math.min(rowY-1000,lowerTop-g.cW-1900);
    d.text(left,bottom,profile.known?`도면 형상은 mm 실척입니다. 강재 기둥 ${profile.label} mm / 베이스플레이트 ${a.plateLabel} mm. 기둥 자중·풍하중과 강재·접합 강도는 별도 검토하세요.`:'도면 형상은 계산 치수의 mm 실척입니다. 기둥 단면은 미입력으로 150mm 폭의 개념 표시입니다.',80,'FND_NOTE',0,110);
    d.text(left,bottom-420,'정착·절곡·갈고리·지주·앵커 접합 상세는 예비 표시입니다. 제작·시공 도면은 상세 설계 후 확정하세요.',80,'FND_NOTE',0,110);
    const content=d.finish();return {content,views:d.views,dimensions:d.dimensions,bounds:d.bounds};
  }
  const api={create,encode};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationDXF=api;
})(typeof globalThis!=='undefined'?globalThis:this);
