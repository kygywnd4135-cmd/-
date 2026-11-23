'use client';
import {useEffect,useLayoutEffect,useState,type CSSProperties,type ComponentType} from 'react';
import OfficeBanner1 from './OfficeBanner1';
import OfficeBanner2 from './OfficeBanner2';
import OfficeBanner3 from './OfficeBanner3';
import OfficeBanner4 from './OfficeBanner4';

// 탐정 사무소 (gacha) screen. Each banner is a Figma frame converted to code
// (가챠배너 1044:96, 1055:96, 1077:46, 1082:46). Its entrance animation plays once
// when the screen opens or the banner changes. Summoning is not implemented yet.

const BANNERS:{title:string;Scene:ComponentType}[]=[
 {title:'아침이 오지 않는 설국',Scene:OfficeBanner1},
 {title:'마법은 숨겨지지 않아!',Scene:OfficeBanner2},
 {title:'리듬으로 돌아가줘!',Scene:OfficeBanner3},
 {title:'죽음을 먹고 괴물이 되어라',Scene:OfficeBanner4},
];
const NOT_READY='아직 준비 중인 기능이에요.';

// Bottom tab strip: the selected tab is 303px wide, the others 231px, 24px apart from x=80.
function tabRects(selected:number){
 let x=80;
 return BANNERS.map((_,i)=>{const w=i===selected?303:231;const r={left:x,top:930,width:w,height:122};x+=w+24;return r;});
}
type Rect={left:number;top:number;width:number;height:number};
const px=(r:Rect)=>({left:r.left,top:r.top,width:r.width,height:r.height}) as CSSProperties;

export default function CityOffice({onClose,notify}:{onClose:()=>void;notify:(text:string)=>void}){
 const[fit,setFit]=useState<number|null>(null);
 useLayoutEffect(()=>{const m=()=>setFit(Math.min(window.innerWidth/1920,window.innerHeight/1080));m();window.addEventListener('resize',m);return()=>window.removeEventListener('resize',m);},[]);
 const[banner,setBanner]=useState(0);
 // Bumped on every entry/switch so the banner remounts and its animation replays once.
 const[play,setPlay]=useState(0);
 const select=(i:number)=>{if(i===banner)return;setBanner(i);setPlay(n=>n+1);};

 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();onClose();}
   else if(e.key==='ArrowRight'){e.preventDefault();setBanner(b=>{const n=(b+1)%BANNERS.length;setPlay(p=>p+1);return n;});}
   else if(e.key==='ArrowLeft'){e.preventDefault();setBanner(b=>{const n=(b+BANNERS.length-1)%BANNERS.length;setPlay(p=>p+1);return n;});}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[onClose]);

 const {Scene}=BANNERS[banner];
 const tabs=tabRects(banner);
 const soon=()=>notify(NOT_READY);
 return <section className={'office-screen'+(fit===null?' is-measuring':'')} style={{'--office-scale':fit??1} as CSSProperties} role="dialog" aria-modal="true" aria-label={'탐정 사무소 · '+BANNERS[banner].title}>
  <div className="office-stage">
   <div className="office-scene" key={banner+'-'+play}><Scene/></div>
   <button className="office-hit" style={px({left:14,top:18,width:300,height:66})} aria-label="뒤로가기" onClick={onClose}/>
   <button className="office-hit" style={px({left:1329,top:25,width:290,height:60})} aria-label="재화 충전" onClick={soon}/>
   <button className="office-hit" style={px({left:1650,top:28,width:60,height:52})} aria-label="우편함" onClick={soon}/>
   <button className="office-hit" style={px({left:1744,top:28,width:54,height:52})} aria-label="설정" onClick={soon}/>
   <button className="office-hit" style={px({left:1826,top:28,width:56,height:52})} aria-label="메인 로비로 돌아가기" onClick={onClose}/>
   <button className="office-hit" style={px({left:36,top:720,width:263,height:60})} aria-label="확률정보 확인" onClick={soon}/>
   <button className="office-hit" style={px({left:36,top:807,width:263,height:60})} aria-label="뽑기 기록 확인" onClick={soon}/>
   {tabs.map((r,i)=><button key={i} className={'office-hit'+(i===banner?' is-current':'')} style={px(r)} aria-label={BANNERS[i].title} aria-current={i===banner?'true':undefined} onClick={()=>select(i)}/>)}
   <button className="office-hit" style={px({left:1282,top:921,width:301,height:146})} aria-label="1회 소환" onClick={soon}/>
   <button className="office-hit" style={px({left:1598,top:921,width:301,height:146})} aria-label="10회 연속 소환" onClick={soon}/>
  </div>
 </section>;
}
