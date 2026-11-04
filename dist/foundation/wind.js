(function(root){
  'use strict';
  const source={title:'국토교통부 강풍에 의한 건축물 외장재 탈락방지 가이드라인',year:2022,page:55,figure:'그림 2.4-1 / KDS 41 12 00:2022, 500년 풍속',url:'https://www.molit.go.kr/USR/policyData/dtl.jsp?id=4673',mirror:'https://www.codil.or.kr/filebank/original/RK/OTKCRK240379/OTKCRK240379.pdf'};
  // Coordinates are pixels in the cropped official map (790 × 1090), not GPS.
  // Values are manually read, conservative preliminary values near the labelled
  // reference point. No municipality-wide or exact-site GIS lookup is claimed.
  const points=[
    ['seoul','서울',246,206,28],['incheon','인천',200,224,34],['suwon','수원',253,272,30],
    ['chuncheon','춘천',360,147,28],['sokcho','속초',485,82,38],['gangneung','강릉',571,217,36],
    ['wonju','원주',397,258,28],['cheongju','청주',323,393,34],['daejeon','대전',309,442,32],
    ['jeonju','전주',278,556,30],['gunsan','군산',212,571,36],['gwangju','광주',240,679,32],
    ['mokpo','목포',158,751,40],['wando','완도',208,833,42],['yeosu','여수',369,760,40],
    ['daegu','대구',504,538,30],['pohang','포항',617,507,40],['ulsan','울산',613,606,42],
    ['jinju','진주',410,680,34],['changwon','창원',496,674,36],['busan','부산',567,689,42],
    ['geoje','거제',502,733,42],['jeju','제주',179,1008,50],['seogwipo','서귀포',190,1050,50],
    ['ulleung','울릉도',687,218,46],['dokdo','독도',735,237,46]
  ].map(([id,name,x,y,v])=>({id,name,x,y,v,kind:id==='busan'?'공식 계산 예제 42m/s':id==='ulleung'||id==='dokdo'?'지도 표기 46m/s':'지도 인근 등풍속선의 보수적 판독 예비값'}));
  const exposures={A:{label:'고층 건물이 밀집한 도심',zb:20,zg:550,alpha:.33,low:.58,c:.22},B:{label:'주택·수목이 밀집한 시가지',zb:15,zg:450,alpha:.22,low:.81,c:.45},C:{label:'저층 건물·수목이 산재한 지역',zb:10,zg:350,alpha:.15,low:1,c:.71},D:{label:'장애물이 거의 없는 해안·평지',zb:5,zg:250,alpha:.1,low:1.13,c:.98}};
  function getPoint(id){return points.find(p=>p.id===id)||null;}
  function nearest(x,y){
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>790||y>1090)return null;
    return points.reduce((best,p)=>{const distance=Math.hypot(p.x-x,p.y-y);return !best||distance<best.distance?{...p,distance}:best;},null);
  }
  function regional({basicWind,height,exposure='C',topography=1,importance=1,direction=1,cf=1.8,gust=1.5}){
    const e=exposures[exposure];
    if(!e||![basicWind,height,topography,importance,direction,cf,gust].every(Number.isFinite)||basicWind<=0||height<0||topography<1||importance<=0||direction<=0||direction>1||cf<=0||gust<1)throw new Error('지역 풍하중 입력을 확인하세요.');
    const z=Math.min(height,e.zg),kzr=z<=e.zb?e.low:e.c*z**e.alpha;
    const velocity=basicWind*direction*kzr*topography*importance;
    const q=0.5*1.225*velocity**2/1000,pressure=q*cf*gust;
    return {basicWind,height,kzr,velocity,q,pressure,exposure,topography,importance,direction,source};
  }
  const api={source,points,exposures,getPoint,nearest,regional};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FoundationWind=api;
})(typeof globalThis!=='undefined'?globalThis:this);
