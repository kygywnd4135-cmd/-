'use client';
import {memo,useEffect,useLayoutEffect,useRef,useState,type CSSProperties,type ComponentType} from 'react';
import EventBanner1 from './EventBanner1';
import EventBanner2 from './EventBanner2';

// 이벤트 popup over the lobby. Banners are Figma frames converted to code
// (이벤트배너1 1129:69, 이벤트배너2 1141:208). The third event's banner is not designed yet.

// card: Figma's own render of the banner card, laid over the converted layers where the
// export is inexact (banner 2: mis-measured mask offsets, and its dithered ribbon shader
// needs WebGPU + HTML-in-Canvas that browsers do not ship yet).
type Card={src:string;left:number;top:number;width:number;height:number};
const BANNERS:{title:string;Banner:ComponentType;card?:Card}[]=[
 {title:'시즌 1 TOP 50 스페셜 스킨 이벤트',Banner:EventBanner1},
 {title:'시즌 1 한정 레전드리 가챠 이벤트',Banner:EventBanner2,card:{src:'/assets/event/b2/card-still.webp',left:133,top:127,width:1654,height:669}},
];
const THIRD_TITLE='시즌 1 스토리 회고록 : 저 너머의 그대에게';
const GLITCH_MS=500,SWAP_AT_MS=220,CLOSE_MS=320;
const NOT_READY='아직 준비 중인 이벤트예요.';

// Keep banner art out of the lobby's polling re-renders.
const BannerHost=memo(function BannerHost({index}:{index:number}){const {Banner,card}=BANNERS[index];return <><Banner/>{card&&<img className="event-card-still" src={card.src} alt="" draggable={false} style={{left:card.left,top:card.top,width:card.width,height:card.height}}/>}</>;});
type Rect={left:number;top:number;width:number;height:number};
const px=(r:Rect)=>({left:r.left,top:r.top,width:r.width,height:r.height}) as CSSProperties;
const reducedMotion=()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function CityEvents({onClose,notify}:{onClose:()=>void;notify:(text:string)=>void}){
 const[fit,setFit]=useState<number|null>(null);
 useLayoutEffect(()=>{const m=()=>setFit(Math.min(window.innerWidth/1920,window.innerHeight/1080));m();window.addEventListener('resize',m);return()=>window.removeEventListener('resize',m);},[]);
 const[shown,setShown]=useState(0),[target,setTarget]=useState(0),[glitching,setGlitching]=useState(false),[closing,setClosing]=useState(false);
 const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);

 function go(index:number){
  const next=(index+BANNERS.length)%BANNERS.length;
  if(next===target||glitching||closing)return;
  setTarget(next);
  if(reducedMotion()){setShown(next);return;}
  setGlitching(true);
  timers.current.push(setTimeout(()=>setShown(next),SWAP_AT_MS));
  timers.current.push(setTimeout(()=>setGlitching(false),GLITCH_MS));
 }
 function close(){
  if(closing)return;
  if(reducedMotion()){onClose();return;}
  setClosing(true);timers.current.push(setTimeout(onClose,CLOSE_MS));
 }
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close();}
   else if(e.key==='ArrowRight'){e.preventDefault();go(target+1);}
   else if(e.key==='ArrowLeft'){e.preventDefault();go(target-1);}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });

 const thumbs:Rect[]=[133,508,883].map(left=>({left,top:813,width:358,height:207}));
 return <section className={'event-screen'+(fit===null?' is-measuring':'')+(closing?' is-closing':'')} style={{'--event-scale':fit??1} as CSSProperties} role="dialog" aria-modal="true" aria-label={'이벤트 · '+BANNERS[target].title} onClick={e=>{if(e.target===e.currentTarget)close();}}>
  <div className="event-stage">
   <div className={'event-content'+(glitching?' is-glitching':'')}>
    <div className="event-banner"><BannerHost index={shown}/></div>
    <button className="event-hit" style={px({left:36,top:26,width:205,height:62})} aria-label="이벤트 닫기" onClick={close}/>
    <button className="event-hit" style={px({left:38,top:410,width:70,height:105})} aria-label="이전 이벤트" onClick={()=>go(target-1)}/>
    <button className="event-hit" style={px({left:1812,top:410,width:70,height:105})} aria-label="다음 이벤트" onClick={()=>go(target+1)}/>
    {BANNERS.map((b,i)=><button key={i} className={'event-hit'+(i===target?' is-current':'')} style={px(thumbs[i])} aria-label={b.title} aria-current={i===target?'true':undefined} onClick={()=>go(i)}/>)}
    <button className="event-hit" style={px(thumbs[2])} aria-label={THIRD_TITLE} onClick={()=>notify(NOT_READY)}/>
   </div>
  </div>
 </section>;
}
