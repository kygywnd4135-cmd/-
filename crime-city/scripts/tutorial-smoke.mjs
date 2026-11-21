import assert from 'node:assert/strict';
import {TUTORIAL_DONE,TUTORIAL_NAME_STEP,tutorialLine} from '../app/lib/tutorial.ts';
import {NICKNAME_CHANGE_INTERVAL} from '../app/lib/nickname.ts';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const run=crypto.randomUUID().replaceAll('-','').slice(0,6),password='TutorialLocal42!';let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function call(path,body,a,status=200,headers={}){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(a?{cookie:a.cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text(),value=r.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):{error:raw};assert.equal(r.status,status,path+': '+JSON.stringify(value));checks++;return{...value,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function make(label){const loginId='Tutor'+run+label,r=await call('auth/signup',{loginId,password});return{loginId,cookie:r.cookie,id:r.user.id};}
async function login(a){const r=await call('auth/login',{loginId:a.loginId,password});a.cookie=r.cookie;return r;}
eq(TUTORIAL_NAME_STEP,3);eq(TUTORIAL_DONE,14);eq(NICKNAME_CHANGE_INTERVAL,7*86400000);
eq(tutorialLine(0,''),'잠깐 시간 괜찮으십니까?');eq(tutorialLine(4,'검증탐정').includes('검증탐정님이셨군요'),true);
for(let i=0;i<TUTORIAL_DONE;i++)if(i!==TUTORIAL_NAME_STEP)eq(!!tutorialLine(i,'탐정'),true);
await call('tutorial',undefined,undefined,401);await call('tutorial',{step:1},undefined,401);
const a=await make('A'),b=await make('B'),c=await make('C');
let me=await call('me',undefined,a);eq(me.user.nicknameSet,false);eq(me.user.nickname,'');eq(me.user.tutorialStep,0);
eq((await call('tutorial',undefined,a)).tutorialStep,0);
await call('rooms',{title:'닉네임 전 입장 차단'},a,403);await call('lobby/chat',{text:'닉네임 전 쓰기 차단'},a,403);
await call('tutorial',{step:14},a,403);await call('tutorial',{step:4},a,403);await call('tutorial',{step:1,userId:b.id},a,400);await call('tutorial',{step:'1'},a,400);await call('tutorial',{step:-1},a,400);await call('tutorial',{step:15},a,400);
await call('tutorial',{step:1},a,403,{origin:'https://untrusted.example'});
eq((await call('tutorial',{step:1},a)).tutorialStep,1);eq((await call('tutorial',{step:1},a)).tutorialStep,1);
await login(a);eq((await call('tutorial',undefined,a)).tutorialStep,1);await call('tutorial',{step:0},a,409);
await call('tutorial',{step:2},a);await call('tutorial',{step:3},a);
await call('profile/nickname',{nickname:'!잘못된이름'},a,400);await call('profile/nickname',{nickname:'씨발'},a,400);
const name='안내'+run+'A',named=await call('profile/nickname',{nickname:name},a);eq(named.nickname,name);eq(named.nicknameSet,true);eq(named.tutorialStep,4);
eq((await call('me',undefined,a)).user.tutorialStep,4);await call('profile/nickname',{nickname:'변경'+run},a,429);
for(let step=5;step<=TUTORIAL_DONE;step++)eq((await call('tutorial',{step},a)).tutorialStep,step);
eq((await call('tutorial',{step:TUTORIAL_DONE},a)).tutorialStep,TUTORIAL_DONE);await call('tutorial',{step:3},a,409);await login(a);eq((await call('me',undefined,a)).user.tutorialStep,TUTORIAL_DONE);
eq((await call('tutorial',{step:3},b)).tutorialStep,3);await call('tutorial',{step:TUTORIAL_DONE},b,403);
await call('profile/nickname',{nickname:name},b,409);eq((await call('tutorial',undefined,b)).tutorialStep,3);
const bNamed=await call('profile/nickname',{nickname:'안내'+run+'B'},b);eq(bNamed.tutorialStep,4);
eq((await call('tutorial',{step:TUTORIAL_DONE},b)).tutorialStep,TUTORIAL_DONE);
const publicProfile=await call('profiles/'+b.id,undefined,a);eq('tutorialStep' in publicProfile.profile,false);eq('loginId' in publicProfile.profile,false);
const race=await Promise.all([1,2].map(async()=>{const r=await fetch(base+'/api/tutorial',{method:'POST',headers:{cookie:c.cookie,'content-type':'application/json'},body:JSON.stringify({step:1})});await r.json();return r.status;}));eq(race.every(s=>s===200||s===409),true);eq((await call('tutorial',undefined,c)).tutorialStep,1);
await call('tutorial/unknown',undefined,a,404);
const qa=await make('D');console.log('TUTORIAL_QA_LOGIN='+qa.loginId);
console.log(`PASS: ${checks} tutorial checks: signup separation, progress/resume, mandatory nickname, duplicate/profanity/format rules, 7-day cooldown, skip, concurrency, auth/CSRF and privacy.`);
