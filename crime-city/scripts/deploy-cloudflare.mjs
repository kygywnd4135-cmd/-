// Deploy the built app to the user's own Cloudflare account (Workers + D1).
//
//   node scripts/deploy-cloudflare.mjs setup    # create the D1 database once, save its id
//   node scripts/deploy-cloudflare.mjs deploy   # build, apply pending migrations, deploy
//   node scripts/deploy-cloudflare.mjs migrate  # apply pending migrations only
//   node scripts/deploy-cloudflare.mjs ci       # Workers Builds deploy command (after npm run build)
//
// Needs CLOUDFLARE_API_TOKEN (and CLOUDFLARE_ACCOUNT_ID when the token can see
// several accounts). The database id is not a secret and is kept in
// cloudflare.deploy.json so later deploys reuse the same database.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configFile = path.join(root, 'cloudflare.deploy.json');
const builtConfig = path.join(root, 'dist/server/wrangler.json');
const deployConfig = path.join(root, 'dist/server/wrangler.deploy.json');
const wranglerBin = path.join(root, 'node_modules/wrangler/bin/wrangler.js');

const defaults = { workerName: 'crime-city', databaseName: 'crime-city-db', location: 'apac', databaseId: '' };
const readConfig = () => ({ ...defaults, ...(fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {}) });
const writeConfig = (config) => fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  if (result.status !== 0) {
    throw new Error(`${path.basename(args[0] ?? command)} ${args.slice(1, 3).join(' ')} failed (exit ${result.status}).`);
  }
  return result.stdout ?? '';
}
const wrangler = (args, options) => run(process.execPath, [wranglerBin, ...args], options);

function setup() {
  const config = readConfig();
  if (config.databaseId) {
    console.log(`D1 database already configured: ${config.databaseName} (${config.databaseId})`);
    return;
  }
  const list = JSON.parse(wrangler(['d1', 'list', '--json'], { capture: true }));
  let database = list.find((item) => item.name === config.databaseName);
  if (!database) {
    wrangler(['d1', 'create', config.databaseName, '--location', config.location]);
    database = JSON.parse(wrangler(['d1', 'list', '--json'], { capture: true })).find((item) => item.name === config.databaseName);
  }
  if (!database?.uuid) throw new Error('Could not find the created D1 database id.');
  writeConfig({ ...config, databaseId: database.uuid });
  console.log(`Saved D1 database id to cloudflare.deploy.json: ${database.uuid}`);
}

function writeDeployConfig(config) {
  const built = JSON.parse(fs.readFileSync(builtConfig, 'utf8'));
  built.name = config.workerName;
  built.topLevelName = config.workerName;
  built.d1_databases = [{
    binding: 'DB',
    database_name: config.databaseName,
    database_id: config.databaseId,
    migrations_dir: '../../drizzle',
  }];
  built.workers_dev = true;
  fs.writeFileSync(deployConfig, JSON.stringify(built));
}

function deploy() {
  const config = readConfig();
  if (!config.databaseId) throw new Error('Run "node scripts/deploy-cloudflare.mjs setup" first.');
  run('npm', ['run', 'build']);
  writeDeployConfig(config);
  wrangler(['d1', 'migrations', 'apply', config.databaseName, '--remote', '--config', deployConfig]);
  wrangler(['deploy', '--config', deployConfig]);
}

// Deploy command for Cloudflare Workers Builds (Git integration): the build
// step has already run `npm run build`. Migrations are applied separately with
// `node scripts/deploy-cloudflare.mjs migrate`.
function ciDeploy() {
  const config = readConfig();
  if (!config.databaseId) throw new Error('cloudflare.deploy.json has no databaseId.');
  writeDeployConfig(config);
  wrangler(['deploy', '--config', deployConfig]);
}

function migrate() {
  const config = readConfig();
  if (!config.databaseId) throw new Error('Run "node scripts/deploy-cloudflare.mjs setup" first.');
  if (!fs.existsSync(builtConfig)) run('npm', ['run', 'build']);
  writeDeployConfig(config);
  wrangler(['d1', 'migrations', 'apply', config.databaseName, '--remote', '--config', deployConfig]);
}

const command = process.argv[2];
try {
  if (command === 'setup') setup();
  else if (command === 'deploy') deploy();
  else if (command === 'ci') ciDeploy();
  else if (command === 'migrate') migrate();
  else {
    console.log('Usage: node scripts/deploy-cloudflare.mjs <setup|deploy|ci|migrate>');
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
