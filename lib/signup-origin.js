import {PUBLIC_ORIGIN} from './public-origin.js';
// Railway terminates TLS before forwarding to Next.js. Trust configured public
// origins, not arbitrary forwarded headers or a reflected client Origin.
export function signupOriginAllowed(req,env=process.env){
 const origin=req.headers.get('origin');
 if(!origin||origin==='null')return false;
 try {
  const parsed=new URL(origin);
  if(parsed.origin!==origin)return false;
  const site=req.headers.get('sec-fetch-site');
  if(site==='cross-site')return false;
  const direct=new URL(req.url);
  const allowed=new Set();
  if(direct.protocol==='https:'||(['localhost','127.0.0.1','[::1]'].includes(direct.hostname)&&direct.protocol==='http:'))allowed.add(direct.origin);
  const configured=[PUBLIC_ORIGIN,env.APP_PUBLIC_URL||'',...(env.APP_PUBLIC_ORIGINS||'').split(','),env.RAILWAY_PUBLIC_DOMAIN?'https://'+env.RAILWAY_PUBLIC_DOMAIN:''];
  for(const entry of configured){try{const url=new URL(entry.trim());if(url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash)allowed.add(url.origin)}catch{}}
  return allowed.has(parsed.origin);
 }catch{return false}
}