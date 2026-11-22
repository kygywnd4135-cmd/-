import { env } from 'cloudflare:workers';
import {handleInventory} from './inventory-server';
import {handleFriends} from './friends-server';
import { getNicknameIssue, nicknameMessages, normalizeNickname, NICKNAME_CHANGE_INTERVAL } from './nickname';
import { isOwnedTitle, STARTER_TITLES } from './titles';
import { avatarUrl, isStarterAvatar, isStarterFrame } from './appearance';
import { handleAppearance } from './appearance-server';
import { handleExpandedProfile, profileProgress } from './expanded-profile-server';

type Context = {db:()=>any; user:(r:Request)=>Promise<any>; needUser:(r:Request)=>Promise<any>; session:(r:Request,id:string)=>Promise<string>; digest:(s:string)=>Promise<string>; json:(v:any,s?:number,h?:Record<string,string>)=>Response; fail:(s:string,n?:number)=>Error};
const nicknameFailure=(c:Context,message:string,code:string,status=400)=>Object.assign(c.fail(message,status),{code});
function normalizeBio(value:unknown,c:Context){
 if(typeof value!=='string')throw c.fail('자기소개를 글자로 입력해 주세요.');
 const bio=value.replace(/\r\n?/g,'\n').trim();
 if(bio.length>180)throw c.fail('자기소개는 180자 이내로 작성해 주세요.');
 return bio;
}
const activeRoomCondition="EXISTS(SELECT 1 FROM rooms,json_each(json_extract(rooms.data,'$.players')) p WHERE json_extract(rooms.data,'$.status') IN ('waiting','playing') AND json_extract(p.value,'$.id')=users.id AND COALESCE(json_extract(p.value,'$.left'),0)=0)";
async function changeNickname(c:Context,u:any,value:unknown){
 const nickname=normalizeNickname(value);
 if(u.nicknameSet&&nickname===u.nickname)throw nicknameFailure(c,nicknameMessages.taken,'nickname_taken',409);
 const issue=getNicknameIssue(nickname);
 if(issue)throw nicknameFailure(c,nicknameMessages[issue],`nickname_${issue}`);
 const conflict=await c.db().prepare('SELECT id FROM users WHERE nickname=? AND (id<>? OR nickname_set=1)').bind(nickname,u.id).first();
 if(conflict)throw nicknameFailure(c,nicknameMessages.taken,'nickname_taken',409);
 const now=Date.now();let changed;
 try{
  // The cooldown, pending state, and room restriction are checked in the write itself.
  changed=await c.db().prepare(`UPDATE users SET nickname=?,tutorial_step=CASE WHEN nickname_set=0 THEN MAX(tutorial_step,4) ELSE tutorial_step END,nickname_set=1,nickname_changed_at=? WHERE id=? AND (nickname_set=0 OR nickname_changed_at IS NULL OR nickname_changed_at<=?) AND NOT ${activeRoomCondition} RETURNING nickname,nickname_changed_at AS nicknameChangedAt,tutorial_step AS tutorialStep`).bind(nickname,now,u.id,now-NICKNAME_CHANGE_INTERVAL).first();
 }catch(error){
  if(String(error).includes('UNIQUE constraint failed: users.nickname'))throw nicknameFailure(c,nicknameMessages.taken,'nickname_taken',409);
  throw error;
 }
 if(!changed){
  const current=await c.db().prepare(`SELECT nickname,nickname_set,nickname_changed_at,${activeRoomCondition} AS active FROM users WHERE id=?`).bind(u.id).first();
  if(!current)throw c.fail('다시 로그인해주세요.',401);
  if(current.nickname_set&&current.nickname===nickname)throw nicknameFailure(c,nicknameMessages.taken,'nickname_taken',409);
  if(current.active)throw nicknameFailure(c,'참여 중인 사건을 마친 뒤 닉네임을 변경해주세요.','nickname_active_room');
  throw nicknameFailure(c,nicknameMessages.cooldown,'nickname_cooldown',429);
 }
 return changed;
}
const base64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const oauthCookie=(req:Request,value:string,age=600)=>`city_oauth=${value}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
function googleConfig(req:Request){
 const settings=env as unknown as Record<string,string>;
 const id=settings.GOOGLE_CLIENT_ID,secret=settings.GOOGLE_CLIENT_SECRET;
 const redirect=settings.GOOGLE_REDIRECT_URI||new URL('/api/auth/google/callback',req.url).href;
 let valid=false;
 try{const uri=new URL(redirect);valid=uri.origin===new URL(req.url).origin&&uri.pathname==='/api/auth/google/callback'&&(uri.protocol==='https:'||['localhost','127.0.0.1'].includes(uri.hostname));}catch{}
 return {id,secret,redirect,enabled:!!id&&!!secret&&valid};
}
export async function handleCity(req:Request,path:string[],body:any,c:Context):Promise<Response|null>{
 const {db,json,fail}=c;const route=path[0],method=req.method;
 const inventory=await handleInventory(req,path,body,c);if(inventory)return inventory;
 const friends=await handleFriends(req,path,body,c);if(friends)return friends;
 const appearance=await handleAppearance(req,path,body,c);if(appearance)return appearance;
 const expanded=await handleExpandedProfile(req,path,body,c);if(expanded)return expanded;
 if(route==='profiles'&&method==='GET'){
  const u=await c.needUser(req);if(!u.nicknameSet)throw nicknameFailure(c,'먼저 사용할 닉네임을 설정해주세요.','nickname_required',403);
  const id=path[1];
  if(path.length!==2||typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw fail('프로필을 찾을 수 없습니다.',404);
  // Public profile reads never select credentials, account settings, or inventory.
  const profile=await db().prepare("SELECT u.id,u.nickname,u.avatar,COALESCE(p.use_photo,0) AS usePhoto,ph.version AS photoVersion,COALESCE(p.frame,'classic') AS frame,COALESCE(p.title,'뉴비 머미러') AS title,COALESCE(p.bio,'') AS bio,COALESCE(p.points,0) AS points,p.featured_achievement AS achievementId,COALESCE(p.last_game_honor,0) AS lastGameHonor FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id LEFT JOIN profile_photos ph ON ph.user_id=u.id WHERE u.id=? AND u.nickname_set=1").bind(id).first();
  if(!profile)throw fail('프로필을 찾을 수 없습니다.',404);
  const stats=await profileProgress(c,id),clears=stats.clears;
  const achievement=stats.achievements.find(item=>item.id===profile.achievementId)||null;
  return json({profile:{id:profile.id,nickname:profile.nickname,avatar:profile.avatar,avatarUrl:avatarUrl(profile),frame:profile.frame,title:profile.title,bio:profile.bio,points:profile.points,clears,level:1+Math.floor(clears/5),progress:(clears%5)*20,achievement,lastGameHonor:Math.min(6,Math.max(0,Math.trunc(Number(profile.lastGameHonor)||0)))}});
 }
 if(route==='auth'&&path[1]==='providers'&&method==='GET')return json({google:googleConfig(req).enabled});
 if(route==='auth'&&path[1]==='google'&&method==='GET'){
  const cfg=googleConfig(req);const callback=path[2]==='callback';
  const failed=(reason:string)=>new Response(null,{status:303,headers:{location:`/?auth_error=${reason}`,'set-cookie':oauthCookie(req,'',0),'cache-control':'no-store','referrer-policy':'no-referrer'}});
  if(!cfg.enabled)return failed('configuration');
  if(!callback){
   const state=crypto.randomUUID()+crypto.randomUUID();const verifier=base64url(crypto.getRandomValues(new Uint8Array(48)));
   const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   await db().prepare('DELETE FROM google_auth_states WHERE expires_at<?').bind(Date.now()).run();
   await db().prepare('INSERT INTO google_auth_states(state,verifier,expires_at) VALUES(?,?,?)').bind(await c.digest(state),verifier,Date.now()+600000).run();
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:cfg.id,redirect_uri:cfg.redirect,response_type:'code',scope:'openid profile',state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
   return new Response(null,{status:303,headers:{location:url.href,'set-cookie':oauthCookie(req,state),'cache-control':'no-store','referrer-policy':'no-referrer'}});
  }
  const params=new URL(req.url).searchParams;const state=params.get('state')||'';const cookie=req.headers.get('cookie')?.match(/(?:^|;\s*)city_oauth=([^;]+)/)?.[1];
  if(!state||state!==cookie)return failed('state');
  const saved=await db().prepare('DELETE FROM google_auth_states WHERE state=? RETURNING *').bind(await c.digest(state)).first();
  if(!saved||saved.expires_at<Date.now())return failed('expired');
  if(params.has('error')||!params.get('code'))return failed('cancelled');
  try{
   const exchange=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:params.get('code')!,client_id:cfg.id,client_secret:cfg.secret,redirect_uri:cfg.redirect,grant_type:'authorization_code',code_verifier:saved.verifier})});
   if(!exchange.ok)return failed('provider');const tokens:any=await exchange.json();
   const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});
   if(!response.ok)return failed('provider');const info:any=await response.json();
   if(typeof info.sub!=='string'||!info.sub||info.sub.length>255)return failed('provider');
   let account=await db().prepare('SELECT user_id FROM google_accounts WHERE subject=?').bind(info.sub).first();
   if(!account){
    const id=crypto.randomUUID();const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,10);const nickname='시민'+suffix;
    try{await db().batch([
     db().prepare('INSERT INTO users(id,nickname,nickname_set,hash,salt,avatar,created_at) VALUES(?,?,0,\'\',\'\',0,?)').bind(id,nickname,Date.now()),
     db().prepare('INSERT INTO google_accounts(subject,user_id) VALUES(?,?)').bind(info.sub,id),
     db().prepare('INSERT INTO player_profiles(user_id) VALUES(?)').bind(id)
    ]);account={user_id:id};}catch{account=await db().prepare('SELECT user_id FROM google_accounts WHERE subject=?').bind(info.sub).first();if(!account)return failed('provider');}
   }
   const headers=new Headers({location:'/?welcome=google','cache-control':'no-store','referrer-policy':'no-referrer'});headers.append('set-cookie',await c.session(req,account.user_id));headers.append('set-cookie',oauthCookie(req,'',0));return new Response(null,{status:303,headers});
  }catch{return failed('provider');}
 }
 if(route==='profile'&&path[1]==='nickname'&&path.length===2&&method==='POST'){
  const u=await c.needUser(req);const changed=await changeNickname(c,u,body.nickname);
  return json({ok:true,...changed,nicknameSet:true});
 }
 if(route==='profile'&&path[1]==='bio'&&path.length===2&&method==='POST'){
  const u=await c.needUser(req);if(!u.nicknameSet)throw nicknameFailure(c,'먼저 사용할 닉네임을 설정해주세요.','nickname_required',403);
  const bio=normalizeBio(body?.bio,c);
  // Save only the field edited in the lobby, preserving independently changed profile fields.
  await db().prepare('INSERT INTO player_profiles(user_id,bio) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio').bind(u.id,bio).run();
  return json({ok:true,bio});
 }
 if(route==='profile'&&path.length===2&&((path[1]==='titles'&&method==='GET')||(path[1]==='title'&&method==='POST'))){
  const u=await c.needUser(req);if(!u.nicknameSet)throw nicknameFailure(c,'먼저 사용할 닉네임을 설정해주세요.','nickname_required',403);
  if(method==='GET')return json({titles:STARTER_TITLES,title:u.title});
  if(!isOwnedTitle(body.title))throw fail('보유한 칭호를 선택해주세요.');
  // Changing a title must not save stale copies of the other profile fields.
  await db().prepare('INSERT INTO player_profiles(user_id,title) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET title=excluded.title').bind(u.id,body.title).run();
  return json({ok:true,title:body.title});
 }
 if(route==='profile'&&path.length===1&&method==='POST'){
  const u=await c.needUser(req);if(!u.nicknameSet)throw nicknameFailure(c,'먼저 사용할 닉네임을 설정해주세요.','nickname_required',403);
  const nickname=normalizeNickname(body.nickname??u.nickname);
  const bio=body.bio===undefined?'':normalizeBio(body.bio,c);
  const frame=body.frame===undefined?u.frame:body.frame;
  if(!isStarterFrame(frame))throw fail('보유한 프로필 테두리를 선택해주세요.');
  const title=body.title===undefined?u.title:body.title;
  if(!isOwnedTitle(title))throw fail('보유한 칭호를 선택해주세요.');
  const avatar=body.avatar===undefined?u.avatar:body.avatar;if(!isStarterAvatar(avatar))throw fail('보유한 프로필 이미지를 선택해주세요.');
  if(nickname!==u.nickname)await changeNickname(c,u,nickname);
  await db().batch([
   db().prepare('UPDATE users SET avatar=? WHERE id=?').bind(avatar,u.id),
   db().prepare('INSERT INTO player_profiles(user_id,bio,title,frame,use_photo) VALUES(?,?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET bio=CASE WHEN ? THEN excluded.bio ELSE player_profiles.bio END,title=CASE WHEN ? THEN excluded.title ELSE player_profiles.title END,frame=CASE WHEN ? THEN excluded.frame ELSE player_profiles.frame END,use_photo=CASE WHEN ? THEN 0 ELSE player_profiles.use_photo END').bind(u.id,bio,title,frame,body.bio===undefined?0:1,body.title===undefined?0:1,body.frame===undefined?0:1,body.avatar===undefined?0:1)
  ]);
  return json({ok:true});
 }
 if(route==='lobby'&&path[1]==='chat'){
  const u=await c.user(req);
  if(method==='POST'){
   if(!u)throw fail('로그인 후 대화에 참여할 수 있어요.',401);const message=String(body.text||'').trim();
   if(!u.nicknameSet)throw nicknameFailure(c,'먼저 사용할 닉네임을 설정해주세요.','nickname_required',403);
   if(!message||message.length>300)throw fail('메시지는 1~300자로 입력해 주세요.');
   const inserted=await db().prepare('INSERT INTO lobby_messages(id,user_id,text,created_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM lobby_messages WHERE user_id=? AND created_at>?)').bind(crypto.randomUUID(),u.id,message,Date.now(),u.id,Date.now()-1000).run();
   if(!inserted.meta.changes)throw fail('조금 천천히 대화해 주세요.',429);
  }
  if(u)await db().prepare('INSERT INTO lobby_presence(user_id,seen_at) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET seen_at=excluded.seen_at').bind(u.id,Date.now()).run();
  const {results}=await db().prepare('SELECT m.id,m.user_id AS author,m.text,m.created_at AS at,u.nickname AS name,u.avatar,COALESCE(p.use_photo,0) AS usePhoto,ph.version AS photoVersion,COALESCE(p.frame,\'classic\') AS frame,COALESCE(p.title,\'뉴비 머미러\') AS title FROM lobby_messages m JOIN users u ON u.id=m.user_id LEFT JOIN player_profiles p ON p.user_id=u.id LEFT JOIN profile_photos ph ON ph.user_id=u.id ORDER BY m.created_at DESC,m.rowid DESC LIMIT 60').all();
  const online=await db().prepare('SELECT COUNT(*) AS n FROM lobby_presence WHERE seen_at>?').bind(Date.now()-45000).first();
  return json({messages:results.reverse().map((row:any)=>{const {usePhoto,photoVersion,...message}=row;return {...message,avatarUrl:avatarUrl({...row,id:row.author})};}),online:online?.n||0});
 }
 return null;
}
