import {cache} from 'react';
import {notFound} from 'next/navigation';
import Home from '../../game-client';
import {db} from '../../../lib/db';
import {siteOrigin,campaignSeo} from '../../../lib/campaign-seo';
export const dynamic='force-dynamic';
const getCampaign=cache(async slug=>{
 if(!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug))return null;
 const c=db(),{data,error}=await c.from('settings').select('id,slug,title,description,active,starts_at,ends_at,max_plays_per_phone,play_period,max_wins_per_phone,max_total_plays').eq('slug',slug).maybeSingle();
 if(error)throw Error('Không tải được chiến dịch');
 if(!data)return null;
 return data;
});
export async function generateMetadata({params}){
 const {slug}=await params,cfg=await getCampaign(slug);
 if(!cfg)return {title:'Không tìm thấy chiến dịch | LuckyDraw',robots:{index:false,follow:false}};
 const s=campaignSeo(cfg,siteOrigin());
 return {title:s.title,description:s.description,alternates:{canonical:s.url},robots:{index:s.index,follow:s.index},openGraph:{type:'website',locale:'vi_VN',siteName:'LuckyDraw',title:s.title,description:s.description,url:s.url,images:[{url:s.image,width:1200,height:630,alt:s.title}]},twitter:{card:'summary_large_image',title:s.title,description:s.description,images:[s.image]}};
}
export default async function CampaignPage({params}){
 const {slug}=await params,cfg=await getCampaign(slug);if(!cfg)notFound();
 const {data:prizes,error}=await db().from('prizes').select('id,name').eq('campaign_id',cfg.id).order('id');if(error)throw Error('Không tải được phần thưởng');
 const {id,max_total_plays,...settings}=cfg;
 return <Home key={slug} campaignSlug={slug} initial={{settings,prizes}}/>;
}
