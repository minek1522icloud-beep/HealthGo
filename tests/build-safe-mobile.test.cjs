'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const html = fs.readFileSync('www/index.html', 'utf8');
const builder = 'scripts/build-safe-mobile.py';
const optionalAI = '<script src="./healthgo-offline-ai.js"></script>';

function generate(inputHtml) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'healthgo-safe-'));
  const source = path.join(folder, 'index.html');
  const target = path.join(folder, 'safe.html');
  try {
    fs.writeFileSync(source, inputHtml, 'utf8');
    const command = spawnSync('python3', [builder, source, target], {
      encoding: 'utf8',
      timeout: 10000
    });
    return {
      status: command.status,
      error: command.error,
      output: command.stderr + command.stdout,
      html: fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null
    };
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
}

test('Safe mode builds against current simplified AI chat', () => {
  assert.doesNotMatch(html, /<script src="\.\/healthgo-offline-ai\.js"><\/script>/);
  const result = generate(html);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.output);
  assert.match(result.html, /healthgo-safe-mode/);
  assert.match(result.html, /Tryb bezpieczny HealthGo/);
  assert.doesNotMatch(result.html, /<script src="\.\/healthgo-mobile-suite\.js"><\/script>/);
  assert.doesNotMatch(result.html, /<script src="\.\/healthgo-offline-ai\.js"><\/script>/);
  assert.doesNotMatch(result.html, /<script src="\.\/healthgo-map-(?:v2|pro|4)\.js/);
  assert.doesNotMatch(result.html, /if \(typeof setupMobilePWA === 'function'\) setupMobilePWA\(\);/);
  assert.match(result.html, /healthgo-build/);
});

test('Safe mode still removes optional module if older shell includes it', () => {
  const legacy = html.replace('</body>', optionalAI + '\n</body>');
  const result = generate(legacy);
  assert.equal(result.status, 0, result.output);
  assert.doesNotMatch(result.html, /healthgo-offline-ai\.js/);
});

test('Safe mode excludes cache-busted navigation scripts after UI updates', () => {
  const result = generate(html);
  assert.equal(result.status, 0, result.output);
  for (const module of ['healthgo-map-v2', 'healthgo-map-pro', 'healthgo-map4', 'healthgo-navigation-live']) {
    assert.doesNotMatch(result.html, new RegExp('<script src="\\./' + module + '\\.js'));
  }
});

test('Safe mode rejects duplicate optional module tags', () => {
  const broken = html.replace('</body>', optionalAI + '\n' + optionalAI + '\n</body>');
  const result = generate(broken);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /duplicate optional tags/);
});
