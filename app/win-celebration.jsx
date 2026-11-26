'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import confetti from 'canvas-confetti';

export default function WinCelebration(){
 const [mounted,setMounted]=useState(false),canvas=useRef(null);
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>{
  if(!mounted||!canvas.current||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const fire=confetti.create(canvas.current,{resize:true,useWorker:false,disableForReducedMotion:true});
  const colors=['#D9A441','#F6DFA2','#FFF7E6','#B52A43','#E5A3AF'];
  const compact=window.innerWidth<600;
  const base={colors,disableForReducedMotion:true,zIndex:110};
  const timers=[];
  const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
  const cannons=()=>{for(const side of [0,1])fire({...base,particleCount:compact?38:65,angle:side?135:45,spread:58,startVelocity:compact?38:52,gravity:.95,decay:.92,ticks:170,scalar:compact?.8:1,origin:{x:side?.98:.02,y:.78}})};
  const burst=(x,y)=>fire({...base,particleCount:compact?30:48,spread:360,startVelocity:compact?19:29,gravity:.55,decay:.91,ticks:105,scalar:.75,origin:{x,y}});
  cannons();
  later(()=>burst(.19,.24),240);
  later(()=>burst(.81,.29),500);
  later(()=>burst(.5,.15),850);
  later(()=>{for(const x of [.18,.82])fire({...base,particleCount:compact?18:28,angle:x<.5?65:115,spread:70,startVelocity:compact?24:34,gravity:.85,ticks:145,scalar:.8,origin:{x,y:.68}})},1100);
  return()=>{timers.forEach(clearTimeout);fire.reset()};
 },[mounted]);
 if(!mounted)return null;
 return createPortal(<canvas ref={canvas} className="win-celebration-canvas" aria-hidden="true"/>,document.body);
}
