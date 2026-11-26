import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { ADMIN_AUTH_EMAIL, ADMIN_USERNAME } from './lib/admin-identity.js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, secret=process.env.SUPABASE_SECRET_KEY, publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if(!url||!secret||!publicKey){console.error('Missing required Supabase environment variables.');process.exit(1)}
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url,secret,options);
const password=randomBytes(24).toString('base64url')+'!Aa7';
const {data,error}=await admin.auth.admin.createUser({email:ADMIN_AUTH_EMAIL,password,email_confirm:true,app_metadata:{luckydraw_role:'admin'}});
if(error){console.error('Admin creation failed:',error.message);process.exit(1)}
const client=createClient(url,publicKey,options);
const result=await client.auth.signInWithPassword({email:ADMIN_AUTH_EMAIL,password});
if(result.error||result.data.user?.app_metadata?.luckydraw_role!=='admin'){console.error('Admin created, but login verification failed. Reset password securely via Supabase Dashboard.');process.exit(1)}
await client.auth.signOut();
console.log('Admin created and login verified. Username: '+ADMIN_USERNAME);
console.log('Initial password: '+password);
