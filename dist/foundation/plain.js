// Plain-language layer for office staff: groups the engine's checks into four questions, gives each a
// traffic light (green: margin, yellow: check, red: likely short, gray: not calculated) and explains
// terms. The screen, the overview and the printed reference all read their wording from here.
(function(root){
  'use strict';

  const DISCLAIMER='구조계산 의뢰 전 참고용 자료입니다. 확정 구조계산서가 아니며, 실제 설치 전에는 구조기술사의 검토·확인이 필요합니다.';
  const LIGHTS={
    green:{icon:'🟢',word:'여유 있음',tone:'계산상 여유가 있습니다.'},
    yellow:{icon:'🟡',word:'확인 필요',tone:'여유가 적거나 확인할 자료가 있습니다. 구조계산 의뢰 시 함께 확인받으세요.'},
    red:{icon:'🔴',word:'부족 예상',tone:'현재 조건으로는 부족할 수 있습니다. 아래 "해 볼 일"을 참고해 조건을 바꾸거나 설계자와 상의하세요.'},
    gray:{icon:'⚪',word:'계산 안 함',tone:'이 형식이나 입력으로는 계산하지 않았습니다.'}
  };
  const ORDER={gray:0,green:1,yellow:2,red:3};
  const worse=(a,b)=>ORDER[b]>ORDER[a]?b:a;
  // Utilisation above this is shown yellow even when it passes.
  const TIGHT=0.8;

  const GROUPS=[
    {id:'stability',question:'바람에 넘어지거나 밀리지 않나요?',short:'넘어짐·밀림',about:'강한 바람이 전광판을 밀 때 기초째 넘어지거나, 옆으로 미끄러지거나, 바닥이 들뜨지 않는지 봅니다.'},
    {id:'ground',question:'땅이 무게를 버티나요?',short:'땅의 버팀',about:'기초가 땅을 누르는 힘이 그 땅이 버틸 수 있는 값보다 작은지 봅니다. 땅의 값은 지반조사로 정해집니다.'},
    {id:'concrete',question:'기초 콘크리트·철근은 충분한가요?',short:'기초 콘크리트·철근',about:'기초판이 꺾이거나 잘리지 않는지, 철근이 충분히 들어가고 묻히는지 봅니다.'},
    {id:'steel',question:'기둥·앵커·바닥판은 충분한가요?',short:'기둥·앵커·바닥판',about:'강재 기둥이 휘지 않는지, 기둥을 고정하는 앵커볼트와 바닥 철판(베이스플레이트)이 견디는지 봅니다.'}
  ];

  const widen='기초의 가로·세로를 넓혀 보세요.',heavier='기초를 더 크게(넓게·깊게) 해 무게를 늘려 보세요.';
  const ITEMS={
    '연직 유효하중':{group:'stability',name:'기초가 누르는 무게',explain:'지하수 부력을 빼고도 기초가 땅을 누르는 무게가 남는지 봅니다.',fix:heavier},
    '저면 전면 접지 (사용하중)':{group:'stability',name:'바닥 들뜸',explain:'바람을 받아도 기초 바닥 전체가 땅에 붙어 있는지 봅니다. 한쪽이 들리면 기울어질 수 있습니다.',fix:widen},
    '활동 안전율':{group:'stability',name:'옆으로 밀림',explain:'바람에 기초가 옆으로 미끄러지지 않을 만큼 여유가 있는지 봅니다.',fix:heavier},
    '전도 안전율 (두 축 합산)':{group:'stability',name:'넘어짐',explain:'바람에 기초째 넘어가지 않을 만큼 여유가 있는지 봅니다.',fix:widen},
    '저면 전면 접지 (계수하중)':{group:'stability',name:'바닥 들뜸 (바람을 크게 잡은 조건)',explain:'바람을 설계용으로 더 크게 잡아도 기초 바닥 전체가 땅에 붙어 있는지 봅니다.',fix:widen},
    '지반 지지력 (사용하중)':{group:'ground',name:'땅이 버티는 힘',explain:'기초 바닥이 땅을 누르는 압력이 그 땅의 허용 값보다 작은지 봅니다.',fix:'기초 바닥을 넓히고, 지반조사로 실제 땅의 값을 확인하세요.'},
    '푸팅 X방향 휨':{group:'concrete',name:'기초판 꺾임 (가로 방향)',explain:'땅이 밀어 올리는 힘에 기초판이 꺾이지 않는지 봅니다.',fix:'기초를 두껍게 하거나 철근을 늘려 보세요.'},
    '푸팅 Y방향 휨':{group:'concrete',name:'기초판 꺾임 (세로 방향)',explain:'땅이 밀어 올리는 힘에 기초판이 꺾이지 않는지 봅니다.',fix:'기초를 두껍게 하거나 철근을 늘려 보세요.'},
    '설정 최소 철근량 / 순간격':{group:'concrete',name:'철근 최소량·간격',explain:'기초판에 최소한 필요한 철근이 들어가고, 철근 사이 간격이 적당한지 봅니다.',fix:'철근을 굵게 하거나 간격을 좁혀 보세요.'},
    '푸팅 1방향 전단':{group:'concrete',name:'기초판 잘림',explain:'기둥받침 가까이에서 기초판이 잘리듯 깨지지 않는지 봅니다.',fix:'기초를 두껍게 해 보세요.'},
    '직선근 정착 공간':{group:'concrete',name:'철근 묻힘 길이',explain:'기초판 철근이 콘크리트 속에 충분히 묻힐 길이가 있는지 봅니다.',fix:widen},
    '목 주근 정착 공간':{group:'concrete',name:'기둥받침 철근 묻힘',explain:'기둥받침(목) 철근이 기초판 속에 충분히 묻힐 공간이 있는지 봅니다.',fix:'기초를 두껍게 하거나 넓혀 보세요.'},
    '목 띠근 간격 / 주근비 초안':{group:'concrete',name:'기둥받침 철근 배치',explain:'기둥받침(목)의 세로 철근 양과 띠철근 간격이 적당한지 봅니다.',fix:'기둥받침 철근 수나 띠철근 간격을 조정해 보세요.'},
    '지주 강재 · 휨·전단·축력':{group:'steel',name:'강재 기둥',explain:'기둥 단면과 두께를 넣으면 계산합니다.',fix:'기둥 종류·크기·두께를 입력하세요.'},
    '지주 휨·축력 조합 (계수하중)':{group:'steel',name:'기둥 휨·꺾임',explain:'바람과 무게를 함께 받아도 강재 기둥이 휘거나 꺾이지 않는지 봅니다.',fix:'더 큰 단면이나 더 두꺼운 기둥을 써 보세요.'},
    '지주 전단 (계수하중)':{group:'steel',name:'기둥 잘림',explain:'바람이 옆으로 미는 힘에 기둥이 잘리지 않는지 봅니다.',fix:'더 두꺼운 기둥을 써 보세요.'},
    '앵커 · 인장·전단':{group:'steel',name:'앵커볼트',explain:'앵커 개수와 묻힘 깊이를 넣으면 계산합니다.',fix:'앵커 개수·굵기·묻힘 깊이를 입력하세요.'},
    '앵커 강재 인장 (0.9D + γW)':{group:'steel',name:'앵커볼트 끊어짐',explain:'바람에 기둥이 들릴 때 앵커볼트가 끊어지지 않는지 봅니다.',fix:'앵커를 굵게 하거나 개수를 늘려 보세요.'},
    '앵커 콘크리트 콘 파괴 (인장 그룹)':{group:'steel',name:'앵커 주변 콘크리트 뜯김',explain:'앵커가 당겨질 때 주변 콘크리트가 원뿔 모양으로 뜯겨 나오지 않는지 봅니다.',fix:'앵커를 더 깊게 묻거나 기둥받침(목)을 키워 보세요.'},
    '앵커 뽑힘 (인장)':{group:'steel',name:'앵커 빠짐',explain:'앵커 머리(너트)가 콘크리트에서 빠져나오지 않는지 봅니다.',fix:'앵커를 굵게 하거나 머리·너트형 앵커를 써 보세요.'},
    '앵커 강재 전단':{group:'steel',name:'앵커 옆으로 잘림',explain:'바람이 옆으로 미는 힘에 앵커볼트가 잘리지 않는지 봅니다.',fix:'앵커를 굵게 하거나 개수를 늘려 보세요.'},
    '앵커 인장·전단 조합':{group:'steel',name:'앵커 (당김과 밀림을 함께)',explain:'당기는 힘과 옆으로 미는 힘을 함께 받아도 앵커가 견디는지 봅니다.',fix:'앵커를 굵게·깊게 하거나 개수를 늘려 보세요.'},
    '앵커 최소 간격·연단거리':{group:'steel',name:'앵커 간격·가장자리 여유',explain:'앵커끼리, 그리고 콘크리트 가장자리까지 거리가 충분한지 봅니다.',fix:'앵커 간격을 넓히거나 기둥받침(목)을 키워 보세요.'},
    '앵커 묻힘깊이 공간':{group:'steel',name:'앵커를 묻을 깊이',explain:'입력한 앵커 묻힘 깊이가 콘크리트 안에 들어가는지 봅니다.',fix:'앵커를 짧게 하거나 기초를 두껍게 하세요.'},
    '베이스플레이트 두께':{group:'steel',name:'바닥판(베이스플레이트)',explain:'바닥판 두께를 넣으면 계산합니다.',fix:'바닥판 두께를 입력하세요.'},
    '베이스플레이트 두께 (휨)':{group:'steel',name:'바닥판 두께',explain:'기둥 아래 철판이 휘지 않을 만큼 두꺼운지 봅니다.',fix:'바닥판을 두껍게 해 보세요.'},
    '베이스플레이트 지압 길이':{group:'steel',name:'바닥판 아래 받침',explain:'바닥판이 누르는 범위가 판 안에 들어오는지 봅니다.',fix:'바닥판을 크게 해 보세요.'},
    // Rows that only explain or that a structural engineer must review.
    '지주 상단 처짐 (사용 풍하중 · 참고)':{group:'info',name:'기둥 윗부분 흔들림 (참고)',explain:'바람에 기둥 꼭대기가 얼마나 움직이는지 참고로 보여 줍니다.'},
    '지주 반력 분배':{group:'info',name:'기둥 여러 개에 나눈 하중 (참고)',explain:'기둥이 여러 개일 때 한 기둥이 받는 몫을 보여 줍니다.'},
    '뚫림전단 · 축력 성분 추정':{group:'separate',name:'기둥받침이 기초판을 뚫는지',explain:'구조계산 의뢰 시 확인받을 항목입니다.'},
    '용접 · 앵커 측면파열·전단 콘크리트 파괴':{group:'separate',name:'용접과 앵커 주변 세부',explain:'기둥과 바닥판 용접, 앵커 주변 콘크리트의 세부 파괴는 구조계산 의뢰 시 확인받으세요.'},
    '목 P–M':{group:'separate',name:'기둥받침 콘크리트 세부',explain:'기둥받침(목) 콘크리트가 힘을 함께 받는 세부 검토는 구조계산 의뢰 시 확인받으세요.'},
    '침하 · 내진 · 현장 조건':{group:'separate',name:'침하·지진·현장 조건',explain:'땅의 가라앉음, 지진, 얼어붙는 깊이 같은 현장 조건은 구조계산 의뢰 시 확인받으세요.'}
  };
  const FALLBACK={group:'separate',explain:'구조계산 의뢰 시 확인받을 항목입니다.'};
  function item(label){const known=ITEMS[label]||FALLBACK;return {...known,name:known.name||label};}

  // Minimum-quantity and space checks: being close to the limit is economical, not a safety margin.
  const NO_TIGHT=new Set(['설정 최소 철근량 / 순간격','목 띠근 간격 / 주근비 초안','직선근 정착 공간','목 주근 정착 공간','앵커 최소 간격·연단거리','앵커 묻힘깊이 공간']);
  // Safety factors and minimum quantities are "larger is better": their utilisation is limit / actual.
  const inverted=label=>/안전율|최소/.test(label);
  function ratio(row){
    const {demand:d,capacity:c}=row;
    if(typeof d!=='number'||typeof c!=='number'||!Number.isFinite(d)||!Number.isFinite(c)||c<=0||d<0)return null;
    if(inverted(row.label))return d>0?c/d:null;
    return d/c;
  }
  function light(row){
    if(row.pass===false)return 'red';
    if(row.pass===true){const u=ratio(row);return u!==null&&u>TIGHT&&!NO_TIGHT.has(row.label)?'yellow':'green';}
    if(/입력 필요|앵커 없음|배치 오류/.test(row.status))return 'yellow';
    return 'gray';
  }

  // Inputs that are still example values or missing; shown as "확인 안 된 자료".
  function unconfirmed(r,notes={}){
    const p=r.p,list=[];
    if(!notes.groundKnown)list.push({topic:'땅(지반)',text:`땅이 버티는 값(허용지지력 ${p.qa} kPa)이 예시값입니다. 지반조사 결과로 바꿔야 합니다.`});
    if(r.l?.windDetail)list.push({topic:'바람(풍하중)',text:'지도에서 읽은 지역 기본풍속의 예비값입니다. 정확한 설치 위치·주변 지형을 의뢰 시 알려 주세요.'});
    else if(notes.windExample||!notes.windManual)list.push({topic:'바람(풍하중)',text:'풍압이 예시값입니다. 설치 지역을 고르거나 설계 풍압을 입력하세요.'});
    if(!(p.panelKgM2>0))list.push({topic:'전광판 무게',text:'전광판 제품 무게가 0입니다. 제조사 자료의 무게를 넣어야 결과가 맞습니다.'});
    if(!(p.postKg>0))list.push({topic:'기둥·프레임 무게',text:'기둥·프레임 무게가 0입니다. 구조물 계산 결과를 적용하거나 직접 넣으세요.'});
    if(p.columnShape==='schematic'||!(p.columnThickness>0))list.push({topic:'기둥 규격',text:'기둥 종류·두께가 없어 기둥·앵커·바닥판은 계산하지 않았습니다.'});
    else if(!(p.anchorEmbed>0))list.push({topic:'앵커 묻힘 깊이',text:'앵커 묻힘 깊이가 없어 앵커는 계산하지 않았습니다.'});
    return list;
  }

  // What to hand over with a structural calculation request.
  function requestChecklist(r,notes={}){
    const list=[
      '설치 주소(정확한 위치)와 주변 모습(건물·바다·언덕 등)',
      '지반조사 결과 또는 땅의 허용지지력 값',
      '전광판 제품 규격서(크기·무게·캐비닛 배열)',
      '구조물(철골 프레임) 도면 또는 이 계산기의 구조물 산출표',
      '기둥·앵커·바닥판 규격과 기초 도면(이 자료의 도면 초안 포함)'
    ];
    if(r.supports?.shared)list.push(`기둥·기초 배치: 전광판 1대를 기초 ${r.p.qty}개가 나눠 받침 (기초 중심 간격 ${r.p.foundationSpacing} mm)`);
    if(r.l?.windDetail||notes.windManual)list.push(`이 자료에 쓴 설계 풍압 ${Number(r.l.pressure).toFixed(2)} kPa와 그 근거`);
    return list;
  }

  function summarize(r,notes={}){
    const groups=GROUPS.map(g=>({...g,items:[],light:'gray'}));
    const byId=Object.fromEntries(groups.map(g=>[g.id,g])),separate=[],info=[];
    for(const row of r.checks){
      const it=item(row.label),entry={label:row.label,...it,light:light(row),ratio:ratio(row),status:row.status,pass:row.pass,detail:row.detail,demand:row.demand,capacity:row.capacity};
      if(it.group==='separate'||row.status==='별도 검토'&&it.group!=='steel')separate.push(entry);
      else if(it.group==='info')info.push(entry);
      else{const g=byId[it.group];g.items.push(entry);g.light=worse(g.light,entry.light);}
    }
    // A group whose rows were all not calculated stays gray; one red row makes it red.
    for(const g of groups){
      const red=g.items.filter(x=>x.light==='red');
      g.fixes=[...new Set(red.map(x=>x.fix).filter(Boolean))];
      g.worst=g.items.filter(x=>x.ratio!==null&&x.pass!==null).sort((a,b)=>b.ratio-a.ratio)[0]||null;
    }
    const missing=unconfirmed(r,notes);
    let overall=groups.reduce((a,g)=>worse(a,g.light),'gray');
    if(overall==='green'&&missing.length)overall='yellow';
    const headline=overall==='red'?'현재 조건으로는 부족한 항목이 있습니다':overall==='yellow'?(missing.length&&groups.every(g=>g.light!=='yellow')?'계산상 여유는 있지만 확인 안 된 자료가 있습니다':'여유가 적거나 확인할 항목이 있습니다'):overall==='green'?'계산상 여유가 있습니다':'이 조건으로는 계산하지 않았습니다';
    return {groups,separate,info,unconfirmed:missing,overall,headline,checklist:requestChecklist(r,notes)};
  }

  const GLOSSARY=[
    ['풍하중','바람이 전광판을 미는 힘입니다. 지역, 높이, 주변 지형에 따라 커지거나 작아집니다.'],
    ['풍압','전광판 1 m²가 받는 바람의 힘(kPa)입니다. 풍압 × 화면 면적 = 풍하중입니다.'],
    ['기본풍속','국가 기준 지도에 정해진 지역별 바람 세기입니다. 바닷가·섬일수록 큽니다.'],
    ['기초(푸팅)','땅속에 묻는 콘크리트 판입니다. 전광판의 무게와 바람의 힘을 땅에 전달합니다.'],
    ['기둥받침(목)','기초판 위로 올라온 콘크리트 기둥 부분입니다. 강재 기둥을 앵커로 고정하는 곳입니다.'],
    ['전도','바람에 기초째 넘어가는 것입니다.'],
    ['활동','바람에 기초가 옆으로 미끄러지는 것입니다.'],
    ['전면 접지','기초 바닥 전체가 땅에 닿아 있는 상태입니다. 한쪽이 들리면 기울 수 있습니다.'],
    ['지지력','땅이 무게를 버티는 힘입니다. 허용지지력(kPa)은 지반조사로 정합니다.'],
    ['지반조사','땅을 뚫어 흙의 종류와 단단함을 확인하는 조사입니다. 결과로 허용지지력을 정합니다.'],
    ['안전율','버틸 수 있는 힘을 실제 힘으로 나눈 값입니다. 클수록 안전하며 보통 1.5 이상을 목표로 합니다.'],
    ['사용률','실제 힘을 버틸 수 있는 힘으로 나눈 값입니다. 1을 넘으면 부족하고, 0.8을 넘으면 여유가 적습니다.'],
    ['강재 기둥(지주)','전광판을 받치는 철 기둥입니다. 원형 강관, 각형 강관, H형강 등이 있습니다.'],
    ['앵커볼트','강재 기둥을 콘크리트에 고정하는 굵은 볼트입니다. 콘크리트 속에 묻습니다.'],
    ['베이스플레이트','기둥 아래에 붙이는 두꺼운 철판(바닥판)입니다. 앵커볼트로 기초에 고정합니다.'],
    ['그라우트','바닥판과 콘크리트 사이 틈을 채우는 무수축 몰탈입니다.'],
    ['철근 정착','철근이 콘크리트에서 빠지지 않도록 충분한 길이를 묻는 것입니다.'],
    ['반력 분배','기둥이 여러 개일 때 전광판의 무게와 바람의 힘을 기둥마다 나누는 것입니다.'],
    ['부력','지하수 속 기초가 물에 떠오르려는 힘입니다. 기초가 누르는 무게를 줄입니다.'],
    ['구조기술사','건축 구조의 안전을 검토하고 확인하는 국가 자격 전문가입니다.']
  ];

  const TERMS={stability:['전도','활동','전면 접지','안전율'],ground:['지지력','지반조사'],concrete:['기초(푸팅)','기둥받침(목)','철근 정착'],steel:['강재 기둥(지주)','앵커볼트','베이스플레이트']};
  const define=term=>(GLOSSARY.find(([t])=>t===term)||[])[1]||'';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const percent=u=>Math.round(u*100)+'%';
  function bar(entry){
    if(entry.ratio===null||entry.pass===null)return '';
    return `<span class="plain-use" title="사용률 ${percent(entry.ratio)} · 100%를 넘으면 부족"><span class="plain-bar"><i style="width:${Math.min(100,entry.ratio*100).toFixed(0)}%"></i></span>사용 ${percent(entry.ratio)}</span>`;
  }
  const row=x=>`<li class="plain-item plain-${x.light}"><span class="plain-dot" aria-hidden="true">${LIGHTS[x.light].icon}</span><span><b>${esc(x.name)}</b> <span class="plain-word">${LIGHTS[x.light].word}</span>${bar(x)}<small>${esc(x.explain)}</small></span></li>`;
  const term=t=>`<button type="button" class="plain-term" data-term="${esc(t)}" aria-expanded="false">${esc(t)} <span aria-hidden="true">?</span></button>`;
  function card(g){
    const L=LIGHTS[g.light],flagged=g.items.filter(x=>x.light==='red'||x.light==='yellow'),rest=g.items.filter(x=>!flagged.includes(x));
    return `<article class="plain-card plain-${g.light}" data-group="${g.id}"><header><span class="plain-dot" aria-hidden="true">${L.icon}</span><h3>${esc(g.question)}</h3><em>${L.word}</em></header><p>${esc(g.about)}</p>`
      +(flagged.length?`<ul class="plain-items">${flagged.map(row).join('')}</ul>`:'')
      +(g.fixes.length?`<p class="plain-fix"><b>해 볼 일</b> ${g.fixes.map(esc).join(' ')}</p>`:'')
      +(rest.length?`<details class="plain-more"><summary>${flagged.length?'나머지':'세부'} 항목 ${rest.length}개 보기</summary><ul class="plain-items">${rest.map(row).join('')}</ul></details>`:'')
      +`<div class="plain-terms">${TERMS[g.id].map(term).join('')}</div></article>`;
  }
  // Office-staff summary block. The same markup is used on screen and in the printed reference.
  function cardsHTML(s,{print=false}={}){
    const L=LIGHTS[s.overall];
    // The printed reference shows the disclaimer and the overall light on its cover instead.
    return `<div class="plain${print?' plain-print':''}">`
      +(print?'':`<p class="plain-disclaimer"><b>참고용</b> ${esc(DISCLAIMER)}</p><div class="plain-overall plain-${s.overall}"><span class="plain-dot" aria-hidden="true">${L.icon}</span><div><b>${L.word} · ${esc(s.headline)}</b><small>${esc(L.tone)}</small></div></div>`)
      +`<div class="plain-groups">${s.groups.map(card).join('')}</div>`
      +(s.unconfirmed.length?`<section class="plain-box"><h3>확인 안 된 자료 ${s.unconfirmed.length}개</h3><ul>${s.unconfirmed.map(x=>`<li><b>${esc(x.topic)}</b> ${esc(x.text)}</li>`).join('')}</ul></section>`:'')
      +(s.separate.length?`<section class="plain-box"><h3>구조계산 의뢰 시 확인받을 항목</h3><ul>${s.separate.map(x=>`<li><b>${esc(x.name)}</b> ${esc(x.explain)}</li>`).join('')}</ul></section>`:'')
      +(print?'':`<details class="plain-glossary"><summary>용어 풀이 ${GLOSSARY.length}개</summary><dl>${GLOSSARY.map(([t,d])=>`<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></details>`)
      +`</div>`;
  }
  const CSS=`.plain{display:grid;gap:12px;margin:12px 0;color:#1d2733;font-size:14px;line-height:1.55}
.plain-disclaimer{margin:0;padding:9px 12px;border-radius:8px;background:#fff8e6;border:1px solid #e3c98a;font-size:13px}.plain-disclaimer b{margin-right:6px;color:#8a5a00}
.plain-overall{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:10px;border:1px solid #d3dae2;background:#f6f8fa}.plain-overall b{display:block;font-size:16px}.plain-overall small{display:block;color:#5f6b78;font-size:13px}
.plain-dot{font-size:18px;line-height:1.3}.plain-groups{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.plain-card{border:1px solid #d3dae2;border-left-width:5px;border-radius:10px;padding:10px 12px;background:#fff}.plain-card header{display:flex;gap:8px;align-items:flex-start}.plain-card h3{flex:1;margin:0;font-size:15px}.plain-card em{font-style:normal;font-weight:700;white-space:nowrap}.plain-card>p{margin:6px 0;color:#4b5866;font-size:13px}
.plain-green{border-left-color:#2e9d5b}.plain-green em,.plain-item.plain-green .plain-word{color:#1f7a4d}.plain-yellow{border-left-color:#e0a100}.plain-yellow em,.plain-item.plain-yellow .plain-word{color:#8a5a00}.plain-red{border-left-color:#d64535}.plain-red em,.plain-item.plain-red .plain-word{color:#b42318}.plain-gray{border-left-color:#9aa5b1}.plain-gray em{color:#5f6b78}
.plain-items{list-style:none;margin:6px 0;padding:0;display:grid;gap:6px}.plain-item{display:flex;gap:6px;align-items:flex-start}.plain-item .plain-dot{font-size:13px}.plain-item small{display:block;color:#5f6b78;font-size:12.5px}.plain-word{font-weight:700;font-size:12.5px;margin-left:4px}
.plain-use{display:inline-flex;gap:6px;align-items:center;margin-left:8px;color:#4b5866;font-size:12px;white-space:nowrap}.plain-bar{display:inline-block;width:64px;height:7px;border-radius:4px;background:#e4e8ec;overflow:hidden}.plain-bar i{display:block;height:100%;background:#5b7f95}.plain-red .plain-bar i{background:#d64535}.plain-yellow .plain-bar i{background:#e0a100}
.plain-fix{margin:6px 0;padding:6px 8px;border-radius:6px;background:#fdf0ee;font-size:13px}.plain-fix b{margin-right:6px}.plain-more summary,.plain-glossary summary{cursor:pointer;color:#2c5d78;font-size:13px}
.plain-terms{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.plain-term{font:inherit;font-size:12px;padding:3px 8px;min-height:28px;border:1px solid #b8c6d1;border-radius:999px;background:#f2f6f9;color:#24485e;cursor:pointer}.plain-term span{font-weight:700}.plain-term[aria-expanded=true]{background:#24485e;color:#fff}
.plain-definition{flex-basis:100%;margin:2px 0 0;padding:7px 9px;border-radius:6px;background:#eef4f8;font-size:13px}
.plain-box{padding:10px 12px;border:1px solid #d3dae2;border-radius:10px;background:#fbfcfd}.plain-box h3{margin:0 0 4px;font-size:14px}.plain-box ul{margin:0;padding-left:18px;font-size:13px}.plain-box li{margin:3px 0}.plain-box li b{margin-right:6px}
.plain-glossary dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:8px 0 0;font-size:13px}.plain-glossary dt{font-weight:700}.plain-glossary dd{margin:0;color:#4b5866}
.plain-print .plain-terms,.plain-print .plain-more summary{display:none}.plain-print .plain-more>ul{display:grid}
@media(max-width:520px){.plain-glossary dl{grid-template-columns:1fr}.plain-glossary dd{margin-bottom:6px}.plain-use{margin-left:0}}
@media print{.plain-terms{display:none}.plain-card{break-inside:avoid}}`;
  function ensureStyle(doc){
    if(!doc||doc.getElementById('plain-style'))return;
    const style=doc.createElement('style');style.id='plain-style';style.textContent=CSS;doc.head.append(style);
  }
  // (?) term buttons toggle a short definition right after the button's row.
  function bindTerms(doc){
    if(!doc||doc.plainTermsBound)return;doc.plainTermsBound=true;
    doc.addEventListener('click',event=>{
      const button=event.target.closest?.('.plain-term');if(!button)return;
      const box=button.parentElement,open=button.getAttribute('aria-expanded')==='true';
      box.querySelectorAll('.plain-term').forEach(b=>b.setAttribute('aria-expanded','false'));box.querySelector('.plain-definition')?.remove();
      if(open)return;
      const p=doc.createElement('p');p.className='plain-definition';p.setAttribute('role','note');p.textContent=`${button.dataset.term}: ${define(button.dataset.term)}`;
      box.append(p);button.setAttribute('aria-expanded','true');
    });
  }

  const api={DISCLAIMER,LIGHTS,GROUPS,ITEMS,GLOSSARY,TERMS,TIGHT,CSS,item,ratio,light,unconfirmed,requestChecklist,summarize,define,cardsHTML,ensureStyle,bindTerms};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationPlain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
