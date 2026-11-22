'use strict';
(()=>{
 const panel=document.getElementById('app-panel');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let opened=false,lastFocus=null;
 const menuButton=document.getElementById('menu-toggle');
 function closeMenu(){document.body.classList.remove('menu-open');menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','展开导航菜单');}
 menuButton.addEventListener('click',()=>{const on=document.body.classList.toggle('menu-open');menuButton.setAttribute('aria-expanded',String(on));menuButton.setAttribute('aria-label',on?'收起导航菜单':'展开导航菜单');});
 function openPanel(hash){
  closeMenu();
  const allowed=['find','collection','profiles','announcements','about','login'];const requested=hash.slice(1),id=allowed.includes(requested)?requested:'find';
  if(!opened){lastFocus=document.activeElement;opened=true;document.body.classList.add('finder-open');panel.inert=false;}
  panel.dataset.route=id;
  document.querySelectorAll('[data-route-page]').forEach(el=>{el.hidden=!el.dataset.routePage.split(' ').includes(id);});
  document.querySelectorAll('.site-nav a[href^="#"]').forEach(a=>{if(a.getAttribute('href')==='#'+id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  requestAnimationFrame(()=>{if(typeof alignFinderCopy==='function')alignFinderCopy();panel.scrollTo({top:0,behavior:'instant'});const heading=document.getElementById(id)?.querySelector('h2');if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}});
 }
 function closePanel(){closeMenu();opened=false;document.body.classList.remove('finder-open');panel.inert=true;document.querySelectorAll('.site-nav a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
 document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const hash=a.getAttribute('href');e.preventDefault();if(hash==='#top')closePanel();else openPanel(hash);}));
 document.addEventListener('shelf:navigate',e=>openPanel(e.detail));
 document.addEventListener('pointerdown',e=>{if(document.body.classList.contains('menu-open')&&!e.target.closest('.nav-actions'))closeMenu();});
 addEventListener('resize',()=>{if(innerWidth>820)closeMenu();},{passive:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('menu-open')){closeMenu();menuButton.focus();return;}if(e.key==='Escape'&&opened){closePanel();return;}if(opened&&e.key==='Tab'){const controls=[...document.querySelectorAll('.site-nav a,.site-nav button,.app-panel a,.app-panel button,.app-panel textarea,.app-panel [tabindex]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});

})();
