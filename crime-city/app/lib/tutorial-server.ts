import {TUTORIAL_DONE,TUTORIAL_NAME_STEP} from './tutorial';
type Context={db:()=>any;needUser:(req:Request)=>Promise<any>;json:(value:any,status?:number)=>Response;fail:(message:string,status?:number)=>Error};
export async function handleTutorial(req:Request,path:string[],body:any,c:Context):Promise<Response|null>{
 if(path[0]!=='tutorial')return null;
 if(path.length!==1||!['GET','POST'].includes(req.method))throw c.fail('안내 경로를 확인해주세요.',404);
 const user=await c.needUser(req),db=c.db();
 async function read(){const row=await db.prepare('SELECT tutorial_step AS tutorialStep,nickname_set AS nicknameSet,nickname FROM users WHERE id=?').bind(user.id).first();return{tutorialStep:Number(row.tutorialStep),nicknameSet:!!row.nicknameSet,nickname:row.nicknameSet?row.nickname:''};}
 const current=await read();
 if(req.method==='GET')return c.json(current);
 if(!body||typeof body!=='object'||Object.keys(body).length!==1||!Number.isSafeInteger(body.step)||body.step<0||body.step>TUTORIAL_DONE)throw c.fail('안내 진행 단계를 확인해주세요.');
 const next=body.step;
 if(next===current.tutorialStep)return c.json(current);
 if(next>TUTORIAL_NAME_STEP&&!current.nicknameSet)throw c.fail('먼저 코드네임을 설정해주십쇼.',403);
 const valid=next===current.tutorialStep+1||(next===TUTORIAL_NAME_STEP&&current.tutorialStep<TUTORIAL_NAME_STEP)||(next===TUTORIAL_DONE&&current.nicknameSet);
 if(current.tutorialStep>=TUTORIAL_DONE||!valid)throw c.fail('안내 진행 상태가 변경되었습니다. 다시 확인해주세요.',409);
 const result=await db.prepare('UPDATE users SET tutorial_step=? WHERE id=? AND tutorial_step=?').bind(next,user.id,current.tutorialStep).run();
 if(!result.meta.changes)throw c.fail('다른 창에서 안내가 진행되었습니다. 다시 확인해주세요.',409);
 return c.json(await read());
}
