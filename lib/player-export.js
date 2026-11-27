import ExcelJS from 'exceljs';
export const MAX_EXPORT_ROWS=50000;
export function playerWorkbook(){
 const workbook=new ExcelJS.Workbook();workbook.creator='LuckyDraw';
 const sheet=workbook.addWorksheet('Người chơi',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=[{header:'STT',key:'no',width:9},{header:'Họ và tên',key:'name',width:30},{header:'Số điện thoại',key:'phone',width:20},{header:'Kết quả',key:'result',width:18},{header:'Phần thưởng',key:'prize',width:34},{header:'Mã voucher',key:'code',width:30},{header:'Thời gian (GMT+7)',key:'time',width:25},{header:'Nguồn',key:'source',width:17},{header:'Website',key:'site',width:42}];
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'},name:'Arial'};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF8E2940'}};sheet.getRow(1).height=25;
 for(const key of ['name','phone','prize','code','site'])sheet.getColumn(key).numFmt='@';
 sheet.autoFilter={from:'A1',to:'I1'};
 return {workbook,sheet};
}
const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function addPlayer(sheet,p,no){
 // All user-controlled values are plain XLSX strings, never formulas.
 const row=sheet.addRow({no,name:String(p.name??''),phone:String(p.phone??''),result:p.prize_id?'Trúng thưởng':'Không trúng',prize:String(p.prize_name??''),code:String(p.voucher_code??''),time:date.format(new Date(p.created_at)),source:p.source_channel==='widget'?'Widget':'Landing page',site:String(p.source_origin??'')});
 row.alignment={vertical:'middle'};row.height=20;
}
export function matchWorkbook(){const workbook=new ExcelJS.Workbook();workbook.creator='LuckyDraw';const sheet=workbook.addWorksheet('Bảng xếp hạng',{views:[{state:'frozen',ySplit:1}]});sheet.columns=[{header:'Hạng',key:'rank',width:10},{header:'Số điện thoại',key:'phone',width:20},{header:'Điểm',key:'score',width:14},{header:'Đạt điểm lúc (GMT+7)',key:'time',width:26},{header:'Phần thưởng',key:'reward',width:35},{header:'Mã voucher',key:'code',width:30},{header:'Trạng thái',key:'status',width:22},{header:'Website',key:'origin',width:42}];sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF8E2940'}};sheet.getRow(1).height=25;for(const key of ['phone','reward','code','origin'])sheet.getColumn(key).numFmt='@';sheet.autoFilter={from:'A1',to:'H1'};return {workbook,sheet}}
export function addMatchPlayer(sheet,r){sheet.addRow({rank:Number(r.rank),phone:String(r.phone),score:Number(r.score),time:date.format(new Date(r.score_at)),reward:String(r.reward??''),code:String(r.code??''),status:r.reward?(r.delivered_at?'Đã trao thưởng':'Chờ xác minh / trao thưởng'):'—',origin:String(r.origin??'')})}
