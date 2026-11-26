/* LuckyDraw Widget v1 - async, isolated, no personal data sent to host. */
(function(){
 'use strict';
 const script=document.currentScript;if(!script)return;
 const base=new URL(script.src).origin,slug=script.dataset.campaign,mode=script.dataset.mode||'floating';
 if(!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug||'')||!['floating','popup','inline'].includes(mode))return;
 const position=script.dataset.position==='bottom-left'?'bottom-left':'bottom-right';
 const delay=Math.min(60,Math.max(0,Number(script.dataset.delay||3)||0))*1000;
 const demo=script.dataset.preview==='true'&&window.location.origin===base&&window.location.pathname.startsWith('/widget-demo/');
 const endpoint=base+'/api/widget/'+encodeURIComponent(slug);
 const registry=window.__luckydrawWidgets||(window.__luckydrawWidgets=new Set());
 const registryKey=slug+':'+mode+':'+(script.dataset.target||'');if(registry.has(registryKey))return;registry.add(registryKey);
 let host,root,launcher,dialog,frame,token,tokenIssuedAt=0,opened=false,active=false,impression=null,openedToken=null,polling=false,popupTimer,hasAutoOpened=false,previousFocus=null;
 /* LUCIDE_ICONS_START */
 const libraryIcons={"gift":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-gift\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 7v14\"></path><path d=\"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\"></path><path d=\"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5\"></path><rect x=\"3\" y=\"7\" width=\"18\" height=\"4\" rx=\"1\"></rect></svg>","close":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg>"};
 /* LUCIDE_ICONS_END */
 function libraryIcon(name){const icon=new DOMParser().parseFromString(libraryIcons[name],'image/svg+xml').documentElement;return document.importNode(icon,true)}
 function create(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}
 async function event(type,withToken){if(demo)return;try{await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({token:withToken,event:type})})}catch{}}
 function frameElement(){const f=create('iframe','ld-frame');f.title='Minigame LuckyDraw';f.src=demo?base+'/widget-demo/'+encodeURIComponent(slug)+'/game':base+'/embed/'+encodeURIComponent(slug)+'?token='+encodeURIComponent(token);f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');f.setAttribute('allow','clipboard-write');f.referrerPolicy='no-referrer';return f}
 function close(){if(!opened)return;opened=false;dialog.close();launcher.hidden=!active;if(previousFocus?.isConnected)previousFocus.focus();else launcher.focus()}
 function open(){if(!active||opened||!token)return;opened=true;previousFocus=document.activeElement;if(!frame){frame=frameElement();dialog.querySelector('.ld-body').append(frame)}dialog.showModal();if(openedToken!==token){openedToken=token;Promise.resolve(impression).then(()=>event('open',openedToken))}}
 function build(){
  host=create('div');host.setAttribute('data-luckydraw',slug);root=host.attachShadow({mode:'open'});
  const style=create('style');style.textContent=`
   :host{all:initial;font-family:Roboto,Arial,sans-serif;color:#431823;display:block}
   *{box-sizing:border-box}[hidden]{display:none!important}
   .ld-launch{position:fixed;bottom:max(20px,env(safe-area-inset-bottom));${position==='bottom-left'?'left':'right'}:20px;z-index:2147483000;border:2px solid #ffdc80;background:#ae2941;color:#fff;font:700 15px Roboto,Arial,sans-serif;box-shadow:0 8px 28px #460c3750;border-radius:999px;min-height:56px;padding:0 20px;cursor:pointer;display:flex;align-items:center;gap:9px}
   .ld-launch svg{width:22px;height:22px;flex-shrink:0}.ld-launch:hover{filter:brightness(1.08)}
   .ld-dialog{padding:0;border:0;width:min(1060px,calc(100vw - 28px));height:min(860px,calc(100dvh - 28px));max-width:none;max-height:none;border-radius:22px;background:#fff8ee;overflow:hidden;box-shadow:0 24px 100px #0007;color:#431823}
   .ld-dialog::backdrop{background:#230b16b8}.ld-top{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#942238;color:#fff;font:700 14px Roboto,Arial,sans-serif}.ld-close{height:40px;width:40px;border:0;border-radius:50%;background:#ffffff26;color:white;display:grid;place-items:center;cursor:pointer;padding:0}
   .ld-body{height:calc(100% - 48px);overflow:hidden}.ld-frame{display:block;width:100%;height:100%;border:0;background:#a30d29}
   .ld-inline{width:100%;overflow:hidden;border-radius:20px}.ld-inline .ld-frame{height:940px;min-height:360px}
   @media(max-width:600px){.ld-dialog{width:calc(100vw - 12px);height:calc(100dvh - 12px);border-radius:16px}.ld-launch{bottom:max(14px,env(safe-area-inset-bottom));${position==='bottom-left'?'left':'right'}:12px;font-size:13px;min-height:50px;padding:0 14px}}
   @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;root.append(style);
  if(mode==='inline'){
   const container=create('div','ld-inline');frame=frameElement();container.append(frame);root.append(container);
   let target=null;if(script.dataset.target){try{target=document.querySelector(script.dataset.target)}catch{}}
   if(target)target.append(host);else if(script.parentElement&&script.parentElement!==document.head)script.after(host);else document.body.append(host);
  }else{
   launcher=create('button','ld-launch');launcher.type='button';launcher.append(libraryIcon('gift'),create('b','','Nhận quà ngay'));launcher.addEventListener('click',open);
   dialog=create('dialog','ld-dialog');dialog.setAttribute('aria-label','Minigame LuckyDraw');const top=create('div','ld-top'),label=create('span','','Vòng quay may mắn'),x=create('button','ld-close');x.append(libraryIcon('close'));x.type='button';x.setAttribute('aria-label','Đóng minigame');x.addEventListener('click',close);top.append(label,x);dialog.append(top,create('div','ld-body'));dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});root.append(launcher,dialog);document.body.append(host);
  }
  impression=event('impression',token);
  if(mode==='inline'){openedToken=token;Promise.resolve(impression).then(()=>event('open',openedToken))}
 }
 window.addEventListener('message',e=>{if(!frame||e.origin!==base||e.source!==frame.contentWindow||e.data?.type!=='luckydraw:resize'||mode!=='inline')return;const h=Number(e.data.height);if(Number.isFinite(h))frame.style.height=Math.min(3000,Math.max(360,Math.ceil(h)))+'px'});
 async function refresh(){if(polling)return;polling=true;try{const response=await fetch(endpoint,{mode:'cors',credentials:'omit',cache:'no-store'});const data=response.ok?await response.json():{active:false};active=!!data.active;if(!active){clearTimeout(popupTimer);if(launcher)launcher.hidden=true;if(mode==='inline'&&host)host.hidden=true;return}
  if(!host){token=data.token;tokenIssuedAt=Date.now();if(!token)return;build()}else{host.hidden=false;if(launcher)launcher.hidden=false;if(!frame&&Date.now()-tokenIssuedAt>20*3600000){token=data.token;tokenIssuedAt=Date.now();impression=event('impression',token)}}
  if(mode==='popup'&&!hasAutoOpened){hasAutoOpened=true;popupTimer=setTimeout(open,delay)}
 }catch{active=false;if(launcher)launcher.hidden=true;if(mode==='inline'&&host)host.hidden=true}finally{polling=false}}
 function start(){if(demo){active=true;token='demo';build();if(mode==='popup')popupTimer=setTimeout(open,delay);return;}refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();