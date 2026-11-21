import {createInventoryState,type InventoryState} from './inventory';
import {createShopState,normalizeShopState,shopProducts,recordShopPurchase,grantShopRewards,nextShopReset,SHOP_REFRESH_PRICE,type ShopState} from './shop';

type Context={db:()=>any;needUser:(req:Request)=>Promise<any>;json:(value:any,status?:number)=>Response;fail:(message:string,status?:number)=>Error};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function handleShop(req:Request,path:string[],body:any,c:Context):Promise<Response|null>{
  if(path[0]!=='shop')return null;
  const action=path[1],get=req.method==='GET'&&path.length===1;
  if(!get&&!(req.method==='POST'&&path.length===2&&['intro','purchase','refresh'].includes(action)))throw c.fail('상점 경로를 확인해주세요.',404);
  const user=await c.needUser(req);if(!user.nicknameSet)throw c.fail('먼저 사용할 닉네임을 설정해주세요.',403);
  const db=c.db(),now=Date.now();
  await db.prepare('INSERT OR IGNORE INTO player_shop_states(user_id,data,revision) VALUES(?,?,0)').bind(user.id,JSON.stringify(createShopState(now))).run();
  const row=await db.prepare('SELECT data,revision FROM player_shop_states WHERE user_id=?').bind(user.id).first();
  const state=normalizeShopState(JSON.parse(row.data),now) as ShopState;
  async function view(){
    const fresh=await db.prepare('SELECT data,revision FROM player_shop_states WHERE user_id=?').bind(user.id).first();
    const wallet=await db.prepare('SELECT points,primacy_tokens AS primacyTokens FROM player_profiles WHERE user_id=?').bind(user.id).first();
    const at=Date.now(),s=normalizeShopState(JSON.parse(fresh.data),at);
    return{products:shopProducts(s,at),points:Number(wallet?.points)||0,primacyTokens:Number(wallet?.primacyTokens)||0,revision:Number(fresh.revision),introSeen:s.introSeen,dailyKey:s.day+':'+s.refresh,nextResetAt:nextShopReset(at),now:at,refreshPrice:SHOP_REFRESH_PRICE};
  }
  if(get)return c.json(await view());
  if(action==='intro'){
    if(!body||typeof body!=='object'||Object.keys(body).length)throw c.fail('요청 내용을 확인해주세요.');
    await db.prepare("UPDATE player_shop_states SET data=json_set(data,'$.introSeen',json('true')),revision=revision+1 WHERE user_id=? AND json_extract(data,'$.introSeen')=0").bind(user.id).run();
    return c.json(await view());
  }
  const allowed=action==='purchase'?['requestId','revision','productId','offerKey']:['requestId','revision','dailyKey'];
  if(!body||typeof body!=='object'||Object.keys(body).some(key=>!allowed.includes(key))||!uuid.test(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0)throw c.fail('구매 요청을 확인해주세요.');
  const productId=action==='refresh'?'daily-refresh':body.productId;
  if(typeof productId!=='string')throw c.fail('상품을 선택해주세요.');
  const orderId=user.id+':'+body.requestId;
  async function prior(){const order=await db.prepare('SELECT product_id AS productId,result FROM shop_orders WHERE id=? AND user_id=?').bind(orderId,user.id).first();if(!order)return null;if(order.productId!==productId)throw c.fail('다른 구매에 사용한 요청입니다. 다시 시도해주세요.',409);return JSON.parse(order.result);}
  const previous=await prior();if(previous)return c.json({...(await view()),receipt:previous,replayed:true});
  if(Number(row.revision)!==body.revision)throw c.fail('다른 창에서 상점이 변경되었습니다. 다시 확인해주세요.',409);
  let cost=SHOP_REFRESH_PRICE,next=state,rewards:any[]=[];
  if(action==='refresh'){
    if(body.dailyKey!==state.day+':'+state.refresh)throw c.fail('무료 상품이 갱신되었습니다. 다시 확인해주세요.',409);
    next={...state,refresh:state.refresh+1,daily:[0,0,0]};
  }else{
    const product=shopProducts(state,now).find(p=>p.id===productId);
    if(!product)throw c.fail('상품을 찾을 수 없습니다.',404);
    if(product.payment||product.currency==='krw')throw c.fail('실제 결제는 준비 중입니다.',503);
    if(product.offerKey!==body.offerKey)throw c.fail('상품이 갱신되었습니다. 다시 확인해주세요.',409);
    if(product.unavailable)throw c.fail(product.unavailable,409);
    cost=product.price!;rewards=product.rewards;next=recordShopPurchase(state,product);
  }
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO player_profiles(user_id) VALUES(?)').bind(user.id),
    db.prepare('INSERT OR IGNORE INTO player_inventories(user_id,data,revision) VALUES(?,?,0)').bind(user.id,JSON.stringify(createInventoryState(now))),
  ]);
  const inventory=await db.prepare('SELECT data,revision FROM player_inventories WHERE user_id=?').bind(user.id).first();
  const nextInventory=grantShopRewards(JSON.parse(inventory.data) as InventoryState,rewards,now);
  const attemptId=crypto.randomUUID(),receipt={id:body.requestId,productId,paidPoints:cost,rewards,at:now};
  // D1 batch commits the guarded order, debit, rewards and limit counters together.
  // Every write is tied to this unique server attempt, including the zero-insert case.
  let results;
  try{results=await db.batch([
    db.prepare('INSERT INTO shop_orders(id,user_id,product_id,attempt_id,result,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM player_shop_states WHERE user_id=? AND revision=?) AND EXISTS(SELECT 1 FROM player_inventories WHERE user_id=? AND revision=?) AND EXISTS(SELECT 1 FROM player_profiles WHERE user_id=? AND points>=?)').bind(orderId,user.id,productId,attemptId,JSON.stringify(receipt),now,user.id,Number(row.revision),user.id,Number(inventory.revision),user.id,cost),
    db.prepare('UPDATE player_profiles SET points=points-? WHERE user_id=? AND EXISTS(SELECT 1 FROM shop_orders WHERE id=? AND attempt_id=?)').bind(cost,user.id,orderId,attemptId),
    db.prepare('UPDATE player_inventories SET data=?,revision=revision+1 WHERE user_id=? AND EXISTS(SELECT 1 FROM shop_orders WHERE id=? AND attempt_id=?)').bind(JSON.stringify(nextInventory),user.id,orderId,attemptId),
    db.prepare('UPDATE player_shop_states SET data=?,revision=revision+1 WHERE user_id=? AND EXISTS(SELECT 1 FROM shop_orders WHERE id=? AND attempt_id=?)').bind(JSON.stringify(next),user.id,orderId,attemptId),
  ]);}catch(error){
    const replay=await prior();if(replay)return c.json({...(await view()),receipt:replay,replayed:true});throw error;
  }
  if(!results[0].meta.changes){
    const replay=await prior();if(replay)return c.json({...(await view()),receipt:replay,replayed:true});
    const balance=await db.prepare('SELECT points FROM player_profiles WHERE user_id=?').bind(user.id).first();
    if(Number(balance?.points)<cost)throw c.fail('보유 포인트가 부족합니다.',409);
    throw c.fail('상점 또는 인벤토리가 변경되었습니다. 다시 확인해주세요.',409);
  }
  return c.json({...(await view()),receipt});
}
