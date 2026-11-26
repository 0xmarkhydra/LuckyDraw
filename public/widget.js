/* LuckyDraw Widget v2 - async, isolated, no personal data sent to host. */
(function(){
 'use strict';
 const script=document.currentScript;if(!script)return;
 const base=new URL(script.src).origin,slug=script.dataset.campaign,mode=script.dataset.mode||'floating';
 if(!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug||'')||!['floating','popup','inline'].includes(mode))return;
 const position=script.dataset.position==='bottom-left'?'bottom-left':'bottom-right';
 const launcherStyle=['pill','icon','tab'].includes(script.dataset.launcher)?script.dataset.launcher:'pill';
 const delay=Math.min(60,Math.max(0,Number(script.dataset.delay||3)||0))*1000;
 const demo=script.dataset.preview==='true'&&window.location.origin===base&&window.location.pathname.startsWith('/widget-demo/');
 const endpoint=base+'/api/widget/'+encodeURIComponent(slug);
 const registry=window.__luckydrawWidgets||(window.__luckydrawWidgets=new Set());
 const registryKey=slug+':'+mode+':'+(script.dataset.target||'');if(registry.has(registryKey))return;registry.add(registryKey);
 const autoKey='luckydraw:popup-seen:'+slug;
 function autoSeen(){if(demo)return false;try{return sessionStorage.getItem(autoKey)==='1'}catch{return false}}
 function markSeen(){if(!demo)try{sessionStorage.setItem(autoKey,'1')}catch{}}
 let host,root,launcher,dialog,frame,token,tokenIssuedAt=0,opened=false,active=false,impression=null,openedToken=null,polling=false,popupTimer,hasAutoOpened=false,previousFocus=null;
 /* LUCIDE_ICONS_START */
 const libraryIcons={"gift":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-gift\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 7v14\"></path><path d=\"M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8\"></path><path d=\"M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5\"></path><rect x=\"3\" y=\"7\" width=\"18\" height=\"4\" rx=\"1\"></rect></svg>","close":"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg>"};
 /* LUCIDE_ICONS_END */
 function libraryIcon(name){const icon=new DOMParser().parseFromString(libraryIcons[name],'image/svg+xml').documentElement;return document.importNode(icon,true)}
 function create(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e}
 async function event(type,withToken){if(demo)return;try{await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({token:withToken,event:type})})}catch{}}
 function frameElement(){const f=create('iframe','ld-frame');f.title='Minigame LuckyDraw';f.src=demo?base+'/widget-demo/'+encodeURIComponent(slug)+'/game':base+'/embed/'+encodeURIComponent(slug)+'?token='+encodeURIComponent(token);f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');f.setAttribute('allow','clipboard-write');f.referrerPolicy='no-referrer';return f}
 function close(){if(!opened)return;opened=false;dialog.close();launcher.hidden=!active;launcher.setAttribute('aria-expanded','false');if(previousFocus?.isConnected)previousFocus.focus();else launcher.focus()}
 function open(){if(!active||opened||!token)return;if(!demo&&Date.now()-tokenIssuedAt>20*3600000){void refresh(true);return}clearTimeout(popupTimer);hasAutoOpened=true;markSeen();opened=true;previousFocus=document.activeElement;launcher.setAttribute('aria-expanded','true');if(!frame){frame=frameElement();dialog.querySelector('.ld-body').append(frame)}dialog.showModal();if(openedToken!==token){openedToken=token;Promise.resolve(impression).then(()=>event('open',openedToken))}}
 function build(){
  host=create('div');host.setAttribute('data-luckydraw',slug);root=host.attachShadow({mode:'open'});
  const style=create('style');style.textContent=`
   :host{all:initial;font-family:Roboto,Arial,sans-serif;color:#431823;display:block}
   *{box-sizing:border-box}[hidden]{display:none!important}
   .ld-launch{position:fixed;bottom:max(22px,calc(env(safe-area-inset-bottom) + 10px));${position==='bottom-left'?'left':'right'}:20px;z-index:2147483000;border:1px solid #e7c785;background:#9d2940;color:#fffaf2;font:650 14px Roboto,Arial,sans-serif;box-shadow:0 6px 24px #37152535;border-radius:999px;min-height:52px;padding:7px 17px 7px 8px;cursor:pointer;display:flex;align-items:center;gap:9px;transition:transform .18s,box-shadow .18s}
   .ld-launch:hover{transform:translateY(-2px);box-shadow:0 9px 28px #37152545}.ld-launch:focus-visible,.ld-close:focus-visible{outline:3px solid #e8c77e;outline-offset:3px}
   .ld-launch-icon{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:#f3e3b3;color:#92243b;flex:none}.ld-launch-icon svg{width:21px;height:21px}.ld-launch-copy{display:grid;text-align:left;gap:2px;line-height:1.15}.ld-launch-copy small{font-size:10px;color:#f3d7d8;font-weight:400}
   .ld-launch.is-icon{width:54px;height:54px;padding:7px;justify-content:center}.ld-launch.is-icon .ld-launch-copy{display:none}.ld-launch.is-tab{bottom:auto;top:55%;${position==='bottom-left'?'left':'right'}:0;border-radius:${position==='bottom-left'?'0 14px 14px 0':'14px 0 0 14px'};padding:8px;flex-direction:column;gap:6px}.ld-launch.is-tab .ld-launch-copy{writing-mode:vertical-rl;text-orientation:mixed}.ld-launch.is-tab .ld-launch-copy small{display:none}
   .ld-dialog{position:fixed;inset:0;margin:auto;padding:0;border:1px solid #ffffff35;width:min(560px,calc(100vw - 32px));height:min(760px,calc(100dvh - 48px));max-width:none;max-height:none;border-radius:24px;background:#9d2940;overflow:hidden;box-shadow:0 24px 80px #23101965;color:#fff8ed}
   .ld-dialog[open]{animation:ld-appear .22s ease-out}.ld-dialog::backdrop{background:#23101b88;backdrop-filter:blur(2px)}.ld-top{height:46px;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 16px;background:#8e2439;color:#fff8ed;font:600 12px Roboto,Arial,sans-serif;border-bottom:1px solid #ffffff1f}.ld-top-label{display:flex;align-items:center;gap:7px}.ld-top-label svg{width:17px;height:17px;color:#f3e3b3}.ld-close{height:44px;min-width:44px;border:0;border-radius:12px;background:transparent;color:white;display:grid;place-items:center;cursor:pointer;padding:0}.ld-close:hover{background:#ffffff18}
   .ld-body{height:calc(100% - 46px);overflow:hidden;position:relative}.ld-frame{display:block;width:100%;height:100%;border:0;background:#a62a3c}.ld-loading{position:absolute;inset:0;display:grid;place-content:center;text-align:center;font:500 13px Roboto,Arial,sans-serif;color:#fff5df;pointer-events:none}
   .ld-inline{width:100%;max-width:100%;overflow:hidden;border-radius:20px}.ld-inline .ld-frame{height:640px;min-height:360px}
   @keyframes ld-appear{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
   @media(max-width:600px){.ld-dialog{inset:auto 0 0;margin:0;width:100%;height:min(760px,calc(100dvh - 20px));border-radius:24px 24px 0 0;border-bottom:0}.ld-top{height:46px;padding-left:15px}.ld-launch{bottom:max(14px,calc(env(safe-area-inset-bottom) + 8px));${position==='bottom-left'?'left':'right'}:12px;font-size:13px;min-height:48px;padding:6px 13px 6px 6px}.ld-launch-icon{width:34px;height:34px}.ld-launch.is-icon{width:50px;height:50px}.ld-launch.is-tab{padding:7px}.ld-launch.is-tab .ld-launch-icon{width:30px;height:30px}}
   @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;root.append(style);
  if(mode==='inline'){
   const container=create('div','ld-inline');frame=frameElement();container.append(frame);root.append(container);
   let target=null;if(script.dataset.target){try{target=document.querySelector(script.dataset.target)}catch{}}
   if(target)target.append(host);else if(script.parentElement&&script.parentElement!==document.head)script.after(host);else document.body.append(host);
  }else{
   launcher=create('button','ld-launch is-'+launcherStyle);launcher.type='button';launcher.setAttribute('aria-label','Nhận quà ngay');launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-expanded','false');const gift=create('span','ld-launch-icon'),copy=create('span','ld-launch-copy');gift.append(libraryIcon('gift'));copy.append(create('b','','Nhận quà ngay'),create('small','','Thử vận may'));launcher.append(gift,copy);launcher.addEventListener('click',open);
   dialog=create('dialog','ld-dialog');dialog.setAttribute('aria-label','Minigame LuckyDraw');const top=create('div','ld-top'),label=create('span','ld-top-label'),x=create('button','ld-close');label.append(libraryIcon('gift'),create('span','','Ưu đãi dành cho bạn'));x.append(libraryIcon('close'));x.type='button';x.setAttribute('aria-label','Đóng minigame');x.title='Thu gọn minigame';x.addEventListener('click',close);top.append(label,x);dialog.append(top,create('div','ld-body'));dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});root.append(launcher,dialog);document.body.append(host);
  }
  impression=event('impression',token);
  if(mode==='inline'){openedToken=token;Promise.resolve(impression).then(()=>event('open',openedToken))}
 }
 window.addEventListener('message',e=>{if(!frame||e.origin!==base||e.source!==frame.contentWindow||e.data?.type!=='luckydraw:resize'||mode!=='inline')return;const h=Number(e.data.height);if(Number.isFinite(h))frame.style.height=Math.min(3000,Math.max(360,Math.ceil(h)))+'px'});
 async function refresh(reopen=false){if(polling)return;polling=true;try{const response=await fetch(endpoint,{mode:'cors',credentials:'omit',cache:'no-store'});const data=response.ok?await response.json():{active:false};active=!!data.active;if(!active){clearTimeout(popupTimer);if(launcher)launcher.hidden=true;if(mode==='inline'&&host)host.hidden=true;return}
  if(!host){token=data.token;tokenIssuedAt=Date.now();if(!token)return;build()}else{host.hidden=false;if(launcher)launcher.hidden=false;if(mode!=='inline'&&!opened&&Date.now()-tokenIssuedAt>20*3600000&&data.token){if(frame){frame.remove();frame=null}token=data.token;tokenIssuedAt=Date.now();impression=event('impression',token)}}
  if(mode==='popup'&&!hasAutoOpened&&!autoSeen()){hasAutoOpened=true;popupTimer=setTimeout(()=>{if(!document.hidden)open()},delay)}
  if(reopen&&active&&token&&Date.now()-tokenIssuedAt<=20*3600000)open()
 }catch{active=false;if(launcher)launcher.hidden=true;if(mode==='inline'&&host)host.hidden=true}finally{polling=false}}
 function start(){if(demo){active=true;token='demo';build();if(mode==='popup')popupTimer=setTimeout(open,delay);return;}refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();