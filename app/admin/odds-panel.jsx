'use client';
import {useState} from 'react';
import {Gift,Ticket,Clover,Save,Info,Shuffle,RotateCcw,Pencil,AlertCircle} from 'lucide-react';
import {available,initialOdds,totalOdds,updateOdds,equalOdds,sameOdds} from '../../lib/odds';
const pct=n=>(n/100).toLocaleString('vi-VN',{maximumFractionDigits:2})+'%';
const qty=n=>Number(n).toLocaleString('vi-VN');
function PercentInput({name,value,max,disabled,onChange}){
 const [draft,setDraft]=useState(null);
 return <label className="aw-odds-number"><input type="text" inputMode="decimal" aria-label={'Tỷ lệ '+name} value={draft??String(value/100)} disabled={disabled} onFocus={e=>{setDraft(String(value/100));e.target.select()}} onChange={e=>{const raw=e.target.value;if(!/^\d{0,3}(?:[.,]\d{0,2})?$/.test(raw))return;const n=Number(raw.replace(',','.'));if(Number.isFinite(n)&&n*100>max){setDraft(String(max/100));onChange(max);return;}setDraft(raw);if(Number.isFinite(n))onChange(n*100)}} onBlur={()=>setDraft(null)}/><span>%</span></label>;
}
export default function OddsPanel({data,busy,onSave,onDirtyChange,onEdit}){
 const [original]=useState(()=>initialOdds(data)),[values,setValues]=useState(original);
 const dirty=!sameOdds(original,values),auto=data.settings.manual_odds==null,locked=busy||data.settings.active,allocated=totalOdds(values),noWin=10000-allocated;
 const unavailable=data.prizes.reduce((sum,p)=>sum+(!available(p)?(values[p.id]||0):0),0);
 const unallocated=data.prizes.filter(p=>available(p)&&!(values[p.id]>0)).length;
 const savedWin=data.prizes.reduce((sum,p)=>sum+Number(p.probability||0),0);
 function change(next){if(locked)return;setValues(next);onDirtyChange(!sameOdds(original,next))}
 function update(id,n){change(updateOdds(values,id,n))}
 function save(){onSave(values,()=>onDirtyChange(false))}
 return <section className="aw-odds-panel aw-odds-unified"><div className="aw-odds-heading"><div><h2>Phân bổ tỷ lệ trúng</h2><p>Kéo thanh hoặc nhập %. Phần còn lại là không trúng.</p></div><span className="aw-odds-mode">{auto?'Tỷ lệ tự động cũ':'Tỷ lệ tùy chỉnh'}</span></div>
 {auto&&<p className="aw-odds-note"><Info size={16}/> Lưu tỷ lệ bên dưới để chuyển từ cơ chế tự động cũ sang tỷ lệ tùy chỉnh.</p>}
 <div className="aw-odds-summary"><div><span>Tổng tỷ lệ trúng đã đặt</span><strong>{pct(allocated)}</strong></div><div><span>Không trúng</span><strong>{pct(noWin)}</strong></div></div>
 <div className="aw-odds-total-bar" aria-label={'Tỷ lệ trúng '+pct(allocated)+'; không trúng '+pct(noWin)}><span style={{width:allocated/100+'%'}}/></div>
 <div className="aw-odds-tools"><span>{data.prizes.length} phần thưởng · Tỷ lệ trúng đã lưu: {savedWin.toLocaleString('vi-VN',{maximumFractionDigits:2})}%</span><div><button type="button" className="secondary" disabled={locked||!data.prizes.some(available)} onClick={()=>change(equalOdds(data.prizes,allocated||10000))}><Shuffle size={15}/> {allocated?'Chia đều '+pct(allocated):'Chia đều 100%'}</button><button type="button" className="secondary" disabled={locked||allocated===0} onClick={()=>change(equalOdds(data.prizes,0))}><RotateCcw size={15}/> Đặt về 0%</button>{dirty&&<button type="button" className="secondary" disabled={locked} onClick={()=>change(original)}>Hoàn tác</button>}</div></div>
 {unallocated>0&&<p className="aw-odds-warning"><AlertCircle size={17}/> {unallocated} quà khả dụng đang có tỷ lệ 0% và sẽ không được phát nếu lưu cấu hình này.</p>}
 <div className="aw-odds-list">{data.prizes.map(p=>{const value=values[p.id]||0,max=10000-allocated+value,empty=!available(p);return <article className="aw-odds-row" key={p.id}><div className="aw-odds-row-head"><span className="aw-odds-gift">{p.requires_code?<Ticket size={19}/>:<Gift size={19}/>}</span><div><strong>{p.name}</strong><small>{p.unlimited?'Không giới hạn':qty(p.quantity)+' quà còn lại'} · {p.requires_code?'Voucher':'Quà tặng'}</small>{p.requires_code&&<span className={'aw-voucher-state '+(p.effective_quantity<p.quantity?'needs':'complete')}>{p.effective_quantity<p.quantity?'Thiếu '+qty(p.quantity-p.effective_quantity)+' mã':'Đủ mã'}</span>}{empty&&<small className="aw-odds-stock">Hết quà khả dụng</small>}</div><button type="button" className="secondary aw-odds-edit" disabled={locked} onClick={()=>onEdit(p)} aria-label={'Chỉnh sửa '+p.name}><Pencil size={16}/><span>Chỉnh sửa</span></button></div><div className="aw-odds-slider-line"><input className="aw-odds-range" type="range" aria-label={'Kéo tỷ lệ '+p.name} min={0} max={10000} step={1} value={value} disabled={locked} style={{'--odds-fill':value/100+'%'}} onChange={e=>update(p.id,Number(e.target.value))}/><PercentInput name={p.name} value={value} max={max} disabled={locked} onChange={n=>update(p.id,n)}/></div><div className="aw-odds-range-labels"><span>0%</span><span>{max<10000?'Có thể đặt tối đa '+pct(max):'100%'}</span></div>{empty&&value>0&&<small className="aw-odds-stock">Tỷ lệ này chuyển sang không trúng khi hết quà.</small>}</article>})}
 <div className="aw-odds-no-win"><span className="aw-odds-gift"><Clover size={18}/></span><div><strong>Chúc may mắn</strong><small>Tự tính phần tỷ lệ còn lại</small></div><strong>{pct(noWin)}</strong></div></div>
 {unavailable>0&&<p className="aw-odds-warning"><Info size={17}/> {pct(unavailable)} thuộc quà hết hàng. Tỷ lệ không trúng thực tế theo cấu hình này là {pct(noWin+unavailable)}.</p>}
 <p className="aw-odds-note"><Info size={16}/> Tỷ lệ áp dụng độc lập mỗi lượt quay; không bảo đảm số lượt trúng chính xác. Quà hết hàng hoặc khách đã đạt giới hạn trúng sẽ không được phát.</p>
 <div className="aw-odds-footer"><span>{dirty?'Có thay đổi chưa lưu':auto?'Chưa chuyển sang tỷ lệ tùy chỉnh':'Đã lưu tỷ lệ'}</span><button type="button" disabled={locked||(!dirty&&!auto)} onClick={save}><Save size={17}/> Lưu tỷ lệ</button></div></section>
}
