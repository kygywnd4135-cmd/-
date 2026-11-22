import { avatarUrl } from '../../lib/appearance';
import { handleCity } from '../../lib/city-server';
import { env } from 'cloudflare:workers';
import { characters, phases, scenarios } from '../../lib/public';
import { secrets, clues, opening, truth, botLines } from '../../lib/story';

type P={id:string,nick:string,avatar:number,avatarUrl?:string,frame?:string,ready:boolean,role:number|null,bot:boolean,left?:boolean};
type M={id:string,author:string,name:string,text:string,at:number,kind:string,to?:string};
type R={id:string,title:string,host:string,scenario:string,status:string,phase:number,ends:number,created:number,demo:boolean,password:string,players:P[],messages:M[],shared:string[],found:Record<string,Record<string,string[]>>,votes:Record<string,{suspect:number,publication:string}>,phaseReady:string[]};
const db=()=>{if(!env.DB)throw new Error('아직 서버를 준비하고 있습니다. 잠시 뒤 다시 시도해 주세요.');return env.DB;};
const fail=(message:string,status=400)=>Object.assign(new Error(message),{status});
const json=(data:any,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const hex=(a:ArrayBuffer)=>Array.from(new Uint8Array(a),v=>v.toString(16).padStart(2,'0')).join('');
const digest=async(v:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
async function hashPassword(value:string,salt:string){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256));}
function cookie(req:Request,value:string,age=2592000){return `noct_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
function token(req:Request){return req.headers.get('cookie')?.match(/(?:^|;\s*)noct_session=([^;]+)/)?.[1]||'';}
async function user(req:Request){const t=token(req);if(!t)return null;const u=await db().prepare("SELECT u.id,u.nickname,u.login_id AS loginId,u.nickname_set AS nicknameSet,u.nickname_changed_at AS nicknameChangedAt,u.tutorial_step AS tutorialStep,u.avatar,COALESCE(p.use_photo,0) AS usePhoto,ph.version AS photoVersion,COALESCE(p.bio,'') AS bio,COALESCE(p.title,'뉴비 머미러') AS title,COALESCE(p.frame,'classic') AS frame,COALESCE(p.points,0) AS points FROM users u JOIN sessions s ON s.user_id=u.id LEFT JOIN player_profiles p ON p.user_id=u.id LEFT JOIN profile_photos ph ON ph.user_id=u.id WHERE s.token=? AND s.expires_at>?").bind(await digest(t),Date.now()).first<any>();return u?{...u,avatarUrl:avatarUrl(u),nicknameSet:!!u.nicknameSet}:null;}
const publicUser=(u:any)=>({id:u.id,loginId:u.login_id??u.loginId??null,nickname:!!(u.nickname_set??u.nicknameSet)?u.nickname:'',nicknameSet:!!(u.nickname_set??u.nicknameSet),nicknameChangedAt:u.nickname_changed_at??u.nicknameChangedAt??null,tutorialStep:Number(u.tutorial_step??u.tutorialStep??0),avatar:u.avatar});
async function needUser(req:Request){const u=await user(req);if(!u)throw fail('닉네임을 설정하고 입장해 주세요.',401);return u;}
async function session(req:Request,uid:string){const t=crypto.randomUUID()+crypto.randomUUID();await db().prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').bind(await digest(t),uid,Date.now()+2592000000).run();return cookie(req,t);}
async function readRooms():Promise<{id:string,version:number,room:R}[]>{const {results}=await db().prepare('SELECT id,data,version FROM rooms WHERE updated_at>? ORDER BY updated_at DESC LIMIT 150').bind(Date.now()-86400000*7).all<any>();return results.map(x=>({...x,room:JSON.parse(x.data) as R}));}
function member(r:R,id:string){const p=r.players.find(p=>p.id===id&&!p.left);if(!p)throw fail('이 방에 참여하고 있지 않습니다.',403);return p;}
function say(r:R,text:string,author='npc',name='정해린 형사',kind='npc',to?:string){r.messages.push({id:crypto.randomUUID(),author,name,text,at:Date.now(),kind,...(to?{to}:{})});r.messages=r.messages.slice(-160);}
function advance(r:R){if(r.phase>=6)return;r.phase++;r.ends=Date.now()+phases[r.phase].seconds*1000;r.phaseReady=[];say(r,phases[r.phase].brief);if(r.phase===2&&!r.shared.includes('rehearsal'))r.shared.push('rehearsal');if(r.phase===4){r.shared=clues.map(c=>c.id);say(r,'영상통화, 촬영 영상, 출입구 사진의 시각을 검증했습니다. 핵심 원본 12건을 증거보드에서 열람할 수 있습니다.');}if(r.demo){const n=r.phase<2?0:r.phase<4?1:2;for(const p of r.players.filter(p=>p.bot))say(r,botLines[n][p.role??0],p.id,p.nick,'player');}if(r.phase===5&&r.demo){for(const p of r.players.filter(p=>p.bot))r.votes[p.id]={suspect:p.role===2?0:2,publication:'redacted'};}if(r.phase===6)say(r,truth);}
function sync(r:R){let changed=false;while(r.status==='playing'&&r.phase<6&&Date.now()>=r.ends){advance(r);changed=true;}if(r.phase===6&&r.status==='playing'){r.status='ended';changed=true;}return changed;}
async function mutate(id:string,fn:(r:R)=>void){for(let i=0;i<6;i++){const row=await db().prepare('SELECT data,version FROM rooms WHERE id=?').bind(id).first<any>();if(!row)throw fail('방을 찾을 수 없습니다.',404);const r=JSON.parse(row.data) as R;fn(r);const res=await db().prepare('UPDATE rooms SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(r),Date.now(),id,row.version).run();if(res.meta.changes)return r;}throw fail('동시에 변경된 내용이 있습니다. 다시 시도해 주세요.',409);}
function summary(r:R){return{id:r.id,title:r.title,host:r.players.find(p=>p.id===r.host)?.nick||'방장',scenario:r.scenario,status:r.status,count:r.players.filter(p=>!p.left).length,locked:!!r.password,demo:r.demo,created:r.created};}
function view(r:R,uid:string){const me=member(r,uid);const mine=r.found[uid]||{};const own=Object.values(mine).flat();const visible=clues.filter(c=>r.phase>=6||r.shared.includes(c.id)||own.includes(c.id));return {...summary(r),hostId:r.host,phase:r.phase,ends:r.ends,serverTime:Date.now(),players:r.players.map(p=>({...p,role:r.status==='waiting'?null:p.role})),messages:r.messages.filter(m=>!m.to||m.to===uid||m.author===uid),myRole:r.status!=='waiting'&&me.role!==null?{index:me.role,...secrets[me.role]}:null,clues:visible.map(c=>({...c,shared:r.shared.includes(c.id)})),investigations:mine,phaseReady:r.phaseReady,myVote:r.votes[uid]||null,voteCount:Object.keys(r.votes).length,...(r.phase>=6?{result:{culprit:2,truth,votes:r.votes,roles:secrets}}:{})};}
async function ensureNoOther(uid:string,id?:string){const active=(await readRooms()).find(({room:r})=>r.id!==id&&['waiting','playing'].includes(r.status)&&r.players.some(p=>p.id===uid&&!p.left));if(active)throw fail('이미 참여 중인 방이 있습니다. 라운지의 이어하기를 눌러 주세요.',409);}

async function handle(req:Request){const path=new URL(req.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);const method=req.method;const route=path[0];
 if(method!=='GET'){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw fail('허용되지 않은 요청입니다.',403);}
 let body:any={};if(method==='POST'){
  if(route==='profile'&&path[1]==='photo'){
   const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
   if(!reader)throw fail('사진을 선택해주세요.');
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>421000){await reader.cancel();throw fail('사진 크기가 너무 큽니다.',413);}chunks.push(value);}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('요청 내용을 확인해 주세요.');}
  }else{try{body=await req.json();}catch{throw fail('요청 내용을 확인해 주세요.');}}
 }
 const extension=await handleCity(req,path,body,{db,user,needUser,session,digest,json,fail});if(extension)return extension;
 if(route==='catalog')return json({scenarios});
 if(route==='auth'&&method==='POST'){
  if(path[1]==='logout'){if(token(req))await db().prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token(req))).run();return json({ok:true},200,{'set-cookie':cookie(req,'',0)});}
  const submittedId=path[1]==='login'?(body.loginId??body.nickname):body.loginId;
  const loginId=typeof submittedId==='string'?submittedId.normalize('NFKC'):'';
  const password=String(body.password||'');if(!loginId||loginId.length>100)throw fail('아이디를 입력해주세요.');if(password.length<6||password.length>100)throw fail('비밀번호는 6~100자로 입력해 주세요.');
  if(path[1]==='signup'){
   if(!/^[A-Za-z0-9_]{4,20}$/.test(loginId))throw Object.assign(fail('아이디는 영문·숫자·밑줄(_) 4~20자로 입력해주세요.'),{code:'login_id_format'});
  }
  let u=await db().prepare('SELECT * FROM users WHERE login_id=?').bind(loginId).first<any>();
  if(path[1]==='signup'){
   if(u)throw Object.assign(fail('이미 사용중인 아이디입니다.',409),{code:'login_id_taken'});
   const nickname='시민'+crypto.randomUUID().replace(/-/g,'').slice(0,10);
   const salt=crypto.randomUUID();u={id:crypto.randomUUID(),nickname,login_id:loginId,nickname_set:0,nickname_changed_at:null,avatar:body.avatar===1?1:0,salt,hash:await hashPassword(password,salt)};
   try{await db().prepare('INSERT INTO users(id,nickname,login_id,nickname_set,hash,salt,avatar,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(u.id,nickname,loginId,u.nickname_set,u.hash,salt,u.avatar,Date.now()).run();}
   catch(error){if(!String(error).includes('UNIQUE constraint failed: users.'))throw error;throw Object.assign(fail('이미 사용중인 아이디입니다.',409),{code:'login_id_taken'});}
  }
  else if(path[1]==='login'){if(!u||await hashPassword(password,u.salt)!==u.hash)throw fail('아이디 또는 비밀번호가 맞지 않습니다.',401);}else throw fail('요청을 찾을 수 없습니다.',404);
  return json({user:publicUser(u)},200,{'set-cookie':await session(req,u.id)});
 }
 if(route==='me'){const u=await user(req);if(!u)return json({user:null,activeRoom:null,history:[]});const all=await readRooms();const stats=await db().prepare("SELECT COUNT(*) AS clears FROM rooms r,json_each(json_extract(r.data,'$.votes')) v WHERE json_extract(r.data,'$.status')='ended' AND v.key=? AND json_extract(v.value,'$.suspect')=2").bind(u.id).first<any>();return json({user:{...u,...publicUser(u),clears:stats?.clears||0},activeRoom:all.find(({room:r})=>['waiting','playing'].includes(r.status)&&r.players.some(p=>p.id===u.id&&!p.left))?.id||null,history:all.filter(({room:r})=>r.status==='ended'&&r.players.some(p=>p.id===u.id)).map(({room:r})=>({id:r.id,title:r.title,at:r.created,solved:r.votes[u.id]?.suspect===2}))});}
 if(route==='rooms'&&!path[1]&&method==='GET'){const rows=await readRooms();return json({rooms:rows.filter(({room:r})=>['waiting','playing'].includes(r.status)&&r.players.some(p=>!p.left)).map(({room:r})=>summary(r))});}
 if(route==='rooms'&&path[1]&&path[2]==='info'&&method==='GET'){const row=await db().prepare('SELECT data FROM rooms WHERE id=?').bind(path[1]).first<any>();if(!row)throw fail('방을 찾을 수 없습니다.',404);return json(summary(JSON.parse(row.data)));}
 const u=await needUser(req);
 if(!u.nicknameSet)throw Object.assign(fail('먼저 사용할 닉네임을 설정해주세요.',403),{code:'nickname_required'});
 if(route==='rooms'&&!path[1]&&method==='POST'){
  await ensureNoOther(u.id);if(body.scenario&&body.scenario!=='baekya')throw fail('현재는 백야제 시나리오를 플레이할 수 있습니다.');const id=crypto.randomUUID().slice(0,8).toUpperCase();const title=String(body.title||`${u.nickname}의 백야제`).trim().slice(0,40);const r:R={id,title,host:u.id,scenario:'baekya',status:'waiting',phase:0,ends:0,created:Date.now(),demo:body.demo===true,password:body.password?await digest(id+String(body.password)): '',players:[{id:u.id,nick:u.nickname,avatar:u.avatar,avatarUrl:u.avatarUrl,frame:u.frame,ready:false,role:null,bot:false}],messages:[],shared:[],found:{},votes:{},phaseReady:[]};
  if(r.demo)for(let i=1;i<6;i++)r.players.push({id:`bot-${id}-${i}`,nick:characters[i].name,avatar:i,ready:true,role:null,bot:true});say(r,r.demo?'혼자 체험하기에 오신 것을 환영합니다. NPC 다섯 명이 함께하며, 방장은 다음 단계 버튼으로 빠르게 진행할 수 있습니다.':'대기실에 오신 것을 환영합니다. 여섯 명이 모여 준비를 마치면 게임을 시작할 수 있습니다.');await db().prepare('INSERT INTO rooms(id,data,version,updated_at) VALUES(?,?,0,?)').bind(id,JSON.stringify(r),Date.now()).run();return json(view(r,u.id));
 }
 if(route!=='rooms'||!path[1])throw fail('요청을 찾을 수 없습니다.',404);
 const id=path[1];const action=path[2];
 if(method==='GET'){let row=await db().prepare('SELECT data FROM rooms WHERE id=?').bind(id).first<any>();if(!row)throw fail('방을 찾을 수 없습니다.',404);let r=JSON.parse(row.data) as R;member(r,u.id);if(r.status==='playing'&&r.phase<6&&Date.now()>=r.ends)r=await mutate(id,r=>{member(r,u.id);sync(r);});return json(view(r,u.id));}
 if(action==='join'){await ensureNoOther(u.id,id);const pass=body.password?await digest(id+String(body.password)):'';const r=await mutate(id,r=>{if(r.password!==pass)throw fail('방 비밀번호가 맞지 않습니다.',403);if(r.players.some(p=>p.id===u.id&&!p.left))return;if(r.status!=='waiting')throw fail('이미 시작한 방입니다.',409);if(r.players.filter(p=>!p.left).length>=6)throw fail('빈자리가 없습니다.',409);r.players=r.players.filter(p=>p.id!==u.id);r.players.push({id:u.id,nick:u.nickname,avatar:u.avatar,avatarUrl:u.avatarUrl,frame:u.frame,ready:false,role:null,bot:false});say(r,`${u.nickname} 님이 입장했습니다.`,'system','시스템','system');});return json(view(r,u.id));}
 if(action==='leave'){await mutate(id,r=>{member(r,u.id);if(r.status==='ended')return;if(r.status==='waiting')r.players=r.players.filter(p=>p.id!==u.id);else r.players.find(p=>p.id===u.id)!.left=true;const human=r.players.filter(p=>!p.bot&&!p.left);if(!human.length)r.status='closed';else if(r.host===u.id)r.host=human[0].id;say(r,`${u.nickname} 님이 퇴장했습니다.`,'system','시스템','system');});return json({ok:true});}
 const r=await mutate(id,r=>{const p=member(r,u.id);sync(r);
  if(action==='ready'){if(r.status!=='waiting')throw fail('이미 게임이 시작되었습니다.');p.ready=!p.ready;}
  else if(action==='start'){if(r.host!==u.id)throw fail('방장만 시작할 수 있습니다.',403);if(r.status!=='waiting')throw fail('이미 시작했습니다.');if(r.players.length!==6||r.players.some(p=>!p.ready))throw fail('여섯 명이 모두 준비해야 시작할 수 있습니다.');const roles=[0,1,2,3,4,5];if(!r.demo)for(let i=5;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[roles[i],roles[j]]=[roles[j],roles[i]];}r.players.forEach((p,i)=>p.role=roles[i]);r.status='playing';r.phase=0;r.ends=Date.now()+phases[0].seconds*1000;say(r,opening);}
  else if(action==='next'){if(r.status!=='playing'||r.phase>=5)throw fail('지금은 단계를 넘길 수 없습니다.');if(r.demo&&r.host===u.id)advance(r);else {if(!r.phaseReady.includes(u.id))r.phaseReady.push(u.id);if(r.players.filter(p=>!p.bot&&!p.left).every(p=>r.phaseReady.includes(p.id)))advance(r);}}
  else if(action==='investigate'){if(r.status!=='playing'||![1,3].includes(r.phase))throw fail('조사 시간에만 장소를 조사할 수 있습니다.');const clue=clues.find(c=>c.location===body.location&&c.phase===r.phase);if(!clue)throw fail('조사할 단서가 없습니다.');r.found[u.id]??={};const found=r.found[u.id][String(r.phase)]??=[];if(!found.includes(clue.id)){if(found.length>=2)throw fail('이번 조사에서는 두 곳까지 확인할 수 있습니다.');found.push(clue.id);}}
  else if(action==='share'){if(!['playing','ended'].includes(r.status))throw fail('게임이 시작되지 않았습니다.');const c=clues.find(c=>c.id===body.clueId);if(!c||!Object.values(r.found[u.id]||{}).flat().includes(c.id))throw fail('확보한 단서만 공개할 수 있습니다.',403);if(!r.shared.includes(c.id)){r.shared.push(c.id);say(r,`증거 공개 · ${c.title}`,u.id,u.nickname,'evidence');}}
  else if(action==='vote'){if(r.status!=='playing'||r.phase!==5)throw fail('최종 투표 시간에 제출해 주세요.');if(r.votes[u.id])throw fail('이미 제출한 투표입니다.');if(!Number.isInteger(body.suspect)||body.suspect<0||body.suspect>5||!['full','redacted','police'].includes(body.publication))throw fail('범인과 공개 방식을 모두 선택해 주세요.');r.votes[u.id]={suspect:body.suspect,publication:body.publication};if(r.players.filter(p=>!p.left).every(p=>!!r.votes[p.id])){advance(r);r.status='ended';}}
  else if(action==='chat'){const text=String(body.text||'').trim();if(!text||text.length>700)throw fail('메시지는 1~700자로 입력해 주세요.');const last=[...r.messages].reverse().find(m=>m.author===u.id&&(m.kind==='player'||m.kind==='whisper'));if(last&&Date.now()-last.at<600)throw fail('조금 천천히 이야기해 주세요.',429);const to=body.to?String(body.to):undefined;if(to&&to!=='npc'&&!r.players.some(p=>p.id===to&&!p.left))throw fail('대화 상대를 찾을 수 없습니다.');say(r,text,u.id,u.nickname,to?'whisper':'player',to);if(to==='npc'){let reply='진술과 원본 자료를 연결해 보세요. 현재 공개된 증거는 증거보드에서 확인할 수 있습니다.';if(r.status==='waiting')reply='모두 준비를 마친 뒤 방장이 게임을 시작합니다. 체험 모드에서는 준비 버튼을 누르고 시작하면 됩니다.';else if(r.phase<2&&/시간|목소리|방송/.test(text))reply='22:55에 목소리를 들었다는 진술만으로 생존을 확정하지 않겠습니다. 방송실을 조사해 보세요.';else if(r.phase>=2&&/방송|목소리/.test(text))reply='오후 녹음과 밤 방송의 소리가 일치합니다. 밤의 목소리는 생존을 증명하지 못합니다.';else if(r.phase>=4&&/시간|언제|알리바이/.test(text))reply='22:34:30의 영상통화와 22:42의 촬영 영상 사이에 공격이 발생했습니다. 출입 기록을 대조해 주세요.';else if(r.phase>=6)reply=truth;say(r,reply,'npc','정해린 형사','npc',u.id);}else if(r.demo&&r.status==='playing'&&r.phase<6){const b=r.players.filter(p=>p.bot&&(to?p.id===to:true));if(b.length){const picked=b[Math.floor(r.messages.length%b.length)];say(r,botLines[r.phase<2?0:r.phase<4?1:2][picked.role??0],picked.id,picked.nick,to?'whisper':'player',to?u.id:undefined);}}}
  else throw fail('요청을 찾을 수 없습니다.',404);
 });return json(view(r,u.id));
}
export async function GET(req:Request){try{return await handle(req);}catch(e:any){return json({error:e.status?e.message:'서버 연결을 확인해 주세요. 잠시 뒤 다시 시도해 주세요.',...(e.status&&e.code?{code:e.code}:{})},e.status||503);}}
export async function POST(req:Request){try{return await handle(req);}catch(e:any){return json({error:e.status?e.message:'요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',...(e.status&&e.code?{code:e.code}:{})},e.status||503);}}
