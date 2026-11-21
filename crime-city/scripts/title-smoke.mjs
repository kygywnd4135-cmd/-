import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only run against a local test server.');
const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,8);
const password='TitleLocal42!';
let checks=0,account;
const equal=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function call(path,body,session,expected=200,extraHeaders={}){
 const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(session?{cookie:session.cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...extraHeaders},body:body===undefined?undefined:JSON.stringify(body)});
 const data=response.headers.get('content-type')?.includes('application/json')?await response.json():{error:await response.text()};
 equal(response.status,expected);
 return{data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const me=async()=> (await call('me',undefined,account)).data.user;

try{
 await call('profile/titles',undefined,undefined,401);
 await call('profile/title',{title:'밤의 기록자'},undefined,401);
 const signup=await call('auth/signup',{loginId:'Title'+suffix,password});
 account={cookie:signup.cookie};
 equal(signup.data.user.nicknameSet,false);
 for(const [path,body] of [['profile/titles',undefined],['profile/title',{title:'밤의 기록자'}]]){
  const pending=await call(path,body,account,403);equal(pending.data.code,'nickname_required');
 }
 await call('profile/nickname',{nickname:'칭호'+suffix},account);
 const first=(await call('profile/titles',undefined,account)).data;
 equal(first,{titles:['뉴비 머미러','신중한 관찰자','밤의 기록자'],title:'뉴비 머미러'});
 // The title-only endpoint must also create a missing player_profiles row.
 equal((await call('profile/title',{title:'신중한 관찰자'},account)).data,{ok:true,title:'신중한 관찰자'});
 equal((await me()).title,'신중한 관찰자');
 await call('profile',{avatar:1,bio:'칭호 전환 중 보존할 소개',frame:'classic',title:'뉴비 머미러'},account);
 const before=await me();
 equal((await call('profile/title',{title:'밤의 기록자',avatar:0,bio:'덮어쓰면 안 됨',frame:'classic',nickname:'변경금지',points:999999},account)).data,{ok:true,title:'밤의 기록자'});
 const after=await me();
 equal(after,{...before,title:'밤의 기록자'});
 equal((await call('profile/titles',undefined,account)).data.title,'밤의 기록자');
 // Re-selecting the current title is harmless and does not invoke nickname cooldowns.
 await call('profile/title',{title:'밤의 기록자'},account);
 for(const title of ['없는 칭호','머미 마스터','',null,42,{},['밤의 기록자']]){
  await call('profile/title',{title},account,400);
 }
 await call('profile/title',{},account,400);
 await call('profile/title',{title:'뉴비 머미러'},account,403,{origin:'https://untrusted.example'});
 equal(await me(),after);
 await call('profile',{avatar:0,bio:'일반 프로필 저장 시에도 칭호 유지',frame:'crimson'},account);
 const preserved=await me();equal(preserved.title,'밤의 기록자');equal(preserved.avatar,0);equal(preserved.bio,'일반 프로필 저장 시에도 칭호 유지');equal(preserved.frame,'crimson');
 await call('profile',{avatar:1,bio:'허용되지 않은 저장',title:'머미 마스터'},account,400);
 equal(await me(),preserved);
 await call('profile',{avatar:0,bio:preserved.bio,frame:preserved.frame,title:'신중한 관찰자'},account);
 equal((await me()).title,'신중한 관찰자');
 console.log(`PASS: ${checks} title checks. Authentication, nickname onboarding, owned starter titles, immediate persistence, invalid title rejection, title-only updates, and profile omission preservation.`);
}finally{
 if(account)await call('auth/logout',{},account).catch(()=>{});
}
