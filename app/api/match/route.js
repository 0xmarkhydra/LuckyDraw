import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {db,account,normalizePhone} from '../../../lib/db';
import {drawQuotaHashes,devicePattern} from '../../../lib/draw-quota';
import {createBoard,move} from '../../../lib/match3';
import {validSlug,verifyWidgetToken} from '../../../lib/widget';
export const dynamic='force-dynamic';
const json=(body,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const fail=(error,status=400)=>json({error},status);
const messages={GAME_CLOSED:'Chiến dịch chưa mở hoặc đã kết thúc.',PLAY_LIMIT:'Số điện thoại đã sử dụng lượt chơi.',CAMPAIGN_LIMIT:'Chiến dịch đã hết lượt.',WIDGET_DISABLED:'Widget không còn khả dụng.',MATCH_ENDED:'Đã hết thời gian.',STALE_MOVE:'Trạng thái đã thay đổi.',MOVE_RATE:'Thao tác quá nhanh.',INVALID_REQUEST:'Phiên chơi không hợp lệ.'};
const publicSession=s=>({board:s.board,score:s.score,seq:s.seq,expiresAt:s.expires_at,serverNow:Date.now()});
const config=(c,slug)=>c.from('settings').select('id,slug,title,description,game_type,active,starts_at,ends_at,match_seconds').eq('slug',slug).eq('game_type','match3').maybeSingle();
const mask=p=>p.slice(0,3)+'******'+p.slice(-3);
export async function GET(req){
 try{
 const u=new URL(req.url),slug=u.searchParams.get('campaign');if(!validSlug(slug))return fail('Không tìm thấy game.',404);
 const c=db(),{data:cfg,error}=await config(c,slug);if(error)throw Error();if(!cfg)return fail('Không tìm thấy game.',404);
 const admin=u.searchParams.get('admin')==='1';let page=0;
 if(admin){const user=await account(req);if(!user)return fail('Vui lòng đăng nhập.',401);const owned=await c.from('settings').select('id').eq('id',cfg.id).eq('owner_id',user.id).maybeSingle();if(owned.error)throw Error();if(!owned.data)return fail('Không tìm thấy chiến dịch.',404);page=Math.max(0,Math.min(100000,Math.floor(Number(u.searchParams.get('page'))||0)));}
 const {data:rows,error:rankError}=await c.rpc('match_rank',{p_campaign:cfg.id,p_limit:admin?50:20,p_offset:page*50});if(rankError)throw Error();
 const {count,error:countError}=await c.from('match_sessions').select('id',{count:'exact',head:true}).eq('campaign_id',cfg.id).lte('expires_at',new Date().toISOString());if(countError)throw Error();
 const {id,...settings}=cfg;const now=Date.now();settings.active=cfg.active&&(!cfg.starts_at||Date.parse(cfg.starts_at)<=now)&&(!cfg.ends_at||Date.parse(cfg.ends_at)>now);
 return json({settings,total:count,rows:rows.map(r=>({rank:r.rank,phone:admin?r.phone:mask(r.phone),score:r.score,scoreAt:r.score_at}))});
 }catch{return fail('Không tải được bảng xếp hạng.',503)}
}
export async function POST(req){
 try{
 const raw=await req.text();if(raw.length>4096)return fail('Yêu cầu quá lớn.');let b;try{b=JSON.parse(raw)}catch{return fail('Yêu cầu không hợp lệ.')}
 if(!b||!validSlug(b.slug)||typeof b.id!=='string'||!devicePattern.test(b.id))return fail('Phiên không hợp lệ.');
 const c=db(),{data:cfg,error}=await config(c,b.slug);if(error)throw Error();if(!cfg)return fail('Không tìm thấy game.',404);
 if(b.action==='start'){
  const phone=normalizePhone(b.phone);if(!phone||b.consent!==true)return fail('Nhập số điện thoại hợp lệ và đồng ý thể lệ.');
  const widget=b.widgetToken?verifyWidgetToken(b.widgetToken,b.slug):null;if(b.widgetToken&&!widget)return fail('Phiên widget hết hạn.',403);
  const hashes=drawQuotaHashes(req,cfg.id,phone,b.deviceId);if(!hashes)return fail('Không xác minh được kết nối.',503);
  const quota=await c.rpc('consume_draw_quota',hashes);if(quota.error)throw Error();if(!quota.data)return fail('Quá nhiều yêu cầu. Vui lòng thử lại sau.',429);
  const state=createBoard(randomBytes(4).readUInt32LE());
  const {data,error}=await c.rpc('match_start',{p_campaign:cfg.id,p_id:b.id,p_phone:phone,p_board:state.board,p_rng:state.rng,p_origin:widget?.origin||null});
  if(error)return fail(messages[error.message]||'Không bắt đầu được trò chơi.',409);return json(publicSession(data));
 }
 const {data:s,error:readError}=await c.from('match_sessions').select('*').eq('id',b.id).eq('campaign_id',cfg.id).maybeSingle();if(readError)throw Error();if(!s)return fail('Không tìm thấy phiên chơi.',404);
 if(b.action==='status'){
  let rank=null;
  if(Date.parse(s.expires_at)<=Date.now()){
   const {data:position,error}=await c.rpc('match_position',{p_campaign:cfg.id,p_id:s.id});if(error)throw Error();rank=position;
  }
  return json({...publicSession(s),rank});
 }
 if(b.action!=='move'||!Number.isInteger(b.seq))return fail('Yêu cầu không hợp lệ.');
 if(Date.parse(s.expires_at)<=Date.now())return fail(messages.MATCH_ENDED,409);
 if(s.seq!==b.seq)return json({...publicSession(s),conflict:true},409);
 const result=move(s.board,Number(s.rng),b.a,b.b);if(!result)return json({...publicSession(s),invalid:true});
 const {data,error:moveError}=await c.rpc('match_move',{p_id:s.id,p_campaign:cfg.id,p_seq:s.seq,p_board:result.board,p_rng:result.rng,p_delta:result.score});
 if(moveError)return fail(messages[moveError.message]||'Không lưu được lượt ghép.',409);
 return json({...publicSession(data),combo:result.combo,delta:result.score});
 }catch{return fail('Hệ thống chưa sẵn sàng.',503)}
}