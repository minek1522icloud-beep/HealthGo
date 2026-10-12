/* HealthGo GPS Visual Smoother v1.
 * Renders BETWEEN two already-observed positions for at most 650ms.
 * Never extrapolates beyond the latest measured GPS fix.
 * No synthetic geolocation callbacks, XP, distance, speed or reward events.
 * Visible only: this module never stores positions or creates a GPS watcher.
 */
(function(root){
'use strict';
const radians=n=>n*Math.PI/180;
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
 Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
function metres(a,b){
 if(!valid(a)||!valid(b))return Infinity;
 const lat=(b.lat-a.lat)*Math.PI/180,lon=(b.lon-a.lon)*Math.PI/180;
 const h=Math.sin(lat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(lon/2)**2;
 return 12742000*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
const lerp=(start,target,fraction)=>({lat:start.lat+(target.lat-start.lat)*fraction,lon:start.lon+(target.lon-start.lon)*fraction});
function make(apply,options={}){
 if(typeof apply!=='function')throw Error('Expected display callback');
 const raf=typeof root.requestAnimationFrame==='function'?fn=>root.requestAnimationFrame(fn):null;
 const cancel=typeof root.cancelAnimationFrame==='function'?id=>root.cancelAnimationFrame(id):null;
 const clock=typeof root.performance?.now==='function'?()=>root.performance.now():()=>Date.now();
 let shown=null,target=null,frame=null,epoch=0,reduced=false,active=true;
 const maxGap=Number.isFinite(options.maxGap)?options.maxGap:85;
 function stop(){active=false;epoch++;if(frame!==null&&cancel)cancel(frame);frame=null;shown=null;target=null;}
 function put(p){shown={lat:p.lat,lon:p.lon};apply(shown);}
 function restart(){active=true;epoch++;shown=null;target=null;frame=null;}
 function fix(point,accuracy=15){
  if(!active||!valid(point))return false;
  const next={lat:point.lat,lon:point.lon};
  const acc=Number(accuracy);
  if(frame!==null&&cancel){cancel(frame);frame=null;}
  epoch++;const run=epoch;
  if(!shown){target=next;put(next);return true;}
  const gap=metres(shown,next);
  target=next;
  try{reduced=!!root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches}catch(_){reduced=false}
  // Teleports, weak accuracy and browsers without rAF: snap to the real fix.
  if(!raf||reduced||!Number.isFinite(gap)||gap<.5||gap>maxGap||
    !Number.isFinite(acc)||acc>60){put(next);return true;}
  const from={...shown},started=clock();
  const duration=Math.min(650,Math.max(180,190+gap*7));
  const draw=()=>{
   if(!active||run!==epoch)return;
   const t=Math.min(1,Math.max(0,(clock()-started)/duration));
   const eased=t*t*(3-2*t);
   put(lerp(from,next,eased));
   if(t<1)frame=raf(draw);else{frame=null;put(next);}
  };
  frame=raf(draw);
  return true;
 }
 return {fix,stop,restart,getDisplay:()=>shown&&{...shown},getTarget:()=>target&&{...target}};
}
root.HealthGoGpsVisual=Object.freeze({create:make,metres});
})(window);