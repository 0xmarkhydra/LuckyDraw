// Canonical links must not be derived from untrusted request headers.
export function siteOrigin(env=process.env){
 for(const value of [env.APP_PUBLIC_URL,env.RAILWAY_PUBLIC_DOMAIN?'https://'+env.RAILWAY_PUBLIC_DOMAIN:null,...(env.APP_PUBLIC_ORIGINS||'').split(',')]){
  if(!value)continue;
  try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash)return u.origin}catch{}
 }
 return 'https://web-production-0c0e9892.up.railway.app';
}
export function campaignSeo(cfg,origin){
 const url=origin+'/c/'+encodeURIComponent(cfg.slug),title=cfg.title.trim()+' | Vòng quay may mắn',description=(cfg.description||'').replace(/\s+/g,' ').trim().slice(0,160)||('Tham gia '+cfg.title+' — thử vận may và nhận quà cùng LuckyDraw.').slice(0,160);
 const index=!!cfg.active&&(!cfg.ends_at||Date.parse(cfg.ends_at)>Date.now());
 return {title,description,url,index,image:url+'/opengraph-image'};
}
export function homeSeo(origin){const title='LuckyDraw – Tạo vòng quay may mắn, minigame marketing',description='Tạo vòng quay may mắn cho doanh nghiệp, tùy chỉnh tỷ lệ trúng, quản lý quà tặng và voucher, xuất danh sách người chơi, nhúng minigame vào website dễ dàng.',image=origin+'/opengraph-image';return {metadataBase:new URL(origin),title,description,alternates:{canonical:origin+'/'},robots:{index:true,follow:true},openGraph:{type:'website',locale:'vi_VN',siteName:'LuckyDraw',title,description,url:origin+'/',images:[{url:image,width:1200,height:630,alt:title}]},twitter:{card:'summary_large_image',title,description,images:[image]}}}
