
(()=>{'use strict';
 const STORE='';
 let adminToken = ''; // Exists only in this page's JavaScript memory.
 let lastSave = Promise.resolve();
 const defaultData = JSON.parse(document.querySelector('#server-state')?.textContent || 'null');
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=> (crypto.randomUUID?.()||'x'+Date.now()+Math.random()).slice(0,18);
const slugify=s=>String(s||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'project';
const seed=()=>({hero:{},settings:{focus:'Software Engineer',enableEs:false,defaultTrack:'All',cvUrl:''},brand:{logo:'',favicon:''},projects:[],views:[],socials:[],experience:[],certificates:[],offers:[],customSections:[],media:[],messages:[],hardSkills:[],softSkills:[],sections:{},sectionsOrder:[]});
let db=defaultData||seed();
const ui={lang:(['en','ar','es'].includes(new URLSearchParams(location.search).get('lang'))?new URLSearchParams(location.search).get('lang'):'en'),authenticated:false,tab:'overview',modal:null,modalId:null,pendingCertImage:null,pendingProjectCoverId:null,filter:'All',gallery:0,analytics:null,analyticsLoading:false,analyticsError:'',analyticsDays:30,analyticsRequested:false,search:'',storeFilter:'All',storeCart:0,toastTimer:null,showAll:new URLSearchParams(location.search).get('projects')==='all'};
let transientVideos=new Map();ui.filter=db.settings.defaultTrack||'All';ui.galleryDirection='next';ui.lightbox=false;ui.zoom=1;ui.mediaPreviewId=null;ui.mediaDeleteWarning=null;ui.mediaDeleteBusy=false;ui.previewProjectId=null;
const vocab={
 en:{projects:'Projects',about:'About',skills:'Skills',certs:'Credentials',offers:'Offers',contact:'Contact',letsTalk:"Let's talk",available:'Available for opportunities',explore:'Explore projects',download:'Download CV',selected:'Selected work',featured:'Work that speaks for itself.',featuredSub:'Selected projects across product engineering and real-world problem solving.',all:'All',viewProject:'View case study',expertise:'Expertise',aboutTitle:'An engineer at heart.',skillsTitle:'Tools I build with.',hard:'Technical skills',soft:'Professional strengths',education:'Education',eduDegree:'B.Eng. Electronic Engineering',eduUni:'Menoufia University · 2026',certTitle:'Always learning.',offerLabel:'For future clients',offerTitle:'Ways we can work together.',offerBtn:'Discuss this offer',contactTitle:'Have something in mind?',contactSubtitle:'Tell me what you want to build. I would be happy to discuss the details.',name:'Your name',email:'Email address',message:'Project or message',send:'Send message',emailLink:'Email',whatsapp:'WhatsApp',back:'Back to projects',project:'Project',role:'My role',type:'Category',year:'Year',status:'Status',overview:'Overview',overviewTitle:'The idea behind it.',challenge:'The challenge',solution:'The approach',features:'Highlights',next:'Next project',projectCtaTitle:"Let's build your next project.",projectCtaText:'Need a reliable web application or backend system? I am open to new discussions.',contactMe:'Start a conversation',preview:'Interactive preview',photoLabel:'ENGINEERING • DESIGN • DELIVERY',notice:'Demo only — prices and terms are not confirmed commercial offers.',noResults:'No matching projects.',demo:'Open live demo',github:'Source code',photoAlt:'Portrait of software engineer Mohamed Maher',media:'Project showcase',galleryHelp:'Select an image or video thumbnail',mediaPlay:'Play project video',allWork:'Browse all projects',featuredOnly:'Show featured only'},
 ar:{projects:'المشاريع',about:'عني',skills:'المهارات',certs:'الشهادات',offers:'العروض',contact:'تواصل',letsTalk:'نتكلم عن مشروعك',available:'متاح لفرص العمل والتعاون',explore:'استكشف المشاريع',download:'تحميل السيرة الذاتية',selected:'أعمال مختارة',featured:'مشاريع تعبّر عن شغلي.',featuredSub:'مجموعة مختارة من المشاريع الهندسية والتطبيقات العملية.',all:'الكل',viewProject:'تفاصيل المشروع',expertise:'الخبرات',aboutTitle:'الهندسة قبل الكود.',skillsTitle:'أدواتي ومهاراتي.',hard:'المهارات التقنية',soft:'المهارات الشخصية',education:'التعليم',eduDegree:'بكالوريوس هندسة إلكترونية',eduUni:'جامعة المنوفية · 2026',certTitle:'التعلم المستمر.',offerLabel:'للعملاء المحتملين',offerTitle:'طرق مختلفة للتعاون.',offerBtn:'استفسر عن العرض',contactTitle:'عندك فكرة مشروع؟',contactSubtitle:'شاركني فكرتك ونقدر نتناقش في التفاصيل.',name:'اسمك',email:'البريد الإلكتروني',message:'رسالتك أو تفاصيل مشروعك',send:'إرسال الرسالة',emailLink:'البريد',whatsapp:'واتساب',back:'العودة للمشاريع',project:'مشروع',role:'دوري',type:'النوع',year:'السنة',status:'الحالة',overview:'نظرة عامة',overviewTitle:'الفكرة وراء المشروع.',challenge:'التحدي',solution:'الحل',features:'أهم المميزات',next:'المشروع التالي',projectCtaTitle:'عندك مشروع جديد؟',projectCtaText:'لو محتاج تطبيق ويب أو نظام باك إند يعتمد عليه، نقدر نتناقش.',contactMe:'ابدأ التواصل',preview:'معاينة تفاعلية',photoLabel:'هندسة • تصميم • تنفيذ',notice:'نموذج تجريبي فقط — الأسعار والشروط التجارية غير نهائية.',noResults:'لا توجد مشاريع مطابقة.',demo:'افتح الديمو',github:'الكود المصدري',photoAlt:'الصورة الشخصية للمهندس محمد ماهر',media:'معرض المشروع',galleryHelp:'اختار صورة أو فيديو من المصغرات',mediaPlay:'تشغيل فيديو المشروع',allWork:'استعرض كل المشاريع',featuredOnly:'إظهار الأعمال المختارة فقط'},
 es:{projects:'Proyectos',about:'Sobre mí',skills:'Habilidades',certs:'Certificados',offers:'Ofertas',contact:'Contacto',letsTalk:'Hablemos',available:'Disponible para oportunidades',explore:'Ver proyectos',download:'Descargar CV',selected:'Trabajos seleccionados',featured:'Proyectos destacados.',featuredSub:'Una selección de proyectos.',all:'Todos',viewProject:'Ver proyecto',expertise:'Experiencia',aboutTitle:'Ingeniería y creatividad.',skillsTitle:'Mis herramientas.',hard:'Habilidades técnicas',soft:'Habilidades personales',education:'Educación',eduDegree:'Ingeniería Electrónica',eduUni:'Universidad de Menoufia · 2026',certTitle:'Aprendizaje continuo.',offerLabel:'Para clientes',offerTitle:'Trabajemos juntos.',offerBtn:'Consultar oferta',contactTitle:'¿Tienes una idea?',contactSubtitle:'Conversemos sobre tu proyecto.',name:'Nombre',email:'Correo',message:'Mensaje',send:'Enviar',emailLink:'Correo',whatsapp:'WhatsApp',back:'Volver',project:'Proyecto',role:'Mi rol',type:'Categoría',year:'Año',status:'Estado',overview:'Resumen',overviewTitle:'Sobre el proyecto.',challenge:'El desafío',solution:'La solución',features:'Características',next:'Siguiente proyecto',projectCtaTitle:'Construyamos algo juntos.',projectCtaText:'Hablemos de tu proyecto.',contactMe:'Contactar',preview:'Vista previa',photoLabel:'INGENIERÍA • DISEÑO',notice:'Oferta ilustrativa sujeta a un acuerdo por escrito.',noResults:'Sin proyectos.',demo:'Ver demo',github:'Código',photoAlt:'Retrato de Mohamed Maher',media:'Galería',galleryHelp:'Selecciona una miniatura',mediaPlay:'Reproducir video',allWork:'Todos los proyectos',featuredOnly:'Solo destacados'}
};
const t=k=>vocab[ui.lang]?.[k]||vocab.en[k]||k;
const tr=(en,ar,es)=>ui.lang==='ar'?ar:ui.lang==='es'?(es||en):en;
function loc(o,k){return (ui.lang==='ar'&&o[k+'Ar'])||(ui.lang==='es'&&o[k+'Es'])||o[k]||''}
const pills=items=>`<div class="pills">${(items||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div>`;
const badge=(str,draft=false)=>`<span class="badge ${draft?'draft':''}">${esc(str)}</span>`;
// D1 lists media in ascending position (new uploads are inserted first).
// If every item provides an upload timestamp, use it explicitly instead.
function mediaNewestFirst(){
 const files=[...db.media];
 const stamp=m=>Date.parse(m.uploadedAt||m.createdAt||m.uploaded_at||m.created_at||'');
 if(files.length&&files.every(m=>Number.isFinite(stamp(m))))files.sort((a,b)=>stamp(b)-stamp(a));
 return files;
}
async function api(path,options={}){
 const headers={...options.headers};
 if(adminToken)headers.Authorization=`Bearer ${adminToken}`;
 if(options.body&&!(options.body instanceof Blob)&&typeof options.body!=='string'){
   headers['Content-Type']='application/json';options.body=JSON.stringify(options.body);
 }
 const res=await fetch(path,{...options,headers,cache:'no-store'});
 let payload=null;
 try{payload=await res.json()}catch{}
 if(!res.ok){const err=new Error(payload?.error||`HTTP ${res.status}`);err.status=res.status;err.details=payload;throw err;}
 return payload;
}
function save(){
 if(!adminToken){toast('Unlock the dashboard to save changes');return false}
 const snapshot=JSON.stringify(db);
 lastSave=lastSave.catch(()=>{}).then(async()=>{
   await api('/api/admin/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:snapshot});
   return true;
 }).catch(err=>{console.error(err);toast('Save failed: '+err.message);return false});
 return true;
}
async function uploadPreparedMedia(file){
 if(!adminToken||!ui.authenticated)throw new Error('Unlock the dashboard before uploading');
 if(file.size>90*1024*1024)throw new Error('Maximum 90 MiB per file');
 return api('/api/admin/files?name='+encodeURIComponent(file.name),{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
}
async function editAndUploadOne(file,upload,options={}){
 if(!adminToken||!ui.authenticated)throw new Error('Unlock the dashboard before uploading');
 const session=adminToken;
 const {openMediaStudio}=await import('/media-studio.js');
 const batch=await openMediaStudio([file],async prepared=>{
  if(!ui.authenticated||adminToken!==session)throw new Error('Admin session ended');
  const item=await upload(prepared);
  if(adminToken!==session)throw new Error('Admin session ended');
  return item;
 },options);
 if(!batch.uploaded.length)throw new Error(batch.failures[0]?.message||'Upload cancelled');
 return batch.uploaded[0];
}
async function uploadMedia(file,options={}){
 // Documents (including CV PDFs) still use the existing direct upload path.
 if(!/^(image|video)\//i.test(file.type))return uploadPreparedMedia(file);
 return editAndUploadOne(file,uploadPreparedMedia,options);
}
function cvEntries(){
 const result=[...(db.settings.cvs||[])].filter(c=>c?.title&&c.mediaId&&c.id);
 if(db.settings.cvUrl&&!result.some(c=>c.src===db.settings.cvUrl))result.unshift({id:'legacy',title:'General CV',legacy:true});
 return result;
}
function cvButtons(){
 const list=cvEntries();if(!list.length)return '';
 const href=c=>c.legacy?'/cv':`/cv/${encodeURIComponent(c.id)}`;
 if(list.length===1)return `<a class="btn ghost" href="${esc(href(list[0]))}">${esc(list[0].title)} ↓</a>`;
 return `<details class="cv-picker"><summary class="btn ghost">${t('download')} ▾</summary><div class="cv-options">${list.map(c=>`<a href="${esc(href(c))}">${esc(c.title)} ↓</a>`).join('')}</div></details>`;
}
function tagField(name,label,values=[],delimiter='comma',rtl=false){
 const all=Array.isArray(values)?values:String(values||'').split(delimiter==='newline'?/\r?\n/:/,/);
 const clean=[...new Set(all.map(x=>String(x).trim()).filter(Boolean))];
 const join=delimiter==='newline'?'\n':',';
 return `<div class="field"><label>${esc(label)}</label><div class="tag-editor" data-delimiter="${delimiter}" ${rtl?'dir="rtl"':''}>
  <div class="tag-list">${clean.map(x=>`<button type="button" class="tag-chip" data-action="remove-tag" title="Remove this item" aria-label="Remove ${esc(x)}">${esc(x)} <span aria-hidden="true">×</span></button>`).join('')}</div>
  <input class="tag-entry" autocomplete="off" placeholder="Type and press Enter" aria-label="${esc(label)}">
  <input type="hidden" name="${esc(name)}" value="${esc(clean.join(join))}">
 </div><small class="tag-help">Enter to add · click a tag to remove · paste a list</small></div>`;
}
function tagValues(editor){return [...editor.querySelectorAll('.tag-chip')].map(x=>x.firstChild.textContent.trim())}
function syncTags(editor){const sep=editor.dataset.delimiter==='newline'?'\n':',';editor.querySelector('input[type="hidden"]').value=tagValues(editor).join(sep)}
function addTags(editor,raw){
 const input=editor.querySelector('.tag-entry'),values=String(raw||'').split(editor.dataset.delimiter==='newline'?/\r?\n/:/[,\r\n]+/).map(x=>x.trim()).filter(Boolean);
 const existing=new Set(tagValues(editor).map(x=>x.toLowerCase()));
 const list=editor.querySelector('.tag-list');
 for(const v of values){if(existing.has(v.toLowerCase()))continue;existing.add(v.toLowerCase());
  const btn=document.createElement('button');btn.type='button';btn.className='tag-chip';btn.dataset.action='remove-tag';btn.title='Remove this item';btn.setAttribute('aria-label','Remove '+v);btn.append(document.createTextNode(v+' '));const mark=document.createElement('span');mark.setAttribute('aria-hidden','true');mark.textContent='×';btn.append(mark);list.append(btn)
 }
 input.value='';syncTags(editor);
}
function art(p,mode=''){
 const tone=['blue','gold','rose','violet'].includes(p.tone)?p.tone:'blue',v=Number.isInteger(p.mockVariant)?p.mockVariant:0;
 let content='';
 if(v===1||v===3){content=`<div class="mock-table"><div class="mock-table-head"><i></i><i></i><i></i></div>${Array.from({length:v===1?5:6},(_,i)=>`<div class="mock-table-row"><span class="mock-table-dot" style="background:${i%2?'#7f9fea':'#8ec4be'}"></span><i></i><i></i><b></b></div>`).join('')}</div>`}
 else if(v===4){content=`<div class="mock-products-grid">${Array.from({length:6},(_,i)=>`<div class="mock-product"><span style="background:${['#9ebbf0','#b4a9e9','#9bcac5','#edbbcb'][i%4]}"></span><i></i><b></b></div>`).join('')}</div>`}
 else if(v===5){content=`<div class="mock-reports"><div class="mock-donut"></div><div class="mock-report-legend"><i></i><i></i><i></i><i></i></div></div><div class="mock-chart">${[38,69,54,94,75,57,84].map(h=>`<i style="height:${h}%"></i>`).join('')}</div>`}
 else if(v===6){content=`<div class="mock-kanban">${[0,1,2].map((z)=>`<div>${Array.from({length:z===1?4:3},()=>'<i></i>').join('')}</div>`).join('')}</div>`}
 else if(v===7){content=`<div class="mock-phone"><div class="mock-phone-notch"></div><div class="mock-phone-hero"></div>${Array.from({length:4},()=>'<i></i>').join('')}</div>`}
 else {const values=v===2?[68,34,86,48,91,58,75,95]:[36,55,42,84,62,96,75,90];content=`<div class="mock-metrics"><i></i><i></i><i></i></div><div class="mock-chart">${values.map(h=>`<i style="height:${h}%"></i>`).join('')}</div><div class="mock-rows"><i></i><i></i><i></i></div>`}
 return `<div class="art ${esc(tone)} ${mode}"><div class="mock-browser"><div class="mock-top"><i></i><i></i><i></i></div><div class="mock-ui"><div class="mock-side"><i></i><i></i><i></i><i></i></div><div class="mock-body"><div class="mock-line"></div>${content}</div></div></div><span class="art-mark">${esc(p.title||'PORTFOLIO')}</span></div>`;
}
function brandMark(){return db.brand.logo?`<span class="brand-mark logo-custom"><img src="${esc(db.brand.logo)}" alt=""></span>`:`<span class="brand-mark">M<span>.</span></span>`}
function sectionName(key){const defaults={projects:'Projects',about:'About me',experience:'Experience',skills:'Skills',education:'Education',certificates:'Certificates',offers:'Offers',contact:'Contact'};return db.customSections.find(x=>x.id===key)?.title||defaults[key]||key}
function mediaAlt(m,fallback){return m?(loc(m,'alt')||fallback):fallback}
function relatedProjects(p){return db.projects.filter(x=>x.published&&x.id!==p.id).map(x=>({p:x,score:(x.tracks||[]).filter(t=>(p.tracks||[]).includes(t)).length*3+(x.category===p.category?1:0)})).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.p)}
function brandedFavicon(){const src=db.brand.favicon||db.brand.logo||'/favicon.png';let icon=document.querySelector('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.href=src}
function localizedLines(p,key){return ui.lang==='es'&&p[key+'Es']?.length?p[key+'Es']:ui.lang==='ar'&&p[key+'Ar']?.length?p[key+'Ar']:p[key]||[]}
function projectExtraLinks(p){const a=[...(p.links||[])];if(p.demo)a.unshift({label:tr('Live demo','الديمو','Demo en vivo'),url:p.demo});if(p.github)a.push({label:'GitHub',url:p.github});return a}
function projectLinkHref(u){return u?.startsWith('/demos/')?u:cleanUrl(u||'')}
function genericSection(x){const layout=['cards','timeline','stats','quotes','faq','list'].includes(x.layout)?x.layout:'cards',items=x.items||[];const card=(it,i)=>{const name=esc(loc(it,'title')),desc=esc(loc(it,'description')),meta=esc(it.meta||''),value=esc(it.value||String(i+1).padStart(2,'0')),media=it.image?`<img class="generic-item-img" src="${esc(it.image)}" alt="${esc(loc(it,'alt')||loc(it,'title'))}" decoding="async" loading="lazy">`:'';const link=it.link&&cleanUrl(it.link)!=='#'?`<a class="generic-item-link" href="${esc(cleanUrl(it.link))}" target="_blank" rel="noopener">${tr('Learn more','المزيد','Ver más')} ↗</a>`:'';if(layout==='faq')return `<details class="faq-item"><summary>${name}<span>＋</span></summary><p>${desc}</p></details>`;if(layout==='timeline')return `<article class="timeline-item"><span class="timeline-num">${value}</span><div><h3>${name}</h3><p>${desc}</p>${link}</div></article>`;if(layout==='stats')return `<article class="generic-card stat-generic"><div class="generic-value">${value}</div><h3>${name}</h3><p>${desc}</p><small>${meta}</small></article>`;if(layout==='quotes')return `<article class="generic-card quote-generic"><div class="generic-quote-mark">❝</div><p>${desc}</p><strong>${name}</strong><small>${meta}</small></article>`;return `<article class="generic-card ${layout==='list'?'list-generic':''}">${media}<span class="generic-icon">${esc(it.icon||'✦')}</span><h3>${name}</h3><p>${desc}</p>${meta?`<small>${meta}</small>`:''}${link}</article>`};return `<section class="section generic-section ${layout==='quotes'?'generic-tinted':''}" id="${esc(x.id)}"><div class="wrap"><div class="section-bar"><div><span class="eyebrow">${esc(loc(x,'eyebrow')||'MORE')}</span><h2 class="section-title">${esc(loc(x,'title'))}</h2><p class="section-intro">${esc(loc(x,'description'))}</p></div></div><div class="generic-grid generic-${layout}">${items.map(card).join('')}</div></div></section>`}
function nav(){const langButtons=['en','ar',...(db.settings.enableEs?['es']:[])].map(l=>`<button class="language ${ui.lang===l?'active':''}" data-lang="${l}" aria-label="Switch to ${l}">${l.toUpperCase()}</button>`).join('');return `<header class="public-header"><div class="wrap"><nav class="site-nav"><a class="brand" href="/">${brandMark()}<span><span class="brand-name">Mohamed Maher</span><span class="brand-sub" style="display:block">${esc(db.settings.focus)}</span></span></a><div class="nav-links"><a href="/#projects">${t('projects')}</a><a href="/#about">${t('about')}</a><a href="/#skills">${t('skills')}</a><a href="/#offers">${t('offers')}</a><a href="/#contact">${t('contact')}</a></div><div class="nav-actions"><div class="languages">${langButtons}</div><a class="btn sm primary" href="/#contact">${t('letsTalk')} <span>↗</span></a></div></nav></div></header>`}
function footer(){return `<footer class="site-footer wrap"><div><b>Mohamed Maher<span class="accent">.</span></b><br><small>© 2026 · Software Engineering</small></div><div class="footer-links"><a href="/#projects">${t('projects')}</a><a href="/#offers">${t('offers')}</a><a href="/#contact">${t('contact')}</a></div><div class="footer-note">Built with intention. <span class="accent">✦</span></div></footer>`}
function portrait(){const h=db.hero,bg=h.portraitBgMode==='solid'?h.portraitBg1:`linear-gradient(${Number(h.portraitBgAngle)||145}deg,${h.portraitBg1},${h.portraitBg2})`;return `<div class="portrait-frame" style="--portrait-user-bg:${esc(bg)}"><div class="portrait-grain"></div>${db.hero.portrait?`<img class="portrait-image" src="${esc(db.hero.portrait)}" alt="${esc(loc(db.hero,'portraitAlt')||tr('Portrait of Mohamed Maher','صورة محمد ماهر'))}" fetchpriority="high" decoding="async">`:`<div class="portrait-fallback"><div class="portrait-orb orb-one"></div><div class="portrait-orb orb-two"></div></div>`}${h.portraitBadge?`<div class="portrait-glass"><span class="portrait-online"><i></i> ${esc(db.settings.focus||'SOFTWARE ENGINEERING')}</span><strong>${esc(loc(h,'portraitBadgeText'))}</strong><span>Portfolio / 2026 ↗</span></div>`:''}</div>`}
function homeProjectCount(value){
 const count=Number(value);
 return Number.isInteger(count)&&count>=5?count:5;
}
function videoPreviewSource(src){return src.split('#',1)[0]+'#t=0.2'}
function videoThumbnail(src,showPlay=false){
 return `<video class="video-thumbnail" src="${esc(videoPreviewSource(src))}" muted playsinline preload="auto" aria-hidden="true" tabindex="-1"></video>${showPlay?'<span class="video-pill" aria-hidden="true">▶</span>':''}`;
}
function coverArt(p){
 const ids=[p.coverMediaId,...(p.mediaIds||[])].filter(Boolean);
 const item=ids.map(id=>db.media.find(m=>m.id===id&&m.type?.startsWith('image/'))).find(Boolean);
 const video=ids.map(id=>db.media.find(m=>m.id===id&&m.type?.startsWith('video/'))).find(m=>m?.src);
 return item?.src ? `<img class="project-cover-image" src="${esc(item.src)}" alt="${esc(mediaAlt(item,loc(p,'title')+' project cover'))}" loading="lazy" decoding="async">`
   : video ? videoThumbnail(video.src) : `<div class="cover-gradient cover-empty theme-${['blue','gold','rose','violet'].includes(p.tone)?p.tone:'blue'}" aria-label="No project cover uploaded"><div class="cover-pattern"></div></div>`;
}
function projectCard(p){return `<a class="project-card" href="/projects/${encodeURIComponent(p.id)}"><div class="card-poster">${coverArt(p)}<span class="card-numeral">${esc(p.year)}</span></div><div class="card-body"><div class="card-kicker"><span>${esc(loc(p,'category'))}</span><span class="card-arrow">↗</span></div><h3>${esc(loc(p,'title'))}</h3><p>${esc(loc(p,'summary'))}</p><div class="pills">${(p.tracks||[]).slice(0,3).map(x=>`<span class="pill pill-track">${esc(x)}</span>`).join('')}</div></div></a>`}
// All icons are inline SVGs, so social links work without third-party icon fonts or CDNs.
// Only fixed SVG markup is interpolated; user-provided labels/URLs remain escaped.
const socialIconShapes={
 phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.49 19.49 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.79a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.83.57 2.79.7A2 2 0 0 1 22 16.92Z"/>',
 email:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
 whatsapp:'<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.5 14.6l-.4-.2-2.3.6.6-2.3-.2-.4A8 8 0 0 1 12 4Zm-3 3c-.8 0-1.4.7-1.4 1.6 0 2.8 3.4 6.3 6.6 7.1 1.3.3 2.5-.3 2.5-1.4v-.6l-2.5-1.2-.9 1a7 7 0 0 1-3.3-3.2l.7-.9L9.8 7H9Z"/>',
 telegram:'<path fill="currentColor" stroke="none" d="M21.5 4.1 2.9 11.3c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.9 5.8c.2.7.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3-15.4c.3-1.2-.5-1.8-1.5-1.6ZM9.2 14l10.1-6.4c.5-.3.9-.1.5.2l-8.3 7.5-.3 3.3Z"/>',
 tiktok:'<path fill="currentColor" stroke="none" d="M16.8 2h-3.7v12.4a3.4 3.4 0 1 1-3.4-3.4c.35 0 .7.05 1.02.15V7.4a7.1 7.1 0 1 0 6.08 7.02V8.1A8.1 8.1 0 0 0 22 9.7V6a4.5 4.5 0 0 1-5.2-4Z"/>',
 facebook:'<path fill="currentColor" stroke="none" d="M13.36 22v-8.75h2.94l.44-3.5h-3.38V7.52c0-1.01.28-1.7 1.69-1.7h1.81V2.69A24.3 24.3 0 0 0 14.22 2C11.6 2 9.8 3.6 9.8 6.55v3.2H6.85v3.5H9.8V22h3.56Z"/>',
 instagram:'<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.65" cy="6.5" r="1.15" fill="currentColor" stroke="none"/>',
 youtube:'<rect x="2" y="5.4" width="20" height="13.2" rx="4"/><path d="m10 9 5.5 3-5.5 3V9Z" fill="currentColor" stroke="none"/>',
 linkedin:'<path fill="currentColor" stroke="none" d="M4.98 3.5a2.08 2.08 0 1 0 0 4.16 2.08 2.08 0 0 0 0-4.16ZM3.3 9.1h3.35V21H3.3V9.1Zm5.45 0h3.2v1.63H12a3.55 3.55 0 0 1 3.2-1.83c3.43 0 4.07 2.26 4.07 5.18V21h-3.34v-6.13c0-1.46-.03-3.33-2.03-3.33-2.04 0-2.35 1.6-2.35 3.22V21H8.75V9.1Z"/>',
 github:'<path fill="currentColor" stroke="none" d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.49.5.092.683-.217.683-.483 0-.238-.01-.87-.015-1.707-2.782.605-3.369-1.18-3.369-1.18-.454-1.155-1.11-1.462-1.11-1.462-.91-.622.069-.609.069-.609 1.006.071 1.535 1.033 1.535 1.033.895 1.533 2.349 1.09 2.922.833.091-.648.35-1.09.636-1.34-2.22-.253-4.555-1.11-4.555-4.942 0-1.092.39-1.984 1.03-2.684-.103-.253-.447-1.272.098-2.65 0 0 .84-.269 2.75 1.025A9.6 9.6 0 0 1 12 6.84c.85.004 1.705.115 2.504.337 1.909-1.294 2.748-1.025 2.748-1.025.547 1.378.202 2.397.1 2.65.64.7 1.028 1.592 1.028 2.684 0 3.842-2.338 4.687-4.566 4.933.359.31.679.92.679 1.855 0 1.34-.012 2.42-.012 2.75 0 .267.18.58.688.482A10.013 10.013 0 0 0 22 12c0-5.523-4.477-10-10-10Z"/>',
 x:'<path d="m4 3 16 18M20 3 4 21" stroke-width="2.2"/>',
 twitter:'<path fill="currentColor" stroke="none" d="M21.6 6.1c-.7.3-1.4.5-2.2.6a3.7 3.7 0 0 0 1.6-2.1c-.7.4-1.5.7-2.4.9a3.7 3.7 0 0 0-6.3 3.4c0 .3 0 .6.1.9a10.5 10.5 0 0 1-7.6-3.8 3.7 3.7 0 0 0 1.1 4.9c-.6 0-1.1-.2-1.7-.5v.1a3.7 3.7 0 0 0 3 3.6c-.6.2-1.2.2-1.7.1a3.7 3.7 0 0 0 3.5 2.6 7.5 7.5 0 0 1-4.6 1.6c-.3 0-.6 0-.9-.1a10.6 10.6 0 0 0 5.8 1.7c7 0 10.8-5.8 10.8-10.8v-.5c.7-.5 1.3-1.1 1.8-1.8Z"/>',
 discord:'<path d="M7.4 6.2 9 5.6l.6 1.1c1.6-.3 3.2-.3 4.8 0l.6-1.1 1.6.6c1.9 2.5 2.5 5.2 2.2 8.9-1.3 1-2.4 1.6-3.7 2.1l-.9-1.4m-7.4 0-.9 1.4c-1.3-.5-2.5-1.1-3.7-2.1-.3-3.7.3-6.4 2.2-8.9"/><path d="M8.5 15.8c2.3 1.4 4.7 1.4 7 0"/><circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
 pinterest:'<circle cx="12" cy="12" r="9"/><path d="m9.7 19.9 2.2-8.8c-.4-1.5.3-3.3 2.2-3.3 1.5 0 2.1 1 1.8 2.3-.3 2-1.9 5.3-4.4 4.5-1.4-.4-2-2.3-1.6-4.1.8-3.9 5.6-5.1 8.3-2.4 3.1 3.1 1.2 9.4-3.5 10.1"/>',
 snapchat:'<path d="M12 3.2c-2.9 0-4.9 2.2-4.9 5.4v2.8c-.7-.2-1.4-.8-2-.3-.5.5.2 1 1.1 1.4.9.4 1 1.1.5 1.9-.8 1.3-2.2 2.3-3.6 2.7.8.8 2 1 3 1.3.6.2.8 1.1 1 1.5 1.6-.3 3.1-.2 4.9 1.1 1.8-1.3 3.3-1.4 4.9-1.1.2-.4.4-1.3 1-1.5 1-.3 2.2-.5 3-1.3-1.4-.4-2.8-1.4-3.6-2.7-.5-.8-.4-1.5.5-1.9.9-.4 1.6-.9 1.1-1.4-.6-.5-1.3.1-2 .3V8.6c0-3.2-2-5.4-4.9-5.4Z"/>',
 reddit:'<circle cx="12" cy="14" r="7.5"/><circle cx="9" cy="13.7" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="13.7" r=".9" fill="currentColor" stroke="none"/><path d="M9.5 16.7c1.7 1.2 3.3 1.2 5 0M12 6.5l1.7-3.3 3.2.6"/><circle cx="18.3" cy="8.3" r="1.5"/>',
 threads:'<circle cx="12" cy="12" r="9"/><path d="M16.5 9.3c-.7-2.3-2.3-3.3-4.5-3.3-3.7 0-5.1 2.8-5.1 6.2 0 3.6 1.8 5.9 5.1 5.9 3.2 0 4.7-1.8 4.7-4.4 0-2.2-1.8-3.4-4.2-3.4-1.6 0-2.7.7-2.7 2.1 0 1.3 1.1 2 2.4 2 2.8 0 4.3-2.1 4.3-4.8"/>',
 website:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
 link:'<path d="M10 13.5a5 5 0 0 0 7.5.5l2.1-2.1a5 5 0 0 0-7.1-7.1l-1.2 1.2M14 10.5a5 5 0 0 0-7.5-.5L4.4 12a5 5 0 0 0 7.1 7.1l1.2-1.2"/>'
};
const socialIconHosts=[
 ['whatsapp',['wa.me','whatsapp.com']],['telegram',['t.me','telegram.me','telegram.org']],
 ['tiktok',['tiktok.com']],['facebook',['facebook.com','fb.com','fb.me']],
 ['instagram',['instagram.com']],['youtube',['youtube.com','youtu.be']],
 ['linkedin',['linkedin.com']],['github',['github.com']],['x',['x.com']],
 ['twitter',['twitter.com']],['discord',['discord.com','discord.gg']],
 ['pinterest',['pinterest.com']],['snapchat',['snapchat.com']],['reddit',['reddit.com']],
 ['threads',['threads.com','threads.net']]
];
const socialIconLabels=[
 ['whatsapp',/whats\s?app|واتس/],['telegram',/telegram|تل[ي]?جرام|تيليجرام/],
 ['tiktok',/tik\s?tok|تيك\s?توك/],['facebook',/facebook|فيس\s?بوك/],
 ['instagram',/instagram|insta|انست[اجغ]?رام|إنست[اجغ]?رام/],
 ['youtube',/youtube|يوتيوب/],['linkedin',/linked\s?in|لينكد/],
 ['github',/git\s?hub|جيت\s?هاب|جيت\s?هب/],
 ['twitter',/twitter|تويتر/],['x',/^x$|^إكس$/],
 ['discord',/discord|ديسكورد/],['pinterest',/pinterest|بنترست/],
 ['snapchat',/snapchat|سناب/],['reddit',/reddit|ريديت/],
 ['threads',/threads|ثريدز/],['phone',/phone|mobile|call|telephone|تليفون|تلفون|هاتف|موبايل|اتصال|رقم\s?(الهاتف|التليفون)/],
 ['email',/e-?mail|بريد|ايميل|إيميل/],['website',/website|web\s?site|portfolio|موقع/]
];
function socialIconType(label,url){
 let parsed;
 try{parsed=new URL(url)}catch{return 'link'}
 if(parsed.protocol==='tel:')return 'phone';
 if(parsed.protocol==='mailto:')return 'email';
 if(!['http:','https:'].includes(parsed.protocol))return 'link';
 const host=parsed.hostname.toLowerCase().replace(/^www\./,'');
 for(const [type,domains] of socialIconHosts){
  if(domains.some(domain=>host===domain||host.endsWith('.'+domain)))return type;
 }
 const name=String(label||'').toLowerCase().trim();
 for(const [type,pattern] of socialIconLabels)if(pattern.test(name))return type;
 return 'website';
}
function socialIcon(label,url){
 const type=socialIconType(label,url);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${socialIconShapes[type]||socialIconShapes.link}</svg>`;
}
function socialLinks(){
 return db.socials.map(s=>({label:s.label||'',url:cleanUrl(s.url)})).filter(s=>s.url!=='#').map(s=>{
  const external=/^https?:/i.test(s.url);
  return `<a class="social-chip" href="${esc(s.url)}" ${external?'target="_blank" rel="noopener noreferrer"':''}><span class="social-glyph">${socialIcon(s.label,s.url)}</span>${esc(s.label)} <span aria-hidden="true">↗</span></a>`;
 }).join('');
}
function certVisual(c,i){const src=c.image||"";return src?`<div class="cert-image"><img src="${esc(src)}" alt="${esc(loc(c,'alt')||loc(c,'title')+' certificate')}" decoding="async" loading="lazy" fetchpriority="low"><span class="cert-img-badge">✦ Credential</span></div>`:``}
function certificatePostUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)return '';
 try{
  const u=new URL(raw.trim()),host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password)return '';
  if(host==='lnkd.in'&&/^\/(?:p\/)?[a-z0-9_-]+\/?$/i.test(u.pathname))return u.href;
  if((host==='linkedin.com'||host.endsWith('.linkedin.com'))&&/^\/(?:posts\/|feed\/update\/)/i.test(u.pathname))return u.href;
 }catch{}
 return '';
}
function moveCertificateCarousel(direction){
 const track=$('.cert-carousel-track'),card=track?.querySelector('.cert-card');
 if(!track||!card)return;
 const step=card.getBoundingClientRect().width+(parseFloat(getComputedStyle(track).columnGap)||18);
 const rtl=getComputedStyle(track).direction==='rtl'?-1:1;
 track.scrollBy({left:direction*rtl*step,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function openCertificateViewer(id){
 const c=db.certificates.find(item=>item.id===id);
 if(!c?.image)return;
 const old=document.querySelector('.certificate-viewer');if(old)old.close();
 const modal=document.createElement('dialog');
 modal.className='certificate-viewer';
 modal.setAttribute('aria-label',loc(c,'title')||'Certificate');
 modal.innerHTML=`<div class="certificate-viewer-panel"><div class="certificate-viewer-bar"><strong>${esc(loc(c,'title'))}</strong><button type="button" class="certificate-viewer-close" aria-label="${tr('Close certificate','إغلاق الشهادة','Cerrar certificado')}">✕</button></div><div class="certificate-viewer-content"><img src="${esc(c.image)}" alt="${esc(loc(c,'alt')||loc(c,'title')+' certificate')}" decoding="async"></div></div>`;
 modal.addEventListener('click',event=>{if(event.target===modal)modal.close()});
 modal.querySelector('.certificate-viewer-close').addEventListener('click',()=>modal.close());
 modal.addEventListener('close',()=>modal.remove(),{once:true});
 document.body.append(modal);
 modal.showModal();
}
function certificateMock(c,i){const colors=[['#e4eaff','#3546ae'],['#e8e8f7','#4d4c86'],['#e7f1f3','#277988'],['#f9ede8','#9a6550']][i%4],text=esc(c.issuer||'CERTIFICATE').replace(/&/g,'&amp;');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="850" height="550" viewBox="0 0 850 550"><rect width="850" height="550" fill="${colors[0]}"/><rect x="40" y="40" width="770" height="470" rx="26" fill="#fff" stroke="${colors[1]}" stroke-opacity=".15" stroke-width="3"/><circle cx="697" cy="137" r="53" fill="${colors[0]}"/><path d="M697 98l12 27 30 3-23 21 6 30-25-14-26 14 6-30-23-21 31-3z" fill="${colors[1]}"/><text x="85" y="126" font-size="18" font-family="Arial" fill="${colors[1]}" font-weight="700" letter-spacing="6">CERTIFICATE</text><rect x="85" y="158" width="145" height="5" rx="3" fill="${colors[1]}"/><text x="85" y="282" font-size="54" font-family="Arial" fill="#17243a" font-weight="700">Achievement</text><text x="85" y="333" font-size="25" font-family="Arial" fill="#5f7085">Verified learning &amp; training</text><text x="85" y="453" font-size="23" font-family="Arial" fill="${colors[1]}">${text.slice(0,32)}</text><path d="M670 464h96" stroke="${colors[1]}" stroke-width="4"/></svg>`;return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg)}
function moveIn(key,id,direction){const items=db[key],n=items.findIndex(x=>x.id===id),to=n+direction;if(n<0||to<0||to>=items.length)return;[items[n],items[to]]=[items[to],items[n]];save();render(true)}
function moveSection(key,direction){const n=db.sectionsOrder.indexOf(key),to=n+direction;if(n<0||to<0||to>=db.sectionsOrder.length)return;[db.sectionsOrder[n],db.sectionsOrder[to]]=[db.sectionsOrder[to],db.sectionsOrder[n]];save();render(true)}
function orderButtons(key,id,i,total){return `<div class="order-actions"><button class="order-btn" title="Move up" aria-label="Move up" data-action="move-${key}" data-id="${esc(id)}" data-value="-1" ${i===0?'disabled':''}>↑</button><button class="order-btn" title="Move down" aria-label="Move down" data-action="move-${key}" data-id="${esc(id)}" data-value="1" ${i===total-1?'disabled':''}>↓</button></div>`}
function focusView(){const r=route();return r.name==='focus'?db.views.find(v=>v.slug===r.slug&&v.active):null}
function prioritizeProjects(projects,view){if(!view)return projects;const pins=new Set(view.projectIds||[]),tracks=new Set(view.tracks||[]);return [...projects].sort((a,b)=>{const score=p=>(pins.has(p.id)?100:0)+((p.tracks||[]).some(t=>tracks.has(t))?20:0);return score(b)-score(a)})}
function copyLink(value){const fallback=()=>{const el=document.createElement('textarea');el.value=value;el.style.position='fixed';el.style.top='-2000px';document.body.append(el);el.select();const ok=document.execCommand('copy');el.remove();toast(ok?'Link copied':'Select the link to copy manually')};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(()=>toast('Link copied'),fallback);else fallback()}
function ctaBlock(project=false){return `<section class="wrap section cta-wrap"><div class="cta-banner"><div class="cta-orbit"></div><span class="eyebrow">CONNECT / ${project?'PROJECT':'LET’S TALK'}</span><h2>${project?t('projectCtaTitle'):t('contactTitle')}</h2><p>${project?t('projectCtaText'):t('contactSubtitle')}</p><a class="btn primary" href="/#contact">${t('contactMe')} ↗</a></div></section>`}
function home(){
 const view=focusView(),ps=prioritizeProjects(db.projects.filter(p=>p.published),view),fs=ps.filter(p=>p.featured);
 const focused=view?ps.filter(p=>(view.projectIds||[]).includes(p.id)||(p.tracks||[]).some(t=>(view.tracks||[]).includes(t))):[];
 const availableTracks=['All',...new Set(ps.flatMap(p=>p.tracks||[]).map(x=>x.trim()).filter(Boolean))];
 if(!availableTracks.includes(ui.filter))ui.filter='All';
 const selected=view?(focused.length?focused:ps):[...fs,...ps.filter(p=>!p.featured)].slice(0,homeProjectCount(db.settings.homeProjectCount));
 const showing=ui.filter==='All'?(ui.showAll?ps:selected):ps.filter(p=>(p.tracks||[]).includes(ui.filter));
 const sectionHtml={
 projects:`<section class="wrap section" id="projects"><div class="section-bar"><div><span class="eyebrow">01 / ${t('selected')}</span><h2 class="section-title">${view?esc(view.name):t('featured')}</h2><p class="section-intro">${view?`${tr('A curated selection highlighting','مشاريع مختارة تبرز')} ${esc(view.tracks.join(' + ')||'selected work')}.`:t('featuredSub')}</p></div><span class="section-index">${String(showing.length).padStart(2,'0')} PROJECTS</span></div><div class="track-filters">${availableTracks.map(x=>`<button class="track-btn ${ui.filter===x?'active':''}" data-track="${esc(x)}">${x==='All'?t('all'):esc(x)}</button>`).join('')}</div>${showing.length?`<div class="cards">${showing.map(projectCard).join('')}</div>`:`<div class="empty">${t('noResults')}</div>`}${ps.length>selected.length?`<button class="more-work" data-action="view-all">${ui.showAll?tr('Show fewer projects','عرض مشاريع أقل','Ver menos proyectos'):t('allWork')} <span>↗</span></button>`:''}</section>`,
 about:`<section class="wrap section about-reimagined" id="about"><div class="about-header"><span class="eyebrow">02 / ${t('about')}</span><h2 class="section-title">${t('aboutTitle')}</h2></div><div class="about-layout"><div class="about-quote"><span class="quote-mark">“</span><p>${esc(loc(db.hero,'about'))}</p><div class="about-signature">${tr('Curious by nature. Precise by design.','فضولي بطبعي، ودقيق في شغلي.') }</div></div><div class="about-side"><div class="about-fact"><span>01</span><div><b>${tr('Engineering mindset','عقلية هندسية')}</b><p>${tr('Thinking in systems, not just screens.','بفكر في الأنظمة ككل، مش مجرد شاشات.')}</p></div></div><div class="about-fact"><span>02</span><div><b>${tr('Thoughtful development','تطوير مدروس')}</b><p>${tr('Real constraints. Clear priorities. Reliable code.','قيود واقعية، وأولويات واضحة، وكود يُعتمد عليه.')}</p></div></div><div class="about-fact"><span>03</span><div><b>${tr('Always exploring','استكشاف مستمر')}</b><p>${tr('From backend platforms to IoT and AI.','من منصات الباك إند إلى إنترنت الأشياء والذكاء الاصطناعي.')}</p></div></div></div></div></section>`,
 experience:`<section class="section experience-section" id="experience"><div class="wrap"><div class="section-bar"><div><span class="eyebrow">03 / ${ui.lang==='ar'?'الخبرات والتدريب':'Experience & practice'}</span><h2 class="section-title">${ui.lang==='ar'?'الخبرة العملية والتعلّم.':'Practice makes progress.'}</h2></div></div><div class="experience-grid">${db.experience.map((x,i)=>`<article class="exp-card"><span class="exp-num">0${i+1} / EXPERIENCE</span><h3>${esc(loc(x,'title'))}</h3><span class="exp-sub">${esc(loc(x,'subtitle'))}</span><p>${esc(loc(x,'description'))}</p><div class="exp-period">${esc(x.period)}</div></article>`).join('')}</div></div></section>`,
 skills:`<section class="wrap section skills-reimagined" id="skills"><div class="section-bar"><div><span class="eyebrow">04 / ${t('expertise')}</span><h2 class="section-title">${t('skillsTitle')}</h2></div></div><div class="hard-skills-grid">${db.hardSkills.map((g,i)=>`<div class="hard-skill-card"><span class="hard-card-symbol">${['⌘','▦','◈','✳'][i%4]}</span><h3>${esc(loc(g,'name'))}</h3>${pills(g.items)}</div>`).join('')}</div><div class="soft-zone"><div><span class="eyebrow">${t('soft')}</span><h3>${tr('More than technical.','مش مهارات تقنية بس.')}</h3></div><div class="soft-pills">${db.softSkills.map(s=>`<span>✳ ${esc(loc(s,'name'))}</span>`).join('')}</div></div></section>`,
 education:`<section class="wrap section education-section" id="education"><div class="edu-mark">◎</div><div><span class="eyebrow">05 / ${t('education')}</span><h2>${t('eduDegree')}</h2><p>${t('eduUni')}</p></div><span class="edu-year">2026</span></section>`,
 certificates:`<section class="wrap section certificates-section" id="certificates"><div class="section-bar"><div><span class="eyebrow">06 / ${t('certs')}</span><h2 class="section-title">${t('certTitle')}</h2><p class="section-intro">${tr('A record of structured learning and hands-on training.','شهادات وتدريبات متخصصة وتطبيقات عملية.')}</p></div></div><div class="cert-carousel" aria-label="${t('certs')}"><div class="cert-carousel-nav">${db.certificates.length>1?`<button type="button" class="cert-carousel-arrow" data-action="cert-prev" aria-label="${tr('Previous certificates','الشهادات السابقة','Certificados anteriores')}">‹</button><button type="button" class="cert-carousel-arrow" data-action="cert-next" aria-label="${tr('Next certificates','الشهادات التالية','Siguientes certificados')}">›</button>`:''}</div><div class="cert-grid cert-carousel-track" role="region" aria-roledescription="carousel" aria-label="${t('certs')}" tabindex="0">${db.certificates.map((c,i)=>`<article class="cert-card">${c.image?`<button type="button" class="cert-preview-button" data-action="view-certificate" data-id="${esc(c.id)}" aria-label="${esc(tr('View full certificate: ','عرض الشهادة كاملة: ','Ver certificado completo: ')+loc(c,'title'))}">${certVisual(c,i)}</button>`:'<div class="cert-image cert-image-empty" aria-hidden="true">✳</div>'}<div class="cert-body"><span class="cert-issuer">${esc(c.issuer)} <span>· ${esc(c.year)}</span></span><h3>${esc(loc(c,'title'))}</h3><div class="cert-actions">${c.image?`<button type="button" class="cert-view-link" data-action="view-certificate" data-id="${esc(c.id)}">${tr('View full certificate','عرض الشهادة كاملة','Ver certificado')} ↗</button>`:''}${certificatePostUrl(c.linkedinPostUrl)?`<a class="cert-post-link" href="${esc(certificatePostUrl(c.linkedinPostUrl))}" target="_blank" rel="noopener noreferrer">${tr('LinkedIn post','منشور لينكدإن','Publicación en LinkedIn')} ↗</a>`:''}</div></div></article>`).join('')}</div></div></section>`,
 offers:`<section class="section offers-section" id="offers"><div class="wrap"><div class="section-bar"><div><span class="eyebrow">✦ &nbsp; ${t('offerLabel')}</span><h2 class="section-title">${t('offerTitle')}</h2><p class="section-intro">${tr('Special opportunities for new projects — discuss the terms that fit your needs.','عروض خاصة للمشروعات الجديدة — نتفق على الشروط اللي تناسبك.','Opciones especiales para nuevos proyectos.')}</p></div></div><div class="offer-grid">${db.offers.filter(o=>o.active).map((o,i)=>`<article class="offer-card ${i===0?'offer-featured':''}"><div class="offer-glow"></div><div class="offer-content"><div class="offer-heading"><span class="offer-symbol">✳</span><span class="offer-tag">${esc(loc(o,'highlight'))}</span></div><div class="offer-keyword">${esc(loc(o,'keyword')||'FREE')}</div><div class="offer-exclusive">${tr('SPECIAL PROJECT OFFER','عرض خاص للمشاريع','OFERTA ESPECIAL')}</div><h3>${esc(loc(o,'title'))}</h3><p>${esc(loc(o,'description'))}</p>${loc(o,'terms').trim()?`<button type="button" class="offer-terms-trigger" data-action="open-offer-terms" data-id="${esc(o.id)}" aria-haspopup="dialog">${tr('Terms & Conditions','الشروط والأحكام','Términos y condiciones')} <span aria-hidden="true">↗</span></button>`:''}<a class="btn primary" href="/#contact">${t('offerBtn')} ↗</a></div><div class="offer-visual" aria-hidden="true"><div class="offer-circle">✦</div><span>${tr('Start your idea','ابدأ فكرتك','Empieza tu idea')}</span></div></article>`).join('')}</div></div></section>`,
 contact:`<section class="section wrap" id="contact"><div class="contact-slab"><div class="contact-copy"><span class="eyebrow">08 / ${t('contact')}</span><h2 class="section-title">${t('contactTitle')}</h2><p class="section-intro">${t('contactSubtitle')}</p><div class="contact-links">${socialLinks()}</div></div><form id="contact-form"><div class="field"><label>${t('name')}</label><input required name="name" maxlength="90" placeholder="${tr('Your name','اسمك')}"></div><div class="field"><label for="contact-address">${tr('Email or phone number','البريد الإلكتروني أو رقم الهاتف','Correo electrónico o teléfono')}</label><input id="contact-address" name="contactAddress" type="text" maxlength="200" autocapitalize="none" spellcheck="false" required placeholder="you@example.com / +20 100 123 4567"></div><div class="field" data-contact-country hidden><label for="contact-country">${tr('Country code','رمز الدولة','Código de país')}</label><select id="contact-country" name="country" disabled><option value="">${tr('Select country','اختر الدولة','Selecciona el país')}</option></select></div><div class="field" data-contact-platform hidden><label for="contact-method">${tr('Reply via','طريقة الرد','Responder por')}</label><select id="contact-method" name="contactMethod" disabled><option value="">${tr('Choose an app','اختر تطبيقًا','Elige una aplicación')}</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option></select></div><div class="field"><label>${t('message')}</label><textarea required name="message" maxlength="4000" placeholder="${tr('Tell me about your idea...','احكي لي عن فكرتك...')}"></textarea></div><button class="btn primary" type="submit" style="width:100%">${t('send')} ↗</button></form></div></section>`
 };
 return `${nav()}<main class="public-site"><section class="wrap hero"><div class="hero-copy"><div class="hero-status"><span class="status-dot"></span>${esc(loc(db.hero,'status'))}</div><h1>${esc(loc(db.hero,'line1'))}<br><em>${esc(loc(db.hero,'line2'))}</em></h1><p class="lede">${esc(loc(db.hero,'intro'))}</p><div class="hero-ctas"><a class="btn primary" href="/#projects">${t('explore')} <span>↗</span></a>${cvButtons()}</div><div class="hero-bottomline"><span><strong>${String(ps.length).padStart(2,'0')}</strong> ${t('projects')}</span><span><strong>${String(db.certificates.length).padStart(2,'0')}</strong> ${t('certs')}</span><span class="hero-blueprint">${esc(db.settings.focus)}</span></div></div><div class="hero-image-zone">${portrait()}</div></section>${view?`<div class="wrap focus-banner"><span class="focus-icon">◎</span><div><strong>${esc(view.name)}</strong><p>${tr('Tailored project selection','اختيار مخصص للمشاريع')} · ${esc(view.tracks.join(' + ')||'Curated work')}</p></div><a href="/">${tr('Explore full portfolio','استعرض كل المشاريع')} ↗</a></div>`:''}${db.sectionsOrder.filter(k=>db.sections[k] && (k!=='projects'||db.projects.some(p=>p.published)) && (k!=='certificates'||db.certificates.length) && (k!=='experience'||db.experience.length) && (k!=='offers'||db.offers.some(o=>o.active)) && (k!=='testimonials'||db.customSections.some(s=>s.id==='testimonials'&&s.items.length)) && (k!=='achievements'||db.customSections.some(s=>s.id==='achievements'&&s.items.length)) && (k!=='services'||db.customSections.some(s=>s.id==='services'&&s.items.length)) && (k!=='process'||db.customSections.some(s=>s.id==='process'&&s.items.length)) && (k!=='insights'||db.customSections.some(s=>s.id==='insights'&&s.items.length)) && (k!=='faq'||db.customSections.some(s=>s.id==='faq'&&s.items.length))).map(k=>sectionHtml[k]||genericSection(db.customSections.find(x=>x.id===k)||{id:k,title:k,items:[]})).join('')}</main>${footer()}`;
}
function getProject(id){return db.projects.find(p=>p.id===id)}
function currentGallery(p){const g=(p.gallery||[]).slice();const ids=[p.coverMediaId,...(p.mediaIds||[])].filter((id,i,all)=>id&&all.indexOf(id)===i);for(const id of ids){const m=db.media.find(x=>x.id===id);if(m){g.push({kind:m.type.startsWith('video')?'video':'image',src:transientVideos.get(id)||m.src||'',label:m.name,alt:mediaAlt(m,loc(p,'title')+' screenshot '+(g.length+1))});}}return g}
function galleryFrame(p,g,thumb=false){
 if(g.kind==='video'&&g.src)return `<div class="gallery-media ${thumb?'thumb':'primary'}">${thumb?videoThumbnail(g.src,true):`<video class="video-stage" src="${esc(g.src)}" controls playsinline preload="metadata"></video>`}</div>`;
 if(g.kind==='image'&&g.src)return `<div class="gallery-media ${thumb?'thumb':'primary'}"><img src="${esc(g.src)}" alt="${esc(thumb?'':(g.alt||loc(p,'title')))}" decoding="async" loading="${thumb?'lazy':'eager'}"></div>`;
 if(g.kind==='motion')return `<div class="gallery-media ${thumb?'thumb':'primary'} motion-preview"><div class="motion-lines"><span></span><span></span><span></span><span></span><span></span></div><div class="motion-center"><div class="motion-play">▶</div><strong>${esc(g.label)}</strong><small>Animated preview · no video file</small></div></div>`;
 return `<div class="gallery-media ${thumb?'thumb':'primary'}">${art({...p,tone:g.tone||p.tone,mockVariant:g.variant},thumb?'small':'large')}</div>`;
}
function gallery(p){
 const media=currentGallery(p);if(!media.length)return '';
 const i=Math.max(0,Math.min(ui.gallery,media.length-1)),g=media[i];
 return `<section class="project-showcase"><div class="showcase-topline"><div><span class="eyebrow">${t('media')}</span></div><div class="showcase-counter"><strong>${String(i+1).padStart(2,'0')}</strong><span> / ${String(media.length).padStart(2,'0')}</span></div></div>
 <div class="showcase-display"><div class="showcase-stage"><div class="showcase-motion ${ui.galleryDirection==='prev'?'from-left':'from-right'}" data-action="open-lightbox" role="button" tabindex="0" aria-label="Enlarge current media">${galleryFrame(p,g)}<span class="stage-zoom-hint">⛶ &nbsp; ${tr('Expand / zoom','تكبير الصورة','Ampliar')}</span></div><button class="stage-arrow stage-prev" data-action="gallery-prev" aria-label="Previous slide">‹</button><button class="stage-arrow stage-next" data-action="gallery-next" aria-label="Next slide">›</button></div>
 <div class="showcase-side"><div class="showcase-side-title">${tr('MEDIA','الميديا','MULTIMEDIA')} <span>↕ ${media.length}</span></div><div class="showcase-rail" role="list" aria-label="Project media">${media.map((m,j)=>`<button class="showcase-thumb ${i===j?'active':''}" data-action="gallery" data-value="${j}" aria-label="Show media ${j+1}">${galleryFrame(p,m,true)}</button>`).join('')}</div><div class="showcase-rail-caption">${tr('Scroll for more ↓','مرّر للأسفل ↓','Ver más ↓')}</div></div></div></section>`;
}
function projectPage(id){const p=getProject(id);if(!p||(!p.published&&!(route().preview&&route().id===id)))return nav()+`<main class="wrap section"><h1>Project not found.</h1><a class="btn primary" href="/">${t('back')}</a></main>`+footer();const others=db.projects.filter(x=>x.published&&x.id!==p.id);return `${nav()}<main class="public-site wrap detail-public"><div class="detail-hero"><a class="back-link" href="/#projects">← ${t('back')}</a><div class="eyebrow detail-eyebrow">${esc(loc(p,'category'))} / ${esc(p.year)}</div><h1>${esc(loc(p,'title'))}<span class="accent">.</span></h1><p class="lede">${esc(loc(p,'summary'))}</p><div class="hero-ctas">${projectExtraLinks(p).map((l,i)=>{const h=projectLinkHref(l.url);return h&&h!=='#'?`<a class="btn ${i===0?'primary':'ghost'}" href="${esc(h)}" ${h.startsWith('#/')?'':`target="_blank" rel="noopener noreferrer"`}>${esc(l.label)} ↗</a>`:''}).join('')}<a class="btn ghost" href="/#contact">${t('letsTalk')} ↗</a></div></div><div class="detail-meta">${[['role',loc(p,'role')],['type',loc(p,'category')],['year',p.year],['status',p.status]].map(([key,val])=>`<div class="meta-item"><span>${t(key)}</span><b>${esc(val)}</b></div>`).join('')}</div>${currentGallery(p).length?gallery(p):`<div class="project-showcase fallback-showcase"><div class="detail-fallback theme-${['blue','gold','rose','violet'].includes(p.tone)?p.tone:'blue'}"><div class="cover-pattern"></div></div></div>`}
<section class="section compact story-section"><span class="eyebrow">01 / ${tr('IN PLAIN LANGUAGE','بلغة بسيطة','EN PALABRAS SENCILLAS')}</span><h2 class="section-title">${tr('What this project does','المشروع بيعمل إيه؟','Qué hace este proyecto')}</h2><p class="sub detail-copy">${esc(loc(p,'overview')||loc(p,'summary'))}</p></section>
${loc(p,'problem')||loc(p,'solution')?`<div class="detail-two section compact"><div><h2 class="section-title">${t('challenge')}</h2><p class="sub detail-copy">${esc(loc(p,'problem'))}</p></div><div><h2 class="section-title">${t('solution')}</h2><p class="sub detail-copy">${esc(loc(p,'solution'))}</p></div></div>`:''}
<section class="section compact technical-section"><span class="eyebrow">02 / ${tr('TECHNICAL DEEP DIVE','التفاصيل التقنية','DETALLES TÉCNICOS')}</span><h2 class="section-title">${tr('How I built it','إزاي نفذت المشروع','Cómo lo desarrollé')}</h2>${loc(p,'technicalDetails')?`<p class="sub detail-copy">${esc(loc(p,'technicalDetails'))}</p>`:''}${p.stack?.length?pills(p.stack):''}<div class="track-list">${(p.tracks||[]).map(x=>`<span>${esc(x)}</span>`).join('')}</div>${localizedLines(p,'features').length?`<h3>${t('features')}</h3><div class="feature-grid">${localizedLines(p,'features').map((x,i)=>`<div class="feature-box"><em>${String(i+1).padStart(2,'0')}</em>${esc(x)}</div>`).join('')}</div>`:''}</section>
${relatedProjects(p).length?`<section class="section compact related-projects"><h2 class="section-title">${tr('Related projects','مشاريع مرتبطة','Proyectos relacionados')}</h2><div class="cards">${relatedProjects(p).map(projectCard).join('')}</div></section>`:''}</main>${ctaBlock(true)}${footer()}`}
function tabs(){return [['overview','▣','Overview'],['projects','▦','Projects'],['views','◉','Share Links'],['content','✎','Homepage'],['experience','◷','Experience'],['skills','✧','Skills'],['offers','◇','Offers'],['sections','☷','Sections'],['certificates','✳','Certificates'],['socials','↗','Social Links'],['media','▧','Media Library'],['inbox','✉','Inbox'],['analytics','◫','Visitor Analytics'],['backup','⇩','Export / Backup'],['settings','⚙','Settings']]}
function dh(k,title,sub='',button=''){return `<div class="dash-heading"><div><span class="eyebrow">${k}</span><h1>${title}<span class="accent">.</span></h1><p class="sub small">${sub}</p></div>${button}</div>`}
function tableProjects(ps){return ps.length?`<div class="table-scroll"><table class="table"><thead><tr><th>Order</th><th>Project</th><th>Roles / Tracks</th><th>Published</th><th>Actions</th></tr></thead><tbody>${ps.map(p=>`<tr><td>${orderButtons('projects',p.id,db.projects.indexOf(p),db.projects.length)}</td><td><b>${esc(p.title)}</b><small>${esc(p.id)}</small></td><td class="sub">${esc((p.tracks||[]).join(' · '))}</td><td>${badge(p.published?'Published':'Draft',!p.published)}</td><td><div class="table-actions"><button data-action="edit-project" data-id="${esc(p.id)}">Edit</button><button data-action="preview-project" data-id="${esc(p.id)}">Preview</button><button data-action="toggle-project" data-id="${esc(p.id)}">${p.published?'Unpublish':'Publish'}</button><button data-action="delete-project" data-id="${esc(p.id)}">✕</button></div></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">No projects yet.</div>`}
function dashboard(){if(!ui.authenticated)return login();return `<div class="dashboard"><aside class="dash-sidebar"><div class="dash-brand">${brandMark()}<span>PORTFOLIO OS<small>Content management studio</small></span></div><button type="button" class="btn dash-menu-toggle" data-action="toggle-dashboard-menu" aria-controls="dashboard-menu" aria-expanded="false">Menu <span aria-hidden="true">⌄</span></button><nav class="dash-nav" id="dashboard-menu" aria-label="Dashboard"><div class="dash-label">Workspace</div>${tabs().map(([key,icon,label])=>`<button data-tab="${key}" class="${ui.tab===key?'active':''}" ${ui.tab===key?'aria-current="page"':''}><span class="icon">${icon}</span>${label}${key==='inbox'&&db.messages.some(m=>!m.read&&!m.archived)?badge(db.messages.filter(x=>!x.read&&!x.archived).length):''}</button>`).join('')}</nav><div class="dash-sidebottom"><span class="dot"></span> Cloudflare CMS<br>D1 & R2 connected</div></aside><main class="dash-main" tabindex="-1"><div class="dash-top"><span class="breadcrumbs">Workspace / <b>${esc(tabs().find(x=>x[0]===ui.tab)?.[2]||'Overview')}</b></span><div class="account"><a href="/" class="btn sm ghost">↗ View website</a> Admin <span class="avatar">MM</span><button class="round" data-action="lock" title="Lock dashboard">⇥</button></div></div>${dashboardSection()}</main></div>`}

function countryName(code){try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code)||code}catch{return code}}
function analyticsCount(n){return Number(n||0).toLocaleString('en-US')}
function analyticsDayChart(days){
 const map=new Map((days||[]).map(x=>[x.date,Number(x.views||0)]));
 const totalDays=ui.analyticsDays,base=new Date();base.setUTCHours(0,0,0,0);
 const data=Array.from({length:totalDays},(_,i)=>{const date=new Date(base.getTime()-(totalDays-i-1)*86400000).toISOString().slice(0,10);return {date,views:map.get(date)||0}});
 const max=Math.max(...data.map(x=>x.views),1),w=680,h=180,px=13,py=16;
 const pts=data.map((v,i)=>{const x=px+i*(w-2*px)/Math.max(1,data.length-1),y=h-py-(v.views/max)*(h-2*py);return {x,y,...v}});
 const line=pts.map((v,i)=>`${i?'L':'M'}${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');
 const fill=`${line} L${pts.at(-1).x.toFixed(1)},${h-py} L${px},${h-py} Z`;
 return `<div class="analytics-line-box"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily pageviews over the last ${totalDays} days" preserveAspectRatio="none"><defs><linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5267e4" stop-opacity=".20"/><stop offset="1" stop-color="#5267e4" stop-opacity="0"/></linearGradient></defs><line x1="${px}" x2="${w-px}" y1="${h-py}" y2="${h-py}" stroke="#dfe6f5"/><path d="${fill}" fill="url(#analyticsGradient)"/><path d="${line}" fill="none" stroke="#5367df" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><div class="analytics-axis"><span>${esc(data[0].date)}</span><span>${esc(data.at(-1).date)}</span></div></div>`;
}
function analyticsDashboard(){
 const a=ui.analytics;const daily=a?.byDay||[],countries=a?.byCountry||[],hours=a?.byHour||[],paths=a?.topPaths||[];
 const total=Number(a?.total||0),today=new Date().toISOString().slice(0,10),todayCount=Number(daily.find(x=>x.date===today)?.views||0);
 const leading=countries[0],top=paths[0],peak=hours.reduce((best,x)=>Number(x.views||0)>Number(best.views||0)?x:best,{hour:0,views:0});
 const bars=arr=>arr.length?arr.map((x,i)=>{const v=Number(x.views||0);return `<div class="analytics-rank"><div class="analytics-rank-head"><span>${i+1}. ${esc(x.name)}</span><strong>${analyticsCount(v)}</strong></div><div class="analytics-rank-bar"><span style="width:${(v/Math.max(1,...arr.map(y=>Number(y.views||0)))*100).toFixed(2)}%"></span></div></div>`}).join(''):'<div class="analytics-empty">No pageviews recorded in this period.</div>';
 const countryBars=bars(countries.slice(0,8).map(x=>({name:`${countryName(x.country||'XX')} (${x.country||'XX'})`,views:x.views})));
 const pathBars=bars(paths.slice(0,8).map(x=>({name:x.path,views:x.views})));
 const hourMap=new Map(hours.map(x=>[Number(x.hour),Number(x.views||0)])),hourMax=Math.max(...hours.map(x=>Number(x.views||0)),1);
 return `${dh('Insights / Traffic','Visitor Analytics','Cloudflare Worker pageviews recorded in D1 · displayed in UTC.',`<button class="btn sm" data-action="refresh-analytics" ${ui.analyticsLoading?'disabled':''}>↻ Refresh</button>`)}
  <div class="analytics-header"><div class="analytics-period" role="group" aria-label="Analytics period">${[7,30,90].map(n=>`<button data-action="analytics-period" data-value="${n}" class="${ui.analyticsDays===n?'active':''}" aria-pressed="${ui.analyticsDays===n}">${n} days</button>`).join('')}</div><span class="analytics-source">● Source: D1 Pageviews</span></div>
  ${ui.analyticsLoading?'<div class="panel analytics-empty">Loading visitor analytics…</div>':ui.analyticsError?`<div class="panel analytics-error">${esc(ui.analyticsError)} <button class="btn sm" data-action="refresh-analytics">Retry</button></div>`:!a?'<div class="panel analytics-empty">Loading your traffic report…</div>':`
  <div class="analytics-kpis"><div class="analytics-kpi"><span>Pageviews · period</span><strong>${analyticsCount(total)}</strong><small>Page requests, not people</small></div><div class="analytics-kpi"><span>Pageviews · today (UTC)</span><strong>${analyticsCount(todayCount)}</strong><small>${esc(today)}</small></div><div class="analytics-kpi"><span>Countries seen</span><strong>${analyticsCount(countries.length)}</strong><small>${leading?`${esc(leading.country)} leads with ${analyticsCount(leading.views)}`:'No recorded geography'}</small></div><div class="analytics-kpi"><span>Top page</span><strong class="analytics-kpi-path">${esc(top?.path||'—')}</strong><small>${top?`${analyticsCount(top.views)} pageviews`:'No pageview data yet'}</small></div></div>
  <div class="panel analytics-panel"><div class="analytics-title"><div><h3>Pageviews trend</h3><p class="sub small">Daily volume · UTC · includes zero-traffic dates</p></div>${badge(`${ui.analyticsDays} days`)}</div>${analyticsDayChart(daily)}</div>
  <div class="analytics-columns"><div class="panel analytics-panel"><div class="analytics-title"><div><h3>Countries</h3><p class="sub small">Cloudflare approximate country, not a visitor identity</p></div></div>${countryBars}</div><div class="panel analytics-panel"><div class="analytics-title"><div><h3>Top pages</h3><p class="sub small">By complete URL path for new events</p></div></div>${pathBars}</div></div>
  <div class="panel analytics-panel"><div class="analytics-title"><div><h3>Activity by UTC hour</h3><p class="sub small">Distribution of pageviews by hour (0–23)</p></div>${badge(`${String(peak.hour).padStart(2,'0')}:00 peak`)}</div><div class="analytics-hours" role="img" aria-label="Pageview counts per UTC hour">${Array.from({length:24},(_,hour)=>{const v=hourMap.get(hour)||0;return `<div class="analytics-hour" title="${String(hour).padStart(2,'0')}:00 UTC: ${analyticsCount(v)} pageviews"><div class="analytics-hour-track"><span style="height:${v?Math.max(4,(v/hourMax)*100):0}%"></span></div><small>${hour%3===0?String(hour).padStart(2,'0'):''}</small></div>`}).join('')}</div></div>`}
 <div class="panel analytics-notes"><h3>Reading these numbers</h3><p><b>Pageviews ≠ unique visitors.</b> Refreshes and repeated visits count again. Crawlers, uptime checks and other automated requests may also be included.</p><p><b>Data source:</b> your Worker stores aggregated pageviews in D1. Country is approximate; all charts use UTC. No personal identity, session duration or unique people are measured.</p><p><b>Historical page grouping:</b> older records use <code>/projects/:slug</code> and <code>/focus/:slug</code>. Newly recorded requests use the full individual page path. Earlier aggregate totals cannot be split back into projects.</p><p><b>Cloudflare GraphQL:</b> not required for this dashboard. The optional zone-wide integration remains available via the separate API, but its HTTP request totals can include bot and static asset traffic.</p></div>`;
}
async function loadAnalytics(){if(ui.analyticsLoading)return;ui.analyticsLoading=true;ui.analyticsError='';if(ui.tab==='analytics')render(true);try{const a=await api('/api/admin/analytics?days='+ui.analyticsDays);ui.analytics=a}catch(e){ui.analyticsError=e.message}finally{ui.analyticsLoading=false;if(ui.tab==='analytics')render(true)}}
let viewingArchive=false;
let messageUpdating=false;
function inbox(){
 const matching=db.messages.filter(m=>Boolean(m.archived)===viewingArchive);
 const icons={
  whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 2a8 8 0 1 1-4.5 14.6l-.4-.2-2.3.6.6-2.3-.2-.4A8 8 0 0 1 12 4Zm-3 3c-.8 0-1.4.7-1.4 1.6 0 2.8 3.4 6.3 6.6 7.1 1.3.3 2.5-.3 2.5-1.4v-.6l-2.5-1.2-.9 1a7 7 0 0 1-3.3-3.2l.7-.9L9.8 7H9Z"/></svg>',
  telegram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.5 4.1 2.9 11.3c-1.3.5-1.3 1.2-.2 1.6l4.8 1.5 1.9 5.8c.2.7.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3-15.4c.3-1.2-.5-1.8-1.5-1.6ZM9.2 14l10.1-6.4c.5-.3.9-.1.5.2l-8.3 7.5-.3 3.3Z"/></svg>',
 };
 const regions=new Intl.DisplayNames(['en'],{type:'region'});
 const cards=matching.map(m=>{
  const phone=/^\+[1-9]\d{7,14}$/.test(m.phone||'')?m.phone:'';
  const platform=m.contactMethod==='telegram'?'Telegram':'WhatsApp';
  const href=phone?(platform==='Telegram'?'https://t.me/'+phone:'https://wa.me/'+phone.slice(1))
   :m.email?'https://mail.google.com/mail/?'+new URLSearchParams({view:'cm',fs:'1',to:m.email}):'';
  const rawTime=String(m.created_at||'').replace(' ','T');
  const sent=new Date(rawTime.endsWith('Z')||/[+-]\d\d:\d\d$/.test(rawTime)?rawTime:rawTime+'Z');
  const metadata=[Number.isNaN(sent.getTime())?'':sent.toLocaleString(),m.ip?'IP: '+m.ip:'',m.country?'IP country: '+regions.of(m.country):'',m.phoneCountry?'Phone country: '+regions.of(m.phoneCountry):'',m.device,m.os,m.browser].filter(Boolean);
  return `<article class="message-card"><div class="message-head"><div><strong>${esc(m.name)}</strong>
   ${href?`<p class="sub small"><a class="message-reply" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="Reply via ${phone?platform:'Gmail'} to ${esc(phone||m.email)}">${phone?icons[m.contactMethod]||'':''}${esc(phone||m.email)}</a></p>`:''}</div>${badge(m.read?'Read':'Unread',m.read)}</div>
   ${metadata.length?`<p class="sub small">${esc(metadata.join(' · '))}</p>`:''}
   <p class="sub inbox-message">${esc(m.message)}</p><div class="table-actions">
   <button class="btn sm" data-action="toggle-read" data-id="${esc(m.id)}">Mark ${m.read?'unread':'read'}</button>
   <button class="btn sm" data-action="archive-message" data-id="${esc(m.id)}">${m.archived?'Restore':'Archive'}</button>
   <button class="btn sm danger" data-action="delete-message" data-id="${esc(m.id)}">Delete</button></div></article>`;
 }).join('');
 return `${dh('Contact / Messages','Inbox')}<div class="table-actions inbox-tabs">
 <button class="btn sm" data-action="inbox-filter" data-value="inbox" aria-pressed="${!viewingArchive}">Inbox</button>
 <button class="btn sm" data-action="inbox-filter" data-value="archive" aria-pressed="${viewingArchive}">Archive</button></div>
 ${cards||'<div class="empty">No messages.</div>'}`;
}
async function updateInboxMessage(id,action){
 const message=db.messages.find(m=>m.id===id);
 if(!message||messageUpdating)return;
 const deleting=action==='delete-message';
 if(deleting&&!confirm('Permanently delete this message?'))return;
 const changes=action==='toggle-read'?{read:!message.read}:{archived:!message.archived};
 messageUpdating=true;
 try{
  await lastSave;
  await api('/api/admin/messages/'+encodeURIComponent(id),deleting?{method:'DELETE'}:
   {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(changes)});
  if(deleting)db.messages=db.messages.filter(m=>m.id!==id);
  else Object.assign(message,changes);
  if(ui.tab==='inbox')render(true);
 }catch(error){toast('Message update failed: '+error.message)}
 finally{messageUpdating=false}
}
let contactOptions;
let contactOptionsRequest;
function populateContactCountries(select, options){
 if(select.options.length>1)return;
 const lang=document.documentElement.lang||'en';
 const names=new Intl.DisplayNames([lang],{type:'region'});
 const countries=Object.entries(options.callingCodes).map(([code,dial])=>[code,dial,names.of(code)]);
 countries.sort((a,b)=>a[2].localeCompare(b[2],lang));
 for(const [code,dial,name] of countries){
  const flag=String.fromCodePoint(...Array.from(code,c=>127397+c.charCodeAt(0)));
  select.add(new Option(`${flag} ${name} (+${dial})`,code,code===options.country));
 }
 select.value=options.country||'';
}
function syncContactMethod(form){
 const address=form.elements.contactAddress.value.trim();
 const phone=/^\+?[0-9٠-٩۰-۹(][0-9٠-٩۰-۹\s().-]*$/.test(address);
 const method=form.elements.contactMethod,country=form.elements.country;
 const international=/^(\+|[0٠۰]{2})/.test(address);
 method.closest('[data-contact-platform]').hidden=!phone;
 country.closest('[data-contact-country]').hidden=!phone;
 method.disabled=!phone;
 country.disabled=!phone;
 method.required=phone;
 country.required=phone&&!international;
 if(!phone)method.value='';
 if(phone&&contactOptions)populateContactCountries(country,contactOptions);
 else if(phone){
  contactOptionsRequest??=api('/api/contact/options').then(options=>contactOptions=options).finally(()=>{contactOptionsRequest=null});
  contactOptionsRequest.then(options=>{if(country.isConnected)populateContactCountries(country,options)}).catch(()=>{});
 }
 return phone;
}
function dashboardSection(){switch(ui.tab){
case 'overview':return `${dh('Overview / Content','Your workspace','Manage published content and drafts stored in D1.',`<button class="btn primary sm" data-action="new-project">+ New project</button>`)}<div class="stats-grid">${[['▦',db.projects.length,'Projects'],['✓',db.projects.filter(x=>x.published).length,'Published'],['✳',db.certificates.length,'Certificates'],['◇',db.offers.length,'Offers']].map(([i,n,l])=>`<div class="stat-card"><span class="stat-icon">${i}</span><strong>${String(n).padStart(2,'0')}</strong><span>${l}</span></div>`).join('')}</div><div class="panel"><div class="panel-header"><h3>Recent projects</h3><button class="btn sm" data-tab="projects">Manage all ↗</button></div>${tableProjects(db.projects.slice(0,4))}</div><div class="quick-grid"><button class="quick" data-tab="content"><span class="quick-icon">✎</span><h3>Homepage & Portrait</h3><p>Edit bilingual hero copy and profile photo.</p></button><button class="quick" data-tab="offers"><span class="quick-icon">◇</span><h3>Commercial offers</h3><p>Manage proposals, terms and visibility.</p></button></div>`;
case 'projects':return `${dh('Portfolio / Work','Projects','Assign multiple tracks to each project.',`<button class="btn primary sm" data-action="new-project">+ New project</button>`)}<div class="panel"><div class="panel-header"><h3>Projects (${db.projects.length})</h3><input id="project-filter" placeholder="Search projects..." value="${esc(ui.search)}" style="width:min(270px,45%);background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:9px"></div><div id="projects-table">${tableProjects(db.projects.filter(x=>(x.title+' '+x.tracks.join(' ')).toLowerCase().includes(ui.search.toLowerCase())))}</div></div>`;
case 'content':return `${dh('Homepage / Content','Hero & Profile','Manage English, Arabic and optional Spanish copy.')}<div class="panel"><div class="panel-header"><h3>Portrait</h3>${badge('Stored in R2')}</div><div class="portrait-admin"><div class="portrait-preview">${db.hero.portrait?`<img src="${esc(db.hero.portrait)}" alt="Your uploaded portrait">`:'<div class="portrait-placeholder">MM<span>NO IMAGE UPLOADED</span></div>'}</div><div><p class="sub small">Upload a portrait image. The preview automatically scales it without manual crop controls.</p><input type="file" id="portrait-input" accept="image/png,image/jpeg,image/webp" hidden><div class="hero-ctas"><button class="btn primary sm" data-action="portrait-upload">Upload portrait</button><button class="btn sm" data-action="portrait-remove">Remove</button></div></div></div></div><div class="panel"><div class="panel-header"><h3>Portrait appearance & overlay</h3></div><form id="portrait-appearance-form"><div class="form-grid form-grid-three"><div class="field"><label>Background type</label><select name="portraitBgMode"><option value="gradient" ${db.hero.portraitBgMode==='gradient'?'selected':''}>Gradient</option><option value="solid" ${db.hero.portraitBgMode==='solid'?'selected':''}>Solid color</option></select></div><div class="field"><label>Base color</label><input type="color" name="portraitBg1" value="${esc(db.hero.portraitBg1)}"></div><div class="field"><label>Second gradient color</label><input type="color" name="portraitBg2" value="${esc(db.hero.portraitBg2)}"></div></div><div class="field"><label>Gradient angle (degrees)</label><input name="portraitBgAngle" type="number" min="0" max="360" value="${esc(db.hero.portraitBgAngle)}"></div><label class="inline-checkbox"><input type="checkbox" name="portraitBadge" ${db.hero.portraitBadge?'checked':''}> Show floating portrait phrase</label><div class="form-grid form-grid-three">${textField('portraitBadgeText','Phrase EN',db.hero.portraitBadgeText)}${textField('portraitBadgeTextAr','Phrase AR',db.hero.portraitBadgeTextAr,true)}${textField('portraitBadgeTextEs','Phrase ES',db.hero.portraitBadgeTextEs)}</div><button class="btn primary" type="submit">Save portrait appearance ✓</button></form></div><div class="panel"><h3>Portrait image alternative text (SEO / accessibility)</h3><form id="portrait-alt-form" class="form-grid form-grid-three">${textField('portraitAlt','Description EN',db.hero.portraitAlt||'')}${textField('portraitAltAr','Description AR',db.hero.portraitAltAr||'',true)}${textField('portraitAltEs','Description ES',db.hero.portraitAltEs||'')}<button type="submit" class="btn primary">Save image description</button></form></div><div class="panel"><div class="panel-header"><h3>Hero & About — EN / AR / ES</h3>${badge('Spanish ready')}</div><form id="hero-form" class="editor-grid">${['status','line1','line2','intro','about'].map(k=>`<div class="form-grid form-grid-three">${textField(k,k.toUpperCase()+' (EN)',db.hero[k],false,['intro','about'].includes(k))}${textField(k+'Ar',k.toUpperCase()+' (AR)',db.hero[k+'Ar'],true,['intro','about'].includes(k))}${textField(k+'Es',k.toUpperCase()+' (ES · optional)',db.hero[k+'Es'],false,['intro','about'].includes(k))}</div>`).join('')}<p class="sub small">Spanish remains hidden from visitors until enabled in Settings.</p><button type="submit" class="btn primary">Save homepage ✓</button></form></div>`;

case 'experience':return `${dh('Profile / Background','Experience','Update the experiences displayed on your site.',`<button class="btn primary sm" data-action="new-experience">+ Add experience</button>`)}<div class="panel"><div class="sortable-list">${db.experience.map((x,i)=>`<div class="sortable-row"><div class="sort-grip">◷</div><div class="sort-name"><b>${esc(x.title)}</b><span>${esc(x.subtitle)} · ${esc(x.period)}</span></div>${orderButtons('experience',x.id,i,db.experience.length)}<button class="btn sm" data-action="edit-experience" data-id="${esc(x.id)}">Edit</button><button class="btn sm danger" data-action="delete-experience" data-id="${esc(x.id)}">Delete</button></div>`).join('')}</div></div>`;
case 'views':return `${dh('Curated Portfolios','Share Links','Make focused URLs for specific clients or job roles.',`<button class="btn primary sm" data-action="new-view">+ Create share link</button>`)}<div class="panel"><p class="sub small">Each link can highlight a combination of project tracks and pinned projects. One project can appear in as many links as you need. Links are published at /focus/:slug on the live domain.</p><div class="view-grid">${db.views.map(v=>{const link=location.origin+'/focus/'+encodeURIComponent(v.slug);return `<div class="view-card"><div class="view-head"><span class="view-icon">◎</span>${badge(v.active?'Active':'Hidden',!v.active)}</div><h3>${esc(v.name)}</h3><div class="pills">${(v.tracks||[]).map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div><div class="field"><label>Shareable URL</label><input readonly class="share-input" value="${esc(link)}" onclick="this.select()"></div><div class="table-actions"><button class="btn sm primary" data-action="copy-view" data-id="${esc(v.id)}">Copy URL ↗</button><button class="btn sm" data-go="/focus/${encodeURIComponent(v.slug)}">Preview</button><button class="btn sm" data-action="edit-view" data-id="${esc(v.id)}">Edit</button><button class="btn sm danger" data-action="delete-view" data-id="${esc(v.id)}">Delete</button></div></div>`}).join('')}</div></div>`;
case 'socials':return `${dh('Public / Contact','Social Links','Manage social icons and external links.',`<button class="btn primary sm" data-action="new-social">+ Add link</button>`)}<div class="panel"><div class="sortable-list">${db.socials.map((s,i)=>`<div class="sortable-row"><div class="sort-grip">↗</div><div class="sort-name"><b>${esc(s.label)}</b><span>${esc(s.url)}</span></div>${orderButtons('socials',s.id,i,db.socials.length)}<button class="btn sm" data-action="edit-social" data-id="${esc(s.id)}">Edit</button><button class="btn sm danger" data-action="delete-social" data-id="${esc(s.id)}">Delete</button></div>`).join('')}</div></div>`;

case 'skills':return `${dh('Profile / Expertise','Skills Manager','Edit hard-skill groups and soft skills independently.',`<button class="btn primary sm" data-action="new-skill-group">+ New group</button>`)}<div class="panel"><div class="panel-header"><h3>Hard skills · editable categories</h3></div><div class="skill-admin-grid">${db.hardSkills.map(g=>`<div class="skill-box"><strong>${esc(g.name)}</strong><p class="sub micro">${esc(g.nameAr||'')}</p>${pills(g.items)}<div class="hero-ctas"><button class="btn sm" data-action="edit-skill-group" data-id="${esc(g.id)}">Edit group</button><button class="btn sm danger" data-action="delete-skill-group" data-id="${esc(g.id)}">Delete</button></div></div>`).join('')}</div></div><div class="panel"><div class="panel-header"><h3>Soft skills</h3><button class="btn sm" data-action="new-soft-skill">+ Add skill</button></div><div class="soft-admin-list">${db.softSkills.map(s=>`<div class="soft-admin-item"><span>${esc(s.name)} <small>— ${esc(s.nameAr||'')}</small></span><div><button class="btn sm" data-action="edit-soft-skill" data-id="${esc(s.id)}">Edit</button><button class="btn sm danger" data-action="delete-soft-skill" data-id="${esc(s.id)}">✕</button></div></div>`).join('')}</div></div>`;
case 'offers':return `${dh('Clients / Commercial','Offers','Flexible proposals with clear conditions.',`<button class="btn primary sm" data-action="new-offer">+ New offer</button>`)}<div class="offer-admin-grid">${db.offers.map(o=>`<div class="panel offer-admin"><div class="panel-header"><h3>${esc(o.title)}</h3>${badge(o.active?'Active':'Hidden',!o.active)}</div><p class="sub small">${esc(o.description)}</p><p class="muted micro">${esc(o.terms)}</p><div class="hero-ctas"><button class="btn sm" data-action="edit-offer" data-id="${esc(o.id)}">Edit</button><button class="btn sm" data-action="toggle-offer" data-id="${esc(o.id)}">${o.active?'Hide':'Publish'}</button><button class="btn sm danger" data-action="delete-offer" data-id="${esc(o.id)}">Delete</button></div></div>`).join('')}</div>`;
case 'sections':return `${dh('Site / Layout','Sections & layout','Create custom content blocks, choose layout, reorder and publish.',`<button class="btn primary sm" data-action="new-custom-section">+ Custom section</button>`)}<div class="panel"><div class="panel-header"><h3>Homepage section order</h3>${badge('Drag-free ordering')}</div><div class="sortable-list">${db.sectionsOrder.map((k,i)=>`<div class="sortable-row"><div class="sort-grip">☷</div><div class="sort-name"><b>${esc(sectionName(k))}</b><span>${db.customSections.some(x=>x.id===k)?'Flexible section · '+esc(db.customSections.find(x=>x.id===k).layout):'Core section'} · ${i+1} / ${db.sectionsOrder.length}</span></div>${orderButtons('section',k,i,db.sectionsOrder.length)}${db.customSections.some(x=>x.id===k)?`<div class="table-actions"><button data-action="edit-custom-section" data-id="${esc(k)}">Edit</button><button data-action="delete-custom-section" data-id="${esc(k)}">Delete</button></div>`:''}<label class="toggle-switch"><input type="checkbox" data-section="${esc(k)}" ${db.sections[k]?'checked':''}><span>${db.sections[k]?'Visible':'Hidden'}</span></label></div>`).join('')}</div><p class="sub micro">Sections with sample content are clearly labeled. Edit or hide them before publishing.</p></div><div class="panel"><div class="panel-header"><h3>Flexible sections & content</h3><button class="btn sm primary" data-action="new-custom-section">+ Create</button></div><div class="custom-admin-grid">${db.customSections.map(x=>`<article class="custom-admin-card"><span class="eyebrow">${esc(x.layout.toUpperCase())} · ${x.items.length} items</span><h3>${esc(x.title)}</h3><p class="sub small">${esc(x.description||'')}</p><div class="table-actions"><button data-action="edit-custom-section" data-id="${esc(x.id)}">Edit section</button><button data-action="new-custom-item" data-id="${esc(x.id)}">+ Add item</button></div><div class="custom-item-list">${x.items.map((it,i)=>`<div class="custom-item-row"><b>${esc(it.title)}</b><div class="table-actions">${orderButtons('custom-item',x.id+'|'+it.id,i,x.items.length)}<button data-action="edit-custom-item" data-id="${esc(x.id+'|'+it.id)}">Edit</button><button data-action="delete-custom-item" data-id="${esc(x.id+'|'+it.id)}">✕</button></div></div>`).join('')}</div></article>`).join('')}</div></div>`;
case 'certificates':return `${dh('Credentials / Training','Certificates','Add certificate cover images and adjust their order.',`<button class="btn primary sm" data-action="new-cert">+ New certificate</button>`)}<div class="panel"><div class="table-scroll"><table class="table"><thead><tr><th>Order</th><th>Preview</th><th>Certificate</th><th>Issuer</th><th>Year</th><th>Actions</th></tr></thead><tbody>${db.certificates.map((c,i)=>`<tr><td>${orderButtons('certificates',c.id,i,db.certificates.length)}</td><td><img class="admin-cert-preview" src="${esc(c.image||certificateMock(c,i))}" alt="Certificate"></td><td><b>${esc(c.title)}</b></td><td>${esc(c.issuer)}</td><td>${esc(c.year)}</td><td><div class="table-actions"><button data-action="edit-cert" data-id="${esc(c.id)}">Edit / Image</button><button data-action="delete-cert" data-id="${esc(c.id)}">Delete</button></div></td></tr>`).join('')}</tbody></table></div></div>`;
case 'media':return `${dh('Assets / Storage','Media Library','Upload files and assign them to projects in Edit Project.',`<button class="btn primary sm" data-action="upload">+ Upload</button>`)}<button type="button" class="upload-area" id="media-drop-zone" data-action="upload"><strong>Drop files here or click to browse</strong><span class="small">Images and videos: optional local conversion before upload. Output limit: 90 MiB per file. PDF, JSON and text are unchanged.</span></button><input id="media-input" type="file" accept="image/*,video/*,.pdf,.json,.txt,.mov,.mkv,.avi,.heic,.heif" multiple hidden><div class="field" style="margin:14px 0"><label for="media-library-search">Search media</label><input type="search" id="media-library-search" placeholder="Search filename or file type..." value="${esc(mediaLibraryQuery)}" autocomplete="off"></div><div id="media-library-results">${mediaLibraryResults()}</div>`;
case 'inbox':return inbox();
case 'backup':return `${dh('Workspace / Data','Export / Backup','Download the complete database as SQL, optionally with original media files.')}<div class="panel"><h3>Download a backup</h3><p class="sub small">All database tables, drafts, inbox records and analytics are included. Optionally include R2 media. No data is modified.</p><button class="btn primary" data-action="export-backup">Choose media option & download ↓</button></div>`;
case 'analytics':return analyticsDashboard();
case 'settings':return `${dh('Workspace / Preferences','Settings','Brand identity, languages and preview controls.')}<div class="panel"><h3>Brand logo & tab icon</h3><p class="sub small">Upload your own logo and favicon (PNG, JPEG or WebP). If the favicon is missing, the logo is used as its fallback.</p><div class="brand-admin-grid"><div class="brand-upload"><div class="brand-preview">${db.brand.logo?`<img src="${esc(db.brand.logo)}" alt="">`:`${brandMark()}`}</div><b>Portfolio logo</b><input type="file" id="brand-logo-input" accept="image/png,image/jpeg,image/webp" hidden><div class="table-actions"><button class="btn sm primary" data-action="upload-brand-logo">Upload</button><button class="btn sm" data-action="clear-brand-logo">Remove</button></div></div><div class="brand-upload"><div class="brand-preview">${db.brand.favicon?`<img src="${esc(db.brand.favicon)}" alt="Favicon">`:db.brand.logo?`<img src="${esc(db.brand.logo)}" alt="Fallback favicon">`:'<span class="brand-mark">M.</span>'}</div><b>Browser tab icon</b><input type="file" id="brand-favicon-input" accept="image/png,image/jpeg,image/webp" hidden><div class="table-actions"><button class="btn sm primary" data-action="upload-brand-favicon">Upload</button><button class="btn sm" data-action="clear-brand-favicon">Remove</button></div></div></div></div><div class="panel"><h3>Professional identity & project filters</h3><p class="sub small">Choose how you describe yourself; categories are derived from published projects, so no empty categories appear. In Edit Project, add new tracks separated by commas.</p><form id="portfolio-preferences-form"><div class="field"><label>Main professional descriptor</label><input name="focus" value="${esc(db.settings.focus)}" placeholder="e.g. Software & Systems Engineer"></div><div class="field"><label>Default project filter</label><select name="defaultTrack">${['All',...new Set(db.projects.filter(p=>p.published).flatMap(p=>p.tracks||[]).map(x=>x.trim()).filter(Boolean))].map(x=>`<option value="${esc(x)}" ${(db.settings.defaultTrack||'All')===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label for="home-project-count">Projects shown on homepage</label><input id="home-project-count" name="homeProjectCount" type="number" min="5" step="1" required value="${homeProjectCount(db.settings.homeProjectCount)}"></div><button class="btn primary" type="submit">Save preferences ✓</button></form></div><div class="panel"><h3>Homepage SEO · Search appearance</h3><p class="sub small">Edit the search title and description used by your portfolio. Leave a field blank to use the existing page content.</p><form id="seo-home-form">
<div class="form-grid form-grid-three">${textField('seoTitle','Search title EN (optional)',db.settings.seoTitle||'')}${textField('seoTitleAr','Search title AR (optional)',db.settings.seoTitleAr||'',true)}${textField('seoTitleEs','Search title ES (optional)',db.settings.seoTitleEs||'')}</div>
<div class="form-grid form-grid-three">${textField('seoDescription','Search description EN (optional)',db.settings.seoDescription||'',false,true)}${textField('seoDescriptionAr','Search description AR (optional)',db.settings.seoDescriptionAr||'',true,true)}${textField('seoDescriptionEs','Search description ES (optional)',db.settings.seoDescriptionEs||'',false,true)}</div>
<button class="btn primary" type="submit">Save homepage SEO ✓</button></form></div><div class="panel"><h3>Project categories (automatic)</h3><p class="sub small">Add or remove a track by editing its projects. A category disappears automatically once no published project uses it.</p><div class="pills">${[...new Set(db.projects.filter(p=>p.published).flatMap(p=>p.tracks||[]).filter(Boolean))].map(x=>`<span class="pill">${esc(x)}</span>`).join('')}</div><button class="btn sm" data-tab="projects">Manage projects ↗</button></div><div class="panel"><h3>Languages</h3><p class="sub small">English and Arabic are enabled. Spanish fields are available across projects, homepage, offers, experience, certificates and custom sections. Enable public ES when translations are ready.</p><div class="toggle"><label for="spanish-toggle">Enable Spanish in public website</label><input type="checkbox" id="spanish-toggle" ${db.settings.enableEs?'checked':''}></div></div><div class="panel"><h3>Downloadable CVs (PDF)</h3><p class="sub small">Upload multiple targeted CVs, give each one a title, then visitors can select which version to download. Existing single CVs remain available.</p>
<form id="cv-form"><div class="form-grid"><div class="field"><label>Button title (e.g. Backend Developer CV)</label><input name="title" maxlength="100" required placeholder="Backend Developer CV"></div><div class="field"><label>CV PDF</label><input name="pdf" type="file" accept="application/pdf" required></div></div><button class="btn primary sm" type="submit">+ Upload CV to R2</button></form>
<div class="cv-admin-list">${cvEntries().map((c,i)=>`<div class="cv-admin-row"><div><strong>${esc(c.title)}</strong><small>${c.legacy?'Previously uploaded CV':'PDF in R2'}</small></div><div class="table-actions"><a class="btn sm" target="_blank" rel="noopener" href="${c.legacy?'/cv':'/cv/'+encodeURIComponent(c.id)}">Download ↓</a><button class="btn sm" data-action="rename-cv" data-id="${esc(c.id)}">Rename</button><button class="btn sm danger" data-action="remove-cv" data-id="${esc(c.id)}">Remove</button></div></div>`).join('')||'<p class="sub small">No CVs uploaded yet.</p>'}</div></div><div class="panel"><h3>Security & backend</h3><p class="sub small">Every protected request is authenticated by the Worker using the token stored only in memory.</p><button class="btn sm" data-action="lock">Lock dashboard</button></div><div class="panel"><h3>Live site data</h3><p class="sub small">Content is stored in D1 and files in R2. You can export site data via GET /api/admin/state.</p><span class="muted small">Avoid clearing live site data without a backup.</span></div>`;
default:return ''}}
function login(){return `<div class="login-wrap"><div class="login-card">${brandMark()}<h1>Welcome back<span class="accent">.</span></h1><p>Enter your admin token to manage your portfolio.</p><form id="login-form"><div class="field"><label>Admin token</label><input name="token" type="password" autocomplete="off" required></div><button class="btn primary" type="submit">Unlock dashboard ↗</button></form><p class="tip">The token is kept in this page only. Reloading requires unlocking again.</p><a href="/" class="btn sm ghost">← Back to website</a></div></div>`}
function textField(name,label,val='',rtl=false,area=false){return `<div class="field"><label>${label}</label>${area?`<textarea ${rtl?'dir="rtl"':''} name="${name}">${esc(val)}</textarea>`:`<input ${rtl?'dir="rtl"':''} name="${name}" value="${esc(val)}">`}</div>`}
function lightbox(){if(!ui.lightbox||route().name!=='project')return '';const p=getProject(route().id),media=currentGallery(p),g=media[Math.min(ui.gallery,media.length-1)];return `<div class="lightbox-backdrop" data-action="lightbox-backdrop" role="presentation"><div class="lightbox-shell" role="dialog" aria-modal="true" aria-label="Media viewer"><div class="lightbox-toolbar"><span>${ui.gallery+1} / ${media.length}</span><div><button data-action="zoom-out" aria-label="Zoom out">−</button><span>${Math.round(ui.zoom*100)}%</span><button data-action="zoom-in" aria-label="Zoom in">+</button><button data-action="zoom-reset" aria-label="Reset zoom">↺</button><button class="lightbox-close" data-action="close-lightbox" aria-label="Close">✕</button></div></div><div class="lightbox-canvas"><div class="lightbox-zoom" style="transform:scale(${ui.zoom})">${galleryFrame(p,g)}</div></div><button class="lightbox-arrow lightbox-prev" data-action="lightbox-prev" aria-label="Previous media">‹</button><button class="lightbox-arrow lightbox-next" data-action="lightbox-next" aria-label="Next media">›</button></div></div>`}
function dialog(){if(!ui.modal)return '';const p=ui.modalId?getProject(ui.modalId):null,c=db.certificates.find(c=>c.id===ui.modalId),o=db.offers.find(o=>o.id===ui.modalId),g=db.hardSkills.find(g=>g.id===ui.modalId),s=db.softSkills.find(s=>s.id===ui.modalId);let title='',content='';switch(ui.modal){
case 'delete-project':title='Delete project?';content=`<p class="sub">Delete ${esc(p?.title||'this project')} from the preview?</p><div class="hero-ctas"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-delete-project">Delete</button></div>`;break;
case 'custom-section':{const x=db.customSections.find(x=>x.id===ui.modalId);title=x?'Edit flexible section':'Create flexible section';content=`<form id="custom-section-form"><p class="sub small">Choose a layout and add any number of items (cards, testimonials, FAQs, milestones, services or articles).</p><div class="form-grid form-grid-three">${textField('title','Section title EN',x?.title)}${textField('titleAr','Title AR',x?.titleAr,true)}${textField('titleEs','Title ES',x?.titleEs)}</div><div class="form-grid form-grid-three">${textField('eyebrow','Eyebrow EN',x?.eyebrow)}${textField('eyebrowAr','Eyebrow AR',x?.eyebrowAr,true)}${textField('eyebrowEs','Eyebrow ES',x?.eyebrowEs)}</div><div class="form-grid form-grid-three">${textField('description','Description EN',x?.description,false,true)}${textField('descriptionAr','Description AR',x?.descriptionAr,true,true)}${textField('descriptionEs','Description ES',x?.descriptionEs,false,true)}</div><div class="field"><label>Content layout</label><select name="layout">${[['cards','Cards / services / articles'],['timeline','Timeline / steps'],['stats','Achievements / numbers'],['quotes','Testimonials / quotes'],['faq','FAQ / accordion'],['list','Compact list']].map(([val,label])=>`<option value="${val}" ${x?.layout===val?'selected':''}>${label}</option>`).join('')}</select></div><button class="btn primary" type="submit">Save section ✓</button></form>`;break}
case 'custom-item':{const [sid,iid]=(ui.modalId||'').split('|'),x=db.customSections.find(x=>x.id===sid),it=x?.items.find(x=>x.id===iid);title=it?'Edit content item':'Add content item';content=`<form id="custom-item-form"><input name="sectionId" type="hidden" value="${esc(sid)}"><input name="itemId" type="hidden" value="${esc(iid||'')}"><p class="sub small">Generic item: text and optional image, icon, metric, badge and link.</p><div class="form-grid form-grid-three">${textField('title','Title / question EN',it?.title)}${textField('titleAr','Title / question AR',it?.titleAr,true)}${textField('titleEs','Title / question ES',it?.titleEs)}</div><div class="form-grid form-grid-three">${textField('description','Body / answer EN',it?.description,false,true)}${textField('descriptionAr','Body / answer AR',it?.descriptionAr,true,true)}${textField('descriptionEs','Body / answer ES',it?.descriptionEs,false,true)}</div><div class="form-grid">${textField('icon','Icon (emoji/symbol)',it?.icon)}${textField('value','Large number / step',it?.value)}</div><div class="form-grid">${textField('meta','Badge / attribution',it?.meta)}${textField('link','Optional HTTPS link',it?.link)}</div><div class="form-grid form-grid-three">${textField('alt','Image ALT EN',it?.alt||'')}${textField('altAr','Image ALT AR',it?.altAr||'',true)}${textField('altEs','Image ALT ES',it?.altEs||'')}</div><div class="field"><label>Optional image (URL or upload from Media Library)</label><input name="image" value="${esc(it?.image||'')}" placeholder="https://..."><select id="custom-media-select"><option value="">Select an uploaded image...</option>${db.media.filter(m=>m.type.startsWith('image/')&&m.src).map(m=>`<option value="${esc(m.src)}">${esc(m.name)}</option>`).join('')}</select></div><button class="btn primary" type="submit">Save item ✓</button></form>`;break}
case 'certificate':title=c?'Edit certificate':'New certificate';content=`<form id="cert-form"><div class="form-grid form-grid-three">${textField('title','Title EN',c?.title)}${textField('titleAr','Title AR',c?.titleAr,true)}${textField('titleEs','Title ES',c?.titleEs)}</div>${textField('issuer','Issuer',c?.issuer)}${textField('year','Year',c?.year||'2026')}${textField('linkedinPostUrl','LinkedIn post URL (optional)',c?.linkedinPostUrl||'')}<div class="field"><label>Certificate image</label><div class="cert-image-preview"><img src="${esc(c?.image||'')}" alt="Certificate preview"></div><input type="file" id="cert-image-upload" accept="image/*"><button class="btn sm" type="button" data-action="clear-cert-image">Remove certificate image</button><small class="sub">Choose a certificate photo or screenshot. It is uploaded to R2.</small></div><div class="form-grid form-grid-three">${textField('alt','Image ALT EN',c?.alt||'')}${textField('altAr','Image ALT AR',c?.altAr||'',true)}${textField('altEs','Image ALT ES',c?.altEs||'')}</div><button class="btn primary" type="submit">Save certificate ✓</button></form>`;break;
case 'skill-group':title=g?'Edit hard skills group':'New skills group';content=`<form id="hard-skill-form">${textField('name','Group title — English',g?.name)}${textField('nameAr','Group title — Arabic',g?.nameAr,'rtl')}${textField('nameEs','Group title — Spanish',g?.nameEs)}${tagField('items','Skills',g?.items||[],'newline')}<button class="btn primary" type="submit">Save group ✓</button></form>`;break;
case 'soft-skill':title=s?'Edit soft skill':'Add soft skill';content=`<form id="soft-skill-form">${textField('name','English',s?.name)}${textField('nameAr','Arabic',s?.nameAr,true)}${textField('nameEs','Spanish',s?.nameEs)}<button class="btn primary" type="submit">Save skill ✓</button></form>`;break;
case 'offer':title=o?'Edit offer':'New offer';content=`<form id="offer-form"><div class="form-grid">${textField('title','Title EN',o?.title)}${textField('titleAr','Title AR',o?.titleAr,true)}${textField('titleEs','Title ES',o?.titleEs)}</div><div class="form-grid">${textField('keyword','Big offer word EN',o?.keyword||'FREE')}${textField('keywordAr','Big word AR',o?.keywordAr||'مجانًا',true)}${textField('keywordEs','Big word ES',o?.keywordEs||'GRATIS')}${textField('highlight','Highlight EN',o?.highlight)}${textField('highlightAr','Highlight AR',o?.highlightAr,true)}${textField('highlightEs','Highlight ES',o?.highlightEs)}</div><div class="form-grid">${textField('description','Description EN',o?.description,false,true)}${textField('descriptionAr','Description AR',o?.descriptionAr,true,true)}${textField('descriptionEs','Description ES',o?.descriptionEs,false,true)}</div><div class="form-grid">${textField('terms','Conditions EN',o?.terms,false,true)}${textField('termsAr','Conditions AR',o?.termsAr,true,true)}${textField('termsEs','Conditions ES',o?.termsEs,false,true)}</div><label class="inline-checkbox"><input type="checkbox" name="active" ${o?!o.active?'':'checked':'checked'}> Show this offer publicly</label><div class="hero-ctas"><button class="btn primary" type="submit">Save offer ✓</button><button class="btn" data-action="close-modal">Cancel</button></div></form>`;break;

case 'social':{const s=db.socials.find(x=>x.id===ui.modalId);title=s?'Edit social link':'Add social link';content=`<form id="social-form">${textField('label','Label / platform',s?.label||'GitHub')}${textField('url','Full URL (https://, mailto:, tel:)',s?.url||'')}<p class="sub micro">Include a full URL, e.g. https://github.com/yourusername</p><button class="btn primary" type="submit">Save link ✓</button></form>`;break}
case 'experience':{const x=db.experience.find(x=>x.id===ui.modalId);title=x?'Edit experience':'Add experience';content=`<form id="experience-form"><div class="form-grid">${textField('title','Title EN',x?.title)}${textField('titleAr','Title AR',x?.titleAr,true)}${textField('titleEs','Title ES',x?.titleEs)}</div><div class="form-grid">${textField('subtitle','Subtitle EN',x?.subtitle)}${textField('subtitleAr','Subtitle AR',x?.subtitleAr,true)}${textField('subtitleEs','Subtitle ES',x?.subtitleEs)}</div>${textField('period','Period',x?.period)}<div class="form-grid">${textField('description','Description EN',x?.description,false,true)}${textField('descriptionAr','Description AR',x?.descriptionAr,true,true)}${textField('descriptionEs','Description ES',x?.descriptionEs,false,true)}</div><button class="btn primary" type="submit">Save experience ✓</button></form>`;break}
case 'view':{const v=db.views.find(x=>x.id===ui.modalId),tracks=[...new Set(db.projects.flatMap(p=>p.tracks||[]))];title=v?'Edit focused link':'Create focused link';content=`<form id="view-form"><div class="form-grid">${textField('name','Link name',v?.name||'Backend + AI')}${textField('slug','URL slug',v?.slug||'backend-ai')}</div><div class="field"><label>Matching tracks · include projects with ANY selected track</label><div class="selector-grid">${tracks.map(x=>`<label class="inline-checkbox"><input name="tracks" type="checkbox" value="${esc(x)}" ${(v?.tracks||[]).includes(x)?'checked':''}>${esc(x)}</label>`).join('')}</div></div><div class="field"><label>Pinned projects · always appear first</label><div class="selector-grid">${db.projects.map(p=>`<label class="inline-checkbox"><input name="projectIds" type="checkbox" value="${esc(p.id)}" ${(v?.projectIds||[]).includes(p.id)?'checked':''}>${esc(p.title)}</label>`).join('')}</div></div><label class="inline-checkbox"><input name="active" type="checkbox" ${v?.active!==false?'checked':''}>Link active</label><div class="hero-ctas"><button class="btn primary" type="submit">Save share link ✓</button><button class="btn" type="button" data-action="close-modal">Cancel</button></div></form>`;break}

case 'media-alt':{
 const m=db.media.find(x=>x.id===ui.modalId);title='Image ALT text';
 content=`<form id="media-alt-form"><input type="hidden" name="mediaId" value="${esc(m?.id||'')}"><p class="sub small">Describe what the image actually shows. Leave blank for a contextual default. Don't stuff keywords.</p><div class="form-grid form-grid-three">${textField('alt','ALT EN',m?.alt||'')}${textField('altAr','ALT AR',m?.altAr||'',true)}${textField('altEs','ALT ES',m?.altEs||'')}</div><button class="btn primary" type="submit">Save ALT ✓</button></form>`;break;
}
case 'project':{
 title=p?'Edit project' :'New project';
 const uniqueTracks=[...new Set(db.projects.flatMap(pr=>pr.tracks||[]).map(t=>t.trim()).filter(Boolean))].sort();
 const chosenTracks=p?.tracks||[];
 const fieldHelp={
  title:['Project name','اسم المشروع'],
  category:['Short project type, e.g. Web Platform','نوع المشروع باختصار'],
  summary:['Simple teaser: what the project does in 1–2 sentences; used on cards and search previews.','جملة أو جملتين لأي زائر بدون مصطلحات تقنية'],
  overview:['Project Story: describe the goal, user and benefit in plain language without frameworks.','قصة المشروع بلغة بسيطة: مين بيستخدمه وفايدته إيه'],
  problem:['Challenge: the real problem or technical obstacle.','التحدي أو المشكلة اللي المشروع بيعالجها'],
  solution:['Approach: how you solved the problem.','إزاي حلّيت المشكلة'],
  technicalDetails:['Technical Implementation: architecture, services, APIs, models, databases, integrations and your engineering decisions.','التفاصيل التقنية: الـArchitecture والـAPI وقواعد البيانات والتكاملات ودورك الفني'],
  role:['My role: short responsibilities, e.g. Backend Development · AI Integration. Not a full paragraph.','دورك باختصار، مثال: Backend Development · AI Integration']
 };
 const multiline=['summary','overview','problem','solution','technicalDetails'];
 const localizedFields=['title','category','summary','overview','problem','solution','technicalDetails','role'].map(k=>`<div class="field-group"><div class="form-grid form-grid-three">${textField(k,`${k==='role'?'My role':k==='technicalDetails'?'Technical Implementation':k==='summary'?'Summary (simple)':k==='overview'?'Project Story (non-technical)':k==='problem'?'Challenge':k==='solution'?'Approach':k==='category'?'Project type':'Title'} · EN`,p?.[k],false,multiline.includes(k))}${textField(k+'Ar',`${k} · AR`,p?.[k+'Ar'],true,multiline.includes(k))}${textField(k+'Es',`${k} · ES`,p?.[k+'Es'],false,multiline.includes(k))}</div><p class="field-help">${fieldHelp[k][0]} · ${fieldHelp[k][1]}</p></div>`).join('');
 const selectedCoverId=ui.pendingProjectCoverId??p?.coverMediaId??'';
 const cover=db.media.find(m=>m.id===selectedCoverId&&m.type?.startsWith('image/'));
 content=`<form id="project-form"><p class="sub small">Spanish translations are editable even when Spanish is hidden publicly. An empty translation falls back to English.</p>
 ${localizedFields}
 <div class="panel"><h3>Project SEO · Search appearance (optional)</h3><p class="field-help">For the project's Google search result: a concise descriptive title and summary. If left empty, the project title and Summary are used automatically.</p>
<div class="form-grid form-grid-three">${textField('seoTitle','Search title EN',p?.seoTitle||'')}${textField('seoTitleAr','Search title AR',p?.seoTitleAr||'',true)}${textField('seoTitleEs','Search title ES',p?.seoTitleEs||'')}</div>
<div class="form-grid form-grid-three">${textField('seoDescription','Search description EN',p?.seoDescription||'',false,true)}${textField('seoDescriptionAr','Search description AR',p?.seoDescriptionAr||'',true,true)}${textField('seoDescriptionEs','Search description ES',p?.seoDescriptionEs||'',false,true)}</div>
</div>
<div class="panel project-cover-editor"><h3>Project cover / homepage banner</h3><p class="field-help">Upload the image displayed on the project card. It can be different from the project gallery images.</p><div class="cover-editor-preview" id="project-cover-preview">${cover?`<img src="${esc(cover.src)}" alt="Cover preview">`:'<div class="cover-empty">No cover selected</div>'}</div>
 <div class="form-grid"><div class="field"><label for="project-cover-search">Search cover images</label><input id="project-cover-search" type="search" autocomplete="off" placeholder="Find an uploaded cover..."><label for="project-cover-select">Choose existing image (newest first)</label><select name="coverMediaId" id="project-cover-select"><option value="">No cover</option>${mediaNewestFirst().filter(m=>m.type?.startsWith('image/')).map(m=>`<option value="${esc(m.id)}" ${selectedCoverId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select></div><div class="field"><label>Upload a new cover (R2)</label><input type="file" id="project-cover-upload" accept="image/png,image/jpeg,image/webp,image/avif,image/gif"><small class="sub">PNG, JPEG, WebP, AVIF or GIF. Uploading creates a media item; saving the project attaches it.</small></div></div></div>
 <div class="panel"><h3>Areas / specializations (multiple)</h3><p class="field-help">A project can appear under Backend, AI, Frontend, Automation, IoT, or any combination. Tick existing areas, and optionally add more below.</p><div class="selector-grid">${uniqueTracks.map(t=>`<label class="inline-checkbox"><input type="checkbox" name="trackExisting" value="${esc(t)}" ${chosenTracks.includes(t)?'checked':''}>${esc(t)}</label>`).join('')}</div>${tagField('trackNew','Additional areas',chosenTracks.filter(x=>!uniqueTracks.includes(x)))}</div>
 <div class="form-grid">${tagField('stack','Tech stack',p?.stack||[])}${textField('year','Year',p?.year||String(new Date().getFullYear()))}</div>
 <div class="form-grid form-grid-three">${tagField('features','Highlights EN',p?.features||[],'newline')}${tagField('featuresAr','أهم المميزات AR',p?.featuresAr||[],'newline',true)}${tagField('featuresEs','Características ES',p?.featuresEs||[],'newline')}</div>
 <p class="field-help">Add each highlight using Enter; click a chip to remove it. Include only work you actually completed.</p>
 <div class="form-grid">${textField('status','Status (Completed / In progress)',p?.status||'Completed')}<div class="field"><label>Fallback visual theme (when no project image exists)</label><select name="tone">${[['blue','Blue'],['gold','Gold'],['rose','Rose'],['violet','Violet']].map(([v,l])=>`<option value="${v}" ${(p?.tone||'blue')===v?'selected':''}>${l}</option>`).join('')}</select></div></div>
 <div class="form-grid">${textField('github','GitHub URL (optional)',p?.github)}${textField('demo','Live demo URL (optional)',p?.demo)}</div>
 <div class="panel"><h3>More project links</h3><p class="field-help">One per line: Label | URL. Examples: Contact client | mailto:client@example.com, Technical documentation | https://...</p>${tagField('links','Label | URL',(p?.links||[]).map(x=>x.label+' | '+x.url),'newline')}</div>
 <div class="panel"><h3>Project gallery</h3><p class="field-help">Selected files keep their gallery order; available media appears newest first. Use ↑ or ↓ to reorder selected files. The cover appears first.</p><div class="field"><label for="project-media-search">Search images and videos</label><input id="project-media-search" type="search" autocomplete="off" placeholder="Find media by filename..."></div><p id="project-media-empty" class="field-help" hidden>No media matching your search.</p><div class="media-checklist">${projectMediaRows(p?.mediaIds||[])}</div></div>
 <div class="check-row"><label><input name="published" type="checkbox" ${p?.published?'checked':''}> Published — visible to visitors and included in sitemap</label><label><input name="featured" type="checkbox" ${p?.featured?'checked':''}> Featured — prioritized in the homepage selected work (not a separate page)</label></div>
 <div class="hero-ctas"><button class="btn primary" type="submit">Save project ✓</button>${p?`<button class="btn" type="button" data-action="preview-project" data-id="${esc(p.id)}">Preview saved version</button>`:''}<button class="btn" type="button" data-action="close-modal">Cancel</button></div></form>`;
 break;
}
}
return `<div class="overlay"><div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="dialog-head"><h2>${esc(title)}</h2><button class="round" data-action="close-modal" aria-label="Close">✕</button></div>${content}</div></div>`}
function cleanUrl(u){try{const v=new URL(u);return ['https:','http:','mailto:','tel:'].includes(v.protocol)?v.toString():'#'}catch{return '#'}}
function projectMediaRow(id,name,checked,first=false,last=false){
 return `<div class="project-media-row"><label class="inline-checkbox"><input type="checkbox" name="mediaIds" value="${esc(id)}" ${checked?'checked':''}>${esc(name)}</label><div class="project-media-order" ${checked?'':'hidden'}><button class="btn sm" type="button" data-action="move-project-media" data-direction="up" aria-label="Move ${esc(name)} up" ${first?'disabled':''}>↑</button><button class="btn sm" type="button" data-action="move-project-media" data-direction="down" aria-label="Move ${esc(name)} down" ${last?'disabled':''}>↓</button></div></div>`;
}
function projectMediaRows(ids){
 const selected=[...new Set(ids)];
 const media=new Map(mediaNewestFirst().map(item=>[item.id,item.name]));
 return selected.map((id,index)=>projectMediaRow(id,media.get(id)||'Unavailable media',true,index===0,index===selected.length-1)).join('')+
  [...media].filter(([id])=>!selected.includes(id)).map(([id,name])=>projectMediaRow(id,name,false)).join('');
}
function refreshProjectMediaButtons(list){
 const rows=Array.from(list.querySelectorAll('.project-media-row')).filter(row=>row.querySelector('input').checked);
 rows.forEach((row,index)=>{
  row.querySelector('[data-direction="up"]').disabled=index===0;
  row.querySelector('[data-direction="down"]').disabled=index===rows.length-1;
 });
}
// Library pagination is local to the authenticated dashboard; only current-page
// media cards are mounted, while search still covers the entire collection.
const MEDIA_PAGE_SIZE=24;
let mediaLibraryPage=1,mediaLibraryQuery='';
function mediaPageSlice(items,query,page,size){
 const q=String(query||'').normalize('NFKC').trim().toLocaleLowerCase();
 const filtered=items.filter(m=>`${m.name||''} ${m.type||''}`.normalize('NFKC').toLocaleLowerCase().includes(q));
 const count=filtered.length,pages=Math.max(1,Math.ceil(count/size)),current=Math.max(1,Math.min(pages,Math.floor(page)||1));
 return {items:filtered.slice((current-1)*size,current*size),count,pages,page:current};
}
function mediaLibraryResults(){
 const result=mediaPageSlice(mediaNewestFirst(),mediaLibraryQuery,mediaLibraryPage,MEDIA_PAGE_SIZE);mediaLibraryPage=result.page;
 const first=result.count?(result.page-1)*MEDIA_PAGE_SIZE+1:0,last=Math.min(result.count,result.page*MEDIA_PAGE_SIZE);
 const pager=`<nav aria-label="Media pagination" class="table-actions" style="justify-content:space-between;margin:14px 0"><span class="sub small">${first}–${last} of ${result.count} files · Page ${result.page} / ${result.pages}</span><div class="table-actions"><button class="btn sm" data-action="media-page" data-value="${result.page-1}" ${result.page===1?'disabled':''}>← Previous</button><button class="btn sm" data-action="media-page" data-value="${result.page+1}" ${result.page===result.pages?'disabled':''}>Next →</button></div></nav>`;
 return `${pager}${result.count?`<div class="media-grid">${result.items.map(m=>`<div class="media-item"><div class="media-visual" data-action="preview-media" data-id="${esc(m.id)}" role="button" tabindex="0" aria-label="Preview ${esc(m.name)}">${m.type.startsWith('image/')?`<img loading="lazy" decoding="async" src="${esc(m.src)}" alt="${esc(m.name)}">`:m.type.startsWith('video/')?`<video src="${esc(m.src)}" muted preload="none" playsinline></video><span class="media-play-icon">▶</span>`:m.type==='application/pdf'?'<span class="media-pdf-icon">PDF</span>':'▧'}</div><div class="info media-card-info"><div class="media-card-name"><b>${esc(m.name)}</b><p class="muted micro">${esc(m.type)}</p></div>${mediaActions(m)}</div></div>`).join('')}</div>`:'<p id="media-library-empty" class="field-help">No media matching your search.</p>'}${result.count>MEDIA_PAGE_SIZE?pager:''}`;
}
function mediaActions(m){
 const id=esc(m.id);
 return `<details class="media-actions"><summary aria-label="Actions for ${esc(m.name)}" title="Media actions">⋮</summary><div class="media-actions-panel" role="group" aria-label="Media actions"><button type="button" data-action="preview-media" data-id="${id}">Preview ↗</button>${m.type.startsWith('image/')?`<button type="button" data-action="edit-media-alt" data-id="${id}">ALT text</button>`:''}<button type="button" data-action="rename-media" data-id="${id}">Rename</button>${/^(image|video)\//.test(m.type)?`<button type="button" data-action="reedit-media" data-id="${id}">Edit copy</button>`:''}<button type="button" class="danger" data-action="delete-media" data-id="${id}">Delete</button></div></details>`;
}
// Only one media menu stays open. Native details supplies keyboard activation.
document.addEventListener('toggle',event=>{
 const menu=event.target;if(!menu.matches?.('.media-actions[open]'))return;
 document.querySelectorAll('.media-actions[open]').forEach(other=>{if(other!==menu)other.open=false;});
},true);
document.addEventListener('click',event=>{
 const menu=event.target.closest('.media-actions');
 document.querySelectorAll('.media-actions[open]').forEach(other=>{if(other!==menu)other.open=false;});
 if(menu&&event.target.closest('.media-actions-panel button')){menu.open=false;menu.querySelector('summary')?.focus();}
},true);
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 const menu=document.querySelector('.media-actions[open]');if(!menu)return;
 menu.open=false;menu.querySelector('summary')?.focus();event.preventDefault();event.stopPropagation();
},true);
function refreshMediaLibrary(){const target=$('#media-library-results');if(target)target.innerHTML=mediaLibraryResults();}
async function renameMedia(id){
 if(!ui.authenticated||!adminToken||libraryUploadInProgress)return;
 const m=db.media.find(x=>x.id===id);if(!m)return;
 const {filenameParts,namedOutput}=await import('/media-editor-controls.js');const {base,ext}=filenameParts(m.name);
 const entered=prompt('New filename (extension is preserved)',base);if(entered===null)return;
 const session=adminToken;libraryUploadInProgress=true;
 try{const name=namedOutput(entered,'',ext);if(name===m.name)return;await lastSave;
  if(adminToken!==session||!ui.authenticated)throw Error('Admin session ended');
  const result=await api('/api/admin/files/'+encodeURIComponent(id),{method:'PATCH',body:{name}});
  if(adminToken!==session)return;m.name=result.name;refreshMediaLibrary();toast('Media renamed');
 }catch(e){toast('Rename failed: '+e.message)}finally{libraryUploadInProgress=false;}
}
async function reeditMedia(id){
 if(!ui.authenticated||!adminToken||libraryUploadInProgress)return;
 const m=db.media.find(x=>x.id===id);if(!m||!(/^(image|video)\//.test(m.type)))return;
 // Fetch only existing same-origin R2 media; never follow arbitrary URLs.
 if(!/^\/media\/[0-9a-f-]{36}$/i.test(m.src)){toast('This is not a local media file');return;}
 if(Number(m.bytes)>90*1024*1024){toast('File exceeds the 90 MiB editor limit');return;}
 libraryUploadInProgress=true;const session=adminToken;
 try{toast('Loading media for editing…');const response=await fetch(m.src,{redirect:'error'});if(!response.ok)throw Error('Could not load source file');
  if(Number(response.headers.get('Content-Length'))>90*1024*1024)throw Error('Source exceeds 90 MiB');
  const blob=await response.blob();if(!blob.size||blob.size>90*1024*1024)throw Error('Invalid source size');
  if(adminToken!==session||!ui.authenticated)throw Error('Admin session ended');
  const file=new File([blob],m.name,{type:m.type});const {openMediaStudio}=await import('/media-studio.js');
  const result=await openMediaStudio([file],async prepared=>{
   if(adminToken!==session||!ui.authenticated)throw Error('Admin session ended');
   const item=await uploadPreparedMedia(prepared);if(adminToken!==session)throw Error('Admin session ended');
   for(const k of ['alt','altAr','altEs'])if(typeof m[k]==='string')item[k]=m[k];db.media.unshift(item);save();
   if(!await lastSave)throw Error('File uploaded but media metadata could not be saved. Check the dashboard before retrying.');return item;
  });
  if(adminToken!==session)return;if(result.uploaded.length){mediaLibraryPage=1;mediaLibraryQuery='';render(true);toast('Edited copy uploaded — original and project references preserved');}
 }catch(e){toast('Edit copy failed: '+e.message)}finally{libraryUploadInProgress=false;}
}
let libraryUploadInProgress=false;
async function uploadToMediaLibrary(files){
 if(!files.length||!ui.authenticated)return;
 if(libraryUploadInProgress){toast('Wait for the current upload to finish');return}
 libraryUploadInProgress=true;
 const session=adminToken;
 try{
  const {openMediaStudio}=await import('/media-studio.js');
  const result=await openMediaStudio(files,async file=>{
   if(!ui.authenticated||adminToken!==session)throw new Error('Admin session ended');
   const item=await uploadPreparedMedia(file);
   if(adminToken!==session)throw new Error('Admin session ended');
   db.media.unshift(item);
   save();
   if(!await lastSave)throw new Error('File uploaded but media metadata could not be saved. Check the dashboard before retrying.');
   return item;
  });
  if(adminToken!==session)return;
  if(result.uploaded.length&&ui.tab==='media'&&!ui.modal){mediaLibraryPage=1;mediaLibraryQuery='';render(true);}
  toast(`${result.uploaded.length} uploaded, ${result.failures.length} failed${result.cancelled?' — stopped':''}`);
 }catch(err){toast('Media editor: '+err.message)}
 finally{libraryUploadInProgress=false}
}
function mediaDeleteDialog(){
 const warning=ui.mediaDeleteWarning;if(!warning)return '';
 const m=db.media.find(x=>x.id===warning.id);
 const uses=warning.references||[];
 return `<div class="overlay media-use-overlay"><div class="dialog media-use-dialog" role="dialog" aria-modal="true" aria-label="File in use">
  <div class="dialog-head"><h2>Cannot delete this file</h2><button class="round" data-action="close-media-use" aria-label="Close">✕</button></div>
  <p class="sub">${esc(m?.name||'This file')} is still referenced in <strong>${uses.length} location${uses.length===1?'':'s'}</strong>.</p>
  <p class="sub small">Open each location, remove or replace the file, then save your changes. The file will remain available until no references exist.</p>
  <div class="media-use-list">${uses.map(u=>`<div class="media-use-row"><div><strong>${esc(u.title)}</strong><small>${esc(u.usage)} · ${esc(u.tab)}</small></div><button class="btn sm primary" data-action="goto-media-usage" data-kind="${esc(u.kind)}" data-id="${esc(u.id)}" data-tabtarget="${esc(u.tab)}">Open ${u.kind==='project'?'project':'location'} ↗</button></div>`).join('')}</div>
  <div class="hero-ctas"><button class="btn" data-action="close-media-use">Close</button></div></div></div>`;
}
function mediaPreview(){
 if(!ui.mediaPreviewId||route().name!=='admin')return '';
 const m=db.media.find(x=>x.id===ui.mediaPreviewId);if(!m)return '';
 const body=m.type.startsWith('image/')?`<img src="${esc(m.src)}" alt="${esc(m.name)}">`:m.type.startsWith('video/')?`<video src="${esc(m.src)}" controls playsinline preload="metadata" autoplay></video>`:m.type==='application/pdf'?`<iframe src="${esc(m.src)}#toolbar=1&navpanes=0" title="PDF preview: ${esc(m.name)}"></iframe>`:'<p>Preview is not supported for this file.</p>';
 return `<div class="media-preview-backdrop" data-action="close-media-preview" role="presentation"><div class="media-preview-dialog" role="dialog" aria-modal="true" aria-label="Media preview"><div class="media-preview-toolbar"><b>${esc(m.name)}</b><div><a class="btn sm" href="${esc(m.src)}" target="_blank" rel="noopener">Open source ↗</a><button class="round" data-action="close-media-preview" aria-label="Close preview">✕</button></div></div><div class="media-preview-content">${body}</div></div></div>`;
}
function demo(){const products=[{name:'Canvas Tote',cat:'Accessories',price:29,emoji:'👜'},{name:'Weekend Jacket',cat:'Clothing',price:79,emoji:'🧥'},{name:'White Sneakers',cat:'Shoes',price:65,emoji:'👟'},{name:'Card Holder',cat:'Accessories',price:35,emoji:'👝'}];const ps=ui.storeFilter==='All'?products:products.filter(p=>p.cat===ui.storeFilter);return `<div class="demo-strip">STATIC FRONTEND DEMO · Simulated products and cart. No real backend or purchases. <a href="/projects/saddle-ecommerce">← Portfolio</a></div><div class="demo-store"><div class="wrap"><nav class="store-nav"><div class="store-brand">SADDLE<span>.</span></div><a href="/projects/saddle-ecommerce">← Project details</a></nav><section class="store-hero"><div><span class="eyebrow">EVERYDAY ESSENTIALS</span><h1>Wear what<br>moves you.</h1><p>A small interactive storefront concept.</p><button class="btn primary" data-action="store-scroll">Shop collection ↗</button></div><div class="store-visual">🧢</div></section><section id="store-products"><div class="store-filters">${['All','Clothing','Shoes','Accessories'].map(x=>`<button class="btn sm" data-action="store-filter" data-value="${x}">${x}</button>`).join('')}</div><div class="store-grid">${ps.map(p=>`<div class="store-item"><div class="store-productart">${p.emoji}</div><div class="body"><h3>${p.name}</h3><p>${p.cat} / Demo</p><strong>$${p.price}.00</strong><button data-action="cart-add">Add to bag +</button></div></div>`).join('')}</div><p style="padding-bottom:30px">Bag: <span id="cart-number">${ui.storeCart}</span> items</p></section></div></div>`}
function route(){
 let path=decodeURIComponent(location.pathname);
 if(path.startsWith('/projects/'))return {name:'project',id:path.slice(10).split('/')[0]};
 if(path.startsWith('/focus/'))return {name:'focus',slug:path.slice(7).split('/')[0]};
 if(path.startsWith('/admin'))return ui.authenticated&&ui.previewProjectId?{name:'project',id:ui.previewProjectId,preview:true}:{name:'admin'};
 return {name:'home'};
}
// Keep metadata consistent when the public SPA navigates without a page reload.
// Direct server requests still receive the same metadata from src/render.js.
function refreshPublicSeo(r){
 if(!['home','focus','project'].includes(r.name))return;
 const p=r.name==='project'?getProject(r.id):null;
 const metaSource=p||db.settings||{};
 const title=r.name==='project'?(loc(metaSource,'seoTitle')||`${loc(p||{},'title')} — Mohamed Maher`):r.name==='focus'?`${db.views.find(v=>v.slug===r.slug)?.name||'Portfolio'} — Mohamed Maher`:(loc(db.settings,'seoTitle')||`Mohamed Maher — ${db.settings.focus||'Software Engineer'}`);
 const description=r.name==='project'?(loc(metaSource,'seoDescription')||loc(p||{},'summary')):r.name==='focus'?loc(db.hero,'intro'):(loc(db.settings,'seoDescription')||loc(db.hero,'intro'));
 document.title=title;
 const setMeta=(selector,content)=>{const el=document.querySelector(selector);if(el)el.setAttribute('content',String(content||'').slice(0,165))};
 setMeta('meta[name="description"]',description);
 setMeta('meta[property="og:title"]',title);
 setMeta('meta[property="og:description"]',description);
 const mediaIds=p?[p.coverMediaId,...(p.mediaIds||[])].filter(Boolean):[];
 const photo=p?mediaIds.map(id=>db.media.find(m=>m.id===id&&m.type?.startsWith('image/'))?.src).find(Boolean):(db.hero?.portrait||db.brand?.logo||'');
 let ogImage=document.querySelector('meta[property="og:image"]');
 if(photo){try{const src=new URL(photo,location.origin);if(src.protocol==='https:'){if(!ogImage){ogImage=document.createElement('meta');ogImage.setAttribute('property','og:image');document.head.appendChild(ogImage)}ogImage.setAttribute('content',src.href)}else ogImage?.remove()}catch{ogImage?.remove()}}else ogImage?.remove();
 const canonical=document.querySelector('link[rel="canonical"]');
 if(canonical){const path=r.name==='project'?`/projects/${encodeURIComponent(r.id)}`:r.name==='focus'?`/focus/${encodeURIComponent(r.slug)}`:'/';canonical.href=location.origin+path+(ui.lang==='en'?'':`?lang=${ui.lang}`)}
 // Keep alternate language tags in sync when the page is navigated client-side.
 const hrefPath=r.name==='project'?`/projects/${encodeURIComponent(r.id)}`:r.name==='focus'?`/focus/${encodeURIComponent(r.slug)}`:'/';
 const translated=lang=>!p||(p['title'+lang]&&p['summary'+lang]);
 const wanted=['en',...(db.hero?.introAr&&translated('Ar')?['ar']:[]),...(db.settings.enableEs&&db.hero?.introEs&&translated('Es')?['es']:[]),'x-default'];
 document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(x=>{if(!wanted.includes(x.hreflang))x.remove()});
 for(const lang of wanted){let link=[...document.querySelectorAll('link[rel="alternate"][hreflang]')].find(x=>x.hreflang===lang);
  if(!link){link=document.createElement('link');link.rel='alternate';link.hreflang=lang;document.head.appendChild(link)}
  link.href=location.origin+hrefPath+(['en','x-default'].includes(lang)?'':'?lang='+lang);
 }

}
function render(keepScroll=false){
 brandedFavicon();
 const r=route(),publicPage=['home','focus','project'].includes(r.name);
 // Keep BOTH axes: the thumbnail rail is vertical on desktop and horizontal on mobile.
 const oldRail=keepScroll&&r.name==='project'?$('.showcase-rail'):null;
 const railPosition=oldRail?{top:oldRail.scrollTop,left:oldRail.scrollLeft}:null;
 const pagePosition=keepScroll?{x:window.scrollX,y:window.scrollY}:null;
 document.documentElement.lang=publicPage?ui.lang:'en';
 document.documentElement.dir=publicPage&&ui.lang==='ar'?'rtl':'ltr';
 document.title=r.preview?'Project preview — '+(getProject(r.id)?.title||'Project'):r.name==='admin'?'Portfolio OS — Dashboard':r.name==='demo'?'Saddle Demo':document.title;
 if(publicPage&&!r.preview)refreshPublicSeo(r);
 $('#app').innerHTML=(r.preview?`<div class="draft-preview-bar" role="region" aria-label="Project preview"><div><strong>Preview only</strong><span>${getProject(r.id)?.published?'Published project · preview mode':'Draft · not accessible to visitors'}</span></div><button class="btn sm" type="button" data-action="close-project-preview">← Back to dashboard</button></div>${projectPage(r.id)}`:['home','focus'].includes(r.name)?home():r.name==='project'?projectPage(r.id):r.name==='admin'?dashboard():demo())+dialog()+lightbox()+mediaPreview()+mediaDeleteDialog();
 if(railPosition){
  const rail=$('.showcase-rail');
  if(rail){rail.scrollTop=railPosition.top;rail.scrollLeft=railPosition.left;}
 }
 // Zoomed full-screen images must keep native panning (instead of navigating).
 const canvas=$('.lightbox-canvas');
 if(canvas)canvas.style.touchAction=ui.zoom>1?'auto':'pan-y';
 if(pagePosition)window.scrollTo({left:pagePosition.x,top:pagePosition.y,behavior:'instant'});
 if(!keepScroll){
  window.scrollTo({top:0,behavior:'instant'});
  requestAnimationFrame(()=>{if(location.hash.startsWith('#'))document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0,behavior:'instant'})});
 }
}
function toast(msg){document.querySelector('.toast')?.remove();const x=document.createElement('div');x.className='toast';x.textContent=msg;document.body.append(x);clearTimeout(ui.toastTimer);ui.toastTimer=setTimeout(()=>x.remove(),2800)}
function go(path){window.location.href=path.startsWith('#/')?path.slice(1):path}
function closeModal(){ui.modal=null;ui.modalId=null;render(true)}
// Interpret saved multiline offer conditions as paragraphs or real numbered/bulleted lists.
// Never insert the original text as HTML; all user-provided content is escaped.
function formatOfferTerms(text){
 const lines=String(text||'').replace(/\r\n?/g,'\n').split('\n');
 let output='',list='',paragraph=[];
 const flushParagraph=()=>{if(paragraph.length){output+=`<p>${paragraph.map(esc).join('<br>')}</p>`;paragraph=[]}};
 const closeList=()=>{if(list){output+=`</${list}>`;list=''}};
 for(const line of lines){
  const value=line.trim();
  if(!value){flushParagraph();closeList();continue}
  const numbered=value.match(/^([0-9٠-٩]+)[.)-]\s+(.+)$/u);
  const bulleted=value.match(/^[-*•–]\s+(.+)$/u);
  if(numbered||bulleted){
   flushParagraph();
   const next=numbered?'ol':'ul';
   if(list!==next){closeList();output+=`<${next}>`;list=next}
   output+=`<li>${esc(numbered?numbered[2]:bulleted[1])}</li>`;
  }else{closeList();paragraph.push(value)}
 }
 flushParagraph();closeList();
 return output;
}
function openOfferTerms(id){
 const offer=db.offers.find(o=>o.id===id&&o.active);
 const text=loc(offer||{},'terms').trim();
 if(!text)return;
 document.querySelector('dialog.offer-terms-dialog')?.close();
 const modal=document.createElement('dialog');
 modal.className='offer-terms-dialog';
 modal.dir=ui.lang==='ar'?'rtl':'ltr';
 modal.setAttribute('aria-labelledby','offer-terms-dialog-title');
 modal.setAttribute('aria-describedby','offer-terms-dialog-subtitle');
 modal.innerHTML=`<div class="offer-terms-dialog-head"><div><span class="offer-terms-kicker">${tr('OFFER DETAILS','تفاصيل العرض','DETALLES DE LA OFERTA')}</span><h2 id="offer-terms-dialog-title">${tr('Terms & Conditions','الشروط والأحكام','Términos y condiciones')}</h2><p id="offer-terms-dialog-subtitle">${esc(loc(offer,'title'))}</p></div><button class="offer-terms-close" type="button" data-close-offer-terms aria-label="${tr('Close','إغلاق','Cerrar')}">✕</button></div><div class="offer-terms-dialog-body">${formatOfferTerms(text)}</div><div class="offer-terms-dialog-foot"><button type="button" class="offer-terms-done" data-close-offer-terms>${tr('Close','إغلاق','Cerrar')}</button></div>`;
 modal.addEventListener('click',event=>{if(event.target===modal||event.target.closest('[data-close-offer-terms]'))modal.close()});
 modal.addEventListener('close',()=>modal.remove(),{once:true});
 document.body.append(modal);
 modal.showModal();
 modal.querySelector('.offer-terms-close')?.focus();
}
async function compressImage(file,max=1200,quality=.82){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{try{const scale=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.round(im.width*scale);c.height=Math.round(im.height*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);let mime=file.type==='image/png'?'image/png':'image/jpeg';let data=c.toDataURL(mime,quality);URL.revokeObjectURL(url);res(data)}catch(err){URL.revokeObjectURL(url);rej(err)}};im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('Invalid image'))};im.src=url})}
document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action],[data-go],[data-tab],[data-lang],[data-track]');if(!el)return;if(!el.closest('#app')&&!el.closest('.lightbox-backdrop'))return;const d=el.dataset;if(d.go){go(d.go);return}if(d.lang){ui.lang=d.lang;const u=new URL(location.href);u.searchParams.set('lang',ui.lang);history.replaceState(null,'',u);render(true);return}if(d.track){ui.filter=d.track;render(true);document.getElementById('projects')?.scrollIntoView({block:'start'});return}if(d.tab){ui.tab=d.tab;render();if(window.matchMedia('(max-width: 760px)').matches){const main=$('.dash-main');main?.focus({preventScroll:true});main?.scrollIntoView({block:'start'});}if(ui.tab==='analytics'&&!ui.analyticsRequested){ui.analyticsRequested=true;loadAnalytics()}return}const {action,id,value}=d;switch(action){

case 'move-projects':moveIn('projects',id,Number(value));break;
case 'move-certificates':moveIn('certificates',id,Number(value));break;
case 'move-section':moveSection(id,Number(value));break;
case 'move-custom-item':{const [sid,iid]=id.split('|'),section=db.customSections.find(s=>s.id===sid);if(section){const n=section.items.findIndex(x=>x.id===iid),to=n+Number(value);if(to>=0&&to<section.items.length){[section.items[n],section.items[to]]=[section.items[to],section.items[n]];save();render(true)}}break}
case 'new-custom-section':ui.modal='custom-section';ui.modalId=null;render(true);break;
case 'edit-custom-section':ui.modal='custom-section';ui.modalId=id;render(true);break;
case 'delete-custom-section':{if(confirm('Delete this custom section and all its items?')){db.customSections=db.customSections.filter(x=>x.id!==id);db.sectionsOrder=db.sectionsOrder.filter(x=>x!==id);delete db.sections[id];save();render(true)}break}
case 'new-custom-item':ui.modal='custom-item';ui.modalId=id+'|';render(true);break;
case 'edit-custom-item':ui.modal='custom-item';ui.modalId=id;render(true);break;
case 'delete-custom-item':{const [sid,iid]=id.split('|');if(confirm('Remove this item?')){const section=db.customSections.find(x=>x.id===sid);if(section){section.items=section.items.filter(x=>x.id!==iid);save();render(true)}}break}
case 'upload-brand-logo':$('#brand-logo-input')?.click();break;
case 'upload-brand-favicon':$('#brand-favicon-input')?.click();break;
case 'clear-brand-logo':db.brand.logo='';save();render(true);break;
case 'clear-brand-favicon':db.brand.favicon='';save();render(true);break;

case 'move-experience':moveIn('experience',id,Number(value));break;
case 'move-socials':moveIn('socials',id,Number(value));break;
case 'new-view':ui.modal='view';ui.modalId=null;render(true);break;
case 'edit-view':ui.modal='view';ui.modalId=id;render(true);break;
case 'delete-view':if(confirm('Delete this focused link?')){db.views=db.views.filter(x=>x.id!==id);save();render(true)}break;
case 'copy-view':{const v=db.views.find(x=>x.id===id);if(v)copyLink(location.origin+'/focus/'+encodeURIComponent(v.slug));break}
case 'new-social':ui.modal='social';ui.modalId=null;render(true);break;
case 'edit-social':ui.modal='social';ui.modalId=id;render(true);break;
case 'delete-social':db.socials=db.socials.filter(x=>x.id!==id);save();render(true);break;
case 'new-experience':ui.modal='experience';ui.modalId=null;render(true);break;
case 'edit-experience':ui.modal='experience';ui.modalId=id;render(true);break;
case 'delete-experience':db.experience=db.experience.filter(x=>x.id!==id);save();render(true);break;

case 'refresh-analytics':loadAnalytics();break;
case 'analytics-period':{const d=Number(value);if([7,30,90].includes(d)&&ui.analyticsDays!==d){ui.analyticsDays=d;ui.analytics=null;ui.analyticsError='';loadAnalytics()}break}
case 'remove-tag':{const editor=el.closest('.tag-editor');if(editor){el.remove();syncTags(editor)}break}
case 'preview-media':ui.mediaPreviewId=id;render(true);break;
case 'close-media-preview':if(ev.target===el||el.closest('.media-preview-toolbar')){ui.mediaPreviewId=null;render(true)}break;
case 'rename-cv':{
 const item=(db.settings.cvs||[]).find(c=>c.id===id);
 if(id==='legacy'){toast('Upload your existing CV again with a custom title, then remove the legacy entry.');break}
 if(item){const name=prompt('CV button title',item.title);if(name?.trim()){item.title=name.trim().slice(0,100);save();render(true)}}break;
}
case 'remove-cv':{
 if(!confirm('Remove this CV download button? The uploaded file remains in the Media Library.'))break;
 if(id==='legacy')db.settings.cvUrl='';else db.settings.cvs=(db.settings.cvs||[]).filter(c=>c.id!==id);
 save();render(true);break;
}
case 'cv':if(db.settings.cvUrl)window.location.assign('/cv');else toast('Upload a CV PDF in Settings first');break;
case 'email':case 'whatsapp':case 'github':toast('Add the real social/contact link in the dashboard');break;
case 'view-all':ui.filter='All';ui.showAll=!ui.showAll;render(true);break;
case 'gallery':ui.galleryDirection=Number(value)<ui.gallery?'prev':'next';ui.gallery=Number(value);render(true);break;
case 'gallery-next':{ui.galleryDirection='next';const p=getProject(route().id);ui.gallery=(ui.gallery+1)%currentGallery(p).length;render(true);break}
case 'gallery-prev':{ui.galleryDirection='prev';const p=getProject(route().id);ui.gallery=(ui.gallery-1+currentGallery(p).length)%currentGallery(p).length;render(true);break}
case 'cert-prev':moveCertificateCarousel(-1);break;
case 'cert-next':moveCertificateCarousel(1);break;
case 'view-certificate':openCertificateViewer(id);break;
case 'open-lightbox':if(ev.target.closest('video[controls]'))break;ui.lightbox=true;ui.zoom=1;render(true);break;
case 'close-lightbox':ui.lightbox=false;render(true);break;
case 'lightbox-backdrop':if(ev.target===el){ui.lightbox=false;render(true)}break;
case 'zoom-in':ui.zoom=Math.min(4,Math.round((ui.zoom+.25)*100)/100);render(true);break;
case 'zoom-out':ui.zoom=Math.max(.5,Math.round((ui.zoom-.25)*100)/100);render(true);break;
case 'zoom-reset':ui.zoom=1;render(true);break;
case 'lightbox-next':{const p=getProject(route().id);ui.gallery=(ui.gallery+1)%currentGallery(p).length;ui.zoom=1;ui.galleryDirection='next';render(true);break}
case 'lightbox-prev':{const p=getProject(route().id);ui.gallery=(ui.gallery-1+currentGallery(p).length)%currentGallery(p).length;ui.zoom=1;ui.galleryDirection='prev';render(true);break}
case 'new-project':ui.modal='project';ui.modalId=null;ui.pendingProjectCoverId=null;render(true);break;
case 'edit-project':ui.modal='project';ui.modalId=id;ui.pendingProjectCoverId=null;render(true);break;
 case 'preview-project':if(ui.authenticated&&getProject(id)){if(ui.modal==='project'&&!confirm('Preview the saved version? Unsaved edits will be discarded.'))break;ui.previewProjectId=id;ui.modal=null;ui.modalId=null;ui.pendingProjectCoverId=null;ui.lightbox=false;ui.gallery=0;ui.zoom=1;render();}break;
 case 'close-project-preview':ui.previewProjectId=null;ui.lightbox=false;ui.gallery=0;render();break;
case 'delete-project':ui.modal='delete-project';ui.modalId=id;render(true);break;
case 'confirm-delete-project':db.projects=db.projects.filter(p=>p.id!==ui.modalId);ui.modal=null;save();render(true);toast('Project deleted');break;
case 'toggle-project':{let p=getProject(id);if(p){p.published=!p.published;save();render(true)}break}
case 'media-page':mediaLibraryPage=Number(value);refreshMediaLibrary();break;
case 'rename-media':void renameMedia(id);break;
case 'reedit-media':void reeditMedia(id);break;
case 'edit-media-alt':ui.modal='media-alt';ui.modalId=id;render(true);break;
case 'clear-cert-image':ui.pendingCertImage='';{const image=$('.cert-image-preview img');if(image){image.removeAttribute('src');image.style.display='none'}}toast('Image cleared — save the certificate to apply');break;
case 'new-cert':ui.pendingCertImage=null;ui.modal='certificate';ui.modalId=null;render(true);break;
case 'edit-cert':ui.pendingCertImage=null;ui.modal='certificate';ui.modalId=id;render(true);break;
case 'delete-cert':db.certificates=db.certificates.filter(c=>c.id!==id);save();render(true);break;
case 'new-offer':ui.modal='offer';ui.modalId=null;render(true);break;
case 'edit-offer':ui.modal='offer';ui.modalId=id;render(true);break;
case 'toggle-offer':{let o=db.offers.find(o=>o.id===id);if(o){o.active=!o.active;save();render(true)}break}
case 'delete-offer':if(confirm('Delete this offer?')){db.offers=db.offers.filter(o=>o.id!==id);save();render(true)}break;
case 'new-skill-group':ui.modal='skill-group';ui.modalId=null;render(true);break;
case 'edit-skill-group':ui.modal='skill-group';ui.modalId=id;render(true);break;
case 'delete-skill-group':db.hardSkills=db.hardSkills.filter(g=>g.id!==id);save();render(true);break;
case 'new-soft-skill':ui.modal='soft-skill';ui.modalId=null;render(true);break;
case 'edit-soft-skill':ui.modal='soft-skill';ui.modalId=id;render(true);break;
case 'delete-soft-skill':db.softSkills=db.softSkills.filter(s=>s.id!==id);save();render(true);break;
case 'upload':$('#media-input')?.click();break;
case 'move-project-media':{
 const row=el.closest('.project-media-row'),list=row.parentElement;
 const up=d.direction==='up',neighbor=up?row.previousElementSibling:row.nextElementSibling;
 if(!neighbor?.querySelector('input').checked)break;
 if(up)neighbor.before(row);else neighbor.after(row);
 refreshProjectMediaButtons(list);
 if(el.disabled)row.querySelector(`[data-direction="${up?'down':'up'}"]`).focus();else el.focus();
 break;
}
case 'portrait-upload':$('#portrait-input')?.click();break;
case 'portrait-remove':db.hero.portrait='';save();render(true);break;
case 'delete-media':{const m=db.media.find(x=>x.id===id);if(!m || ui.mediaDeleteBusy)break;
 ui.mediaDeleteBusy=true;
 (async()=>{
  try{
   // Ensure recently removed references have reached D1 before the server checks.
   await lastSave;
   const info=await api('/api/admin/files/'+encodeURIComponent(id)+'/references');
   if(info.used){ui.mediaDeleteWarning={id,references:info.references};render(true);return}
   if(!confirm('Permanently delete '+m.name+'? This cannot be undone.'))return;
   try{await api('/api/admin/files/'+encodeURIComponent(id),{method:'DELETE'})}
   catch(err){if(err.status===409&&err.details?.references){ui.mediaDeleteWarning={id,references:err.details.references};render(true);return}throw err}
   db=await api('/api/admin/state');
   ui.mediaPreviewId=null;render(true);toast('Unused file deleted');
  }catch(err){toast('Deletion failed: '+err.message)}finally{ui.mediaDeleteBusy=false}
 })();break}
case 'close-media-use':ui.mediaDeleteWarning=null;render(true);break;
case 'goto-media-usage':{
 const kind=d.kind,referenceId=d.id,tab=d.tabtarget||'media';ui.mediaDeleteWarning=null;
 ui.tab=tab;ui.modal=null;ui.modalId=null;ui.pendingCertImage=null;
 const modalByKind={project:'project',certificate:'certificate',offer:'offer',experience:'experience',social:'social',view:'view',hardSkill:'skill-group',softSkill:'soft-skill',customSection:'custom-section',customItem:'custom-item'};
 if(modalByKind[kind]){ui.modal=modalByKind[kind];ui.modalId=referenceId}
 render();break;
}
case 'inbox-filter':viewingArchive=value==='archive';render(true);break;
case 'toggle-read':
case 'archive-message':
case 'delete-message':void updateInboxMessage(id,action);break;
case 'toggle-dashboard-menu':el.setAttribute('aria-expanded',String(el.getAttribute('aria-expanded')!=='true'));break;
case 'lock':adminToken='';ui.authenticated=false;ui.previewProjectId=null;ui.lightbox=false;db=defaultData||seed();render();break;
case 'reset':toast('Reset is disabled for the live website.');break;
case 'export-backup':if(ui.authenticated&&adminToken){void import('/backup-export.js').then(({openBackupExport})=>openBackupExport({getToken:()=>ui.authenticated?adminToken:'',flush:()=>lastSave})).catch(e=>toast('Export failed: '+e.message));}break;
case 'close-modal':closeModal();break;
case 'open-offer-terms':openOfferTerms(id);break;
case 'open-demo':{const p=getProject(id),href=projectLinkHref(p?.demo);if(href&&href!=='#')window.open(href,'_blank','noopener,noreferrer');else toast('No demo URL configured');break}
case 'store-scroll':$('#store-products')?.scrollIntoView({behavior:'smooth'});break;
case 'store-filter':ui.storeFilter=value;render(true);$('#store-products')?.scrollIntoView();break;
case 'cart-add':ui.storeCart++;$('#cart-number').textContent=ui.storeCart;toast('Added to demo bag');break;
}});
document.addEventListener('keydown',ev=>{
 const entry=ev.target.closest('.tag-entry');if(entry){const editor=entry.closest('.tag-editor');
  if(ev.key==='Enter'||(ev.key===','&&editor.dataset.delimiter==='comma')){ev.preventDefault();addTags(editor,entry.value);return}
  if(ev.key==='Backspace'&&!entry.value){const last=editor.querySelector('.tag-chip:last-child');if(last){last.remove();syncTags(editor)}}
 }
 if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('.media-visual[data-action="preview-media"]')){ev.preventDefault();ui.mediaPreviewId=ev.target.dataset.id;render(true)}
 if(ev.key==='Escape'&&ui.mediaPreviewId){ui.mediaPreviewId=null;render(true)}
});
document.addEventListener('paste',ev=>{const input=ev.target.closest('.tag-entry');if(!input)return;const text=ev.clipboardData?.getData('text')||'';if(/[\n,]/.test(text)&&input.closest('.tag-editor').dataset.delimiter==='comma'||/\n/.test(text)){ev.preventDefault();addTags(input.closest('.tag-editor'),text)}});
document.addEventListener('focusout',ev=>{const input=ev.target.closest('.tag-entry');if(input?.value)addTags(input.closest('.tag-editor'),input.value)});
document.addEventListener('input',ev=>{if(ev.target.id==='contact-address')syncContactMethod(ev.target.form);if(ev.target.id==='project-filter'){ui.search=ev.target.value;$('#projects-table').innerHTML=tableProjects(db.projects.filter(x=>(x.title+' '+(x.tracks||[]).join(' ')).toLowerCase().includes(ui.search.toLowerCase())))}});
document.addEventListener('input',ev=>{
 const input=ev.target;
 if(!['project-media-search','project-cover-search','media-library-search'].includes(input.id))return;
 const query=String(input.value||'').normalize('NFKC').trim().toLocaleLowerCase();
 if(input.id==='project-media-search'){
  const rows=[...document.querySelectorAll('#project-form .media-checklist .project-media-row')];
  let visible=0;
  for(const row of rows){
   const text=row.querySelector('.inline-checkbox')?.textContent||'';
   const match=text.normalize('NFKC').toLocaleLowerCase().includes(query);
   row.style.display=match?'':'none';
   if(match)visible++;
  }
  const empty=$('#project-media-empty');if(empty)empty.hidden=visible!==0;
  return;
 }
 if(input.id==='project-cover-search'){
  const select=$('#project-cover-select');if(!select)return;
  const chosen=select.value;
  const matches=mediaNewestFirst().filter(m=>m.type?.startsWith('image/')&&(String(m.name||'').normalize('NFKC').toLocaleLowerCase().includes(query)||m.id===chosen));
  select.replaceChildren(new Option('No cover',''),...matches.map(m=>new Option(m.name,m.id)));
  select.value=chosen; // Never clear the selected cover just because of a search.
  return;
 }
 mediaLibraryQuery=input.value;mediaLibraryPage=1;refreshMediaLibrary();
});
document.addEventListener('dragover',ev=>{
 const zone=$('#media-drop-zone');
 if(!zone||!ev.dataTransfer?.types.includes('Files'))return;
 ev.preventDefault();
 const overZone=zone.contains(ev.target);
 ev.dataTransfer.dropEffect=overZone?'copy':'none';
 zone.classList.toggle('dragging',overZone);
});
document.addEventListener('dragleave',ev=>{
 const zone=$('#media-drop-zone');
 if(zone?.contains(ev.target)&&!zone.contains(ev.relatedTarget))zone.classList.remove('dragging');
});
document.addEventListener('drop',ev=>{
 const zone=$('#media-drop-zone'),files=Array.from(ev.dataTransfer?.files||[]);
 if(!zone||!ev.dataTransfer?.types.includes('Files'))return;
 ev.preventDefault();
 zone.classList.remove('dragging');
 if(zone.contains(ev.target))void uploadToMediaLibrary(files);
});
document.addEventListener('change',async ev=>{const x=ev.target;
 if(x.matches('#project-form input[name="mediaIds"]')){
  const row=x.closest('.project-media-row'),list=row.parentElement;
  const firstUnchecked=[...list.children].find(item=>item!==row&&!item.querySelector('input').checked);
  if(x.checked&&firstUnchecked)firstUnchecked.before(row);else list.append(row);
  row.querySelector('.project-media-order').hidden=!x.checked;
  refreshProjectMediaButtons(list);
  x.focus();
  return;
 }
 if(x.id==='media-input'){
  const files=Array.from(x.files);
  x.value='';
  await uploadToMediaLibrary(files);
  return;
 }
 if(x.id==='custom-media-select'&&x.value){const f=$('#custom-item-form [name=image]');if(f)f.value=x.value}if(x.matches('[data-section]')){db.sections[x.dataset.section]=x.checked;save();render(true)}if(x.id==='project-cover-select'){
 ui.pendingProjectCoverId=x.value;
 const item=db.media.find(m=>m.id===x.value&&m.type?.startsWith('image/'));
 const preview=$('#project-cover-preview');if(preview)preview.innerHTML=item?`<img src="${esc(item.src)}" alt="Cover preview">`:'<div class="cover-empty">No cover selected</div>';
 }
 if(x.id==='project-cover-upload'&&x.files[0]){
  const file=x.files[0];
  if(!['image/png','image/jpeg','image/webp','image/avif','image/gif'].includes(file.type)){toast('Choose PNG, JPEG, WebP, AVIF or GIF');return}
  try{
   x.disabled=true;
   const res=await uploadMedia(file);
   db.media.unshift(res);ui.pendingProjectCoverId=res.id;
   const select=$('#project-cover-select');if(select){select.add(new Option(res.name,res.id));select.value=res.id}
   const preview=$('#project-cover-preview');if(preview)preview.innerHTML=`<img src="${esc(res.src)}" alt="Uploaded cover">`;
   const list=$('.media-checklist');
   if(list){
    const firstAvailable=[...list.children].find(row=>!row.querySelector('input[name="mediaIds"]')?.checked);
    if(firstAvailable)firstAvailable.insertAdjacentHTML('beforebegin',projectMediaRow(res.id,res.name,false));
    else list.insertAdjacentHTML('beforeend',projectMediaRow(res.id,res.name,false));
    $('#project-media-search')?.dispatchEvent(new Event('input',{bubbles:true}));
   }
   toast('Cover uploaded — save the project to attach it');
  }catch(err){toast('Cover upload failed: '+err.message)}finally{x.disabled=false}
 }
 if(x.id==='cert-image-upload'&&x.files[0]){try{const res=await uploadMedia(x.files[0]);ui.pendingCertImage=res.src;db.media.unshift(res);save();const im=$('.cert-image-preview img');if(im)im.src=res.src;toast('Certificate image uploaded — save the form')}catch(err){toast('Upload failed: '+err.message)}}if(x.id==='spanish-toggle'){db.settings.enableEs=x.checked;if(!x.checked&&ui.lang==='es')ui.lang='en';save();render(true)}if((x.id==='brand-logo-input'||x.id==='brand-favicon-input')&&x.files[0]){try{const file=x.files[0];if(!['image/png','image/jpeg','image/webp'].includes(file.type)){toast('Use PNG, JPEG or WebP');return}const key=x.id==='brand-logo-input'?'logo':'favicon';const res=await uploadMedia(file,{allowedImageTypes:['image/png','image/jpeg','image/webp']});db.brand[key]=res.src;db.media.unshift(res);save();render(true);toast(key==='logo'?'Portfolio logo uploaded':'Favicon uploaded')}catch(err){toast('Upload failed: '+err.message)}}if(x.id==='portrait-input'&&x.files[0]){try{const res=await editAndUploadOne(x.files[0],async file=>{await lastSave;return api('/api/admin/portrait?name='+encodeURIComponent(file.name),{method:'PUT',headers:{'Content-Type':file.type},body:file});});db.hero.portrait=res.src;db.media.unshift(res);render(true);toast('Portrait uploaded')}catch(err){toast('Upload failed: '+err.message)}}
if(x.id==='cv-upload'&&x.files[0]){try{const file=x.files[0];if(file.type!=='application/pdf')throw new Error('Only PDF accepted');const res=await api('/api/admin/cv',{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});db.settings.cvUrl=res.src;db.media.unshift(res);save();render(true);toast('CV uploaded and Download CV is active')}catch(e){toast('CV upload failed: '+e.message)}}});
document.addEventListener('submit',async ev=>{const f=ev.target;if(!['login-form','hero-form','portrait-appearance-form','portfolio-preferences-form','seo-home-form','portrait-alt-form','media-alt-form','project-form','cert-form','offer-form','hard-skill-form','soft-skill-form','contact-form','experience-form','social-form','view-form','custom-section-form','custom-item-form','cv-form'].includes(f.id))return;ev.preventDefault();f.querySelectorAll('.tag-editor').forEach(ed=>{const pending=ed.querySelector('.tag-entry')?.value;if(pending)addTags(ed,pending)});const fd=new FormData(f),d=Object.fromEntries(fd.entries());switch(f.id){
case 'cv-form':{
 const file=fd.get('pdf'),title=String(d.title||'').trim();
 if(!(file instanceof File)||file.type!=='application/pdf'||!title){toast('Choose a PDF and provide a title');break}
 if((db.settings.cvs||[]).length>=25){toast('Maximum 25 CVs');break}
 const button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;
 try{const m=await uploadMedia(file);db.media.unshift(m);
  db.settings.cvs||=[];db.settings.cvs.push({id:uid(),title:title.slice(0,100),mediaId:m.id,src:m.src});
  save();render(true);toast('CV uploaded — visitors can now download it');
 }catch(e){toast('Upload failed: '+e.message);if(button)button.disabled=false}break;
}
case 'login-form':try{
 const candidate=String(d.token||'');
 adminToken=candidate;
 await api('/api/admin/verify',{method:'POST'});
 db=await api('/api/admin/state');
 ui.authenticated=true;ui.tab='overview';ui.filter=db.settings.defaultTrack||'All';
 render();toast('Dashboard unlocked');
 }catch(e){adminToken='';ui.authenticated=false;toast('Access denied: '+e.message)}break;
case 'portfolio-preferences-form':db.settings.focus=(d.focus||'Software Engineer').trim();db.settings.defaultTrack=d.defaultTrack||'All';db.settings.homeProjectCount=homeProjectCount(d.homeProjectCount);ui.filter=db.settings.defaultTrack;save();render(true);toast('Portfolio preferences saved');break;
case 'portrait-alt-form':for(const k of ['portraitAlt','portraitAltAr','portraitAltEs'])db.hero[k]=(d[k]||'').trim().slice(0,240);save();render(true);toast('Portrait ALT saved');break;
case 'media-alt-form':{const m=db.media.find(x=>x.id===d.mediaId);if(m){for(const k of ['alt','altAr','altEs'])m[k]=(d[k]||'').trim().slice(0,240);save()}ui.modal=null;ui.modalId=null;render(true);toast('Image ALT saved');break}
case 'seo-home-form':for(const k of ['seoTitle','seoTitleAr','seoTitleEs','seoDescription','seoDescriptionAr','seoDescriptionEs'])db.settings[k]=(d[k]||'').trim();save();render(true);toast('Homepage SEO updated');break;
case 'portrait-appearance-form':db.hero.portraitBgMode=d.portraitBgMode==='solid'?'solid':'gradient';db.hero.portraitBg1=d.portraitBg1;db.hero.portraitBg2=d.portraitBg2;db.hero.portraitBgAngle=Math.max(0,Math.min(360,Number(d.portraitBgAngle)||145));db.hero.portraitBadge=fd.has('portraitBadge');for(const k of ['portraitBadgeText','portraitBadgeTextAr','portraitBadgeTextEs'])db.hero[k]=d[k]||'';save();render(true);toast('Portrait updated');break;
case 'hero-form':for(const k of ['status','statusAr','statusEs','line1','line1Ar','line1Es','line2','line2Ar','line2Es','intro','introAr','introEs','about','aboutAr','aboutEs'])db.hero[k]=d[k]||'';save();render(true);toast('Homepage updated');break;
case 'custom-section-form':{const old=db.customSections.find(x=>x.id===ui.modalId);const obj={layout:d.layout,...Object.fromEntries(['title','titleAr','titleEs','eyebrow','eyebrowAr','eyebrowEs','description','descriptionAr','descriptionEs'].map(k=>[k,d[k]||'']))};if(old)Object.assign(old,obj);else{const id='custom-'+uid();db.customSections.push({id,items:[],...obj});db.sections[id]=true;db.sectionsOrder.splice(Math.max(0,db.sectionsOrder.indexOf('contact')),0,id)}ui.modal=null;ui.modalId=null;save();render(true);toast('Section saved');break}
case 'custom-item-form':{const section=db.customSections.find(x=>x.id===d.sectionId);if(!section)break;const obj=Object.fromEntries(['title','titleAr','titleEs','description','descriptionAr','descriptionEs','icon','value','meta','image','link','alt','altAr','altEs'].map(k=>[k,d[k]||'']));const old=section.items.find(x=>x.id===d.itemId);if(old)Object.assign(old,obj);else section.items.push({id:uid(),...obj});ui.modal=null;ui.modalId=null;save();render(true);toast('Content item saved');break}
case 'project-form':{
 let old=getProject(ui.modalId),id=old?.id||slugify(d.title);if(!old){let n=2;while(db.projects.some(p=>p.id===id))id=slugify(d.title)+'-'+n++}
 const attrs=['title','titleAr','titleEs','category','categoryAr','categoryEs','summary','summaryAr','summaryEs','overview','overviewAr','overviewEs','problem','problemAr','problemEs','solution','solutionAr','solutionEs','role','roleAr','roleEs','year','status','tone','github','demo','technicalDetails','technicalDetailsAr','technicalDetailsEs','seoTitle','seoTitleAr','seoTitleEs','seoDescription','seoDescriptionAr','seoDescriptionEs'];
 const links=(d.links||'').split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const n=line.indexOf('|');return n>0?{id:uid(),label:line.slice(0,n).trim(),url:line.slice(n+1).trim()}:null}).filter(x=>x&&x.label&&(/^(https?:\/\/|mailto:|tel:)/i.test(x.url)));
 const tracks=[...new Set([...fd.getAll('trackExisting'),...(d.trackNew||'').split(',')].map(x=>String(x).trim()).filter(Boolean))];
 const p={...(old||{}),id,...Object.fromEntries(attrs.map(k=>[k,d[k]||''])),tracks,stack:(d.stack||'').split(',').map(x=>x.trim()).filter(Boolean),features:(d.features||'').split('\n').map(x=>x.trim()).filter(Boolean),featuresAr:(d.featuresAr||'').split('\n').map(x=>x.trim()).filter(Boolean),featuresEs:(d.featuresEs||'').split('\n').map(x=>x.trim()).filter(Boolean),links,coverMediaId:d.coverMediaId||'',mediaIds:fd.getAll('mediaIds'),gallery:old?.gallery||[],featured:fd.has('featured'),published:fd.has('published')};
 if(old)Object.assign(old,p);else db.projects.unshift(p);
 ui.modal=null;ui.modalId=null;ui.pendingProjectCoverId=null;save();render(true);toast('Project saved');break;
}
case 'cert-form':{
 const linkedinPostUrl=(d.linkedinPostUrl||'').trim();
 if(linkedinPostUrl&&!certificatePostUrl(linkedinPostUrl)){toast('Use a valid LinkedIn post URL (linkedin.com/posts/… or lnkd.in/…)');break}
 let o=db.certificates.find(x=>x.id===ui.modalId);
 const fields={title:d.title,titleAr:d.titleAr||'',titleEs:d.titleEs||'',issuer:d.issuer,year:d.year,alt:d.alt||'',altAr:d.altAr||'',altEs:d.altEs||'',linkedinPostUrl,...(ui.pendingCertImage!==null?{image:ui.pendingCertImage}:{})};
 if(o)Object.assign(o,fields);else db.certificates.push({...fields,id:uid()});
 ui.pendingCertImage=null;ui.modal=null;save();render(true);toast('Certificate saved');break;
}
case 'offer-form':{let o=db.offers.find(x=>x.id===ui.modalId);const obj={...d,active:fd.has('active')};if(o)Object.assign(o,obj);else db.offers.push({...obj,id:uid()});ui.modal=null;save();render(true);toast('Offer saved');break}
case 'hard-skill-form':{let g=db.hardSkills.find(x=>x.id===ui.modalId),obj={name:d.name,nameAr:d.nameAr,nameEs:d.nameEs||'',items:(d.items||'').split('\n').map(x=>x.trim()).filter(Boolean)};if(g)Object.assign(g,obj);else db.hardSkills.push({...obj,id:uid()});ui.modal=null;save();render(true);toast('Skills updated');break}
case 'soft-skill-form':{let s=db.softSkills.find(x=>x.id===ui.modalId),obj={name:d.name,nameAr:d.nameAr,nameEs:d.nameEs||''};if(s)Object.assign(s,obj);else db.softSkills.push({...obj,id:uid()});ui.modal=null;save();render(true);break}

case 'social-form':{const url=(d.url||'').trim();if(!/^https?:\/\/|^mailto:|^tel:/i.test(url)){toast('Enter a valid https://, mailto: or tel: link');break}const s=db.socials.find(x=>x.id===ui.modalId);if(s)Object.assign(s,{label:d.label,url});else db.socials.push({id:uid(),label:d.label,url});ui.modal=null;save();render(true);toast('Social link saved');break}
case 'experience-form':{const fields=['title','titleAr','titleEs','subtitle','subtitleAr','subtitleEs','period','description','descriptionAr','descriptionEs'],obj=Object.fromEntries(fields.map(k=>[k,d[k]||'']));const x=db.experience.find(x=>x.id===ui.modalId);if(x)Object.assign(x,obj);else db.experience.push({...obj,id:uid()});ui.modal=null;save();render(true);toast('Experience updated');break}
case 'view-form':{const slug=slugify(d.slug||d.name);const duplicate=db.views.find(x=>x.slug===slug&&x.id!==ui.modalId);if(duplicate){toast('This URL slug already exists');break}const obj={name:d.name,slug,tracks:fd.getAll('tracks'),projectIds:fd.getAll('projectIds'),active:fd.has('active')};const v=db.views.find(x=>x.id===ui.modalId);if(v)Object.assign(v,obj);else db.views.push({...obj,id:uid()});ui.modal=null;save();render(true);toast('Share link saved');break}

case 'contact-form':try{
 const phone=syncContactMethod(f);
 if(!f.reportValidity())break;
 const address=(d.contactAddress||'').trim();
 await api('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:d.name,email:phone?undefined:address,phone:phone?address:undefined,country:phone?f.elements.country.value:undefined,contactMethod:phone?f.elements.contactMethod.value:'email',message:d.message,website:d.website||''})});
 f.reset();syncContactMethod(f);toast('Message sent successfully');
 }catch(e){toast('Message not sent: '+e.message)}break;
}});
// Horizontal drag/swipe on the project stage or full-screen viewer. Vertical scroll remains native.
function projectSwipeStep(start,end){
 const dx=end.x-start.x,dy=end.y-start.y;
 return Math.abs(dx)>=55&&Math.abs(dx)>Math.abs(dy)*1.35?(dx<0?1:-1):0;
}
let projectGesture=null,suppressProjectGestureClickUntil=0;
function startProjectGesture(target,x,y,kind){
 if(route().name!=='project'||ui.modal||!target?.closest)return;
 if(target.closest('button,a,video,input,textarea,select,[contenteditable="true"]'))return;
 const surface=target.closest('.showcase-motion,.lightbox-canvas');
 if(!surface||!surface.closest('#app'))return;
 const inViewer=surface.classList.contains('lightbox-canvas');
 if(inViewer!==Boolean(ui.lightbox)||(inViewer&&ui.zoom!==1))return;
 projectGesture={x,y,kind,inViewer};
}
function finishProjectGesture(x,y,kind){
 const start=projectGesture;projectGesture=null;
 if(!start||start.kind!==kind||route().name!=='project')return false;
 const delta=projectSwipeStep(start,{x,y});
 if(!delta)return false;
 const p=getProject(route().id),count=p?currentGallery(p).length:0;
 if(count<2)return false;
 ui.gallery=(ui.gallery+delta+count)%count;
 ui.galleryDirection=delta>0?'next':'prev';
 if(start.inViewer)ui.zoom=1;
 suppressProjectGestureClickUntil=Date.now()+450;
 render(true);
 return true;
}
document.addEventListener('touchstart',ev=>{
 if(ev.touches.length!==1){projectGesture=null;return;}
 const touch=ev.touches[0];startProjectGesture(ev.target,touch.clientX,touch.clientY,'touch');
},{passive:true});
document.addEventListener('touchend',ev=>{
 if(projectGesture?.kind!=='touch')return;
 const touch=ev.changedTouches[0];
 if(touch&&finishProjectGesture(touch.clientX,touch.clientY,'touch'))ev.preventDefault();
},{passive:false});
document.addEventListener('touchcancel',()=>{projectGesture=null;});
document.addEventListener('mousedown',ev=>{
 if(ev.button===0)startProjectGesture(ev.target,ev.clientX,ev.clientY,'mouse');
});
document.addEventListener('mouseup',ev=>{
 if(ev.button===0)finishProjectGesture(ev.clientX,ev.clientY,'mouse');
});
document.addEventListener('dragstart',ev=>{
 if(projectGesture?.kind==='mouse'&&ev.target?.closest?.('.showcase-motion,.lightbox-canvas'))ev.preventDefault();
});
// Prevent a completed drag from also activating the click-to-zoom action.
document.addEventListener('click',ev=>{
 if(Date.now()<suppressProjectGestureClickUntil&&ev.target?.closest?.('.showcase-motion,.lightbox-canvas')){
  suppressProjectGestureClickUntil=0;
  ev.preventDefault();ev.stopImmediatePropagation();
 }
},true);
window.addEventListener('hashchange',()=>{ui.gallery=0;ui.lightbox=false;render()});
window.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&document.activeElement?.dataset?.action==='open-lightbox'){e.preventDefault();ui.lightbox=true;ui.zoom=1;render(true);return}if(e.key==='Escape'&&ui.lightbox){ui.lightbox=false;render(true);return}if(e.key==='Escape'&&ui.modal)closeModal();if(route().name==='project'&&!ui.modal){if(e.key==='ArrowRight'){const p=getProject(route().id);if(currentGallery(p).length){ui.gallery=(ui.gallery+1)%currentGallery(p).length;render(true)}}if(e.key==='ArrowLeft'){const p=getProject(route().id);if(currentGallery(p).length){ui.gallery=(ui.gallery-1+currentGallery(p).length)%currentGallery(p).length;render(true)}}}});
render();
})();

