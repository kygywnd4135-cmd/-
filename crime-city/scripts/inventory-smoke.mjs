import assert from 'node:assert/strict';
import {createInventoryState,inventoryItems,selectInventoryItems,applyInventoryAction,inventoryExpiryAlerts,validateInventorySettings,defaultInventorySettings} from '../app/lib/inventory.ts';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const suffix=crypto.randomUUID().replaceAll('-','').slice(0,7),accounts=[];let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++;}
function throws(fn){assert.throws(fn);checks++;}
async function call(path,body,a,status=200,headers={}){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(a?{cookie:a.cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,path+': '+text);checks++;return {data:r.headers.get('content-type')?.includes('application/json')?JSON.parse(text):{error:text},cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function make(label,pending=false){const loginId='Inventory'+suffix+label;const r=await call('auth/signup',{loginId,password:'InventoryLocal42!'});const a={id:r.data.user.id,cookie:r.cookie,loginId};accounts.push(a);if(!pending)await call('profile/nickname',{nickname:'가방'+suffix+label},a);return a;}
const read=async a=>(await call('inventory',undefined,a)).data;
const item=async(a,v,itemId,action,status=200)=>(await call('inventory/item',{revision:v.revision,itemId,action},a,status)).data;
const now=Date.now(),state=createInventoryState(now),items=inventoryItems(state);
eq(items.length,8);eq(items.filter(v=>v.equipped).length,2);
eq(selectInventoryItems(items,'misc',defaultInventorySettings).length,4);
eq(selectInventoryItems(items,'misc',{...defaultInventorySettings,query:'방랑자'}).map(v=>v.id),['wanderer']);
eq(selectInventoryItems(items,'consumable',defaultInventorySettings).length,2);
eq(selectInventoryItems(items,'event',defaultInventorySettings).length,2);
eq(selectInventoryItems(items,'all',{...defaultInventorySettings,query:'방랑자'}).map(v=>v.id),['wanderer']);
eq(selectInventoryItems(items,'all',{...defaultInventorySettings,query:'없는물건'}),[]);
for(const sort of ['grade','acquired','name','set']){const sorted=selectInventoryItems([...items].reverse(),'all',{...defaultInventorySettings,sort});eq(sorted.length,8);if(sort==='grade')eq(sorted.map(v=>v.rarity),[1,1,1,1,2,2,3,3]);if(sort==='acquired')eq(sorted.map(v=>v.id),items.map(v=>v.id));}
eq(inventoryExpiryAlerts(items,defaultInventorySettings,now+8*86400000).length,2);
eq(inventoryExpiryAlerts(items,{...defaultInventorySettings,expiryAlerts:false},now+8*86400000).length,0);
throws(()=>applyInventoryAction(state,'night-ticket','use',now+4*86400000));
throws(()=>applyInventoryAction(state,'opening-badge','delete',now));
throws(()=>applyInventoryAction(state,'opening-badge','equip',now));
throws(()=>applyInventoryAction(state,'wanderer','use',now));
throws(()=>applyInventoryAction(state,'imaginary','equip',now));
throws(()=>validateInventorySettings({...defaultInventorySettings,points:900}));
throws(()=>validateInventorySettings({...defaultInventorySettings,sort:'unknown'}));
throws(()=>validateInventorySettings({...defaultInventorySettings,query:'a'.repeat(41)}));
eq(inventoryItems(state),items);
try{
 const a=await make('A'),b=await make('B'),pending=await make('C',true);
 await call('inventory',undefined,undefined,401);await call('inventory',undefined,pending,403);
 let v=await read(a);eq(v.items.length,8);eq(v.points,0);eq(v.primacyTokens,0);eq(v.revision,0);
 eq((await call('me',undefined,a)).data.user.primacyTokens,v.primacyTokens);
 await call('inventory/item',{revision:v.revision,itemId:'wanderer',action:'lock',primacyTokens:999},a,400);
 await call('inventory/settings',{revision:v.revision,settings:defaultInventorySettings},undefined,401);
 await call('inventory/item',{revision:v.revision,itemId:'wanderer',action:'lock'},pending,403);
 await call('inventory/item',{revision:v.revision,userId:b.id,itemId:'wanderer',action:'lock'},a,400);
 await call('inventory/item',{revision:v.revision,itemId:'wanderer',action:'lock'},a,403,{origin:'https://untrusted.example'});
 v=await item(a,v,'wanderer','lock');eq(v.items.find(x=>x.id==='wanderer').locked,true);eq(v.primacyTokens,0);
 await item(a,v,'wanderer','delete',400);eq((await read(b)).items.find(x=>x.id==='wanderer').locked,false);
 await call('inventory/item',{revision:0,itemId:'wanderer',action:'lock'},a,409);
 v=await item(a,v,'wanderer','lock');eq(v.items.find(x=>x.id==='wanderer').locked,false);
 v=await item(a,v,'detective','equip');eq(v.items.find(x=>x.id==='wanderer').equipped,false);eq(v.items.find(x=>x.id==='detective').equipped,true);eq(v.items.find(x=>x.id==='frost').equipped,true);
 v=await item(a,v,'detective','unequip');eq(v.items.find(x=>x.id==='detective').equipped,false);
 v=await item(a,v,'night-ticket','use');eq(v.items.find(x=>x.id==='night-ticket').quantity,2);
 await item(a,v,'opening-badge','delete',400);
 const saved={query:' 스킨 ',sort:'set',expiryAlerts:false,protectEvents:false};
 v=(await call('inventory/settings',{revision:v.revision,settings:saved},a)).data;eq(v.settings,{...saved,query:'스킨'});eq((await read(a)).settings,v.settings);
 v=await item(a,v,'opening-badge','lock');await item(a,v,'opening-badge','delete',400);
 v=await item(a,v,'opening-badge','lock');v=await item(a,v,'opening-badge','delete');eq(v.items.some(x=>x.id==='opening-badge'),false);
 v=await item(a,v,'wanderer','delete');eq(v.items.some(x=>x.id==='wanderer'),false);eq((await read(a)).items.some(x=>x.id==='wanderer'),false);eq((await read(b)).items.length,8);
 await item(a,v,'wanderer','equip',400);await item(a,v,'frost','restore',400);
 await call('inventory/settings',{revision:v.revision,settings:{...saved,sort:'hack'}},a,400);
 const publicProfile=(await call('profiles/'+a.id,undefined,b)).data;eq(JSON.stringify(publicProfile).includes('inventory'),false);eq(JSON.stringify(publicProfile).includes('loginId'),false);
 // Simultaneous updates must not overwrite one another.
 const revision=v.revision;const race=await Promise.all(['midnight','frost'].map(itemId=>fetch(base+'/api/inventory/item',{method:'POST',headers:{cookie:a.cookie,'content-type':'application/json'},body:JSON.stringify({revision,itemId,action:'lock'})})));eq(race.map(r=>r.status).sort(),[200,409]);
 v=await read(a);eq(v.revision,revision+1);
 // One account is reserved for browser QA; it remains disposable and unmodified.
 const ui=await make('D');console.log('UI_QA_LOGIN='+ui.loginId);console.log(`PASS: ${checks} inventory checks: sorting, categories, search, expiry, ownership, lock/delete, persistence, equipment, quantity, conflict and CSRF.`);
}finally{for(const a of accounts)await call('auth/logout',{},a).catch(()=>{});}

