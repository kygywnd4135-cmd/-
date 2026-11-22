'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type CSSProperties} from 'react';
import {DialogueBox,DialogueConfirm,SkipButton,type Speaker} from './CityDialogue';
import CityNickname from './CityNickname';

// First-entry story (Figma 스토리1 1102:111, 스토리2 1102:114). Shown to a new account
// before its first nickname exists; the nickname is chosen inside the conversation.

const STRANGER:Speaker={name:'???',title:'정체모를 누군가'};
const RAVEN:Speaker={name:'레이븐',title:'정보 상인단 대장'};
type Line={scene:1|2;speaker:Speaker;text:(nickname:string)=>string;reveal?:boolean;askName?:boolean};
const LINES:Line[]=[
 {scene:1,speaker:STRANGER,text:()=>'흐흥.. 안녕? 처음보는 얼굴인데.. 이 도시가 어떤 곳인지는 알고 혼자 돌아다니고 있는거야?'},
 {scene:1,speaker:STRANGER,text:()=>'모른다구..?! 이곳은 크라임 시티. 모든 차원의 범죄 이야기가 모여드는 경계속에 숨어있는 도시지. 이런 곳을 잘도 찾아왔네..'},
 {scene:1,speaker:RAVEN,reveal:true,askName:true,text:()=>'내 이름은 레이븐이야. 도시에 숨어드는 모든 사람들은 나를 거쳐가게 되어있지. 하하하! 큼큼.. 아무튼. 너는 이름이 뭐니?'},
 {scene:1,speaker:RAVEN,text:n=>`${n} 이라.. 어디서 많이 들어본 이름인걸? 너 설마..세간에 소문난, 그 탐정인가?`},
 {scene:1,speaker:RAVEN,text:()=>"귀한 사람을 모시게 되었는걸.. 좋아! 이제부터 널 '탐정'이라고 부를게. 이 도시에선 모두가 너를 탐정이라고 부르게 될거야."},
 {scene:2,speaker:RAVEN,text:()=>'이곳으로 끌려왔다는건, 분명 너도 실력있는 탐정이라는 뜻이겠지?'},
 {scene:2,speaker:RAVEN,text:()=>'너의 추리 실력을 마음껏 뽐내보라고, 탐정! 이 도시에선 뭐든지 허용되니까 말이야. 후후훗... 응원하고있겠어!'},
];
const TYPE_MS=32,FADE_IN_MS=1100,FADE_OUT_MS=1100,GLITCH_MS=700;
const IGNORED_KEYS=new Set(['Shift','Control','Alt','Meta','CapsLock','Tab','Fn','Process','Unidentified']);
const reducedMotion=()=>typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Props={user:any;onNamed:(nickname:string)=>void;onComplete:()=>void};

export default function CityStory({user,onNamed,onComplete}:Props){
 const[fit,setFit]=useState<number|null>(null);
 useLayoutEffect(()=>{const measure=()=>setFit(Math.min(window.innerWidth/1920,window.innerHeight/1080));measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);},[]);
 const[index,setIndex]=useState(0),[shown,setShown]=useState(0),[scene,setScene]=useState<1|2>(1);
 const[phase,setPhase]=useState<'fade-in'|'play'|'glitch'|'fade-out'>('fade-in');
 const[naming,setNaming]=useState(false),[confirmSkip,setConfirmSkip]=useState(false),[skipping,setSkipping]=useState(false);
 const[nickname,setNickname]=useState<string>(user?.nicknameSet?user.nickname:'');
 const timers=useRef<ReturnType<typeof setTimeout>[]>([]);
 const later=(fn:()=>void,ms:number)=>{timers.current.push(setTimeout(fn,ms));};
 useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);

 const line=LINES[index],text=line.text(nickname||'탐정'),done=shown>=text.length;

 useEffect(()=>{later(()=>setPhase('play'),reducedMotion()?0:FADE_IN_MS);},[]);
 // Typewriter: reveal the current line one character at a time.
 useEffect(()=>{
  if(phase!=='play')return;
  if(reducedMotion()){setShown(text.length);return;}
  if(shown>=text.length)return;
  const id=setTimeout(()=>setShown(n=>n+1),TYPE_MS);return()=>clearTimeout(id);
 },[phase,shown,text]);

 const finish=useCallback(()=>{
  setPhase('fade-out');
  later(onComplete,reducedMotion()?0:FADE_OUT_MS);
 },[onComplete]);

 function goTo(next:number){
  if(next>=LINES.length){finish();return;}
  if(LINES[next].scene!==scene){
   // Scene change: glitch the screen, swap the frame halfway through.
   setPhase('glitch');
   const ms=reducedMotion()?0:GLITCH_MS;
   later(()=>{setScene(LINES[next].scene);setIndex(next);setShown(0);},ms/2);
   later(()=>setPhase('play'),ms);
   return;
  }
  setIndex(next);setShown(0);
 }

 function advance(){
  if(phase!=='play'||naming||confirmSkip)return;
  if(!done){setShown(text.length);return;}
  if(line.askName&&!nickname){setNaming(true);return;}
  goTo(index+1);
 }

 useEffect(()=>{
  function key(e:KeyboardEvent){
   const target=e.target as HTMLElement;
   if(naming||confirmSkip||['INPUT','TEXTAREA','SELECT'].includes(target.tagName))return;
   if(e.key==='Escape'){e.preventDefault();if(phase==='play')setConfirmSkip(true);return;}
   if(e.repeat||IGNORED_KEYS.has(e.key)||e.ctrlKey||e.metaKey||e.altKey)return;
   e.preventDefault();advance();
  }
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });

 function confirmSkipping(){
  setConfirmSkip(false);
  // The nickname is still required; ask for it before leaving the story.
  if(!nickname){setSkipping(true);setNaming(true);return;}
  finish();
 }

 const scale=fit??1;
 const style={'--story-scale':scale} as CSSProperties;
 return <section className={'story-screen is-'+phase+(fit===null?' is-measuring':'')} style={style} onClick={advance} aria-label="크라임 시티 첫 입장 스토리">
  <div className={'story-stage scene-'+scene}>
   {scene===1?<>
    <img className="story-bg" src="/assets/story/story1-bg.jpg" alt="" draggable={false}/>
    <div className="story-raven-shadow" aria-hidden="true"/>
    <img className="story-raven" src="/assets/story/raven.webp" alt="" draggable={false}/>
   </>:<img className="story-bg" src="/assets/story/story2-bg.jpg" alt="" draggable={false}/>}
   <DialogueBox speaker={line.speaker} text={text.slice(0,shown)} showNext={done&&phase==='play'} reveal={!!line.reveal} shadeTop={scene===1?393:371}/>
   <SkipButton disabled={phase!=='play'} onClick={()=>setConfirmSkip(true)}/>
  </div>
  <div className="story-blackout" aria-hidden="true"/>
  {confirmSkip&&<DialogueConfirm title="대화 건너뛰기" confirmLabel="건너뛰기" scale={scale} onCancel={()=>setConfirmSkip(false)} onConfirm={confirmSkipping}>대화를 건너뛰시겠습니까?<br/>건너뛴 대화는 다시 볼 수 없습니다.</DialogueConfirm>}
  {naming&&<div onClick={e=>e.stopPropagation()}><CityNickname currentNickname="" initial scale={scale}
   onClose={()=>{setNaming(false);setSkipping(false);}}
   onSaved={async saved=>{setNickname(saved);setNaming(false);onNamed(saved);if(skipping){setSkipping(false);finish();}else goTo(index+1);}}/></div>}
 </section>;
}
