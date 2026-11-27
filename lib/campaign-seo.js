// Canonical links must not be derived from untrusted request headers.
import {PUBLIC_ORIGIN} from './public-origin.js';
export function siteOrigin(env=process.env){
 for(const value of [env.APP_PUBLIC_URL,PUBLIC_ORIGIN]){
  if(!value)continue;
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash)return u.origin}catch{}
 }
 return PUBLIC_ORIGIN;
}
export function campaignSeo(cfg,origin){
 const match=cfg.game_type==='match3',url=origin+'/c/'+encodeURIComponent(cfg.slug),title=cfg.title.trim()+' | '+(match?'Candy Match':'Vòng quay may mắn')+' · LuckyDraw',description=(cfg.description||'').replace(/\s+/g,' ').trim().slice(0,160)||(match?'Tham gia '+cfg.title+' — ghép kẹo, tích điểm và chinh phục bảng xếp hạng.':'Tham gia '+cfg.title+' — thử vận may và nhận quà cùng LuckyDraw.').slice(0,160);
 const index=!!cfg.active&&!cfg.match_finalized_at&&(!cfg.ends_at||Date.parse(cfg.ends_at)>Date.now());
 return {title,description,url,index,image:url+'/opengraph-image'};
}
export function homeSeo(origin){const title='LuckyDraw – Nền tảng minigame marketing cho doanh nghiệp',description='Tạo vòng quay may mắn và Candy Match không cần code. Quản lý quà, voucher, bảng xếp hạng, dữ liệu người chơi và nhúng minigame vào website.',image=origin+'/opengraph-image';return {metadataBase:new URL(origin),title,description,alternates:{canonical:origin+'/'},robots:{index:true,follow:true},openGraph:{type:'website',locale:'vi_VN',siteName:'LuckyDraw',title,description,url:origin+'/',images:[{url:image,width:1200,height:630,alt:title}]},twitter:{card:'summary_large_image',title,description,images:[image]}}}