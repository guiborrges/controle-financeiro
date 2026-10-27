'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const os = require('node:os');

function digest(bytes) {
  let canonical = bytes;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (!bytes.includes(0)) canonical = Buffer.from(text.replace(/\r\n/g, '\n'));
  } catch { /* Binary resources retain their exact bytes. */ }
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function inventory(folder) {
  assert.ok(!fs.lstatSync(folder).isSymbolicLink(), `Symbolic skill root forbidden: ${folder}`);
  const files = {};
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      assert.ok(!fs.lstatSync(file).isSymbolicLink(), `Symbolic link forbidden: ${file}`);
      if (entry.isDirectory()) walk(file);
      else {
        assert.ok(entry.isFile(), `Unsupported resource: ${file}`);
        files[path.relative(folder, file).split(path.sep).join('/')] = digest(fs.readFileSync(file));
      }
    }
  }
  walk(folder);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

function validate(root, lock) {
  assert.equal(lock.version, 1);
  const skillsRoot = path.join(root, '.agents', 'skills');
  assert.equal(fs.realpathSync(skillsRoot), path.resolve(skillsRoot), 'Linked skill root forbidden');
  const names = new Set();
  let files = 0;
  for (const skill of lock.skills) {
    assert.match(skill.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!names.has(skill.name), `Duplicate skill: ${skill.name}`);
    names.add(skill.name);
    assert.equal(skill.location, `.agents/skills/${skill.name}`);
    const actual = inventory(path.join(skillsRoot, skill.name));
    assert.ok(actual['SKILL.md'], `Missing entrypoint: ${skill.name}`);
    assert.deepEqual(actual, skill.files, `Integrity mismatch: ${skill.name}`);
    if (skill.kind === 'external') assert.match(skill.commit, /^[a-f0-9]{40}$/);
    files += Object.keys(actual).length;
  }
  assert.deepEqual(fs.readdirSync(skillsRoot).sort(), [...names].sort(), 'Unregistered skill/resource');
  return { skills: names.size, files, runtimeExecuted: false };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'meufin-skills-validator-'));
  try {
    const folder = path.join(root, '.agents', 'skills', 'example');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'SKILL.md'), '---\nname: example\ndescription: Example\n---\n');
    const lock = { version: 1, skills: [{ name: 'example', location: '.agents/skills/example', files: inventory(folder) }] };
    assert.equal(validate(root, lock).skills, 1);
    fs.appendFileSync(path.join(folder, 'SKILL.md'), 'Changed');
    assert.throws(() => validate(root, lock), /Integrity mismatch/);
    lock.skills[0].files = inventory(folder);
    fs.writeFileSync(path.join(folder, 'unreviewed.js'), '');
    assert.throws(() => validate(root, lock), /Integrity mismatch/);
    assert.throws(() => validate(root, { version: 1, skills: [{ name: '../outside' }] }));
    console.log('PASS validator: valid bundle, modified source, unregistered file, traversal');
  } finally {
    // Only the fixed-prefix temporary directory created by this process is removed.
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'meufin-skills-validator-')));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    const root = path.resolve(__dirname, '..');
    console.log(JSON.stringify(validate(root, JSON.parse(fs.readFileSync(path.join(root, 'docs/skills/installation-lock.json'), 'utf8')))));
  }
}
module.exports = { digest, inventory, validate };
