(function(root){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  // Steel column section of the extra members marked as posts in the frame. Front wind acts along the
  // frame depth, so face (b) maps to the foundation column width (X) and depth (d) to its depth (Y).
  function postTransfer(result,limits){
    const s=result?.posts;if(!s)return {patch:{},notes:[],posts:null};
    const m=s.material,rotated=s.rotation===1,width=rotated?m.depth:m.face,depth=rotated?m.face:m.depth,notes=[];
    let patch=null;
    if(!(m.t1>0))notes.push(`지주 자재 ${m.name}의 두께가 없어 기초 기둥 단면을 전달하지 않습니다. 구조물 자재에 관·웹 두께를 입력하세요.`);
    else if(m.family==='pipe')patch={columnShape:'circle',columnDiameter:m.face,columnThickness:m.t1};
    else if(m.family==='square'||m.family==='rect')patch={columnShape:'rect',columnWidth:width,columnDepth:depth,columnThickness:m.t1};
    else if(m.family==='hbeam'&&!rotated)patch={columnShape:'h',columnWidth:m.face,columnDepth:m.depth,columnThickness:m.t1,columnFlange:m.t2};
    else if(m.family==='hbeam')notes.push('H형강 지주를 90° 회전해 웹이 전광판 면과 나란합니다. 기초 기둥 검토는 웹이 정면 풍향인 배치만 지원하므로 단면을 전달하지 않습니다.');
    else notes.push(`지주 자재 ${m.name}은 단면 종류가 직접 입력이라 기초 기둥 단면을 전달하지 않습니다. 사각관·직사각관·H형강·원형 강관 중에서 고르세요.`);
    if(patch)for(const [key,value]of Object.entries(patch))if(typeof value==='number'&&limits[key]&&(value<limits[key][0]||value>limits[key][1])){notes.push(`지주 단면 ${key} ${value}가 기초 기둥 입력 범위 ${limits[key][0]}~${limits[key][1]}를 벗어나 전달하지 않습니다.`);patch=null;break;}
    return {patch:patch||{},notes,posts:s};
  }
  // keepProduct: the frame has no product weight yet, so the foundation keeps its own product weight (panelKgM2).
  function transfer(result,limits,options={}){
    if(!result)throw Error('구조물 입력 오류를 먼저 수정하세요.');
    const g=result.general,q=g.quantity,area=g.width*g.height/1e6;
    if(!Number.isInteger(q)||q<1||!Number.isFinite(area)||area<=0)throw Error('구조물 크기와 제작 수량을 확인하세요.');
    const patch={signW:g.width,signH:g.height,panelKgM2:result.cabinetWeight/q/area,postKg:(result.frameWeight+result.accessoryWeight)/q,extraKg:(result.equipmentWeight-result.cabinetWeight)/q};
    if(g.planes===2)patch.signDepth=g.depth;
    if(options.keepProduct)delete patch.panelKgM2;
    const weights=Object.keys(patch);Object.assign(patch,postTransfer(result,limits).patch);
    for(const key of weights){const value=patch[key];
      const [min,max]=limits[key];
      const labels={signW:'전광판 가로',signH:'전광판 세로',signDepth:'전광판 깊이',panelKgM2:'전광판 면적당 중량',postKg:'지주·프레임 중량',extraKg:'추가 장비 중량'};
      if(!Number.isFinite(value)||value<min||value>max)throw Error(`${labels[key]} (${key}): 기초의 허용 범위 ${min}~${max}를 벗어납니다. 구조물 값을 확인하세요.`);
    }
    return patch;
  }
  // Per-board values are what the foundation receives, so a change of production quantity alone keeps the link.
  function fingerprint(frame,patch){return JSON.stringify({id:frame.id,patch});}
  function legacyFingerprint(frame,patch){return JSON.stringify({id:frame.id,quantity:frame.general.quantity,patch});}
  function isLinked(link,frame,patch,foundation){
    if(!link||(link.source!==fingerprint(frame,patch)&&link.source!==legacyFingerprint(frame,patch))||link.active!==foundation.project.active)return false;
    const current=foundation.project.items[foundation.project.active].p;
    if(link.itemId&&link.itemId!==foundation.project.items[foundation.project.active].id)return false;
    return Object.entries(patch).every(([key,value])=>typeof value==='string'?current[key]===value:Math.abs(current[key]-value)<=1e-8*Math.max(1,Math.abs(value)));
  }
  function cleanLink(raw){
    if(!raw||typeof raw.source!=='string'||raw.source.length>2000||!Number.isInteger(raw.active)||raw.active<0||raw.active>=50)return null;
    return {source:raw.source,active:raw.active,itemId:typeof raw.itemId==='string'?raw.itemId.slice(0,120):null,appliedAt:typeof raw.appliedAt==='string'?raw.appliedAt.slice(0,40):'',keepProduct:raw.keepProduct===true};
  }
  function cleanReview(raw){
    if(!raw||typeof raw.source!=='string'||raw.source.length>2000)return null;
    return {source:raw.source,product:raw.product===true,posts:raw.posts===true,accessories:raw.accessories===true};
  }
  function itemKey(item,index){return item.id||'legacy-'+index;}
  function cleanCounts(raw,foundation){
    const counts={};
    for(const [i,item]of foundation.project.items.entries()){
      const key=itemKey(item,i),value=raw&&Object.hasOwn(raw,key)?raw[key]:1;
      if(!Number.isInteger(value)||value<1||value>1000)throw Error('반복 설치 횟수는 1~1,000의 정수로 입력하세요.');
      Object.defineProperty(counts,key,{value,writable:true,enumerable:true,configurable:true});
    }
    return counts;
  }
  function status(result,engine){
    if(!result)return {code:'invalid',label:'입력 오류',detail:'입력 오류를 수정하면 결과가 표시됩니다.'};
    if(!engine.canScreen(result.p))return {code:'unreviewed',label:'구조 미검토 · 수량 초안',detail:'이 형식·다중 기초 배치의 반력 분배와 구조 검토는 별도입니다.'};
    if(result.search&&!result.search.found)return {code:'no-candidate',label:'자동 후보 없음',detail:'아래 치수와 물량은 입력되어 있던 수동값입니다. 자동 추천 결과가 아닙니다.'};
    if(!result.screenOK)return {code:'failed',label:'예비 계산 항목 미충족',detail:'검토 표의 미충족 항목을 확인하세요.'};
    const steelPending=result.checks.some(c=>c.group==='steel'&&c.pass===null&&/^미검토/.test(c.status));
    return {code:'preliminary',label:'예비 계산 항목 충족',detail:'표시된 계산 범위의 초안입니다. 베이스플레이트·접합부·전체 구조 검토는 별도입니다.',steelPending};
  }
  // The headline is green only when the screened result also rests on confirmed site data and weights.
  function effectiveStatus(s,data=[],massMissing=[]){
    if(s.code!=='preliminary'||(!data.length&&!massMissing.length&&!s.steelPending))return s;
    const pending=[...(data.length?['현장 자료']:[]),...(massMissing.length?['실제 중량']:[]),...(s.steelPending?['지주·앵커 입력']:[])].join('·');
    return {code:'example',label:'예시 조건 충족 · 확정 전',detail:`계산 항목은 충족하지만 ${pending} 확인이 남아 있습니다. 확인 전에는 확정 결과로 쓰지 마세요.`};
  }
  // Check closest to its limit as a utilization ratio (≤ 1 passes): minimum-type checks use limit/actual, the others demand/capacity.
  function governing(result){
    if(!result?.checks)return null;let best=null;
    for(const c of result.checks){
      if(c.pass===null||c.pass===undefined||!Number.isFinite(c.demand)||!Number.isFinite(c.capacity)||c.capacity===0||/연직 유효하중/.test(c.label))continue;
      const factor=/안전율|최소/.test(c.label),ratio=factor?(c.demand>0?c.capacity/c.demand:Infinity):c.demand/c.capacity;
      if(Number.isFinite(ratio)&&(!best||ratio>best.ratio))best={label:c.label,ratio,demand:c.demand,capacity:c.capacity,factor,pass:c.pass};
    }
    return best;
  }
  // Reference only: footing contact under the minimum dead-load combination (0.9D + windFactor·W).
  function upliftReference(result,engine){
    if(!result||!engine.canScreen(result.p)||typeof engine.loads!=='function')return null;
    const l=engine.loads({...result.p,deadFactor:0.9},result.g,result.q);
    return {deadFactor:0.9,windFactor:result.p.windFactor,kern:l.kernU,current:result.l.kernU,pass:l.Nu>0&&l.kernU<=1+1e-8};
  }
  function dataStatus(item){
    const ui=item.ui||{},notes=[];
    if(!ui.groundKnown)notes.push('지반자료 미확인');
    if(ui.windExample)notes.push('풍하중 예시 적용');
    else if(!ui.windManual&&!(item.p.windMode==='regional'&&item.p.windPoint))notes.push('풍하중 선택 미확인');
    return notes;
  }
  function aggregate(foundation,engine,estimate,counts={}){
    const total={boards:0,foundations:0,posts:0,unknownPosts:false,concrete:0,rebar:0,subtotal:0,vat:0,cost:0,anchors:0,items:[],boq:[],unpriced:[]};
    const allQuantities=new Map(),missing=new Map();
    for(const [i,item]of foundation.project.items.entries()){
      const key=itemKey(item,i),repeats=Object.hasOwn(counts,key)?counts[key]:1;
      if(!Number.isInteger(repeats)||repeats<1||repeats>1000)throw Error('반복 설치 횟수는 1~1,000의 정수로 입력하세요.');
      const r=engine.calculate(item.p),cost=estimate.calculate(r,foundation.prices),s=status(r,engine);
      const row={key:itemKey(item,i),name:item.name,repeats,r,cost,status:s,data:dataStatus(item),boards:r.supports.boards*repeats,foundations:r.p.qty*repeats,concrete:r.total.orderedConcrete*repeats,rebar:r.total.rebarGross*repeats,total:cost.total*repeats};
      total.items.push(row);total.boards+=row.boards;total.foundations+=row.foundations;total.posts+=(r.supports.total||0)*repeats;total.unknownPosts ||= !r.supports.known;
      total.concrete+=row.concrete;total.rebar+=row.rebar;total.subtotal+=cost.subtotal*repeats;total.vat+=cost.vat*repeats;total.cost+=row.total;total.anchors+=cost.a.anchors*repeats;
      const accessoryRows=cost.rows.filter(q=>['anchor','template','grout','ground','elp'].includes(q.id)).map(q=>({name:q.name,unit:q.unit,total:q.quantity,formula:q.formula+(q.id==='grout'?' · 배치 1회 주문 포수를 올림한 후 반복 횟수 적용; 배치 간 남은 재료 공유는 별도':'')}));
      if(cost.a.plate)accessoryRows.push({name:cost.a.plate.name,unit:'kg',total:cost.a.plate.kg,formula:cost.a.plate.formula});
      accessoryRows.push({name:'그라우트 순체적',unit:'L',total:cost.a.liters,formula:'플레이트 면적 × 그라우트 두께 · 주문 포수와 중복 합산 금지'});
      for(const q of [...r.boq,...accessoryRows]){const key=q.name+'|'+q.unit,current=allQuantities.get(key)||{name:q.name,unit:q.unit,quantity:0,notes:[]};current.quantity+=q.total*repeats;if(q.formula&&!current.notes.includes(q.formula))current.notes.push(q.formula);allQuantities.set(key,current);}
      for(const q of cost.rows)if(q.quantity>0&&q.unitPrice===0)missing.set(q.id,{id:q.id,name:q.name});
    }
    total.boq=[...allQuantities.values()];total.unpriced=[...missing.values()];return total;
  }
  function compareCandidates(p,engine,estimate,prices){
    if(!engine.canScreen(p))throw Error('후보 비교는 중앙 1주 독립기초의 예비 계산 범위에 적용합니다.');
    const base=engine.calculate(p),current=base.g.H;
    // Candidates keep the base plate, anchors and neck chosen for the current result.
    if(base.connection?.found)p={...p,...base.connection.values,connectionMode:'manual'};
    const heights=[...new Set([current-100,current,current+100].filter(h=>h>=1500&&h<=p.autoHMax))];
    const alternatives=[];let evaluated=0;
    for(const H of heights){
      let best=null;
      const minimum=Math.ceil(Math.max(1500,p.cW+2*(p.ld+p.cover),(p.cL+2*(p.ld+p.cover))/p.aspect)/100)*100;
      for(let W=minimum;W<=p.autoMax;W+=100){
        const L=Math.ceil(W*p.aspect/100)*100;if(L>p.autoMax)continue;
        let candidate;try{candidate=engine.calculate({...p,mode:'manual',L,W,H});}catch{continue;}evaluated++;
        if(!candidate.screenOK||!candidate.r.criticalFits||candidate.r.punchVu>candidate.r.punchVc)continue;
        if(!best||candidate.q.concrete<best.q.concrete)best=candidate;
      }
      alternatives.push(best?{H,r:best,estimate:estimate.calculate(best,prices)}:{H,r:null,estimate:null});
    }
    return {alternatives,evaluated,source:JSON.stringify({p,prices}),note:'최소 두께·탐색 상한 내에서 현재 두께 주변의 100mm 단계 최대 3개를 같은 조건으로 비교합니다. 모든 형태의 최적설계나 시공 확정을 의미하지 않습니다.'};
  }
  function validate(raw,frameAPI,foundationAPI){
    if(raw?.format!=='led-integrated-project'||raw.version!==1)throw Error('지원하지 않는 통합 작업 파일입니다.');
    // Both calculators are validated before either screen or database changes.
    const frame=frameAPI.validateProject(raw.frame),foundation=foundationAPI.validateProject(raw.foundation);
    const installationCounts=cleanCounts(raw.installationCounts,foundation);
    const link=cleanLink(raw.link);
    // Older bundles used only the active index. Bind that saved item once during
    // migration so later replacement at the same position cannot inherit review.
    if(link&&!link.itemId)link.itemId=foundation.project.items[link.active]?.id||null;
    const priceReview=raw.priceReview&&typeof raw.priceReview.source==='string'&&raw.priceReview.source.length<20000?{source:raw.priceReview.source,confirmed:raw.priceReview.confirmed===true,included:Array.isArray(raw.priceReview.included)?raw.priceReview.included.filter(x=>typeof x==='string').slice(0,30):[]}:null;
    return {format:'led-integrated-project',version:1,name:String(raw.name||'전광판 통합 프로젝트').slice(0,80),view:['frame','foundation','overview'].includes(raw.view)?raw.view:'frame',frame,foundation,link,massReview:cleanReview(raw.massReview),installationCounts,priceReview,costReview:typeof raw.costReview==='string'&&raw.costReview.length<30000?raw.costReview:null};
  }
  const api={clone,postTransfer,transfer,fingerprint,legacyFingerprint,isLinked,effectiveStatus,governing,upliftReference,validate,itemKey,cleanCounts,status,dataStatus,aggregate,compareCandidates};root.CalculatorSuiteEngine=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
