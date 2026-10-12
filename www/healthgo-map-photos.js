/* HealthGo Places — on-demand, source-attributed Wikimedia Commons photos.
 * No stock images, no external photo requests until the user clicks.
 */
(function(w){
 'use strict';
 const legalFile=v=>/^File:[^?#<>"']{3,140}$/i.test(String(v||'').trim());
 function attach(card,tags,name){
  if(!card||!tags||!legalFile(tags.wikimedia_commons))return false;
  const file=String(tags.wikimedia_commons).trim(),actions=card.querySelector?.('.map-place-actions');
  if(!actions)return false;
  const button=document.createElement('button');button.type='button';
  button.textContent='📷 Pokaż zdjęcie';button.className='hg-map-place-photo-button';
  actions.appendChild(button);
  button.addEventListener('click',async()=>{
   if(button.disabled)return;
   button.disabled=true;button.textContent='Pobieram zdjęcie…';
   let figure=card.querySelector?.('.hg-map-place-photo');
   if(!figure){figure=document.createElement('figure');figure.className='hg-map-place-photo';card.appendChild(figure);}
   figure.replaceChildren();
   const note=document.createElement('figcaption');note.textContent='Sprawdzam plik Wikimedia Commons…';figure.appendChild(note);
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
   try{
    const params=new URLSearchParams({action:'query',format:'json',origin:'*',prop:'imageinfo',
      iiprop:'url|extmetadata',iiurlwidth:'480',titles:file});
    const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal:ctrl.signal});
    if(!response.ok)throw Error('HTTP');
    const data=await response.json();
    const page=Object.values(data?.query?.pages||{}).find(p=>p?.imageinfo?.[0]);
    const record=page?.imageinfo?.[0],image=record?.thumburl||record?.url;
    if(typeof image!=='string'||!image.startsWith('https://upload.wikimedia.org/'))throw Error('NO_IMAGE');
    const img=document.createElement('img');img.loading='lazy';img.referrerPolicy='no-referrer';
    img.src=image;img.alt='Zdjęcie wskazanego miejsca: '+String(name||'').slice(0,100);
    figure.insertBefore(img,note);
    const plain=raw=>String(raw||'').replace(/<[^>]*>/g,' ')
      .replace(/&(?:nbsp|amp|quot);/gi,' ').replace(/\s+/g,' ').trim();
    const artist=plain(record.extmetadata?.Artist?.value||'Autor w źródle').slice(0,100);
    const license=plain(record.extmetadata?.LicenseShortName?.value||'Licencja w źródle').slice(0,60);
    note.textContent=artist+' · '+license+' · ';
    const a=document.createElement('a');
    a.href='https://commons.wikimedia.org/wiki/'+encodeURIComponent(file);
    a.target='_blank';a.rel='noopener noreferrer';a.textContent='Źródło i pełna licencja ↗';
    note.appendChild(a);
    button.remove();
   }catch(_){
    note.textContent='Nie udało się pobrać przypisanego zdjęcia. Mapa nadal działa.';
    button.disabled=false;button.textContent='📷 Ponów pobieranie';
   }finally{clearTimeout(timer)}
  });
  return true;
 }
 w.HealthGoMapPhotos=Object.freeze({attach,legalFile});
})(window);