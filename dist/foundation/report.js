// Preliminary structural calculation report (A4, printable / save as PDF from the browser).
// build(result, context) returns a complete, self-contained HTML document.
(function(root){
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const Engine=node?require('./engine.js'):root.FoundationEngine;
  const Wind=node?require('./wind.js'):root.FoundationWind;
  const Steel=node?require('./steel.js'):root.FoundationSteel;
  const Plain=node?require('./plain.js'):root.FoundationPlain;

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function num(value,digits){
    if(value===null||value===undefined||value==='')return '—';
    if(typeof value!=='number')return esc(value);
    if(value===Infinity)return '∞';if(value===-Infinity)return '−∞';if(!Number.isFinite(value))return '—';
    const abs=Math.abs(value),d=digits??(abs>=1000?0:abs>=100?1:abs>=10?2:3);
    return value.toLocaleString('ko-KR',{maximumFractionDigits:d});
  }
  const mm=v=>num(v,0)+' mm';

  const STABILITY=['연직 유효하중','저면 전면 접지 (사용하중)','지반 지지력 (사용하중)','활동 안전율','전도 안전율 (두 축 합산)','저면 전면 접지 (계수하중)'];
  // Safety factors and minimum quantities are "larger is better"; their utilisation is capacity / demand.
  const inverted=label=>/안전율|최소/.test(label);
  function ratio(row){
    const {demand:d,capacity:c}=row;
    if(typeof d!=='number'||typeof c!=='number'||!Number.isFinite(d)||!Number.isFinite(c)||c<=0||d<0)return null;
    if(inverted(row.label))return d>0?c/d:null;
    return d/c;
  }
  const statusClass=status=>/^충족|참고 충족/.test(status)?'ok':/미충족|적용 범위 밖/.test(status)?'bad':'muted';
  function checkTable(rows){
    if(!rows.length)return '<p class="muted">해당 항목이 없습니다.</p>';
    return `<table class="checks"><thead><tr><th>검토 항목</th><th class="n">작용·요구</th><th class="n">저항·기준</th><th class="n">사용률</th><th>판정</th></tr></thead><tbody>${rows.map(row=>{
      const u=ratio(row),precondition=row.pass===false&&u!==null&&u<=1?' · 사용률은 1 이하이지만 적용 전제(전면 접지 등)를 충족하지 못해 미충족':'';
      return `<tr class="${statusClass(row.status)}"><td><b>${esc(row.label)}</b><div class="detail">${esc(row.detail+precondition)}</div></td><td class="n">${num(row.demand)}</td><td class="n">${num(row.capacity)}</td><td class="n">${u===null?'—':num(u,2)}</td><td class="status">${esc(row.status)}</td></tr>`;
    }).join('')}</tbody></table>`;
  }
  const kv=pairs=>`<table class="kv"><tbody>${pairs.filter(Boolean).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
  const section=(no,title,body)=>body?`<section><h2><span>${no}</span>${esc(title)}</h2>${body}</section>`:'';

  function columnLabel(p){
    if(p.columnShape==='schematic')return '미입력 (개략 표시)';
    const s=Steel.section(p);
    return s.missing?`${p.columnShape==='circle'?'원형 강관 Ø'+p.columnDiameter:p.columnShape==='h'?'H형강 '+p.columnDepth+'×'+p.columnWidth:'각형 강관 □'+p.columnWidth+'×'+p.columnDepth} · 두께 미입력`:s.label;
  }

  function governing(rows){
    let best=null;
    for(const row of rows){if(row.pass===null)continue;const u=ratio(row);if(u!==null&&(!best||u>best.u))best={row,u};}
    return best;
  }

  function windSection(r,ctx){
    const {p,l,g}=r,d=l.windDetail;let rows;
    if(d){
      const e=Wind.exposures[d.exposure];
      rows=[
        ['산정 방식','지역 기본풍속 지도 (예비값)'],
        ['기준 지점',esc(ctx.windPointName||'직접 입력한 기본풍속')+` · V₀ = ${num(d.basicWind)} m/s`],
        ['출처',esc(`${d.source.title} (${d.source.year}) ${d.source.figure}`)],
        ['지표면조도',esc(`${d.exposure} · ${e?.label||''}`)],
        ['기준 높이 z',`${num(d.height)} m (화면 상단)`],
        ['풍속고도분포계수 Kzr',num(d.kzr,3)],['지형계수 Kzt',num(d.topography,2)],['중요도계수 Iw',num(d.importance,2)],['풍향계수 KD',num(d.direction,2)],
        ['설계풍속 V = V₀·KD·Kzr·Kzt·Iw',`${num(d.velocity,2)} m/s`],
        ['속도압 q = ½ρV² (ρ = 1.225 kg/m³)',`${num(d.q,3)} kPa`],
        ['풍력계수 Cf · 가스트영향계수 G',`${num(p.cf,2)} · ${num(p.gust,2)}`],
        ['설계 풍압 p = q·Cf·G',`<b>${num(l.pressure,3)} kPa</b>`]
      ];
    }else if(p.windMode==='velocity'){
      rows=[['산정 방식','풍속 직접 입력'],['설계풍속 V',`${num(p.velocity)} m/s`],['풍력계수 Cf · 가스트영향계수 G',`${num(p.cf,2)} · ${num(p.gust,2)}`],['설계 풍압 p = ½·1.225·V²·Cf·G',`<b>${num(l.pressure,3)} kPa</b>`]];
    }else rows=[['산정 방식','설계 풍압 직접 입력'],['설계 풍압 p',`<b>${num(l.pressure,3)} kPa</b>`]];
    const loads=[
      ['정면 수압면적 A = B×H',`${num(l.area,3)} m²`],
      ['정면 풍하중 F = A·p',`<b>${num(l.front,2)} kN</b>`],
      ['측면 풍압 (측면 입력 방식)',`${num(l.sidePressure,3)} kPa (${p.sideMode==='linked'?'정면 풍압과 같음':'직접 입력'})`],
      ['측면 수압면적 · 측면 풍하중',`${num(l.sideArea,3)} m² · ${num(l.side,2)} kN`],
      p.extraForce>0&&['추가 수평력 · 작용 높이',`${num(p.extraForce,2)} kN · GL+${num(p.extraForceZ,2)} m`],
      ['풍하중 작용 높이 (화면 중심)',`GL+${num(l.center,3)} m`],
      ['기초 저면까지 깊이',`${num(g.depth,3)} m`],
      ['상부 중량 (전광판 1대)',`${num(l.upper,2)} kN (제품 ${num(l.panelKg,1)} kg + 지주·프레임 ${num(p.postKg,1)} kg + 추가 ${num(p.extraKg,1)} kg)`]
    ];
    return `<p>정면 풍하중은 화면에 수직, 측면 풍하중은 화면과 나란히 작용하며 두 방향을 동시에 작용시키는 보수적 가정입니다.</p>${kv(rows)}<h3>풍하중 및 상부 하중</h3>${kv(loads)}`;
  }

  function distributionSection(r){
    const s=r.l.share;if(!s||s.n<2)return '';
    const rows=[
      ['지주 수 · 간격',`${s.n}개 · ${num(s.spacing*1000,0)} mm (전광판 가로 방향 한 줄)`],
      ['지주 1개의 몫',`정면풍·추가 수평력·상부 중량·전단 1/${s.n}`],
      ['짝힘 지렛대 xmax/Σx²',`${num(s.lever,4)} 1/m`],
      ['측면풍 모멘트 팔길이 (플레이트 위)',`${num(s.arm,3)} m`],
      ['바깥 지주 축력 짝힘 ±ΔN (사용)',`±${num(s.dNw+s.dNd,3)} kN = 측면풍 ${num(s.dNw,3)} + 중량 편심 eX ${num(s.dNd,3)}`],
      s.footings>1&&['기초 1개당 하중',`정면풍 ${num(s.footing.front,2)} kN · 측면풍 ${num(s.footing.side,2)} kN · 상부 중량 ${num(s.footing.upper,2)} kN · 짝힘 ±${num(s.dN,3)} kN`],
      s.footings>1&&['들림측 · 압축측 유효 연직하중',`${num(s.uplift.N,2)} kN · ${num(s.compression.N,2)} kN`]
    ];
    return `<p>지주 상부를 전광판 프레임이 강하게 묶는다고 보고, 측면풍 모멘트와 중량 편심은 바깥 지주의 축력 짝힘 ±ΔN = M·xmax/Σx²로 받습니다. 지주 휨은 지주별 몫을 캔틸레버로 함께 적용해 보수적입니다.${s.footings>1?' 기초는 들림측과 압축측 중 불리한 값으로 판정합니다.':' 복합 통기초의 푸팅은 전체 하중으로 수량만 산출합니다.'}</p>${kv(rows)}`;
  }

  function rebarSection(r){
    const b=r.r;if(!b||!b.rows)return '';
    const summary=kv([
      ['푸팅 철근',`D${b.code} @${num(b.s,0)} · X방향 ${b.x.n}본 (실제 @${num(b.x.actual,1)}) · Y방향 ${b.y.n}본 (실제 @${num(b.y.actual,1)}) · 상·하부 같은 격자`],
      ['철근량 As (X · Y)',`${num(b.asX,1)} · ${num(b.asY,1)} mm²/m (설정 최소 ${num(b.minAs,1)} mm²/m)`],
      ['설계 휨모멘트 (X · Y)',`${num(b.mx,2)} · ${num(b.my,2)} kN·m/m (최대 계수반력 균등분포 캔틸레버)`],
      b.neck&&['목 철근',`주근 D${b.neck.bar} ${b.neck.longN}본 (${b.neck.nx}×${b.neck.ny}) · 띠철근 D${b.neck.tieBar} ${b.neck.ties.n}단 @${num(b.neck.ties.actual,1)} · 주근비 ${num(b.neck.rho*100,2)}%`],
      ['철근 물량',`순 ${num(b.net,1)} kg · 할증 포함 ${num(b.gross,1)} kg (기초 1개)`]
    ]);
    const table=`<table class="list"><thead><tr><th>기호</th><th>부위</th><th>규격</th><th class="n">본수</th><th class="n">전개 길이(mm)</th><th class="n">중량(kg)</th></tr></thead><tbody>${b.rows.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}<div class="detail">${esc(x.note)}</div></td><td>D${x.bar}</td><td class="n">${num(x.count,0)}</td><td class="n">${num(x.length,0)}</td><td class="n">${num(x.kg,1)}</td></tr>`).join('')}</tbody></table>`;
    return summary+table;
  }

  function steelInputs(r){
    const p=r.p,c=r.connection,auto=p.connectionMode==='auto'&&c?.found;
    return kv([
      ['기둥 단면 · 강도',`${esc(columnLabel(p))} · Fy ${num(p.columnFy,0)} MPa`],
      ['베이스플레이트',p.plateShape==='circle'?`원형 Ø${num(p.plateDiameter,0)} · t ${num(p.plateThickness,0)} mm · ${esc(p.plateGrade)}`:`${num(p.plateL,0)} × ${num(p.plateW,0)} × ${num(p.plateThickness,0)} mm · ${esc(p.plateGrade)}`],
      ['앵커',`M${p.anchorDiameter} × ${p.anchorCount}개 · 연단 ${num(p.anchorEdge,0)} mm · 묻힘 hef ${num(p.anchorEmbed,0)} mm · ${p.anchorHead==='hooked'?'갈고리':'머리·너트'} · Fy ${num(p.anchorFy,0)} / Fu ${num(p.anchorFu,0)} MPa · 그라우트 ${num(p.groutThickness,0)} mm`],
      ['산정 방식',auto?`자동 산정 (강재 ${num(c.mass,1)} kg${c.neckGrown?` · 목 ${c.from.cL}×${c.from.cW} → ${p.cL}×${p.cW} mm 확대`:''})`:'직접 입력 후 검토']
    ]);
  }

  function quantitySection(r){
    const a=r.estimate?.a,rows=[...r.boq];
    if(a){
      if(a.plate)rows.push({name:a.plate.name,unit:'kg',value:a.plate.kg/Math.max(1,r.p.qty),total:a.plate.kg,formula:a.plate.formula||''});
      if(a.anchors)rows.push({name:`앵커 M${r.p.anchorDiameter}`,unit:'조',value:a.anchors/Math.max(1,r.p.qty),total:a.anchors,formula:'볼트·너트·와셔 1조'});
      if(a.groutBags)rows.push({name:'무수축 몰탈 (25kg)',unit:'포',value:null,total:a.groutBags,formula:'그라우트 체적 기준 올림'});
    }
    return `<table class="list"><thead><tr><th>공종</th><th>단위</th><th class="n">기초 1개</th><th class="n">전체</th><th>산출 근거</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.unit)}</td><td class="n">${num(x.value)}</td><td class="n">${num(x.total)}</td><td class="detail">${esc(x.formula)}</td></tr>`).join('')}</tbody></table>`;
  }

  // Frame summary from the planner project/result (integrated suite only).
  function frameSection(frame){
    if(!frame?.result)return '';
    const {project,result:f}=frame,g=f.general,groups=new Map();
    for(const row of f.rows){const key=row.materialLabel;const x=groups.get(key)||{name:key,pieces:0,length:0,weight:0};x.pieces+=row.count;x.length+=row.totalLength;x.weight+=row.weight;groups.set(key,x);}
    const posts=f.posts;
    return kv([
      ['프로젝트',esc(project?.name||'')],
      ['크기 · 구성',`${num(g.width,0)} × ${num(g.height,0)} mm${g.planes===2?` × 깊이 ${num(g.depth,0)} mm (앞뒤 + 좌우 측면)`:' (단면 프레임)'} · 제작 ${g.quantity}대`],
      ['완성 총중량',`<b>${num(f.totalWeight,2)} kg</b> (프레임 ${num(f.frameWeight,2)} · 판재·부속 ${num(f.accessoryWeight,2)} · 캐비닛·장비 ${num(f.equipmentWeight,2)} kg)`],
      posts&&['기초 지주',`${esc(posts.material.name)} · 대당 ${posts.count}개 · 길이 ${num(posts.length,0)} mm`],
      ['부재 수 · 총길이',`${num(f.totalPieces,0)}개 · ${num(f.totalLength,2)} m`]
    ])+`<table class="list"><thead><tr><th>자재</th><th class="n">부재 수</th><th class="n">총길이(m)</th><th class="n">중량(kg)</th></tr></thead><tbody>${[...groups.values()].map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${num(x.pieces,0)}</td><td class="n">${num(x.length,2)}</td><td class="n">${num(x.weight,2)}</td></tr>`).join('')}</tbody></table><p class="muted">구조물 계산기는 부재 물량·중량을 산출합니다. 프레임 부재와 접합부의 구조 안전성은 이 계산서의 검토 범위가 아닙니다.</p>`;
  }

  function build(r,ctx={}){
    if(!r)throw Error('계산 결과가 없습니다.');
    const {p,g,l,checks}=r,type=Engine.types[p.type],screen=Engine.canScreen(p),steelScreen=Engine.canScreenSteel(p);
    const date=ctx.date||new Date().toLocaleDateString('ko-KR');
    const stability=checks.filter(c=>STABILITY.includes(c.label));
    const separate=checks.filter(c=>c.status==='별도 검토'||/^미검토/.test(c.status)||c.pass===null&&c.status==='적용 범위 밖');
    const sectionRows=checks.filter(c=>c.group!=='steel'&&!STABILITY.includes(c.label)&&!separate.includes(c));
    const steel=checks.filter(c=>c.group==='steel'&&c.label!=='지주 반력 분배'&&!separate.includes(c));
    const judged=checks.filter(c=>c.pass!==null),fails=judged.filter(c=>c.pass===false),gov=governing(judged);
    const verdict=!screen&&!steelScreen?'구조 미검토 · 수량 초안':!screen?(fails.length?`지주·앵커 ${fails.length}개 미충족 · 푸팅 구조 미검토`:'지주·앵커 예비 검토 충족 · 푸팅 구조 미검토'):r.search&&!r.search.found?'자동 후보 없음 · 수동 치수':fails.length?`계산 항목 ${fails.length}개 미충족`:'계산 항목 충족 · 상세 검토 필요';
    const notes=ctx.notes||{};

    const overview=kv([
      ['계산 대상',`${esc(type.label)} · 전광판 ${r.supports.boards}대 · 기초 ${p.qty}개 · 기둥 ${r.supports.known?r.supports.total+'본':'미지정'}${r.supports.shared?' (전광판 1대를 여러 기초가 받침)':''}`],
      ['적용 기준·방식',[
        '풍하중: KDS 41 12 00(2022) 기본풍속 지도 판독 예비값 또는 입력값, p = ½ρV²·Cf·G',
        '기초 안정: 사용하중의 유효 연직하중·전면 접지·지지력·활동·전도 예비 지표',
        '푸팅 단면: 철근콘크리트 강도설계 단순식 (φ휨 '+num(p.phiFlex,2)+', φ전단 '+num(p.phiShear,2)+')',
        '강재 지주: KDS 41 31 00 / AISC 360 방식 · 앵커: KDS 14 20 54 / ACI 318 17장 방식 · 베이스플레이트: AISC Design Guide 1 방식'
      ].map(esc).join('<br>')],
      ['하중조합',[
        `기초 안정(사용하중): ${num(p.stabilize,2)}D + W (안정용 자중계수)`,
        `강도 검토: ${num(p.deadFactor,2)}D + ${num(p.windFactor,2)}W`,
        `앵커 들림: ${num(p.stabilize,2)}D + ${num(p.windFactor,2)}W`
      ].map(esc).join('<br>')],
      ['자료 확인 상태',`지반자료 ${notes.groundKnown?'사용자 입력':'미확인 · 예비값'} · 풍하중 ${l.windDetail?'지도 기준점 예비값':notes.windManual?'사용자 직접 입력':'예시값 또는 미확인'}`]
    ]);

    const conditions=kv([
      ['전광판 크기',`가로 ${mm(p.signW)} × 세로 ${mm(p.signH)} · 두께 ${mm(p.signDepth)} · 하단 높이 GL+${num(p.bottom,2)} m`],
      ['중량',`제품 ${num(p.panelKgM2,1)} kg/m² · 지주·프레임 ${num(p.postKg,1)} kg · 추가 ${num(p.extraKg,1)} kg (전광판 1대)`],
      ['기초 치수',`푸팅 ${mm(g.L)} × ${mm(g.W)} × ${mm(g.H)}${g.neck?` · 목 ${mm(g.cL)} × ${mm(g.cW)} × 높이 ${mm(g.cH)} (지상 노출 ${mm(g.above)})`:''}${p.type==='combined'?` · 지주 간격 ${mm(p.postSpacing)}`:''}${r.supports.shared?` · 기초 중심 간격 ${mm(p.foundationSpacing)}`:''}`],
      ['치수 결정',r.search?.found?`자동 탐색 (100 mm 격자 · 후보 ${r.search.count}개 평가)`:r.search?'자동 탐색 실패 · 수동 치수 표시':'수동 입력'],
      ['지반',`허용지지력 qa ${num(p.qa,0)} kPa · 마찰계수 μ ${num(p.mu,2)} · 지하수위 GL−${num(p.waterDepth,2)} m`],
      ['콘크리트 · 철근',`fck ${num(p.fck,0)} MPa · 단위중량 ${num(p.gammaC,1)} kN/m³ · fy ${num(p.fy,0)} MPa · 피복 ${mm(p.cover)}`],
      ['편심',`eX ${num(p.eccX,2)} m · eY ${num(p.eccY,2)} m (상부 중량 작용점)`],
      ['목표 안전율',num(p.fsTarget,2)]
    ]);

    const drawings=(r.drawingParts||[]).slice(0,3).map(([title,svg])=>`<figure><figcaption>${esc(title)}</figcaption><div class="drawing">${svg}</div></figure>`).join('');
    const warnings=(r.warnings||[]).map(w=>`<li>${esc(w)}</li>`).join('');

    // Part 1: plain-language summary for office staff. Part 2: the engineering appendix.
    const plain=Plain.summarize(r,notes),light=Plain.LIGHTS[plain.overall];
    const basics=kv([
      ['전광판',`가로 ${num(p.signW/1000,3)} m × 세로 ${num(p.signH/1000,3)} m · 땅에서 화면 아래까지 ${num(p.bottom,2)} m · 전광판 ${r.supports.boards}대`],
      ['무게',`제품 ${num(l.panelKg,0)} kg + 기둥·프레임 ${num(p.postKg,0)} kg + 기타 ${num(p.extraKg,0)} kg (전광판 1대)`],
      ['바람',`설계 풍압 ${num(l.pressure,2)} kPa · 전광판 1대가 받는 바람의 힘 약 ${num(l.front,1)} kN (약 ${num(Math.round(l.front/9.80665*100)*10,0)} kg 무게로 미는 정도)`],
      ['기초',`${esc(type.label)} ${p.qty}개 · 1개 크기 가로 ${num(g.L/1000,2)} × 세로 ${num(g.W/1000,2)} × 두께 ${num(g.H/1000,2)} m${r.supports.shared?` · 기초 중심 간격 ${num(p.foundationSpacing/1000,2)} m`:''}`],
      ['기둥',`${esc(columnLabel(p))}${r.supports.known?` · 전체 ${r.supports.total}본`:''}`],
      ['물량 (전체)',`콘크리트 주문 약 ${num(r.total.orderedConcrete,1)} m³ · 철근 약 ${num(r.total.rebarGross,0)} kg · 땅파기 약 ${num(r.total.excavation,1)} m³`]
    ]);
    const part1=[
      section('1','한눈에 보기',basics+Plain.cardsHTML(plain,{print:true})),
      section('2','구조계산 의뢰 시 함께 보낼 것',`<ul class="checklist">${plain.checklist.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="muted">이 자료는 의뢰 전 크기를 가늠하는 참고용입니다. 최종 기초 크기와 철근은 구조계산 결과로 정합니다.</p>`),
      section('3','용어 풀이',`<table class="kv"><tbody>${Plain.GLOSSARY.map(([t,d])=>`<tr><th>${esc(t)}</th><td>${esc(d)}</td></tr>`).join('')}</tbody></table>`)
    ].join('');
    let n=0;const A=()=>'A'+(++n);
    const part2=[
      section(A(),'개요 및 적용 기준',overview),
      section(A(),'설계 조건',conditions),
      section(A(),'풍하중 산정',windSection(r,ctx)),
      r.l.share&&r.l.share.n>1?section(A(),'지주 반력 분배',distributionSection(r)):'',
      section(A(),'기초 안정 검토',screen?`<p>유효 연직하중 N = ${num(p.stabilize,2)} × (콘크리트 ${num(r.q.concrete,3)} m³ × ${num(p.gammaC,1)} kN/m³ + 상부 중량${r.l.share?.footings>1?' 몫':''}) − 부력 ${num(r.q.buoyancy,2)} kN${r.l.share?.footings>1?' ∓ 짝힘':''}. 모멘트는 기초 저면 기준입니다.</p>`+checkTable(stability):'<p class="muted">이 형식은 기초 안정 판정을 하지 않습니다(수량·배근 초안).</p>'),
      section(A(),'푸팅 단면 검토 및 배근',(screen?checkTable(sectionRows):'<p class="muted">이 형식은 푸팅 단면 판정을 하지 않습니다. 아래 배근은 설정 철근비에 따른 초안입니다.</p>')+rebarSection(r)),
      section(A(),'지주 · 앵커 · 베이스플레이트',steelInputs(r)+(steelScreen?checkTable(steel):'<p class="muted">이 형식은 지주·앵커를 판정하지 않습니다.</p>')),
      section(A(),'별도 검토 항목',`<p>아래 항목은 이 자료에서 판정하지 않습니다. 구조계산 의뢰 시 확인받아야 합니다.</p><table class="list"><thead><tr><th>항목</th><th>상태</th><th>내용</th></tr></thead><tbody>${separate.map(c=>`<tr><td>${esc(c.label)}</td><td>${esc(c.status)}</td><td class="detail">${esc(c.detail)}</td></tr>`).join('')}</tbody></table>`),
      section(A(),'물량 (참고)',quantitySection(r)),
      drawings?section(A(),'도면 (배근 초안)',drawings):'',
      ctx.frame?section(A(),'구조물(프레임) 산출 요약',frameSection(ctx.frame)):'',
      section(A(),'유의사항',`<ul class="warnings">${warnings}</ul>`)
    ].join('');

    const title=`${ctx.projectName||'전광판 기초'} · 구조계산 의뢰 전 사전 검토 자료`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}${Plain.CSS}</style></head><body>
<div class="toolbar"><button type="button" onclick="window.print()">인쇄 / PDF 저장</button><span>인쇄 창에서 대상을 「PDF로 저장」으로 고르면 PDF 파일이 됩니다. A4 세로 기준입니다.</span></div>
<main>
<header class="cover"><p class="kicker">전광판 구조물 · 기초 통합 계산기 · 참고용</p><h1>구조계산 의뢰 전 사전 검토 자료</h1>
${kv([['프로젝트',esc(ctx.projectName||'—')],['기초 항목',esc(ctx.itemName||'—')],['작성일',esc(date)],['계산기',esc(ctx.buildLabel||'')]])}
<div class="verdict ${plain.overall==='green'?'ok':plain.overall==='red'?'bad':'muted'}"><b>${light.icon} ${light.word} · ${esc(plain.headline)}</b><span>${esc(light.tone)}</span></div>
<p class="disclaimer">${esc(Plain.DISCLAIMER)}</p>
</header>
<div class="part"><p class="part-title">1부 · 사무용 요약</p>${part1}</div>
<div class="part appendix"><p class="part-title">2부 · 설계자용 상세 (부록)</p><p class="muted">${esc(verdict)}${gov?` · 최대 사용률 ${num(gov.u,2)} (${esc(gov.row.label)})`:''} · 판정 ${judged.length}개 중 충족 ${judged.length-fails.length}, 미충족 ${fails.length} · 별도 검토 ${separate.length}</p>${part2}</div>
<footer>${esc(title)} · ${esc(date)} · ${esc(ctx.buildLabel||'')}</footer>
</main></body></html>`;
  }

  const CSS=`
:root{--ink:#1d2733;--muted:#5f6b78;--line:#cfd6de;--ok:#1f7a4d;--bad:#b42318;--head:#eef2f6}
*{box-sizing:border-box}html{background:#e9edf1}body{margin:0;font:13px/1.55 "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;color:var(--ink)}
.toolbar{position:sticky;top:0;z-index:2;display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 16px;background:#1d3b4f;color:#e8f1f6;font-size:13px}
.toolbar button{font:inherit;font-weight:700;padding:8px 16px;border:0;border-radius:6px;background:#dbf4eb;color:#12534b;cursor:pointer}
main{max-width:210mm;margin:16px auto;padding:16mm 14mm;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.12)}
.cover .kicker{margin:0;color:var(--muted);font-size:12px}h1{margin:2px 0 10px;font-size:24px}
h2{display:flex;gap:8px;align-items:baseline;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid var(--ink);font-size:16px}h2 span{min-width:22px}
h3{margin:12px 0 6px;font-size:13.5px}p{margin:6px 0}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:12px}th,td{border:1px solid var(--line);padding:4px 6px;vertical-align:top;text-align:left}
thead th{background:var(--head);font-weight:700}table.kv th{width:30%;background:var(--head);font-weight:600}
.n{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.detail{color:var(--muted);font-size:11px;margin-top:2px}
.checks td.status{white-space:nowrap;font-weight:700}.checks tr.ok td.status{color:var(--ok)}.checks tr.bad td.status{color:var(--bad)}.checks tr.bad{background:#fff4f3}.checks tr.muted td.status{color:var(--muted)}
.verdict{display:flex;flex-direction:column;gap:2px;margin:10px 0;padding:10px 12px;border-left:5px solid var(--muted);background:#f4f6f8}.verdict b{font-size:15px}.verdict span{color:var(--muted);font-size:12px}
.verdict.ok{border-color:var(--ok)}.verdict.ok b{color:var(--ok)}.verdict.bad{border-color:var(--bad)}.verdict.bad b{color:var(--bad)}
.disclaimer{padding:8px 10px;border:1px solid #e3c98a;background:#fff8e6;font-size:12px}.muted{color:var(--muted)}
figure{margin:8px 0 14px;break-inside:avoid}figcaption{font-weight:700;margin-bottom:4px}.drawing svg{width:100%;height:auto;max-height:120mm;border:1px solid var(--line)}
ul.warnings{padding-left:18px;font-size:12px}ul.warnings li{margin:3px 0}
footer{margin-top:18px;padding-top:6px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
@page{size:A4 portrait;margin:14mm 12mm}
.part-title{margin:26px 0 0;padding:6px 10px;background:#1d3b4f;color:#fff;font-weight:700;font-size:14px;border-radius:4px}ul.checklist{padding-left:20px}ul.checklist li{margin:4px 0}
@media print{.appendix{break-before:page}}
@media print{html{background:#fff}.toolbar{display:none}main{max-width:none;margin:0;padding:0;box-shadow:none}section{break-inside:auto}h2,h3{break-after:avoid}tr{break-inside:avoid}}
@media(max-width:640px){main{margin:0;padding:16px}table.kv th{width:38%}}`;

  const api={build,ratio};
  if(node)module.exports=api;else root.FoundationReport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
