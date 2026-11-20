// Find media references in the authoritative CMS snapshot, not browser state.
// The media registry is intentionally excluded: a file listing itself is not a use.
// A single media item may have multiple uses (cover, gallery, CV, settings, etc.).
const MEDIA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matchesAsset(value, key, mediaId) {
  if (typeof value !== 'string') return false;
  // Explicit IDs, including coverMediaId, mediaIds[] and CV mediaId.
  if ((key === 'mediaId' || key === 'mediaIds' || key === 'coverMediaId' || /media(?:_)?id$/i.test(key)) && value === mediaId) return true;
  // Store asset URLs may be relative or absolute, with optional query/hash suffix.
  // The ID must be the entire final path component, not a substring.
  const needle = '/media/' + mediaId;
  const start = value.indexOf(needle);
  if (start < 0) return false;
  const after = value.charAt(start + needle.length);
  return !after || after === '?' || after === '#';
}

const FIELD_NAMES = {
  coverMediaId: 'Project cover', mediaIds: 'Project gallery', gallery: 'Project gallery',
  image: 'Image', imageUrl: 'Image', src: 'Media', portrait: 'Profile portrait',
  logo: 'Portfolio logo', favicon: 'Browser tab icon', cvUrl: 'Legacy CV', cvs: 'Downloadable CV',
  mediaId: 'Downloadable CV', background: 'Background image', poster: 'Video poster'
};

function fieldLabel(path) {
  const keys = path.filter(x => typeof x === 'string');
  for (let i = keys.length - 1; i >= 0; i--) if (FIELD_NAMES[keys[i]]) return FIELD_NAMES[keys[i]];
  return keys.at(-1) || 'Media reference';
}

function walk(value, mediaId, visit, path=[], key='') {
  if (typeof value === 'string') {
    if (matchesAsset(value, key, mediaId)) visit(path, fieldLabel(path));
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, mediaId, visit, [...path, i], key)); return; }
  for (const [k,v] of Object.entries(value)) walk(v, mediaId, visit, [...path,k], k);
}

export function findMediaReferences(state, mediaId) {
  if (!MEDIA_UUID.test(mediaId || '')) return [];
  const references = [];
  const seen = new Set();
  const emit = (kind, id, title, tab, usage, extra={}) => {
    const ref={kind,id,title,tab,usage,...extra};
    const token=kind+'|'+id+'|'+usage;
    if (!seen.has(token)) { seen.add(token); references.push(ref); }
  };
  const collections = [
    ['projects','project','projects'], ['certificates','certificate','certificates'],
    ['offers','offer','offers'], ['experience','experience','experience'],
    ['socials','social','socials'], ['views','view','views'],
    ['hardSkills','hardSkill','skills'], ['softSkills','softSkill','skills']
  ];
  for (const [collection,kind,tab] of collections) {
    for (const item of state[collection] || []) {
      const id=String(item.id || '');
      const title=String(item.title || item.name || item.label || id || collection);
      walk(item, mediaId, (path, usage) => emit(kind,id,title,tab,usage), []);
    }
  }
  for (const section of state.customSections || []) {
    const sectionTitle = String(section.title || section.id || 'Custom section');
    // A section can own images at top level or inside any individual item.
    const { items, ...top } = section;
    walk(top, mediaId, (path,usage) => emit('customSection',section.id,sectionTitle,'sections',usage), []);
    for(const item of items||[]) {
      walk(item, mediaId, (path,usage) => emit('customItem',section.id+'|'+item.id,
        sectionTitle+' — '+String(item.title || item.id || 'Item'), 'sections',usage), []);
    }
  }
  for (const [name, tab, title] of [
    ['hero','content','Homepage'], ['brand','settings','Brand and favicon'],
    ['settings','settings','Site settings'], ['sections','sections','Section preferences'],
    ['sectionsOrder','sections','Section order']
  ]) {
    if (state[name] !== undefined) {
      // Include each CV title when identifying its dependency.
      if(name==='settings' && Array.isArray(state.settings?.cvs)) {
        for(const cv of state.settings.cvs) walk(cv,mediaId,(path,usage)=>emit('settings','settings',
          'CV: '+String(cv.title||cv.id||'Downloadable CV'),'settings',usage),[]);
      }
      const data=name==='settings'?{...state.settings,cvs:[]}:state[name];
      walk(data,mediaId,(path,usage)=>emit(name,name,title,tab,usage),[]);
    }
  }
  return references;
}
