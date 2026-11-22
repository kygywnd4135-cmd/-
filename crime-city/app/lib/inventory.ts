export type InventoryCategory = 'all' | 'consumable' | 'misc' | 'event';
export type InventoryItemCategory = 'skin' | 'consumable' | 'misc' | 'event';
export type InventorySort = 'grade' | 'acquired' | 'name' | 'set';
export type InventorySettings = {query: string; sort: InventorySort; expiryAlerts: boolean; protectEvents: boolean};
export type InventoryEntry = {id: string; quantity: number; equipped: boolean; locked: boolean; acquiredAt: number; expiresAt: number | null; deletedAt: number | null};
export type InventoryState = {entries: InventoryEntry[]; settings: InventorySettings; mutationId?: string};
export type InventoryItem = InventoryEntry & {name: string; category: InventoryItemCategory; rarity: number; setName: string; subtitle: string; description: string; art: string; slot?: string};
export type InventoryView = {items: InventoryItem[]; settings: InventorySettings; revision: number; points: number; demo: boolean};

export const inventoryCatalog = [
  {id:'wanderer',name:'자유로운 방랑자 스킨',category:'skin',rarity:1,setName:'서부의 방랑자',subtitle:'캐릭터 스킨 : 여자 A',description:'무언의 압박이 느껴지는 서부의 방랑자 여자 A 스킨이다.\n장착시 여자A 역할군의 일러스트가 변경된다.',art:'wanderer',slot:'female-a'},
  {id:'frost',name:'서리의 수호자 스킨',category:'skin',rarity:1,setName:'얼어붙은 새벽',subtitle:'캐릭터 스킨 : 남자 A',description:'차가운 새벽을 지키는 수호자의 임시 스킨이다.\n남자 A 슬롯에 장착할 수 있다.',art:'frost',slot:'male-a'},
  {id:'detective',name:'새벽의 탐정 스킨',category:'skin',rarity:2,setName:'서부의 방랑자',subtitle:'캐릭터 스킨 : 여자 A',description:'오래된 사건을 따라가는 탐정의 임시 스킨이다.\n여자 A 슬롯의 기존 스킨과 교체 장착된다.',art:'placeholder',slot:'female-a'},
  {id:'night-ticket',name:'밤의 조사권',category:'consumable',rarity:1,setName:'탐정의 도구',subtitle:'소비 아이템 : 기간제',description:'인벤토리 사용 동작을 확인하는 임시 조사권이다.\n사용하면 수량이 1개 줄어든다. 게임 혜택은 아직 연결되지 않았다.',art:'placeholder',days:3,quantity:3},
  {id:'memory-fragment',name:'기억의 조각',category:'consumable',rarity:2,setName:'탐정의 도구',subtitle:'소비 아이템',description:'흩어진 기억을 모은 임시 아이템이다.\n사용하면 수량이 1개 줄어든다. 게임 혜택은 아직 연결되지 않았다.',art:'placeholder',quantity:5},
  {id:'opening-badge',name:'크라임 시티 개장 기념 배지',category:'event',rarity:3,setName:'도시의 첫 번째 밤',subtitle:'이벤트 아이템',description:'도시의 첫 번째 밤을 기념하는 임시 배지다.\n필터의 이벤트 아이템 삭제 잠금을 적용받는다.',art:'placeholder'},
  {id:'festival-seal',name:'백야제의 초대장',category:'event',rarity:1,setName:'도시의 첫 번째 밤',subtitle:'이벤트 아이템 : 기간제',description:'백야제에 도착한 임시 초대장이다.\n만료되면 만료 알림 설정에 따라 안내한다.',art:'placeholder',days:7},
  {id:'midnight',name:'자정의 기록자 스킨',category:'skin',rarity:3,setName:'얼어붙은 새벽',subtitle:'캐릭터 스킨 : 남자 A',description:'자정의 기록을 지키는 임시 스킨이다.\n남자 A 슬롯의 기존 스킨과 교체 장착된다.',art:'placeholder',slot:'male-a'},
  {"id":"shop-voucher-5900","name":"5900 포인트 교환권","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"사용하면 5,900포인트를 받습니다.","art":"placeholder","shopOnly":true,"creditPoints":5900},
  {"id":"shop-voucher-12400","name":"12400 포인트 교환권","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"사용하면 12,400포인트를 받습니다.","art":"placeholder","shopOnly":true,"creditPoints":12400},
  {"id":"shop-voucher-29800","name":"29800 포인트 교환권","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"사용하면 29,800포인트를 받습니다.","art":"placeholder","shopOnly":true,"creditPoints":29800},
  {"id":"shop-resident-frame","name":"‘크라임 시티 입주민’ 테두리","category":"misc","rarity":1,"setName":"정보 상인단","subtitle":"기타 아이템","description":"정보상의 비밀문서함에서 획득한 임시 테두리입니다. 프로필 꾸미기 연동은 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-resident-nameplate","name":"‘크라임 시티 입주민’ 명찰","category":"misc","rarity":1,"setName":"정보 상인단","subtitle":"기타 아이템","description":"정보상의 비밀문서함에서 획득한 임시 명찰입니다. 명찰 적용 기능은 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-list-chart","name":"리스트업 차트","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"상점에서 획득하는 임시 소비 아이템입니다. 게임 내 효과는 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-partner-chart","name":"파트너 리스트업 차트","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"상점에서 획득하는 임시 소비 아이템입니다. 파트너 기능 연동은 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-boost-2","name":"슈퍼 방장 부스트 + 2일","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"2일 부스트 이용권입니다. 실제 부스트 효과는 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-boost-3","name":"슈퍼 방장 부스트 + 3일","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"3일 부스트 이용권입니다. 실제 부스트 효과는 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-host-boost","name":"슈퍼 방장 부스트","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"슈퍼 방장 부스트 이용권입니다. 실제 부스트 효과는 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-nickname-color","name":"닉네임 컬러 박스","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"닉네임 컬러 박스입니다. 컬러 추첨 및 적용 기능은 준비 중입니다.","art":"placeholder","shopOnly":true},
  {"id":"shop-random-points","name":"랜덤 포인트 박스","category":"consumable","rarity":1,"setName":"정보 상인단","subtitle":"소비 아이템","description":"사용하면 임시 보상으로 100~500포인트를 받습니다.","art":"placeholder","shopOnly":true,"randomPoints":true},
] as const;

export const defaultInventorySettings: InventorySettings = {query:'',sort:'grade',expiryAlerts:true,protectEvents:true};
export function createInventoryState(now: number): InventoryState {
  return {settings:{...defaultInventorySettings},entries:inventoryCatalog.filter(item=>!('shopOnly' in item)).map((item,index)=>({id:item.id,quantity:'quantity' in item?item.quantity:1,equipped:index<2,locked:false,acquiredAt:now-index*86400000,expiresAt:'days' in item?now+item.days*86400000:null,deletedAt:null}))};
}
export function inventoryItems(state: InventoryState): InventoryItem[] {
  return state.entries.filter(entry=>!entry.deletedAt&&entry.quantity>0).flatMap(entry=>{
    const definition=inventoryCatalog.find(item=>item.id===entry.id);
    return definition?[{...definition,...entry} as InventoryItem]:[];
  });
}
export function isInventoryExpired(item: Pick<InventoryItem,'expiresAt'>,now: number) {return item.expiresAt!==null&&item.expiresAt<=now;}
export function isInventoryProtected(item: Pick<InventoryItem,'locked'|'category'>,settings: InventorySettings) {return item.locked||(item.category==='event'&&settings.protectEvents);}
export function inventoryExpiryAlerts(items: InventoryItem[],settings: InventorySettings,now: number) {return settings.expiryAlerts?items.filter(item=>isInventoryExpired(item,now)):[];}
export function selectInventoryItems(items: InventoryItem[],category: InventoryCategory,settings: InventorySettings) {
  const query=settings.query.normalize('NFKC').toLocaleLowerCase('ko').trim();
  const compare=new Intl.Collator('ko',{numeric:true,sensitivity:'base'}).compare;
  return items.filter(item=>(category==='all'||(category==='misc'?item.category==='misc'||item.category==='skin':item.category===category))&&(!query||item.name.normalize('NFKC').toLocaleLowerCase('ko').includes(query))).sort((a,b)=>{
    if(settings.sort==='grade')return a.rarity-b.rarity||b.acquiredAt-a.acquiredAt||compare(a.id,b.id);
    if(settings.sort==='acquired')return b.acquiredAt-a.acquiredAt||compare(a.id,b.id);
    if(settings.sort==='set')return compare(a.setName,b.setName)||compare(a.name,b.name)||compare(a.id,b.id);
    return compare(a.name,b.name)||compare(a.id,b.id);
  });
}
export function validateInventorySettings(value: unknown): InventorySettings {
  const s=value as InventorySettings;
  if(!s||typeof s!=='object'||Object.keys(s).some(key=>!['query','sort','expiryAlerts','protectEvents'].includes(key))||typeof s.query!=='string'||s.query.length>40||!['grade','acquired','name','set'].includes(s.sort)||typeof s.expiryAlerts!=='boolean'||typeof s.protectEvents!=='boolean')throw new Error('필터 설정을 확인해주세요.');
  return {query:s.query.normalize('NFKC').trim(),sort:s.sort,expiryAlerts:s.expiryAlerts,protectEvents:s.protectEvents};
}
export function applyInventoryAction(state: InventoryState,id: string,action: string,now: number): InventoryState {
  const item=inventoryItems(state).find(item=>item.id===id);
  if(!item)throw new Error('보유한 아이템을 찾을 수 없습니다.');
  const next: InventoryState={settings:{...state.settings},entries:state.entries.map(entry=>({...entry}))};
  const entry=next.entries.find(entry=>entry.id===id)!;
  if(action==='delete') {
    if(isInventoryProtected(item,state.settings))throw new Error(item.category==='event'&&state.settings.protectEvents?'필터에서 이벤트 아이템 삭제 잠금을 해제해주세요.':'잠긴 아이템입니다. 잠금을 해제한 뒤 삭제해주세요.');
    entry.deletedAt=now;entry.equipped=false;
  } else if(action==='lock') {
    entry.locked=!entry.locked;
  } else if(action==='equip') {
    if(item.category!=='skin')throw new Error('장착할 수 있는 스킨을 선택해주세요.');
    if(isInventoryExpired(item,now))throw new Error('사용 기간이 만료된 아이템입니다.');
    for(const other of next.entries){const definition=inventoryCatalog.find(v=>v.id===other.id);if(definition&&'slot' in definition&&definition.slot===item.slot)other.equipped=false;}
    entry.equipped=true;
  } else if(action==='unequip') {
    if(item.category!=='skin')throw new Error('장착할 수 있는 스킨을 선택해주세요.');
    entry.equipped=false;
  } else if(action==='use') {
    if(item.category!=='consumable')throw new Error('사용할 수 있는 소비 아이템을 선택해주세요.');
    if(isInventoryExpired(item,now))throw new Error('사용 기간이 만료된 아이템입니다.');
    entry.quantity--;if(!entry.quantity)entry.deletedAt=now;
  } else throw new Error('아이템 동작을 확인해주세요.');
  return next;
}
