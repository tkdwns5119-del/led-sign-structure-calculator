(function(){
  'use strict';
  // Quantity-only screen: the same FoundationEngine geometry/earthwork/rebar formulas, fixed (manual) dimensions, no wind or soil checks.
  const E=FoundationEngine,$=id=>document.getElementById(id),KEY='foundation-quantity-v1';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const NUM=['L','W','H','qty','cL','cW','cH','above','postSpacing','lean','stone','ow','work','slope','concWaste','rebarWaste','soilL','soilC','spacing','cover','neckNX','neckNY','tieSpacing','dowelEmbed'];
  const SEL=['type','bar','neckBar','tieBar'];
  const LABELS={L:'푸팅 가로',W:'푸팅 세로',H:'푸팅 두께',qty:'기초 개수',cL:'목 가로',cW:'목 세로',cH:'목 전체 높이',above:'지상 노출 높이',postSpacing:'두 목 중심 간격',lean:'버림 두께',stone:'잡석 두께',ow:'버림·잡석 좌우 여유',work:'굴착 바닥 작업 여유',slope:'굴착 물매',concWaste:'콘크리트 할증',rebarWaste:'철근 할증',soilL:'토량 팽창계수',soilC:'토량 다짐계수',spacing:'푸팅 철근 간격',cover:'푸팅 피복',neckNX:'목 X면 주근 수',neckNY:'목 Y면 주근 수',tieSpacing:'띠철근 간격',dowelEmbed:'목 주근 근입'};
  const DEFAULTS={type:'single',L:2500,W:2500,H:1600,qty:1,cL:800,cW:800,cH:1000,above:300,postSpacing:3500,lean:100,stone:200,ow:100,work:300,slope:0,concWaste:1,rebarWaste:3,soilL:1.2,soilC:1,bar:'19',spacing:200,cover:75,neckBar:'22',neckNX:6,neckNY:6,tieBar:'10',tieSpacing:150,dowelEmbed:500,rebarOn:true};
  const fmt=(v,d=3)=>Number.isFinite(v)?v.toLocaleString('ko-KR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const digits=unit=>unit==='kg'?1:unit==='본'||unit==='개'?0:3;
  let last=null,timer=null;

  for(const id of ['bar','neckBar','tieBar'])$(id).innerHTML=Object.keys(E.bars).map(v=>`<option value="${v}">D${v}</option>`).join('');
  function fill(v){for(const id of [...NUM,...SEL])$(id).value=String(v[id]);$('rebar-on').checked=v.rebarOn!==false;layout();}
  function layout(){
    const type=$('type').value,neck=type!=='block';
    $('neck-card').hidden=!neck;$('post-spacing-field').hidden=type!=='combined';
    for(const n of document.querySelectorAll('.neck-only'))n.hidden=!neck;$('rebar-fields').hidden=!$('rebar-on').checked;
  }
  function read(){
    const v={type:$('type').value,bar:$('bar').value,neckBar:$('neckBar').value,tieBar:$('tieBar').value,rebarOn:$('rebar-on').checked},bad=[];
    for(const id of NUM){
      const node=$(id),raw=node.value.trim(),n=Number(raw);node.removeAttribute('aria-invalid');
      const hidden=node.closest('[hidden]');if(hidden){v[id]=DEFAULTS[id];continue;}
      if(raw===''||!Number.isFinite(n)){node.setAttribute('aria-invalid','true');bad.push(LABELS[id]);continue;}
      v[id]=n;
    }
    return {v,bad};
  }
  function params(v){
    const neck=v.type!=='block';
    return {type:v.type,mode:'manual',rebarMode:'manual',installMode:'repeat',qty:v.qty,L:v.L,W:v.W,H:v.H,
      cL:neck?v.cL:DEFAULTS.cL,cW:neck?v.cW:DEFAULTS.cW,cH:neck?v.cH:DEFAULTS.cH,above:neck?v.above:0,postSpacing:v.postSpacing,
      bottom:Math.max(3,(neck?v.above:0)/1000+0.1),lean:v.lean,stone:v.stone,ow:v.ow,work:v.work,slope:v.slope,concWaste:v.concWaste,rebarWaste:v.rebarWaste,soilL:v.soilL,soilC:v.soilC,
      bar:Number(v.bar),spacing:v.spacing,cover:v.cover,neckBar:Number(v.neckBar),neckNX:v.neckNX,neckNY:v.neckNY,tieBar:Number(v.tieBar),tieSpacing:v.tieSpacing,dowelEmbed:v.dowelEmbed,
      // Not used for quantities; fixed so validation never depends on wind or soil.
      signW:Math.max(100,v.L),signH:2000,signDepth:250,panelKgM2:45,postKg:250,extraKg:0,windMode:'pressure',pressure:1.5};
  }
  function friendly(message){
    const m=String(message).match(/^(\w+):\s*([\d.\-]+)~([\d.\-]+)/);
    if(m&&LABELS[m[1]]){const node=$(m[1]);node?.setAttribute('aria-invalid','true');return `${LABELS[m[1]]}은(는) ${Number(m[2]).toLocaleString('ko-KR')}~${Number(m[3]).toLocaleString('ko-KR')} 범위로 입력하세요.`;}
    if(/^(bar|neckBar|tieBar)/.test(message))return '철근 규격을 확인하세요.';
    return String(message).replace(/^\w+:\s*/,'');
  }
  function quantities(r,rebarOn){
    return r.boq.filter(b=>b.name!=='기둥·지주 수량'&&(rebarOn||!/^철근/.test(b.name))&&!(r.p.type==='block'&&/목/.test(b.name))).map(b=>({name:b.name,unit:b.unit,one:b.value,total:b.total,formula:b.formula}));
  }

  // Plain-language names, construction order and explanations with the actual numbers substituted.
  const GROUPS=[
    ['1. 땅 파기',[['터파기 · 자연상태','터파기 (파낸 흙)']]],
    ['2. 바닥 만들기',[['잡석 지정','잡석 깔기'],['버림 콘크리트','버림 콘크리트']]],
    ['3. 기초 만들기',[['거푸집 · 푸팅 측면','푸팅 거푸집'],['거푸집 · 목 측면','목 거푸집'],['구조 콘크리트 · 푸팅','푸팅 콘크리트'],['구조 콘크리트 · 목','목 콘크리트'],['구조 콘크리트 · 주문량','콘크리트 타설 주문량'],['철근 · 순물량','철근 (손실 제외)'],['철근 · 할증 포함','철근 주문량']]],
    ['4. 흙 정리',[['되메우기 · 다짐상태','되메우기'],['잔토 반출 · 흐트러진 상태','남는 흙 반출'],['되메움 추가 반입 · 자연상태','모자란 흙 반입']]]];
  const m=(x,d=2)=>fmt(x/1000,d),n3=x=>fmt(x,3);
  function explain(name,r){
    const p=r.p,g=r.g,q=r.q,tb=p.lean/1000,tr=p.stone/1000,ow=p.ow/1000,work=p.work/1000,neckCount=g.n,unders=q.buried;
    const perimeter=2*(g.L+g.W)/1000,neckPerimeter=2*(g.cL+g.cW)/1000;
    switch(name){
      case '터파기 · 자연상태':return [`깊이 ${fmt(q.depth,2)} m × 바닥 ${fmt(q.botL,2)} m × ${fmt(q.botW,2)} m${p.slope>0?` (윗면은 경사로 ${fmt(q.topL,2)} m × ${fmt(q.topW,2)} m)`:''} = ${n3(q.excavation)} m³`,`깊이 = ${g.neck?`땅에 묻히는 목 ${fmt(g.embed,2)} + `:''}푸팅 ${m(g.H)} + 버림 ${fmt(tb,2)} + 잡석 ${fmt(tr,2)} m. 바닥 = 기초보다 사방 ${fmt(ow+work,2)} m 넓게(작업 공간).`];
      case '잡석 지정':return [`${fmt(q.subL,2)} m × ${fmt(q.subW,2)} m × 두께 ${fmt(tr,2)} m = ${n3(q.stone)} m³`,`맨 아래에 깔고 다지는 돌. 기초보다 사방 ${fmt(ow,2)} m 넓게 깝니다.`];
      case '버림 콘크리트':return [`${fmt(q.subL,2)} m × ${fmt(q.subW,2)} m × 두께 ${fmt(tb,2)} m = ${n3(q.lean)} m³`,'잡석 위에 얇게 치는 바닥 콘크리트. 먹줄을 놓고 철근을 세우는 받침입니다.'];
      case '거푸집 · 푸팅 측면':return [`둘레 ${fmt(perimeter,2)} m × 높이 ${m(g.H)} m = ${n3(q.formFoot)} m²`,'콘크리트를 붓기 전에 옆면을 막는 틀. 바닥과 윗면은 빼고 4면만 셉니다.'];
      case '거푸집 · 목 측면':return [`둘레 ${fmt(neckPerimeter,2)} m × 높이 ${m(g.cH)} m${neckCount>1?` × ${neckCount}개`:''} = ${n3(q.formNeck)} m²`,'목(기둥 받침)의 4면 틀입니다.'];
      case '구조 콘크리트 · 푸팅':return [`가로 ${m(g.L)} × 세로 ${m(g.W)} × 두께 ${m(g.H)} m = ${n3(q.footing)} m³`,'기초 판(푸팅)의 부피입니다.'];
      case '구조 콘크리트 · 목':return [`가로 ${m(g.cL)} × 세로 ${m(g.cW)} × 높이 ${m(g.cH)} m${neckCount>1?` × ${neckCount}개`:''} = ${n3(q.neck)} m³`,'푸팅 위에 올라오는 목(기둥 받침)의 부피입니다.'];
      case '구조 콘크리트 · 주문량':return [`(푸팅 ${n3(q.footing)}${g.neck?` + 목 ${n3(q.neck)}`:''}) × 손실 여유 ${fmt(p.concWaste,1)}% = ${n3(q.orderedConcrete)} m³`,'레미콘 주문에 쓰는 값입니다. 위 푸팅·목 콘크리트를 이미 포함하므로 따로 더하지 마세요.'];
      case '철근 · 순물량':return [`본수 × 길이 × 규격별 무게(kg/m)의 합 = ${fmt(r.r.net,1)} kg`,'부위별 본수와 길이는 아래 ‘철근 상세’에 있습니다. 이음·스페이서는 제외입니다.'];
      case '철근 · 할증 포함':return [`${fmt(r.r.net,1)} kg × 손실 여유 ${fmt(p.rebarWaste,1)}% = ${fmt(r.r.gross,1)} kg`,'철근 주문에 쓰는 값입니다.'];
      case '되메우기 · 다짐상태':return [`파낸 흙 ${n3(q.excavation)} − 땅속에 들어간 것 ${n3(unders)} = ${n3(q.backfill)} m³`,'땅속에 들어간 것 = 푸팅·묻힌 목·버림·잡석. 남은 빈 공간을 흙으로 다시 채웁니다.'];
      case '잔토 반출 · 흐트러진 상태':return [`(파낸 흙 ${n3(q.excavation)} − 되메우기 ${n3(q.backfill)}${p.soilC!==1?` ÷ ${p.soilC}`:''}) × 부풀음 ${p.soilL}배 = ${n3(q.surplus)} m³`,`되메우고 남는 흙을 실어 낼 양입니다. 파낸 흙은 부풀어 부피가 ${p.soilL}배가 됩니다(트럭 기준).`];
      case '되메움 추가 반입 · 자연상태':return [q.borrow>0?`되메우기 ${n3(q.backfill)}${p.soilC!==1?` ÷ ${p.soilC}`:''} − 파낸 흙 ${n3(q.excavation)} = ${n3(q.borrow)} m³`:'파낸 흙으로 충분해 반입할 흙이 없습니다 = 0 m³','파낸 흙이 되메우기에 모자랄 때만 생깁니다.'];
    }
    return ['',''];
  }
  function section(r,compact){
    const p=r.p,g=r.g,q=r.q,tb=p.lean/1000,tr=p.stone/1000,L=g.L/1000,H=g.H/1000,cL=g.cL/1000,above=g.above/1000,embed=g.embed,depth=q.depth;
    const fs=compact?19:14,W=compact?420:720,left=compact?20:160,drawW=compact?380:360,top=compact?30:34,drawH=compact?250:230;
    const s=Math.min(drawW/q.topL,drawH/(depth+above)),cx=left+drawW/2,gl=top+above*s,X=x=>(cx+x*s).toFixed(1),Y=y=>gl+y*s;
    const rect=(x1,y1,x2,y2,cls)=>`<rect x="${X(x1)}" y="${Y(y1).toFixed(1)}" width="${((x2-x1)*s).toFixed(1)}" height="${((y2-y1)*s).toFixed(1)}" class="${cls}"/>`;
    const text=(x,y,t,cls='',anchor='start')=>`<text x="${x}" y="${y.toFixed?y.toFixed(1):y}" text-anchor="${anchor}" class="lbl ${cls}" style="font-size:${cls.includes('muted')?fs-1:fs}px">${t}</text>`;
    const bracket=(x,y1,y2,cls='')=>`<g class="dim ${cls}"><line x1="${x}" y1="${y1.toFixed(1)}" x2="${x}" y2="${y2.toFixed(1)}"/><line x1="${x-5}" y1="${y1.toFixed(1)}" x2="${x+5}" y2="${y1.toFixed(1)}"/><line x1="${x-5}" y1="${y2.toFixed(1)}" x2="${x+5}" y2="${y2.toFixed(1)}"/></g>`;
    const necks=g.neck?g.pedestals.map(c=>rect(c/1000-cL/2,-above,c/1000+cL/2,embed,'conc')).join(''):'';
    const height=Math.ceil(Y(depth)+fs*3);
    let svg=`<svg viewBox="0 0 ${W} ${height}" role="img" aria-label="기초 단면 그림: 터파기, 잡석, 버림, 푸팅, 목"><line x1="4" y1="${Y(0)}" x2="${W-4}" y2="${Y(0)}" class="gl"/>${text(6,Y(0)-8,'지면',`muted`)}`;
    svg+=`<polygon points="${X(-q.topL/2)},${Y(0)} ${X(q.topL/2)},${Y(0)} ${X(q.botL/2)},${Y(depth)} ${X(-q.botL/2)},${Y(depth)}" class="soil"/>`;
    svg+=rect(-q.subL/2,depth-tr,q.subL/2,depth,'stone')+rect(-q.subL/2,depth-tr-tb,q.subL/2,depth-tr,'lean')+rect(-L/2,embed,L/2,embed+H,'conc')+necks;
    svg+=text(cx,Y(embed+H/2)+fs/3,`푸팅 ${fmt(L,2)} m`,'on-conc','middle');
    const yb=Y(depth)+fs+4;svg+=`<line x1="${X(-q.botL/2)}" y1="${(yb-fs/2).toFixed(1)}" x2="${X(q.botL/2)}" y2="${(yb-fs/2).toFixed(1)}" class="dim-line"/>`+text(cx,yb+fs*0.9,`굴착 바닥 ${fmt(q.botL,2)} m`,'','middle');
    if(!compact){
      const marks=[];if(g.neck&&above>0)marks.push([-above,0,`지상 목 ${fmt(above,2)} m`]);if(g.neck&&embed>0)marks.push([0,embed,`묻힌 목 ${fmt(embed,2)} m`]);marks.push([embed,embed+H,`푸팅 두께 ${fmt(H,2)} m`]);if(tb>0)marks.push([embed+H,embed+H+tb,`버림 ${fmt(tb,2)} m`]);if(tr>0)marks.push([depth-tr,depth,`잡석 ${fmt(tr,2)} m`]);
      const x=left+drawW+28;let last=-Infinity;for(const [a,b2,t] of marks){const ya=Y(a),yb2=Y(b2),mid=Math.max((ya+yb2)/2+5,last+fs+4);last=mid;svg+=bracket(x,ya,yb2)+text(x+12,mid,t);}
      const dx=left-28;svg+=bracket(dx,Y(0),Y(depth),'strong')+text(dx-10,Y(depth/2)-4,'굴착 깊이','strong','end')+text(dx-10,Y(depth/2)+fs+2,`${fmt(depth,2)} m`,'strong','end');
    }
    return svg+'</svg>';
  }
  function layers(r){
    const p=r.p,g=r.g,q=r.q,list=[];if(g.neck&&g.above>0)list.push(`지상 목 ${fmt(g.above/1000,2)}`);if(g.neck&&g.embed>0)list.push(`묻힌 목 ${fmt(g.embed,2)}`);list.push(`푸팅 ${fmt(g.H/1000,2)}`);if(p.lean>0)list.push(`버림 ${fmt(p.lean/1000,2)}`);if(p.stone>0)list.push(`잡석 ${fmt(p.stone/1000,2)}`);
    return `<p class="layers"><strong>굴착 깊이 ${fmt(q.depth,2)} m</strong> = ${list.filter(x=>!/지상/.test(x)).join(' + ')} m${g.neck&&g.above>0?` · 지상 노출 ${fmt(g.above/1000,2)} m`:''}</p>`;
  }
  function render(){
    const {v,bad}=read();layout();
    if(bad.length){showError(bad.join(', ')+' 값을 입력하세요.');return;}
    let r;try{r=E.calculate(params(v));}catch(error){showError(friendly(error.message));return;}
    $('error').hidden=true;$('result').classList.remove('stale');
    const rows=quantities(r,v.rebarOn),n=r.p.qty,q=r.q,g=r.g,byName=name=>rows.find(x=>x.name===name);
    last={v,r,rows};
    const neck=g.neck?` · 목 ${fmt(g.cL,0)}×${fmt(g.cW,0)}×${fmt(g.cH,0)}${g.n>1?' ×'+g.n:''}`:'';
    $('result-sub').textContent=`푸팅 ${fmt(g.L,0)}×${fmt(g.W,0)}×${fmt(g.H,0)} mm${neck} · 굴착 깊이 ${fmt(q.depth,2)} m · 굴착 바닥 ${fmt(q.botL,2)}×${fmt(q.botW,2)} m${q.topL!==q.botL?` · 상부 ${fmt(q.topL,2)}×${fmt(q.topW,2)} m`:''} · 기초 ${n}개`;
    $('total-head').textContent=n>1?`전체 (×${n})`:'수량';$('per-one-note').hidden=n===1;$('per-one-note').textContent=`계산식은 기초 1개 기준입니다. ‘전체’는 1개 수량 × ${n}개입니다.`;$('result').classList.toggle('single',n===1);
    const key=[['터파기','터파기 · 자연상태'],['콘크리트 타설','구조 콘크리트 · 주문량'],['버림 콘크리트','버림 콘크리트'],['잡석','잡석 지정'],['되메우기','되메우기 · 다짐상태'],['잔토 반출','잔토 반출 · 흐트러진 상태'],...(v.rebarOn?[['철근 (할증 포함)','철근 · 할증 포함']]:[])];
    const form=byName('거푸집 · 푸팅 측면').total+(byName('거푸집 · 목 측면')?.total||0);
    $('key-figures').innerHTML=key.map(([label,name])=>{const x=byName(name);return x?`<div class="figure"><span>${label}</span><strong>${fmt(x.total,digits(x.unit))}<small>${x.unit}</small></strong>${n>1?`<em>1개 ${fmt(x.one,digits(x.unit))} ${x.unit}</em>`:''}</div>`:'';}).join('')+`<div class="figure"><span>거푸집 합계</span><strong>${fmt(form,3)}<small>m²</small></strong>${n>1?`<em>1개 ${fmt(form/n,3)} m²</em>`:''}</div>`;
    $('boq').innerHTML=GROUPS.map(([group,items])=>{const list=items.map(([name,label])=>({x:byName(name),label})).filter(i=>i.x);if(!list.length)return '';return `<tr class="group"><th colspan="3" scope="rowgroup">${group}</th></tr>`+list.map(({x,label})=>{const [how,why]=explain(x.name,r);return `<tr${/주문량|터파기|철근 주문/.test(label)?' class="strong"':''}><th scope="row"><span class="item">${esc(label)}</span><span class="how">${esc(how)}</span><span class="why">${esc(why)}</span></th><td class="num one">${fmt(x.one,digits(x.unit))}<span class="u">${esc(x.unit)}</span></td><td class="num">${fmt(x.total,digits(x.unit))}<span class="u">${esc(x.unit)}</span></td></tr>`;}).join('');}).join('');
    const compact=($('section-drawing').clientWidth||700)<560;$('section-drawing').innerHTML=section(r,compact)+layers(r);
    $('rebar-detail').hidden=!v.rebarOn;
    $('rebar-rows').innerHTML=r.r.rows.map(b=>`<tr><td>${esc(b.code)}</td><td>${esc(b.name)}</td><td>D${b.bar}</td><td class="num">${fmt(b.count,0)}</td><td class="num">${fmt(b.length,0)}</td><td class="num">${fmt(b.kg,1)}</td></tr>`).join('');
    try{localStorage.setItem(KEY,JSON.stringify(v));}catch{}
  }
  function showError(text){$('error').textContent=text;$('error').hidden=false;$('result').classList.add('stale');last=null;}
  function schedule(){clearTimeout(timer);timer=setTimeout(render,120);}
  function tables(){
    if(!last)throw Error('입력 오류를 먼저 수정하세요.');const {r,rows,v}=last,n=r.p.qty;
    const t=[{name:'기초물량',rows:[['전광판 기초 물량',$('result-sub').textContent,'','',''],['공종','1개','전체 (×'+n+')','단위','계산 방법','설명'],...GROUPS.flatMap(([group,items])=>items.map(([name,label])=>({x:rows.find(y=>y.name===name),label})).filter(i=>i.x).map(({x,label})=>{const [how,why]=explain(x.name,r);return [label,round(x.one,digits(x.unit)),round(x.total,digits(x.unit)),x.unit,how,why];}))]}];
    if(v.rebarOn)t.push({name:'철근상세',rows:[['기호','부위','규격','1개 본수','길이(mm)','1개 중량(kg)','전체 중량(kg)','비고'],...r.r.rows.map(b=>[b.code,b.name,'D'+b.bar,b.count,round(b.length,0),round(b.kg,1),round(b.kg*n,1),b.note])]});
    return t;
  }
  const round=(x,d)=>Math.round(x*10**d)/10**d;
  function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function guard(fn){return()=>{clearTimeout(timer);render();try{fn();}catch(e){showError(e.message);}};}
  $('form').addEventListener('input',schedule);$('form').addEventListener('change',()=>{clearTimeout(timer);render();});
  $('reset').addEventListener('click',()=>{fill(DEFAULTS);render();});
  $('save-xlsx').addEventListener('click',guard(()=>download(FrameExport.workbook(tables()),'기초_물량.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')));
  $('save-csv').addEventListener('click',guard(()=>{const csv='﻿'+tables().flatMap(s=>[[s.name],...s.rows,[]]).map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""')+'"').join(',')).join('\r\n');download(csv,'기초_물량.csv','text/csv;charset=utf-8');}));
  $('print').addEventListener('click',guard(()=>window.print()));
  window.addEventListener('beforeprint',()=>{if(last?.v.rebarOn)$('rebar-detail').open=true;});
  let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
  fill({...DEFAULTS,...(saved&&typeof saved==='object'?saved:{})});render();
  let width=0;window.addEventListener('resize',()=>{const w=$('section-drawing').clientWidth;if(Math.abs(w-width)>40){width=w;schedule();}});
  window.FoundationQuantity={render,read:()=>read().v,getResult:()=>last};
})();
