import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
const base=process.argv[2]||'http://localhost:3288',opts={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,opts),ids=[],campaigns=[];
async function user(){const email='qa-export-'+randomUUID()+'@example.com',password=randomBytes(24).toString('base64url')+'Aa1!';const r=await root.auth.admin.createUser({email,password,email_confirm:true});if(r.error)throw Error('QA create user failed');ids.push(r.data.user.id);const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,opts),login=await c.auth.signInWithPassword({email,password});if(login.error)throw Error('QA login failed');return {id:r.data.user.id,token:login.data.session.access_token}}
try{
 const a=await user(),b=await user();
 const slug='qa-export-'+randomUUID().slice(0,12),cr=await root.rpc('campaign_create_owned',{p_owner:a.id,p_title:'Kiểm thử quà tặng',p_slug:slug});if(cr.error)throw Error(cr.error.message);const campaign=cr.data;campaigns.push(campaign);
 const rows=Array.from({length:501},(_,i)=>({campaign_id:campaign,request_id:randomUUID(),name:i===500?'=1+1':'Khách mẫu '+i,phone:'+849'+String(i).padStart(8,'0'),prize_id:null,prize_name:'Chúc may mắn',source_channel:i===500?'widget':'landing',source_origin:i===500?'https://example.com':null}));
 const ins=await root.from('plays').insert(rows);if(ins.error)throw Error(ins.error.message);
 const endpoint=base+'/api/admin/export-players?campaign='+campaign;
 assert.equal((await fetch(endpoint)).status,401);
 assert.equal((await fetch(endpoint,{headers:{Authorization:'Bearer '+b.token}})).status,404);
 const res=await fetch(endpoint,{headers:{Authorization:'Bearer '+a.token}});assert.equal(res.status,200);assert.ok(res.headers.get('cache-control').includes('no-store'));const wb=new ExcelJS.Workbook();await wb.xlsx.load(await res.arrayBuffer());const sheet=wb.getWorksheet('Người chơi');assert.equal(sheet.rowCount,502);assert.equal(sheet.getCell('B2').value,'=1+1');assert.equal(sheet.getCell('C2').value,'+84900000500');assert.equal(sheet.getCell('I2').value,'https://example.com');assert.equal(sheet.getCell('C502').value,'+84900000000');console.log('PASS: 501 exported rows, +84 text, formula-like name remains text, widget source, authenticated owner only');
 const html=await (await fetch(base+'/',{headers:{'user-agent':'facebookexternalhit/1.1'}})).text();assert.ok(html.includes('og:image'));assert.ok(html.includes('rel="canonical"'));const cHtml=await (await fetch(base+'/c/'+slug,{headers:{'user-agent':'facebookexternalhit/1.1'}})).text();assert.ok(cHtml.includes('Kiểm thử quà tặng'));assert.ok(cHtml.includes('noindex'));for(const path of ['/opengraph-image','/c/'+slug+'/opengraph-image']){const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'image/png');assert.ok((await r.arrayBuffer()).byteLength>1000)}console.log('PASS: homepage metadata, campaign-specific metadata, draft noindex, two valid OG PNGs');
}finally{
 for(const c of campaigns){const p=await root.from('plays').delete().eq('campaign_id',c);if(p.error)console.log('QA play cleanup failed',p.error.message);const s=await root.from('settings').delete().eq('id',c).in('owner_id',ids);if(s.error)console.log('QA campaign cleanup failed',s.error.message)}
 for(const id of ids){const r=await root.auth.admin.deleteUser(id);if(r.error)console.log('QA user cleanup failed',r.error.message)}
}
