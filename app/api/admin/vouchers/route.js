import {NextResponse} from 'next/server';
import {db,account} from '../../../../lib/db';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req){try{
 const user=await account(req);if(!user)return reply({error:'Vui lòng đăng nhập.'},401);
 const params=new URL(req.url).searchParams,campaign=Number(params.get('campaign')),prize=params.get('prize'),page=Number(params.get('page')||0),filter=params.get('filter')||'all';
 if(!Number.isSafeInteger(campaign)||campaign<1||!prize||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(prize)||!Number.isSafeInteger(page)||page<0||page>100000||!['all','unused','used'].includes(filter))return reply({error:'Yêu cầu không hợp lệ.'},400);
 const c=db(),owned=await c.from('settings').select('id').eq('id',campaign).eq('owner_id',user.id).maybeSingle();
 if(owned.error)throw Error();if(!owned.data)return reply({error:'Không tìm thấy chiến dịch của bạn.'},404);
 const reward=await c.from('prizes').select('id').eq('campaign_id',campaign).eq('id',prize).maybeSingle();if(reward.error)throw Error();if(!reward.data)return reply({error:'Không tìm thấy phần thưởng.'},404);
 const scope=()=>c.from('vouchers').select('id,code,used',{count:'exact'}).eq('campaign_id',campaign).eq('prize_id',prize);
 let query=scope();if(filter!=='all')query=query.eq('used',filter==='used');
 const [rows,unused,used]=await Promise.all([query.order('code').order('id').range(page*50,page*50+49),c.from('vouchers').select('id',{count:'exact',head:true}).eq('campaign_id',campaign).eq('prize_id',prize).eq('used',false),c.from('vouchers').select('id',{count:'exact',head:true}).eq('campaign_id',campaign).eq('prize_id',prize).eq('used',true)]);
 if(rows.error||unused.error||used.error)throw Error();return reply({codes:rows.data,total:rows.count,unused:unused.count,used:used.count,pageSize:50});
 }catch{return reply({error:'Không tải được danh sách mã. Vui lòng thử lại.'},500)}}
