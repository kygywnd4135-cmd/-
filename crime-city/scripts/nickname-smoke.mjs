import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getNicknameIssue, nicknameMessages, normalizeNickname, NICKNAME_CHANGE_INTERVAL } from '../app/lib/nickname.ts';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only run against a local test server.');
const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,6),password='NicknameLocal42!';
const accounts=[],createdRooms=[];let checks=0;
const equal=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function call(path,body,account,expected=200){
 const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(account?{cookie:account.cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();equal(response.status,expected);return{data,status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function rawRename(account,nickname){
 const response=await fetch(base+'/api/profile/nickname',{method:'POST',headers:{cookie:account.cookie,'content-type':'application/json'},body:JSON.stringify({nickname})});return{status:response.status,data:await response.json()};
}
async function make(label){const loginId='Nick'+suffix+label;const result=await call('auth/signup',{loginId,password});const account={id:result.data.user.id,loginId,cookie:result.cookie};accounts.push(account);return{account,user:result.data.user};}
function expireOwnCooldown(account){
 assert(accounts.includes(account)&&/^[a-f0-9-]{36}$/.test(account.id),'Fixture changes are restricted to this run’s disposable accounts.');
 const command=`UPDATE users SET nickname_changed_at=${Date.now()-NICKNAME_CHANGE_INTERVAL-1000} WHERE id='${account.id}'`;
 execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','dist/server/wrangler.json','--persist-to','.wrangler/state','--command',command],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'pipe'});
 checks++;
}

equal(normalizeNickname('ＡＢＣ１２'),'ABC12');
equal(getNicknameIssue('가'.repeat(12)),null);
for(const nickname of ['가','가'.repeat(13),'탐정 42','탐정_42','탐정-42','탐정!','😀탐정','\u200B탐정','漢字','café','العربية','１２가!'])equal(getNicknameIssue(nickname),'format');
for(const nickname of ['일베탐정','페미니스트','씨발탐정','ㅅㅂ탐정','ＦＵＣＫ12'])equal(getNicknameIssue(nickname),'restricted');
equal(nicknameMessages.taken,'앗! 이미 사용중인 닉네임입니다.\n다시 한번 확인해주세요.');
equal(nicknameMessages.restricted,'비속어나 특정 성향을 강조한 닉네임은\n사용할 수 없습니다!');
if(process.argv.includes('--unit-only')){console.log(`PASS: ${checks} shared nickname policy checks.`);process.exit(0);}

try{
 for(const loginId of ['abc','아이디123','bad id','bad-id','a'.repeat(21)])await call('auth/signup',{loginId,password},undefined,400);
 await call('auth/signup',{nickname:'이전가입우회',password},undefined,400);
 await call('profile/nickname',{nickname:'로그인필요'},undefined,401);
 const {account:a,user}=await make('A');
 equal(user.nicknameSet,false);equal(user.nickname,'');equal(user.loginId,a.loginId);equal('hash' in user,false);equal('salt' in user,false);
 const pending=(await call('me',undefined,a)).data.user;equal(pending.nicknameSet,false);equal(pending.nickname,'');
 for(const [path,body] of [['rooms',{title:'잠긴 가입'}],['rooms/ABC/join',{}],['profile',{avatar:0}],['lobby/chat',{text:'공개되면 안 되는 가입 대기 메시지'}]]){
  const blocked=await call(path,body,a,403);equal(blocked.data.code,'nickname_required');
 }
 const duplicateId=await call('auth/signup',{loginId:a.loginId,password},undefined,409);equal(duplicateId.data.code,'login_id_taken');
 for(const nickname of ['가','가'.repeat(13),'특수_문자','공백 문자','이름!','漢字','café']){const rejected=await call('profile/nickname',{nickname},a,400);equal(rejected.data.code,'nickname_format');}
 for(const nickname of ['일베탐정','페미니스트','씨발탐정','ㅅㅂ탐정','ＦＵＣＫ12']){const rejected=await call('profile/nickname',{nickname},a,400);equal(rejected.data.code,'nickname_restricted');equal(rejected.data.error,nicknameMessages.restricted);}
 const firstName='검증'+suffix+'가';
 const chosen=await call('profile/nickname',{nickname:firstName},a);equal(chosen.data.nickname,firstName);equal(chosen.data.nicknameSet,true);equal(typeof chosen.data.nicknameChangedAt,'number');
 const same=await call('profile/nickname',{nickname:firstName},a,409);equal(same.data.code,'nickname_taken');equal(same.data.error,nicknameMessages.taken);
 const cooldown=await call('profile/nickname',{nickname:'검증'+suffix+'나'},a,429);equal(cooldown.data.code,'nickname_cooldown');
 const bypass=await call('profile',{nickname:'검증'+suffix+'다',avatar:0},a,429);equal(bypass.data.code,'nickname_cooldown');
 await call('profile',{avatar:1,bio:'닉네임 없이 프로필 저장',frame:'classic',title:'밤의 기록자'},a);
 const saved=(await call('me',undefined,a)).data.user;equal(saved.nickname,firstName);equal(saved.loginId,a.loginId);equal(saved.bio,'닉네임 없이 프로필 저장');equal(saved.nicknameSet,true);
 equal((await call('auth/login',{loginId:a.loginId,password})).data.user.id,a.id);
 await call('auth/login',{loginId:firstName,password},undefined,401);
 const {account:b}=await make('B');const {account:c}=await make('C');
 const sharedName='공유'+suffix;
 const reserved=await Promise.all([rawRename(b,sharedName),rawRename(c,sharedName)]);equal(reserved.map(r=>r.status).sort(),[200,409]);equal(reserved.find(r=>r.status===409).data.code,'nickname_taken');
 const {account:d}=await make('D');
 const concurrent=await Promise.all([rawRename(d,'동시'+suffix+'가'),rawRename(d,'동시'+suffix+'나')]);equal(concurrent.map(r=>r.status).sort(),[200,429]);equal(concurrent.find(r=>r.status===429).data.code,'nickname_cooldown');
 if(process.argv.includes('--fixtures')){
  expireOwnCooldown(a);
  const room=(await call('rooms',{title:'닉네임 제한 검증 '+suffix,demo:true},a)).data;createdRooms.push({id:room.id,account:a});
  const active=await call('profile/nickname',{nickname:'변경'+suffix+'가'},a,400);equal(active.data.code,'nickname_active_room');
  const activeBypass=await call('profile',{nickname:'변경'+suffix+'가',avatar:0},a,400);equal(activeBypass.data.code,'nickname_active_room');
  await call('rooms/'+room.id+'/ready',{},a);await call('rooms/'+room.id+'/start',{},a);
  const playing=await call('profile/nickname',{nickname:'변경'+suffix+'가'},a,400);equal(playing.data.code,'nickname_active_room');
  await call('rooms/'+room.id+'/leave',{},a);createdRooms.length=0;
  const renamed=await call('profile/nickname',{nickname:'변경'+suffix+'가'},a);equal(renamed.data.nickname,'변경'+suffix+'가');
  const logged=(await call('auth/login',{loginId:a.loginId,password})).data.user;equal(logged.id,a.id);equal(logged.nickname,'변경'+suffix+'가');equal(logged.loginId,a.loginId);
  await call('auth/login',{loginId:'변경'+suffix+'가',password},undefined,401);
  const restarted=(await call('me',undefined,a)).data.user;equal(restarted.nicknameChangedAt,renamed.data.nicknameChangedAt);
 }
 console.log(`PASS: ${checks} nickname/account checks. ID separation, pending onboarding gates, exact alerts, normalized profanity, duplicate races, weekly cooldown, legacy profile guards, and stable login${process.argv.includes('--fixtures')?', expiry and active-room restrictions':''}.`);
}finally{
 for(const room of createdRooms)await call('rooms/'+room.id+'/leave',{},room.account).catch(()=>{});
 for(const account of accounts)await call('auth/logout',{},account).catch(()=>{});
}
