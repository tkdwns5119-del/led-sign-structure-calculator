(function(root){
  'use strict';
  // Shared report model: the offline exporter and the workbook design builder
  // use identical cells, formulas, units and print ranges.
  const col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
  const cell=(v,style='text',formula)=>({v:v??'',style,...(formula?{formula}:{})});
  const formula=(f,v,style='num3')=>cell(v,style,f);
  const number=v=>Number.isFinite(v)?v:v===Infinity?'∞':v===-Infinity?'−∞':'—';
  const styles={
    text:{font:{name:'Malgun Gothic',size:10,color:'#243B53'},verticalAlignment:'center',wrapText:true},
    title:{font:{name:'Malgun Gothic',size:16,bold:true,color:'#102139'},verticalAlignment:'center',borders:{bottom:{style:'thin',color:'#0F766E'}}},
    subtitle:{font:{name:'Malgun Gothic',size:10,color:'#64748B'},verticalAlignment:'center',wrapText:true},
    section:{fill:'#E6F3F0',font:{name:'Malgun Gothic',size:11,bold:true,color:'#115E59'},verticalAlignment:'center'},
    head:{fill:'#153D49',font:{name:'Malgun Gothic',size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true},
    note:{font:{name:'Malgun Gothic',size:10,color:'#64748B'},verticalAlignment:'center',wrapText:true},
    alert:{fill:'#FFF1E8',font:{name:'Malgun Gothic',size:10,color:'#9A3412'},verticalAlignment:'center',wrapText:true},
    num3:{font:{name:'Malgun Gothic',size:10,color:'#243B53'},numberFormat:'#,##0.000',horizontalAlignment:'right',verticalAlignment:'center'},
    num4:{font:{name:'Malgun Gothic',size:10,color:'#243B53'},numberFormat:'#,##0.####',horizontalAlignment:'right',verticalAlignment:'center'},
    int:{font:{name:'Malgun Gothic',size:10,color:'#243B53'},numberFormat:'#,##0',horizontalAlignment:'right',verticalAlignment:'center'},
    money:{font:{name:'Malgun Gothic',size:10,color:'#243B53'},numberFormat:'#,##0" 원"',horizontalAlignment:'right',verticalAlignment:'center'},
    pct:{font:{name:'Malgun Gothic',size:10,color:'#243B53'},numberFormat:'0.0%',horizontalAlignment:'right',verticalAlignment:'center'},
    inputMoney:{fill:'#EFF6FF',font:{name:'Malgun Gothic',size:10,color:'#1D4ED8'},numberFormat:'#,##0',horizontalAlignment:'right',verticalAlignment:'center'},
    inputPct:{fill:'#EFF6FF',font:{name:'Malgun Gothic',size:10,color:'#1D4ED8'},numberFormat:'0.0%',horizontalAlignment:'right',verticalAlignment:'center'},
    totalMoney:{fill:'#DDF2EB',font:{name:'Malgun Gothic',size:12,bold:true,color:'#115E59'},numberFormat:'#,##0" 원"',horizontalAlignment:'right',verticalAlignment:'center',borders:{top:{style:'thin',color:'#6CA99D'}}},
    totalNum:{fill:'#E6F3F0',font:{name:'Malgun Gothic',size:11,bold:true,color:'#115E59'},numberFormat:'#,##0.000',horizontalAlignment:'right',verticalAlignment:'center',borders:{top:{style:'thin',color:'#6CA99D'}}},
    totalInt:{fill:'#E6F3F0',font:{name:'Malgun Gothic',size:11,bold:true,color:'#115E59'},numberFormat:'#,##0',horizontalAlignment:'right',verticalAlignment:'center',borders:{top:{style:'thin',color:'#6CA99D'}}},
    totalText:{fill:'#E6F3F0',font:{name:'Malgun Gothic',size:11,bold:true,color:'#115E59'},verticalAlignment:'center',wrapText:true,borders:{top:{style:'thin',color:'#6CA99D'}}}
  };
  for(const key of ['text','num3','num4','int','money','note'])styles[key+'Band']={...styles[key],fill:'#F3F7F8'};
  function sheet(name,widths,title,subtitle){
    const s={name,widths,rows:[],merges:[],freeze:8,repeat:'$1:$8',landscape:true};
    s.add=(values=[],height=25)=>{s.rows.push({cells:values.map(v=>typeof v==='object'&&v!==null?v:cell(v)),height});return s.rows.length;};
    s.span=(text,style='note',height=30)=>{const n=s.add([cell(text,style)],height);s.merges.push(`A${n}:${col(widths.length-1)}${n}`);return n;};
    s.add([],12);s.span(title,'title',38);s.span(subtitle,'subtitle',30);
    return s;
  }
  function model(packet){
    const {r}=packet,p=r.p,g=r.g,estimate=r.estimate;
    const subtitle=`${packet.projectName}  /  ${packet.itemName}  /  ${packet.dateLabel||new Date().toLocaleDateString('ko-KR')}`;
    const q=sheet('물량',[7,31,10,17,18,62],'자재 및 공사 물량',subtitle);
    q.span(`현재 항목: 기초 ${p.qty}개 · 전광판 ${r.supports.boards}대 · 기둥 ${r.supports.known?r.supports.total+'본':'미지정'}`);
    q.span('전체 수량은 공유 굴착·잡석 등의 겹침을 반영합니다. 기초 1개 물량 × 수량과 다를 수 있습니다.','note',34);
    q.add();q.add();q.add(['번호','공종 / 자재','단위','기초 1개','현재 항목 전체','산출 근거'].map(v=>cell(v,'head')),34);
    const quantities=[...r.boq,...(r.accessoryBoq||[])];
    quantities.forEach((v,i)=>{const band=i%2?'Band':'',numStyle=['본','조','세트','포','개'].includes(v.unit)?'int':'num3';q.add([cell(i+1,'int'+band),cell(v.name,'text'+band),cell(v.unit,'text'+band),cell(number(v.value),numStyle+band),cell(number(v.total),numStyle+band),cell(v.formula,'note'+band)],44);});
    q.filter=`A8:F${q.rows.length}`;
    q.add();q.span('콘크리트·철근의 주문량은 할증 포함, 순수량은 할증 제외입니다. 토량은 표에 표시된 자연·다짐·흐트러진 상태를 구분하세요.','note',42);

    const b=sheet('철근',[9,24,9,12,16,15,13,18,54],'철근 배근 및 가공 수량',subtitle);
    b.span('길이는 개략 전개길이입니다. 실제 가공 길이는 절곡·갈고리·정착·이음 상세를 확인한 후 확정하세요.','note',38);
    b.add(['기초 수량',cell(p.qty,'int'),'개','','','','철근 할증',cell(p.rebarWaste/100,'inputPct'),'']);
    b.add();b.add();b.add(['번호','부위','규격','본수 / 1기초','길이 (mm)','단위중량 (kg/m)','전체 본수','전체 순중량 (kg)','배근 / 산출 설명'].map(v=>cell(v,'head')),42);
    r.r.rows.forEach((v,i)=>{const n=b.rows.length+1,band=i%2?'Band':'',unitWeight=packet.bars[v.bar].kg;
      b.add([cell(v.code,'text'+band),cell(v.name,'text'+band),cell('D'+v.bar,'text'+band),cell(v.count,'int'+band),cell(v.length,'num3'+band),cell(unitWeight,'num3'+band),formula(`=D${n}*$B$5`,v.count*p.qty,'int'+band),formula(`=G${n}*E${n}/1000*F${n}`,v.kg*p.qty,'num3'+band),cell(v.note,'note'+band)],52);
    });
    b.filter=`A8:I${b.rows.length}`;
    const lastBar=b.rows.length;b.add();
    const netRow=b.add([cell('철근 순수량','totalText'),'','','','','','',formula(`=SUM(H9:H${lastBar})`,r.total.rebarNet,'totalNum'),'kg'],32);
    const grossRow=b.add([cell('철근 주문량','totalText'),'','','','','','',formula(`=H${netRow}*(1+$H$5)`,r.total.rebarGross,'totalNum'),'kg · 할증 포함'],34);
    b.merges.push(`A${netRow}:G${netRow}`,`A${grossRow}:G${grossRow}`);
    b.span('본수·길이·단위중량 또는 할증을 수정하면 이 표의 철근 수량만 다시 계산됩니다. 기초 구조와 배근 안전성은 계산기에서 재검토하세요.','note',42);

    const c=sheet('견적',[7,33,10,18,18,22,61],'공사비 산출 내역',subtitle);
    c.span('파란 셀: 단가·부가세율을 수정할 수 있습니다. 금액은 수량 × 단가를 원 단위 반올림합니다.','note',34);
    c.span('수량은 계산기 산출 결과입니다. 엑셀에서 수량을 변경하면 견적 금액만 갱신됩니다.','note',30);
    c.add();c.add();c.add(['번호','공종','단위','수량','단가 (원)','금액 (원)','산출 근거'].map(v=>cell(v,'head')),36);
    estimate.rows.forEach((v,i)=>{const n=c.rows.length+1,band=i%2?'Band':'';
      const qty=v.id==='rebar'?formula(`='철근'!H${grossRow}`,v.quantity,'num3'+band):cell(v.quantity,'num3'+band);
      c.add([cell(i+1,'int'+band),cell(v.name,'text'+band),cell(v.unit,'text'+band),qty,cell(v.unitPrice,'inputMoney'),formula(`=ROUND(D${n}*E${n},0)`,v.amount,'money'+band),cell(v.formula,'note'+band)],44);
    });
    c.filter=`A8:G${c.rows.length}`;
    const lastCost=c.rows.length;c.add();
    const subRow=c.add([cell('공급가','totalText'),'','','','',formula(`=SUM(F9:F${lastCost})`,estimate.subtotal,'totalMoney'),''],32);
    const vatRow=c.add([cell('부가세','totalText'),'','','세율',cell(p.vat/100,'inputPct'),formula(`=ROUND(F${subRow}*E${subRow+1},0)`,estimate.vat,'money'),''],32);
    const totalRow=c.add([cell('총 합계','totalText'),'','','','',formula(`=SUM(F${subRow}:F${vatRow})`,estimate.total,'totalMoney'),'VAT 포함'],36);
    c.merges.push(`A${subRow}:E${subRow}`,`A${vatRow}:C${vatRow}`,`A${totalRow}:E${totalRow}`);
    c.span(estimate.note,'alert',52);
    if(estimate.unpriced?.length)c.span('단가 미설정: '+estimate.unpriced.join(', '),'alert',36);

    const pr=sheet('프로젝트',[31,25,12,12,13,22,20,23],'프로젝트 전체 집계',packet.projectName+'  /  '+(packet.dateLabel||''));
    pr.span('각 행은 저장된 항목 전체입니다. 물량·철근·견적 시트에는 현재 선택한 항목의 상세를 담았습니다.','note',36);
    pr.span('현재 항목의 금액은 견적 시트와 연동합니다. 다른 항목은 내보낸 시점의 계산값입니다.','note',32);
    pr.add();pr.add();pr.add(['기초 이름','규격 L×W×H (mm)','기초 (개)','전광판 (대)','기둥 (본)','공급가 (원)','부가세 (원)','합계 (원)'].map(v=>cell(v,'head')),38);
    const items=packet.items?.length?packet.items:[{name:packet.itemName,r}];
    items.forEach(({name,r:ir},i)=>{const band=i%2?'Band':'',current=i===(packet.active??0),ie=ir.estimate;
      pr.add([cell(name,'text'+band),cell(`${ir.g.L} × ${ir.g.W} × ${ir.g.H}`,'text'+band),cell(ir.p.qty,'int'+band),cell(ir.supports.boards,'int'+band),cell(ir.supports.known?ir.supports.total:'미지정','int'+band),current?formula(`='견적'!F${subRow}`,ie.subtotal,'money'+band):cell(ie.subtotal,'money'+band),current?formula(`='견적'!F${vatRow}`,ie.vat,'money'+band):cell(ie.vat,'money'+band),current?formula(`='견적'!F${totalRow}`,ie.total,'money'+band):formula(`=SUM(F${i+9}:G${i+9})`,ie.total,'money'+band)],36);
    });
    const lastProject=pr.rows.length;pr.filter=`A8:H${lastProject}`;pr.add();
    const sum=items.reduce((s,{r:ir})=>({qty:s.qty+ir.p.qty,boards:s.boards+ir.supports.boards,posts:s.posts+(ir.supports.total||0),unknown:s.unknown||!ir.supports.known,sub:s.sub+ir.estimate.subtotal,vat:s.vat+ir.estimate.vat,total:s.total+ir.estimate.total}),{qty:0,boards:0,posts:0,unknown:false,sub:0,vat:0,total:0});
    const projectTotal=pr.add([cell('프로젝트 합계','totalText'),'',formula(`=SUM(C9:C${lastProject})`,sum.qty,'totalInt'),formula(`=SUM(D9:D${lastProject})`,sum.boards,'totalInt'),sum.unknown?cell('미지정 포함','totalText'):formula(`=SUM(E9:E${lastProject})`,sum.posts,'totalInt'),formula(`=SUM(F9:F${lastProject})`,sum.sub,'totalMoney'),formula(`=SUM(G9:G${lastProject})`,sum.vat,'totalMoney'),formula(`=SUM(H9:H${lastProject})`,sum.total,'totalMoney')],38);

    const audit=sheet('검토·입력',[31,20,20,20,30,30],'계산 검토 및 입력 조건',subtitle);audit.freeze=5;audit.repeat='$1:$5';
    audit.span('구조 계산은 내보낸 시점의 결과입니다. 엑셀에서 입력값을 바꾸어도 구조 계산은 실행되지 않습니다.','alert',40);
    audit.span(`지반자료: ${packet.groundLabel} / 풍하중: ${packet.windLabel}`,'note',42);
    audit.add();audit.span('구조 검토 결과','section',30);audit.add(['검토 항목','계산값','기준 / 용량','판정','설명',''].map(v=>cell(v,'head')),32);
    r.checks.forEach((v,i)=>{const n=audit.rows.length+1,band=i%2?'Band':'',status=packet.canScreen?v.status:'미검토';
      audit.add([cell(v.label,'text'+band),cell(packet.canScreen?number(v.demand):'—','num4'+band),cell(packet.canScreen?number(v.capacity):'—','num4'+band),cell(status,/미충족|미검토|범위 밖/.test(status)?'alert':'text'+band),cell(v.detail,'note'+band)],Math.max(40,Math.ceil(String(v.detail).length/47)*16+10));audit.merges.push(`E${n}:F${n}`);
    });
    audit.add();audit.span('검토 범위 및 미확정 사항','section',30);
    r.warnings.forEach(v=>audit.span(v,'note',Math.max(34,Math.ceil(v.length/80)*16+12)));
    audit.add();audit.span('적용 하중','section',30);
    audit.add(['정면 유효 풍압',cell(r.l.pressure,'num3'),'kPa','측면 유효 풍압',cell(r.l.sidePressure,'num3'),'kPa']);
    if(r.l.windDetail)audit.add(['설계풍속',cell(r.l.windDetail.velocity,'num3'),'m/s','Kzr',cell(r.l.windDetail.kzr,'num3'),'']);
    audit.add();audit.span('입력 조건 전체','section',30);audit.add(['입력 항목','적용 값','단위','입력 구분','비고',''].map(v=>cell(v,'head')),32);
    (packet.inputs||[]).forEach((v,i)=>audit.add([v.label,cell(v.value,typeof v.value==='number'?'num4':'text'),v.unit||'',v.group||'',''],typeof v.value==='string'&&v.value.length>14?42:27));
    audit.add();audit.span('입력 자료 및 참고 출처','section',30);
    audit.span('기초·배근·물량: 계산기 현재 입력에 의한 예비 산출. 단가: 첨부 원본의 예시값 또는 사용자가 수정한 값.','note',42);
    if(packet.windSource)audit.span(`풍속 지도: ${packet.windSource.title} (${packet.windSource.year}) · ${packet.windSource.url}`,'note',46);

    const s=sheet('요약',[28,23,12,28,23,12],'전광판 기초 · 자재 산출서',subtitle);s.freeze=0;s.repeat='';s.landscape=false;
    s.span('현재 선택한 항목의 치수·자재·공사비를 정리한 예비 산출서입니다.','note',30);
    s.span('예비 검토 · 배근 초안 / 시공 승인 아님','alert',30);s.add([],14);
    s.span('01  설치 및 기초 치수','section',30);
    s.add(['전광판 가로',cell(p.signW,'int'),'mm','전광판 세로',cell(p.signH,'int'),'mm'],30);
    s.add(['푸팅 가로 L',cell(g.L,'int'),'mm','푸팅 세로 W',cell(g.W,'int'),'mm'],30);
    s.add(['푸팅 두께 H',cell(g.H,'int'),'mm','화면 하단 높이',cell(p.bottom,'num3'),'m'],30);
    s.add(['기초 수량',cell(p.qty,'int'),'개','기둥 수량',cell(r.supports.known?r.supports.total:'미지정','int'),'본'],30);
    s.span(`기초 형식: ${packet.typeLabel} / ${p.installMode==='shared'?'전광판 1대의 지지 기초 배치':'전광판 반복 설치'} / 목 ${g.cL} × ${g.cW} × ${g.cH} mm`,'note',40);
    s.add([],12);s.span('02  주문 자재','section',30);
    const concreteIndex=quantities.findIndex(v=>v.name==='구조 콘크리트 · 주문량');
    const concreteFormula=concreteIndex>=0?`='물량'!E${9+concreteIndex}`:undefined;
    s.add(['콘크리트 주문',concreteFormula?formula(concreteFormula,r.total.orderedConcrete,'totalNum'):cell(r.total.orderedConcrete,'totalNum'),'m³','철근 주문',formula(`='철근'!H${grossRow}`,r.total.rebarGross,'totalNum'),'kg'],34);
    s.add(['콘크리트 순수량',cell(r.total.concrete,'num3'),'m³','철근 순수량',formula(`='철근'!H${netRow}`,r.total.rebarNet),'kg'],30);
    s.add([],12);s.span('03  현재 항목 예상 공사비','section',30);
    s.add(['공급가',formula(`='견적'!F${subRow}`,estimate.subtotal,'money'),'','부가세',formula(`='견적'!F${vatRow}`,estimate.vat,'money'),''],32);
    s.add(['VAT 포함 합계',formula(`='견적'!F${totalRow}`,estimate.total,'totalMoney'),'','','',''],40);
    s.merges.push('B20:F20');
    s.add([],12);s.span(`계산 판정: ${packet.resultLabel} / 지반자료: ${packet.groundLabel}`,'alert',42);
    s.span(`풍하중: ${packet.windLabel} · 적용 정면 ${r.l.pressure.toFixed(3)} kPa / 측면 ${r.l.sidePressure.toFixed(3)} kPa`,'note',40);
    s.span('엑셀에서 단가·부가세율을 바꾸면 견적과 요약 금액이 갱신됩니다. 치수·풍압 변경에 따른 구조 재계산은 계산기에서 진행하세요.','note',48);
    s.add([],12);s.span('프로젝트 전체','section',30);
    s.add(['등록 항목',cell(items.length,'int'),'개','전체 금액',formula(`='프로젝트'!H${projectTotal}`,sum.total,'money'),''],32);
    s.span('물량 · 철근 · 견적: 현재 항목 상세  |  프로젝트: 전체 합계  |  검토·입력: 계산 조건 및 검토 근거','note',42);
    s.span(estimate.note,'note',52);
    return {sheets:[s,q,b,c,pr,audit],styles,refs:{subRow,vatRow,totalRow,netRow,grossRow,projectTotal},meta:{projectName:packet.projectName,itemName:packet.itemName}};
  }
  const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');
  const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  function worksheet(s,theme){
    const end=col(s.widths.length-1),range=`A1:${end}${s.rows.length}`;
    const rows=s.rows.map((row,i)=>`<row r="${i+1}" ht="${row.height}" customHeight="1">${row.cells.map((c,j)=>{
      const address=col(j)+(i+1),style=theme.ids[c.style];if(style===undefined)throw new Error('엑셀 서식이 준비되지 않았습니다: '+c.style);
      const attrs=`r="${address}" s="${style}"`,v=c.v;
      if(c.formula)return `<c ${attrs}${typeof v==='number'?'':' t="str"'}><f>${xml(c.formula.slice(1))}</f><v>${xml(v)}</v></c>`;
      if(typeof v==='number'&&Number.isFinite(v))return `<c ${attrs}><v>${v}</v></c>`;
      return `<c ${attrs} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    const freeze=s.freeze?`<pane ySplit="${s.freeze}" topLeftCell="A${s.freeze+1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${s.freeze+1}" sqref="A${s.freeze+1}"/>`:'<selection activeCell="A1" sqref="A1"/>';
    return declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><tabColor rgb="FF0F766E"/><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="${range}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${freeze}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="25"/><cols>${s.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${s.filter?`<autoFilter ref="${s.filter}"/>`:''}${s.merges.length?`<mergeCells count="${s.merges.length}">${s.merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`:''}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="${s.landscape?'landscape':'portrait'}" fitToWidth="1" fitToHeight="${s.name==='요약'?1:0}"/><headerFooter><oddFooter>${xml('&L'+s.name+'&R페이지 &P / &N')}</oddFooter></headerFooter></worksheet>`;
  }
  // A ZIP container with UTF-8 XML, CRC32 and stored entries requires no CDN,
  // installation or compression library. Styles are authored by Artifact Tool.
  function zip(files){
    const encode=s=>new TextEncoder().encode(s),parts=[],central=[];let offset=0;
    const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xEDB88320^(n>>>1):n>>>1;return n>>>0;});
    const crc=bytes=>{let c=0xFFFFFFFF;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
    const header=(size,fill)=>{const b=new Uint8Array(size);fill(new DataView(b.buffer));return b;};
    for(const [path,content]of Object.entries(files)){
      const name=encode(path),data=encode(content),checksum=crc(data),size=data.length;
      const local=header(30,v=>{v.setUint32(0,0x04034B50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,checksum,true);v.setUint32(18,size,true);v.setUint32(22,size,true);v.setUint16(26,name.length,true);});
      const directory=header(46,v=>{v.setUint32(0,0x02014B50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,0x21,true);v.setUint32(16,checksum,true);v.setUint32(20,size,true);v.setUint32(24,size,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);});
      parts.push(local,name,data);central.push(directory,name);offset+=local.length+name.length+size;
    }
    const centralSize=central.reduce((s,p)=>s+p.length,0),end=header(22,v=>{v.setUint32(0,0x06054B50,true);v.setUint16(8,central.length/2,true);v.setUint16(10,central.length/2,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);});
    const out=new Uint8Array(offset+centralSize+end.length);let at=0;for(const p of [...parts,...central,end]){out.set(p,at);at+=p.length;}return out;
  }
  function bytes(report,theme=root.FoundationExcelTheme){
    if(!theme)throw new Error('엑셀 서식 파일을 불러오지 못했습니다.');
    const ns='http://schemas.openxmlformats.org',n=report.sheets.length,files={};
    files['[Content_Types].xml']=declaration+`<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${report.sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
    files['_rels/.rels']=declaration+`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
    const names=report.sheets.flatMap((s,i)=>[`<definedName name="_xlnm.Print_Area" localSheetId="${i}">'${xml(s.name)}'!$A$1:$${col(s.widths.length-1)}$${s.rows.length}</definedName>`,...(s.repeat?[`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${xml(s.name)}'!${s.repeat}</definedName>`]:[])]).join('');
    files['xl/workbook.xml']=declaration+`<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${report.sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><definedNames>${names}</definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    files['xl/_rels/workbook.xml.rels']=declaration+`<Relationships xmlns="${ns}/package/2006/relationships">${report.sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${n+1}" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    files['xl/styles.xml']=theme.styles;
    report.sheets.forEach((s,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=worksheet(s,theme);});
    return zip(files);
  }
  const api={model,bytes,col,styles};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationExcel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
