(function(){
  'use strict';
  // Presentation only: navigation and calculations update immediately.
  const preference=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const running=new Map();
  const reduced=()=>!!preference?.matches;
  function clear(){for(const animation of running.values())animation.cancel();running.clear();}
  function reveal(node,direction='forward',kind='panel'){
    if(!node)return;
    running.get(node)?.cancel();
    if(reduced()||typeof node.animate!=='function'||node.hidden)return;
    const x=direction==='backward'?-18:direction==='forward'?18:0;
    const animation=node.animate([
      {opacity:0,transform:`translate3d(${x}px,${kind==='label'?4:8}px,0)`},
      {opacity:1,transform:'translate3d(0,0,0)'}
    ],{duration:kind==='label'?200:320,easing:'cubic-bezier(.22,1,.36,1)'});
    running.set(node,animation);
    const finished=()=>{if(running.get(node)===animation)running.delete(node);};
    animation.onfinish=finished;animation.oncancel=finished;
  }
  function scrollTo(node){node?.scrollIntoView?.({behavior:reduced()?'auto':'smooth',block:'start'});}
  preference?.addEventListener?.('change',()=>{if(reduced())clear();});
  window.addEventListener?.('beforeprint',clear);
  window.FoundationMotion={reveal,scrollTo};
})();
