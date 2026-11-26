import {NextResponse} from 'next/server';
import {widgetFrameAncestors,widgetConfig} from './lib/widget';
export async function proxy(req){const path=req.nextUrl.pathname;const response=NextResponse.next();let ancestors="'none'";if(path.startsWith('/widget-demo/'))ancestors="'self'";if(path.startsWith('/embed/')){try{const slug=path.split('/')[2],cfg=await widgetConfig(slug);ancestors=widgetFrameAncestors(cfg)}catch{ancestors="'self'"}}
 response.headers.set('Content-Security-Policy','frame-ancestors '+ancestors);
 response.headers.set('Referrer-Policy','no-referrer');
 if(path.startsWith('/admin')||path.startsWith('/embed/')||path.startsWith('/widget-demo/'))response.headers.set('X-Robots-Tag','noindex, nofollow');
 if(!path.startsWith('/embed/')&&!path.startsWith('/widget-demo/'))response.headers.set('X-Frame-Options','DENY');
 else response.headers.set('Cache-Control','private, no-store');
 return response}
export const config={matcher:['/','/admin/:path*','/c/:path*','/embed/:path*','/widget-demo/:path*']};