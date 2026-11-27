// Field-scoped optimistic concurrency for the Match-3 wizard.
export const MATCH_FIELDS={info:['title','description','starts_at','ends_at'],rules:['match_seconds'],publish:['active']};
const same=(a,b)=>a===b;
export function matchPatch(current,scope,base,changes){
 const keys=MATCH_FIELDS[scope];
 if(!keys||!base||!changes||typeof base!=='object'||typeof changes!=='object'||Array.isArray(base)||Array.isArray(changes))return {error:'INVALID_SETTINGS'};
 if(Object.keys(changes).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(base,k)||!Object.hasOwn(changes,k)))return {error:'INVALID_SETTINGS'};
 const dirty=keys.filter(k=>!same(base[k],changes[k]));
 if(dirty.some(k=>!same(current[k],base[k])&&!same(current[k],changes[k])))return {error:'STALE_CONFIG'};
 return {values:{...current,...Object.fromEntries(dirty.map(k=>[k,changes[k]]))},changed:dirty.some(k=>!same(current[k],changes[k]))};
}
export function matchEdit(scope,base,draft){
 const keys=MATCH_FIELDS[scope];return {action:'match_patch',scope,base:Object.fromEntries(keys.map(k=>[k,base[k]])),changes:Object.fromEntries(keys.map(k=>[k,draft[k]]))};
}
export function rebaseMatchDraft(previous,draft,next){
 const keys=[...MATCH_FIELDS.info,...MATCH_FIELDS.rules];
 return {...next,...Object.fromEntries(keys.filter(k=>!same(previous[k],draft[k])).map(k=>[k,draft[k]]))};
}
