// Store percentages as integer basis points (10000 = 100%).
export const ODDS_TOTAL=10000;
export const available=p=>p.unlimited||Number(p.effective_quantity)>0;
export const totalOdds=values=>Object.values(values).reduce((sum,n)=>sum+n,0);
export function initialOdds(data){
 let remaining=ODDS_TOTAL;
 return Object.fromEntries(data.prizes.map(p=>{
  const raw=data.settings.manual_odds==null?Math.floor(Number(p.probability)*100+1e-7):Number(data.settings.manual_odds[p.id]??0);
  const value=Math.max(0,Math.min(remaining,Number.isFinite(raw)?Math.round(raw):0));remaining-=value;
  return [p.id,value];
 }));
}
export function updateOdds(values,id,n){
 if(!Object.hasOwn(values,id)||!Number.isFinite(n))return values;
 const max=ODDS_TOTAL-totalOdds(values)+values[id];
 return {...values,[id]:Math.max(0,Math.min(max,Math.round(n)))};
}
export function equalOdds(prizes,total){
 const eligible=prizes.filter(available),budget=Number.isFinite(total)?Math.max(0,Math.min(ODDS_TOTAL,Math.round(total))):0;
 const result=Object.fromEntries(prizes.map(p=>[p.id,0]));
 if(!eligible.length)return result;
 const base=Math.floor(budget/eligible.length),remainder=budget%eligible.length;
 eligible.forEach((p,i)=>{result[p.id]=base+(i<remainder?1:0)});
 return result;
}
export const sameOdds=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>a[k]===b[k]);
// Demo only; production draws remain server-authoritative.
export function previewIndex(segments,random){
 if(!segments.some(p=>p.id!=='none'&&Number.isFinite(p.probability)))return Math.min(segments.length-1,Math.floor(random*segments.length));
 let ticket=random*100;
 for(let i=0;i<segments.length;i++){const p=segments[i];if(p.id==='none')continue;const weight=Math.max(0,Number(p.probability)||0);if(ticket<weight)return i;ticket-=weight;}
 const none=segments.findIndex(p=>p.id==='none');return none>=0?none:segments.length-1;
}
