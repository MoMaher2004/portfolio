import { readMessages } from './contact.js';
import { defaults } from './defaults.js';

export const arrays = ['projects','experience','socials','views','hardSkills','softSkills','certificates','offers','customSections','media'];
export const configs = ['hero','settings','brand','sections','sectionsOrder'];
export const collections = new Set([...arrays, ...configs]);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);

export async function readSite(env, { admin=false }={}) {
  const state = structuredClone(defaults);
  const [items, conf] = await Promise.all([
    env.DB.prepare('SELECT collection,id,content FROM content_items ORDER BY collection,position').all(),
    env.DB.prepare('SELECT name,content FROM configuration').all()
  ]);
  for(const k of arrays) state[k]=[];
  for(const r of items.results||[]) {
    if(arrays.includes(r.collection)) { try { state[r.collection].push(JSON.parse(r.content)) } catch {} }
  }
  for(const r of conf.results||[]) {
    if(configs.includes(r.name)) { try { state[r.name]=JSON.parse(r.content) } catch {} }
  }
  state.messages = admin ? await readMessages(env.DB) : [];
  if(!admin){
    state.projects=state.projects.filter(p=>p.published);
    state.offers=state.offers.filter(o=>o.active);
    state.views=state.views.filter(v=>v.active);
    state.customSections=state.customSections.filter(x=>state.sections[x.id] && x.items?.length);
    state.media=state.media.filter(m=>state.projects.some(p=>p.coverMediaId===m.id || (p.mediaIds||[]).includes(m.id)) || (state.hero.portrait||'').includes(m.id) || (state.brand.logo||'').includes(m.id) || (state.brand.favicon||'').includes(m.id) || (state.settings.cvs||[]).some(c=>c.mediaId===m.id));
  }
  return state;
}

// Optional SEO fields live in JSON columns, so no D1 migration is required.
function validateSeo(obj){
  if(!obj||typeof obj!=='object')return;
  for(const key of ['seoTitle','seoTitleAr','seoTitleEs','seoDescription','seoDescriptionAr','seoDescriptionEs']){
    if(obj[key]!==undefined&&(typeof obj[key]!=='string'||obj[key].length>(key.startsWith('seoTitle')?160:450)))throw new Error('Invalid SEO text: '+key);
  }
}

export function validateState(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('State must be an object');
  for(const key of arrays) if(!Array.isArray(input[key])||input[key].length>500) throw new Error('Invalid collection: '+key);
  for(const key of configs)if(!own(input,key)||input[key]===null||typeof input[key]!=='object')throw new Error('Invalid config: '+key);
  validateSeo(input.settings);
  const ids = new Set();
  for(const p of input.projects){
    if(!p||typeof p!=='object'||!/^[-a-z0-9]{1,90}$/.test(p.id||''))throw new Error('Project ID must be an ASCII slug');
    if(!String(p.title||'').trim()||String(p.title).length>240)throw new Error('Project title is required (max 240)');
    if(!Array.isArray(p.tracks)||p.tracks.length>20)throw new Error('Invalid tracks');
    validateSeo(p);
    if(ids.has(p.id))throw new Error('Duplicate project ID');ids.add(p.id);
  }
  for(const name of arrays){
    const seen=new Set();
    for(const item of input[name]) {
      if(!item||typeof item!=='object'||typeof item.id!=='string'||!/^[-a-zA-Z0-9_]{1,120}$/.test(item.id))throw new Error('Invalid '+name+' item id');
      if(seen.has(item.id)) throw new Error('Duplicate '+name+' item id'); seen.add(item.id);
    }
  }
  if(input.settings.cvs!==undefined){
    if(!Array.isArray(input.settings.cvs)||input.settings.cvs.length>25)throw new Error('Invalid CV list');
    const seenCV=new Set();
    for(const c of input.settings.cvs){
      if(!c||!/^[-_a-zA-Z0-9]{1,120}$/.test(c.id||'')||!/^[0-9a-f-]{36}$/i.test(c.mediaId||'')||typeof c.title!=='string'||!c.title.trim()||c.title.length>100||seenCV.has(c.id))throw new Error('Invalid CV entry');
      seenCV.add(c.id);
    }
  }
  const raw=JSON.stringify(input);
  if(raw.length>900_000 || /data:(?:image|video|application)\//i.test(raw))throw new Error('Use R2 file uploads, not embedded base64 or oversized state');
  return input;
}

export async function putState(env,input){
  validateState(input);
  const statements=[];
  for(const key of arrays) {
    const ids=[];
    for(let i=0;i<input[key].length;i++){
      const item=input[key][i];ids.push(item.id);
      statements.push(env.DB.prepare(`INSERT INTO content_items(collection,id,position,content,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(collection,id) DO UPDATE SET position=excluded.position,content=excluded.content,updated_at=CASE WHEN content_items.content<>excluded.content OR content_items.position<>excluded.position THEN CURRENT_TIMESTAMP ELSE content_items.updated_at END`).bind(key,item.id,i,JSON.stringify(item)));
    }
    // Use id list from validated object values; no untrusted SQL text ever interpolated.
    if(ids.length){
      statements.push(env.DB.prepare(`DELETE FROM content_items WHERE collection=? AND id NOT IN (${ids.map(()=>'?').join(',')})`).bind(key,...ids));
    } else statements.push(env.DB.prepare('DELETE FROM content_items WHERE collection=?').bind(key));
  }
  for(const key of configs) statements.push(env.DB.prepare('INSERT INTO configuration(name,content,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(name) DO UPDATE SET content=excluded.content,updated_at=CASE WHEN configuration.content<>excluded.content THEN CURRENT_TIMESTAMP ELSE configuration.updated_at END').bind(key,JSON.stringify(input[key])));
  // Batched statements execute together as a D1 transaction.
  if(statements.length>220)throw new Error('Too many items in a single snapshot; use collection API');
  await env.DB.batch(statements);
  if(Array.isArray(input.messages)) {
    for(const m of input.messages.slice(0,250)) {
      if(m&&typeof m.id==='string')await env.DB.prepare('UPDATE messages SET is_read=? WHERE id=?').bind(m.read?1:0,m.id).run();
    }
  }
}

export async function seedOnce(env){
  const result=await env.DB.prepare('SELECT count(*) AS count FROM configuration').first();
  if(Number(result?.count)>0)return false;
  await putState(env,defaults);
  return true;
}

export async function listCollection(env,name){
  if(!arrays.includes(name))throw new Error('Unsupported collection');
  const rows=await env.DB.prepare('SELECT content FROM content_items WHERE collection=? ORDER BY position').bind(name).all();
  return (rows.results||[]).map(r=>JSON.parse(r.content));
}

export async function replaceCollection(env,name,items){
  if(!arrays.includes(name)||!Array.isArray(items))throw new Error('Unsupported collection');
  const state=await readSite(env,{admin:true});state[name]=items;await putState(env,state);
}

export async function getItem(env,name,id) {
  if(!arrays.includes(name))throw new Error('Unsupported collection');
  const row=await env.DB.prepare('SELECT content FROM content_items WHERE collection=? AND id=?').bind(name,id).first();
  return row ? JSON.parse(row.content) : null;
}
export async function upsertItem(env,name,item){
  if(!arrays.includes(name)||!item?.id||!/^[-a-zA-Z0-9_]{1,120}$/.test(item.id))throw new Error('Invalid item');
  const state=await readSite(env,{admin:true});const target=state[name],idx=target.findIndex(x=>x.id===item.id);
  if(idx===-1)target.push(item);else target[idx]=item;
  await putState(env,state);return item;
}
export async function deleteItem(env,name,id){
  if(!arrays.includes(name))throw new Error('Unsupported collection');
  const state=await readSite(env,{admin:true});state[name]=state[name].filter(x=>x.id!==id);await putState(env,state);
}
