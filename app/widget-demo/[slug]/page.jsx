import Script from 'next/script';
import {Gift,ShoppingBag,Package,Truck,ShieldCheck} from 'lucide-react';
import './demo.css';
export default async function WidgetDemo({params,searchParams}){
 const {slug}=await params,q=await searchParams;
 if(!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug))return <p>Không tìm thấy chiến dịch.</p>;
 const mode=['floating','popup','inline'].includes(q.mode)?q.mode:'floating',position=q.position==='bottom-left'?'bottom-left':'bottom-right',delay=Math.min(60,Math.max(0,Number(q.delay??3)||0));
 return <main className="wd-site"><header><div className="wd-brand"><span><ShoppingBag size={20}/></span> Mộc Studio</div><span className="wd-demo-label">WEBSITE MẪU</span></header><section className="wd-hero"><div><small>ƯU ĐÃI THÀNH VIÊN</small><h1>Niềm vui từ những điều nhỏ.</h1><p>Một không gian mua sắm dành riêng cho bạn.</p></div><div className="wd-gift"><Gift size={64} strokeWidth={1.25}/></div></section><section className="wd-content"><h2>Khám phá cửa hàng</h2>{mode==='inline'&&<div id="luckydraw-demo-target"/>}<div className="wd-benefits">{[[Package,'Sản phẩm chọn lọc'],[Truck,'Giao hàng tận nơi'],[ShieldCheck,'Mua sắm an tâm']].map(([Icon,label])=><article key={label}><Icon size={24}/><strong>{label}</strong></article>)}</div></section><footer>Mộc Studio · Website minh họa</footer><Script id="luckydraw-demo-sdk" src="/widget.js" strategy="afterInteractive" data-campaign={slug} data-mode={mode} data-position={position} data-delay={String(delay)} data-target="#luckydraw-demo-target" data-preview="true"/></main>
}
