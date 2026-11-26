'use client';
import {useState,useEffect,useRef} from 'react';
import {Download,LoaderCircle} from 'lucide-react';
export default function PlayerExport({campaign,slug,token,total}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),ref=useRef(null);
 useEffect(()=>()=>ref.current?.abort(),[]);
 async function download(){if(busy)return;const ctrl=new AbortController();ref.current=ctrl;setBusy(true);setError('');
 try{const res=await fetch('/api/admin/export-players?campaign='+campaign,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:ctrl.signal});if(!res.ok){const d=await res.json().catch(()=>({}));throw Error(d.error||'Không xuất được danh sách.')}const blob=await res.blob();if(ctrl.signal.aborted)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='luckydraw-'+slug+'-'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
 catch(e){if(!ctrl.signal.aborted)setError(e.message||'Không xuất được danh sách.')}finally{if(!ctrl.signal.aborted)setBusy(false)}}
 return <div><button type="button" onClick={download} disabled={busy||!total}>{busy?<LoaderCircle size={18} className="spin-loader"/>:<Download size={18}/>} {busy?'Đang xuất…':'Xuất Excel'}</button>{error&&<p role="alert" className="aw-message error">{error}</p>}</div>
}
