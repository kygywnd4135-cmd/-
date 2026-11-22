import {applyInventoryAction,createInventoryState,inventoryItems,inventoryCatalog,validateInventorySettings,type InventoryState} from './inventory';

type Context={db:()=>any;needUser:(req:Request)=>Promise<any>;json:(value:any)=>Response;fail:(message:string,status?:number)=>Error};

export async function handleInventory(req:Request,path:string[],body:any,c:Context):Promise<Response|null>{
  if(path[0]!=='inventory')return null;
  const get=req.method==='GET'&&path.length===1;
  const settings=req.method==='POST'&&path.length===2&&path[1]==='settings';
  const item=req.method==='POST'&&path.length===2&&path[1]==='item';
  if(!get&&!settings&&!item)throw c.fail('인벤토리 경로를 확인해주세요.',404);
  const user=await c.needUser(req);
  if(!user.nicknameSet)throw c.fail('먼저 사용할 닉네임을 설정해주세요.',403);
  const initial=createInventoryState(Date.now());
  await c.db().prepare('INSERT OR IGNORE INTO player_inventories(user_id,data,revision) VALUES(?,?,0)').bind(user.id,JSON.stringify(initial)).run();
  const row=await c.db().prepare('SELECT data,revision FROM player_inventories WHERE user_id=?').bind(user.id).first();
  let state=JSON.parse(row.data) as InventoryState,revision=Number(row.revision);
  if(!get){
    const allowed=settings?['revision','settings']:['revision','itemId','action'];
    if(!body||typeof body!=='object'||Object.keys(body).some(key=>!allowed.includes(key))||!Number.isSafeInteger(body.revision)||body.revision<0)throw c.fail('요청 내용을 확인해주세요.');
    if(body.revision!==revision)throw c.fail('다른 창에서 인벤토리가 변경되었습니다. 다시 확인해주세요.',409);
    try{
      if(settings)state={...state,settings:validateInventorySettings(body.settings)};
      else{
        if(typeof body.itemId!=='string'||typeof body.action!=='string')throw new Error('아이템 동작을 확인해주세요.');
        state=applyInventoryAction(state,body.itemId,body.action,Date.now());
      }
    }catch(error){throw c.fail((error as Error).message);}
    const definition=item&&body.action==='use'?inventoryCatalog.find(entry=>entry.id===body.itemId):null;
    const credit=definition&&'creditPoints' in definition?definition.creditPoints:definition&&'randomPoints' in definition?100+(crypto.getRandomValues(new Uint32Array(1))[0]%401):0;
    const mutationId=crypto.randomUUID();state={...state,mutationId};
    if(credit)await c.db().prepare('INSERT OR IGNORE INTO player_profiles(user_id) VALUES(?)').bind(user.id).run();
    const statements=[c.db().prepare('UPDATE player_inventories SET data=?,revision=revision+1 WHERE user_id=? AND revision=? AND (?=0 OR EXISTS(SELECT 1 FROM player_profiles WHERE user_id=? AND points<=?))').bind(JSON.stringify(state),user.id,revision,credit,user.id,Number.MAX_SAFE_INTEGER-credit)];
    if(credit)statements.push(c.db().prepare("UPDATE player_profiles SET points=points+? WHERE user_id=? AND EXISTS(SELECT 1 FROM player_inventories WHERE user_id=? AND json_extract(data,'$.mutationId')=?)").bind(credit,user.id,user.id,mutationId));
    const [result]=await c.db().batch(statements);
    if(!result.meta.changes)throw c.fail('다른 창에서 인벤토리가 변경되었습니다. 다시 확인해주세요.',409);
    revision++;
  }
  const wallet=await c.db().prepare('SELECT points FROM player_profiles WHERE user_id=?').bind(user.id).first();
  return c.json({items:inventoryItems(state),settings:state.settings,revision,points:Number(wallet?.points)||0,demo:true});
}
