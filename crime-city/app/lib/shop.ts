import {inventoryCatalog,type InventoryState} from './inventory';

export type ShopTab='data'|'points'|'primacy';
export type ShopReward={itemId:string;quantity:number;name:string};
export type ShopState={introSeen:boolean;createdAt:number;day:string;month:string;refresh:number;daily:number[];monthly:Record<string,number>;lifetime:Record<string,number>};
export type ShopProduct={id:string;tab:ShopTab;name:string;caption?:string;price:number|null;originalPrice?:number;currency:'points'|'krw';art:string|null;rewards:ShopReward[];period?:'daily'|'monthly'|'lifetime';limit?:number;dailySlot?:number;gift?:boolean;payment?:boolean;offerKey:string;remaining:number|null;daysLeft?:number;unavailable?:string;coinAmount?:number};
export type ShopView={products:ShopProduct[];points:number;primacyTokens:number;revision:number;introSeen:boolean;dailyKey:string;nextResetAt:number;now:number;refreshPrice:number};
export const SHOP_REFRESH_PRICE=1500;
const DAY=86400000,OFFSET=9*3600000;
export const shopDay=(now:number)=>new Date(now+OFFSET).toISOString().slice(0,10);
export const nextShopReset=(now:number)=>(Math.floor((now+OFFSET)/DAY)+1)*DAY-OFFSET;
export function createShopState(now:number):ShopState{return{introSeen:false,createdAt:now,day:shopDay(now),month:shopDay(now).slice(0,7),refresh:0,daily:[0,0,0],monthly:{},lifetime:{}};}
export function normalizeShopState(state:ShopState,now:number):ShopState{
  const day=shopDay(now),month=day.slice(0,7);
  return{...state,day,month,refresh:state.day===day?state.refresh:0,daily:state.day===day?[...state.daily]:[0,0,0],monthly:state.month===month?{...state.monthly}:{},lifetime:{...state.lifetime}};
}
const reward=(itemId:string,quantity=1):ShopReward=>{const item=inventoryCatalog.find(item=>item.id===itemId);if(!item)throw new Error('상품 구성 오류');return{itemId,quantity,name:item.name};};
const dailyPool=['shop-boost-2','shop-nickname-color','shop-random-points','shop-list-chart','shop-partner-chart'];
export function shopProducts(state:ShopState,now:number):ShopProduct[]{
  const s=normalizeShopState(state,now),elapsed=Math.floor((Date.parse(s.day+'T00:00:00Z')-Date.UTC(2026,9,27))/DAY);
  const shift=((elapsed+s.refresh)%dailyPool.length+dailyPool.length)%dailyPool.length;
  const daily=dailyPool.map((_,i)=>dailyPool[(i+shift)%dailyPool.length]).slice(0,3);
  const daysLeft=Math.max(0,Math.ceil((s.createdAt+22*DAY-now)/DAY));
  const products:Omit<ShopProduct,'offerKey'|'remaining'>[]=[
    {id:'document-i',tab:'data',name:'정보상의 비밀문서함 I',caption:'첫방문을 환영해!',price:5900,originalPrice:10800,currency:'points',art:'data-104',period:'lifetime',limit:2,daysLeft,rewards:[reward('shop-voucher-5900'),reward('shop-resident-frame'),reward('shop-resident-nameplate'),reward('shop-list-chart',5)]},
    {id:'document-ii',tab:'data',name:'정보상의 비밀문서함 II',caption:'첫방문을 환영해!',price:12400,originalPrice:25600,currency:'points',art:'data-152',period:'lifetime',limit:2,daysLeft,rewards:[reward('shop-voucher-12400'),reward('shop-resident-frame'),reward('shop-resident-nameplate'),reward('shop-list-chart',10),reward('shop-partner-chart',5),reward('shop-boost-3')]},
    {id:'document-iii',tab:'data',name:'정보상의 비밀문서함 III',caption:'첫방문을 환영해!',price:29800,originalPrice:56800,currency:'points',art:'data-84',period:'lifetime',limit:2,daysLeft,rewards:[reward('shop-voucher-29800'),reward('shop-resident-frame'),reward('shop-resident-nameplate'),reward('shop-list-chart',25),reward('shop-partner-chart',10),reward('shop-boost-3',3),reward('shop-nickname-color',3),reward('shop-random-points',3)]},
    ...daily.map((itemId,index)=>({id:'daily-'+index,tab:'points' as const,name:reward(itemId).name,price:0,currency:'points' as const,art:null,gift:true,period:'daily' as const,limit:1,dailySlot:index,rewards:[reward(itemId)]})),
    {id:'boost-3',tab:'points',name:'슈퍼 방장 부스트 + 3일',price:12000,currency:'points',art:null,rewards:[reward('shop-boost-3')]},
    {id:'partner-chart',tab:'points',name:'파트너 리스트업 차트',price:4500,currency:'points',art:null,period:'monthly',limit:5,rewards:[reward('shop-partner-chart')]},
    {id:'list-chart',tab:'points',name:'리스트업 차트',price:3500,currency:'points',art:null,period:'monthly',limit:5,rewards:[reward('shop-list-chart')]},
    {id:'host-boost',tab:'points',name:'슈퍼 방장 부스트',price:5900,currency:'points',art:null,rewards:[reward('shop-host-boost')]},
    {id:'monthly-ticket',tab:'primacy',name:'상인단의 비밀티켓',caption:'매일 접속시',price:null,currency:'krw',art:'primacy-124',payment:true,coinAmount:300,rewards:[],unavailable:'월간 티켓은 결제 준비 중입니다.'},
    ...[{amount:300,price:500,art:'primacy-212'},{amount:1650,price:1500,art:'primacy-194'},{amount:7500,price:4500,art:'primacy-110'},{amount:17500,price:9800,art:'primacy-168'},{amount:67800,price:29800,art:'primacy-92'},{amount:0,price:3900,art:'primacy-70'}].map((v,index)=>({id:'coins-'+index,tab:'primacy' as const,name:v.amount?'프리머시 코인 '+v.amount+'개':'프리머시 코인',price:v.price,currency:'krw' as const,art:v.art,payment:true,coinAmount:v.amount,rewards:[],unavailable:'실제 결제는 준비 중입니다.'})),
  ];
  return products.map(p=>{const used=p.period==='daily'?s.daily[p.dailySlot!]:p.period==='monthly'?s.monthly[p.id]||0:s.lifetime[p.id]||0;return{...p,offerKey:p.gift?`${s.day}:${s.refresh}:${p.id}:${p.rewards[0].itemId}`:'v1:'+p.id,remaining:p.limit===undefined?null:Math.max(0,p.limit-used),unavailable:p.unavailable||(p.daysLeft===0?'판매가 종료된 상품입니다.':p.limit!==undefined&&used>=p.limit?'구매 가능한 횟수를 모두 사용했습니다.':undefined)};});
}
export function recordShopPurchase(state:ShopState,product:ShopProduct):ShopState{
  const s={...state,daily:[...state.daily],monthly:{...state.monthly},lifetime:{...state.lifetime}};
  if(product.period==='daily')s.daily[product.dailySlot!]++;
  if(product.period==='monthly')s.monthly[product.id]=(s.monthly[product.id]||0)+1;
  if(product.period==='lifetime')s.lifetime[product.id]=(s.lifetime[product.id]||0)+1;
  return s;
}
export function grantShopRewards(state:InventoryState,rewards:ShopReward[],now:number):InventoryState{
  const next={...state,settings:{...state.settings},entries:state.entries.map(entry=>({...entry}))};
  for(const reward of rewards){
    if(!inventoryCatalog.some(item=>item.id===reward.itemId)||!Number.isSafeInteger(reward.quantity)||reward.quantity<1)throw new Error('상품 구성을 확인해주세요.');
    const entry=next.entries.find(entry=>entry.id===reward.itemId);
    if(entry){entry.quantity=(entry.deletedAt?0:entry.quantity)+reward.quantity;entry.deletedAt=null;entry.acquiredAt=now;}
    else next.entries.push({id:reward.itemId,quantity:reward.quantity,equipped:false,locked:false,acquiredAt:now,expiresAt:null,deletedAt:null});
  }
  return next;
}
