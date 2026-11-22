'use strict';
const $=id=>document.getElementById(id);
const navigateShelf=hash=>document.dispatchEvent(new CustomEvent('shelf:navigate',{detail:hash}));
let stages=[],refs=[],currentImage=null,uploadURL=null,busy=false;
const stageGroups=['All','时代少年团','TOP登陆少年组合','TFING','TF家族四代','SEVENTEEN','TWS','TXT','ENHYPEN','aespa','IVE'];
let selectedGroup='All',selectedYear='All',selectedEvent='All',selectedCast='All',catalogState='loading',searchMode='image';
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageAsset=path=>path?(/^(data:|https?:)/.test(path)?path:'assets/'+path):'';
const asset=s=>imageAsset(s.reference_image);
const coverAsset=s=>imageAsset(s.cover_image||s.reference_image);
function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片无法读取，请换一张 JPG、PNG 或 WebP 图片。'));im.src=src;});}
function features(im){const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,32,32);ctx.drawImage(im,0,0,32,32);const d=ctx.getImageData(0,0,32,32).data;const rgb=[],hist=Array(48).fill(0);for(let i=0;i<d.length;i+=4){for(let c=0;c<3;c++){rgb.push(d[i+c]/255);hist[c*16+Math.min(15,Math.floor(d[i+c]/16))]+=1/1024;}}return {rgb,hist};}
function distance(a,b){let pix=0,hist=0;for(let i=0;i<a.rgb.length;i++)pix+=Math.abs(a.rgb[i]-b.rgb[i]);for(let i=0;i<a.hist.length;i++)hist+=Math.abs(a.hist[i]-b.hist[i]);return .8*pix/a.rgb.length+.2*hist/6;}
function stageBadge(s){
 const event=String(s.event||'');
 if(event.includes('时代少年团')&&event.includes('四周年')&&event.includes('澳门'))return '时代少年团·四周年澳门站';
 if(event.includes('2026新年音乐会')&&event.includes('荣耀'))return '2026新音';
 return s.badge||s.session||event||'舞台';
}
function card(s,rank=null,note=null){const ev=s.event.replace('时代少年团叁重楼暨出道四周年演唱会「楼外楼」','四周年「楼外楼」· ');return `<article class="card"><div class="card-media"><img src="${rank!==null&&s.reference_image?asset(s):coverAsset(s)}" alt="${escapeHTML(s.song)}${rank!==null?'参考图':s.cover_image?'视频封面':'参考图'}" loading="lazy"><span class="badge">${escapeHTML(stageBadge(s))}</span></div><div class="card-body"><h3>${escapeHTML(s.song)}</h3><div class="people">${s.performers.map(escapeHTML).join(' / ')}</div><p class="event">${escapeHTML(ev)}</p>${note?`<p class="match-note">${escapeHTML(note)}</p>`:''}${rank!==null?`<p class="match-note">${rank===0?'画面最接近的候选':'其他可能的候选'} · 请对照参考图确认</p>`:''}<div class="tags">${(s.tags||s.visual_clues).slice(0,3).map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div><div class="actions"><a class="watch" href="${s.url}" target="_blank" rel="noopener noreferrer">看完整版</a><button class="secondary" data-explore="${s.id}">就是这个 · 看同场</button></div>${s.reference_image?`<button class="try" data-try="${s.id}">用舞台参考图试试</button>`:''}</div></article>`;}
function matchesGroup(stage,group){
 if(group==='All')return true;
 if(Array.isArray(stage.groups))return stage.groups.includes(group);
 return stage.performers.some(person=>person.toLowerCase().includes(group.toLowerCase()));
}
const castTypes={solo:'单人舞台',duo:'双人舞台',trio:'三人舞台',multi:'多人舞台',unknown:'人数待确认'};
function stageYear(stage){
 if(stage.year)return String(stage.year);
 const year=String(stage.performance_date||stage.event||'').match(/(?:19|20)\d{2}/);
 return year?year[0]:'unknown';
}
function stageCast(stage){
 if(Object.hasOwn(castTypes,stage.stage_type))return stage.stage_type;
 const people=stage.performers||[];
 if(!people.length||people.some(person=>/待核对|待确认|未知/.test(person)))return 'unknown';
 if(people.length===1&&(stageGroups.slice(1).includes(people[0])||/TEAM|组合|团体|全员/i.test(people[0])))return 'multi';
 return people.length===1?'solo':people.length===2?'duo':people.length===3?'trio':'multi';
}
function stageEvent(stage){return stage.event+(stage.session?' · '+stage.session:'');}
function eventLabel(stage){
 const event=stage.event;
 if(event.includes('四周年')&&event.includes('澳门'))return '时代少年团·四周年澳门站'+(stage.session?' · '+stage.session:'');
 if(event==='2026新年音乐会「荣耀」')return '2026新音「荣耀」'+(stage.session?' · '+stage.session:'');
 return stageEvent(stage);
}
function filteredStages(catalog=stages,filters={group:selectedGroup,year:selectedYear,event:selectedEvent,cast:selectedCast}){
 return catalog.filter(stage=>matchesGroup(stage,filters.group)&&
  (filters.year==='All'||stageYear(stage)===filters.year)&&
  (filters.event==='All'||stageEvent(stage)===filters.event)&&
  (filters.cast==='All'||stageCast(stage)===filters.cast));
}
function syncLibraryFilters(){
 const years=[...new Set(stages.map(stageYear))].sort((a,b)=>a==='unknown'?1:b==='unknown'?-1:Number(b)-Number(a));
 $('filter-year').innerHTML='<option value="All">全部年份</option>'+years.map(year=>'<option value="'+year+'">'+(year==='unknown'?'年份待确认':year+'年')+'</option>').join('');
 $('filter-year').value=selectedYear;
 const candidates=stages.filter(stage=>matchesGroup(stage,selectedGroup)&&(selectedYear==='All'||stageYear(stage)===selectedYear));
 const events=new Map(candidates.map(stage=>[stageEvent(stage),eventLabel(stage)]));
 if(selectedEvent!=='All'&&!events.has(selectedEvent))selectedEvent='All';
 $('filter-event').innerHTML='<option value="All">全部场次</option>'+[...events].map(([key,label])=>'<option value="'+escapeHTML(key)+'">'+escapeHTML(label)+'</option>').join('');
 $('filter-event').value=selectedEvent;$('filter-cast').value=selectedCast;
 $('clear-library-filters').disabled=selectedGroup==='All'&&selectedYear==='All'&&selectedEvent==='All'&&selectedCast==='All';
}
function showGroup(group='All'){
 selectedGroup=stageGroups.includes(group)?group:'All';
 $('library-filters').hidden=false;$('group-filters').hidden=false;
 document.querySelectorAll('[data-stage-group]').forEach(button=>{
  const active=button.dataset.stageGroup===selectedGroup;
  button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));
 });
 $('section-kicker').textContent='THE MATERIAL LIBRARY';$('section-title').textContent='物料库';
 $('section-desc').textContent='从已收录的舞台开始，找到完整版与同场内容。';
 $('reset').hidden=true;$('explore').hidden=true;
 if(catalogState!=='ready'){
  const failed=catalogState==='error';$('library-status').textContent=failed?'物料加载失败':'正在加载物料…';
  $('cards').innerHTML='<div class="empty">'+(failed?'物料暂时未能加载，请刷新页面重试。':'物料正在加载，请稍候。')+'</div>';return;
 }
 syncLibraryFilters();
 const matches=filteredStages(),labels=[selectedGroup==='All'?'全部组合':selectedGroup];
 if(selectedYear!=='All')labels.push(selectedYear==='unknown'?'年份待确认':selectedYear+'年');
 if(selectedEvent!=='All')labels.push($('filter-event').selectedOptions[0]?.textContent||selectedEvent);
 if(selectedCast!=='All')labels.push(castTypes[selectedCast]);
 $('library-status').textContent=labels.join(' · ')+' · '+matches.length+' 个舞台';
 $('cards').innerHTML=matches.length?matches.map(stage=>card(stage)).join(''):
  '<div class="empty group-empty"><span class="empty-mark" aria-hidden="true">⌕</span><strong>没有找到符合筛选条件的舞台</strong><p>试试其他年份、场次或人数，也可以清除筛选浏览全部物料。</p><button type="button" class="secondary" data-clear-library-filters>清除全部筛选</button></div>';
}
function showAll(){selectedYear='All';selectedEvent='All';selectedCast='All';showGroup('All');}

const normalizeSearch=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const groupAliases={
 '时代少年团':['TNT'],
 'TOP登陆少年组合':['TOP','登陆少年','TOP登陆少年'],
 'TFING':['TF_ING','TF-ING'],
 'TF家族四代':['四代','TF四代'],
 'SEVENTEEN':['SVT'],
 'TWS':[],
 'TXT':['TOMORROW X TOGETHER','투모로우바이투게더'],
 'ENHYPEN':['EN-','엔하이픈'],
 'aespa':['에스파'],
 'IVE':['아이브']
};
function textMatches(query,catalog=stages){
 const terms=[...new Set(String(query).trim().split(/[\s,，、。;；《》]+/u).map(normalizeSearch).filter(Boolean))];
 if(!terms.length)return [];
 const full=normalizeSearch(query);
 const exactGroup=stageGroups.slice(1).find(group=>[group,...(groupAliases[group]||[])].some(alias=>normalizeSearch(alias)===full));
 return catalog.map((stage,index)=>{
  if(exactGroup&&!matchesGroup(stage,exactGroup))return null;
  const fields=[
   ['歌曲名',[stage.song],8],['出演人员',stage.performers,5],
   ['团体',(stage.groups||[]).flatMap(g=>[g,...(groupAliases[g]||[])]),3],
   ['场次',[stage.event,stage.session,stage.badge,stageBadge(stage)],3],
   ['画面线索',stage.visual_clues||[],2]
  ].map(([label,values,weight])=>({label,values:values.map(normalizeSearch).filter(Boolean),weight}));
  const reasons=new Set();let score=0;
  for(const term of terms){const found=fields.filter(f=>f.values.some(v=>v.includes(term)));if(!found.length)return null;found.forEach(f=>{reasons.add(f.label);score+=f.weight;});}
  const song=normalizeSearch(stage.song);if(song===full)score+=80;else if(song.includes(full))score+=40;
  return {s:stage,index,score,reasons:[...reasons]};
 }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index);
}
function rankImageMatches(feature,referenceList,query=''){
 const hints=new Map(textMatches(query,referenceList.map(ref=>ref.s)).map(hit=>[hit.s.id,hit]));
 return referenceList.map(ref=>{
  const visual=distance(feature,ref.features),hint=hints.get(ref.s.id);
  // Text is an optional, bounded aid; it cannot turn a distant image into a visual match.
  return {s:ref.s,visual,score:visual-(hint?Math.min(.04,hint.score*.002):0),reasons:hint?hint.reasons:[]};
 }).sort((a,b)=>a.score-b.score||a.visual-b.visual);
}
function updateSearchButton(){
 const hasInput=searchMode==='text'?Boolean(normalizeSearch($('clue').value)):Boolean(currentImage&&refs.length);
 $('search').disabled=busy||catalogState!=='ready'||!hasInput;
}
function alignFinderCopy(){
 const workspace=document.querySelector('.workspace'),copy=document.querySelector('.finder-copy');
 if(!workspace||!copy||innerWidth<=820||!workspace.getBoundingClientRect().width)return;
 // Measure the text layout as the fixed reference for both search modes.
 const reference=workspace.cloneNode(true);
 reference.querySelector('#image-search-panel').hidden=true;
 reference.querySelector('#text-search-panel').hidden=false;
 reference.querySelector('#search-heading').textContent='从你记得的线索开始';
 reference.querySelector('#upload-formats').hidden=true;
 reference.querySelector('#matching-method').textContent='文字检索覆盖全部 '+stages.length+' 条已收录舞台，无需上传图片。';
 reference.querySelector('#message').textContent='';
 reference.setAttribute('aria-hidden','true');reference.inert=true;
 reference.style.cssText='position:absolute;visibility:hidden;pointer-events:none;top:0;left:0;width:'+workspace.getBoundingClientRect().width+'px;';
 workspace.parentElement.append(reference);
 copy.style.setProperty('--finder-copy-offset',Math.max(0,(reference.getBoundingClientRect().height-copy.getBoundingClientRect().height)/2)+'px');
 reference.remove();
}
addEventListener('resize',()=>requestAnimationFrame(alignFinderCopy),{passive:true});
if(document.fonts)document.fonts.ready.then(alignFinderCopy);
function setSearchMode(mode,moveFocus=false){
 searchMode=mode==='text'?'text':'image';
 const text=searchMode==='text';
 $('image-search-panel').hidden=text;$('text-search-panel').hidden=!text;
 for(const name of ['image','text']){const on=name===searchMode,tab=$(name+'-search-tab');tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;}
 $('search-heading').textContent=text?'从你记得的线索开始':'从你的截图开始';
 $('upload-formats').hidden=text;
 $('matching-method').textContent=text?'文字检索覆盖全部 '+stages.length+' 条已收录舞台，无需上传图片。':'仅对已收录参考图进行相似度匹配，可补充文字线索。结果请对照确认，截图仅在浏览器中处理。';
 $('message').textContent='';updateSearchButton();alignFinderCopy();if(moveFocus)$(text?'clue':'drop').focus();
}
function showSearchResults(title,description,markup,status=''){
 $('library-filters').hidden=true;$('group-filters').hidden=true;$('library-status').textContent=status;
 $('section-kicker').textContent='YOUR SEARCH';$('section-title').textContent=title;$('section-desc').textContent=description;
 $('cards').innerHTML=markup;$('reset').hidden=false;$('explore').hidden=true;
 navigateShelf('#collection');$('section-title').scrollIntoView({behavior:'smooth',block:'start'});
}

function preview(im,src){currentImage=im;$('preview').src=src;$('preview').hidden=false;$('placeholder').hidden=true;$('replace').hidden=false;updateSearchButton();}
async function acceptFile(file){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){$('message').textContent='请上传 JPG、PNG 或 WebP 图片；PDF 请先导出成图片。';return;}if(file.size>15*1024*1024){$('message').textContent='图片超过 15 MB，请缩小后再试。';return;}const url=URL.createObjectURL(file);try{const im=await loadImage(url);if(uploadURL)URL.revokeObjectURL(uploadURL);uploadURL=url;preview(im,url);$('message').textContent='截图已准备好，可以开始查找。';}catch(e){URL.revokeObjectURL(url);$('message').textContent=e.message;}}
$('filter-year').addEventListener('change',e=>{selectedYear=e.target.value;showGroup(selectedGroup);});
$('filter-event').addEventListener('change',e=>{selectedEvent=e.target.value;showGroup(selectedGroup);});
$('filter-cast').addEventListener('change',e=>{selectedCast=e.target.value;showGroup(selectedGroup);});
$('clear-library-filters').addEventListener('click',showAll);
document.addEventListener('click',e=>{if(e.target.closest('[data-clear-library-filters]'))showAll();});
$('file').addEventListener('change',e=>acceptFile(e.target.files[0]));$('drop').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}});
for(const ev of ['dragover','dragenter'])$('drop').addEventListener(ev,e=>{e.preventDefault();$('drop').classList.add('drag');});for(const ev of ['dragleave','drop'])$('drop').addEventListener(ev,e=>{e.preventDefault();$('drop').classList.remove('drag');if(ev==='drop')acceptFile(e.dataTransfer.files[0]);});

for(const name of ['image','text']){
 const tab=$(name+'-search-tab');tab.addEventListener('click',()=>setSearchMode(name));
 tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const mode=e.key==='Home'?'image':e.key==='End'?'text':searchMode==='image'?'text':'image';setSearchMode(mode);$(mode+'-search-tab').focus();}});
}
for(const id of ['clue','image-clue']){
 $(id).addEventListener('input',()=>{updateSearchButton();$('message').textContent='';});
 $(id).addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();if(!$('search').disabled)$('search').click();}});
}
$('search').addEventListener('click',async()=>{
 if(busy)return;if(catalogState!=='ready'){$('message').textContent='舞台资料仍在加载，请稍后再查找。';return;}
 if(searchMode==='text'&&!normalizeSearch($('clue').value))return;
 if(searchMode==='image'&&(!currentImage||!refs.length))return;
 busy=true;updateSearchButton();$('search').textContent=searchMode==='text'?'正在查找…':'正在对照参考图…';
 try{
  if(searchMode==='text'){
   const query=$('clue').value.trim(),ranked=textMatches(query);
   const markup=ranked.length?ranked.map(r=>card(r.s,null,'匹配：'+r.reasons.join('、'))).join(''):
    '<div class="empty"><strong>没有找到相关舞台</strong><p>试试更短的歌曲名、出演人员或场次关键词，<br>也可以先浏览已收录的物料。</p><button class="secondary" data-all>浏览全部舞台</button></div>';
   showSearchResults(ranked.length?'找到 '+ranked.length+' 个相关舞台':'没有找到相关舞台','按已记录的歌曲、出演人员、团体和场次关键词匹配，点击完整版确认。',markup,'文字检索 · '+query);
   $('message').textContent=ranked.length?'已找到 '+ranked.length+' 个相关舞台。':'暂无匹配结果，可以调整关键词再试。';
  }else{
   const query=$('image-clue').value.trim(),ranked=rankImageMatches(features(currentImage),refs,query).filter(x=>x.visual<=.16);
   const matched=ranked.length>0;
   const markup=matched?ranked.slice(0,3).map((x,i)=>card(x.s,i,x.reasons.length?'文字线索匹配：'+x.reasons.join('、'):null)).join(''):
    '<div class="empty"><strong>暂时没有找到足够接近的参考图</strong><p>这张截图暂未匹配到已收录的参考图。<br>可以切换文字检索，查找全部 '+stages.length+' 条物料。</p><button class="secondary" data-text-search>改用文字检索</button></div>';
   showSearchResults('对照一下，是这个舞台吗？',query?'依据已有参考截图的画面相似度，并结合选填文字线索辅助排序，请对照确认。':'依据已有参考截图的画面相似度排序，不代表已确认出处。',markup);
   $('message').textContent=matched?'已整理候选，请根据画面确认。':'图片暂未匹配，可以改用文字检索。';
  }
 }catch(e){$('message').textContent='查找失败，请稍后重试。';}
 finally{busy=false;$('search').textContent='找找这个舞台';updateSearchButton();}
});

document.addEventListener('click',async e=>{const trial=e.target.closest('[data-try]');if(trial){try{setSearchMode('image');const s=stages.find(x=>x.id===trial.dataset.try);const im=await loadImage(asset(s));preview(im,asset(s));$('image-clue').value='';$('message').textContent='已选用资料库参考图。你也可以上传自己的截图。';navigateShelf('#find');$('drop').scrollIntoView({behavior:'smooth',block:'center'});}catch(err){$('message').textContent=err.message;}}if(e.target.closest('[data-text-search]')){setSearchMode('text');navigateShelf('#find');$('clue').focus();}const ex=e.target.closest('[data-explore]');if(ex){const s=stages.find(x=>x.id===ex.dataset.explore);const related=stages.filter(x=>x.id!==s.id&&x.event===s.event&&x.session===s.session);$('explore-title').textContent='喜欢《'+s.song+'》，继续看同场';$('explore-desc').textContent=s.event+(s.session?' · '+s.session:'');$('related').innerHTML=related.map(x=>card(x)).join('')||'<p>这场活动暂时没有收录其他舞台。</p>';$('explore').hidden=false;$('explore').scrollIntoView({behavior:'smooth',block:'start'});}const group=e.target.closest('[data-profile-group]');if(group){showGroup(group.dataset.profileGroup);navigateShelf('#collection');}const filter=e.target.closest('[data-stage-group]');if(filter)showGroup(filter.dataset.stageGroup);const libraryLink=e.target.closest('a[href="#collection"]');if(libraryLink)showAll();if(e.target.closest('[data-all]'))showAll();});
$('reset').addEventListener('click',showAll);$('close-explore').addEventListener('click',()=>{$('explore').hidden=true;});
(async()=>{try{
 const res=await fetch('stages.json');if(!res.ok)throw Error();stages=await res.json();
 catalogState='ready';showGroup(selectedGroup);setSearchMode(searchMode);
 const referenceStages=stages.filter(s=>s.reference_image);
 $('catalog-edition').textContent='文字检索覆盖 '+stages.length+' 个舞台 · 涵盖 '+new Set(stages.flatMap(stage=>stage.groups||[])).size+' 个组合';
 $('catalog-footer-count').textContent='已收录 '+stages.length+' 个舞台 · 视频前往官方来源观看';
 const loaded=await Promise.allSettled(referenceStages.map(async s=>({s,features:features(await loadImage(asset(s)))})));
 refs=loaded.filter(r=>r.status==='fulfilled').map(r=>r.value);
 setSearchMode(searchMode);
 }catch(e){if(catalogState==='ready'){$('message').textContent='物料库已加载，参考截图暂未全部就绪。';return;}catalogState='error';showGroup(selectedGroup);$('message').textContent='舞台资料加载失败，请刷新页面重试。';}})();
