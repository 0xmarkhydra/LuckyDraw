import {NextResponse} from 'next/server';
import {createHmac} from 'node:crypto';
import {db} from '../../../../lib/db';
import {ADMIN_AUTH_EMAIL} from '../../../../lib/admin-identity';
import {signupOriginAllowed} from '../../../../lib/signup-origin.js';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
function hash(v){return createHmac('sha256',process.env.SUPABASE_SECRET_KEY).update('signup-quota:'+v).digest('hex')}
export async function POST(req){try{
 if(!signupOriginAllowed(req))return reply({error:'Không thể xác minh nguồn đăng ký. Hãy mở trực tiếp LuckyDraw và thử lại.'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Định dạng yêu cầu đăng ký không hợp lệ.'},415);
 const raw=await req.text();if(raw.length>4096)return reply({error:'Thông tin không hợp lệ.'},400);
 const b=JSON.parse(raw),email=typeof b.email==='string'?b.email.trim().toLowerCase():'',password=b.password;
 if(email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email===ADMIN_AUTH_EMAIL||typeof password!=='string'||password.length<10||password.length>128||Buffer.byteLength(password,'utf8')>72)return reply({error:'Email hoặc mật khẩu không hợp lệ (tối thiểu 10 ký tự, tối đa 72 byte).'},400);
 const c=db(),ip=req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
 const quota=await c.rpc('consume_signup_quota',{p_email_hash:hash(email),p_ip_hash:hash(ip)});if(quota.error)return reply({error:'Không thể đăng ký lúc này.'},503);
 if(!quota.data)return reply({error:'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'},429);
 const {error}=await c.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{email_ownership_verified:false}});
 if(error)return reply({error:'Không thể tạo tài khoản. Hãy thử đăng nhập hoặc dùng email khác.'},400);
 return reply({ok:true},201);
 }catch{return reply({error:'Không thể đăng ký lúc này.'},503)}}