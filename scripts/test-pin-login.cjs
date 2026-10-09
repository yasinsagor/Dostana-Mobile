const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/hooks/useAuth.js'), 'utf8');
const loginSource = source.slice(source.indexOf('  async function login('), source.indexOf('  function logout('));
let remote = [{ name: 'Lopuszanska', pin: '2000' }];
let fail = false;
let user;
const cached = [{ name: 'Lopuszanska', pin: '1006' }];
const storage = new Map();
const login = new Function('BRANCHES', 'OWNER_PIN', 'SUPPLIER_PIN', 'ROLES', 'setRuntimeBranches', 'fetchActiveBranches', 'AsyncStorage', 'setUser', `${loginSource}; return login;`)(
  cached, '9999', '7777', { OWNER: 'owner', SUPPLIER: 'supplier', MANAGER: 'manager' },
  rows => cached.splice(0, cached.length, ...rows),
  async () => { if (fail) throw new Error('offline'); return remote; },
  { setItem: async (key, value) => storage.set(key, value) }, value => { user = value; },
);

(async () => {
  assert.equal((await login(' 2000 ')).ok, true, 'Current PIN must work despite cached old PIN');
  assert.equal(user.branch, 'Lopuszanska');
  assert.equal(user.sessionPin, '2000');
  user = null;
  assert.equal((await login('1006')).ok, false, 'Old PIN must fail');
  assert.equal(user, null);
  remote = [{ name: 'Lopuszanska', pin: '3000' }];
  assert.equal((await login('2000')).ok, false, 'Reset must take effect without restarting');
  assert.equal((await login('3000')).ok, true);
  remote = [];
  assert.equal((await login('3000')).ok, false, 'Inactive branch must fail despite cache');
  remote = [{ name: 'Lopuszanska', pin: '3000' }];
  await login('3000');
  fail = true;
  assert.equal((await login('3000')).ok, false, 'Network failure must not use cached PIN');
  assert.equal((await login('9999')).ok, true);
  assert.equal((await login('7777')).ok, true);
  console.log('PASS: current, old, changed, inactive and offline branch PIN scenarios; owner/supplier login');
})().catch(error => { console.error(error); process.exitCode = 1; });
