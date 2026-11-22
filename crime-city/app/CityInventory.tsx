'use client';

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Loader2,Search} from 'lucide-react';
import {cityApi} from './CityPanels';
import CityCurrencyBalance from './CityCurrencyBalance';
import {defaultInventorySettings,inventoryExpiryAlerts,isInventoryExpired,isInventoryProtected,selectInventoryItems,type InventoryCategory,type InventoryItem,type InventorySettings,type InventoryView} from './lib/inventory';

type Notice={kind:'delete'|'deleted'|'error';item?:InventoryItem;message?:string};
const tabs:[InventoryCategory,string][]=[['all','ALL'],['consumable','소비'],['misc','기타'],['event','이벤트']];
const sorts:[InventorySettings['sort'],string][]=[['grade','등급별 정렬'],['acquired','획득순 정렬'],['name','이름순 정렬'],['set','세트별 정렬']];
const art=(name:string)=>'/assets/inventory/'+name+'.webp';

function FilterMark(){return <svg width="35" height="34" viewBox="0 0 35 34" aria-hidden="true"><path d="M1 1H34V9L20 17V29L14 33V17L1 9Z" fill="currentColor"/></svg>;}
function ItemArt({item,large=false}:{item:InventoryItem;large?:boolean}){return item.art==='placeholder'?<span className={'inventory-placeholder'+(large?' large':'')}><img src={art('placeholder')} alt="" draggable={false}/></span>:<img className={'inventory-item-art '+item.art} src={art(item.art)} alt="" draggable={false}/>;}

export default function CityInventory({scale,onClose,onWalletChange}:{scale:number;onClose:()=>void;onWalletChange?:(wallet:{points:number})=>void}){
  const[data,setData]=useState<InventoryView|null>(null),[loadError,setLoadError]=useState(''),[attempt,setAttempt]=useState(0);
  const[category,setCategory]=useState<InventoryCategory>('all'),[selectedId,setSelectedId]=useState('wanderer');
  const[filterOpen,setFilterOpen]=useState(false),[draft,setDraft]=useState<InventorySettings>({...defaultInventorySettings});
  const[notice,setNotice]=useState<Notice|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[now,setNow]=useState(Date.now());
  const frame=useRef<HTMLElement>(null),closeButton=useRef<HTMLButtonElement>(null),filter=useRef<HTMLElement>(null),filterButton=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),popup=useRef<HTMLElement>(null);
  const mounted=useRef(true),busyRef=useRef(false),dataRef=useRef(data),layers=useRef({filterOpen,notice}),close=useRef(onClose),alerted=useRef(new Set<string>());
  dataRef.current=data;layers.current={filterOpen,notice};close.current=onClose;
  const items=data?selectInventoryItems(data.items,category,data.settings):[];
  const selected=notice?.kind==='deleted'&&notice.item?notice.item:items.find(item=>item.id===selectedId)||items[0]||null;
  const expired=!!selected&&isInventoryExpired(selected,now),protectedItem=!!selected&&!!data&&isInventoryProtected(selected,data.settings);

  useEffect(()=>{
    mounted.current=true;const before=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    const sibling=Array.from(frame.current?.closest('.inventory-overlay')?.parentElement?.children||[]).filter((el):el is HTMLElement=>el instanceof HTMLElement&&!el.classList.contains('inventory-overlay')).map(el=>({el,inert:el.inert}));
    sibling.forEach(({el})=>{el.inert=true;});document.body.style.overflow='hidden';closeButton.current?.focus();
    function key(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(layers.current.notice){if(!busyRef.current){setNotice(null);closeButton.current?.focus();}}else if(layers.current.filterOpen){setFilterOpen(false);filterButton.current?.focus();}else close.current();}
      if(event.key==='Tab'){
        const scope=layers.current.notice?popup.current:layers.current.filterOpen?filter.current:frame.current;
        const controls=Array.from(scope?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
        const first=controls[0],last=controls[controls.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    }
    document.addEventListener('keydown',key,true);
    return()=>{mounted.current=false;document.removeEventListener('keydown',key,true);document.body.style.overflow=overflow;sibling.forEach(({el,inert})=>{el.inert=inert;});if(before?.isConnected)before.focus();};
  },[]);
  useEffect(()=>{let active=true;setLoadError('');cityApi('inventory').then(result=>{if(active){dataRef.current=result;setData(result);}}).catch(error=>{if(active)setLoadError(error.message||'인벤토리를 불러오지 못했습니다.');});return()=>{active=false;};},[attempt]);
  useEffect(()=>{if(filterOpen)search.current?.focus();},[filterOpen]);
  useEffect(()=>{if(notice)popup.current?.querySelector<HTMLButtonElement>('button')?.focus();},[notice?.kind]);
  useEffect(()=>{if(!filterOpen)return;function outside(event:PointerEvent){if(!filter.current?.contains(event.target as Node)&&!filterButton.current?.contains(event.target as Node))setFilterOpen(false);}document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[filterOpen]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(id);},[]);
  useEffect(()=>{if(!data)return;const expired=inventoryExpiryAlerts(data.items,data.settings,now).filter(item=>!alerted.current.has(item.id+':'+item.expiresAt));if(expired.length){expired.forEach(item=>alerted.current.add(item.id+':'+item.expiresAt));setMessage(expired.length===1?`기간제 아이템 '${expired[0].name}'의 사용 기간이 만료되었습니다.`:`기간제 아이템 ${expired.length}개의 사용 기간이 만료되었습니다.`);}},[data,now]);
  useEffect(()=>{if(!message)return;const id=setTimeout(()=>setMessage(''),5000);return()=>clearTimeout(id);},[message]);

  async function request(path:string,body:Record<string,unknown>){
    if(busyRef.current||!dataRef.current)return false;
    busyRef.current=true;setBusy(true);
    try{const result=await cityApi('inventory/'+path,{revision:dataRef.current.revision,...body});if(!mounted.current)return false;dataRef.current=result;setData(result);onWalletChange?.({points:result.points});return true;}
    catch(error:any){if(mounted.current){setMessage(error.message||'인벤토리를 변경하지 못했습니다.');if(error.message?.includes('다른 창'))cityApi('inventory').then(result=>{if(mounted.current){dataRef.current=result;setData(result);}}).catch(()=>{});}return false;}
    finally{busyRef.current=false;if(mounted.current)setBusy(false);}
  }
  function openFilters(){if(!data)return;setDraft({...data.settings});setFilterOpen(value=>!value);}
  async function act(action:string){if(!selected||!data)return;const item=selected;if(action==='delete'){if(protectedItem){setMessage(item.category==='event'&&data.settings.protectEvents?'필터에서 이벤트 아이템 삭제 잠금을 해제해주세요.':'잠금을 해제한 뒤 삭제해주세요.');return;}setFilterOpen(false);setMessage('');setNotice({kind:'delete',item});return;}
    if(action==='lock'&&item.category==='event'&&data.settings.protectEvents){setMessage('필터의 이벤트 아이템 삭제 잠금이 적용 중입니다.');return;}
    if(await request('item',{action,itemId:item.id})){setMessage(action==='equip'?'스킨을 장착했습니다.':action==='unequip'?'장착을 해제했습니다.':action==='lock'?(item.locked?'아이템 잠금을 해제했습니다.':'아이템을 잠갔습니다.'):'아이템을 1개 사용했습니다.');}
  }
  async function deleteItem(){if(!notice?.item)return;const item=notice.item;if(await request('item',{action:'delete',itemId:item.id})){setNotice({kind:'deleted',item});}else if(mounted.current){setNotice(null);}}

  return <div className="inventory-overlay" onPointerDown={event=>{if(event.target===event.currentTarget){if(filterOpen)setFilterOpen(false);else if(!notice)onClose();}}}>
    <div className="inventory-canvas" style={{'--inventory-scale':scale} as CSSProperties}>
      <section className="inventory-frame" role="dialog" aria-modal="true" aria-labelledby="inventory-heading" ref={frame}>
        <img className="inventory-facets" src="/assets/inventory/main-facets.svg?v=2" alt="" aria-hidden="true"/>
        <header className="inventory-heading"><img src={art('backpack')} alt=""/><h2 id="inventory-heading">개인 인벤토리</h2><span aria-hidden="true"/></header>
        <button className="inventory-close" ref={closeButton} aria-label="인벤토리 닫기" onClick={onClose}><img src={art('close')} alt=""/></button>
        <div className="inventory-tabs" role="tablist" aria-label="아이템 분류"><span className="inventory-tab-line" aria-hidden="true"/>{tabs.map(([id,label],index)=><button key={id} className={category===id?'active':''} id={'inventory-tab-'+id} role="tab" aria-selected={category===id} aria-controls="inventory-items" tabIndex={category===id?0:-1} style={{left:[61,188,312,436][index]}} onClick={()=>{setCategory(id);setFilterOpen(false);}} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?3:(index+(event.key==='ArrowRight'?1:3))%4;setCategory(tabs[next][0]);document.getElementById('inventory-tab-'+tabs[next][0])?.focus();}}><strong>{label}</strong>{category===id?<svg className="inventory-tab-pointer" viewBox="0 0 46 40" aria-hidden="true"><path d="M1 1H45L23 39Z" fill="#1d1d1d" stroke="#bbb"/><path d="M11 7H35L23 28Z" fill="#ddd"/></svg>:<i aria-hidden="true"/>}</button>)}</div>
        <button className={'inventory-filter-trigger'+(filterOpen?' active':'')} ref={filterButton} aria-label="필터" aria-haspopup="dialog" aria-expanded={filterOpen} onClick={openFilters} disabled={!data}><FilterMark/><strong>필터</strong></button>
        {data?<>
          <div className="inventory-items" role="tabpanel" id="inventory-items" aria-labelledby={'inventory-tab-'+category}>
            <div className="inventory-grid">{items.map(item=><button className={'inventory-slot'+(selected?.id===item.id?' selected':'')} key={item.id} aria-label={item.name+(item.equipped?' · 장착중':' · 보유중')} aria-pressed={selected?.id===item.id} title={item.name} onClick={()=>setSelectedId(item.id)}><div className="inventory-slot-picture"><ItemArt item={item}/>{item.quantity>1&&<small className="inventory-quantity">×{item.quantity}</small>}{isInventoryProtected(item,data.settings)&&<span className="inventory-slot-lock" aria-label="삭제 잠금"><img src={art('lock')} alt=""/></span>}</div><span className="inventory-slot-status">{isInventoryExpired(item,now)?'기간 만료':item.equipped?'장착중':'보유중'}</span></button>)}</div>
            {!items.length&&<div className="inventory-empty">{data.settings.query?'검색 조건에 맞는 아이템이 없습니다.':'보유한 아이템이 없습니다.'}</div>}
          </div>
          <CityCurrencyBalance kind="points" amount={data.points} className="inventory-points"/>
          <section className="inventory-detail" aria-label="선택한 아이템 정보">
            {selected?<>
              <div className="inventory-detail-art"><img className="inventory-detail-facets" src="/assets/inventory/detail-facets.svg?v=2" alt="" aria-hidden="true"/><p className="inventory-item-subtitle">{selected.subtitle}</p><div className="inventory-detail-picture"><ItemArt item={selected} large/></div><span className="inventory-detail-status">{expired?'기간 만료':selected.equipped?'장착중':'보유중'}</span><button className={'inventory-lock'+(protectedItem?' locked':'')} aria-label={protectedItem?'아이템 잠금 해제':'아이템 잠금'} aria-pressed={protectedItem} disabled={busy} title={protectedItem?'삭제 잠금 적용중':'삭제 잠금'} onClick={()=>act('lock')}><img src={art('lock')} alt=""/></button><button className="inventory-delete" aria-label="아이템 삭제" disabled={busy||protectedItem} title={protectedItem?'잠금을 해제한 뒤 삭제할 수 있습니다.':'아이템 삭제'} onClick={()=>act('delete')}><img src={art('delete')} alt=""/></button></div>
              <header className="inventory-detail-heading"><h3>{selected.name}</h3><div className="inventory-rarity" aria-label={`${selected.rarity}등급`}>{[1,2,3].map(value=><svg key={value} width="28" height="29" viewBox="0 0 28 29" aria-hidden="true"><path d="M14 0L17 11L28 14L17 17L14 29L11 17L0 14L11 11Z" fill={value<=selected.rarity?'#fff':'#080808'}/></svg>)}</div></header>
              <div className="inventory-description"><p>{selected.description}</p>{selected.expiresAt!==null&&<p className="inventory-expiry">{expired?'사용 기간 만료':'사용 기한'} : {new Date(selected.expiresAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p>}</div>
              <footer className="inventory-detail-actions"><span className="inventory-action-rule" aria-hidden="true"/>{selected.category==='skin'?<><button className="inventory-button dark" disabled={busy||!selected.equipped} onClick={()=>act('unequip')}>장착 해제</button><button className="inventory-button light" disabled={busy||expired} onClick={()=>act('equip')}>장착</button></>:selected.category==='consumable'?<><span className="inventory-held-quantity">보유 수량 : {selected.quantity}</span><button className="inventory-button light" disabled={busy||expired} onClick={()=>act('use')}>사용하기</button></>:<p className="inventory-held-event">{selected.category==='event'?'이벤트 기념 아이템':'보유 아이템'}</p>}</footer>
            </>:<div className="inventory-detail-empty">아이템을 선택해주세요.</div>}
          </section>
        </>:<div className="inventory-loading" role="status">{loadError?<><p>{loadError}</p><button onClick={()=>setAttempt(v=>v+1)}>다시 불러오기</button></>:<><Loader2 size={30} className="spin"/><p>인벤토리를 불러오는 중…</p></>}</div>}
        {filterOpen&&<section className="inventory-filter" role="dialog" aria-label="인벤토리 필터" ref={filter}>
          <header><FilterMark/><h3>필터</h3><button aria-label="필터 닫기" onClick={()=>{setFilterOpen(false);filterButton.current?.focus();}}><img src={art('close')} alt=""/></button></header>
          <form onSubmit={async event=>{event.preventDefault();if(await request('settings',{settings:draft})){setFilterOpen(false);filterButton.current?.focus();setMessage('필터 설정을 저장했습니다.');}}}>
            <label className="inventory-search"><Search size={33}/><span><input ref={search} aria-label="검색할 아이템" placeholder="검색할 아이템을 입력하세요." maxLength={40} value={draft.query} onChange={event=>setDraft(v=>({...v,query:event.target.value}))}/></span></label>
            <div className="inventory-filter-rule first"/>
            <h4 className="inventory-sort-label">정렬</h4><div className="inventory-sort-options" role="radiogroup" aria-label="아이템 정렬">{sorts.map(([id,label])=><button type="button" className={draft.sort===id?'selected':''} role="radio" aria-checked={draft.sort===id} key={id} onClick={()=>setDraft(v=>({...v,sort:id}))}>{draft.sort===id&&<i aria-hidden="true"/>}{label}</button>)}</div>
            <div className="inventory-filter-rule second"/><h4 className="inventory-other-label">기타 설정</h4>
            <button type="button" className={'inventory-filter-option expiry'+(draft.expiryAlerts?' selected':'')} aria-pressed={draft.expiryAlerts} onClick={()=>setDraft(v=>({...v,expiryAlerts:!v.expiryAlerts}))}>{draft.expiryAlerts&&<i aria-hidden="true"/>}기간제 아이템 만료 알림</button>
            <button type="button" className={'inventory-filter-option protect'+(draft.protectEvents?' selected':'')} aria-pressed={draft.protectEvents} onClick={()=>setDraft(v=>({...v,protectEvents:!v.protectEvents}))}>{draft.protectEvents&&<i aria-hidden="true"/>}이벤트 아이템 삭제 잠금</button>
            <button className="inventory-button dark inventory-save" disabled={busy}>설정 저장</button>
          </form>
        </section>}
      </section>
      {notice&&<div className="inventory-subshade" onPointerDown={event=>{if(event.target===event.currentTarget&&!busy)setNotice(null);}}>
        <section className={'inventory-popup '+(notice.kind==='delete'?'confirm':'result')} role="alertdialog" aria-modal="true" aria-labelledby="inventory-popup-heading" aria-describedby="inventory-popup-description" ref={popup}>
          {notice.kind==='delete'?<><div className="inventory-popup-ring"/><div className="inventory-popup-inner"><img className="inventory-confirm-facets" src="/assets/inventory/dialog-facets.svg?v=2" alt=""/><header><h2 id="inventory-popup-heading">아이템 삭제</h2></header><h3>{notice.item?.name}</h3><p id="inventory-popup-description">해당 아이템을 삭제합니다. <strong>한번 삭제한 아이템은 다시 복구할 수 없습니다.</strong><br/>신중하게 생각해주세요.</p><div className="inventory-popup-actions"><span aria-hidden="true"/><button className="inventory-button dark" disabled={busy} onClick={()=>setNotice(null)}>취소</button><button className="inventory-button light" disabled={busy} onClick={deleteItem}>{busy?'삭제 중…':'삭제하기'}</button></div></div></>:<><img className="inventory-result-facets" src="/assets/inventory/success-facets.svg?v=2" alt=""/><h2 id="inventory-popup-heading">{notice.kind==='deleted'?'아이템을 성공적으로 삭제했습니다.':notice.message}</h2><span id="inventory-popup-description" className="inventory-sr-only">확인하면 인벤토리로 돌아갑니다.</span><button className="inventory-button dark" onClick={()=>{setNotice(null);closeButton.current?.focus();}}>확인</button></>}
        </section>
      </div>}
    </div>
    {message&&<div className="inventory-toast" role="status"><span>{message}</span><button aria-label="인벤토리 알림 닫기" onClick={()=>setMessage('')}>×</button></div>}
  </div>;
}
