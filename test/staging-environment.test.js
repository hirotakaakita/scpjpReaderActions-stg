const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateNotificationTarget, TOPIC_PREFIX } = require('../staging-environment');

test('production credentials are rejected before authentication', () => {
  assert.throws(() => validateNotificationTarget({
    type: 'service_account', project_id: 'scpjp-reader',
  }), /scpjp-reader-stg/);
});
test('staging credentials cannot be used from the production repository', () => {
  assert.throws(() => validateNotificationTarget({
    type: 'service_account', project_id: 'scpjp-reader-stg',
  }, 'hirotakaakita/scpjpReaderActions'), /staging repository/);
});
test('only staging credentials and topic are allowed', () => {
  validateNotificationTarget({
    type: 'service_account', project_id: 'scpjp-reader-stg',
  }, 'hirotakaakita/scpjpReaderActions-stg');
  assert.equal(TOPIC_PREFIX, 'stg_new_scp_');
});
