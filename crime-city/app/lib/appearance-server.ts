import {avatarUrl, isStarterAvatar, isStarterFrame, photoUrl} from './appearance';
import {decodeProfilePhoto} from './profile-photo';

type Context = {db: () => any; needUser: (req: Request) => Promise<any>; json: (value: any, status?: number, headers?: Record<string, string>) => Response; fail: (message: string, status?: number) => Error};
async function readAppearance(c: Context, id: string) {
  const profile = await c.db().prepare("SELECT u.id,u.avatar,COALESCE(p.frame,'classic') AS frame,COALESCE(p.use_photo,0) AS usePhoto,ph.version AS photoVersion FROM users u LEFT JOIN player_profiles p ON p.user_id=u.id LEFT JOIN profile_photos ph ON ph.user_id=u.id WHERE u.id=?").bind(id).first();
  return {avatar: profile.avatar, avatarUrl: avatarUrl(profile), frame: profile.frame, usePhoto: profile.usePhoto, uploadedUrl: profile.photoVersion ? photoUrl(id, profile.photoVersion) : null};
}

export async function handleAppearance(req: Request, path: string[], body: any, c: Context): Promise<Response | null> {
  if (path[0] === 'profile-photos' && req.method === 'GET') {
    if (path.length !== 2 || !/^[0-9a-f-]{36}$/i.test(path[1])) throw c.fail('사진을 찾을 수 없습니다.', 404);
    const photo = await c.db().prepare('SELECT data,version FROM profile_photos WHERE user_id=?').bind(path[1]).first();
    if (!photo) throw c.fail('사진을 찾을 수 없습니다.', 404);
    const headers = {'content-type': 'image/jpeg', 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=0, must-revalidate', etag: `"${photo.version}"`};
    if (req.headers.get('if-none-match') === headers.etag) return new Response(null, {status: 304, headers});
    const bytes = Uint8Array.from(atob(photo.data), character => character.charCodeAt(0));
    return new Response(bytes, {headers});
  }
  if (path[0] !== 'profile' || path.length !== 2 || !['appearance', 'photo'].includes(path[1])) return null;
  if (req.method !== 'POST' && !(path[1] === 'appearance' && req.method === 'GET')) return null;
  const u = await c.needUser(req);
  if (!u.nicknameSet) throw c.fail('먼저 사용할 닉네임을 설정해주세요.', 403);
  if (req.method === 'GET') return c.json({appearance: await readAppearance(c, u.id)});
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw c.fail('변경할 프로필을 확인해주세요.');
  if (path[1] === 'photo') {
    const photo = decodeProfilePhoto(body?.data);
    if (!photo) throw c.fail('사진을 처리하지 못했습니다. 사진을 다시 선택해주세요.');
    await c.db().batch([
      c.db().prepare('INSERT INTO profile_photos(user_id,data,version) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,version=excluded.version').bind(u.id, photo.base64, crypto.randomUUID()),
      c.db().prepare('INSERT INTO player_profiles(user_id,use_photo) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET use_photo=1').bind(u.id),
    ]);
  } else {
    const hasAvatar = Object.hasOwn(body, 'avatar'), hasFrame = Object.hasOwn(body, 'frame');
    if (!hasAvatar && !hasFrame) throw c.fail('변경할 이미지 또는 테두리를 선택해주세요.');
    if (hasAvatar && !isStarterAvatar(body.avatar) && body.avatar !== 'upload') throw c.fail('보유한 프로필 이미지를 선택해주세요.');
    if (hasFrame && !isStarterFrame(body.frame)) throw c.fail('보유한 프로필 테두리를 선택해주세요.');
    if (body.avatar === 'upload' && !await c.db().prepare('SELECT user_id FROM profile_photos WHERE user_id=?').bind(u.id).first()) throw c.fail('먼저 내 사진을 업로드해주세요.');
    const statements = [];
    if (hasAvatar && isStarterAvatar(body.avatar)) statements.push(c.db().prepare('UPDATE users SET avatar=? WHERE id=?').bind(body.avatar, u.id));
    statements.push(c.db().prepare("INSERT INTO player_profiles(user_id,frame,use_photo) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET frame=CASE WHEN ? THEN excluded.frame ELSE player_profiles.frame END,use_photo=CASE WHEN ? THEN excluded.use_photo ELSE player_profiles.use_photo END").bind(u.id, hasFrame ? body.frame : 'classic', body.avatar === 'upload' ? 1 : 0, hasFrame ? 1 : 0, hasAvatar ? 1 : 0));
    await c.db().batch(statements);
  }
  return c.json({ok: true, appearance: await readAppearance(c, u.id)});
}
