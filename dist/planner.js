(function(root){
'use strict';
const legacy=typeof module==='object'?require('./calculator.js'):root.FrameCalculator;
const EPS=1e-6,clone=x=>JSON.parse(JSON.stringify(x));
const ref=(materialId='m1',rotation=0)=>({materialId,rotation});
const reinforcement=(id,materialId='m1',position=null)=>({id,...ref(materialId),position});
function material(section='50',id='m1'){
 const p=legacy.presets[section];
 return {id,name:p.label,family:p.family,section,face:p.face,depth:p.sectionDepth,t1:p.thickness||p.web,t2:p.flange||0,kgm:p.unitWeight,grade:'미지정',finish:'미지정',stockMode:'selected',selectedLength:6000,priceMode:'kg',pricePerKg:null,stocks:[{length:6000,price:null}]};
}
function face(){return {edges:{left:ref(),right:ref(),top:ref(),bottom:ref()},vertical:[1,2,3].map(i=>reinforcement('v'+i)),horizontal:[reinforcement('h1')]};}
function side(){return {top:ref(),bottom:ref(),vertical:[],horizontal:[reinforcement('h1')]};}
function createProject(){return {type:'led-frame-project',version:5,id:'project-'+Date.now(),name:'새 전광판 프로젝트',ui:{inputMode:'simple'},general:{width:4000,height:2000,depth:600,planes:1,quantity:1,extraEquipment:0,verticalDepthTies:true},materials:[material()],front:face(),back:face(),backLinked:true,left:side(),right:side(),rightLinked:true,extras:[],accessories:[],inventory:[],splices:{},cut:{kerf:3,endTrim:0,overlap:0,precision:0,objective:'bars'},cabinet:{enabled:false,width:500,height:500,columns:8,rows:4,weightEach:0},cost:{cutFee:0,spliceFee:0,fabrication:0,painting:0,transport:0,other:0,taxRate:0}};}
function number(value,label,min=0,max=1e9,integer=false){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))throw Error(`${label}: ${min}~${max}${integer?' 정수':''}를 입력하세요.`);return value;}
function list(value,label,max=200){if(!Array.isArray(value)||value.length>max)throw Error(`${label}: 최대 ${max}개까지 등록할 수 있습니다.`);return value;}
function identity(value,label){if(typeof value!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value))throw Error(`${label} 식별값이 올바르지 않습니다.`);return value;}
function text(value,label,max=100){if(typeof value!=='string'||value.length>max)throw Error(`${label}: ${max}자 이내로 입력하세요.`);return value;}
function unique(items,label){const ids=items.map(x=>identity(x.id,label));if(new Set(ids).size!==ids.length)throw Error(`${label} 식별값이 중복됩니다.`);}
function checkedMaterial(m){
 identity(m.id,'자재');text(m.name,'자재명');text(m.grade,'재질',60);text(m.finish,'표면처리',60);
 if(!Object.hasOwn(legacy.families,m.family))throw Error('자재 종류를 확인하세요.');
 for(const k of ['face','depth'])number(m[k],m.name+' 단면 폭',1,1000);
 if(m.t1!==null)number(m.t1,m.name+' 두께',0.01,1000);number(m.t2,m.name+' 플랜지 두께',0,1000);number(m.kgm,m.name+' 단위중량',0.001,10000);
 if(!['selected','mixed'].includes(m.stockMode)||!['kg','bar'].includes(m.priceMode))throw Error('원자재 공급 방식 또는 단가 기준을 확인하세요.');
 if(m.pricePerKg!==null)number(m.pricePerKg,m.name+' kg 단가');
 list(m.stocks,m.name+' 공급 길이',10);if(!m.stocks.length)throw Error(m.name+'의 공급 길이를 등록하세요.');
 const lengths=new Set();for(const s of m.stocks){number(s.length,m.name+' 원자재 길이',100,100000);if(lengths.has(s.length))throw Error(m.name+' 공급 길이가 중복됩니다.');lengths.add(s.length);if(s.price!==null)number(s.price,m.name+' 본당 단가');}
 if(!lengths.has(m.selectedLength))throw Error(m.name+'의 선택 원자재 길이를 확인하세요.');
 return m;
}
function profileOf(r,materials,label='부재'){
 const m=materials.get(r?.materialId);if(!m)throw Error(`${label}: 사용할 자재를 선택하세요.`);
 if(![0,1].includes(r.rotation))throw Error(`${label}: 방향을 확인하세요.`);
 return {...m,face:r.rotation?m.depth:m.face,depth:r.rotation?m.face:m.depth,rotation:r.rotation};
}
function roundLength(n,step){return step?Math.round((n+1e-9)/step)*step:n;}
function usableLength(n,step){return step?Math.floor((n+EPS)/step)*step:n;}
function arrange(items,start,end,axis,materials,label){
 list(items,label,100);unique(items,label);
 const parts=items.map(r=>({...r,profile:profileOf(r,materials,label)}));
 const gap=(end-start-parts.reduce((n,p)=>n+p.profile[axis],0))/(parts.length+1);
 if(gap<=0)throw Error(`${label}: 부재가 겹칩니다. 폭이나 개수를 줄이세요.`);
 let cursor=start;
 for(const p of parts){const thickness=p.profile[axis];cursor+=gap;const auto=cursor+thickness/2;cursor+=thickness;if(p.position!==null)number(p.position,label+' 중심선',0,100000);p.center=p.position===null?auto:p.position;p.start=p.center-thickness/2;p.end=p.center+thickness/2;}
 parts.sort((a,b)=>a.start-b.start);
 let previous=start;
 for(const p of parts){if(p.start<previous-EPS||p.start<=start+EPS||p.end>=end-EPS)throw Error(`${label}: 중심선 위치가 겹치거나 외곽을 침범합니다.`);previous=p.end;}
 const gaps=[];let from=start,anchor='start';for(const p of parts){gaps.push({start:from,end:p.start,id:anchor+'_'+p.id});from=p.end;anchor=p.id;}gaps.push({start:from,end,id:anchor+'_end'});
 return {parts,gaps,gap};
}
function geometry(project,materials){
 const g={...project.general},c=project.cabinet;
 for(const key of ['width','height','depth'])number(g[key],key==='width'?'가로':key==='height'?'세로':'깊이',100,100000);
 number(g.quantity,'제작 수량',1,1000,true);number(g.extraEquipment,'기타 장비 중량',0,1e6);if(![1,2].includes(g.planes))throw Error('프레임 구성을 확인하세요.');
 for(const key of ['width','height'])number(c[key],'캐비닛 '+key,1,10000);
 for(const key of ['columns','rows'])number(c[key],'캐비닛 배열',1,101,true);number(c.weightEach,'캐비닛 개당 중량',0,100000);
 if(c.enabled){g.width=c.width*c.columns;g.height=c.height*c.rows;if(g.width>100000||g.height>100000)throw Error('캐비닛 전체 치수는 100,000mm 이하여야 합니다.');}
 if(g.verticalDepthTies!==undefined&&typeof g.verticalDepthTies!=='boolean')throw Error('세로 보강 연결재 자동 추가 설정을 확인하세요.');
 g.verticalDepthTies=g.verticalDepthTies!==false;
 const rows=[],panels={},depthConnectors=[],connectorWarnings=[];
 const add=(id,name,length,count,r,location)=>{if(length<=EPS)throw Error(name+'의 길이가 0 이하입니다.');const m=profileOf(r,materials,name),actual=roundLength(length,project.cut.precision);if(actual<=EPS)throw Error(name+'의 반올림 후 길이가 0입니다.');rows.push({id,code:id,name,location,designLength:length,length:actual,delta:actual-length,count:count*g.quantity,materialId:m.id,rotation:r.rotation,kgm:m.kgm,materialLabel:m.name,splice:project.splices[id]||{mode:'auto',segments:[]}});};
 const facePanel=(key,data)=>{
   const title=key==='front'?'앞면':'뒷면',e=Object.fromEntries(Object.entries(data.edges).map(([k,r])=>[k,profileOf(r,materials,title)]));
   const x1=e.left.face,x2=g.width-e.right.face,y1=e.top.face,y2=g.height-e.bottom.face;
   const v=arrange(data.vertical,x1,x2,'face',materials,title+' 세로 보강재'),h=arrange(data.horizontal,y1,y2,'face',materials,title+' 가로 보강재');
   add(key+'-L',title+' 좌측 외곽재',g.height,1,data.edges.left,key);add(key+'-R',title+' 우측 외곽재',g.height,1,data.edges.right,key);add(key+'-T',title+' 상단 외곽재',x2-x1,1,data.edges.top,key);add(key+'-B',title+' 하단 외곽재',x2-x1,1,data.edges.bottom,key);
   for(const p of v.parts)add(key+'-V-'+p.id,title+' 세로 '+p.id,y2-y1,1,p,key);
   for(const p of h.parts){
     const grouped=new Map();for(const gap of v.gaps){const length=gap.end-gap.start,keyLength=String(length);if(grouped.has(keyLength))grouped.get(keyLength).count++;else grouped.set(keyLength,{gap,length,count:1});}
     for(const {gap,length,count}of grouped.values())add(key+'-H-'+p.id+'-'+gap.id,title+' 가로 '+p.id+' / 구간 '+gap.id,length,count,p,key);
   }
   panels[key]={title,width:g.width,height:g.height,edges:e,x1,x2,y1,y2,vertical:v.parts,horizontal:h.parts,gaps:v.gaps};
 };
 facePanel('front',project.front);if(g.planes===2)facePanel('back',project.backLinked?project.front:project.back);
 if(g.planes===2){for(const side of ['left','right']){
   const data=side==='right'&&project.rightLinked?project.left:project[side],title=side==='left'?'좌측면':'우측면';
   const front=panels.front.edges[side],back=panels.back.edges[side],top=profileOf(data.top,materials,title),bottom=profileOf(data.bottom,materials,title);
   const x1=front.depth,x2=g.depth-back.depth,y1=top.face,y2=g.height-bottom.face;
   const v=arrange(data.vertical,x1,x2,'depth',materials,title+' 세로'),h=arrange(data.horizontal,y1,y2,'face',materials,title+' 가로');
   add(side+'-T',title+' 상단 연결재',x2-x1,1,data.top,side);add(side+'-B',title+' 하단 연결재',x2-x1,1,data.bottom,side);
   for(const p of v.parts)add(side+'-V-'+p.id,title+' 세로 '+p.id,y2-y1,1,p,side);
   for(const p of h.parts){const grouped=new Map();for(const gap of v.gaps){const n=gap.end-gap.start;if(grouped.has(n))grouped.get(n).count++;else grouped.set(n,{gap,count:1});}for(const[length,{gap,count}]of grouped)add(side+'-H-'+p.id+'-'+gap.id,title+' 가로 '+p.id+' / '+gap.id,length,count,p,side);}
   panels[side]={title,width:g.depth,height:g.height,edges:{left:{...front,face:front.depth},right:{...back,face:back.depth},top,bottom},x1,x2,y1,y2,vertical:v.parts.map(p=>({...p,profile:{...p.profile,face:p.profile.depth}})),horizontal:h.parts,gaps:v.gaps};
 }}
 if(g.planes===2){for(const edge of ['top','bottom'])if(panels.left.edges[edge].depth+panels.right.edges[edge].depth>g.width+EPS)throw Error('좌우 '+(edge==='top'?'상단':'하단')+' 연결재가 폭 방향으로 겹칩니다.');}
 if(g.planes===2&&g.verticalDepthTies){
   const front=panels.front,back=panels.back,matched=new Set();
   for(const v of front.vertical){
     const rear=back.vertical.find(b=>Math.abs(b.center-v.center)<=EPS);
     if(!rear){connectorWarnings.push(`앞면 ${v.id}: 뒷면의 같은 중심선에 세로 보강재가 없어 연결재 자동 산출 제외`);continue;}
     matched.add(rear.id);
     // Turn the front vertical's section onto the depth axis: its front-face
     // width becomes the tie's transverse width, preserving the bearing line.
     const tie=ref(v.materialId,v.rotation?0:1),q=profileOf(tie,materials,'앞뒤 세로 보강 연결재');
     const start=v.profile.depth,end=g.depth-rear.profile.depth,length=end-start;
     const top=Math.max(front.y1,back.y1),bottom=Math.min(front.y2,back.y2);
     if(length<=EPS)throw Error('앞뒤 세로 보강 연결재: 부재 깊이를 제외한 연결 길이가 0 이하입니다. 전체 깊이를 늘리세요.');
     if(bottom-top<2*q.face-EPS)throw Error('앞뒤 세로 보강 연결재: 상·하단 연결재를 배치할 높이 공간이 부족합니다.');
     for(const [endName,y,label] of [['T',top,'상단'],['B',bottom-q.face,'하단']]){
       const id='depth-'+v.id+'-'+endName,name='세로 보강 '+v.id+' 앞뒤 '+label+' 연결재';
       add(id,name,length,1,tie,'depth');
       depthConnectors.push({id,name,frontId:v.id,backId:rear.id,materialId:tie.materialId,rotation:tie.rotation,x:v.center-q.depth/2,y,z:start,width:q.depth,height:q.face,depth:length});
     }
   }
   for(const rear of back.vertical)if(!matched.has(rear.id))connectorWarnings.push(`뒷면 ${rear.id}: 앞면의 같은 중심선에 세로 보강재가 없어 연결재 자동 산출 제외`);
 }
 list(project.extras,'추가 부재');unique(project.extras,'추가 부재');
 for(const x of project.extras){text(x.name,'추가 부재 이름');number(x.quantity,'추가 부재 대당 수량',1,100000,true);number(x.length,'추가 부재 길이',1,100000);if(x.post!==undefined&&typeof x.post!=='boolean')throw Error('기초 지주 표시를 확인하세요.');add('extra-'+x.id,x.name,x.length,x.quantity,x,'extra');}
 // Extra members marked as posts describe the steel column the foundation checks.
 const postRows=project.extras.filter(x=>x.post===true);let posts=null;
 if(postRows.length){
  const first=postRows[0];if(postRows.some(x=>x.materialId!==first.materialId||x.rotation!==first.rotation))throw Error('기초 지주로 표시한 추가 부재는 같은 자재·방향이어야 합니다.');
  const m=materials.get(first.materialId);
  posts={count:postRows.reduce((n,x)=>n+x.quantity,0),length:Math.max(...postRows.map(x=>x.length)),rotation:first.rotation,names:postRows.map(x=>x.name),material:{id:m.id,name:m.name,family:m.family,face:m.face,depth:m.depth,t1:m.t1,t2:m.t2}};
 }
 return {general:g,rows,panels,depthConnectors,connectorWarnings,posts};
}
function segmentPlan(row,maxLength,cut){
 const s=row.splice,step=cut.precision;
 if(!['auto','manual','none'].includes(s.mode))throw Error(row.name+': 연장 방식을 확인하세요.');
 let segments;
 if(s.mode==='manual'){
   list(s.segments,row.name+' 분할 조각',100);if(!s.segments.length)throw Error(row.name+': 분할 길이를 입력하세요.');
   segments=s.segments.map(n=>roundLength(number(n,row.name+' 분할 길이',0.01,100000),step));
   if(segments.length>1&&segments.some(n=>n<=cut.overlap+EPS))throw Error(row.name+': 각 조각은 겹침 여유보다 길어야 합니다.');
   if(segments.some(n=>n<=0))throw Error(row.name+': 반올림 후 조각이 0mm입니다.');
   const complete=segments.reduce((n,x)=>n+x,0)-(segments.length-1)*cut.overlap;
   if(Math.abs(complete-row.length)>EPS)throw Error(`${row.name}: 분할 합계 − 겹침은 ${row.length}mm여야 합니다. 현재 ${complete}mm입니다.`);
 }else if(s.mode==='none'||row.length<=maxLength+EPS)segments=[row.length];
 else{
   if(maxLength<=cut.overlap+EPS)throw Error('원자재 유효 길이는 이음부 겹침보다 커야 합니다.');
   const joints=Math.ceil((row.length-maxLength-EPS)/(maxLength-cut.overlap));
   // Compact repeated full-length segments preserve large-order performance.
   return {parts:[{length:maxLength,count:1,extension:false},{length:maxLength,count:joints-1,extension:true},{length:row.length-joints*(maxLength-cut.overlap),count:1,extension:true}].filter(x=>x.count),joints,extra:joints*cut.overlap,display:[{length:maxLength,count:joints},{length:row.length-joints*(maxLength-cut.overlap),count:1}]};
 }
 return {parts:segments.map((length,i)=>({length,count:1,extension:i>0})),joints:segments.length-1,extra:(segments.length-1)*cut.overlap,display:segments.map(length=>({length,count:1}))};
}
function packPattern(demand,length,trim,kerf){
 let free=length-trim,loss=0,cutsCount=trim>0?2:0;const cuts=[];
 for(const d of demand){
   if(d.left<=0||d.length>free+EPS)continue;
   let n=Math.min(d.left,Math.floor((free+EPS)/(d.length+kerf))),usedLoss=n*kerf,after=free-n*(d.length+kerf),operations=n;
   if(n&&kerf===0&&Math.abs(after)<EPS)operations--;
   if(n<d.left&&after+EPS>=d.length){const tail=Math.max(0,after-d.length);n++;usedLoss+=Math.min(kerf,tail);after-=d.length+Math.min(kerf,tail);if(tail>EPS)operations++;}
   if(n){cuts.push({id:d.id,rowId:d.rowId,name:d.name,length:d.length,count:n,extension:d.extension});free=Math.max(0,after);loss+=usedLoss;cutsCount+=operations;}
 }
 return {cuts,remainder:Math.max(0,free),kerfLoss:loss,trimLoss:trim,cutCount:cutsCount,length,extensionOnly:cuts.length>0&&cuts.every(c=>c.extension)};
}
function stockPrice(m,s){return m.priceMode==='kg'?(m.pricePerKg===null?null:s.length/1000*m.kgm*m.pricePerKg):s.price;}
function planMaterial(rows,m,inventory,cut,stocks){
 const maximum=usableLength(Math.max(...stocks.map(s=>s.length-cut.endTrim)),cut.precision);
 if(maximum<=0)throw Error(m.name+': 양끝 정리 여유가 원자재보다 큽니다.');
 const preDemand=rows.filter(r=>r.splice.mode!=='manual'&&r.length>maximum+EPS).map(r=>({id:r.id+':whole',rowId:r.id,name:r.name,length:r.length,left:r.count,extension:false})).sort((a,b)=>b.length-a.length),prePatterns=[],preUsed=new Map();
 for(const item of [...inventory].sort((a,b)=>a.length-b.length)){
   let remaining=item.quantity;
   while(remaining>0){const p=packPattern(preDemand,item.length,item.trim,cut.kerf);if(!p.cuts.length)break;const repeat=Math.min(remaining,...p.cuts.map(c=>Math.floor(preDemand.find(d=>d.id===c.id).left/c.count)));for(const c of p.cuts)preDemand.find(d=>d.id===c.id).left-=repeat*c.count;prePatterns.push({...p,repeat,source:'inventory',sourceId:item.id,price:0,materialId:m.id});remaining-=repeat;}
   preUsed.set(item.id,item.quantity-remaining);
 }
 const demand=[],extensions=[];let materialLength=prePatterns.reduce((n,p)=>n+p.repeat*p.cuts.reduce((a,c)=>a+c.length*c.count,0),0)/1000,overlapLength=0,jointCount=0;
 const remainingRows=rows.map(r=>({...r,count:preDemand.find(d=>d.rowId===r.id)?.left??r.count})).filter(r=>r.count);
 for(const row of remainingRows){const p=segmentPlan(row,maximum,cut);materialLength+=(row.length+p.extra)*row.count/1000;overlapLength+=p.extra*row.count/1000;jointCount+=p.joints*row.count;
   p.parts.forEach((s,i)=>demand.push({id:row.id+':'+i,rowId:row.id,name:row.name,length:s.length,left:s.count*row.count,extension:s.extension}));
   if(p.joints)extensions.push({rowId:row.id,name:row.name,count:row.count,joints:p.joints,totalJoints:p.joints*row.count,length:row.length,segments:p.display,extensionLength:p.parts.filter(p=>p.extension).reduce((n,p)=>n+p.length*p.count,0)*row.count/1000,overlap:p.extra*row.count/1000});
 }
 demand.sort((a,b)=>Number(a.extension)-Number(b.extension)||b.length-a.length||a.id.localeCompare(b.id));
 const map=new Map(demand.map(d=>[d.id,d])),patterns=[],inventoryStatus=[];
 const consume=(pattern,limit,source,sourceId,price)=>{
   if(!pattern.cuts.length)return 0;
   const repeat=Math.min(limit,...pattern.cuts.map(c=>Math.floor(map.get(c.id).left/c.count)));
   for(const c of pattern.cuts)map.get(c.id).left-=repeat*c.count;
   patterns.push({...pattern,repeat,source,sourceId,price,materialId:m.id});return repeat;
 };
 // Fill the remainder of reserved long stock before opening another bar.
 for(const pre of prePatterns){let left=pre.repeat;while(left>0){const tail=packPattern(demand,pre.remainder,0,cut.kerf);if(!tail.cuts.length){patterns.push({...pre,repeat:left});break;}const repeat=Math.min(left,...tail.cuts.map(c=>Math.floor(map.get(c.id).left/c.count)));for(const c of tail.cuts)map.get(c.id).left-=repeat*c.count;patterns.push({...pre,repeat,cuts:[...pre.cuts,...tail.cuts],remainder:tail.remainder,kerfLoss:pre.kerfLoss+tail.kerfLoss,cutCount:pre.cutCount+tail.cutCount});left-=repeat;}}
 for(const item of [...inventory].sort((a,b)=>a.length-b.length)){
   let used=preUsed.get(item.id)||0,remaining=item.quantity-used;
   while(remaining>0){const pattern=packPattern(demand,item.length,item.trim,cut.kerf);const count=consume(pattern,remaining,'inventory',item.id,0);if(!count)break;remaining-=count;used+=count;}
   inventoryStatus.push({...item,used,remaining});
 }
 const blocked=[];
 while(demand.some(d=>d.left>0)){
   const candidate=stocks.map(s=>({...packPattern(demand,s.length,cut.endTrim,cut.kerf),price:stockPrice(m,s)})).filter(p=>p.cuts.length);
   if(!candidate.length){for(const d of demand.filter(d=>d.left>0))blocked.push({rowId:d.rowId,name:d.name,length:d.length,count:d.left});break;}
   // Always place the highest-priority remaining piece; compare feasible bars.
   const first=demand.find(d=>d.left>0),eligible=candidate.filter(p=>p.cuts.some(c=>c.id===first.id));
   if(!eligible.length){blocked.push({rowId:first.rowId,name:first.name,length:first.length,count:first.left});first.left=0;continue;}
   const used=p=>p.cuts.reduce((n,c)=>n+c.length*c.count,0);
   eligible.sort((a,b)=>cut.objective==='cost'&&a.price!==null&&b.price!==null?(a.price/used(a)-b.price/used(b))||(a.remainder-b.remainder):cut.objective==='waste'?(a.remainder/a.length-b.remainder/b.length)||(b.length-a.length):(used(b)-used(a))||(a.remainder-b.remainder));
   consume(eligible[0],Infinity,'purchase','new',eligible[0].price);
 }
 const purchased=patterns.filter(p=>p.source==='purchase'),held=patterns.filter(p=>p.source==='inventory');
 const sum=(items,fn)=>items.reduce((n,p)=>n+fn(p)*p.repeat,0),purchaseCount=sum(purchased,()=>1),inventoryUsed=sum(held,()=>1),grossLength=sum(patterns,p=>p.length)/1000,newLength=sum(purchased,p=>p.length)/1000;
 const additionalStockCount=sum(purchased.filter(p=>p.extensionOnly),()=>1),unknownPrices=sum(purchased.filter(p=>p.price===null),()=>1);
 const knownCost=sum(purchased,p=>p.price||0),purchaseCost=unknownPrices?null:knownCost;
 const allocatedLength=sum(patterns,p=>p.cuts.reduce((n,c)=>n+c.length*c.count,0))/1000;
 return {allocatedLength,materialId:m.id,label:m.name,status:blocked.length?'blocked':'ready',blocked,patterns,extensions,inventoryStatus,purchaseCount,inventoryUsed,baseStockCount:purchaseCount-additionalStockCount,additionalStockCount,grossLength,newLength,inventoryLength:sum(held,p=>p.length)/1000,purchaseWeight:newLength*m.kgm,inventoryWeight:sum(held,p=>p.length)*m.kgm/1000,materialLength,overlapLength,jointCount,extensionLength:extensions.reduce((n,e)=>n+e.extensionLength,0),remainder:sum(patterns,p=>p.remainder)/1000,kerfLoss:sum(patterns,p=>p.kerfLoss)/1000,trimLoss:sum(patterns,p=>p.trimLoss)/1000,cutCount:sum(patterns,p=>p.cutCount),purchaseCost,knownCost,unknownPrices,utilization:grossLength?100*allocatedLength/grossLength:0};
}
function calculate(project,{compare=false}={}){
 if(!project||project.type!=='led-frame-project'||project.version!==5)throw Error('프로젝트 형식을 확인하세요.');
 identity(project.id,'프로젝트');text(project.name,'프로젝트명');
 list(project.materials,'자재',100);if(!project.materials.length)throw Error('자재를 한 개 이상 등록하세요.');unique(project.materials,'자재');
 const materials=new Map(project.materials.map(m=>[m.id,checkedMaterial(m)])),cut=project.cut;
 number(cut.kerf,'톱날 손실',0,20);number(cut.endTrim,'양끝 정리',0,1000);number(cut.overlap,'겹침 여유',0,1000);
 if(![0,0.1,1].includes(cut.precision)||!['bars','waste','cost'].includes(cut.objective))throw Error('절단 정밀도 또는 구매 목표를 확인하세요.');
 if(cut.precision&&Math.abs(roundLength(cut.overlap,cut.precision)-cut.overlap)>EPS)throw Error('겹침 여유도 선택한 절단 단위에 맞춰 입력하세요.');
 const {general,rows,panels,depthConnectors,connectorWarnings,posts}=geometry(project,materials);
 list(project.inventory,'보유 자재',300);unique(project.inventory,'보유 자재');
 for(const x of project.inventory){identity(x.materialId,'보유 자재');if(!materials.has(x.materialId))throw Error('보유 자재의 규격을 선택하세요.');number(x.length,'재고 길이',1,100000);number(x.quantity,'보유 본수',1,1000000,true);number(x.trim,'재고 양끝 정리',0,1000);if(x.trim>=x.length)throw Error('재고 정리 여유는 길이보다 작아야 합니다.');}
 const groups=[];
 for(const m of materials.values()){
   const items=rows.filter(r=>r.materialId===m.id);if(!items.length)continue;
   const inventory=project.inventory.filter(i=>i.materialId===m.id),stocks=m.stockMode==='mixed'?m.stocks:m.stocks.filter(s=>s.length===m.selectedLength);
   const result=planMaterial(items,m,inventory,cut,stocks);
   if(compare)result.comparisons=[...m.stocks.map(s=>({mode:'selected',length:s.length,stocks:[s]})),...(m.stocks.length>1?[{mode:'mixed',length:null,stocks:m.stocks}]:[])].map(x=>{try{const plan=planMaterial(items,m,inventory,cut,x.stocks);return {mode:x.mode,length:x.length,status:plan.status,purchaseCount:plan.purchaseCount,cost:plan.purchaseCost,remainder:plan.remainder,joints:plan.jointCount,inventoryUsed:plan.inventoryUsed};}catch(error){return {mode:x.mode,length:x.length,status:'blocked',purchaseCount:null,cost:null,remainder:null,joints:null,inventoryUsed:null,error:error.message};}});
   for(const r of items){const e=result.extensions.find(e=>e.rowId===r.id);r.jointCount=e?.totalJoints||0;r.overlapLength=e?.overlap||0;r.totalLength=r.length*r.count/1000;r.materialLength=r.totalLength+r.overlapLength;r.weight=r.materialLength*m.kgm;}
   groups.push(result);
 }
 const sum=k=>groups.reduce((n,g)=>n+g[k],0),purchase={groups,patterns:groups.flatMap(g=>g.patterns),extensions:groups.flatMap(g=>g.extensions),blocked:groups.flatMap(g=>g.blocked),inventoryStatus:project.inventory.map(i=>groups.flatMap(g=>g.inventoryStatus).find(x=>x.id===i.id)||{...i,used:0,remaining:i.quantity})};
 for(const k of ['allocatedLength','purchaseCount','inventoryUsed','baseStockCount','additionalStockCount','grossLength','newLength','inventoryLength','purchaseWeight','inventoryWeight','materialLength','overlapLength','jointCount','extensionLength','remainder','kerfLoss','trimLoss','cutCount','knownCost','unknownPrices'])purchase[k]=sum(k);
 purchase.status=purchase.blocked.length?'blocked':'ready';purchase.utilization=purchase.grossLength?100*purchase.allocatedLength/purchase.grossLength:0;
 list(project.accessories,'판재·부속품');unique(project.accessories,'판재·부속품');
 const accessories=project.accessories.map(a=>{
   text(a.name,'부속품명');number(a.quantity,'부속품 대당 수량',1,100000,true);let each;
   if(a.type==='plate'){for(const k of ['width','height','thickness'])number(a[k],'판재 치수',0.01,100000);number(a.density,'판재 밀도',1,30000);each=a.width*a.height*a.thickness/1e9*a.density;}
   else if(a.type==='hardware')each=number(a.weightEach,'부속품 개당 중량',0,100000);else throw Error('부속품 종류를 확인하세요.');
   if(a.unitPrice!==null)number(a.unitPrice,'부속품 단가');const count=a.quantity*general.quantity;return {...a,count,weightEach:each,weight:each*count,amount:a.unitPrice===null?null:a.unitPrice*count};
 });
 const pc=project.cost;for(const key of ['cutFee','spliceFee','fabrication','painting','transport','other'])number(pc[key],'비용 입력');number(pc.taxRate,'세율',0,100);
 const accessoryCost=accessories.reduce((n,a)=>n+(a.amount||0),0),unknownAccessories=accessories.filter(a=>a.amount===null).length;
 const costs={materials:purchase.knownCost,accessories:accessoryCost,cutting:purchase.cutCount*pc.cutFee,splicing:purchase.jointCount*pc.spliceFee,fabrication:pc.fabrication,painting:pc.painting,transport:pc.transport,other:pc.other};
 const knownSubtotal=Object.values(costs).reduce((n,x)=>n+x,0),complete=!purchase.unknownPrices&&!unknownAccessories&&purchase.status==='ready';
 costs.knownSubtotal=knownSubtotal;costs.complete=complete;costs.tax=knownSubtotal*pc.taxRate/100;costs.total=complete?knownSubtotal+costs.tax:null;costs.unknownPrices=purchase.unknownPrices+unknownAccessories;
 const frameWeight=rows.reduce((n,r)=>n+r.weight,0),accessoryWeight=accessories.reduce((n,a)=>n+a.weight,0),cabinetWeight=project.cabinet.enabled?project.cabinet.weightEach*project.cabinet.columns*project.cabinet.rows*general.quantity:0,equipmentWeight=general.extraEquipment*general.quantity+cabinetWeight;
 return {general,rows,panels,depthConnectors,connectorWarnings,posts,purchase,accessories,costs,frameWeight,accessoryWeight,cabinetWeight,equipmentWeight,totalWeight:frameWeight+accessoryWeight+equipmentWeight,totalLength:rows.reduce((n,r)=>n+r.totalLength,0),totalPieces:rows.reduce((n,r)=>n+r.count,0),roundingRows:rows.filter(r=>Math.abs(r.delta)>EPS),materials:project.materials};
}
function migrate(raw){
 if(raw?.version===5){const p=clone(raw),ui=p.ui&&typeof p.ui==='object'&&!Array.isArray(p.ui)?p.ui:{};p.ui={...ui,inputMode:ui.inputMode==='detailed'?'detailed':'simple'};if(p.general&&p.general.verticalDepthTies===undefined)p.general.verticalDepthTies=true;calculate(p);return p;}
 const old=legacy.parseProject(JSON.stringify(raw)),v=old.input,r=legacy.calculate(v),p=createProject();p.name='이전 설정 가져오기';
 p.general={width:v.width,height:v.height,depth:v.depth,planes:v.planes,quantity:v.frames,extraEquipment:v.equipment,verticalDepthTies:false};p.cut={...p.cut,kerf:v.kerf,endTrim:v.endTrim,overlap:v.spliceAllowance};p.materials=[];
 const mapping=new Map(),get=profile=>{
   const base=profile.rotation?{face:profile.sectionDepth,depth:profile.face}:{face:profile.face,depth:profile.sectionDepth};
   const preset=legacy.presets[profile.section],key=JSON.stringify([profile.section,profile.family,base.face,base.depth,profile.unitWeight,profile.stockLength,profile.materialName]);
   if(!mapping.has(key)){const m={...material('50','m'+(p.materials.length+1)),name:preset?.label||profile.materialName||'사용자 규격 '+(p.materials.length+1),section:profile.section,family:profile.family,...base,kgm:profile.unitWeight,t1:preset?.thickness||preset?.web||null,t2:preset?.flange||0,stocks:[{length:profile.stockLength,price:null}],selectedLength:profile.stockLength};p.materials.push(m);mapping.set(key,m.id);}
   return ref(mapping.get(key),profile.rotation);
 };
 const members=r.members;p.front.edges=Object.fromEntries(['left','right','top','bottom'].map(k=>[k,get(members['outer'+k[0].toUpperCase()+k.slice(1)])]));
 p.front.vertical=Array.from({length:v.vertical},(_,i)=>({id:'v'+(i+1),...get(members.innerVertical),position:null}));p.front.horizontal=Array.from({length:v.horizontal},(_,i)=>({id:'h'+(i+1),...get(members.innerHorizontal),position:null}));p.back=clone(p.front);
 for(const k of ['left','right']){const role=k[0].toUpperCase()+k.slice(1);p[k]={top:get(members.depthTop),bottom:get(members.depthBottom),vertical:Array.from({length:v.sideVertical},(_,i)=>({id:'v'+(i+1),...get(members['side'+role+'Vertical']),position:null})),horizontal:Array.from({length:v.sideHorizontal},(_,i)=>({id:'h'+(i+1),...get(members['side'+role+'Horizontal']),position:null}))};}p.rightLinked=false;
 calculate(p);return p;
}
function parse(textInput){let raw;try{raw=JSON.parse(textInput);}catch{throw Error('올바른 JSON 파일이 아닙니다.');}return migrate(raw);}
function cabinetGrid(p){const c=p.cabinet;const m=p.front.edges.left.materialId;p.front.vertical=Array.from({length:c.columns-1},(_,i)=>reinforcement('v'+(i+1),m,c.width*(i+1)));p.front.horizontal=Array.from({length:c.rows-1},(_,i)=>reinforcement('h'+(i+1),m,c.height*(i+1)));if(!p.backLinked){p.back.vertical=clone(p.front.vertical);p.back.horizontal=clone(p.front.horizontal);}return p;}
function summary(r){return {quantity:r.general.quantity,weight:r.totalWeight,purchaseCount:r.purchase.purchaseCount,cost:r.costs.total,length:r.totalLength};}
const api={legacy,clone,ref,reinforcement,material,face,side,createProject,calculate,parse,migrate,cabinetGrid,summary,planMaterial,segmentPlan,packPattern};
root.FramePlanner=api;if(typeof module==='object')module.exports=api;
})(typeof globalThis==='object'?globalThis:this);
