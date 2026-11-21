import assert from 'node:assert/strict';

const base=process.env.BASE_URL||'http://127.0.0.1:5173';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Only run against a local test server.');
const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,8),password='PublicProfile42!';
const sessions=[];let checks=0,room;
const equal=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
async function call(path,body,account,expected=200){
 const response=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(account?{cookie:account.cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
 const data=response.headers.get('content-type')?.includes('application/json')?await response.json():{error:await response.text()};
 equal(response.status,expected);
 return{data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function make(label,complete=true){
 const result=await call('auth/signup',{loginId:'Pub'+suffix+label,password});
 const account={id:result.data.user.id,cookie:result.cookie};sessions.push(account);
 if(complete)await call('profile/nickname',{nickname:'공개'+suffix+label},account);
 return account;
}
const keys=['id','nickname','avatar','avatarUrl','frame','title','bio','points','clears','level','progress','achievement','lastGameHonor'].sort();
const read=async(id,account)=>{
 const result=(await call('profiles/'+id,undefined,account)).data;
 equal(Object.keys(result),['profile']);equal(Object.keys(result.profile).sort(),keys);
 return result.profile;
};

try{
 const viewer=await make('A'),target=await make('B'),pending=await make('C',false);
 await call('profiles/'+target.id,undefined,undefined,401);
 const blocked=await call('profiles/'+target.id,undefined,pending,403);
 equal(blocked.data.code,'nickname_required');
 await call('profiles/'+pending.id,undefined,viewer,404);
 const first=await read(target.id,viewer);
 equal(first,{id:target.id,nickname:'공개'+suffix+'B',avatar:0,avatarUrl:'/assets/profiles/male-a.png',frame:'classic',title:'뉴비 머미러',bio:'',points:0,clears:0,level:1,progress:0,achievement:null,lastGameHonor:0});
 // Looking at another citizen and at oneself uses the same strict public shape.
 equal((await read(viewer.id,viewer)).id,viewer.id);
 for(const id of [crypto.randomUUID(),'missing','x'.repeat(1000),encodeURIComponent("' OR 1=1 --"),target.id+'/extra','00000000-0000-0000-0000-00000000000g']){
  await call('profiles/'+id,undefined,viewer,404);
 }
 await call('profile',{avatar:1,frame:'classic',title:'밤의 기록자',bio:'공개 프로필 검증용 소개'},target);
 const edited=await read(target.id,viewer);
 equal(edited,{...first,avatar:1,avatarUrl:'/assets/profiles/female-a.png',frame:'classic',title:'밤의 기록자',bio:'공개 프로필 검증용 소개'});
 await call('profile/title',{title:'신중한 관찰자'},target);
 await call('profile/bio',{bio:'새로 저장한 소개\n다음 줄'},target);
 const latest=await read(target.id,viewer);
 equal(latest,{...edited,title:'신중한 관찰자',bio:'새로 저장한 소개\n다음 줄'});
 // A successful own demo supplies a real ended-room vote for lifetime statistics.
 room=(await call('rooms',{title:'공개 프로필 통계 검증',demo:true},target)).data.id;
 await call('rooms/'+room+'/ready',{},target);
 await call('rooms/'+room+'/start',{},target);
 for(let phase=1;phase<=5;phase++)await call('rooms/'+room+'/next',{},target);
 await call('rooms/'+room+'/vote',{suspect:2,publication:'redacted'},target);
 const completed=await read(target.id,viewer);
 equal(completed,{...latest,clears:1,level:1,progress:20});
 const own=(await call('me',undefined,target)).data.user;
 equal(completed.clears,own.clears);
 // Visitors see only the selected, earned achievement, never the owned catalog.
 await call('profile/achievement',{achievementId:'first-case'},target);
 const featured=await read(target.id,viewer);
 equal(featured,{...completed,achievement:{id:'first-case',name:'초보 탈출!',description:'처음으로 시나리오를 모두 클리어했다.'}});
 equal((await read(viewer.id,viewer)).achievement,null);
 // A target id in a visitor's write cannot change the target's achievement.
 await call('profile/achievement',{achievementId:'first-truth',userId:target.id},viewer,400);
 equal((await read(target.id,viewer)).achievement,featured.achievement);
 await call('profile/achievement',{achievementId:null},target);
 equal((await read(target.id,viewer)).achievement,null);
 // Reads must not write to the target profile or expose its private account fields.
 await read(target.id,viewer);
 equal((await call('me',undefined,target)).data.user,own);
 console.log(`PASS: ${checks} public-profile checks. Authentication, onboarding, strict public fields, pending/missing/malformed targets, current profile values, lifetime statistics, and read-only behavior.`);
}finally{
 if(room&&sessions[1])await call('rooms/'+room+'/leave',{},sessions[1]).catch(()=>{});
 for(const account of sessions)await call('auth/logout',{},account).catch(()=>{});
}
