'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {cityApi} from './CityPanels';
import {getNicknameIssue,normalizeNickname} from './lib/nickname';
import {TUTORIAL_DONE,TUTORIAL_NAME_STEP,tutorialLine,tutorialHighlights} from './lib/tutorial';

type Props={user:any;scale:number;preview?:boolean;onProgress:(step:number)=>void;onNamed:(nickname:string)=>void;onComplete:()=>void;onExit:()=>void};
export default function CityTutorial({user,scale,preview=false,onProgress,onNamed,onComplete,onExit}:Props){
 const [step,setStep]=useState(preview?0:Math.min(Number(user.tutorialStep)||0,TUTORIAL_DONE-1)),[name,setName]=useState(user.nicknameSet?user.nickname:''),[draft,setDraft]=useState(preview?user.nickname:''),[auto,setAuto]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),advanceButton=useRef<HTMLButtonElement>(null),alive=useRef(true),busyRef=useRef(false),composing=useRef(false),actions=useRef({advance:()=>{},skip:()=>{},exit:onExit});
 const naming=step===TUTORIAL_NAME_STEP,line=tutorialLine(step,name),highlight=tutorialHighlights[step];
 function apply(next:number){if(!alive.current)return;setError('');setStep(next);if(!preview)onProgress(next);if(next>=TUTORIAL_DONE)onComplete();}
 async function move(next:number){
  if(busyRef.current)return;if(preview){apply(next);return;}busyRef.current=true;setBusy(true);setError('');
  try{const value=await cityApi('tutorial',{step:next});apply(value.tutorialStep);}catch(failure:any){if(alive.current){setError(failure.message||'연결을 확인한 뒤 다시 진행해주십쇼.');try{const value=await cityApi('tutorial');if(alive.current&&value.tutorialStep!==step){setName(value.nickname||'');apply(value.tutorialStep);}}catch{}}}
  finally{busyRef.current=false;if(alive.current)setBusy(false);}
 }
 async function submitName(){
  if(busyRef.current||composing.current)return;if(preview){apply(4);return;}
  const value=normalizeNickname(draft),issue=getNicknameIssue(value);
  if(issue){setError(issue==='restricted'?'비속어나 특정 성향을 강조한 코드네임은 사용할 수 없습니다.':'한글·영문·숫자 2~12자로 입력해주십쇼. 공백과 특수문자는 사용할 수 없습니다.');input.current?.focus();return;}
  busyRef.current=true;setBusy(true);setError('');
  try{const result=await cityApi('profile/nickname',{nickname:value});if(alive.current){setName(result.nickname);onNamed(result.nickname);apply(result.tutorialStep??4);}}
  catch(failure:any){if(alive.current){setError(failure.message?.includes('이미 사용')?'이런.. 중복된 코드네임입니다. 다시 한번 부탁드립니다.':failure.message||'코드네임을 확인해주십쇼.');input.current?.focus();}}
  finally{busyRef.current=false;if(alive.current)setBusy(false);}
 }
 function advance(){if(naming)void submitName();else void move(step+1);}
 function skip(){setAuto(false);if(naming){input.current?.focus();return;}void move(!name&&step<TUTORIAL_NAME_STEP?TUTORIAL_NAME_STEP:TUTORIAL_DONE);}
 actions.current={advance,skip,exit:onExit};
 useEffect(()=>{
  alive.current=true;const before=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
  const siblings=Array.from(root.current?.parentElement?.children||[]).filter((el):el is HTMLElement=>el instanceof HTMLElement&&el!==root.current).map(el=>({el,inert:el.inert}));siblings.forEach(({el})=>el.inert=true);document.body.style.overflow='hidden';
  function key(event:KeyboardEvent){
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!busyRef.current)actions.current.exit();return;}
   if(event.key==='Tab'){const controls=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]).filter(el=>el.getClientRects().length),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}return;}
   if(event.repeat||event.isComposing||event.ctrlKey||event.altKey||event.metaKey||['Shift','Control','Alt','Meta','CapsLock'].includes(event.key)||/^F\d+$/.test(event.key))return;
   const target=event.target as HTMLElement;if(target.closest('input,textarea,button:not(.tutorial-advance)'))return;
   event.preventDefault();event.stopImmediatePropagation();actions.current.advance();
  }
  document.addEventListener('keydown',key,true);return()=>{alive.current=false;document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;siblings.forEach(({el,inert})=>el.inert=inert);if(before?.isConnected)before.focus();};
 },[]);
 useEffect(()=>{if(naming){setAuto(false);input.current?.focus();}else advanceButton.current?.focus();},[step]);
 useEffect(()=>{if(naming&&!busy)input.current?.focus();},[naming,busy,error]);
 useEffect(()=>{if(!auto||naming||busy||error)return;const id=setTimeout(()=>actions.current.advance(),Math.max(4000,line.length*75));return()=>clearTimeout(id);},[auto,step,busy,error,line,naming]);
 return <div ref={root} className="tutorial-overlay" role="dialog" aria-modal="true" aria-label={preview?'로비 튜토리얼 다시보기':'크라임 시티 첫 입장 안내'} onClick={event=>{if(event.target===event.currentTarget)advance();}}>
  <div className="tutorial-canvas" style={{'--tutorial-scale':scale} as CSSProperties}>
   {highlight&&<div className="tutorial-highlight" style={{left:highlight.x,top:highlight.y,width:highlight.width,height:highlight.height}}/>}
   <button ref={advanceButton} className="tutorial-advance" aria-label={naming?'코드네임 확정':'다음 안내'} aria-describedby={naming?'tutorial-name-help':'tutorial-line'} disabled={busy} onClick={advance}/>
   {!naming&&step>0&&<img className="tutorial-han" src="/assets/tutorial/han.webp" alt="정보요원 한" draggable={false}/>}
   {!naming&&<div className="tutorial-bottom-shade"/>}
   <div className="tutorial-controls"><button className={auto?'active':''} aria-label="자동 진행" aria-pressed={auto} disabled={naming||busy} onClick={()=>setAuto(value=>!value)}>AUTO<Arrow/></button><button aria-label="튜토리얼 건너뛰기" disabled={busy||naming} onClick={skip}>SKIP<Arrow/></button></div>
   {naming?<>
    <img className="tutorial-name-decor" src="/assets/tutorial/codename-decor.webp" alt="" draggable={false}/>
    <form className="tutorial-name-form" onSubmit={event=>{event.preventDefault();void submitName();}}>
     <input ref={input} aria-label="당신의 코드네임" aria-describedby="tutorial-name-help" value={draft} placeholder="당신의 코드네임을 알려주세요." minLength={2} maxLength={12} autoComplete="off" spellCheck={false} readOnly={preview} disabled={busy} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={event=>{if(event.nativeEvent.isComposing&&event.key==='Enter')event.preventDefault();}} onChange={event=>{setDraft(event.target.value);setError('');}}/>
     <button className="tutorial-prompt" type="submit" disabled={busy}>{busy?'정보를 확인하고 있습니다…':'Enter 또는 클릭해서 코드네임 확정하기'}</button>
    </form>
    <div className="tutorial-name-help" id="tutorial-name-help"><p>닉네임은 한글,영문,숫자 2~12글자로 입력 가능합니다.</p><p>닉네임 변경은 <strong>7일에 한 번씩만</strong> 가능합니다. 설정에 주의해주세요.</p></div>
   </>:<><div className="tutorial-speaker">{step===0?'???':'코드네임 : 한'}</div><p className="tutorial-line" id="tutorial-line" key={step} aria-live="polite" aria-atomic="true">{line}</p><button className="tutorial-prompt" onClick={advance} disabled={busy}>{busy?'정보를 확인하고 있습니다…':'아무 키나 입력해서 진행하기'}</button></>}
   {error&&<div className="tutorial-error" role="alert"><img src="/assets/shop/success-mark.svg" alt=""/><span>{error}</span></div>}
  </div>
 </div>;
}
function Arrow(){return <span className="tutorial-arrow" aria-hidden="true"><img src="/assets/tutorial/intro-1.webp" alt=""/></span>;}
