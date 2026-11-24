'use client';
import {useCallback,useEffect,useState} from 'react';

// Full screen (user request 2026-11-24). Browsers only allow it from a click or key press, so the
// page switches on the first input of each visit, and the lobby has a toggle next to 친구.
// Turning it off with the toggle is remembered, so later visits do not switch automatically.
// In Chrome/Edge the Escape key is kept for the game (closing popups); holding Escape exits.
// iPhone Safari has no page full screen: supported is false there and the toggle is hidden.
const AUTO_KEY='crime-fullscreen-auto';

type KeyboardLock={lock?:(keys?:string[])=>Promise<void>;unlock?:()=>void};
const keyboard=()=>(navigator as Navigator&{keyboard?:KeyboardLock}).keyboard;

function readAuto(){try{return localStorage.getItem(AUTO_KEY)!=='0';}catch{return true;}}
function saveAuto(on:boolean){try{localStorage.setItem(AUTO_KEY,on?'1':'0');}catch{}}

async function enter(){
 const root=document.documentElement;
 if(document.fullscreenElement||!root.requestFullscreen)return;
 try{await root.requestFullscreen({navigationUI:'hide'});keyboard()?.lock?.(['Escape']).catch(()=>{});}catch{}
}
async function leave(){
 if(!document.fullscreenElement)return;
 keyboard()?.unlock?.();
 try{await document.exitFullscreen();}catch{}
}

export function useFullscreen(){
 const[on,setOn]=useState(false),[supported,setSupported]=useState(false);
 useEffect(()=>{
  setSupported(!!document.fullscreenEnabled&&!!document.documentElement.requestFullscreen);
  const sync=()=>setOn(!!document.fullscreenElement);sync();
  document.addEventListener('fullscreenchange',sync);
  // First input of the visit: switch to full screen unless the user turned it off before.
  const first=(e:Event)=>{
   if(e instanceof KeyboardEvent&&(e.key==='Escape'||e.key==='F11'))return;
   if((e.target as Element|null)?.closest?.('.city-fullscreen')){remove();return;}// the toggle handles itself
   remove();if(readAuto())enter();
  };
  const remove=()=>{window.removeEventListener('pointerdown',first,true);window.removeEventListener('keydown',first,true);};
  window.addEventListener('pointerdown',first,true);window.addEventListener('keydown',first,true);
  return()=>{remove();document.removeEventListener('fullscreenchange',sync);};
 },[]);
 const toggle=useCallback(()=>{if(document.fullscreenElement){saveAuto(false);leave();}else{saveAuto(true);enter();}},[]);
 return {on,supported,toggle};
}
