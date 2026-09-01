const catalog = [
  {id:'train',title:'The Great Train Robbery',year:1903,genre:'Western / Short',duration:12,rights:'Public domain',rightsBasis:'Published in the U.S. before 1931',source:'Library of Congress curated public-domain film collection',mediaUrl:''},
  {id:'within',title:'Within Our Gates',year:1920,genre:'Drama',duration:79,rights:'Public domain',rightsBasis:'Published in the U.S. before 1931',source:'Library of Congress curated public-domain film collection',mediaUrl:''},
  {id:'kiss',title:'The May Irwin Kiss',year:1896,genre:'Short',duration:1,rights:'Public domain',rightsBasis:'Published in the U.S. before 1931',source:'Library of Congress curated public-domain film collection',mediaUrl:''},
  {id:'earthquake',title:'San Francisco Earthquake and Fire',year:1906,genre:'Documentary / Short',duration:6,rights:'Public domain',rightsBasis:'Published in the U.S. before 1931',source:'Library of Congress curated public-domain film collection',mediaUrl:''},
  {id:'animal',title:'Animal Crackers',year:1930,genre:'Comedy',duration:97,rights:'Public domain in U.S.',rightsBasis:'1930 U.S. publication entered public domain Jan. 1, 2026',source:'U.S. Copyright Office / Library of Congress',mediaUrl:''},
  {id:'placeholder1',title:'Your Verified Film',year:1928,genre:'Mystery',duration:70,rights:'Needs source file',rightsBasis:'Example catalog slot — attach verified media only',source:'Admin verification required',mediaUrl:''},
  {id:'placeholder2',title:'Your Verified Serial',year:1926,genre:'Adventure',duration:21,rights:'Needs source file',rightsBasis:'Example catalog slot — attach verified media only',source:'Admin verification required',mediaUrl:''},
  {id:'placeholder3',title:'Your Verified Cartoon',year:1929,genre:'Animation',duration:8,rights:'Needs source file',rightsBasis:'Example catalog slot — attach verified media only',source:'Admin verification required',mediaUrl:''}
];

const channels = [
  {no:'01',name:'Retro TV',desc:'A rotating mix of classics',playlist:['train','within','animal']},
  {no:'02',name:'Classic Cinema',desc:'Features and silent landmarks',playlist:['within','animal','train']},
  {no:'03',name:'Midnight Matinee',desc:'Atmospheric late-night programming',playlist:['within','train']},
  {no:'04',name:'Western Trail',desc:'Frontier shorts and westerns',playlist:['train']},
  {no:'05',name:'Short Subjects',desc:'Newsreels, shorts and curiosities',playlist:['kiss','earthquake','train']}
];

const $ = s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
function item(id){return catalog.find(x=>x.id===id)}
function posterMarkup(m){return `<div class="poster"><span class="year">${m.year}</span><h3>${m.title}</h3><small>${m.genre}</small></div><div class="movie-info"><small>${m.duration} min · ${m.rights}</small><br><span class="badge">RIGHTS RECORDED</span></div>`}
function renderChannels(){ $('#channelGrid').innerHTML=channels.map(c=>`<article class="channel-card" data-channel="${c.no}"><span class="channel-no">CHANNEL ${c.no}</span><div><h3>${c.name}</h3><p>${c.desc}</p></div></article>`).join(''); $$('.channel-card').forEach(el=>el.onclick=()=>loadChannel(el.dataset.channel)); }
function renderLibrary(filter=''){const q=filter.toLowerCase();const list=catalog.filter(m=>`${m.title} ${m.genre} ${m.year}`.toLowerCase().includes(q));$('#libraryGrid').innerHTML=list.map(m=>`<article class="movie-card" data-id="${m.id}">${posterMarkup(m)}</article>`).join('');$$('.movie-card').forEach(el=>el.onclick=()=>playItem(item(el.dataset.id)));}
function renderGuide(){const now=new Date(); const base=new Date(now);base.setMinutes(0,0,0);$('#guideGrid').innerHTML=channels.map(c=>{let t=new Date(base); const programs=[0,1,2].map((_,i)=>{const m=item(c.playlist[i%c.playlist.length]);const start=t.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});t=new Date(t.getTime()+m.duration*60000);return `<div class="guide-program"><span class="time">${start}</span><strong>${m.title}</strong><small>${m.year} · ${m.genre}</small></div>`}).join('');return `<div class="guide-row"><div class="guide-channel"><strong>${c.no} ${c.name}</strong><span>${c.desc}</span></div>${programs}</div>`}).join('')}
function playItem(m){$('#nowTitle').textContent=m.title;$('#nowMeta').textContent=`${m.year} · ${m.genre} · ${m.rights}`;const v=$('#player'),p=$('#playerPlaceholder');if(m.mediaUrl){v.src=m.mediaUrl;v.style.display='block';p.style.display='none';v.play().catch(()=>{})}else{v.removeAttribute('src');v.load();v.style.display='none';p.style.display='grid';p.querySelector('p').textContent=`${m.title} is cataloged, but no media file is attached yet.`}switchView('live');}
function loadChannel(no){const c=channels.find(x=>x.no===no);playItem(item(c.playlist[0]));$('#upNextTitle').textContent=item(c.playlist[1%c.playlist.length]).title}
function switchView(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id===id));$$('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo({top:0,behavior:'smooth'})}
$$('.nav-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#search').oninput=e=>renderLibrary(e.target.value);$('#watchBtn').onclick=()=>loadChannel('01');renderChannels();renderLibrary();renderGuide();
