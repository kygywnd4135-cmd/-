import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base=process.env.BASE_URL||'http://127.0.0.1:5173';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const suffix=crypto.randomUUID().replaceAll('-','').slice(0,7),accounts=[];let checks=0;
function eq(a,b){assert.deepEqual(a,b);checks++;}
async function call(path,body,account,status=200,headers={}){const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'content-type':'application/json'}),...(account?{cookie:account.cookie}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const text=await response.text();assert.equal(response.status,status,path+': '+text);checks++;return{data:response.headers.get('content-type')?.includes('application/json')?JSON.parse(text):{error:text},cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function make(label,pending=false){const loginId='Friend'+suffix+label,r=await call('auth/signup',{loginId,password:'FriendsLocal42!'});const a={id:r.data.user.id,cookie:r.cookie,loginId};accounts.push(a);if(!pending)await call('profile/nickname',{nickname:'친구'+suffix+label},a);return a;}
const send=async(a,target)=>(await call('friends/requests',{userId:target.id},a)).data;
const read=async a=>(await call('friends/requests',undefined,a)).data;
try{
 const a=await make('A'),b=await make('B'),c=await make('C'),pending=await make('D',true);
 await call('friends/requests',undefined,undefined,401);await call('friends/requests',{userId:b.id},undefined,401);
 await call('friends/requests',undefined,pending,403);await call('friends/requests',{userId:b.id},pending,403);
 await call('friends/requests',{userId:a.id},a,400);
 for(const userId of [null,1,{},'not-an-id',"' OR 1=1 --",'0'.repeat(36)])await call('friends/requests',{userId},a,400);
 await call('friends/requests',{},a,400);await call('friends/requests',{userId:crypto.randomUUID()},a,404);await call('friends/requests',{userId:pending.id},a,404);
 await call('friends/requests',{userId:b.id,senderId:c.id},a,400);await call('friends/requests',{userId:b.id,status:'accepted'},a,400);
 await call('friends/requests',{userId:b.id},a,403,{origin:'https://untrusted.example'});
 eq(await read(a),{incoming:[],outgoing:[]});eq(await read(b),{incoming:[],outgoing:[]});
 const publicBefore=(await call('profiles/'+b.id,undefined,a)).data;
 eq(await send(a,b),{status:'sent'});
 let inbox=await read(b),outbox=await read(a);eq(inbox.incoming.length,1);eq(inbox.outgoing.length,0);eq(inbox.incoming[0].from.id,a.id);eq(outbox.outgoing[0].to.id,b.id);eq(inbox.incoming[0].createdAt,outbox.outgoing[0].createdAt);
 eq(Object.keys(inbox.incoming[0]).sort(),['createdAt','from']);eq(Object.keys(inbox.incoming[0].from).sort(),['id','nickname']);
 eq(await read(c),{incoming:[],outgoing:[]});
 eq(await send(a,b),{status:'already_requested_or_friends'});eq(await send(b,a),{status:'already_requested_or_friends'});eq((await read(b)).incoming.length,1);
 const simultaneous=await Promise.all(Array.from({length:6},()=>send(a,c)));eq(simultaneous.filter(r=>r.status==='sent').length,1);eq(simultaneous.filter(r=>r.status==='already_requested_or_friends').length,5);eq((await read(a)).outgoing.length,2);eq((await read(c)).incoming.length,1);
 eq((await call('profiles/'+b.id,undefined,a)).data,publicBefore);
 await call('auth/logout',{},a);const relog=await call('auth/login',{loginId:a.loginId,password:'FriendsLocal42!'});a.cookie=relog.cookie;
 eq(await send(a,b),{status:'already_requested_or_friends'});eq((await read(a)).outgoing.length,2);
 if(process.argv.includes('--fixtures')){
   assert(accounts.includes(a)&&accounts.includes(b)&&/^[a-f0-9-]{36}$/.test(a.id)&&/^[a-f0-9-]{36}$/.test(b.id));
   const pair=[a.id,b.id].sort().join(':');
   execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.json','--persist-to','.wrangler/state','--command',`UPDATE friend_requests SET status='accepted' WHERE pair_key='${pair}' AND sender_id='${a.id}' AND recipient_id='${b.id}'`],{stdio:'pipe'});
   eq(await send(a,b),{status:'already_requested_or_friends'});eq(await send(b,a),{status:'already_requested_or_friends'});eq((await read(b)).incoming.length,0);
 }
 await call('friends/requests/extra',undefined,a,404);await call('friends/not-a-route',undefined,a,404);
 if(process.argv.includes('--ui')){const viewer=await make('E'),target=await make('F');console.log(JSON.stringify({uiLoginId:viewer.loginId,uiTargetId:target.id,uiTargetLoginId:target.loginId}));}
 console.log(`PASS: ${checks} friend-request checks: auth, recipient validation, private inbox, persistence, atomic duplicate detection, accepted pairs and CSRF.`);
}finally{for(const a of accounts)await call('auth/logout',{},a).catch(()=>{});}
