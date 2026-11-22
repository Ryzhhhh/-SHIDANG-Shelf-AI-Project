'use strict';
// Type → compact constellation → scattered cover gallery. Original implementation, no animation libraries.
(()=>{
 const home=document.getElementById('top'),stage=document.getElementById('cover-stage'),typeScreen=document.getElementById('type-screen'),typed=document.getElementById('typed-text'),skip=document.getElementById('skip-intro'),replay=document.getElementById('replay-intro'),footer=document.getElementById('album-home-footer');
 const covers=window.SHELF_ALBUM_COVERS||[];
 const packCount=Math.min(18,covers.length);
 const sentence='The clip ends. The feeling stays.';
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const timeline={typeStart:350,charMs:65,typeHold:650,textFade:380,packStart:3450,packDuration:1100,scatterStart:4700,scatterDuration:2000,end:6900};
 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),between=(t,a,b)=>clamp((t-a)/(b-a)),ease=t=>t===1?1:1-Math.pow(2,-10*t),smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
 let start=performance.now(),finished=null,raf=0,lastTime=0,pointer=[0,0],follow=[0,0],layoutData=[],viewport={w:0,h:0,spanX:0,spanY:0};
 let panOffset=[0,0],pointerAnchor=[innerWidth/2,innerHeight/2],drag=null,suppressClick=false;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cards=covers.map((cover,i)=>{
  const a=document.createElement('a');a.className='album-cover';a.href=cover.source;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',cover.artist+'《'+cover.title+'》：查看原发行页');a.tabIndex=-1;a.draggable=false;
  a.innerHTML='<img src="'+cover.image+'" alt="'+escape(cover.artist+'《'+cover.title+'》封面')+'" decoding="async" loading="eager"><span class="cover-title">'+escape(cover.title+' · '+cover.artist)+'</span>';
  a.title=cover.title+' · '+cover.artist;
  a.querySelector('img').addEventListener('error',()=>{a.classList.add('cover-unavailable');});stage.append(a);return a;
 });
 document.getElementById('cover-source-list').innerHTML=covers.map(c=>'<li><a href="'+c.source+'" target="_blank" rel="noopener noreferrer">'+escape(c.artist)+' · '+escape(c.title)+'</a></li>').join('');
 function layout(){
  const w=innerWidth,screenH=innerHeight,mobile=w<680,cols=8,rows=Math.ceil(cards.length/cols);
  const top=document.querySelector('.site-nav').getBoundingClientRect?.()?.height||(w<=820?76:88);
  const bottom=screenH<500?63:mobile?96:86,h=Math.max(1,screenH-top-bottom);
  home.style.setProperty('--gallery-top',top+'px');home.style.setProperty('--bottom-bar',bottom+'px');
  const size=mobile?Math.min(86,w*.20,h*.15):Math.min(124,w*.09,h*.16);
  const cellX=Math.max(size*2.05,(w+size*2+100)/cols);
  const cellY=Math.max(size+100,(h+size*2+100)/rows);
  const spanX=cols*cellX,spanY=rows*cellY;
  const packSize=Math.min(68,w*.056,h*.09),packSteps=[1,3,5,5,3,1];let index=0;
  const packed=[];for(let row=0;row<packSteps.length;row++){const count=packSteps[row];for(let col=0;col<count;col++)packed[index++]={x:w/2+(col-(count-1)/2)*packSize*1.10,y:h*.48+(row-2.5)*packSize*1.10};}
  // Keep the opening's 18 covers in a central 6 × 3 patch; extras fill the surrounding plane.
  const slots=[],used=new Set(),centralRows=Math.min(3,rows),centralCols=Math.ceil(packCount/centralRows),firstCol=Math.floor((cols-centralCols)/2),firstRow=Math.floor((rows-centralRows)/2);
  for(let row=firstRow;row<firstRow+centralRows;row++)for(let col=firstCol;col<firstCol+centralCols;col++){if(slots.length<packCount){slots.push({row,col});used.add(row+':'+col);}}
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)if(!used.has(row+':'+col))slots.push({row,col});
  home.style.height=screenH+'px';stage.style.height=h+'px';home.style.setProperty('--cover-size',size+'px');
  layoutData=cards.map((el,i)=>{
   const {col,row}=slots[i];
   const x=w/2+(col-(cols-1)/2)*cellX+(row%2?cellX*.3:0);
   const stagger=(col%2===0?-1:1)*Math.min(cellY*.12,28);
   const y=h*.5+(row-(rows-1)/2)*cellY+stagger;
   return {start:packed[i%packCount]||{x:w/2,y:h*.48},end:{x,y},size,packSize};
  });viewport={w,h,top,spanX,spanY};pointerAnchor=[w/2,top+h/2];

 }
 function setFinished(on){
  if(finished===on&&document.body.classList.contains('cover-ready')===on)return;
  finished=on;document.querySelector('.site-nav').inert=!on;stage.inert=!on;document.body.classList.toggle('intro-playing',!on);document.body.classList.toggle('cover-ready',on);skip.hidden=on;replay.hidden=!on;footer.inert=!on;cards.forEach(a=>a.tabIndex=on?0:-1);
 }
 function paint(ms,dt){
  const endTyping=timeline.typeStart+sentence.length*timeline.charMs;
  const count=clamp(Math.floor((ms-timeline.typeStart)/timeline.charMs),0,sentence.length);typed.textContent=sentence.slice(0,count);
  const textOpacity=1-between(ms,endTyping+timeline.typeHold,endTyping+timeline.typeHold+timeline.textFade);typeScreen.style.opacity=textOpacity;typeScreen.style.visibility=textOpacity<=0?'hidden':'visible';
  const p=between(ms,timeline.scatterStart,timeline.scatterStart+timeline.scatterDuration);
  const k=reduce.matches?1:1-Math.pow(1-.075,Math.max(dt,1)/16.67);for(let d=0;d<2;d++)follow[d]+=(pointer[d]-follow[d])*k;
  cards.forEach((el,i)=>{
   const d=layoutData[i];if(!d)return;
   // Only the original 18 covers appear in the compact cluster. Extra covers join as it opens.
   const appearAt=i<packCount?timeline.packStart+i*23:timeline.scatterStart+120+(i-packCount)*13;
   const appear=between(ms,appearAt,appearAt+(i<packCount?420:650));
   const lag=Math.min(i,packCount-1)*.009;
   const q=ease(clamp((p-lag)/(1-Math.max(0,packCount-1)*.009)));
   const scale=mix(d.packSize/d.size,1,q)*mix(.88,1,ease(appear));
   
   const wrap=(value,center,span)=>((value-center+span/2)%span+span)%span-span/2+center;
   const wrappedX=wrap(d.end.x+follow[0],viewport.w/2,viewport.spanX);
   const wrappedY=wrap(d.end.y+follow[1],viewport.h/2,viewport.spanY);
   const x=mix(d.start.x,wrappedX,q),y=mix(d.start.y+10*(1-appear),wrappedY,q);
   el.style.opacity=String(appear);el.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) scale('+scale+')';el.style.setProperty('--label-opacity',String(between(p,.65,1)));
  });
  if(ms>=timeline.end)setFinished(true);
 }
 function frame(now){const dt=Math.min(60,now-lastTime||16.67);lastTime=now;paint(reduce.matches?timeline.end:now-start,dt);raf=requestAnimationFrame(frame);}
 function begin(){start=performance.now();setFinished(false);follow=[0,0];pointer=[0,0];panOffset=[0,0];pointerAnchor=[innerWidth/2,viewport.top+viewport.h/2];document.getElementById('cover-credits').open=false;scrollTo({top:0,behavior:'instant'});if(reduce.matches){start=performance.now()-timeline.end;setFinished(true);}if(!raf)raf=requestAnimationFrame(frame);}
 skip.addEventListener('click',()=>{start=performance.now()-timeline.end;paint(timeline.end,16.67);replay.focus({preventScroll:true});});
 replay.addEventListener('click',()=>{if(!reduce.matches){begin();skip.focus({preventScroll:true});}});
 addEventListener('resize',layout,{passive:true});
 home.addEventListener('pointerdown',e=>{
  if(!finished||e.button!==0||e.target.closest('.album-home-footer,.intro-controls'))return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,pan:pointer.slice(),moved:false};suppressClick=false;
 });
 home.addEventListener('pointermove',e=>{
  if(!finished)return;
  if(drag&&e.pointerId===drag.id){
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(Math.hypot(dx,dy)>6&&!drag.moved){drag.moved=true;home.setPointerCapture(e.pointerId);home.classList.add('is-dragging');}
   if(drag.moved)pointer=[drag.pan[0]+dx,drag.pan[1]+dy];
  }else if(e.pointerType!=='touch'&&!reduce.matches)pointer=[panOffset[0]+(pointerAnchor[0]-e.clientX)*1.3,panOffset[1]+(pointerAnchor[1]-e.clientY)*.8];
 },{passive:true});
 function endDrag(e){if(!drag||e.pointerId!==drag.id)return;if(drag.moved){panOffset=pointer.slice();pointerAnchor=[e.clientX,e.clientY];suppressClick=true;}drag=null;home.classList.remove('is-dragging');}
 home.addEventListener('pointerup',endDrag);home.addEventListener('pointercancel',endDrag);
 home.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}},true);
 stage.addEventListener('wheel',e=>{
  if(!finished||e.ctrlKey)return;e.preventDefault();
  const unit=e.deltaMode===1?24:e.deltaMode===2?viewport.h:1;
  const dx=e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX,dy=e.shiftKey&&!e.deltaX?0:e.deltaY;
  panOffset=[pointer[0]-dx*unit,pointer[1]-dy*unit];pointer=panOffset.slice();pointerAnchor=[innerWidth/2,viewport.top+viewport.h/2];
 },{passive:false});
 cards.forEach((card,i)=>card.addEventListener('focus',()=>{if(!card.matches(':focus-visible'))return;panOffset=[viewport.w/2-layoutData[i].end.x,viewport.h/2-layoutData[i].end.y];pointer=panOffset.slice();pointerAnchor=[innerWidth/2,viewport.top+viewport.h/2];}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!raf){lastTime=performance.now();raf=requestAnimationFrame(frame);}});
 reduce.addEventListener('change',()=>{if(reduce.matches){start=performance.now()-timeline.end;paint(timeline.end,16.67);replay.hidden=true;}else begin();});
 layout();begin();
})();
