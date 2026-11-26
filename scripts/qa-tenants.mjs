import {createClient} from '@supabase/supabase-js';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const root=createClient(url,process.env.SUPABASE_SECRET_KEY,opts);
const created=[],campaignIds=[],base=process.argv[2]||'http://localhost:3168',run=randomUUID().slice(0,12);
async function makeUser(label){const email='qa-'+run+'-'+label+'@example.com',password=randomBytes(24).toString('base64url')+'A1!';const {data,error}=await root.auth.admin.createUser({email,password,email_confirm:true});if(error)throw Error('QA auth create: '+error.message);created.push(data.user.id);const c=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,opts),login=await c.auth.signInWithPassword({email,password});if(login.error)throw Error('QA login failed');return login.data.session.access_token}
async function call(token,path='',body){const r=await fetch(base+'/api/admin'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()}}
try {
 const a=await makeUser('a'),b=await makeUser('b');
 for(const t of [a,b]){const v=await call(t);assert.equal(v.status,200);assert.equal(v.data.settings,null);assert.equal(v.data.campaigns.length,0)}
 const sa='qa-tenant-'+run+'-a',sb='qa-tenant-'+run+'-b';
 const x=await call(a,'',{action:'create_campaign',title:'QA tenant A',slug:sa});assert.equal(x.status,200,JSON.stringify(x));campaignIds.push(x.data.campaignId);
 const y=await call(b,'',{action:'create_campaign',title:'QA tenant B',slug:sb});assert.equal(y.status,200,JSON.stringify(y));campaignIds.push(y.data.campaignId);
 const [aid,bid]=campaignIds;
 for(const [t,own,other] of [[a,aid,bid],[b,bid,aid]]){const v=await call(t);assert.equal(v.status,200);assert.deepEqual(v.data.campaigns.map(c=>c.id),[own]);assert.equal(v.data.settings.id,own);assert.equal((await call(t,'?campaign='+other)).status,404);assert.equal((await call(t,'?campaign=1')).status,404);for(const action of ['settings','prize','import','widget'])assert.equal((await call(t,'',{action,campaignId:other})).status,404);}
 assert.equal((await call(b,'',{action:'create_campaign',title:'Duplicate',slug:sa})).status,400);
 assert.equal((await fetch(base+'/api/admin')).status,401);
 const publicGame=await fetch(base+'/api/game?campaign='+sa);assert.equal(publicGame.status,200);const pg=await publicGame.json();assert.equal(pg.settings.title,'QA tenant A');assert.ok(!('owner_id' in pg.settings));assert.equal(pg.settings.active,false);
 console.log('PASS: 2 verified accounts, empty workspaces, campaign creation, tenant-scoped GET and all POST mutations, unique slug, public game, unauthenticated denial');
} finally {
 for(const id of campaignIds){const {error}=await root.from('settings').delete().eq('id',id).in('owner_id',created);if(error)console.log('QA campaign cleanup blocked',id,error.message)}
 for(const id of created){const {error}=await root.auth.admin.deleteUser(id);if(error)console.log('QA account cleanup blocked',error.message)}
}