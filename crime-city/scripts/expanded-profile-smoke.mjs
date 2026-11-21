import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {earnedAchievements} from '../app/lib/achievements.ts';

const base = process.env.BASE_URL || 'http://127.0.0.1:5173';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use a local test server.');
const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 7), accounts = [];
let checks = 0, room;
const equal = (a, b) => {assert.deepEqual(a, b); checks++;};
async function call(path, body, account, status = 200, headers = {}) {
  const response = await fetch(base + '/api/' + path, {method: body === undefined ? 'GET' : 'POST', headers: {...(account ? {cookie: account.cookie} : {}), ...(body !== undefined ? {'content-type': 'application/json'} : {}), ...headers}, body: body === undefined ? undefined : JSON.stringify(body)});
  const text = await response.text(); equal(response.status, status);
  return {data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : {error: text}, cookie: response.headers.get('set-cookie')?.split(';')[0]};
}
async function make(label, pending = false) {
  const result = await call('auth/signup', {loginId: 'Expand' + suffix + label, password: 'ExpandedProfile42!'});
  const account = {id: result.data.user.id, cookie: result.cookie}; accounts.push(account);
  if (!pending) await call('profile/nickname', {nickname: '확대' + suffix + label}, account);
  return account;
}
const read = async account => (await call('profile/expanded', undefined, account)).data;
equal(earnedAchievements(0, 0), []);
equal(earnedAchievements(1, 0).map(item => item.id), ['first-case']);
equal(earnedAchievements(1, 1).map(item => item.id), ['first-case', 'first-truth']);
equal(earnedAchievements(5, 0).map(item => item.id), ['first-case', 'five-cases']);
try {
  const a = await make('A'), b = await make('B'), pending = await make('C', true);
  await call('profile/expanded', undefined, undefined, 401);
  await call('profile/achievement', {achievementId: null}, undefined, 401);
  await call('profile/expanded', undefined, pending, 403);
  await call('profile/achievement', {achievementId: null}, pending, 403);
  const initial = await read(a);
  equal(initial.achievements, []); equal(initial.profile.achievementId, null); equal(initial.profile.lastGameHonor, 0);
  equal(initial.profile.id, a.id); equal(initial.profile.level, 1); equal(initial.profile.completed, 0);
  equal(Object.hasOwn(initial.profile, 'loginId'), false); equal(Object.hasOwn(initial.profile, 'hash'), false);
  for (const value of [undefined, 'first-case', 'first-truth', 'five-cases', 'invented', 1, {}, []]) await call('profile/achievement', {achievementId: value}, a, 400);
  await call('profile/achievement', {achievementId: null}, a);
  await call('profile/bio', {bio: '대표 업적 변경 중 보존할 소개'}, a);
  await call('profile/title', {title: '밤의 기록자'}, a);
  await call('profile/appearance', {avatar: 1, frame: 'crimson'}, a);
  room = (await call('rooms', {title: '확대 프로필 업적 검증', demo: true}, a)).data.id;
  await call('rooms/' + room + '/ready', {}, a); await call('rooms/' + room + '/start', {}, a);
  for (let phase = 0; phase < 5; phase++) await call('rooms/' + room + '/next', {}, a);
  await call('rooms/' + room + '/vote', {suspect: 2, publication: 'redacted'}, a);
  const earned = await read(a);
  equal(earned.profile.completed, 1); equal(earned.profile.clears, 1); equal(earned.profile.lastGameHonor, 0);
  equal(earned.achievements.map(item => item.id), ['first-case', 'first-truth']);
  equal(earned.profile.achievementId, null);
  equal((await call('profile/achievement', {achievementId: 'first-case', lastGameHonor: 6, title: '덮어쓰기', bio: '덮어쓰기'}, a)).data, {ok: true, achievementId: 'first-case'});
  let current = await read(a);
  equal(current.profile, {...earned.profile, achievementId: 'first-case'});
  await call('profile/achievement', {achievementId: 'first-truth'}, a);
  current = await read(a); equal(current.profile.achievementId, 'first-truth');
  await call('profile/achievement', {achievementId: 'five-cases'}, a, 400);
  await call('profile/achievement', {achievementId: 'first-case'}, a, 403, {origin: 'https://untrusted.example'});
  equal((await read(a)).profile.achievementId, 'first-truth');
  equal((await read(b)).achievements, []); equal((await read(b)).profile.achievementId, null);
  await call('profile/achievement', {achievementId: null}, a); equal((await read(a)).profile.achievementId, null);
  if (process.argv.includes('--fixtures')) {
    assert(accounts.includes(a) && /^[a-f0-9-]{36}$/.test(a.id), 'Modify only this run’s disposable account.');
    execFileSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', '--local', '--config', 'dist/server/wrangler.json', '--persist-to', '.wrangler/state', '--command', `UPDATE player_profiles SET last_game_honor=3 WHERE user_id='${a.id}'`], {stdio: 'pipe'});
    equal((await read(a)).profile.lastGameHonor, 3);
    await call('profile/achievement', {achievementId: 'first-case', lastGameHonor: 6}, a);
    equal((await read(a)).profile.lastGameHonor, 3);
  }
  console.log(`PASS: ${checks} expanded-profile checks. Own data, onboarding, earned-only achievements, saved selection, independent profile fields, recorded honor display, and CSRF.`);
} finally {
  if (room) await call('rooms/' + room + '/leave', {}, accounts[0]).catch(() => {});
  for (const account of accounts) await call('auth/logout', {}, account).catch(() => {});
}
