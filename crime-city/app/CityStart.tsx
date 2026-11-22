'use client';
import {useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';

// Start screen from Figma "메인화면" (961:3, signed out) and "메인화면2" (1098:79, signed in):
// one 1920 x 1080 canvas scaled as a whole.
type Props={
 scale:number;
 loaded:boolean;
 signedIn:boolean;
 onSignup:()=>void;
 onEnter:()=>void;
 onLogin:()=>void;
};

const VOLUME_KEY='crime-start-bgm-volume',MUTED_KEY='crime-start-bgm-muted';
const DEFAULT_VOLUME=40;
const GLITCH_MS=420,DOUBLE_CLICK_MS=260;

function readNumber(key:string,fallback:number){try{const raw=localStorage.getItem(key);if(raw===null)return fallback;const n=Number(raw);return Number.isFinite(n)?Math.min(100,Math.max(0,n)):fallback;}catch{return fallback;}}
function readFlag(key:string){try{return localStorage.getItem(key)==='1';}catch{return false;}}
function save(key:string,value:string){try{localStorage.setItem(key,value);}catch{}}
const reducedMotion=()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const PROMPT=-1;
// Keys that should not count as "any key".
const IGNORED_KEYS=new Set(['Shift','Control','Alt','Meta','CapsLock','Tab','Escape','Fn','Process','Unidentified']);

export default function CityStart({scale,loaded,signedIn,onSignup,onEnter,onLogin}:Props){
 const buttons=[
  {label:'회원가입',run:onSignup},
  {label:'로그인',run:onLogin},
 ];
 const[selected,setSelected]=useState(1),[glitch,setGlitch]=useState<number|null>(null);
 const[volume,setVolume]=useState(DEFAULT_VOLUME),[muted,setMuted]=useState(false),[sliderOpen,setSliderOpen]=useState(false);
 const audio=useRef<HTMLAudioElement|null>(null),clickTimer=useRef<ReturnType<typeof setTimeout>|null>(null),glitchTimer=useRef<ReturnType<typeof setTimeout>|null>(null),soundWrap=useRef<HTMLDivElement>(null);
 const busy=glitch!==null;
 // Measure the window before the first paint so the canvas never flashes at full size.
 const[fit,setFit]=useState<number|null>(null);
 useLayoutEffect(()=>{const measure=()=>setFit(Math.min(window.innerWidth/1920,window.innerHeight/1080));measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[]);

 // Background music: browsers only allow sound after the first interaction, so retry on the first input.
 useEffect(()=>{
  const v=readNumber(VOLUME_KEY,DEFAULT_VOLUME),m=readFlag(MUTED_KEY);setVolume(v);setMuted(m);
  const el=new Audio('/audio/start-theme.mp3');el.loop=true;el.preload='none';el.volume=v/100;el.muted=m;audio.current=el;
  const start=()=>{el.play().then(()=>remove()).catch(()=>{});};
  const remove=()=>{window.removeEventListener('pointerdown',start);window.removeEventListener('keydown',start);};
  window.addEventListener('pointerdown',start);window.addEventListener('keydown',start);
  start();
  return()=>{remove();el.pause();el.src='';audio.current=null;if(clickTimer.current)clearTimeout(clickTimer.current);if(glitchTimer.current)clearTimeout(glitchTimer.current);};
 },[]);
 useEffect(()=>{const el=audio.current;if(!el)return;el.volume=volume/100;el.muted=muted;},[volume,muted]);

 // Close the slider on an outside click or ESC.
 useEffect(()=>{if(!sliderOpen)return;const down=(e:PointerEvent)=>{if(!soundWrap.current?.contains(e.target as Node))setSliderOpen(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setSliderOpen(false);};window.addEventListener('pointerdown',down);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',down);window.removeEventListener('keydown',key);};},[sliderOpen]);

 function changeVolume(v:number){setVolume(v);save(VOLUME_KEY,String(v));if(muted&&v>0){setMuted(false);save(MUTED_KEY,'0');}}
 function toggleMute(){setMuted(m=>{save(MUTED_KEY,m?'0':'1');return!m;});}
 // One click opens the drag slider; a second click within DOUBLE_CLICK_MS toggles mute instead.
 function soundClick(){
  audio.current?.play().catch(()=>{});
  if(clickTimer.current){clearTimeout(clickTimer.current);clickTimer.current=null;toggleMute();return;}
  clickTimer.current=setTimeout(()=>{clickTimer.current=null;setSliderOpen(o=>!o);},DOUBLE_CLICK_MS);
 }

 function activate(index:number){
  if(busy||glitchTimer.current)return;
  const run=index===PROMPT?onEnter:buttons[index].run;
  if(index!==PROMPT)setSelected(index);
  if(reducedMotion()){run();return;}
  setGlitch(index);
  glitchTimer.current=setTimeout(()=>{glitchTimer.current=null;setGlitch(null);run();},GLITCH_MS);
 }
 const ready=loaded&&fit!==null,promptMode=ready&&signedIn;

 useEffect(()=>{
  function key(e:KeyboardEvent){
   const target=e.target as HTMLElement;
   if(['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.closest('[role="dialog"]')||target.closest('.start-sound'))return;
   if(promptMode){if(!e.repeat&&!IGNORED_KEYS.has(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();activate(PROMPT);}return;}
   if(!ready)return;
   if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setSelected(n=>(n+(e.key==='ArrowRight'?1:-1)+2)%2);}
   else if(e.key==='Enter'&&!e.repeat&&!target.closest('button')){e.preventDefault();activate(selected);}
  }
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });

 const silent=muted||volume===0;
 return <section className={'start-screen'+(busy?' is-glitching':'')+(fit===null?' is-measuring':'')+(promptMode?' is-prompt':'')} style={{'--start-scale':fit??scale} as CSSProperties} onClick={e=>{if(promptMode&&!(e.target as HTMLElement).closest('.start-sound'))activate(PROMPT);}}>
  <div className="start-stage">
   <img className="start-background" src="/assets/start/background.jpg" alt="" draggable={false}/>
   <div className="start-shade" aria-hidden="true"/>
   <h1 className="start-logo"><img src="/assets/start/logo.webp" alt="Crime City" draggable={false}/></h1>
   <p className="start-subtitle">온라인 머더 미스터리 플랫폼</p>
   <div className="start-season"><img src="/assets/start/season-logo.webp" alt="죽음이 피어오르는 도시" draggable={false}/></div>
   <p className="start-season-number">SEASON.01</p>
   {promptMode?<>
    <img className="start-line-left" src="/assets/start/line-left.svg" alt="" aria-hidden="true" draggable={false}/>
    <img className="start-line-right" src="/assets/start/line-right.svg" alt="" aria-hidden="true" draggable={false}/>
    <button type="button" className={'start-prompt'+(glitch===PROMPT?' is-glitch':'')} data-label="아무 키를 눌러 서버 입장" onClick={e=>{e.stopPropagation();activate(PROMPT);}}><span>아무 키를 눌러 서버 입장</span></button>
   </>:<>
    <img className="start-line" src="/assets/start/line.svg" alt="" aria-hidden="true" draggable={false}/>
    {ready?<nav className="start-menu" aria-label="시작 메뉴">
     {buttons.map((b,i)=><button key={i} type="button" className={'start-button slot-'+i+(selected===i?' is-selected':'')+(glitch===i?' is-glitch':'')} data-label={b.label} aria-current={selected===i?'true':undefined} onMouseEnter={()=>!busy&&setSelected(i)} onFocus={()=>!busy&&setSelected(i)} onClick={()=>activate(i)}>
      <img className="start-button-shape" src={selected===i?'/assets/start/button-active.svg':'/assets/start/button.svg'} alt="" aria-hidden="true" draggable={false}/>
      <span className="start-button-label">{b.label}</span>
     </button>)}
    </nav>:<p className="start-connecting">서버에 연결하는 중…</p>}
   </>}
   <ul className="start-notice"><li>일부 컨텐츠는 AI로 생성되었습니다.</li></ul>
   <p className="start-version">버전 : 1.0.1</p>
   <div className="start-sound" ref={soundWrap}>
    <button type="button" className={'start-sound-button'+(silent?' is-muted':'')} aria-label={silent?'배경 음악 꺼짐 · 한 번 눌러 음량 조절, 두 번 눌러 음소거 해제':'배경 음악 음량 · 한 번 눌러 음량 조절, 두 번 눌러 음소거'} aria-expanded={sliderOpen} onClick={soundClick}>
     <img src="/assets/start/volume-icon.png" alt="" draggable={false}/>
    </button>
    {sliderOpen&&<div className="start-sound-panel">
     <input type="range" min={0} max={100} step={1} value={muted?0:volume} aria-label="배경 음악 음량" onChange={e=>changeVolume(Number(e.target.value))} style={{'--fill':(muted?0:volume)+'%'} as CSSProperties}/>
     <span>{muted?'음소거':volume+'%'}</span>
    </div>}
   </div>
  </div>
 </section>;
}
