import {db} from '../lib/db';
import {siteOrigin} from '../lib/campaign-seo';
export const dynamic='force-dynamic';
export default async function sitemap(){
 const base=siteOrigin(),rows=[];let page=0;
 for(;;){const {data,error}=await db().from('settings').select('slug,ends_at').eq('active',true).order('id').range(page*500,page*500+499);if(error)throw Error('Sitemap unavailable');rows.push(...data);if(data.length<500)break;page++}
 return [{url:base,changeFrequency:'weekly'},...rows.filter(c=>!c.ends_at||Date.parse(c.ends_at)>Date.now()).map(c=>({url:base+'/c/'+encodeURIComponent(c.slug),changeFrequency:'daily'}))];
}
