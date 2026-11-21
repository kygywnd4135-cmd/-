'use client';

import {useEffect,useRef,useState,type CSSProperties,type PointerEvent as ReactPointerEvent} from 'react';
import {cityApi} from './CityPanels';
import CityCurrencyBalance from './CityCurrencyBalance';
import {type ShopTab,type ShopView,type ShopProduct} from './lib/shop';

const image=(name:string)=>'/assets/shop/'+name+'.png';
const icon=(name:string)=>'/assets/shop/'+name+'.svg';
const tabs:[ShopTab,string][]=[['data','메인 데이터샵'],['points','포인트샵'],['primacy','프리머시샵']];
type Layer={kind:'confirm';action:'purchase'|'refresh'}|{kind:'error'|'help';message:string}|null;
const introLines=[
  '요~ 반가워! 너가 그 소문의 탐정이구나?\n내 이름은 모로. 크라임 시티의 소문난 정보꾼이지!',
  '이곳에선 포인트로 다양한 정보를 구매할 수 있어.',
  '매일매일 내가 엄선한 특별 기프트도 있으니까 놓치지말라구! 흐흐.',
];
const greetings={data:'기다리고 있었어, 탐정!\n오늘도 엄청난 정보들이라구.. 후후.',points:'역시.. 소문난 명탐정 다워.\n포인트를 벌써 그렇게나 모은거야?',primacy:'흠.. 프리머시 토큰은 정말 귀중한데.\n특별히 탐정에게만 보여주는거야.'};

export default function CityShop({scale,onClose,onWalletChange}:{scale:number;onClose:()=>void;onWalletChange:(wallet:{points:number;primacyTokens:number})=>void}){
  const [data,setData]=useState<ShopView|null>(null),[loadError,setLoadError]=useState(''),[tab,setTab]=useState<ShopTab>('data'),[introStep,setIntroStep]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null),[layer,setLayer]=useState<Layer>(null),[busy,setBusy]=useState(false),[toast,setToast]=useState(''),[completed,setCompleted]=useState(false),[clock,setClock]=useState(Date.now()),[dragging,setDragging]=useState(false);
  const scene=useRef<HTMLDivElement>(null),detail=useRef<HTMLElement>(null),dialog=useRef<HTMLElement>(null),viewport=useRef<HTMLDivElement>(null),closeButton=useRef<HTMLButtonElement>(null),buyButton=useRef<HTMLButtonElement>(null),introButton=useRef<HTMLButtonElement>(null);
  const alive=useRef(true),busyRef=useRef(false),latest=useRef({selectedId,layer}),close=useRef(onClose),skew=useRef(0),refreshing=useRef(false),dataRef=useRef(data),intent=useRef<{key:string;requestId:string}|null>(null);
  const drag=useRef<{id:number;x:number;y:number;scroll:number;active:boolean}|null>(null),suppressClick=useRef(0),productOpener=useRef<HTMLElement|null>(null),selectedOffer=useRef('');
  latest.current={selectedId,layer};close.current=onClose;dataRef.current=data;
  const selected=data?.products.find(product=>product.id===selectedId)||null,intro=!!data&&!data.introSeen;
  function apply(value:ShopView){if(!alive.current)return;skew.current=value.now-Date.now();setClock(value.now);setData(value);dataRef.current=value;onWalletChange({points:value.points,primacyTokens:value.primacyTokens});}
  async function refresh(){try{const value=await cityApi('shop');apply(value);setLoadError('');}catch(error:any){if(alive.current)setLoadError(error.message||'상점을 불러오지 못했습니다.');}}
  useEffect(()=>{
    alive.current=true;const before=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    const siblings=Array.from(scene.current?.closest('.shop-overlay')?.parentElement?.children||[]).filter((el):el is HTMLElement=>el instanceof HTMLElement&&!el.classList.contains('shop-overlay')).map(el=>({el,inert:el.inert}));
    siblings.forEach(({el})=>{el.inert=true;});document.body.style.overflow='hidden';closeButton.current?.focus();
    function key(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(busyRef.current)return;if(latest.current.layer){setLayer(null);buyButton.current?.focus();}else if(latest.current.selectedId)setSelectedId(null);else close.current();}
      if(event.key==='Tab'){
        const scope=latest.current.layer?dialog.current:latest.current.selectedId?detail.current:scene.current;
        const controls=Array.from(scope?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length&&!el.closest('[inert]')),first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }
    document.addEventListener('keydown',key,true);refresh();
    return()=>{alive.current=false;document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;siblings.forEach(({el,inert})=>{el.inert=inert;});if(before?.isConnected)before.focus();};
  },[]);
  useEffect(()=>{const id=setInterval(()=>setClock(Date.now()+skew.current),1000);return()=>clearInterval(id);},[]);
  useEffect(()=>{if(!data||clock<data.nextResetAt||refreshing.current||busyRef.current)return;refreshing.current=true;refresh().finally(()=>{refreshing.current=false;});},[clock,data?.nextResetAt]);
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>{setToast('');setCompleted(false);},5000);return()=>clearTimeout(id);},[toast]);
  useEffect(()=>{if(viewport.current)viewport.current.scrollLeft=0;},[tab]);
  useEffect(()=>{if(intro)introButton.current?.focus();else if(dataRef.current)closeButton.current?.focus();},[intro]);
  useEffect(()=>{if(selectedId)detail.current?.querySelector<HTMLButtonElement>('button')?.focus();else if(productOpener.current?.isConnected)productOpener.current.focus();},[selectedId]);
  useEffect(()=>{if(!layer)return;const before=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();return()=>{if(before?.isConnected)before.focus();};},[layer?.kind]);
  async function finishIntro(){if(busyRef.current)return;busyRef.current=true;setBusy(true);try{apply(await cityApi('shop/intro',{}));}catch(error:any){if(alive.current)setLayer({kind:'error',message:error.message});}finally{busyRef.current=false;if(alive.current)setBusy(false);}}
  function advanceIntro(){if(!intro||layer||busyRef.current)return;if(introStep<introLines.length-1)setIntroStep(step=>Math.min(step+1,introLines.length-1));else void finishIntro();}
  function showProduct(product:ShopProduct){if(performance.now()<suppressClick.current)return;intent.current=null;productOpener.current=document.activeElement as HTMLElement|null;selectedOffer.current=product.offerKey;setSelectedId(product.id);setCompleted(false);setToast('');}
  function pointerDown(event:ReactPointerEvent<HTMLDivElement>){if(event.button!==0)return;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,scroll:event.currentTarget.scrollLeft,active:false};}
  function pointerMove(event:ReactPointerEvent<HTMLDivElement>){const d=drag.current;if(!d||d.id!==event.pointerId)return;const dx=event.clientX-d.x;if(!d.active&&Math.abs(dx)>7&&Math.abs(dx)>Math.abs(event.clientY-d.y)){d.active=true;event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}if(d.active){event.preventDefault();event.currentTarget.scrollLeft=d.scroll-dx/scale;}}
  function pointerEnd(event:ReactPointerEvent<HTMLDivElement>){const d=drag.current;if(d?.active){suppressClick.current=performance.now()+300;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}drag.current=null;setDragging(false);}
  async function transact(action:'purchase'|'refresh'){
    if(busyRef.current||!dataRef.current)return;const current=dataRef.current,product=selected;
    if(action==='purchase'&&!product)return;
    if(action==='purchase'&&product!.offerKey!==selectedOffer.current){setSelectedId(null);setLayer({kind:'error',message:'상품이 갱신되었습니다.\n구성을 다시 확인해주세요.'});return;}
    const key=action==='refresh'?'refresh:'+current.dailyKey:'purchase:'+product!.offerKey;
    if(intent.current?.key!==key)intent.current={key,requestId:crypto.randomUUID()};
    const body=action==='refresh'?{requestId:intent.current.requestId,revision:current.revision,dailyKey:current.dailyKey}:{requestId:intent.current.requestId,revision:current.revision,productId:product!.id,offerKey:product!.offerKey};
    busyRef.current=true;setBusy(true);
    try{
      const value=await cityApi('shop/'+action,body);if(!alive.current)return;apply(value);intent.current=null;setLayer(null);setSelectedId(null);setCompleted(action==='purchase');setToast(action==='purchase'?'구매를 완료했습니다. 인벤토리를 확인해주세요.':'데일리 데이터를 초기화했습니다.');
    }catch(error:any){if(alive.current){setLayer({kind:'error',message:error.message||'구매를 완료하지 못했습니다. 다시 확인해주세요.'});await refresh();}}
    finally{busyRef.current=false;if(alive.current)setBusy(false);}
  }
  const byId=(id:string)=>data!.products.find(product=>product.id===id)!;
  const products=data?(tab==='data'?[byId('document-i'),byId('document-ii'),byId('document-iii'),byId('document-i')]:tab==='points'?[byId('daily-0'),byId('daily-2'),byId('daily-1'),byId('boost-3'),byId('partner-chart'),byId('list-chart'),byId('host-boost'),byId('host-boost')]:[byId('monthly-ticket'),byId('coins-0'),byId('coins-3'),byId('coins-1'),byId('coins-4'),byId('coins-2'),byId('coins-5')]):[];
  const seconds=Math.max(0,Math.ceil(((data?.nextResetAt||clock)-clock)/1000)),countdown=[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
  return <div className="shop-overlay" role="dialog" aria-modal="true" aria-labelledby="shop-title" onClick={event=>{if(event.target===event.currentTarget)advanceIntro();}}>
    <div ref={scene} className={'shop-canvas'+(intro?' shop-intro':'')+(selected?' shop-has-detail':'')} style={{'--shop-scale':scale} as CSSProperties}>
      <div className="shop-main" inert={!!selected||!!layer}>
        <img className="shop-backdrop" src={image(intro?'entry-60':'data-208')} alt="" draggable={false}/>
        <div className="shop-backdrop-shade"/>
        <header className="shop-header" inert={intro}>
          <button ref={closeButton} className="shop-back" aria-label="상점 뒤로가기" onClick={onClose}><img src={image('entry-42')} alt="" draggable={false}/></button>
          <h1 id="shop-title">정보 상인단</h1>
          <button className="shop-help" aria-label="상점 도움말" onClick={()=>setLayer({kind:'help',message:'데일리 무료 상품 3칸은 매일 00:00에 갱신됩니다.\n1,500포인트로 즉시 초기화할 수 있습니다.\n월간 상품은 매월 1일 00:00에 초기화됩니다.\n기준 시간은 한국 시간입니다.'})}>?</button>
          <CityCurrencyBalance kind="points" amount={data?.points||0} className="shop-wallet-points"/>
          <CityCurrencyBalance kind="primacy" amount={data?.primacyTokens||0} className="shop-wallet-primacy"/>
          <button className="shop-header-icon shop-mail" aria-label="상점 우편함" onClick={()=>setLayer({kind:'help',message:'우편함은 준비 중입니다.'})}><img src={icon('mail')} alt=""/></button>
          <button className="shop-header-icon shop-settings" aria-label="상점 설정" onClick={()=>setLayer({kind:'help',message:'상점 설정은 준비 중입니다.'})}><img src={icon('settings')} alt=""/></button>
          <button className="shop-header-icon shop-home" aria-label="메인 로비로 돌아가기" onClick={onClose}><img src={icon('home')} alt=""/></button>
        </header>
        {!data?<div className="shop-loading" role="status">{loadError?<><p>{loadError}</p><button onClick={refresh}>다시 불러오기</button></>:'정보 상인단에 입장하는 중…'}</div>:<>
          {!intro&&<>
            <div className="shop-tabs" role="tablist" aria-label="상점 분류">{tabs.map(([id,label],index)=><button key={id} role="tab" id={'shop-tab-'+id} aria-selected={tab===id} aria-controls="shop-products" tabIndex={tab===id?0:-1} className={tab===id?'active':''} onClick={()=>{setTab(id);setCompleted(false);}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;setTab(tabs[next][0]);document.getElementById('shop-tab-'+tabs[next][0])?.focus();}}><img src={icon(tab===id?(index===0?'tab-active':'tab-active-middle'):(index===0?'tab-inactive-first':'tab-inactive'))} alt=""/><span>{label}</span></button>)}</div>
            <div className={'shop-panel shop-panel-'+tab}/>
            <div ref={viewport} id="shop-products" role="tabpanel" aria-labelledby={'shop-tab-'+tab} className={'shop-products-viewport '+tab+(dragging?' dragging':'')} aria-label="상품 목록 · 드래그하여 좌우로 이동" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onDragStart={event=>event.preventDefault()} onClickCapture={event=>{if(performance.now()<suppressClick.current){event.preventDefault();event.stopPropagation();}}} onWheel={event=>{if(viewport.current&&Math.abs(event.deltaY)>Math.abs(event.deltaX))viewport.current.scrollLeft+=event.deltaY;}}>
              <div className={'shop-products-track '+tab}>{products.map((product,index)=><ProductCard key={product.id+'-'+index} product={product} tab={tab} index={index} onClick={()=>showProduct(product)}/>)}</div>
            </div>
            <div className={'shop-reset-bar '+(tab==='points'?'points':'')}><img src={icon('timer')} alt=""/><span>데일리 데이터 초기화까지</span><strong aria-label={'초기화까지 '+countdown}>{countdown}</strong><button onClick={()=>{intent.current=null;setLayer({kind:'confirm',action:'refresh'});}} title="1,500 포인트로 무료 상품 3칸 초기화" aria-label="데일리 데이터 즉시 초기화 · 1500 포인트"><img src={icon('reset')} alt=""/><b>즉시 초기화</b></button></div>
          </>}
          <img className="shop-merchant" src={image('entry-26')} alt="정보 상인 모로" draggable={false}/>
          {intro?<><button ref={introButton} className="shop-intro-advance" onClick={advanceIntro} disabled={busy} aria-label="모로의 다음 대사" aria-describedby="shop-intro-line"/><div id="shop-intro-line" className="shop-intro-dialogue" aria-live="polite" aria-atomic="true">{introLines[introStep]}</div><button className="shop-skip" onClick={finishIntro} disabled={busy}>스킵하기</button></>:<div className="shop-dialogue" aria-live="polite">{completed?'좋아! 거래는 성립되었어.\n부디 너의 추리에 도움이 되길 바래!':greetings[tab]}</div>}
        </>}
      </div>
      {selected&&<>
        <div className="shop-detail-shade" onClick={()=>{if(!layer&&!busy)setSelectedId(null);}}/>
        <section className="shop-detail" role="dialog" aria-modal="true" aria-label={selected.name+' 상품 정보'} ref={detail} inert={!!layer}>
          <img className="shop-detail-facets" src={icon('detail-facets')} alt=""/>
          <div className="shop-detail-left"><img className="shop-card-background" src={image('detail-left')} alt=""/>{selected.art&&<img className="shop-detail-art" src={image(selected.art)} alt=""/>}<div className="shop-detail-tag">{selected.daysLeft!==undefined?<><img src={icon('hourglass')} alt=""/>판매종료 D-{selected.daysLeft}</>:selected.gift?'데일리 데이터 기프트':selected.payment?'결제 준비 중':'정보 상인단'}</div><div className="shop-detail-copy">{selected.remaining!==null&&<p>구매 제한 {selected.remaining}/{selected.limit}</p>}{selected.caption&&<strong>{selected.caption}</strong>}<strong>{selected.name}</strong></div></div>
          <button className="shop-detail-close" aria-label="상품 정보 닫기" onClick={()=>setSelectedId(null)}><img src={image('close-extracted')} alt=""/></button>
          <p className="shop-includes-title">• 다음 아이템이 포함되어 있습니다.</p>
          <div className="shop-includes" tabIndex={0} aria-label="구성품 목록">{selected.rewards.length?selected.rewards.map(reward=><div className="shop-reward" key={reward.itemId}><span className="shop-reward-image"/><p>{reward.name}<small>{reward.quantity}개</small></p></div>):<p className="shop-payment-copy">{selected.coinAmount?`프리머시 토큰 ${selected.coinAmount.toLocaleString('ko-KR')}개`:'상인단의 비밀티켓'}<small>실제 결제는 준비 중입니다.</small></p>}</div>
          <p className="shop-refund-note">• 환불이 불가능한 상품이니 구매 전 유의해주세요.</p>
          <div className="shop-detail-price">{selected.currency==='points'&&<img src="/assets/currency/points.svg" alt="포인트"/>}{selected.price===null?'':selected.currency==='krw'?'KRW '+selected.price.toLocaleString('ko-KR'):selected.price}</div>
          <button ref={buyButton} className="shop-buy" disabled={busy||!!selected.unavailable} onClick={()=>setLayer({kind:'confirm',action:'purchase'})}>{selected.payment?'결제 준비 중':selected.remaining===0?'구매 제한 도달':selected.unavailable?'판매 종료':'구매하기'}</button>
        </section>
      </>}
      {layer&&<div className="shop-dialogue-layer" onPointerDown={event=>{if(event.target===event.currentTarget&&!busy)setLayer(null);}}>
        <section className={'shop-confirm '+(layer.kind==='help'?'help':'')} role="dialog" aria-modal="true" aria-label={layer.kind==='confirm'?'구매 확인':layer.kind==='help'?'상점 안내':'상점 오류'} ref={dialog}>
          <img src={image('confirm-motif')} className="shop-confirm-motif" alt=""/>
          {layer.kind==='confirm'?<><p>{layer.action==='refresh'?<>1,500포인트로 즉시 초기화하겠어?<br/><strong>무료 상품 3칸이 새롭게 바뀔 거야!</strong></>:<>흐흥.. 정말로 구매하겠어?<br/><strong>한번 구매하면 환불해주기 어려워!</strong></>}</p><div className="shop-confirm-actions"><button className="cancel" disabled={busy} onClick={()=>setLayer(null)}>취소</button><button className="confirm" disabled={busy} onClick={()=>transact(layer.action)}>{busy?'처리 중…':layer.action==='refresh'?'초기화 확정':'구매 확정'}</button></div></>:<><p>{layer.message}</p><div className="shop-confirm-actions single"><button className="confirm" onClick={()=>{setLayer(null);buyButton.current?.focus();}}>확인</button></div></>}
        </section>
      </div>}
      {toast&&<div className="shop-success" role="status" aria-live="polite"><img src={icon('success-mark')} alt=""/><span>{toast}</span></div>}
    </div>
  </div>;
}

function ProductCard({product,tab,index,onClick}:{product:ShopProduct;tab:ShopTab;index:number;onClick:()=>void}){
  const tall=tab==='data'||product.id==='monthly-ticket',duplicate=tab==='data'&&index===3;
  const file=duplicate?'data-122':product.art;
  const artStyles:CSSProperties=tab==='data'?{left:[46,29,27,24][index],top:[125,125,112,103][index],width:[252,266,290,308][index],height:[252,266,290,308][index]}:product.id==='monthly-ticket'?{left:56.535,top:58,width:229.805,height:436.629}:({
    'coins-0':{left:108,top:40,width:136,height:136},'coins-1':{left:71,top:-6,width:202,height:202},'coins-2':{left:59,top:0,width:225,height:225},'coins-3':{left:69,top:0,width:206,height:206},'coins-4':{left:85,top:3,width:192,height:192},'coins-5':{left:28,top:3,width:242,height:242},
  }[product.id]||{});
  return <button className={'shop-product '+(tall?'tall':'small')+(product.gift?' gift':'')+(product.id==='monthly-ticket'?' ticket':'')+(product.remaining===0?' exhausted':'')} aria-label={product.name+(product.payment?' · 결제 준비 중':product.price===0?' · 무료':' · '+product.price+' 포인트')} onClick={onClick}>
    <span className="shop-product-surface"><img className="shop-card-background shop-original-card-bg" src={image(tall?'card-tall':'card-small')} alt=""/>{file&&<img className="shop-product-art" src={image(file)} alt="" draggable={false} style={artStyles}/>}
    {(product.daysLeft!==undefined||product.gift||product.id==='monthly-ticket')&&<span className="shop-product-tag"><img src={icon('hourglass')} alt=""/>{product.daysLeft!==undefined?'판매종료 D-'+product.daysLeft:product.gift?'데일리 데이터 기프트':'30일 월간 상품'}</span>}
    {product.payment&&product.id!=='monthly-ticket'&&<span className="shop-first-bonus">첫충전 두배!</span>}
    <span className="shop-product-copy">{product.id==='monthly-ticket'?<><small>혜택 미적용중</small><strong>{product.name}</strong><strong className="shop-ticket-benefit">매일 접속시 <img src="/assets/currency/primacy.svg" alt="프리머시 토큰"/> X 300</strong></>:<>{product.remaining!==null&&<small>{product.period==='monthly'?'월간제한':'구매 제한'} {product.remaining}/{product.limit}</small>}{product.caption&&<strong>{product.caption}</strong>}<strong>{product.name}</strong></>}</span>
    <span className="shop-product-price">{product.price!==null&&<>{product.currency==='points'&&<img src="/assets/currency/points.svg" alt=""/>}<b>{product.currency==='krw'?'KRW '+product.price.toLocaleString('ko-KR'):product.price}</b>{product.originalPrice&&!duplicate&&<del>{product.originalPrice}</del>}</>}</span></span>
    {product.gift&&<img className="shop-gift-border" src={image('points-66')} alt=""/>}
  </button>;
}
