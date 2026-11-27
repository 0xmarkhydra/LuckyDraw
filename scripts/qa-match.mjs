// Integration QA: use isolated accounts/campaign and delete all created test records in finally.
import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import {possible} from '../lib/match3.js';
const base=process.argv[2]||'http://localhost:3239',url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const service=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],tag=randomUUID().slice(0,8),slug='qa-match-'+tag;let cid;
async function account(n){const email='qa-match-'+tag+'-'+n+'@example.invalid',password=randomUUID()+'Aa9!',{data,error}=await service.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;users.push(data.user.id);const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const auth=await client.auth.signInWithPassword({email,password});if(auth.error)throw auth.error;return auth.data.session.access_token}
async function req(path,body,token){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();return {status:r.status,data:d}}
const ok=r=>{assert.equal(r.status,200,JSON.stringify(r.data));return r.data};
const admin=(token,body)=>req('/api/admin',{campaignId:cid,...body},token);
const config=async token=>ok(await req('/api/admin?campaign='+cid,undefined,token)).settings;
try{
 const a=await account('a'),b=await account('b');
 cid=ok(await admin(a,{action:'create_campaign',title:'QA Candy Match',slug,gameType:'match3'})).campaignId;
 let cfg=await config(a);assert.equal(cfg.game_type,'match3');
 ok(await admin(a,{action:'match_rewards',revision:cfg.revision,rewards:[{from:1,to:1,name:'QA voucher',codes:['QA-PRIVATE-'+tag]}]}));
 cfg=await config(a);ok(await admin(a,{action:'match_settings',...cfg,match_seconds:60,active:true}));
 assert.equal((await req('/api/match?campaign='+slug+'&admin=1',undefined,b)).status,404);
 assert.equal((await admin(b,{action:'match_finalize',revision:cfg.revision})).status,404);
 let publicData=ok(await req('/api/match?campaign='+slug));assert(!JSON.stringify(publicData).includes('QA-PRIVATE'));assert.equal(publicData.settings.rewardTiers[0].name,'QA voucher');
 const id=randomUUID(),phone='0987654321',start={slug,id,action:'start',phone,consent:true,deviceId:randomUUID()};
 const s=ok(await req('/api/match',start));assert.equal(s.board.length,64);assert.equal(s.score,0);assert(!('rng' in s));
 const retry=ok(await req('/api/match',start));assert.equal(retry.expiresAt,s.expiresAt);
 assert.equal((await req('/api/match',{...start,id:randomUUID()})).status,409);
 await new Promise(r=>setTimeout(r,250));const [x,y]=possible(s.board);
 const moved=ok(await req('/api/match',{slug,id,action:'move',seq:0,a:x,b:y,score:999999999}));assert(moved.score>0&&moved.score<999999999);
 const stale=await req('/api/match',{slug,id,action:'move',seq:0,a:x,b:y});assert.equal(stale.status,409);assert.equal(stale.data.score,moved.score);
 cfg=await config(a);ok(await admin(a,{action:'match_settings',...cfg,active:false}));cfg=await config(a);
 assert.equal((await admin(a,{action:'match_finalize',revision:cfg.revision})).status,400);
 const expire=await service.from('match_sessions').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('campaign_id',cid).eq('id',id);if(expire.error)throw expire.error;
 ok(await admin(a,{action:'match_finalize',revision:cfg.revision}));
 const status=ok(await req('/api/match',{slug,id,action:'status'}));assert.equal(status.rank,1);assert.equal(status.reward,'QA voucher');assert(!JSON.stringify(status).includes('QA-PRIVATE'));
 const ranking=ok(await req('/api/match?campaign='+slug+'&admin=1',undefined,a));assert.equal(ranking.rows[0].code,'QA-PRIVATE-'+tag);assert.equal(ranking.rows[0].phone,'+84987654321');
 ok(await admin(a,{action:'match_deliver',rank:1}));assert.equal(ok(await req('/api/match',{slug,id,action:'status'})).delivered,true);
 publicData=ok(await req('/api/match?campaign='+slug));assert(!JSON.stringify(publicData).includes('QA-PRIVATE'));assert(!JSON.stringify(publicData).includes('+84987654321'));
 const exp=await fetch(base+'/api/admin/export-players?campaign='+cid,{headers:{Authorization:'Bearer '+a}});assert.equal(exp.status,200);const bytes=new Uint8Array(await exp.arrayBuffer());assert(bytes[0]===80&&bytes[1]===75);
 const forbidden=await fetch(base+'/api/admin/export-players?campaign='+cid,{headers:{Authorization:'Bearer '+b}});assert.equal(forbidden.status,404);
 console.log('PASS: create, reward setup, start/retry, duplicate, authoritative score, stale, pause, settle, private award, delivery, Excel and cross-tenant isolation');
}finally{
 const errors=[];if(cid){for(const table of ['match_awards','match_sessions','settings']){const r=await service.from(table).delete().eq(table==='settings'?'id':'campaign_id',cid);if(r.error)errors.push(table+': '+r.error.message)}}for(const uid of users){const r=await service.auth.admin.deleteUser(uid);if(r.error)errors.push('user: '+r.error.message)}if(errors.length)throw Error('QA cleanup failed for '+slug+': '+errors.join('; '));console.log('QA cleanup complete: '+slug);
}
