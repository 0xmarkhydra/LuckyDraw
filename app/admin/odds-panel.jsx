'use client';
import {useState} from 'react';
import {Gift,Clover,Save,Info} from 'lucide-react';
const pct=n=>(n/100).toLocaleString('vi-VN',{maximumFractionDigits:2})+'%';
function initial(data){let left=10000;return Object.fromEntries(data.prizes.map(p=>{const raw=data.settings.manual_odds===null||data.settings.manual_odds===undefined?Math.floor(Number(p.probability)*100+1e-7):Number(data.settings.manual_odds[p.id]||0);const n=Math.max(0,Math.min(left,raw));left-=n;return [p.id,n]}))}
export default function OddsPanel({data,busy,onSave,onDirtyChange}){
 const [values,setValues]=useState(()=>initial(data)),[dirty,setDirty]=useState(false);
 const auto=data.settings.manual_odds==null,locked=busy||data.settings.active,allocated=Object.values(values).reduce((a,b)=>a+b,0),noWin=10000-allocated;
 const unavailable=data.prizes.reduce((sum,p)=>sum+(!p.unlimited&&Number(p.effective_quantity||0)<=0?(values[p.id]||0):0),0);
 function update(id,n){if(locked||!Number.isFinite(n))return;const max=10000-allocated+(values[id]||0);setValues(prev=>({...prev,[id]:Math.round(Math.max(0,Math.min(max,n)))}));setDirty(true);onDirtyChange(true)}
 function save(){onSave(values,()=>{setDirty(false);onDirtyChange(false)})}
 return <section className="aw-odds-panel"><div className="aw-odds-heading"><div><h2>Phân bổ tỷ lệ trúng</h2><p>Kéo thanh hoặc nhập tỷ lệ cho từng quà. Phần còn lại là không trúng.</p></div><span className="aw-odds-mode">{auto?'Tỷ lệ tự động cũ':'Tỷ lệ tùy chỉnh'}</span></div>
 {auto&&<p className="aw-odds-note"><Info size={16}/> Đang dùng tỷ lệ tự động cũ. Lưu tỷ lệ bên dưới để chuyển sang tỷ lệ do bạn quyết định.</p>}
 <div className="aw-odds-summary"><div><span>Tổng tỷ lệ trúng đã đặt</span><strong>{pct(allocated)}</strong></div><div><span>Không trúng</span><strong>{pct(noWin)}</strong></div></div>
 <div className="aw-odds-total-bar" aria-label={'Tỷ lệ trúng '+pct(allocated)+'; không trúng '+pct(noWin)}><span style={{width:allocated/100+'%'}}/></div>
 <div className="aw-odds-list">{data.prizes.map(p=>{const value=values[p.id]||0,max=10000-allocated+value,empty=!p.unlimited&&Number(p.effective_quantity||0)<=0;return <div className="aw-odds-row" key={p.id}><div className="aw-odds-row-head"><span className="aw-odds-gift"><Gift size={18}/></span><div><strong>{p.name}</strong><small>{empty?'Hết quà khả dụng':p.unlimited?'Không giới hạn':Number(p.effective_quantity).toLocaleString('vi-VN')+' quà khả dụng'}</small></div><label className="aw-odds-number"><input type="number" min="0" max={max/100} step=".01" inputMode="decimal" aria-label={'Tỷ lệ '+p.name} value={value/100} disabled={locked} onChange={e=>update(p.id,Number(e.target.value)*100)}/><span>%</span></label></div><input className="aw-odds-range" type="range" aria-label={'Kéo tỷ lệ '+p.name} min={0} max={10000} step={1} value={value} disabled={locked} style={{'--odds-fill':value/100+'%'}} onChange={e=>update(p.id,Number(e.target.value))}/><div className="aw-odds-range-labels"><span>0%</span><span>{max<10000?'Có thể đặt tối đa '+pct(max):'100%'}</span></div>{empty&&value>0&&<small className="aw-odds-stock">Tỷ lệ này chuyển sang không trúng khi hết quà.</small>}</div>})}
 <div className="aw-odds-no-win"><span className="aw-odds-gift"><Clover size={18}/></span><div><strong>Chúc may mắn</strong><small>Tự tính phần tỷ lệ còn lại</small></div><strong>{pct(noWin)}</strong></div></div>
 {unavailable>0&&<p className="aw-odds-note"><Info size={16}/> Hiện có {pct(unavailable)} thuộc quà hết hàng. Tỷ lệ không trúng thực tế là {pct(noWin+unavailable)}.</p>}
 <p className="aw-odds-note"><Info size={16}/> Tỷ lệ áp dụng độc lập cho mỗi lượt quay, không bảo đảm số lượt trúng chính xác. Quà hết hàng hoặc khách đã đạt giới hạn trúng sẽ không được phát.</p>
 <div className="aw-odds-footer"><span>{dirty?'Có thay đổi chưa lưu':auto?'Chưa chuyển sang tỷ lệ tùy chỉnh':'Đã lưu tỷ lệ'}</span><button type="button" disabled={locked||(!dirty&&!auto)} onClick={save}><Save size={17}/> Lưu tỷ lệ</button></div></section>
}
