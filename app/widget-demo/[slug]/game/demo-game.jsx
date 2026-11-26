'use client';
import {useEffect,useState} from 'react';
import Home from '../../../game-client';
export default function DemoGame({slug}){
 const [data,setData]=useState(null),[failed,setFailed]=useState(false),[origin,setOrigin]=useState(null);
 useEffect(()=>{const ctrl=new AbortController();setOrigin(window.location.origin);fetch('/api/game?campaign='+encodeURIComponent(slug),{signal:ctrl.signal,cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(!d.settings||!Array.isArray(d.prizes))throw Error();setData({...d,interactive:true})}).catch(e=>{if(e.name!=='AbortError')setFailed(true)});return()=>ctrl.abort()},[slug]);
 if(failed)return <p style={{padding:24}}>Không tải được chiến dịch mẫu.</p>;
 if(!data)return <p style={{padding:24}}>Đang tải bản xem thử…</p>;
 return <Home key={slug} campaignSlug={slug} preview={data} embedded parentOrigin={origin}/>
}
