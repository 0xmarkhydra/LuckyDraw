import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {legacyPhoneKey} from './phone.js';
export const devicePattern=/^[a-f0-9]{8}-[a-f0-9]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[a-f0-9]{12}$/i;
export function normalizeIp(input){
 const raw=String(input||'').trim().toLowerCase();
 if(isIP(raw)===4)return raw;
 if(isIP(raw)!==6)return null;
 try{
  const host=new URL('http://['+raw+']/').hostname.slice(1,-1),[left,right]=host.split('::'),a=left?left.split(':'):[],b=right?right.split(':'):[];
  const parts=right===undefined?a:[...a,...Array(8-a.length-b.length).fill('0'),...b];
  const nums=parts.map(x=>parseInt(x,16));
  if(nums.length!==8)return null;
  if(nums.slice(0,5).every(n=>n===0)&&nums[5]===65535)return [nums[6]>>8,nums[6]&255,nums[7]>>8,nums[7]&255].join('.');
  return nums.slice(0,4).map(n=>n.toString(16)).join(':')+'::/64';
 }catch{return null}
}
export function clientIp(req,env=process.env){
 // Only trust the documented edge-provided header on Railway's HTTP ingress.
 if(env.RAILWAY_PUBLIC_DOMAIN&&req.headers.get('x-railway-edge')&&req.headers.get('x-railway-request-id'))return normalizeIp(req.headers.get('x-real-ip'));
 const url=new URL(req.url);
 if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&url.protocol==='http:'&&!req.headers.get('x-railway-edge'))return 'local-development';
 return null;
}
export function drawQuotaHashes(req,campaign,phone,device,env=process.env){
 const ip=clientIp(req,env),secret=env.SUPABASE_SECRET_KEY,phoneKey=legacyPhoneKey(phone);
 if(!ip||!secret||!phoneKey)return null;
 const hash=(kind,v)=>createHmac('sha256',secret).update('draw-quota:v1:'+kind+':'+v).digest('hex');
 return {p_campaign:campaign,p_ip_hash:hash('ip',ip),p_phone_hash:hash('phone',campaign+':'+phoneKey),p_device_hash:typeof device==='string'&&devicePattern.test(device)?hash('device',campaign+':'+device.toLowerCase()):null};
}