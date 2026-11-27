// SolidCraft script export: every frame member and foundation part becomes a valid command in
// SolidCraft's axes (X centred along the board, Y depth, Z up from GL = 0, mm).
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../dist/planner.js');
const V=require('../dist/frame-3d.js');
const E=require('../dist/foundation/engine.js');
const X=require('../dist/solidcraft-export.js');

const pipe={columnShape:'circle',columnDiameter:318.5,columnThickness:6.9,anchorEmbed:600,plateThickness:25};
const boxes=s=>s.commands.filter(c=>c.command==='solid.box'&&!c.params.operation);
const byName=(s,name)=>s.commands.find(c=>c.params.name===name);

test('frame members keep their sizes and sit on the screen bottom height',()=>{
  const project=P.createProject(),result=P.calculate(project),geometry=V.geometry(project,result,{limit:5000});
  const s=X.script({frame:{geometry,project,result}});
  assert.equal(s.members,geometry.boxes.filter(b=>b.kind!=='extra').length);assert.equal(boxes(s).length,s.members);
  for(const c of s.commands.filter(c=>c.command.startsWith('solid.')))for(const k of ['length','width','height'])if(k in c.params)assert.ok(c.params[k]>0);
  const left=byName(s,'앞면 좌측 외곽').params;assert.deepEqual([left.corner[0],left.corner[2],left.height],[-project.general.width/2,0,project.general.height]);
  const volume=boxes(s).reduce((t,c)=>t+c.params.length*c.params.width*c.params.height,0),expected=geometry.boxes.reduce((t,b)=>t+b.w*b.h*b.d,0);
  assert.ok(Math.abs(volume-expected)<1e-6);
  // Steel bodies all receive the steel material.
  const assign=s.commands.find(c=>c.command==='material.assign'&&c.params.material===X.MATERIALS.steel.name);assert.equal(assign.params.bodies.length,s.members);
  assert.doesNotThrow(()=>JSON.parse(X.json({frame:{geometry}})));
});

test('foundations sit below ground, posts stand on the plates and hollow sections are cut',()=>{
  const r=E.calculate({...pipe,qty:2,foundationSpacing:3000,mode:'manual',L:2500,W:2500,H:1500}),s=X.script({foundation:r});
  assert.deepEqual(s.foundation,{footings:2,posts:2});
  const footing=byName(s,'기초 1 푸팅').params;assert.deepEqual(footing.corner,[-1500-1250,-1250,-r.g.depth*1000]);assert.equal(footing.height,1500);
  const neck=byName(s,'기초 2 목').params;assert.equal(neck.corner[2]+neck.height,r.g.above);
  const post=byName(s,'기둥 1').params,hole=byName(s,'기둥 1 속').params;
  assert.equal(post.diameter,318.5);assert.equal(hole.diameter,318.5-2*6.9);assert.equal(hole.operation,'cut');assert.deepEqual(hole.targets,['기둥 1']);
  assert.equal(post.base[2],r.g.above+r.p.groutThickness+r.p.plateThickness);assert.equal(post.base[2]+post.height,r.p.bottom*1000);
  // Rectangular tubes are cut hollow; H-sections join a web and a back flange to the front flange.
  const tube=X.script({foundation:E.calculate({columnShape:'rect',columnWidth:200,columnDepth:150,columnThickness:6,anchorEmbed:600,plateThickness:25})});
  assert.equal(byName(tube,'기둥 속').params.operation,'cut');
  const h=X.script({foundation:E.calculate({columnShape:'h',columnWidth:200,columnDepth:200,columnThickness:8,columnFlange:12,anchorEmbed:600,plateThickness:25})});
  assert.equal(h.commands.filter(c=>c.params.operation==='join').length,2);
  // Combined footings carry two necks and two posts on one footing.
  const combined=X.script({foundation:E.calculate({...pipe,type:'combined',mode:'manual',...E.types.combined})});
  assert.deepEqual(combined.foundation,{footings:1,posts:2});
  assert.throws(()=>X.script({}),/내보낼/);
});
