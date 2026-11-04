'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,dist=path.join(root,'dist');
function read(file){return fs.readFileSync(file,'utf8');}
function replaceOnce(html,pattern,replacement,label){
  const count=[...html.matchAll(new RegExp(pattern.source,'g'))].length;
  if(count!==1)throw Error(`${label}: expected one reference, found ${count}`);
  return html.replace(pattern,replacement);
}
function inlinePage(directory,entry,styles,scripts,extraStyle,prelude=''){
  let html=read(path.join(directory,entry));
  for(const file of styles)html=replaceOnce(html,new RegExp(`<link rel="stylesheet" href="(?:\\./)?${file.replace(/\./g,'\\.')}">`),()=>`<style>${read(path.join(directory,file))}</style>`,file);
  for(const file of scripts)html=replaceOnce(html,new RegExp(`<script defer src="(?:\\./)?${file.replace(/\./g,'\\.')}"></script>`),'',file);
  html=html.replace('</head>',()=>`<style>${extraStyle}</style></head>`);
  const code=scripts.map(file=>read(path.join(directory,file)).replace(/<\/script/gi,'<\\/script')).join('\n;\n');
  return html.replace('</body>',()=>`<script>${prelude}${code}</script></body>`);
}
const EMBED='window.LED_SUITE_EMBEDDED=true;\n';
function buildInfo(){
  const foundation=(read(path.join(dist,'foundation','index.html')).match(/class="version">[^<]*?(V\d+)/)||[])[1]||'',frame=(read(path.join(dist,'frame.html')).match(/\b(V\d+)\b/)||[])[1]||'V5';
  const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  return {date,frame,foundation,label:`구조물 ${frame} · 기초 ${foundation} · ${date} 빌드`};
}
function build(){
  const frame=inlinePage(dist,'frame.html',['planner.css','frame-easy.css','frame-3d.css'],['calculator.js','planner.js','export.js','app.js','frame-3d.js','frame-easy.js'],'.topbar,.page-heading,.project-bar{display:none}.frame-easy-app .shell{padding-top:12px}@media(max-width:780px){.frame-easy-app .shell{padding-top:8px}.metrics{display:none}.tabs{padding-top:0;margin-top:0;margin-bottom:14px}.tabs button{min-height:44px}}@media print{.topbar{display:none}}',EMBED);
  const foundationDir=path.join(dist,'foundation');
  let foundation=inlinePage(foundationDir,'index.html',['style.css','interface.css','easy.css'],['wind.js','engine.js','estimate.js','excel-theme.js','excel.js','dxf.js','motion.js','app.js','easy.js'],'body>header .brand{display:none}body.easy-app>header{display:none}.project-bar>div:first-child{display:none}@media(max-width:730px){body.easy-app>header{padding:8px 12px}.easy-app main{padding:12px}.easy-app .heading{margin-bottom:12px}.easy-app .heading h1{font-size:22px;margin:0 0 4px}.easy-app .heading #mode-eyebrow,.workflow-status,#input-mode-note{display:none}.easy-app .heading p{margin:0}.input-mode-bar{padding:8px;margin-bottom:12px}.input-mode-buttons button{font-size:14px;min-height:44px;padding:8px}.wizard-nav{padding:4px}.wizard-nav button{min-height:44px;padding:7px 5px;gap:4px;font-size:14px}.wizard-nav button span{width:20px;height:20px}.header-tools summary{font-size:14px}.header-tools{justify-content:flex-end}.wizard-panel{padding:18px 14px}}',EMBED);
  foundation=foundation.replace('href="wind-map.png"',()=>`href="data:image/png;base64,${fs.readFileSync(path.join(foundationDir,'wind-map.png')).toString('base64')}"`);
  const serialized=JSON.stringify({frame,foundation}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  fs.writeFileSync(path.join(dist,'suite-sources.js'),'globalThis.CalculatorSuiteSources='+serialized+';\nglobalThis.CalculatorSuiteBuild='+JSON.stringify(buildInfo())+';\n','utf8');
  const standalone=inlinePage(dist,'index.html',['suite.css'],['suite-engine.js','suite-sources.js','suite.js'],'');
  const target=path.join(root,'전광판_구조물_기초_통합계산기.html');fs.writeFileSync(target,standalone,'utf8');
  console.log(`통합 계산기 생성: ${target}`);return {frame,foundation,standalone,target};
}
if(require.main===module)build();module.exports={build};
