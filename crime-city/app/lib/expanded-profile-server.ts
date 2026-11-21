import {earnedAchievements} from './achievements';

type Context = {db: () => any; needUser: (req: Request) => Promise<any>; json: (value: any) => Response; fail: (message: string, status?: number) => Error};

export async function profileProgress(c: Context, id: string) {
  const stats = await c.db().prepare("SELECT COUNT(*) AS completed,COALESCE(SUM(CASE WHEN json_extract(v.value,'$.suspect')=2 THEN 1 ELSE 0 END),0) AS clears FROM rooms r,json_each(json_extract(r.data,'$.votes')) v WHERE json_extract(r.data,'$.status')='ended' AND v.key=?").bind(id).first();
  const completed = Number(stats?.completed) || 0, clears = Number(stats?.clears) || 0;
  return {completed, clears, achievements: earnedAchievements(completed, clears)};
}

export async function handleExpandedProfile(req: Request, path: string[], body: any, c: Context): Promise<Response | null> {
  if (path[0] !== 'profile' || path.length !== 2 || !((path[1] === 'expanded' && req.method === 'GET') || (path[1] === 'achievement' && req.method === 'POST'))) return null;
  const user = await c.needUser(req);
  if (!user.nicknameSet) throw c.fail('먼저 사용할 닉네임을 설정해주세요.', 403);
  const stats = await profileProgress(c, user.id);
  if (req.method === 'POST') {
    const value = body?.achievementId;
    if (value !== null && (typeof value !== 'string' || !stats.achievements.some(item => item.id === value))) throw c.fail('보유한 업적을 선택해주세요.');
    await c.db().prepare('INSERT INTO player_profiles(user_id,featured_achievement) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET featured_achievement=excluded.featured_achievement').bind(user.id, value).run();
    return c.json({ok: true, achievementId: value});
  }
  const settings = await c.db().prepare('SELECT featured_achievement AS achievementId,last_game_honor AS lastGameHonor FROM player_profiles WHERE user_id=?').bind(user.id).first();
  const achievementId = stats.achievements.some(item => item.id === settings?.achievementId) ? settings.achievementId : null;
  return c.json({profile: {
    id: user.id, nickname: user.nickname, avatar: user.avatar, avatarUrl: user.avatarUrl, frame: user.frame,
    title: user.title, bio: user.bio, points: user.points, clears: stats.clears, completed: stats.completed,
    level: 1 + Math.floor(stats.clears / 5), achievementId,
    // Honor voting is not enabled yet; the display reads the last recorded game only.
    lastGameHonor: Math.min(6, Math.max(0, Math.trunc(Number(settings?.lastGameHonor) || 0))),
  }, achievements: stats.achievements});
}
