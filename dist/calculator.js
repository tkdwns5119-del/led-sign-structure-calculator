(function (root) {
  'use strict';
  const defaults={width:4000,height:2000,frames:1,face:50,unitWeight:3.44,vertical:3,horizontal:1,equipment:0,planes:1,depth:600,stockLength:6000,kerf:3,endTrim:0};
  const limits={width:[100,100000,1],height:[100,100000,1],frames:[1,1000,1],face:[1,1000],unitWeight:[0.001,10000],vertical:[0,100,1],horizontal:[0,100,1],equipment:[0,1000000],planes:[1,2,1],depth:[1,100000],stockLength:[100,100000],kerf:[0,20],endTrim:[0,1000]};
  const labels={width:'가로',height:'세로',frames:'제작 수량',face:'각관 한 변',unitWeight:'단위중량',vertical:'세로 보강재',horizontal:'가로 보강재 열',equipment:'전광판·기타 중량',planes:'프레임 구성',depth:'전체 깊이',stockLength:'원자재 길이',kerf:'절단 톱날 손실',endTrim:'양끝 정리 여유'};
  const presets={'50':{face:50,unitWeight:3.44,label:'50 × 50 × 2.3t'},'75':{face:75,unitWeight:7.21,label:'75 × 75 × 3.2t'},'100':{face:100,unitWeight:9.73,label:'100 × 100 × 3.2t'}};
  const EPS=1e-7;

  // Count-based patterns avoid allocating one object per piece for large orders.
  function planCuts(rows,stockLength,kerf,endTrim,unitWeight){
    const usable=stockLength-endTrim;
    if(usable<=0)return {status:'unavailable',message:'양끝 정리 여유가 원자재 길이보다 작아야 합니다.',patterns:[]};
    const oversize=rows.filter(r=>r.length>usable+EPS);
    if(oversize.length)return {status:'oversize',message:`${oversize.map(r=>r.name).join(', ')}의 절단 길이가 사용 가능한 원자재 길이를 초과합니다. 더 긴 원자재를 입력하세요.`,patterns:[],oversize:oversize.map(r=>r.code)};
    const remaining=rows.map(r=>({...r,left:r.count})).sort((a,b)=>b.length-a.length||a.code.localeCompare(b.code));
    const patterns=[];
    while(remaining.some(r=>r.left>0)){
      let free=usable,loss=0;
      const cuts=[];
      for(const row of remaining){
        if(row.left===0||row.length>free+EPS)continue;
        let count=Math.min(row.left,Math.floor((free+EPS)/(row.length+kerf)));
        let usedLoss=count*kerf;
        let after=free-count*(row.length+kerf);
        // An exact end uses no saw loss; a short tail consumes only its length.
        if(count<row.left&&after+EPS>=row.length){
          count++;
          const finalLoss=Math.min(kerf,Math.max(0,after-row.length));
          usedLoss+=finalLoss;after-=row.length+finalLoss;
        }
        if(count){cuts.push({code:row.code,name:row.name,length:row.length,count});free=Math.max(0,after);loss+=usedLoss;}
      }
      if(!cuts.length)return {status:'unavailable',message:'절단 배치를 만들 수 없습니다. 원자재 길이와 손실 값을 확인하세요.',patterns:[]};
      const repeat=Math.min(...cuts.map(c=>Math.floor(remaining.find(r=>r.code===c.code).left/c.count)));
      for(const cut of cuts)remaining.find(r=>r.code===cut.code).left-=cut.count*repeat;
      patterns.push({cuts,repeat,remainder:free,kerfLoss:loss,trimLoss:endTrim});
    }
    const stockCount=patterns.reduce((n,p)=>n+p.repeat,0),grossLength=stockCount*stockLength/1000;
    const productLength=rows.reduce((n,r)=>n+r.totalLength,0);
    return {status:'ready',patterns,stockCount,grossLength,purchaseWeight:grossLength*unitWeight,remainder:patterns.reduce((n,p)=>n+p.remainder*p.repeat,0)/1000,kerfLoss:patterns.reduce((n,p)=>n+p.kerfLoss*p.repeat,0)/1000,trimLoss:stockCount*endTrim/1000,utilization:productLength/grossLength*100};
  }
  function calculate(input) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('입력 형식을 확인하세요.');
    const v=Object.fromEntries(Object.keys(defaults).map(key=>[key,input[key]]));
    for (const [key,[min,max,integer]] of Object.entries(limits)) {
      if(typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key]<min || v[key]>max || (integer && !Number.isInteger(v[key]))) throw new Error(`${labels[key]}: ${min.toLocaleString('ko-KR')}~${max.toLocaleString('ko-KR')}${integer?' 사이의 정수':' 사이의 숫자'}를 입력하세요.`);
    }
    const innerWidth=v.width-2*v.face, innerHeight=v.height-2*v.face;
    const clearWidth=(innerWidth-v.vertical*v.face)/(v.vertical+1);
    const clearHeight=(innerHeight-v.horizontal*v.face)/(v.horizontal+1);
    if(clearWidth<=0 || clearHeight<=0) throw new Error('부재가 겹칩니다. 가로·세로를 늘리거나 부재 폭 또는 보강재 개수를 줄여주세요.');
    if(v.planes===2&&v.depth<=2*v.face)throw new Error('전체 깊이는 앞·뒤 각관 한 변의 합보다 커야 합니다.');
    const definitions=[['A','외곽 세로재',v.height,2*v.planes],['B','외곽 가로재',innerWidth,2*v.planes],['C','세로 보강재',innerHeight,v.vertical*v.planes],['D','가로 보강재',clearWidth,v.horizontal*(v.vertical+1)*v.planes]];
    if(v.planes===2)definitions.push(['E','깊이 연결재',v.depth-2*v.face,4]);
    const rows=definitions.filter(r=>r[3]>0).map(([code,name,length,count])=>({code,name,length,count:count*v.frames,totalLength:length*count*v.frames/1000,weight:length*count*v.frames/1000*v.unitWeight}));
    const totalLength=rows.reduce((n,r)=>n+r.totalLength,0), totalPieces=rows.reduce((n,r)=>n+r.count,0), frameWeight=totalLength*v.unitWeight;
    return {input:v,rows,innerWidth,innerHeight,clearWidth,clearHeight,totalLength,totalPieces,frameWeight,equipmentWeight:v.equipment*v.frames,totalWeight:frameWeight+v.equipment*v.frames,area:v.width*v.height/1e6,purchase:planCuts(rows,v.stockLength,v.kerf,v.endTrim,v.unitWeight)};
  }

  function parseProject(text){
    let p;try{p=JSON.parse(text);}catch{throw new Error('올바른 JSON 설정 파일이 아닙니다.');}
    if(p?.type!=='led-frame-project'||p.version!==2)throw new Error('이 계산기에서 저장한 설정 파일을 선택하세요.');
    const result=calculate(p.input),preset=presets[p.section];
    const section=preset&&preset.face===result.input.face&&preset.unitWeight===result.input.unitWeight?p.section:'custom';
    return {input:result.input,section};
  }

  function toCSV(result,sectionLabel){
    const v=result.input,p=result.purchase;
    const data=[['전광판 구조물 자재 산출표'],['가로(mm)',v.width,'세로(mm)',v.height,'제작 수량(대)',v.frames],['프레임 구성',v.planes===2?'앞·뒤 2면 + 모서리 연결재 4개':'단면 1면','전체 깊이(mm)',v.planes===2?v.depth:'해당 없음'],['각관 규격',sectionLabel,'각관 한 변(mm)',v.face,'단위중량(kg/m)',v.unitWeight],['세로 보강재(개/면)',v.vertical,'가로 보강재(열/면)',v.horizontal],[],['코드','부재','절단 길이(mm)','수량(개)','총길이(m)','중량(kg)'],...result.rows.map(r=>[r.code,r.name,r.length.toFixed(6),r.count,r.totalLength.toFixed(6),r.weight.toFixed(6)]),['','각관 합계','',result.totalPieces,result.totalLength.toFixed(6),result.frameWeight.toFixed(6)],['전광판·기타 중량(kg)',result.equipmentWeight.toFixed(6)],['완성품 전체 예상 중량(kg)',result.totalWeight.toFixed(6)],[],['원자재 길이(mm)',v.stockLength,'톱날 손실(mm/회)',v.kerf,'양끝 정리 여유(mm/본)',v.endTrim]];
    if(p.status==='ready')data.push(['예상 구매 본수',p.stockCount,'구매 총길이(m)',p.grossLength.toFixed(6),'구매 각관 중량(kg)',p.purchaseWeight.toFixed(6)],['잔재(m)',p.remainder.toFixed(6),'톱날 손실(m)',p.kerfLoss.toFixed(6),'양끝 정리 손실(m)',p.trimLoss.toFixed(6)],[],['절단 패턴','동일 배치 본수','부재별 절단 배치','1본당 잔재(mm)','1본당 톱날 손실(mm)'],...p.patterns.map((pattern,i)=>[i+1,pattern.repeat,pattern.cuts.map(c=>`${c.code} ${c.name} ${c.length.toFixed(3)}mm × ${c.count}개`).join(' / '),pattern.remainder.toFixed(3),pattern.kerfLoss.toFixed(3)]));
    else data.push(['구매 본수 계산 불가',p.message]);
    data.push([],['계산 기준','외곽 세로재 전체 높이. 가로 보강재는 세로재 사이 분할 연결. 앞뒤형은 동일 프레임 2면과 모서리 연결재 4개를 산출.'],['절단 배치 기준','긴 부재부터 채우는 참고 배치이며 최소 구매 본수를 보장하지 않음. 끝단 잔재가 톱날 폭보다 짧으면 실제 잔재 길이만 손실 처리. 합계는 반올림 전 값으로 계산.'],['포함 범위','지주·판재·볼트·용접량 및 추가 깊이 보강재 자동 산출 제외. 구조 안전성 별도 검토.'],['단위중량','규격 선택 시 예시값. 실제 공급업체 단위중량으로 수정 필요.']);
    return '\ufeff'+data.map(row=>row.map(cell=>{let s=String(cell);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');
  }
  root.FrameCalculator={defaults,limits,labels,presets,calculate,planCuts,parseProject,toCSV};
  if(typeof module !== 'undefined' && module.exports) module.exports=root.FrameCalculator;
})(typeof globalThis !== 'undefined' ? globalThis : this);
