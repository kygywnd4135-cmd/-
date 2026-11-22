import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local test server.');
const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 7), sessions = [];
let checks = 0, room;
const equal = (a, b) => {assert.deepEqual(a, b); checks++;};
async function call(path, body, account, status = 200, extra = {}) {
  const response = await fetch(base + '/api/' + path, {method: body === undefined ? 'GET' : 'POST', headers: {...(account ? {cookie: account.cookie} : {}), ...(body !== undefined ? {'content-type': 'application/json'} : {}), ...extra}, body: body === undefined ? undefined : JSON.stringify(body)});
  const text = await response.text();
  equal(response.status, status);
  const data = response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : {error: text};
  return {data, cookie: response.headers.get('set-cookie')?.split(';')[0]};
}
async function make(label, pending = false) {
  const result = await call('auth/signup', {loginId: 'Pic' + suffix + label, password: 'ProfilePhotoQA42!', avatar: 5});
  const account = {id: result.data.user.id, cookie: result.cookie}; sessions.push(account);
  equal(result.data.user.avatar, 0);
  if (!pending) await call('profile/nickname', {nickname: '사진' + suffix + label}, account);
  return account;
}
const jpeg = await sharp({create: {width: 512, height: 512, channels: 3, background: '#287c49'}}).jpeg().toBuffer();
const data = 'data:image/jpeg;base64,' + jpeg.toString('base64');
const rectangular = 'data:image/jpeg;base64,' + (await sharp({create: {width: 640, height: 400, channels: 3, background: '#fff'}}).jpeg().toBuffer()).toString('base64');
// Asymmetric color bands verify that the browser takes the center square, rather than stretching.
await fs.writeFile('../../work/profile-crop-fixture.png', await sharp(Buffer.from('<svg width="900" height="600"><rect width="900" height="600" fill="#287c49"/><rect width="150" height="600" fill="red"/><rect x="750" width="150" height="600" fill="blue"/></svg>')).png().toBuffer());
try {
  const a = await make('A'), viewer = await make('B'), pending = await make('C', true);
  await call('profile/appearance', undefined, undefined, 401);
  await call('profile/photo', {data}, undefined, 401);
  await call('profile/appearance', undefined, pending, 403);
  await call('profile/photo', {data}, pending, 403);
  let appearance = (await call('profile/appearance', undefined, a)).data.appearance;
  equal(appearance, {avatar: 0, avatarUrl: '/assets/profiles/male-a.webp', frame: 'classic', usePhoto: 0, uploadedUrl: null});
  await call('profile/appearance', {avatar: 'upload'}, a, 400);
  for (const value of [2, 5, -1, '1', 'locked', null]) await call('profile/appearance', {avatar: value}, a, 400);
  for (const frame of ['silver', 'event', '', null]) await call('profile/appearance', {frame}, a, 400);
  await call('profile/appearance', {}, a, 400);
  await call('profile/appearance', null, a, 400);
  await call('profile', {avatar: 2}, a, 400);
  await call('profile', {avatar: 0, frame: 'silver'}, a, 400);
  await call('profile/appearance', {avatar: 1}, a, 403, {origin: 'https://untrusted.example'});
  await call('profile/photo', {data}, a, 403, {origin: 'https://untrusted.example'});
  for (const value of [null, 'not-a-photo', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/jpeg;base64,AAAA', rectangular]) await call('profile/photo', {data: value}, a, 400);
  await call('profile/photo', {data: 'x'.repeat(422000)}, a, 413);
  await call('profile/bio', {bio: '사진 변경 중 보존할 소개'}, a);
  await call('profile/title', {title: '밤의 기록자'}, a);
  appearance = (await call('profile/appearance', {avatar: 1, frame: 'crimson', points: 9999}, a)).data.appearance;
  equal(appearance.avatarUrl, '/assets/profiles/female-a.webp'); equal(appearance.frame, 'crimson');
  appearance = (await call('profile/photo', {data}, a)).data.appearance;
  equal(appearance.usePhoto, 1); equal(appearance.avatarUrl, appearance.uploadedUrl); equal(appearance.frame, 'crimson');
  const photo = await fetch(base + appearance.avatarUrl);
  equal(photo.status, 200); equal(photo.headers.get('content-type'), 'image/jpeg'); equal(photo.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await photo.arrayBuffer()); equal(bytes, jpeg);
  const metadata = await sharp(bytes).metadata(); equal([metadata.width, metadata.height], [512, 512]);
  const cached = await fetch(base + appearance.avatarUrl, {headers: {'if-none-match': photo.headers.get('etag')}}); equal(cached.status, 304);
  let me = (await call('me', undefined, a)).data.user;
  equal(me.avatarUrl, appearance.avatarUrl); equal(me.bio, '사진 변경 중 보존할 소개'); equal(me.title, '밤의 기록자'); equal(me.points, 0);
  const profile = (await call('profiles/' + a.id, undefined, viewer)).data.profile;
  equal(profile.avatarUrl, appearance.avatarUrl); equal(profile.frame, 'crimson'); equal(Object.hasOwn(profile, 'uploadedUrl'), false); equal(Object.hasOwn(profile, 'data'), false);
  await call('profile/appearance', {frame: 'classic'}, a);
  me = (await call('me', undefined, a)).data.user; equal(me.avatarUrl, appearance.avatarUrl);
  const ownUrl = appearance.avatarUrl;
  appearance = (await call('profile/appearance', {avatar: 0}, a)).data.appearance;
  equal(appearance.avatarUrl, '/assets/profiles/male-a.webp'); equal(appearance.uploadedUrl, ownUrl);
  await call('profile/appearance', {avatar: 'upload'}, a);
  // An unrelated legacy save may not silently disable the custom photo.
  await call('profile', {bio: '소개만 수정'}, a);
  equal((await call('me', undefined, a)).data.user.avatarUrl, ownUrl);
  room = (await call('rooms', {title: '프로필 연동 검증', demo: true}, a)).data;
  equal(room.players[0].avatarUrl, ownUrl); equal(room.players[0].frame, 'classic');
  equal((await call('profile/appearance', undefined, viewer)).data.appearance.avatarUrl, '/assets/profiles/male-a.webp');
  await call('profile-photos/' + crypto.randomUUID(), undefined, undefined, 404);
  console.log(`PASS: ${checks} appearance checks. Starter ownership, legacy bypass rejection, bounded square JPEG uploads, saved photo reuse, public rendering, isolation, CSRF, and room integration.`);
} finally {
  if (room) await call('rooms/' + room.id + '/leave', {}, sessions[0]).catch(() => {});
  for (const account of sessions) await call('auth/logout', {}, account).catch(() => {});
}
