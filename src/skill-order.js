// The catch-all engineering group stays after every specialist category.
export function isOtherEngineering(group){
  return group?.id==='hard-other'||String(group?.name||'').trim().toLowerCase()==='other engineering';
}
export function orderHardSkills(groups){
  return [...groups.filter(g=>!isOtherEngineering(g)),...groups.filter(isOtherEngineering)];
}
