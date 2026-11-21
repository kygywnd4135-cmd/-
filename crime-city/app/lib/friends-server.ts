type Context = {db:()=>any; needUser:(request:Request)=>Promise<any>; json:(value:any)=>Response; fail:(message:string,status?:number)=>Error};

export async function handleFriends(request:Request,path:string[],body:any,c:Context):Promise<Response|null> {
  if(path[0]!=='friends')return null;
  if(path.length!==2||path[1]!=='requests'||!['GET','POST'].includes(request.method))throw c.fail('친구 요청 경로를 확인해주세요.',404);
  const user=await c.needUser(request);
  if(!user.nicknameSet)throw c.fail('먼저 사용할 닉네임을 설정해주세요.',403);
  if(request.method==='GET') {
    // This inbox is private to the signed-in sender/recipient; no caller-selected owner.
    const {results}=await c.db().prepare("SELECT r.sender_id,r.recipient_id,r.created_at,s.nickname AS sender_name,t.nickname AS recipient_name FROM friend_requests r JOIN users s ON s.id=r.sender_id JOIN users t ON t.id=r.recipient_id WHERE r.status='pending' AND (r.sender_id=? OR r.recipient_id=?) ORDER BY r.created_at DESC,r.pair_key LIMIT 200").bind(user.id,user.id).all();
    return c.json({incoming:results.filter((r:any)=>r.recipient_id===user.id).map((r:any)=>({from:{id:r.sender_id,nickname:r.sender_name},createdAt:r.created_at})),outgoing:results.filter((r:any)=>r.sender_id===user.id).map((r:any)=>({to:{id:r.recipient_id,nickname:r.recipient_name},createdAt:r.created_at}))});
  }
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='userId')||typeof body.userId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId))throw c.fail('친구 요청할 플레이어를 확인해주세요.');
  const targetId=body.userId.toLowerCase();
  if(targetId===user.id)throw c.fail('자신에게는 친구를 요청할 수 없습니다.');
  const target=await c.db().prepare('SELECT id FROM users WHERE id=? AND nickname_set=1').bind(targetId).first();
  if(!target)throw c.fail('플레이어를 찾을 수 없습니다.',404);
  // One canonical pair prevents duplicate and simultaneous opposite-direction requests.
  const pairKey=[user.id,targetId].sort().join(':');
  const result=await c.db().prepare("INSERT OR IGNORE INTO friend_requests(pair_key,sender_id,recipient_id,status,created_at) VALUES(?,?,?,'pending',?)").bind(pairKey,user.id,targetId,Date.now()).run();
  return c.json({status:result.meta.changes?'sent':'already_requested_or_friends'});
}
