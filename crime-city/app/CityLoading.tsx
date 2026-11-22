'use client';
import {useCallback,useRef,useState,type CSSProperties} from 'react';
import {ASSET_MANIFEST,FONT_MANIFEST,type LoadSection} from './lib/asset-manifest';

// Loading screen from Figma "로딩" (1101:106), with the user's chibi character in place of the
// winged-blade symbol: a grayscale copy fills with color from the bottom up as loading progresses. Shown until a section is 100% ready:
// every image of that section downloaded and decoded, fonts ready and its first data
// fetched, so tabs and popups inside it open without any further loading.

const SHOW_DELAY_MS=120,FILL_SETTLE_MS=380,FADE_MS=360;
const TASK_WEIGHT=60_000;// bytes-equivalent weight of one data request
const ready=new Set<LoadSection>();
const keep:HTMLImageElement[]=[];// keep decoded images alive so the browser does not drop them

function loadImage(url:string){
 return new Promise<void>(resolve=>{
  const img=new Image();img.decoding='async';
  img.onload=()=>{(img.decode?img.decode():Promise.resolve()).catch(()=>{}).then(()=>{keep.push(img);resolve();});};
  img.onerror=()=>resolve();// a missing file must not block the game forever
  img.src=url;
 });
}
async function loadFonts(){
 if(typeof document==='undefined'||!document.fonts)return;
 await Promise.all([document.fonts.load("700 37px 'SUITE Variable'"),document.fonts.load("800 45px 'SUITE Variable'")]).catch(()=>{});
}

export function useCityLoader(){
 // Visible from the very first server-rendered frame, so a fresh tab never shows a half-loaded page.
 const[view,setView]=useState<{visible:boolean;leaving:boolean;progress:number}>({visible:true,leaving:false,progress:0});
 const run=useRef(0);

 const load=useCallback(async(sections:LoadSection[],tasks:(()=>Promise<unknown>)[]=[],{initial=false}:{initial?:boolean}={})=>{
  const id=++run.current;
  const pending=sections.filter(s=>!ready.has(s));
  const files=pending.flatMap(s=>ASSET_MANIFEST[s]);
  const fonts=initial?FONT_MANIFEST:[];
  const total=files.reduce((a,f)=>a+f[1],0)+fonts.reduce((a,f)=>a+f[1],0)+tasks.length*TASK_WEIGHT;
  if(!total){if(initial)setView(v=>({...v,leaving:true}));if(initial)setTimeout(()=>run.current===id&&setView({visible:false,leaving:false,progress:1}),FADE_MS);return;}
  let loaded=0,shown=initial;
  const bump=(n:number)=>{loaded+=n;if(run.current===id)setView(v=>({...v,progress:Math.min(1,loaded/total)}));};
  if(!initial){setView({visible:false,leaving:false,progress:0});}
  const showTimer=initial?null:setTimeout(()=>{shown=true;if(run.current===id)setView(v=>({...v,visible:true,leaving:false}));},SHOW_DELAY_MS);
  await Promise.all([
   ...files.map(([url,size])=>loadImage(url).then(()=>bump(size))),
   ...(fonts.length?[loadFonts().then(()=>bump(fonts.reduce((a,f)=>a+f[1],0)))]:[]),
   ...tasks.map(t=>t().catch(()=>{}).then(()=>bump(TASK_WEIGHT))),
  ]);
  pending.forEach(s=>ready.add(s));
  if(showTimer)clearTimeout(showTimer);
  if(run.current!==id)return;
  if(!shown){setView({visible:false,leaving:false,progress:1});return;}
  // Let the fill reach the top, then fade the screen out.
  setView(v=>({...v,progress:1}));
  await new Promise(r=>setTimeout(r,FILL_SETTLE_MS));
  if(run.current!==id)return;
  setView(v=>({...v,leaving:true}));
  await new Promise(r=>setTimeout(r,FADE_MS));
  if(run.current===id)setView({visible:false,leaving:false,progress:1});
 },[]);

 const element=view.visible?<CityLoadingScreen progress={view.progress} leaving={view.leaving}/>:null;
 return {load,element};
}

export function CityLoadingScreen({progress,leaving}:{progress:number;leaving:boolean}){
 const pct=Math.round(progress*100);
 return <div className={'loading-screen'+(leaving?' is-leaving':'')} role="progressbar" aria-label="데이터 로딩" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
  <div className="loading-stage" style={{'--loading-progress':progress} as CSSProperties}>
   <div className="loading-shade" aria-hidden="true"/>
   <div className="loading-symbol" aria-hidden="true">
    <img className="loading-symbol-base" src="/assets/loading-character.webp" alt="" draggable={false}/>
    <img className="loading-symbol-fill" src="/assets/loading-character.webp" alt="" draggable={false}/>
   </div>
   <p className="loading-text">데이터를 로딩하고 있습니다. 잠시만 기다려주세요<span className="loading-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></p>
  </div>
 </div>;
}
