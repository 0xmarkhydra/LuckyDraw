import {NextResponse} from 'next/server';
import {db,account} from '../../../../lib/db';
import {playerWorkbook,addPlayer,MAX_EXPORT_ROWS} from '../../../../lib/player-export';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const fail=(error,status)=>NextResponse.json({error},{status,headers});
export async function GET(req){
 try{
  const user=await account(req);if(!user)return fail('Vui lòng đăng nhập.',401);
  const id=Number(new URL(req.url).searchParams.get('campaign'));if(!Number.isSafeInteger(id)||id<1)return fail('Chiến dịch không hợp lệ.',400);
  const c=db(),owned=await c.from('settings').select('id,slug,game_type').eq('id',id).eq('owner_id',user.id).maybeSingle();
  if(owned.error)throw Error();if(!owned.data)return fail('Không tìm thấy chiến dịch của bạn.',404);
  if(owned.data.game_type==='match3')return fail('Sử dụng bảng xếp hạng Candy Match.',400);const top=await c.from('plays').select('id').eq('campaign_id',id).order('id',{ascending:false}).limit(1).maybeSingle();
  if(top.error)throw Error();
  const {workbook,sheet}=playerWorkbook();let total=0,cursor=top.data?.id;
  if(cursor!=null){
   const count=await c.from('plays').select('id',{head:true,count:'exact'}).eq('campaign_id',id).lte('id',cursor);
   if(count.error)throw Error();if(count.count>MAX_EXPORT_ROWS)return fail('Chiến dịch vượt giới hạn xuất 50.000 lượt mỗi tệp. Vui lòng liên hệ hỗ trợ.',413);
   for(let first=true;;first=false){
    if(req.signal.aborted)throw Error('ABORTED');
    let q=c.from('plays').select('id,name,phone,prize_id,prize_name,voucher_code,created_at,source_channel,source_origin').eq('campaign_id',id).order('id',{ascending:false}).limit(500);
    q=first?q.lte('id',cursor):q.lt('id',cursor);
    const {data,error}=await q;if(error)throw Error();if(!data.length)break;
    for(const p of data){if(++total>MAX_EXPORT_ROWS)return fail('Vượt giới hạn xuất dữ liệu.',413);addPlayer(sheet,p,total)}
    cursor=data.at(-1).id;if(data.length<500)break;
   }
  }
  const buffer=await workbook.xlsx.writeBuffer(),filename='luckydraw-'+owned.data.slug+'-'+new Date().toISOString().slice(0,10)+'.xlsx';
  return new Response(new Uint8Array(buffer),{headers:{...headers,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="'+filename+'"'}});
 }catch{return fail('Không xuất được danh sách. Vui lòng thử lại.',500)}
}