import './sites-env.mjs';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'node_modules/wrangler/bin/wrangler.js');
const config = path.join(root, 'wrangler.local.json');
const [mode, file, ...extra] = process.argv.slice(2);
const tables = ['users', 'sessions', 'rooms', 'player_profiles', 'profile_photos', 'lobby_messages', 'lobby_presence', 'google_accounts', 'google_auth_states', 'player_inventories', 'friend_requests', 'player_shop_states', 'shop_orders'];

function wrangler(args, json = false) {
  const result = spawnSync(process.execPath, [cli, ...args, '--config', config, '--local'], {
    cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    stdio: json ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    // Do not echo SQL dump contents or private profile rows on failure.
    let reason = result.error?.message;
    if (json) {
      try {reason ||= JSON.parse(result.stdout)?.error?.text;} catch {}
    }
    throw new Error('Local database command failed. Check local connection permissions and the selected project folder.' + (reason ? ' ' + reason : ''));
  }
  return json ? JSON.parse(result.stdout) : null;
}
function query(sql) {
  return wrangler(['d1', 'execute', 'DB', '--persist-to', path.join(root, '.wrangler/state'), '--command', sql, '--json'], true)[0].results;
}
function existingTables() {
  return query("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name")
    .map(row => row.name).filter(name => tables.includes(name));
}
function emptyTarget() {
  const existing = existingTables();
  if (existing.length) throw new Error('This database already contains app tables. Nothing was imported or reset. Restore into a fresh project folder instead.');
}
function summary() {
  const existing = existingTables();
  if (existing.length && !existing.includes('player_inventories')) throw new Error('This older database needs inventory migration 0005_clever_randall.sql. Apply only that pending migration with wrangler.local.json; never run db:init against an existing database.');
  if (existing.length && !existing.includes('friend_requests')) throw new Error('This older database needs friend-request migration 0006_bumpy_reptil.sql. Apply only that pending migration with wrangler.local.json; never run db:init against an existing database.');
  if (existing.length && (!existing.includes('player_shop_states') || !existing.includes('shop_orders'))) throw new Error('This older database needs shop migration 0008_eminent_scalphunter.sql. Apply only that pending migration; never run db:init against an existing database.');
  if (tables.some(name => !existing.includes(name))) throw new Error('The local database is missing app tables. Use db:init for a new database, or db:restore for an existing backup.');
  const userColumns = query('PRAGMA table_info(users)').map(row => row.name);
  if (!userColumns.includes('tutorial_step')) throw new Error('This older database needs tutorial migration 0009_slippery_nextwave.sql. Apply only that pending migration; never run db:init against an existing database.');
  const columns = query('PRAGMA table_info(player_profiles)').map(row => row.name);
  if (!columns.includes('primacy_tokens')) throw new Error('This older database needs currency migration 0007_quiet_king_cobra.sql. Apply only that pending migration with wrangler.local.json; never run db:init against an existing database.');
  if (!columns.includes('last_game_honor') || !columns.includes('featured_achievement')) throw new Error('The local database is missing the latest profile migration (0004). Do not reapply all migrations to an existing database.');
  return query('SELECT ' + tables.map(name => `(SELECT COUNT(*) FROM ${name}) AS ${name}`).join(','))[0];
}
function executeFile(filename) {
  wrangler(['d1', 'execute', 'DB', '--persist-to', path.join(root, '.wrangler/state'), '--file', filename, '--json'], true);
  console.log('Applied ' + path.basename(filename));
}

try {
  if (extra.length || !['check', 'init', 'export', 'restore'].includes(mode) || ((mode === 'export' || mode === 'restore') !== !!file)) {
    throw new Error('Usage: node scripts/local-db.mjs check | init | export <new-file.sql> | restore <backup.sql>');
  }
  if (!existsSync(cli)) throw new Error('Install project dependencies with npm ci first.');
  if (mode === 'init') {
    emptyTarget();
    const folder = path.join(root, 'drizzle');
    for (const name of readdirSync(folder).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) executeFile(path.join(folder, name));
    console.log(JSON.stringify({ok: true, action: 'initialized', counts: summary()}, null, 2));
  } else if (mode === 'restore') {
    const filename = path.resolve(file);
    if (!filename.endsWith('.sql') || !existsSync(filename)) throw new Error('Select an existing SQL backup file.');
    emptyTarget();
    executeFile(filename);
    console.log(JSON.stringify({ok: true, action: 'restored', counts: summary()}, null, 2));
  } else if (mode === 'export') {
    const filename = path.resolve(file);
    if (!filename.endsWith('.sql') || existsSync(filename)) throw new Error('Choose a new .sql filename. Existing backups will never be overwritten.');
    summary();
    mkdirSync(path.dirname(filename), {recursive: true});
    // The root config is deliberate: export has no --persist-to option, and a
    // dist/server config would otherwise target a different, empty database.
    wrangler(['d1', 'export', 'DB', '--output', filename]);
    console.log('Private SQL backup saved. Keep it outside your Git repository.');
  } else {
    console.log(JSON.stringify({ok: true, counts: summary()}, null, 2));
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
