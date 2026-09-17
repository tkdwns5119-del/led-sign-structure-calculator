(function (root) {
  'use strict';
  const defaults = { width:4000, height:2000, frames:1, face:50, unitWeight:3.44, vertical:3, horizontal:1, equipment:0 };
  const limits = { width:[100,100000,1], height:[100,100000,1], frames:[1,1000,1], face:[1,1000], unitWeight:[0.001,10000], vertical:[0,100,1], horizontal:[0,100,1], equipment:[0,1000000] };
  const labels = { width:'가로',height:'세로',frames:'제작 수량',face:'부재 폭',unitWeight:'단위중량',vertical:'세로 보강재',horizontal:'가로 보강재 열',equipment:'전광판·기타 중량' };
  function calculate(input) {
    const v={...input};
    for (const [key,[min,max,integer]] of Object.entries(limits)) {
      if(typeof v[key] !== 'number' || !Number.isFinite(v[key]) || v[key]<min || v[key]>max || (integer && !Number.isInteger(v[key]))) throw new Error(`${labels[key]}: ${min.toLocaleString('ko-KR')}~${max.toLocaleString('ko-KR')}${integer?' 사이의 정수':' 사이의 숫자'}를 입력하세요.`);
    }
    const innerWidth=v.width-2*v.face, innerHeight=v.height-2*v.face;
    const clearWidth=(innerWidth-v.vertical*v.face)/(v.vertical+1);
    const clearHeight=(innerHeight-v.horizontal*v.face)/(v.horizontal+1);
    if(clearWidth<=0 || clearHeight<=0) throw new Error('부재가 겹칩니다. 가로·세로를 늘리거나 부재 폭 또는 보강재 개수를 줄여주세요.');
    const definitions=[['외곽 세로재',v.height,2],['외곽 가로재',innerWidth,2],['세로 보강재',innerHeight,v.vertical],['가로 보강재',clearWidth,v.horizontal*(v.vertical+1)]];
    const rows=definitions.filter(r=>r[2]>0).map(([name,length,count])=>({name,length,count:count*v.frames,totalLength:length*count*v.frames/1000,weight:length*count*v.frames/1000*v.unitWeight}));
    const totalLength=rows.reduce((n,r)=>n+r.totalLength,0), totalPieces=rows.reduce((n,r)=>n+r.count,0), frameWeight=totalLength*v.unitWeight;
    return {input:v,rows,innerWidth,innerHeight,clearWidth,clearHeight,totalLength,totalPieces,frameWeight,equipmentWeight:v.equipment*v.frames,totalWeight:frameWeight+v.equipment*v.frames,area:v.width*v.height/1e6};
  }
  root.FrameCalculator={defaults,limits,calculate};
  if(typeof module !== 'undefined' && module.exports) module.exports=root.FrameCalculator;
})(typeof globalThis !== 'undefined' ? globalThis : this);
