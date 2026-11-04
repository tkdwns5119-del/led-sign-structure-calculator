(function(root){
  'use strict';
  // Preliminary LRFD checks of one steel post and its cast-in anchors (KDS 41 31 00 / KDS 14 20 54,
  // AISC 360 / ACI 318 Ch.17 basis). Units: mm, N, MPa inside; kN, kN·m in the returned rows.
  // Front wind acts along Y (sign face along X): it bends the post about X, using the Y depth
  // (columnDepth, plate W) and the anchor y coordinates. Side wind uses X.
  const E=210000,phiB=0.9,phiV=0.9,phiC=0.9,K=2;
  // ISO coarse thread pitch for the tensile stress area of anchor rods.
  const pitches=[[16,2],[20,2.5],[22,2.5],[24,3],[27,3],[30,3.5],[33,3.5],[36,4],[39,4],[42,4.5],[45,4.5],[48,5],[52,5],[56,5.5],[60,5.5],[64,6]];
  function threadPitch(d){let pitch=pitches[0][1];for(const [size,value]of pitches)if(size<=d)pitch=value;return pitch;}
  function anchorPositions(p){
    const positions=[];if(!p.anchorCount)return positions;
    if(p.plateShape==='circle'){const radius=p.plateDiameter/2-p.anchorEdge;for(let i=0;i<p.anchorCount;i++){const angle=(p.anchorAngle+360*i/p.anchorCount)*Math.PI/180;positions.push([radius*Math.cos(angle),radius*Math.sin(angle)]);}}
    else{const perSide=p.anchorCount/4,x=p.plateL/2-p.anchorEdge,y=p.plateW/2-p.anchorEdge;
      for(let i=0;i<perSide;i++){const t=i/perSide;positions.push([-x+2*x*t,-y],[x,-y+2*y*t],[x-2*x*t,y],[-x,y-2*y*t]);}}
    return positions;
  }
  function section(p){
    const shape=p.columnShape,t=p.columnThickness;
    if(shape==='schematic')return {missing:'기둥 단면 미입력'};
    if(!(t>0))return {missing:shape==='h'?'웹 두께 tw 미입력':'강관 두께 t 미입력'};
    if(shape==='circle'){
      const D=p.columnDiameter,d=D-2*t;if(d<=0)throw new Error('columnThickness: 강관 두께는 외경의 절반보다 작아야 합니다.');
      const I=Math.PI/64*(D**4-d**4),Z=(D**3-d**3)/6;
      return {kind:'circle',label:`원형 강관 Ø${D}×${t}t`,D,t,A:Math.PI/4*(D*D-d*d),Ix:I,Iy:I,Sx:2*I/D,Sy:2*I/D,Zx:Z,Zy:Z};
    }
    if(shape==='rect'){
      const B=p.columnWidth,H=p.columnDepth,b=B-2*t,h=H-2*t;if(Math.min(B,H)<=3*t)throw new Error('columnThickness: 각형 강관 두께가 단면 치수의 1/3 이상입니다.');
      const Ix=(B*H**3-b*h**3)/12,Iy=(H*B**3-h*b**3)/12;
      return {kind:'rect',label:`각형 강관 □${B}×${H}×${t}t`,B,H,t,A:B*H-b*h,Ix,Iy,Sx:2*Ix/H,Sy:2*Iy/B,Zx:(B*H*H-b*h*h)/4,Zy:(H*B*B-h*b*b)/4};
    }
    if(!(p.columnFlange>0))return {missing:'플랜지 두께 tf 미입력'};
    // H-shape with the web along Y: the strong axis resists front wind. Fillets are ignored.
    const d=p.columnDepth,bf=p.columnWidth,tw=t,tf=p.columnFlange,h=d-2*tf,ho=d-tf;
    if(h<=0||tw>=bf)throw new Error('H형강 치수를 확인하세요. 플랜지 두께의 2배는 춤보다, 웹 두께는 플랜지 폭보다 작아야 합니다.');
    const Ix=(bf*d**3-(bf-tw)*h**3)/12,Iy=(2*tf*bf**3+h*tw**3)/12;
    return {kind:'h',label:`H ${d}×${bf}×${tw}×${tf}`,d,bf,tw,tf,h,ho,A:2*bf*tf+h*tw,Ix,Iy,Sx:2*Ix/d,Sy:2*Iy/bf,Zx:bf*tf*ho+tw*h*h/4,Zy:tf*bf*bf/2+h*tw*tw/4,J:(2*bf*tf**3+ho*tw**3)/3,Cw:Iy*ho*ho/4};
  }
  // Nominal flexural strength about each axis (N·mm); null marks a slender section outside this screen.
  function flexure(s,Fy,Lb){
    const r=Math.sqrt(E/Fy);
    if(s.kind==='circle'){
      const lambda=s.D/s.t,Mp=Fy*s.Zx;
      if(lambda>0.45*E/Fy)return {x:null,y:null,note:'D/t > 0.45E/Fy 세장 강관'};
      const Mn=lambda<=0.07*E/Fy?Mp:lambda<=0.31*E/Fy?(0.021*E/lambda+1)*Fy*s.Sx:0.33*E/lambda*s.Sx;
      return {x:Math.min(Mn,Mp),y:Math.min(Mn,Mp),note:lambda<=0.07*E/Fy?'조밀':'비조밀'};
    }
    if(s.kind==='rect'){
      const axis=(flange,web,Z,S)=>{
        const lf=(flange-3*s.t)/s.t,lw=(web-3*s.t)/s.t,Mp=Fy*Z;
        if(lf>1.40*r||lw>5.70*r)return null;
        let Mn=Mp;
        if(lf>1.12*r)Mn=Math.min(Mn,Mp-(Mp-Fy*S)*(3.57*lf*Math.sqrt(Fy/E)-4));
        if(lw>2.42*r)Mn=Math.min(Mn,Mp-(Mp-Fy*S)*(0.305*lw*Math.sqrt(Fy/E)-0.738));
        return Mn;
      };
      const x=axis(s.B,s.H,s.Zx,s.Sx),y=axis(s.H,s.B,s.Zy,s.Sy);
      return {x,y,note:x===null||y===null?'b/t 또는 h/t 세장 판':''};
    }
    const lf=s.bf/(2*s.tf),lw=s.h/s.tw,lpf=0.38*r,lrf=r;
    if(lw>3.76*r)return {x:null,y:null,note:'비조밀·세장 웹'};
    const Mp=Fy*s.Zx,ry=Math.sqrt(s.Iy/s.A),Lp=1.76*ry*r,rts=Math.sqrt(Math.sqrt(s.Iy*s.Cw)/s.Sx),jc=s.J/(s.Sx*s.ho);
    const Lr=1.95*rts*E/(0.7*Fy)*Math.sqrt(jc+Math.sqrt(jc*jc+6.76*(0.7*Fy/E)**2));
    // Cantilever with an unbraced tip: Lb = post length, Cb = 1.0.
    const ltb=Lb<=Lp?Mp:Lb<=Lr?Mp-(Mp-0.7*Fy*s.Sx)*(Lb-Lp)/(Lr-Lp):Math.PI**2*E/(Lb/rts)**2*Math.sqrt(1+0.078*jc*(Lb/rts)**2)*s.Sx;
    const kc=Math.min(0.76,Math.max(0.35,4/Math.sqrt(lw)));
    const flb=lf<=lpf?Mp:lf<=lrf?Mp-(Mp-0.7*Fy*s.Sx)*(lf-lpf)/(lrf-lpf):0.9*E*kc*s.Sx/(lf*lf);
    const Mpy=Math.min(Fy*s.Zy,1.6*Fy*s.Sy),y=lf<=lpf?Mpy:lf<=lrf?Mpy-(Mpy-0.7*Fy*s.Sy)*(lf-lpf)/(lrf-lpf):0.69*E/(lf*lf)*s.Sy;
    return {x:Math.min(Mp,ltb,flb),y,note:`횡비틀림 Lb ${Lb.toFixed(0)} mm (Lp ${Lp.toFixed(0)}, Lr ${Lr.toFixed(0)}) · Cb=1.0`};
  }
  function shearCoefficient(ht,kv,Fy){const limit=1.10*Math.sqrt(kv*E/Fy);return ht<=limit?1:ht<=1.37*Math.sqrt(kv*E/Fy)?limit/ht:1.51*kv*E/(ht*ht*Fy);}
  // Nominal shear strength (N) for front (Y) and side (X) wind.
  function shear(s,Fy,Lv){
    if(s.kind==='circle'){
      const lambda=s.D/s.t,Fcr=Math.min(0.6*Fy,Math.max(1.60*E/(Math.sqrt(Lv/s.D)*lambda**1.25),0.78*E/lambda**1.5)),Vn=Fcr*s.A/2;
      return {front:Vn,side:Vn};
    }
    if(s.kind==='rect'){
      const web=depth=>{const h=depth-3*s.t;return 0.6*Fy*2*h*s.t*shearCoefficient(h/s.t,5,Fy);};
      return {front:web(s.H),side:web(s.B)};
    }
    return {front:0.6*Fy*s.d*s.tw*shearCoefficient(s.h/s.tw,5.34,Fy),side:0.6*Fy*2*s.bf*s.tf*shearCoefficient(s.bf/(2*s.tf),1.2,Fy)};
  }
  function compression(s,Fy,L){
    const rmin=Math.sqrt(Math.min(s.Ix,s.Iy)/s.A),slender=K*L/rmin,Fe=Math.PI**2*E/(slender*slender);
    const Fcr=slender<=4.71*Math.sqrt(E/Fy)?0.658**(Fy/Fe)*Fy:0.877*Fe;
    return {Pn:Fcr*s.A,slender};
  }
  // Post-base actions: base plate on the neck top; one post per foundation (single T type).
  function actions(p,g,l){
    const base=g.above/1000,length=p.bottom+p.signH/1000-base,arm=Math.max(0,l.center-base),extraArm=Math.max(0,p.extraForceZ-base);
    const wf=p.windFactor,df=p.deadFactor;
    return {base,length,arm,extraArm,
      mFront:wf*(l.front*arm+p.extraForce*extraArm)+df*l.upper*Math.abs(p.eccY),mSide:wf*l.side*arm+df*l.upper*Math.abs(p.eccX),
      vFront:wf*(l.front+p.extraForce),vSide:wf*l.side,pMax:df*l.upper,pMin:p.stabilize*l.upper};
  }
  const row=(label,demand,capacity,pass,detail,status)=>({group:'steel',label,demand,capacity,pass,detail,status:status||(pass?'충족':'미충족')});
  const pending=(label,status,detail)=>({group:'steel',label,demand:null,capacity:null,pass:null,detail,status});
  function postChecks(p,g,l){
    const s=section(p);
    if(s.missing)return [pending('지주 강재 · 휨·전단·축력','미검토 · 입력 필요',`${s.missing} · 기둥 단면과 두께를 입력하면 강재 지주를 예비 검토합니다.`)];
    const a=actions(p,g,l),Fy=p.columnFy,L=a.length*1000;
    const m=flexure(s,Fy,L),v=shear(s,Fy,L),c=compression(s,Fy,L);
    const rows=[],pc=phiC*c.Pn/1000,pr=a.pMax/pc;
    if(m.x===null||m.y===null)rows.push(row('지주 휨·축력 조합 (계수하중)',null,1,false,`${s.label} · ${m.note} · 유효폭 계산은 이 예비 검토 범위 밖입니다. 단면을 키우거나 두께를 늘리세요.`,'적용 범위 밖'));
    else{
      const mx=phiB*m.x/1e6,my=phiB*m.y/1e6;
      const bending=s.kind==='circle'?Math.hypot(a.mFront,a.mSide)/mx:a.mFront/mx+a.mSide/my;
      const ratio=pr>=0.2?pr+8/9*bending:pr/2+bending;
      rows.push(row('지주 휨·축력 조합 (계수하중)',ratio,1,ratio<=1+1e-9,`${s.label} · Fy ${Fy} MPa · Mu 정면 ${a.mFront.toFixed(2)} / 측면 ${a.mSide.toFixed(2)} kN·m · φMn ${mx.toFixed(2)} / ${my.toFixed(2)} kN·m · Pu ${a.pMax.toFixed(2)} kN, φPn ${pc.toFixed(1)} kN (K=2.0, KL/r ${c.slender.toFixed(0)}) · ${m.note} · 2차 효과·압축 국부좌굴 미고려`));
    }
    const vf=a.vFront/(phiV*v.front/1000),vs=a.vSide/(phiV*v.side/1000),frontGoverns=s.kind==='circle'||vf>=vs;
    const vu=s.kind==='circle'?Math.hypot(a.vFront,a.vSide):frontGoverns?a.vFront:a.vSide,vn=phiV*(frontGoverns?v.front:v.side)/1000;
    rows.push(row('지주 전단 (계수하중)',vu,vn,vu<=vn+1e-9,`${frontGoverns?'정면':'측면'} 방향 · Vu와 φVn · kN · φv=0.9`));
    const I=s.Ix,F=l.front*1000,x=a.arm*1000,e=p.extraForce*1000,z=a.extraArm*1000;
    const deflection=(F*x*x*(3*L-x)+e*z*z*(3*L-z))/(6*E*I),limit=L/100;
    rows.push(row('지주 상단 처짐 (사용 풍하중 · 참고)',deflection,limit,null,`정면 풍하중을 화면 중심 높이의 집중하중으로 본 캔틸레버 처짐 · mm · 비교값 L/100은 참고이며 허용 처짐은 발주·제작 기준을 확인`,'참고'));
    return rows;
  }
  // Rigid plate, elastic bolt group about the bolt centroid; grout bearing is not used for the lever arm.
  // Returns per-bolt forces (N) for the uplift combination (stabilize × upper weight) and the bearing one (dead factor).
  function anchorForces(p,a){
    const pos=anchorPositions(p),n=pos.length;
    // Bolts on one line (within rounding of the bolt-circle trigonometry) cannot resist moment across it.
    const lever=v=>v>1e-6?v:0,sx=lever(pos.reduce((t,[x])=>t+x*x,0)),sy=lever(pos.reduce((t,[,y])=>t+y*y,0));
    const moment=(m,c,sum)=>sum>0?m*1e6*c/sum:m>0?Infinity:0;
    const tension=pos.map(([x,y])=>moment(a.mFront,y,sy)+moment(a.mSide,x,sx)-a.pMin*1000/n);
    return {pos,n,sx,sy,tension,line:!Number.isFinite(Math.max(0,...tension))};
  }
  // Numeric anchor review (N, mm). The row builder and the automatic search share it.
  function anchorEval(p,g,a,f=anchorForces(p,a)){
    const {pos,n,tension}=f,da=p.anchorDiameter,hefInput=p.anchorEmbed;
    if(f.line)return {line:true,ok:false};
    const tMax=Math.max(0,...tension)/1000,vb=Math.hypot(a.vFront,a.vSide)/n;
    const futa=Math.min(p.anchorFu,1.9*p.anchorFy,860),Ase=Math.PI/4*(da-0.9382*threadPitch(da))**2,grout=p.groutThickness>0?0.8:1;
    const phiNsa=0.75*Ase*futa/1000,phiVsa=0.65*0.6*Ase*futa*grout/1000;
    // Concrete breakout of the tension group in the neck (cracked, Condition B, φ=0.70).
    const cL=g.neck?g.cL:g.L,cW=g.neck?g.cW:g.W,group=pos.filter((_,i)=>tension[i]>1e-6),loadsT=tension.filter(t=>t>1e-6);
    let breakout=null;
    if(group.length){
      const xs=group.map(([x])=>x),ys=group.map(([,y])=>y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
      const edges=[cL/2+x0,cL/2-x1,cW/2+y0,cW/2-y1],spacing=Math.max(x1-x0,y1-y0);
      let hef=hefInput;const near=edges.filter(c=>c<1.5*hef);
      if(near.length>=3)hef=Math.min(hef,Math.max(Math.max(...near)/1.5,spacing/3));
      const span=(c0,s,c1)=>Math.min(c0,1.5*hef)+s+Math.min(c1,1.5*hef);
      const ANc=Math.min(span(edges[0],x1-x0,edges[1])*span(edges[2],y1-y0,edges[3]),group.length*9*hef*hef);
      const caMin=Math.min(...edges),psiEd=caMin>=1.5*hef?1:0.7+0.3*caMin/(1.5*hef);
      const sum=loadsT.reduce((t,v)=>t+v,0),cx=xs.reduce((t,v)=>t+v,0)/group.length,cy=ys.reduce((t,v)=>t+v,0)/group.length;
      const ex=Math.abs(group.reduce((t,[x],i)=>t+loadsT[i]*x,0)/sum-cx),ey=Math.abs(group.reduce((t,[,y],i)=>t+loadsT[i]*y,0)/sum-cy);
      const psiEc=1/(1+ex/(1.5*hef))/(1+ey/(1.5*hef));
      const Nb=hef>=280&&hef<=635?3.9*Math.sqrt(p.fck)*hef**(5/3):10*Math.sqrt(p.fck)*hef**1.5;
      breakout={hef,ANc,ANco:9*hef*hef,psiEd,psiEc,Nb,sum:sum/1000,capacity:0.70*ANc/(9*hef*hef)*psiEc*psiEd*Nb/1000,caMin,count:group.length};
    }
    const headed=p.anchorHead!=='hooked',Abrg=0.866*(1.5*da)**2-Math.PI/4*da*da;
    const phiNp=0.70*(headed?8*Abrg*p.fck:0.9*p.fck*3*da*da)/1000;
    const tu=Math.max(tMax/phiNsa,tMax/phiNp,breakout?breakout.sum/breakout.capacity:0),vu=vb/phiVsa,both=tu>0.2&&vu>0.2;
    const combined=both?tu+vu:Math.max(tu,vu),limit=both?1.2:1;
    // Torqued cast-in anchors: spacing ≥ 4da, edge distance ≥ 6da; embedment must fit the concrete.
    let smin=Infinity;for(let i=0;i<n;i++)for(let j=0;j<i;j++)smin=Math.min(smin,Math.hypot(pos[i][0]-pos[j][0],pos[i][1]-pos[j][1]));
    const edge=Math.min(...pos.map(([x,y])=>Math.min(cL/2-Math.abs(x),cW/2-Math.abs(y)))),sRatio=n>1?smin/(4*da):Infinity,eRatio=edge/(6*da);
    const depth=(g.neck?g.cH:0)+g.H-p.cover;
    const pass={steel:tMax<=phiNsa+1e-9,breakout:!breakout||breakout.sum<=breakout.capacity+1e-9,pullout:tMax<=phiNp+1e-9,shear:vb<=phiVsa+1e-9,combined:combined<=limit+1e-9,layout:sRatio>=1-1e-9&&eRatio>=1-1e-9,depth:hefInput<=depth+1e-9};
    return {n,da,hefInput,tMax,vb,futa,Ase,grout,phiNsa,phiVsa,breakout,headed,Abrg,phiNp,both,combined,limit,smin,edge,sRatio,eRatio,depth,pass,ok:Object.values(pass).every(Boolean)};
  }
  function anchorChecks(p,g,l){
    if(!p.anchorCount)return [pending('앵커 · 인장·전단','미검토 · 앵커 없음','강재 지주를 고정하는 앵커 수량을 입력하세요.')];
    if(!(p.anchorEmbed>0))return [pending('앵커 · 인장·전단','미검토 · 입력 필요','앵커 묻힘깊이 hef를 입력하면 강재·콘크리트 인장 파괴를 예비 검토합니다.')];
    if(p.plateShape!=='circle'&&p.anchorCount%4!==0)return [pending('앵커 · 인장·전단','미검토 · 배치 오류','사각 플레이트의 앵커 개수는 4의 배수로 입력하세요.')];
    const e=anchorEval(p,g,actions(p,g,l));
    if(e.line)return [row('앵커 강재 인장 (0.9D + γW)',null,null,false,'앵커가 한 줄로 놓여 해당 방향 모멘트를 받을 수 없습니다. 앵커 개수·배치를 수정하세요.','미충족')];
    const {n,da,breakout:b,pass}=e,rows=[];
    rows.push(row('앵커 강재 인장 (0.9D + γW)',e.tMax,e.phiNsa,pass.steel,`M${da} ${n}개 · Ase ${e.Ase.toFixed(1)} mm² · futa ${e.futa.toFixed(0)} MPa · 최대 인장 볼트 1개 · kN · 강체 플레이트·볼트군 탄성분배 가정`));
    if(b)rows.push(row('앵커 콘크리트 콘 파괴 (인장 그룹)',b.sum,b.capacity,pass.breakout,`인장 볼트 ${b.count}개 합계 · 적용 hef ${b.hef.toFixed(0)} mm (입력 ${e.hefInput}) · ANc/ANco ${(b.ANc/b.ANco).toFixed(3)} · ψed ${b.psiEd.toFixed(3)} · ψec ${b.psiEc.toFixed(3)} · 균열 콘크리트·보조철근 없음 φ=0.70 · 목 주근을 앵커 보강철근으로 설계하면 별도 검토로 대체`));
    else rows.push(row('앵커 콘크리트 콘 파괴 (인장 그룹)',0,0,true,'모든 볼트가 압축 상태 · 인장 그룹 없음','충족'));
    rows.push(row('앵커 뽑힘 (인장)',e.tMax,e.phiNp,pass.pullout,e.headed?`머리·너트 정착 · 육각 맞변 1.5da 가정 Abrg ${e.Abrg.toFixed(0)} mm² · Np=8Abrg·fck · 균열 콘크리트 φ=0.70`:'J·L형 갈고리 · eh=3da 최소값 가정 · Np=0.9fck·eh·da · 균열 콘크리트 φ=0.70'));
    rows.push(row('앵커 강재 전단',e.vb,e.phiVsa,pass.shear,`전단력을 볼트 ${n}개에 균등 분배 · kN${e.grout<1?' · 그라우트 패드 0.8 감소':''} · 전단 콘크리트 파괴·프라이아웃은 별도`));
    rows.push(row('앵커 인장·전단 조합',e.combined,e.limit,pass.combined,e.both?'Nua/φNn + Vua/φVn ≤ 1.2 · 인장은 강재·콘 파괴·뽑힘 중 지배값':'한쪽 사용률이 0.2 이하 · 지배 사용률 ≤ 1.0'));
    const spacingFirst=e.sRatio<=e.eRatio;
    rows.push(row('앵커 최소 간격·연단거리',spacingFirst?e.smin:e.edge,spacingFirst?4*da:6*da,pass.layout,`최소 간격 ${Number.isFinite(e.smin)?e.smin.toFixed(0):'—'} mm ≥ 4da ${4*da} · 목 끝까지 ${e.edge.toFixed(0)} mm ≥ 6da ${6*da} (너트 조임 가정)`));
    rows.push(row('앵커 묻힘깊이 공간',e.hefInput,e.depth,pass.depth,'목 상단부터 푸팅 하부 피복까지의 깊이 · mm'));
    return rows;
  }
  // KS D 3503 SS275 / KS D 3515 SM355 yield strength by plate thickness.
  const grades={SS275:[[16,275],[40,265],[100,245]],SM355:[[16,355],[40,345],[75,335],[100,325]]};
  function plateFy(grade,t){const table=grades[grade]||grades.SS275;return (table.find(([limit])=>t<=limit)||table[table.length-1])[1];}
  const plateThicknesses=[10,12,14,16,19,20,22,25,28,30,32,35,38,40,45,50,55,60,65,70,75,80,90,100];
  // Column extent along each plate direction for the critical bending line (AISC Design Guide 1: 0.95d, 0.8bf, 0.8D).
  function columnLines(p){
    if(p.columnShape==='circle')return {front:0.8*p.columnDiameter,side:0.8*p.columnDiameter};
    if(p.columnShape==='h')return {front:0.95*p.columnDepth,side:0.8*p.columnWidth};
    return {front:0.95*p.columnDepth,side:0.95*p.columnWidth};
  }
  // Rectangular plate bending per unit width (N·mm/mm): grout bearing on the compression side and anchor
  // tension on the tension side, for front wind (along plate W) and side wind (along plate L).
  function plateEval(p,g,a,f=anchorForces(p,a)){
    if(f.line)return {line:true};
    const lines=columnLines(p),area=g.neck?g.cL*g.cW:g.L*g.W,fp=0.65*0.85*p.fck*Math.min(2,Math.sqrt(area/(p.plateL*p.plateW)));
    const direction=(moment,len,wid,line,axis,sum)=>{
      const bearingT=f.pos.map(q=>(sum>0?moment*1e6*q[axis]/sum:0)-a.pMax*1000/f.n);
      const C=bearingT.reduce((t,v)=>t+Math.max(0,v),0)+a.pMax*1000,Y=C/(fp*wid),m=(len-line)/2;
      const Mc=m<=0?0:Y>=m?fp*m*m/2:fp*Y*(m-Y/2);
      const cmax=Math.max(...f.pos.map(q=>q[axis])),outer=f.pos.map((q,i)=>Math.abs(q[axis]-cmax)<1e-6?i:-1).filter(i=>i>=0);
      const Trow=outer.reduce((t,i)=>t+Math.max(0,f.tension[i]),0),x=cmax-line/2,beff=Math.min(wid,outer.length*2*x);
      const Mt=x>0&&Trow>0?Trow*x/beff:0;
      return {M:Math.max(Mc,Mt),side:Mc>=Mt?'지압':'앵커 인장',Y,half:len/2,C,m,x};
    };
    const front=direction(a.mFront,p.plateW,p.plateL,lines.front,1,f.sy),side=direction(a.mSide,p.plateL,p.plateW,lines.side,0,f.sx);
    const governs=front.M>=side.M?{...front,dir:'정면'}:{...side,dir:'측면'},bearing=front.Y/front.half>=side.Y/side.half?{...front,dir:'정면'}:{...side,dir:'측면'};
    const required=t=>Math.sqrt(4*governs.M/(phiB*plateFy(p.plateGrade,t)));
    return {fp,governs,bearing,required,bearingOK:bearing.Y<=bearing.half+1e-9};
  }
  function plateChecks(p,g,l){
    if(!p.anchorCount)return [pending('베이스플레이트 두께','미검토 · 앵커 없음','앵커를 입력하면 플레이트 휨을 검토합니다.')];
    if(p.plateShape==='circle')return [pending('베이스플레이트 두께','별도 검토','원형 플레이트의 휨은 이 예비 검토 범위 밖입니다. 사각 플레이트로 바꾸거나 별도 검토하세요.')];
    if(p.anchorCount%4!==0)return [];
    if(!(p.plateThickness>0))return [pending('베이스플레이트 두께','미검토 · 입력 필요','플레이트 두께를 입력하면 그라우트 지압과 앵커 인장에 의한 휨을 검토합니다.')];
    const e=plateEval(p,g,actions(p,g,l));if(e.line)return [];
    const t=p.plateThickness,Fy=plateFy(p.plateGrade,t),need=e.required(t),b=e.bearing,c=e.governs;
    return [
      row('베이스플레이트 두께 (휨)',need,t,need<=t+1e-9,`${p.plateGrade} Fy ${Fy} MPa · ${c.dir} 방향 ${c.side} 측 지배 · 필요 t = √(4Mu/0.9Fy) · mm · 기둥 면 0.95d·0.8bf·0.8D 기준(AISC Design Guide 1)`),
      row('베이스플레이트 지압 길이',b.Y,b.half,e.bearingOK,`${b.dir} 방향 압축 합력 ${(b.C/1000).toFixed(1)} kN · fp,max ${e.fp.toFixed(2)} MPa (0.65×0.85fck√(A2/A1)) · 지압 길이가 플레이트 절반 이내 · mm`)
    ];
  }
  // Automatic base plate and anchor selection for one post. Starting from the entered neck, the neck grows
  // in 100 mm steps until a layout passes; within that neck the lightest plate + anchor steel wins.
  function design(p,g,l,{maxNeck}){
    const s=section(p);
    if(s.missing)return {found:false,reason:`${s.missing} · 자동 산정은 기둥 단면과 두께가 필요합니다.`};
    const a=actions(p,g,l),lines=columnLines(p),width=p.columnShape==='circle'?p.columnDiameter:Math.max(p.columnWidth,p.columnDepth);
    let evaluated=0;
    for(let k=0;;k++){
      const cL=g.cL+100*k,cW=g.cW+100*k;if(Math.max(cL,cW)>maxNeck+1e-9)break;
      const neck={...g,cL,cW},depth=(g.neck?g.cH:0)+g.H-p.cover;let best=null;
      for(const da of [20,24,30,36,42])for(const count of [4,8,12]){
        // Plate edge to bolt centre ≥ 2da (≥ 60 mm); bolt centre to column face ≥ 1.5da for nut and wrench clearance.
        const edge=Math.ceil(Math.max(2*da,60)/5)*5,start=Math.ceil((width+2*edge+3*da)/50)*50;
        for(let N=start;N<=Math.min(cL,cW);N+=50){
          const q={...p,plateShape:'rect',plateL:N,plateW:N,anchorCount:count,anchorDiameter:da,anchorEdge:edge,cL,cW};
          const f=anchorForces(q,a);if(f.line)continue;
          const plate=plateEval(q,neck,a,f);if(!plate.bearingOK)continue;
          const t=plateThicknesses.find(t=>plate.required(t)<=t+1e-9);if(!t)continue;
          for(let hef=250;hef<=Math.min(depth,1500)+1e-9;hef+=50){
            evaluated++;const e=anchorEval({...q,anchorEmbed:hef},neck,a,f);
            if(!e.ok)continue;
            const mass=7.85e-6*(N*N*t+count*Math.PI/4*da*da*(hef+t+p.groutThickness+3*da));
            if(!best||mass<best.mass-1e-9||Math.abs(mass-best.mass)<=1e-9&&count<best.values.anchorCount)best={mass,values:{plateShape:'rect',plateL:N,plateW:N,plateThickness:t,anchorCount:count,anchorDiameter:da,anchorEdge:edge,anchorEmbed:hef,cL,cW}};
            break;
          }
        }
      }
      if(best)return {found:true,...best,neckGrown:k>0,from:{cL:g.cL,cW:g.cW},evaluated};
    }
    return {found:false,evaluated,reason:`목을 ${maxNeck} mm까지 키워도 통과하는 플레이트·앵커 조합이 없습니다. 기둥 단면·풍하중을 확인하거나 앵커 보강철근 설계를 검토하세요.`};
  }
  function checks(p,g,l){
    return [...postChecks(p,g,l),...anchorChecks(p,g,l),...plateChecks(p,g,l),pending('용접 · 앵커 측면파열·전단 콘크리트 파괴','별도 검토','기둥–플레이트 용접, 측면파열, 전단 콘크리트 파괴·프라이아웃, 앵커 보강철근')];
  }
  const api={E,threadPitch,anchorPositions,section,flexure,shear,compression,actions,anchorForces,anchorEval,postChecks,anchorChecks,plateFy,plateEval,plateChecks,design,checks};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationSteel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
