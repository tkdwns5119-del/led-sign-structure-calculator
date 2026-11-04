(function (root) {
  'use strict';
  const Wind=typeof module!=='undefined'&&module.exports?require('./wind.js'):root.FoundationWind;
  const Steel=typeof module!=='undefined'&&module.exports?require('./steel.js'):root.FoundationSteel;
  const bars = {
    10:{d:9.53,area:71.33,kg:0.560},13:{d:12.7,area:126.7,kg:0.995},
    16:{d:15.9,area:198.6,kg:1.560},19:{d:19.1,area:286.5,kg:2.250},
    22:{d:22.2,area:387.1,kg:3.040},25:{d:25.4,area:506.7,kg:3.980},
    29:{d:28.6,area:642.4,kg:5.040},32:{d:31.8,area:794.2,kg:6.230}
  };
  const types = {
    single:{label:'독립기초 · 1주 / T형',neck:true,count:1,L:2200,W:2200,H:1500,cL:800,cW:800,cH:1000,above:300},
    combined:{label:'복합 통기초 · 2주',neck:true,count:2,L:6500,W:2200,H:1500,cL:800,cW:800,cH:1000,above:300},
    block:{label:'단일 블록 통기초',neck:false,count:0,L:2000,W:2000,H:1800,cL:800,cW:800,cH:1000,above:0},
    mat:{label:'매트기초 · 수량 산출',neck:false,count:0,L:8000,W:4000,H:1500,cL:800,cW:800,cH:1000,above:0},
    strip:{label:'줄기초 · 연속 목 / 수량 산출',neck:true,count:1,L:10000,W:1200,H:1500,cL:10000,cW:400,cH:600,above:200}
  };
  const defaults = {
    type:'single',mode:'auto',installMode:'shared',qty:1,foundationSpacing:3500,signW:4000,signH:2000,signDepth:250,bottom:3,
    panelKgM2:45,postKg:250,extraKg:0,windMode:'pressure',pressure:1.5,velocity:40,cf:1.8,gust:1.5,
    sidePressure:1.5,sideMode:'manual',windPoint:'',basicWind:28,exposure:'C',topography:1,importance:1,direction:1,
    extraForce:0,extraForceZ:2,eccX:0,eccY:0,qa:150,mu:0.4,waterDepth:100,
    gammaC:24,stabilize:0.9,fsTarget:1.5,deadFactor:1.2,windFactor:1.6,
    fck:27,fy:400,phiFlex:0.85,phiShear:0.75,rho:0.002,aggregate:25,
    L:2200,W:2200,H:1500,cL:800,cW:800,cH:1000,above:300,postSpacing:3500,
    autoMax:10000,autoHMax:2000,aspect:1,cover:75,neckCover:50,
    rebarMode:'auto',bar:19,spacing:200,maxSpacing:250,neckBar:22,neckNX:6,neckNY:6,tieBar:10,tieSpacing:150,
    ld:500,dowelEmbed:500,dowelTail:300,rebarWaste:3,concWaste:1,
    ow:100,lean:100,stone:200,work:300,slope:0,soilL:1.2,soilC:1,oldRatio:95,
    columnShape:'schematic',columnDiameter:300,columnWidth:150,columnDepth:150,plateShape:'rect',plateDiameter:500,anchorAngle:0,
    columnThickness:0,columnFlange:0,columnFy:275,
    anchorCount:8,anchorDiameter:30,anchorEmbed:0,anchorHead:'headed',anchorFy:275,anchorFu:410,plateL:500,plateW:500,anchorEdge:75,groutThickness:40,groutYield:12.5,groutWaste:5,groundRods:2,elpLength:10,vat:10
  };
  const limits = {
    qty:[1,1000,true],foundationSpacing:[200,100000],signW:[100,50000],signH:[100,30000],signDepth:[0,10000],bottom:[0,50],basicWind:[20,60],topography:[1,3],importance:[0.5,2],direction:[0.5,1],
    panelKgM2:[0,1000],postKg:[0,100000],extraKg:[0,100000],pressure:[0,20],velocity:[0,100],cf:[0.1,5],gust:[1,3],sidePressure:[0,20],extraForce:[0,1000],extraForceZ:[0,50],eccX:[-5,5],eccY:[-5,5],
    qa:[1,5000],mu:[0.01,1],waterDepth:[0,100],gammaC:[20,28],stabilize:[0.1,1],fsTarget:[1,3],deadFactor:[1,2],windFactor:[1,3],
    fck:[18,60],fy:[300,600],phiFlex:[0.5,0.85],phiShear:[0.5,0.75],rho:[0.001,0.01],aggregate:[5,50],
    L:[300,30000],W:[300,30000],H:[200,4000],cL:[200,30000],cW:[200,30000],cH:[100,5000],above:[0,5000],postSpacing:[200,20000],
    autoMax:[2000,12000],autoHMax:[500,3000],aspect:[0.5,2],cover:[40,150],neckCover:[30,150],
    spacing:[50,450],maxSpacing:[100,300],neckNX:[2,200,true],neckNY:[2,200,true],tieSpacing:[50,300],ld:[100,3000],dowelEmbed:[100,3000],dowelTail:[0,2000],
    rebarWaste:[0,20],concWaste:[0,10],ow:[0,500],lean:[0,300],stone:[0,1000],work:[0,2000],slope:[0,2],soilL:[1,2],soilC:[0.5,1.2],oldRatio:[0,300],
    columnDiameter:[50,3000],columnWidth:[50,3000],columnDepth:[50,3000],columnThickness:[0,100],columnFlange:[0,100],columnFy:[200,700],anchorEmbed:[0,3000],anchorFy:[200,900],anchorFu:[300,1200],plateDiameter:[100,3000],anchorAngle:[0,360],
    anchorCount:[0,32,true],anchorDiameter:[16,64],plateL:[100,3000],plateW:[100,3000],anchorEdge:[20,300],groutThickness:[0,150],groutYield:[5,25],groutWaste:[0,30],groundRods:[0,20,true],elpLength:[0,1000],vat:[0,30]
  };
  const EPS=1e-8;
  function validate(raw) {
    const p={...defaults,...raw};
    for (const [k,[min,max,integer]] of Object.entries(limits)) {
      if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<min||p[k]>max||(integer&&!Number.isInteger(p[k])))throw new Error(`${k}: ${min}~${max}${integer?' 범위의 정수':' 범위의 수치'}를 입력하세요.`);
    }
    if(!Object.hasOwn(types,p.type)||!['shared','repeat'].includes(p.installMode)||!['auto','manual'].includes(p.mode)||!['auto','manual'].includes(p.rebarMode)||!['pressure','velocity','regional'].includes(p.windMode)||!['manual','linked'].includes(p.sideMode)||!Object.hasOwn(Wind.exposures,p.exposure)||p.windPoint&&!Wind.getPoint(p.windPoint))throw new Error('배치 방식, 기초 형식 또는 풍하중 계산 모드를 확인하세요.');
    for(const k of ['bar','neckBar','tieBar'])if(!Object.hasOwn(bars,p[k]))throw new Error('철근 규격을 확인하세요.');
    if(!['schematic','rect','circle','h'].includes(p.columnShape))throw new Error('columnShape: 기둥 형상을 확인하세요.');
    if(!['headed','hooked'].includes(p.anchorHead))throw new Error('anchorHead: 앵커 정착 형태를 확인하세요.');
    if(p.anchorFu<p.anchorFy)throw new Error('anchorFu: 앵커 인장강도는 항복강도 이상이어야 합니다.');
    Steel.section(p);
    if(!['rect','circle'].includes(p.plateShape))throw new Error('plateShape: 베이스플레이트 형상을 확인하세요.');
    if(p.above>p.cH&&types[p.type].neck)throw new Error('목의 지상 노출고는 전체 목 높이 이하이어야 합니다.');
    if(p.mode==='auto'&&p.type!=='single')throw new Error('자동 치수 검토는 중앙 1주 T형 독립기초에 적용합니다. 다른 형식은 수동 치수로 수량과 배근 초안을 산출하세요.');
    if(p.installMode==='shared'&&p.qty>32)throw new Error('qty: 한 전광판 아래 배치하는 기초는 1~32개를 입력하세요. 여러 전광판의 설치 수량은 배치 방식에서 선택하세요.');
    if(sharedSupports(p)&&p.mode==='auto')throw new Error('여러 기초로 받치는 전광판은 하중 분배 해석이 필요합니다. 기초 치수를 직접 입력해 수량·배근 초안을 산출하세요.');
    if(['single','combined'].includes(p.type)&&p.bottom<p.above/1000)throw new Error('전광판 하단 높이가 목 상단보다 낮습니다. 설치 높이를 확인하세요.');
    return p;
  }
  function sharedSupports(p){return p.installMode==='shared'&&p.qty>1;}
  function canScreen(p){return p.type==='single'&&!sharedSupports(p);}
  function supportCounts(p){
    // Steel columns are defined by the 1-post and 2-post templates only.
    // Concrete neck counts in mat/strip/block templates do not define steel supports.
    const perFoundation=p.type==='single'?1:p.type==='combined'?2:null;
    return {perFoundation,total:perFoundation===null?null:perFoundation*p.qty,foundations:p.qty,boards:p.installMode==='shared'?1:p.qty,known:perFoundation!==null,shared:sharedSupports(p)};
  }
  function geometry(p,L=p.L,W=p.W,H=p.H) {
    const t=types[p.type],neck=t.neck,n=t.count;
    if(neck&&(p.cL>L+EPS||p.cW>W+EPS))throw new Error('목 치수가 푸팅을 벗어납니다.');
    if(p.type==='combined'&&(p.postSpacing+p.cL>L||p.postSpacing<p.cL))throw new Error('두 목이 겹치거나 푸팅 밖으로 벗어납니다. 지주 중심 간격과 푸팅 길이를 확인하세요.');
    if(H<=2*p.cover+4*bars[p.bar].d)throw new Error('푸팅 두께에 상·하부 철근과 피복을 배치할 공간이 부족합니다.');
    const embed=neck?(p.cH-p.above)/1000:0;
    return {L,W,H,cL:neck?p.cL:0,cW:neck?p.cW:0,cH:neck?p.cH:0,above:neck?p.above:0,neck,n,embed,depth:embed+H/1000,pedestals:p.type==='combined'?[-p.postSpacing/2,p.postSpacing/2]:neck?[0]:[]};
  }
  function earth(p,g) {
    const l=g.L/1000,w=g.W/1000,h=g.H/1000,ow=p.ow/1000,tb=p.lean/1000,tr=p.stone/1000;
    const footing=l*w*h,neck=g.cL*g.cW*g.cH*g.n/1e9;
    const formFoot=2*(l+w)*h,formNeck=2*(g.cL+g.cW)*g.cH*g.n/1e6;
    const subL=l+2*ow,subW=w+2*ow,lean=subL*subW*tb,stone=subL*subW*tr;
    const depth=g.depth+tb+tr,botL=subL+2*p.work/1000,botW=subW+2*p.work/1000;
    const topL=botL+2*p.slope*depth,topW=botW+2*p.slope*depth;
    const excavation=depth/6*(botL*botW+topL*topW+4*(botL+p.slope*depth)*(botW+p.slope*depth));
    const buried=footing+g.cL*g.cW*g.embed*g.n/1e6+lean+stone;
    const backfill=Math.max(0,excavation-buried),surplus=Math.max(0,excavation-backfill/p.soilC)*p.soilL,borrow=Math.max(0,backfill/p.soilC-excavation);
    const wetFoot=l*w*Math.max(0,g.depth-Math.max(g.embed,p.waterDepth));
    const wetNeck=g.cL*g.cW*g.n/1e6*Math.max(0,g.embed-p.waterDepth);
    return {footing,neck,concrete:footing+neck,orderedConcrete:(footing+neck)*(1+p.concWaste/100),formFoot,formNeck,form:formFoot+formNeck,subL,subW,lean,stone,depth,botL,botW,topL,topW,excavation,buried,backfill,surplus,borrow,buoyancy:(wetFoot+wetNeck)*9.81};
  }
  function loads(p,g,q) {
    const area=p.signW*p.signH/1e6,sideArea=p.signDepth*p.signH/1e6;
    const windDetail=p.windMode==='regional'?Wind.regional({basicWind:p.basicWind,height:p.bottom+p.signH/1000,exposure:p.exposure,topography:p.topography,importance:p.importance,direction:p.direction,cf:p.cf,gust:p.gust}):null;
    const pressure=windDetail?windDetail.pressure:p.windMode==='pressure'?p.pressure:0.5*1.225*p.velocity*p.velocity*p.cf*p.gust/1000;
    const sidePressure=p.sideMode==='linked'?pressure:p.sidePressure;
    const front=area*pressure,side=sideArea*sidePressure,center=p.bottom+p.signH/2000;
    const panelKg=area*p.panelKgM2,upper=(panelKg+p.postKg+p.extraKg)*9.80665/1000;
    const dead=q.concrete*p.gammaC+upper;
    const mx=front*(center+g.depth)+p.extraForce*(p.extraForceZ+g.depth);
    const my=side*(center+g.depth);
    const N=p.stabilize*dead-q.buoyancy;
    const momentX=Math.abs(mx)+Math.abs(upper*p.eccY),momentY=Math.abs(my)+Math.abs(upper*p.eccX);
    const L=g.L/1000,W=g.W/1000,A=L*W;
    const ex=N>0?momentY/N:Infinity,ey=N>0?momentX/N:Infinity;
    const kern=N>0?6*ex/L+6*ey/W:Infinity;
    const qmax=N>0?N/A*(1+kern):Infinity,qmin=N>0?N/A*(1-kern):-Infinity;
    const force=Math.hypot(front+p.extraForce,side);
    const fsSlide=force>EPS?Math.max(0,N)*p.mu/force:Infinity;
    const fsOver=(momentX/W+momentY/L)>EPS?Math.max(0,N)/(2*(momentX/W+momentY/L)):Infinity;
    const Nu=p.deadFactor*(dead-q.buoyancy),muX=p.windFactor*Math.abs(mx)+p.deadFactor*Math.abs(upper*p.eccY),muY=p.windFactor*Math.abs(my)+p.deadFactor*Math.abs(upper*p.eccX);
    const kernU=Nu>0?6*(muX/W+muY/L)/Nu:Infinity;
    const qu=Nu>0?Nu/A*(1+kernU):Infinity;
    return {area,sideArea,pressure,sidePressure,windDetail,front,side,force,center,panelKg,upper,dead,N,mx:momentX,my:momentY,ex,ey,kern,qmax,qmin,fsSlide,fsOver,Nu,muX,muY,kernU,qu};
  }
  function aggregateQuantities(p,g,q){
    const N=p.qty,keys=['footing','neck','concrete','orderedConcrete','formFoot','formNeck','form','lean','stone','excavation','backfill','surplus','borrow'];
    const total=Object.fromEntries(keys.map(k=>[k,q[k]*N]));
    total.stoneArea=p.stone>0?q.subL*q.subW*N:0;total.mergedExcavation=false;
    if(!sharedSupports(p)||p.foundationSpacing<g.L)return total;
    const spacing=p.foundationSpacing/1000,unionLength=L=>L+(N-1)*Math.min(L,spacing);
    const area=z=>{const L=q.botL+2*p.slope*z,W=q.botW+2*p.slope*z;return unionLength(L)*W;};
    const cut=p.slope>0?Math.max(0,Math.min(q.depth,(spacing-q.botL)/(2*p.slope))):0;
    const integrate=(a,b)=>(b-a)/6*(area(a)+4*area((a+b)/2)+area(b));
    total.excavation=integrate(0,cut)+integrate(cut,q.depth);
    total.mergedExcavation=total.excavation<q.excavation*N-1e-8;
    const subArea=unionLength(q.subL)*q.subW;
    total.lean=subArea*p.lean/1000;total.stone=subArea*p.stone/1000;total.stoneArea=p.stone>0?subArea:0;
    const buried=q.footing*N+g.cL*g.cW*g.embed*g.n/1e6*N+total.lean+total.stone;
    total.backfill=Math.max(0,total.excavation-buried);
    total.surplus=Math.max(0,total.excavation-total.backfill/p.soilC)*p.soilL;
    total.borrow=Math.max(0,total.backfill/p.soilC-total.excavation);
    return total;
  }
  function layout(span,cover,db,maxSpacing) {
    const centerSpan=span-2*cover-db;
    if(centerSpan<=0)throw new Error('철근 중심선 사이에 배치 공간이 없습니다.');
    const n=Math.ceil(centerSpan/maxSpacing-EPS)+1;
    return {n,actual:centerSpan/(n-1),start:cover+db/2,end:span-cover-db/2,centerSpan};
  }
  function flexCapacity(p,H,bar,As) {
    const d=H-p.cover-1.5*bar.d,a=As*p.fy/(0.85*p.fck*1000);
    const beta=Math.max(0.65,0.85-0.05*Math.max(0,p.fck-28)/7),c=a/beta;
    const strain=c>0?0.003*(d-c)/c:Infinity;
    return {d,a,strain,capacity:p.phiFlex*As*p.fy*(d-a/2)/1e6};
  }
  function reinforcement(p,g,l) {
    const one=g.L/1000,two=g.W/1000;
    const cantX=(g.L-g.cL)/2000,cantY=(g.W-g.cW)/2000;
    const mx=l.qu*cantX*cantX/2,my=l.qu*cantY*cantY/2;
    // A uniform maximum gross reaction is an explicit conservative strip envelope.
    // It is valid for this screening model only while the complete base remains in compression.
    const minAs=p.rho*1000*g.H;
    function trial(code,s) {
      const b=bars[code],x=layout(g.W,p.cover,b.d,s),y=layout(g.L,p.cover,b.d,s);
      const asX=b.area*1000/x.actual,asY=b.area*1000/y.actual;
      const fx=flexCapacity(p,g.H,b,asX),fy=flexCapacity(p,g.H,b,asY);
      const clearMin=Math.max(25,b.d,4*p.aggregate/3);
      const strengthOK=!canScreen(p)||(fx.capacity+EPS>=mx&&fy.capacity+EPS>=my&&Math.min(fx.strain,fy.strain)>=0.005);
      const valid=asX+EPS>=minAs&&asY+EPS>=minAs&&strengthOK&&Math.min(x.actual,y.actual)-b.d>=clearMin&&g.H>2*p.cover+4*b.d;
      return {code,b,s,x,y,asX,asY,fx,fy,valid,minAs,mx,my,clearMin};
    }
    let r;
    if(p.rebarMode==='auto') {
      const candidates=[];
      for(const code of [13,16,19,22,25,29,32])for(const s of [250,225,200,175,150,125,100]) {
        if(s>p.maxSpacing)continue;
        const t=trial(code,s);if(t.valid)candidates.push(t);
      }
      candidates.sort((a,b)=>(a.x.n*(g.L-2*p.cover)+a.y.n*(g.W-2*p.cover))*a.b.kg-(b.x.n*(g.L-2*p.cover)+b.y.n*(g.W-2*p.cover))*b.b.kg||a.code-b.code);
      r=candidates[0]||trial(32,100);
    } else r=trial(p.bar,p.spacing);
    const minD=Math.min(r.fx.d,r.fy.d),dM=minD/1000;
    const vuX=l.qu*Math.max(0,cantX-dM),vuY=l.qu*Math.max(0,cantY-dM);
    const vc=p.phiShear*0.17*Math.sqrt(p.fck)*1000*minD/1000;
    const punchInside=(g.cL/1000+dM)*(g.cW/1000+dM);
    const b0=2*(g.cL+g.cW+2*minD),beta=g.neck?Math.max(g.cL,g.cW)/Math.min(g.cL,g.cW):1;
    const punchVu=l.qu*Math.max(0,one*two-punchInside);
    const punchVc=p.phiShear*Math.min(0.17*(1+2/beta),0.083*(2+40*minD/b0),0.33)*Math.sqrt(p.fck)*b0*minD/1000;
    const criticalFits=g.neck&&g.cL+minD<g.L&&g.cW+minD<g.W;
    const ldAvail=Math.min(cantX,cantY)*1000-p.cover;
    const rows=[];
    function row(code,name,bar,count,length,note) {
      if(count<=0)return;
      if(length<=0||!Number.isFinite(length))throw new Error('철근 길이를 산출할 수 없습니다. 피복과 치수를 확인하세요.');
      rows.push({code,name,bar,count,length,totalLength:count*length/1000,kg:count*length/1000*bars[bar].kg,note});
    }
    row('F1','하부 X방향 직선근',r.code,r.x.n,g.L-2*p.cover,`${r.x.n}본 / 실제 @${r.x.actual.toFixed(1)}`);
    row('F2','하부 Y방향 직선근',r.code,r.y.n,g.W-2*p.cover,`${r.y.n}본 / 실제 @${r.y.actual.toFixed(1)}`);
    row('F3','상부 X방향 직선근',r.code,r.x.n,g.L-2*p.cover,'하부와 같은 격자 · 상세검토용 초안');
    row('F4','상부 Y방향 직선근',r.code,r.y.n,g.W-2*p.cover,'하부와 같은 격자 · 상세검토용 초안');
    let neck=null;
    if(g.neck) {
      const tb=bars[p.tieBar];
      const tieX=g.cL-2*p.neckCover-tb.d,tieY=g.cW-2*p.neckCover-tb.d;
      if(Math.min(tieX,tieY)<=0)throw new Error('목 피복에 띠철근을 배치할 공간이 없습니다.');
      let nb=p.neckBar,nx=p.neckNX,ny=p.neckNY;
      if(p.rebarMode==='auto') {
        // Preliminary minimum cage only. Axial force/moment interaction is not checked.
        const choices=[];
        for(const code of [16,19,22,25,29,32]) {
          const b=bars[code],sx=g.cL-2*(p.neckCover+tb.d)-b.d,sy=g.cW-2*(p.neckCover+tb.d)-b.d;
          const ax=Math.max(2,Math.ceil(sx/150)+1),ay=Math.max(2,Math.ceil(sy/150)+1),n=2*(ax+ay)-4;
          if(n*b.area>=0.01*g.cL*g.cW)choices.push({code,ax,ay,n,kg:n*b.kg});
        }
        choices.sort((a,b)=>a.kg-b.kg);
        if(!choices.length)throw new Error('목 철근의 예비 격자를 만들 수 없습니다. 목 치수를 확인하세요.');
        nb=choices[0].code;nx=choices[0].ax;ny=choices[0].ay;
      }
      const b=bars[nb],longN=2*(nx+ny)-4,start=p.neckCover+tb.d+b.d/2;
      const sx=(g.cL-2*start)/(nx-1),sy=(g.cW-2*start)/(ny-1);
      if(Math.min(sx,sy)-b.d<Math.max(25,b.d,4*p.aggregate/3))throw new Error('목 주근 순간격이 부족합니다. 본수 또는 목 치수를 확인하세요.');
      const ties=layout(g.cH,p.neckCover,tb.d,p.tieSpacing);
      const rhoNeck=longN*b.area/(g.cL*g.cW);
      const embedAvail=g.H-p.cover-2*r.b.d;
      const tailAvail=Math.min((g.L-g.cL)/2,(g.W-g.cW)/2)-p.cover;
      neck={bar:nb,b,nx,ny,longN,start,sx,sy,tieX,tieY,ties,tieBar:p.tieBar,rho:rhoNeck,embedAvail,tailAvail,tieLimit:Math.min(16*b.d,48*tb.d,Math.min(g.cL,g.cW)/2)};
      row('P1','목 L형 주근 (정착 길이 입력)',nb,longN*g.n,g.cH-p.neckCover+p.dowelEmbed+p.dowelTail,`목당 ${longN}본 · 수직 ${g.cH-p.neckCover+p.dowelEmbed} + 꼬리 ${p.dowelTail} mm`);
      row('P2','목 폐쇄 띠철근 (135° 갈고리 초안)',p.tieBar,ties.n*g.n,2*(tieX+tieY)+20*tb.d,`목당 ${ties.n}단 / 실제 @${ties.actual.toFixed(1)} · 갈고리 10db×2 가정`);
      row('P3','목 보조띠 Y방향',p.tieBar,(nx-2)*ties.n*g.n,tieY+20*tb.d,'각 단의 중간 주근 횡지지 초안 · 10db×2 가정');
      row('P4','목 보조띠 X방향',p.tieBar,(ny-2)*ties.n*g.n,tieX+20*tb.d,'각 단의 중간 주근 횡지지 초안 · 10db×2 가정');
    }
    const net=rows.reduce((s,r)=>s+r.kg,0);
    return {...r,vuX,vuY,vc,punchVu,punchVc,criticalFits,ldAvail,neck,rows,net,gross:net*(1+p.rebarWaste/100)};
  }
  function checks(p,g,l,r) {
    const supported=canScreen(p);
    function c(label,demand,capacity,pass,detail,status) {return {label,demand:supported?demand:null,capacity:supported?capacity:null,pass:supported?pass:null,detail,status:supported?(status|| (pass?'충족':'미충족')):'미검토'};}
    return [
      c('연직 유효하중',l.N,0,l.N>0,'지하수 부력 차감 · 안정용 자중계수 적용'),
      c('저면 전면 접지 (사용하중)',l.kern,1,l.N>0&&l.kern<=1+EPS,'6|ex|/L + 6|ey|/W ≤ 1 · 이축 편심'),
      c('지반 지지력 (사용하중)',l.qmax,p.qa,l.N>0&&l.kern<=1+EPS&&l.qmax<=p.qa+EPS,'총 허용지지력 qa와 비교 · kPa'),
      c('활동 안전율',l.fsSlide,p.fsTarget,l.N>0&&l.fsSlide+EPS>=p.fsTarget,'μN / √(Fx²+Fy²) · 수동토압 제외'),
      c('전도 안전율 (두 축 합산)',l.fsOver,p.fsTarget,l.N>0&&l.fsOver+EPS>=p.fsTarget,'N / [2(Mx/W + My/L)] · 예비 지표'),
      c('저면 전면 접지 (계수하중)',l.kernU,1,l.Nu>0&&l.kernU<=1+EPS,'계수반력도 전면 압축일 때만 휨·전단식 적용'),
      c('푸팅 X방향 휨',r.mx,r.fx.capacity,r.fx.capacity+EPS>=r.mx&&r.fx.strain>=0.005&&l.kernU<=1,'최대 계수반력 균등분포의 1m 캔틸레버 · kN·m/m'),
      c('푸팅 Y방향 휨',r.my,r.fy.capacity,r.fy.capacity+EPS>=r.my&&r.fy.strain>=0.005&&l.kernU<=1,'철근 2겹 중 작은 유효깊이 · kN·m/m'),
      c('설정 최소 철근량 / 순간격',Math.min(r.asX,r.asY),r.minAs,r.valid&&Math.max(r.x.actual,r.y.actual)<=p.maxSpacing+EPS,'ρbh · 설정 검토값 / mm²/m'),
      c('푸팅 1방향 전단',Math.max(r.vuX,r.vuY),r.vc,Math.max(r.vuX,r.vuY)<=r.vc+EPS&&l.kernU<=1,'목 면에서 d 위치 · λ=1, 단순식 · kN/m'),
      c('직선근 정착 공간',p.ld,r.ldAvail,p.ld<=r.ldAvail+EPS,'입력 ld와 목 면부터 끝단까지 비교 · 정착 설계 별도'),
      c('목 주근 정착 공간',p.dowelEmbed,r.neck?.embedAvail||0,!!r.neck&&p.dowelEmbed<=r.neck.embedAvail&&p.dowelTail<=r.neck.tailAvail,'입력 근입·꼬리 길이의 공간만 확인 · mm'),
      c('목 띠근 간격 / 주근비 초안',r.neck?.ties.actual||0,r.neck?.tieLimit||0,!!r.neck&&r.neck.ties.actual<=r.neck.tieLimit+EPS&&r.neck.rho>=0.01-EPS&&r.neck.rho<=0.04+EPS,'min(16db주근, 48db띠근, 목 최소치수/2) · 주근비 1~4%의 예비 상세값 / P–M 별도'),
      {label:'뚫림전단 · 축력 성분 추정',demand:supported&&r.criticalFits?r.punchVu:null,capacity:supported&&r.criticalFits?r.punchVc:null,pass:null,status:supported&&!r.criticalFits?'적용 범위 밖':'별도 검토',detail:supported&&!r.criticalFits?'목 면에서 d/2 떨어진 위험둘레가 푸팅 내부에 들어오지 않습니다. 현재 추정식은 적용하지 않으며 별도 검토가 필요합니다.':'축력 추정값만 표시 / 불균형 모멘트 전달 및 위험둘레 응력 분포 미검토'},
      // Steel post and anchor rows count toward the verdict but not toward footing sizing.
      ...Steel.checks(p,g,l).map(x=>supported||x.pass===null&&x.status==='별도 검토'?x:{...x,demand:null,capacity:null,pass:null,status:'미검토'}),
      {label:'목 P–M',demand:null,capacity:null,pass:null,status:'별도 검토',detail:'콘크리트 목의 축력·휨 상호작용과 앵커 보강철근 상세'},
      {label:'침하 · 내진 · 현장 조건',demand:null,capacity:null,pass:null,status:'별도 검토',detail:'침하·회전·내진·동결심도·노출등급 피복·정착 및 이음 설계'}
    ];
  }
  function evaluate(p,g) {
    const q=earth(p,g),l=loads(p,g,q),r=reinforcement(p,g,l),c=checks(p,g,l,r);
    const footingOK=canScreen(p)&&c.filter(x=>x.pass!==null&&x.group!=='steel').every(x=>x.pass);
    return {g,q,l,r,checks:c,footingOK,screenOK:footingOK&&c.filter(x=>x.group==='steel'&&x.pass!==null).every(x=>x.pass)};
  }
  function calculate(raw) {
    const p=validate(raw);let result,search=null;
    if(p.mode==='auto') {
      let best=null,count=0;
      const minH=Math.ceil(Math.max(1500,p.dowelEmbed+p.cover+64)/100)*100;
      for(let H=minH;H<=p.autoHMax+EPS;H+=100) {
        for(let W=Math.ceil(Math.max(1500,p.cW+2*(p.ld+p.cover), (p.cL+2*(p.ld+p.cover))/p.aspect)/100)*100;W<=p.autoMax+EPS;W+=100) {
          const L=Math.ceil(W*p.aspect/100)*100;if(L>p.autoMax)continue;
          if(best&&L*W*H>=best.g.L*best.g.W*best.g.H)continue;
          let g;try{g=geometry(p,L,W,H);}catch{continue;}
          const q=earth(p,g),l=loads(p,g,q);count++;
          if(l.N<=0||l.kern>1||l.kernU>1||l.qmax>p.qa||l.fsSlide<p.fsTarget||l.fsOver<p.fsTarget)continue;
          const e=evaluate(p,g);
          // Axial punching estimate is an additional sizing filter, never a final punching approval.
          if(e.footingOK&&e.r.criticalFits&&e.r.punchVu<=e.r.punchVc){best=e;break;}
        }
      }
      search={count,found:!!best,step:100};
      if(best)result=best;
      else {result=evaluate(p,geometry(p));result.footingOK=false;result.screenOK=false;}
    } else result=evaluate(p,geometry(p));
    const {q,r,g,l}=result,N=p.qty,supports=supportCounts(p),quantities=aggregateQuantities(p,g,q);
    const quantityTotals={'구조 콘크리트 · 푸팅':quantities.footing,'구조 콘크리트 · 목':quantities.neck,'구조 콘크리트 · 주문량':quantities.orderedConcrete,'거푸집 · 푸팅 측면':quantities.formFoot,'거푸집 · 목 측면':quantities.formNeck,'버림 콘크리트':quantities.lean,'잡석 지정':quantities.stone,'터파기 · 자연상태':quantities.excavation,'되메우기 · 다짐상태':quantities.backfill,'잔토 반출 · 흐트러진 상태':quantities.surplus,'되메움 추가 반입 · 자연상태':quantities.borrow};
    const boq=[
      ['구조 콘크리트 · 푸팅','m³',q.footing,`${g.L/1000}×${g.W/1000}×${g.H/1000}`],
      ['구조 콘크리트 · 목','m³',q.neck,`${g.cL/1000}×${g.cW/1000}×${g.cH/1000}×${g.n}`],
      ['구조 콘크리트 · 주문량','m³',q.orderedConcrete,`순체적 ${q.concrete.toFixed(3)} × (1+${p.concWaste}%) · 위 2행과 중복 합산 금지`],
      ['거푸집 · 푸팅 측면','m²',q.formFoot,'2(L+W)H · 바닥·상면 제외'],
      ['거푸집 · 목 측면','m²',q.formNeck,'2(cL+cW)cH×목 개수'],
      ['버림 콘크리트','m³',q.lean,`(L+2Ow)(W+2Ow)×${p.lean/1000}`],
      ['잡석 지정','m³',q.stone,`(L+2Ow)(W+2Ow)×${p.stone/1000}`],
      ['터파기 · 자연상태','m³',q.excavation,`H/6(A하+A상+4A중) · 심도 ${q.depth.toFixed(3)}m`],
      ['되메우기 · 다짐상태','m³',q.backfill,'터파기 − 지중 구조물·버림·잡석'],
      ['잔토 반출 · 흐트러진 상태','m³',q.surplus,`max(터파기−되메우기/C,0)×L · C=${p.soilC}, L=${p.soilL} · 동일 토질 재사용 가정`],
      ['되메움 추가 반입 · 자연상태','m³',q.borrow,'max(되메우기/C−터파기,0) · 동일 토질 재사용 가정'],
      ['철근 · 순물량','kg',r.net,'Σ(본수×전개길이×규격 단위중량)'],
      ['철근 · 할증 포함','kg',r.gross,`순물량×(1+${p.rebarWaste}%) · 이음길이 포함 아님`]
    ].map(([name,unit,value,formula])=>({name,unit,value,total:quantityTotals[name]??value*N,formula:formula+(quantities.mergedExcavation&&['터파기 · 자연상태','되메우기 · 다짐상태','잔토 반출 · 흐트러진 상태','되메움 추가 반입 · 자연상태'].includes(name)?' · 같은 높이·같은 치수의 X방향 배치: 겹치는 굴착영역 중복 제거':'')}));
    if(supports.known)boq.unshift({name:'기둥·지주 수량',unit:'본',value:supports.perFoundation,total:supports.total,formula:`기초 1개당 ${supports.perFoundation}본 × 같은 기초 ${N}개 · 지주 제작비 별도`});
    const warnings=[
      '예시 입력으로 산출하는 예비 검토·배근 초안입니다. 계산 항목 충족은 전체 구조 안전 또는 시공 승인 판정이 아닙니다.',
      '지도 기본풍속은 2022년 공식 지도에서 판독한 기준지점 인근의 예비값입니다. 정밀 위치별 GIS 조회값이나 현장 확정값이 아닙니다. 경계·해안·산지·도서는 원문 등풍속선과 현장 지형을 확인하세요.',
      '지도 모드는 V=V0·KD·Kzr·Kzt·Iw, p=0.5ρV²·Cf·G로 계산합니다. 주변 조도·지형·중요도·풍력·가스트 및 하중계수는 현장 기준에 맞춰 별도 확인해야 합니다.',
      '정면·측면 풍하중을 동시에 작용시키는 보수적 가정입니다. 기초 위 흙의 안정 기여와 수동토압은 제외합니다.',
      '목 철근은 1% 및 150mm 격자를 기준으로 한 초안이며 P–M 검증이 없습니다. 띠철근 갈고리·보조띠는 상세설계가 필요합니다.',
      '전개길이는 중심선 개략값입니다. 절곡 공제·철근 이음·의자근·스페이서는 물량에 포함되지 않습니다. 앵커는 묻힘깊이를 입력한 경우 강재 인장·전단과 콘크리트 콘 파괴·뽑힘만 예비 검토합니다.',
      '강도 검토는 입력한 단일 하중계수 조합의 예비 계산입니다. 모든 하중조합 또는 500년 풍속에 대한 적용 하중계수의 적합성을 검증하지 않습니다.'
    ];
    if(p.type!=='single')warnings.unshift('이 기초 형식은 수량·배근 초안만 지원합니다. 독립기초 식으로 구조 충족 판정을 하지 않습니다. 매트의 건물 하중·줄기초의 선하중·복합기초 반력 분배는 별도 해석하세요.');
    if(supports.shared){
      warnings.unshift('전광판 1대 아래 여러 기초를 배치합니다. 기초별 하중·모멘트·들림 반력은 미배분이며, 입력한 동일 치수로 수량·설정 철근비의 배근 초안만 산출합니다. 구조 충족 판정과 자동 치수 선정은 제공하지 않습니다.');
      if(p.foundationSpacing<g.L)warnings.unshift('기초 중심 간격이 푸팅 가로보다 작아 기초가 겹칩니다. 간격·치수를 수정하거나 통기초 형식을 검토하세요.');
      const postExtent=(N-1)*p.foundationSpacing+(p.type==='combined'?p.postSpacing:0);
      if(supports.known&&postExtent>p.signW)warnings.unshift('바깥 기둥 중심이 전광판 폭 밖에 있습니다. 기초 간격과 연결 프레임 배치를 확인하세요.');
      if(quantities.mergedExcavation)warnings.push('같은 높이·같은 치수로 X방향에 나란히 놓는 기초의 겹치는 터파기 영역을 중복 제거했습니다. 각 기초의 1개 물량과 전체 토공 물량은 단순 배수와 다를 수 있습니다.');
    }
    const steelFailed=canScreen(p)&&result.checks.some(c=>c.group==='steel'&&c.pass===false);
    if(steelFailed)warnings.unshift(`지주·앵커 검토 미충족: ${result.checks.filter(c=>c.group==='steel'&&c.pass===false).map(c=>c.label).join(', ')}. 기초 치수를 키워도 해결되지 않습니다. 기둥 단면·두께·강도 또는 앵커 개수·직경·묻힘깊이를 수정하세요.`);
    if(search&&!search.found)warnings.unshift('지정한 탐색 한도 내에서 후보를 찾지 못했습니다. 화면의 치수는 수동 입력값이며 자동 추천 결과가 아닙니다.');
    if(canScreen(p)&&(l.kern>1||l.kernU>1))warnings.unshift('저면 일부에 인장 반력이 계산됩니다. 표시 qmax는 전면 접지 가정값이며 유효 지반응력이 아닙니다. 휨·전단 예비 검토는 미충족 처리됩니다.');
    if(p.columnShape!=='schematic'||p.plateShape==='circle')warnings.push('기둥 단면과 베이스플레이트 모양은 도면·그라우트 물량·앵커의 기하 배치에 반영합니다. 기둥 자중은 지주·프레임 총중량에 직접 입력하고 기둥 자체 풍하중은 추가 하중으로 반영하세요. 강재 기둥과 앵커는 두께·묻힘깊이를 입력하면 예비 검토하며, 베이스플레이트·용접·앵커 측면파열·전단 콘크리트 파괴와 너트·공구 여유는 별도 검토 대상입니다. 콘크리트 목은 사각 단면입니다.');
    if(p.cover<75)warnings.push('푸팅 피복이 75mm 미만입니다. 지반 접촉·버림·노출 조건에 따른 요구 피복을 확인하세요.');
    if(r.neck&&(r.neck.rho<0.01||r.neck.rho>0.04))warnings.push('목 주근 비율이 초안 검토범위 1~4%를 벗어납니다.');
    return {p,...result,search,boq,warnings,supports,quantities,total:{foundations:N,posts:supports.total,concrete:quantities.concrete,orderedConcrete:quantities.orderedConcrete,form:quantities.form,excavation:quantities.excavation,rebarNet:r.net*N,rebarGross:r.gross*N},oldRebar:q.concrete*p.oldRatio*(1+p.rebarWaste/100)*N};
  }
  const api={bars,types,defaults,limits,validate,sharedSupports,canScreen,supportCounts,geometry,earth,loads,layout,flexCapacity,calculate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
