import {NextResponse} from 'next/server';
import {normalizeOrigin,widgetConfig} from './lib/widget';
export async function proxy(req){const path=req.nextUrl.pathname;const response=NextResponse.next();let ancestors="'none'";if(path.startsWith('/embed/')){try{const slug=path.split('/')[2],cfg=await widgetConfig(slug);const allowed=cfg?.widget_enabled?(cfg.widget_origins||[]).map(normalizeOrigin).filter(Boolean):[];ancestors=["'self'",...allowed].join(' ')}catch{ancestors="'self'"}}
 response.headers.set('Content-Security-Policy','frame-ancestors '+ancestors);
 response.headers.set('Referrer-Policy','no-referrer');
 if(!path.startsWith('/embed/'))response.headers.set('X-Frame-Options','DENY');
 else response.headers.set('Cache-Control','private, no-store');
 return response}
export const config={matcher:['/','/admin/:path*','/c/:path*','/embed/:path*']};
