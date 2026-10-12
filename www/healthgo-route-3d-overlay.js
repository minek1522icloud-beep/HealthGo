/* HealthGo 3D Route Overlay v1.
 * Renders exactly the real OSRM line over MapLibre's pitched camera.
 * The SVG is a visual fallback for iPhone/WebGL GeoJSON line rendering.
 * No route generation, synthetic motion or storage of GPS coordinates.
 */
(function(w){
 'use strict';
 const $=id=>document.getElementById(id);
 let gl=null,overlay=null,border=null,routeLine=null,coords=[],queued=false,detachHandlers=[],token=0;
 function valid(point){return Array.isArray(point)&&point.length>=2&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;}
 function clean(list){return Array.isArray(list)?list.filter(valid).slice(0,30000):[];}
 function create(){
  if(overlay)return true;
  const holder=$('hgNavigationPerspective');
  if(!holder||typeof document.createElementNS!=='function')return false;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('class','hg-3d-route-overlay');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('preserveAspectRatio','none');
  const shadow=document.createElementNS(ns,'path'),line=document.createElementNS(ns,'path');
  shadow.setAttribute('class','hg-3d-route-outline');line.setAttribute('class','hg-3d-route-core');
  svg.appendChild(shadow);svg.appendChild(line);holder.appendChild(svg);
  overlay=svg;border=shadow;routeLine=line;return true;
 }
 function draw(){
  if(!gl||!create())return false;
  const holder=$('hgNavigationPerspective');
  const width=holder?.clientWidth||gl.getCanvas?.()?.clientWidth||0;
  const height=holder?.clientHeight||gl.getCanvas?.()?.clientHeight||0;
  if(width<20||height<20||coords.length<2)return false;
  overlay.setAttribute('viewBox','0 0 '+width+' '+height);
  // Lower-resolution samples for long routes, followed by the real final point.
  const stride=Math.max(1,Math.ceil(coords.length/1200)),parts=[];
  for(let i=0;i<coords.length;i+=stride){
   try{
    const q=gl.project(coords[i]);
    if(!q||!Number.isFinite(q.x)||!Number.isFinite(q.y))continue;
    parts.push((parts.length?'L':'M')+q.x.toFixed(1)+' '+q.y.toFixed(1));
   }catch(_){}
  }
  if((coords.length-1)%stride!==0){
   try{const last=gl.project(coords[coords.length-1]);
    if(Number.isFinite(last.x)&&Number.isFinite(last.y))parts.push('L'+last.x.toFixed(1)+' '+last.y.toFixed(1));
   }catch(_){}
  }
  const d=parts.length>1?parts.join(' '):'';
  border.setAttribute('d',d);routeLine.setAttribute('d',d);
  return !!d;
 }
 function schedule(){
  if(queued||!gl)return;
  queued=true;const present=token;
  const raf=w.requestAnimationFrame||function(fn){setTimeout(fn,16)};
  raf(()=>{if(present!==token)return;queued=false;draw();});
 }
 function attach(instance,geometry){
  detach();
  if(!instance||typeof instance.project!=='function')return false;
  gl=instance;coords=clean(geometry);
  for(const name of ['move','zoom','rotate','pitch','resize','idle']){
   try{instance.on(name,schedule);detachHandlers.push(name);}catch(_){}
  }
  create();schedule();return true;
 }
 function setRoute(geometry){coords=clean(geometry);schedule();}
 function detach(){
  token++;
  if(gl)for(const name of detachHandlers){try{gl.off(name,schedule)}catch(_){}}
  detachHandlers=[];gl=null;coords=[];queued=false;
  try{overlay?.remove?.()}catch(_){}
  overlay=null;border=null;routeLine=null;
 }
 w.HealthGoRoute3DOverlay=Object.freeze({attach,setRoute,detach,draw});
})(window);