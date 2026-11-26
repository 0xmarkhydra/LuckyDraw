import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {ADMIN_AUTH_EMAIL} from './admin-identity';
export function db(){const u=process.env.NEXT_PUBLIC_SUPABASE_URL,k=process.env.SUPABASE_SECRET_KEY;if(!u||!k)throw Error('DATABASE_NOT_CONFIGURED');return createClient(u,k,{auth:{persistSession:false,autoRefreshToken:false}});}
export function normalizePhone(v){return v.trim().replace(/[\s().-]/g,'').replace(/^(\+84|84)/,'0');}
export async function isAdmin(req){const token=req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1], email=ADMIN_AUTH_EMAIL;if(!token)return false;const {data,error}=await db().auth.getUser(token);return !error&&data.user?.email?.toLowerCase()===email&&!!data.user.email_confirmed_at&&data.user.app_metadata?.luckydraw_role==='admin';}