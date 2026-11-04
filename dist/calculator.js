(function (root) {
  'use strict';
  const defaults={width:4000,height:2000,frames:1,face:50,sectionDepth:50,unitWeight:3.34,vertical:3,horizontal:1,equipment:0,planes:1,depth:600,sideVertical:0,sideHorizontal:1,stockLength:6000,kerf:3,endTrim:0,spliceAllowance:0};
  const limits={width:[100,100000,1],height:[100,100000,1],frames:[1,1000,1],face:[1,1000],sectionDepth:[1,1000],unitWeight:[0.001,10000],vertical:[0,100,1],horizontal:[0,100,1],equipment:[0,1000000],planes:[1,2,1],depth:[1,100000],sideVertical:[0,100,1],sideHorizontal:[0,100,1],stockLength:[100,100000],kerf:[0,20],endTrim:[0,1000]};
  const labels={width:'가로',height:'세로',frames:'제작 수량',face:'부재 정면 폭 b',sectionDepth:'부재 깊이 방향 폭 d',unitWeight:'단위중량',vertical:'세로 보강재',horizontal:'가로 보강재 열',equipment:'전광판·기타 중량',planes:'프레임 구성',depth:'전체 깊이',sideVertical:'측면 세로 보강재',sideHorizontal:'측면 가로 보강재 열',stockLength:'원자재 길이',kerf:'절단 톱날 손실',endTrim:'양끝 정리 여유'};
  const sources={tube:{label:'DS GROUP 각관 규격표',url:'https://dsnp.kr/steel.html'},h100:{label:'현대제철 Products Guide · KS/JIS 90',url:'https://www.hyundai-steel.com/kr/down/2017_ProductGuide_Part2.pdf'},h150:{label:'동국제강 제품 가이드',url:'https://www.dongkuk.com/upload/pdf/product_guide2.pdf'},h200:{label:'하피스 형강 제품 자료',url:'https://www.hapis.co.kr/hapis/resources/upload_file/C101/2025/04/41cf68bb402746c589ad6e7db69918ae_0.pdf'},pipe:{label:'KS D 3566 일반구조용 탄소강관 · 단위중량 W=0.02466t(D−t)',url:'https://standard.go.kr/'}};
  const families={square:'사각관',rect:'직사각관',hbeam:'H형강',pipe:'원형 강관',custom:'직접 입력'};
  const presets={
    '40':{family:'square',face:40,sectionDepth:40,thickness:2.3,unitWeight:2.62,label:'40 × 40 × 2.3t',source:'tube'},
    '50':{family:'square',face:50,sectionDepth:50,thickness:2.3,unitWeight:3.34,label:'50 × 50 × 2.3t',source:'tube'},
    '75':{family:'square',face:75,sectionDepth:75,thickness:3.2,unitWeight:7.01,label:'75 × 75 × 3.2t',source:'tube'},
    '100':{family:'square',face:100,sectionDepth:100,thickness:3.2,unitWeight:9.52,label:'100 × 100 × 3.2t',source:'tube'},
    'r60x40':{family:'rect',face:40,sectionDepth:60,thickness:2.3,unitWeight:3.34,label:'60 × 40 × 2.3t',source:'tube'},
    'r100x50':{family:'rect',face:50,sectionDepth:100,thickness:3.2,unitWeight:7.01,label:'100 × 50 × 3.2t',source:'tube'},
    'r125x75':{family:'rect',face:75,sectionDepth:125,thickness:3.2,unitWeight:9.52,label:'125 × 75 × 3.2t',source:'tube'},
    'r150x100':{family:'rect',face:100,sectionDepth:150,thickness:3.2,unitWeight:12,label:'150 × 100 × 3.2t',source:'tube'},
    'h100':{family:'hbeam',face:100,sectionDepth:100,web:6,flange:8,unitWeight:17.2,label:'H 100 × 100 × 6 × 8',source:'h100'},
    'h150':{family:'hbeam',face:150,sectionDepth:150,web:7,flange:10,unitWeight:31.5,label:'H 150 × 150 × 7 × 10',source:'h150'},
    'h200x100':{family:'hbeam',face:100,sectionDepth:200,web:5.5,flange:8,unitWeight:21.3,label:'H 200 × 100 × 5.5 × 8',source:'h200'},
    'p114_3':{family:'pipe',face:114.3,sectionDepth:114.3,thickness:4.5,unitWeight:12.18,label:'Ø114.3 × 4.5t',source:'pipe'},
    'p139_8':{family:'pipe',face:139.8,sectionDepth:139.8,thickness:4.5,unitWeight:15.01,label:'Ø139.8 × 4.5t',source:'pipe'},
    'p165_2':{family:'pipe',face:165.2,sectionDepth:165.2,thickness:5,unitWeight:19.75,label:'Ø165.2 × 5t',source:'pipe'},
    'p216_3':{family:'pipe',face:216.3,sectionDepth:216.3,thickness:5.8,unitWeight:30.11,label:'Ø216.3 × 5.8t',source:'pipe'},
    'p267_4':{family:'pipe',face:267.4,sectionDepth:267.4,thickness:6.6,unitWeight:42.45,label:'Ø267.4 × 6.6t',source:'pipe'},
    'p318_5':{family:'pipe',face:318.5,sectionDepth:318.5,thickness:6.9,unitWeight:53.02,label:'Ø318.5 × 6.9t',source:'pipe'}
  };
  function presetValues(section,rotation=0){const p=presets[section];if(!p||![0,1].includes(rotation))throw new Error('부재 규격과 방향을 확인하세요.');return {face:rotation?p.sectionDepth:p.face,sectionDepth:rotation?p.face:p.sectionDepth,unitWeight:p.unitWeight};}
  const EPS=1e-7;
  limits.spliceAllowance=[0,1000];labels.spliceAllowance='이음부당 겹침 여유';
  const roles={outerLeft:'외곽 좌측 세로재',outerRight:'외곽 우측 세로재',outerTop:'외곽 상단 가로재',outerBottom:'외곽 하단 가로재',innerVertical:'정면 세로 보강재',innerHorizontal:'정면 가로 보강재',depthTop:'측면 상단 연결재',depthBottom:'측면 하단 연결재',sideLeftVertical:'좌측면 세로 보강재',sideLeftHorizontal:'좌측면 가로 보강재',sideRightVertical:'우측면 세로 보강재',sideRightHorizontal:'우측면 가로 보강재'};
  const roleCodes={outerLeft:'A1',outerRight:'A2',outerTop:'B1',outerBottom:'B2',innerVertical:'C',innerHorizontal:'D',depthTop:'E1',depthBottom:'E2',sideLeftVertical:'F1',sideLeftHorizontal:'G1',sideRightVertical:'F2',sideRightHorizontal:'G2'};

  function profile(raw, fallback){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('부위별 규격 형식을 확인하세요.');
    const p={...fallback,...raw};
    p.rotation=p.rotation??0;
    if(![0,1].includes(p.rotation))throw new Error('부재 방향을 확인하세요.');
    if(!Object.hasOwn(families,p.family))throw new Error('부재 종류를 확인하세요.');
    if(p.section!=='custom'&&!Object.hasOwn(presets,p.section))throw new Error('부재 규격을 확인하세요.');
    const selected=presets[p.section];
    if(selected){
      const values=presetValues(p.section,p.rotation);
      // A selected catalogue entry supplies any dimensions omitted by an API caller.
      for(const [k,value] of Object.entries(values))if(raw[k]===undefined)p[k]=value;
      if(Object.keys(values).some(k=>p[k]!==values[k]))p.section='custom';
      else p.family=selected.family;
    }
    for(const k of ['face','sectionDepth','unitWeight','stockLength']){
      const [min,max]=limits[k];
      if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<min||p[k]>max)throw new Error(`${labels[k]}: ${min}~${max} 범위로 입력하세요.`);
    }
    p.materialName=typeof p.materialName==='string'?p.materialName.trim().slice(0,60):'';
    return Object.fromEntries(['family','section','rotation','face','sectionDepth','unitWeight','stockLength','materialName'].map(k=>[k,p[k]]));
  }
  function materialLabel(p){return `${families[p.family]} · ${presets[p.section]?.label||p.materialName||`${Math.max(p.face,p.sectionDepth)} × ${Math.min(p.face,p.sectionDepth)} · 직접 입력`} · ${p.unitWeight} kg/m`;}
  function materialKey(p){return JSON.stringify([p.section==='custom'?[p.family,p.materialName,Math.min(p.face,p.sectionDepth),Math.max(p.face,p.sectionDepth),p.unitWeight]:p.section,p.stockLength]);}

  function splitMember(length,usable,allowance){
    if(length<=usable+EPS)return {segments:[{length,count:1}],joints:0,extra:0};
    if(usable<=allowance+EPS)throw new Error('이음부 겹침 여유는 사용 가능한 원자재 길이보다 작아야 합니다.');
    const joints=Math.ceil((length-usable-EPS)/(usable-allowance));
    const tail=length-joints*(usable-allowance);
    return {segments:[{length:usable,count:joints},{length:tail,count:1}],joints,extra:joints*allowance};
  }

  // Base pieces are packed first. Extension pieces fill their offcuts before
  // extension-only stock is opened, so additional stock is directly auditable.
  function planCuts(rows,stockLength,kerf,endTrim,unitWeight,allowance=0){
    const usable=stockLength-endTrim;
    if(usable<=0)return {status:'unavailable',message:'양끝 정리 여유가 원자재 길이보다 작아야 합니다.',patterns:[]};
    const remaining=[],extensions=[];
    let materialLength=0,overlapLength=0;
    for(const row of rows){
      const split=splitMember(row.length,usable,allowance);
      materialLength+=(row.length+split.extra)*row.count/1000;
      overlapLength+=split.extra*row.count/1000;
      remaining.push({...row,segmentId:row.code+'.base',length:split.joints?usable:row.length,left:row.count,extension:false});
      if(split.joints){
        if(split.joints>1)remaining.push({...row,segmentId:row.code+'.full',length:usable,left:(split.joints-1)*row.count,extension:true});
        remaining.push({...row,segmentId:row.code+'.tail',length:split.segments[1].length,left:row.count,extension:true});
        extensions.push({code:row.code,name:row.name,length:row.length,count:row.count,baseLength:usable,extensionLength:row.length-usable,extensionCutLength:row.length-usable+split.extra,totalExtensionLength:(row.length-usable+split.extra)*row.count/1000,jointsPerPiece:split.joints,totalJoints:split.joints*row.count,segments:split.segments});
      }
    }
    remaining.sort((a,b)=>Number(a.extension)-Number(b.extension)||b.length-a.length||a.segmentId.localeCompare(b.segmentId));
    const byId=new Map(remaining.map(r=>[r.segmentId,r])),patterns=[];
    while(remaining.some(r=>r.left>0)){
      let free=usable,loss=0;
      const cuts=[];
      for(const row of remaining){
        if(row.left===0||row.length>free+EPS)continue;
        let count=Math.min(row.left,Math.floor((free+EPS)/(row.length+kerf)));
        let usedLoss=count*kerf,after=free-count*(row.length+kerf);
        if(count<row.left&&after+EPS>=row.length){
          count++;
          const finalLoss=Math.min(kerf,Math.max(0,after-row.length));
          usedLoss+=finalLoss;after-=row.length+finalLoss;
        }
        if(count){cuts.push({code:row.code,segmentId:row.segmentId,name:row.name,length:row.length,count,extension:row.extension});free=Math.max(0,after);loss+=usedLoss;}
      }
      if(!cuts.length)throw new Error('절단 배치를 만들 수 없습니다. 원자재 길이를 확인하세요.');
      const repeat=Math.min(...cuts.map(c=>Math.floor(byId.get(c.segmentId).left/c.count)));
      for(const cut of cuts)byId.get(cut.segmentId).left-=cut.count*repeat;
      patterns.push({cuts,repeat,remainder:free,kerfLoss:loss,trimLoss:endTrim,stockLength,extensionOnly:cuts.every(c=>c.extension)});
    }
    const stockCount=patterns.reduce((n,p)=>n+p.repeat,0),grossLength=stockCount*stockLength/1000;
    const additionalStockCount=patterns.filter(p=>p.extensionOnly).reduce((n,p)=>n+p.repeat,0);
    const reusedExtensionLength=patterns.filter(p=>!p.extensionOnly).reduce((sum,p)=>sum+p.cuts.filter(c=>c.extension).reduce((n,c)=>n+c.length*c.count*p.repeat,0),0)/1000;
    return {status:'ready',patterns,extensions,stockLength,stockCount,baseStockCount:stockCount-additionalStockCount,additionalStockCount,grossLength,materialLength,overlapLength,reusedExtensionLength,extensionLength:extensions.reduce((n,e)=>n+e.totalExtensionLength,0),jointCount:extensions.reduce((n,e)=>n+e.totalJoints,0),purchaseWeight:grossLength*unitWeight,remainder:patterns.reduce((n,p)=>n+p.remainder*p.repeat,0)/1000,kerfLoss:patterns.reduce((n,p)=>n+p.kerfLoss*p.repeat,0)/1000,trimLoss:stockCount*endTrim/1000,utilization:materialLength/grossLength*100};
  }

  function calculate(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('입력 형식을 확인하세요.');
    const v=Object.fromEntries(Object.keys(defaults).map(key=>[key,key==='spliceAllowance'?(input[key]??0):input[key]]));
    for (const [key,[min,max,integer]] of Object.entries(limits)) {
      if(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max||(integer&&!Number.isInteger(v[key])))throw new Error(`${labels[key]}: ${min.toLocaleString('ko-KR')}~${max.toLocaleString('ko-KR')}${integer?' 사이의 정수':' 사이의 숫자'}를 입력하세요.`);
    }
    const base=profile({...input.baseProfile,...v},{family:'custom',section:'custom',rotation:0,materialName:''});
    const overrides=input.members??{};
    if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).some(k=>!Object.hasOwn(roles,k)))throw new Error('부위별 부재 설정을 확인하세요.');
    const members={};
    for(const role of Object.keys(roles)){
      try{members[role]=Object.hasOwn(overrides,role)?profile(overrides[role],base):{...base};}
      catch(e){throw new Error(`${roles[role]}: ${e.message}`);}
    }
    v.baseProfile=base;v.members=Object.fromEntries(Object.keys(overrides).map(k=>[k,members[k]]));
    const m=members,innerWidth=v.width-m.outerLeft.face-m.outerRight.face,innerHeight=v.height-m.outerTop.face-m.outerBottom.face;
    const clearWidth=(innerWidth-v.vertical*m.innerVertical.face)/(v.vertical+1);
    const clearHeight=(innerHeight-v.horizontal*m.innerHorizontal.face)/(v.horizontal+1);
    if(clearWidth<=0||clearHeight<=0)throw new Error('정면 부재가 겹칩니다. 가로·세로를 늘리거나 해당 부재 폭과 보강재 개수를 줄여주세요.');
    const geometry={innerWidth,innerHeight,clearWidth,clearHeight,sides:{}};
    const definitions=[['outerLeft',v.height,v.planes],['outerRight',v.height,v.planes],['outerTop',innerWidth,v.planes],['outerBottom',innerWidth,v.planes],['innerVertical',innerHeight,v.vertical*v.planes],['innerHorizontal',clearWidth,v.horizontal*(v.vertical+1)*v.planes]];
    if(v.planes===2){
      if(v.width<=m.depthTop.sectionDepth*2||v.width<=m.depthBottom.sectionDepth*2)throw new Error('좌우 연결재가 겹칩니다. 가로를 늘리거나 연결재 규격을 줄여주세요.');
      for(const side of ['Left','Right']){
        const edge=m['outer'+side],sv=m['side'+side+'Vertical'],sh=m['side'+side+'Horizontal'];
        const depth=v.depth-2*edge.sectionDepth,height=v.height-m.depthTop.face-m.depthBottom.face;
        const gapDepth=(depth-v.sideVertical*sv.sectionDepth)/(v.sideVertical+1),gapHeight=(height-v.sideHorizontal*sh.face)/(v.sideHorizontal+1);
        if(depth<=0||height<=0||gapDepth<=0||gapHeight<=0)throw new Error(`${side==='Left'?'좌':'우'}측면 부재가 겹칩니다. 깊이·높이를 늘리거나 해당 부재 규격과 개수를 줄여주세요.`);
        geometry.sides[side]={innerDepth:depth,innerHeight:height,clearDepth:gapDepth,clearHeight:gapHeight};
        // Different outer edge depths require different left and right connectors.
        definitions.push(['depthTop',depth,1,side],['depthBottom',depth,1,side],['side'+side+'Vertical',height,v.sideVertical],['side'+side+'Horizontal',gapDepth,v.sideHorizontal*(v.sideVertical+1)]);
      }
    }
    const rows=[];
    for(const[role,length,perFrame,side]of definitions){
      if(!perFrame)continue;
      const p=m[role],count=perFrame*v.frames,existing=rows.find(r=>r.role===role&&Math.abs(r.length-length)<EPS);
      if(existing){existing.count+=count;existing.totalLength+=length*count/1000;continue;}
      rows.push({role,code:roleCodes[role]+(side?'-'+side[0]:''),name:roles[role]+(side?` (${side==='Left'?'좌':'우'})`:''),length,count,totalLength:length*count/1000,profile:p,materialKey:materialKey(p),materialLabel:materialLabel(p)});
    }
    // Stable shared codes for equal-length left/right top or bottom connectors.
    for(const r of rows)if(r.role==='depthTop'||r.role==='depthBottom'){
      if(rows.filter(x=>x.role===r.role).length===1){r.code=roleCodes[r.role];r.name=roles[r.role]+' (좌우)';}
    }
    const groups=[];
    for(const r of rows){
      let g=groups.find(g=>g.key===r.materialKey);
      if(!g){g={key:r.materialKey,id:'M'+(groups.length+1),label:r.materialLabel,profile:r.profile,rows:[]};groups.push(g);}
      g.rows.push(r);r.groupId=g.id;
    }
    for(const g of groups){
      Object.assign(g,planCuts(g.rows,g.profile.stockLength,v.kerf,v.endTrim,g.profile.unitWeight,v.spliceAllowance));
      for(const r of g.rows){
        const e=g.extensions?.find(e=>e.code===r.code);
        r.jointCount=e?.totalJoints||0;r.overlapLength=r.jointCount*v.spliceAllowance/1000;
        r.materialLength=r.totalLength+r.overlapLength;r.weight=r.materialLength*r.profile.unitWeight;
      }
    }
    const unavailable=groups.find(g=>g.status!=='ready');
    const totalLength=rows.reduce((n,r)=>n+r.totalLength,0),totalPieces=rows.reduce((n,r)=>n+r.count,0),frameWeight=rows.reduce((n,r)=>n+r.weight,0);
    const purchase={status:unavailable?'unavailable':'ready',groups,patterns:groups.flatMap(g=>(g.patterns||[]).map(p=>({...p,groupId:g.id,materialLabel:g.label}))),extensions:groups.flatMap(g=>(g.extensions||[]).map(e=>({...e,groupId:g.id,materialLabel:g.label})))};
    if(unavailable)purchase.message=`${unavailable.label}: ${unavailable.message}`;
    else{
      for(const key of ['stockCount','baseStockCount','additionalStockCount','grossLength','materialLength','overlapLength','reusedExtensionLength','extensionLength','jointCount','purchaseWeight','remainder','kerfLoss','trimLoss'])purchase[key]=groups.reduce((n,g)=>n+g[key],0);
      purchase.utilization=purchase.materialLength/purchase.grossLength*100;
    }
    return {input:v,members,geometry,rows,innerWidth,innerHeight,clearWidth,clearHeight,innerDepth:geometry.sides.Left?.innerDepth??v.depth-2*base.sectionDepth,sideClearDepth:geometry.sides.Left?.clearDepth,sideClearHeight:geometry.sides.Left?.clearHeight,totalLength,totalPieces,frameWeight,equipmentWeight:v.equipment*v.frames,totalWeight:frameWeight+v.equipment*v.frames,area:v.width*v.height/1e6,purchase};
  }

  function parseProject(text){
    let p;try{p=JSON.parse(text);}catch{throw new Error('올바른 JSON 설정 파일이 아닙니다.');}
    if(p?.type!=='led-frame-project'||![2,3,4].includes(p.version))throw new Error('이 계산기에서 저장한 설정 파일을 선택하세요.');
    const rotation=p.version===2?0:p.rotation;
    if(![0,1].includes(rotation))throw new Error('저장한 부재 방향을 확인하세요.');
    const migrated=p.version===2?{...p.input,sectionDepth:p.input?.face,sideVertical:0,sideHorizontal:0}:p.input;
    const selected=presets[p.section],expected=selected?presetValues(p.section,rotation):null;
    const section=expected&&Object.keys(expected).every(k=>expected[k]===migrated?.[k])?p.section:'custom';
    const family=section==='custom'?(Object.hasOwn(families,p.family)?p.family:'custom'):selected.family;
    const result=calculate({...migrated,baseProfile:{family,section,rotation}});
    return {input:result.input,section,family,rotation};
  }

  function toCSV(result,sectionLabel){
    const v=result.input,p=result.purchase;
    const data=[['전광판 구조물 자재 산출표'],['가로(mm)',v.width,'세로(mm)',v.height,'제작 수량(대)',v.frames],['프레임 구성',v.planes===2?'앞·뒤 + 좌우 측면':'단면 1면','전체 깊이(mm)',v.planes===2?v.depth:'해당 없음'],['기본 부재 규격',sectionLabel,'정면 폭 b(mm)',v.face,'깊이 방향 폭 d(mm)',v.sectionDepth,'단위중량(kg/m)',v.unitWeight],['세로 보강재(개/면)',v.vertical,'가로 보강재(열/면)',v.horizontal],['측면 세로 보강재(개/측면)',v.sideVertical,'측면 가로 보강재(열/측면)',v.sideHorizontal],['원자재 길이(mm)',v.stockLength,'톱날 손실(mm/회)',v.kerf,'양끝 정리 여유(mm/본)',v.endTrim,'이음부당 겹침 여유(mm)',v.spliceAllowance],[],['코드','부재','규격 그룹','규격','정면 폭 b(mm)','깊이 방향 폭 d(mm)','단위중량(kg/m)','원자재(mm)','완성 길이(mm)','수량(개)','완성 총길이(m)','겹침 포함 재료 길이(m)','중량(kg)'],...result.rows.map(r=>[r.code,r.name,r.groupId,r.materialLabel,r.profile.face,r.profile.sectionDepth,r.profile.unitWeight,r.profile.stockLength,r.length.toFixed(6),r.count,r.totalLength.toFixed(6),r.materialLength.toFixed(6),r.weight.toFixed(6)]),['부재 합계',result.totalPieces,result.totalLength.toFixed(6),result.frameWeight.toFixed(6)],['전광판·기타 중량(kg)',result.equipmentWeight.toFixed(6)],['완성품 전체 예상 중량(kg)',result.totalWeight.toFixed(6)]];
    if(p.status==='ready'){
      data.push([],['예상 구매 본수',p.stockCount,'기본 본수',p.baseStockCount,'연장용 추가 본수',p.additionalStockCount,'구매 부재 중량(kg)',p.purchaseWeight.toFixed(6)],['연장 조각 총길이(m)',p.extensionLength.toFixed(6),'기본 본수 잔재 활용(m)',p.reusedExtensionLength.toFixed(6),'총 이음 개소',p.jointCount],[],['규격 그룹','규격','원자재(mm)','기본 본수','연장용 추가 본수','총 구매 본수','구매 중량(kg)','잔재(m)']);
      for(const g of p.groups)data.push([g.id,g.label,g.stockLength,g.baseStockCount,g.additionalStockCount,g.stockCount,g.purchaseWeight.toFixed(6),g.remainder.toFixed(6)]);
      data.push([],['연장 부재','규격 그룹','완성 길이(mm)','부재 수량','1개당 분할 길이(mm)','1개당 연장 조각 길이(mm)','전체 연장 조각(m)','이음 개소']);
      for(const e of p.extensions)data.push([e.name,e.groupId,e.length,e.count,e.segments.map(s=>`${s.length} × ${s.count}`).join(' + '),e.extensionCutLength,e.totalExtensionLength,e.totalJoints]);
      data.push([],['절단 패턴','규격 그룹','원자재(mm)','동일 배치 본수','분류','부재별 절단 배치','잔재(mm)','톱날 손실(mm)']);
      p.patterns.forEach((pattern,i)=>data.push([i+1,pattern.groupId,pattern.stockLength,pattern.repeat,pattern.extensionOnly?'연장용 추가':'기본 본수',pattern.cuts.map(c=>`${c.code} ${c.extension?'연장':'본체'} ${c.length.toFixed(3)}mm × ${c.count}개`).join(' / '),pattern.remainder.toFixed(3),pattern.kerfLoss.toFixed(3)]));
    }else data.push(['구매 본수 계산 불가',p.message]);
    data.push([],['계산 기준','부위별 규격의 폭을 반영한 맞댐 길이. 앞뒤 프레임 규격은 동일. 상단·하단 연결재와 외곽재는 측면에서 중복 산출하지 않음.'],['연장 기준','기본 본수=일반 부재와 긴 부재의 첫 조각 배치. 같은 규격 잔재에 연장 조각을 우선 배치하고 부족한 분량만 추가 구매. 전체 구매=기본+연장용 추가. 맞댐 0mm 또는 입력한 이음부별 겹침 길이 적용.'],['포함 범위','수량·중량 산출용. 이음 위치·방법·접합판·용접량·H형강 코핑/플랜지 간섭·구조 안전성은 별도 검토. 최소 구매 본수 보장하지 않음.']);
    return '\ufeff'+data.map(row=>row.map(cell=>{let s=String(cell);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
  }
  root.FrameCalculator={defaults,limits,labels,presets,families,sources,roles,roleCodes,presetValues,profile,materialLabel,materialKey,splitMember,calculate,planCuts,parseProject,toCSV};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.FrameCalculator;
})(typeof globalThis!=='undefined'?globalThis:this);
