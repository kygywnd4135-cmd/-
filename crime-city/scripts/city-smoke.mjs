import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only run on a local test server.');
let checks=0;
async function call(path,body,account,status=200,extra={}){const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(account?{cookie:account.cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{}),...extra},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});assert.equal(response.status,status,path);checks++;const data=response.headers.get('content-type')?.includes('application/json')?await response.json():{error:await response.text()};return{data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
const prefix=crypto.randomUUID().slice(0,6),password='CrimeCityLocal42!';
const make=async(n)=>{const nick='CC'+prefix+n;const r=await call('auth/signup',{loginId:nick,password});const account={nick,id:r.data.user.id,cookie:r.cookie};await call('profile/nickname',{nickname:nick},account);return account;};
const a=await make('A'),b=await make('B');
await call('profile',{nickname:a.nick,avatar:0},undefined,401);
const providers=await call('auth/providers');assert.equal(typeof providers.data.google,'boolean');checks++;
const chat=await call('lobby/chat');assert(Array.isArray(chat.data.messages));assert(Number.isInteger(chat.data.online));checks+=2;
await call('profile',{nickname:a.nick,avatar:1,bio:'추리 검증용 개인 소개',frame:'classic',title:'밤의 기록자',points:99999},a);
const me=(await call('me',undefined,a)).data.user;assert.equal(me.bio,'추리 검증용 개인 소개');assert.equal(me.frame,'classic');assert.equal(me.avatar,1);assert.equal(me.title,'밤의 기록자');assert.equal(me.points,0);assert.equal(me.clears,0);checks+=6;
await call('profile',{nickname:b.nick,avatar:0},a,409);
await call('profile',{nickname:a.nick,avatar:-1},a,400);
await call('profile',{nickname:a.nick,avatar:0,bio:'가'.repeat(181)},a,400);
await call('profile',{nickname:a.nick,avatar:0},a,403,{origin:'https://untrusted.example'});
const demo=await call('rooms',{title:'CC 로비 연동 검증',demo:true},a);assert.equal(demo.data.players.length,6);checks++;
await call('profile',{nickname:a.nick+'x',avatar:0},a,400);
await call('rooms/'+demo.data.id+'/leave',{},a);
await call('auth/logout',{},a);await call('profile',{nickname:a.nick,avatar:0},a,401);
assert.equal((await call('auth/login',{nickname:a.nick,password})).data.user.id,a.id);checks++;
const font=await fetch(base+'/fonts/PretendardVariable.woff2');assert.equal(font.status,200);assert.equal(new TextDecoder().decode((await font.arrayBuffer()).slice(0,4)),'wOF2');checks+=2;
if(!providers.data.google){const redirect=await fetch(base+'/api/auth/google',{redirect:'manual'});assert.equal(redirect.status,303);assert.equal(redirect.headers.get('location'),'/?auth_error=configuration');checks+=2;}
console.log(`PASS: ${checks} Crime City checks. Profile persistence, points ownership, validation, CSRF, lobby feed, Google setup gating, room integration, and bundled Pretendard Variable.`);
