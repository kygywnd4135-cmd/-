import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only run against a local test server.');
const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,8),password='BioLocal42!';
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
 await call('profile/bio',{bio:'로그인 필요'},undefined,401);
 const signup=await call('auth/signup',{loginId:'Bio'+suffix,password});
 account={cookie:signup.cookie};
 equal(signup.data.user.nicknameSet,false);
 const pending=await call('profile/bio',{bio:'가입 대기 중'},account,403);
 equal(pending.data.code,'nickname_required');
 await call('profile/nickname',{nickname:'소개'+suffix},account);

 // A new account has no player_profiles row until its first profile save.
 const first=await me();
 equal(first.bio,'');
 equal((await call('profile/bio',{bio:'처음 저장한 자기소개'},account)).data,{ok:true,bio:'처음 저장한 자기소개'});
 equal(await me(),{...first,bio:'처음 저장한 자기소개'});

 await call('profile',{avatar:1,bio:'기존 소개',frame:'classic',title:'밤의 기록자'},account);
 const before=await me();
 const text='첫 번째 줄\n두 번째 줄\n\n네 번째 줄';
 equal((await call('profile/bio',{bio:'  첫 번째 줄\r\n두 번째 줄\r\n\r네 번째 줄  ',nickname:'변경금지',title:'뉴비 머미러',frame:'classic',avatar:0,points:999999},account)).data,{ok:true,bio:text});
 equal(await me(),{...before,bio:text});

 // A fresh session must read the persisted value, rather than a client cache.
 const fresh=await call('auth/login',{loginId:'Bio'+suffix,password});
 equal((await call('me',undefined,{cookie:fresh.cookie})).data.user.bio,text);
 await call('auth/logout',{},fresh);

 const boundary='가'.repeat(179)+'나';
 equal((await call('profile/bio',{bio:boundary},account)).data.bio,boundary);
 const valid=await me();
 for(const body of [{bio:'가'.repeat(181)},{bio:null},{bio:42},{bio:true},{bio:{}},{bio:['자기소개']},{},null]){
  await call('profile/bio',body,account,400);
 }
 equal(await me(),valid);
 await call('profile/bio',{bio:'다른 사이트 요청'},account,403,{origin:'https://untrusted.example'});
 equal(await me(),valid);

 // Independently edited title and bio must survive concurrent saves.
 await Promise.all([
  call('profile/title',{title:'신중한 관찰자'},account),
  call('profile/bio',{bio:'다른 필드와 동시에 저장한 소개'},account)
 ]);
 const concurrent=await me();
 equal(concurrent,{...valid,title:'신중한 관찰자',bio:'다른 필드와 동시에 저장한 소개'});

 // Legacy profile forms that omit bio must preserve its current database value.
 await call('profile',{avatar:0,frame:'crimson'},account);
 const preserved=await me();
 equal(preserved,{...concurrent,avatar:0,avatarUrl:'/assets/profiles/male-a.webp',frame:'crimson'});
 await call('profile',{avatar:0,frame:'crimson',bio:13},account,400);
 equal(await me(),preserved);

 equal((await call('profile/bio',{bio:' \r\n\t '},account)).data,{ok:true,bio:''});
 equal(await me(),{...preserved,bio:''});
 await call('profile/bio',{bio:'<script>alert("hello")</script>\n일반 텍스트'},account);
 equal((await me()).bio,'<script>alert("hello")</script>\n일반 텍스트');
 console.log(`PASS: ${checks} bio checks. Authentication, onboarding, first save, persistence, line breaks, length/type validation, CSRF, independent field writes, omitted-field preservation, and clearing.`);
}finally{
 if(account)await call('auth/logout',{},account).catch(()=>{});
}
