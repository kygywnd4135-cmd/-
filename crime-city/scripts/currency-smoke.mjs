import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import './sites-env.mjs';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const suffix=crypto.randomUUID().replaceAll('-','').slice(0,7),accounts=[];
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function call(path,body,account,status=200){
  const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(account?{cookie:account.cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status,path+': '+JSON.stringify(data));checks++;
  return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function make(letter){
  const loginId='Currency'+suffix+letter;
  const result=await call('auth/signup',{loginId,password:'CurrencyLocal42!'});
  const account={id:result.data.user.id,cookie:result.cookie,loginId};accounts.push(account);
  await call('profile/nickname',{nickname:'재화'+suffix+letter},account);
  return account;
}
function seedOwnFixture(account){
  // Only the two accounts just created by this run can be targeted by fixture SQL.
  assert(accounts.includes(account)&&account.loginId.startsWith('Currency'+suffix));
  assert(/^[0-9a-f-]{36}$/.test(account.id)&&/^Currency[a-f0-9]{7}[AB]$/.test(account.loginId));
  const sql=`INSERT INTO player_profiles(user_id,points,primacy_tokens) SELECT id,123456789,123456789 FROM users WHERE id='${account.id}' AND login_id='${account.loginId}' ON CONFLICT(user_id) DO UPDATE SET points=excluded.points,primacy_tokens=excluded.primacy_tokens`;
  const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.json','--persist-to','.wrangler/state','--command',sql,'--json'],{cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:'utf8'});
  assert.equal(result.status,0,'Disposable currency fixture could not be saved.');checks++;
}
async function wallet(account,expected){
  const me=(await call('me',undefined,account)).data.user;
  const inventory=(await call('inventory',undefined,account)).data;
  eq([me.points,me.primacyTokens],[expected,expected]);
  eq([inventory.points,inventory.primacyTokens],[expected,expected]);
  return inventory;
}
try{
  const a=await make('A'),b=await make('B');
  await wallet(a,0);await wallet(b,0);
  seedOwnFixture(a);let inventory=await wallet(a,123456789);await wallet(b,0);
  await call('inventory/settings',{revision:inventory.revision,settings:inventory.settings,primacyTokens:999999999},a,400);
  await call('profile',{primacyTokens:999999999,points:999999999},a);
  await call('profile/bio',{bio:'재화 저장 검증용 일회성 계정'},a);
  await call('profile/title',{title:'밤의 기록자'},a);
  inventory=await wallet(a,123456789);
  await call('inventory/item',{revision:inventory.revision,itemId:'wanderer',action:'lock'},a);
  await wallet(a,123456789);
  const profile=(await call('profiles/'+a.id,undefined,b)).data;
  eq(JSON.stringify(profile).includes('primacyTokens'),false);
  await call('auth/logout',{},a);
  const login=await call('auth/login',{loginId:a.loginId,password:'CurrencyLocal42!'});a.cookie=login.cookie;
  await wallet(a,123456789);await wallet(b,0);
  console.log('UI_QA_LOGIN='+a.loginId);
  console.log(`PASS: ${checks} currency checks: zero defaults, independent balances, real nine-digit balances, persistence, field ownership and tamper resistance.`);
}finally{for(const account of accounts)await call('auth/logout',{},account).catch(()=>{});}
