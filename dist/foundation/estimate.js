(function(root){
  'use strict';
  const Steel=typeof module!=='undefined'&&module.exports?require('./steel.js'):root.FoundationSteel;
  // Attached code_artifact2.html example rates; these are not live market prices.
  const defaultPrices={excavation:14000,stone:28000,stoneLabor:4500,lean:105000,footing:115000,neck:125000,formFoot:32000,formNeck:38000,rebar:1180,backfill:8500,surplus:18000,borrow:0,anchor:32000,template:120000,grout:16000,ground:65000,elp:12000};
  function column(p){
    const box=p.columnShape==='rect'||p.columnShape==='h',t=p.columnThickness>0?`×${p.columnThickness}t`:'';
    return {shape:p.columnShape,known:p.columnShape!=='schematic',width:p.columnShape==='circle'?p.columnDiameter:box?p.columnWidth:150,depth:p.columnShape==='circle'?p.columnDiameter:box?p.columnDepth:150,
      label:p.columnShape==='circle'?`원형 Ø${p.columnDiameter}${t}`:p.columnShape==='rect'?`사각 ${p.columnWidth}×${p.columnDepth}${t}`:p.columnShape==='h'?`H ${p.columnDepth}×${p.columnWidth}${p.columnThickness>0?`×${p.columnThickness}`:''}${p.columnFlange>0?`×${p.columnFlange}`:''}`:'단면 미입력 / 개념 표시'};
  }
  function accessory(r){
    const {p,g}=r,mounts=g.neck?g.n:1,round=p.plateShape==='circle',profile=column(p),plateL=round?p.plateDiameter:p.plateL,plateW=round?p.plateDiameter:p.plateW;
    if(!round&&p.anchorCount%4!==0)throw new Error('사각 플레이트의 앵커 개수는 0 또는 4의 배수로 입력하세요.');
    if(plateL>(g.neck?g.cL:g.L)||plateW>(g.neck?g.cW:g.W))throw new Error('베이스플레이트가 지지 콘크리트 치수를 벗어납니다.');
    if(p.anchorCount&&p.anchorEdge<p.anchorDiameter/2)throw new Error('앵커 볼트가 플레이트 끝을 벗어납니다. 끝~중심 거리는 볼트 반지름 이상으로 입력하세요.');
    if(p.anchorCount&&Math.min(plateL,plateW)<=2*p.anchorEdge+p.anchorDiameter)throw new Error('앵커 연단거리와 직경을 배치할 플레이트 공간이 부족합니다.');
    if(profile.known){
      const fits=round?(profile.shape==='circle'?profile.width:Math.hypot(profile.width,profile.depth))<=p.plateDiameter:profile.width<=plateL&&profile.depth<=plateW;
      if(!fits)throw new Error('기둥 단면이 베이스플레이트 밖으로 벗어납니다. 기둥 크기와 플레이트 치수를 확인하세요.');
    }
    const area=round?Math.PI*p.plateDiameter**2/4:p.plateL*p.plateW,plateLabel=round?`원형 Ø${p.plateDiameter}`:`사각 ${p.plateL}×${p.plateW}`;
    const volume=area*p.groutThickness*mounts/1e9;
    const liters=volume*1000*p.qty,groutBags=Math.max(0,Math.ceil(liters*(1+p.groutWaste/100)/p.groutYield-1e-9));
    const anchors=p.anchorCount*mounts*p.qty,templates=p.anchorCount?mounts*p.qty:0;
    const positions=Steel.anchorPositions(p);
    if(p.anchorCount){
      for(let i=0;i<positions.length;i++)for(let j=0;j<i;j++){
        const distance=Math.hypot(positions[i][0]-positions[j][0],positions[i][1]-positions[j][1]);
        if(distance+1e-9<p.anchorDiameter)throw new Error('앵커 볼트끼리 겹칩니다. 앵커 수량·직경을 줄이거나 플레이트·배치 간격을 늘리세요.');
      }
      if(profile.known)for(const [x,y]of positions){
        const gap=profile.shape==='circle'?Math.hypot(x,y)-profile.width/2:Math.hypot(Math.max(Math.abs(x)-profile.width/2,0),Math.max(Math.abs(y)-profile.depth/2,0));
        if(gap+1e-9<p.anchorDiameter/2)throw new Error('앵커 볼트가 기둥 단면과 겹칩니다. 플레이트 치수·앵커 배치 또는 기둥 크기를 수정하세요.');
      }
    }
    return {mounts,volume,area,plateLabel,plateL,plateW,column:profile,round,boltCircleDiameter:round&&p.anchorCount?p.plateDiameter-2*p.anchorEdge:null,liters,groutBags,anchors,templates,positions,groundRods:p.groundRods*p.qty,elpLength:p.elpLength*p.qty};
  }
  function calculate(r,rawPrices={}){
    const prices={...defaultPrices,...rawPrices};
    for(const [k,v]of Object.entries(prices))if(!Object.hasOwn(defaultPrices,k)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e9)throw new Error('단가는 0~1,000,000,000원 범위의 수치로 입력하세요.');
    const {p,q}=r,N=p.qty,a=accessory(r),t=r.quantities;
    const rows=[
      ['excavation','터파기','m³',t.excavation,t.mergedExcavation?'동일 높이의 X방향 기초: 겹치는 굴착영역 중복 제거':'자연상태 굴착 체적'],
      ['stone','잡석 자재','m³',t.stone,'버림·잡석 면적 × 두께 / 공유 배치의 겹치는 면적 중복 제거'],
      ['stoneLabor','잡석 포설·다짐','m²',t.stoneArea,'잡석 면적 / 자재와 작업 단가 분리'],
      ['lean','버림 콘크리트','m³',t.lean,'버림 체적 / 공유 배치의 겹치는 면적 중복 제거'],
      ['footing','푸팅 콘크리트 주문','m³',q.footing*(1+p.concWaste/100)*N,`순체적 + ${p.concWaste}% 할증`],
      ['neck','목 콘크리트 주문','m³',q.neck*(1+p.concWaste/100)*N,`순체적 + ${p.concWaste}% 할증`],
      ['formFoot','푸팅 거푸집','m²',q.formFoot*N,'푸팅 측면'],
      ['formNeck','목 거푸집','m²',q.formNeck*N,'목 측면'],
      ['rebar','철근 자재·가공조립','kg',r.total.rebarGross,'단위는 kg / 원본 ton 단가를 1,000으로 나눔'],
      ['backfill','되메우기·다짐','m³',t.backfill,'다짐상태 / 전체 굴착에서 지중 체적 공제'],
      ['surplus','잔토 반출','m³',t.surplus,'흐트러진 상태'],
      ['borrow','되메움 추가 반입','m³',t.borrow,'자연상태 / 예시 단가 미설정'],
      ['anchor',`앵커 M${p.anchorDiameter} 세트`,'조',a.anchors,'볼트·너트·와셔 1조 / 강도·길이·재질 별도'],
      ['template','앵커 템플릿 상·하 묶음','세트',a.templates,'1세트=2장 / 목 또는 지지부당 1세트'],
      ['grout','무수축 몰탈 (25kg)','포',a.groutBags,`${a.plateLabel} × 두께 ${p.groutThickness}mm / ${p.groutYield}L/포 / 손실 ${p.groutWaste}% / 현재 기초 종류 전체에서 올림`],
      ['ground','접지 동봉·배선','조',a.groundRods,'기초당 입력 수량 / 접지저항·배선 경로 별도'],
      ['elp','전원·통신 ELP 매설','m',a.elpLength,'기초당 실제 인입 길이 입력']
    ].map(([id,name,unit,quantity,formula])=>({id,name,unit,quantity,formula,unitPrice:prices[id],amount:Math.round(quantity*prices[id])}));
    const subtotal=rows.reduce((s,r)=>s+r.amount,0),vat=Math.round(subtotal*p.vat/100);
    return {a,rows,prices,subtotal,vat,total:subtotal+vat,unpriced:rows.filter(r=>r.quantity>0&&r.unitPrice===0).map(r=>r.name),note:'첨부 파일의 예시 단가입니다. 시장 표준가격·견적 확정값이 아니며 지주·전광판·장비·운반 등 표 외 비용은 포함하지 않습니다.'};
  }
  const api={defaultPrices,column,accessory,calculate};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationEstimate=api;
})(typeof globalThis!=='undefined'?globalThis:this);
