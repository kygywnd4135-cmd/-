'use client';
import {useEffect,useRef,type ReactNode} from 'react';

// Reusable visual-novel dialogue layout from Figma "스토리1"/"스토리2" (1102:111, 1102:114).
// Geometry is on the 1920 x 1080 canvas; the parent scales the whole stage.
// Keep this layout for every future story/dialogue scene (user decision, 2026-11-22).

export type Speaker={name:string;title:string};

export function DialogueBox({speaker,text,showNext,reveal=false,shadeTop=393}:{speaker:Speaker;text:string;showNext:boolean;reveal?:boolean;shadeTop?:number}){
 return <>
  <div className="dialogue-shade" style={{top:shadeTop,height:1080-shadeTop}} aria-hidden="true"/>
  <div className={'dialogue-speaker'+(reveal?' is-reveal':'')} key={speaker.name}>
   <p className="dialogue-name">{speaker.name}</p>
   <p className="dialogue-title">{speaker.title}</p>
  </div>
  <img className="dialogue-line" src="/assets/story/dialogue-line.svg" alt="" aria-hidden="true" draggable={false}/>
  <p className="dialogue-text" aria-live="polite">{text}</p>
  {showNext&&<img className="dialogue-next" src="/assets/story/dialogue-next.svg" alt="" aria-hidden="true" draggable={false}/>}
 </>;
}

export function SkipButton({onClick,disabled=false}:{onClick:()=>void;disabled?:boolean}){
 return <button type="button" className="dialogue-skip" aria-label="대화 건너뛰기" disabled={disabled} onClick={e=>{e.stopPropagation();onClick();}}>
  <span>SKIP</span>
  <img src="/assets/story/skip-icon.png" alt="" aria-hidden="true" draggable={false}/>
 </button>;
}

// Confirmation popup in the same frame as the nickname dialog (Frame 333/334 family).
export function DialogueConfirm({title,children,confirmLabel,onCancel,onConfirm,scale}:{title:string;children:ReactNode;confirmLabel:string;onCancel:()=>void;onConfirm:()=>void;scale:number}){
 const confirmButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{confirmButton.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onCancel();}};document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);},[onCancel]);
 return <div className="nickname-overlay dialogue-confirm-overlay" onClick={e=>e.stopPropagation()}>
  <div className="nickname-canvas" style={{'--nickname-scale':scale} as React.CSSProperties}>
   <section className="nickname-dialog dialogue-confirm" role="alertdialog" aria-modal="true" aria-labelledby="dialogue-confirm-heading" aria-describedby="dialogue-confirm-description">
    <div className="nickname-panel">
     <header className="nickname-heading"><h2 id="dialogue-confirm-heading">{title}</h2></header>
     <div className="dialogue-confirm-body"><p id="dialogue-confirm-description">{children}</p></div>
     <footer className="nickname-actions">
      <button className="nickname-cancel" type="button" onClick={onCancel}>취소</button>
      <button className="nickname-submit" type="button" ref={confirmButton} onClick={onConfirm}>{confirmLabel}</button>
     </footer>
    </div>
   </section>
  </div>
 </div>;
}
