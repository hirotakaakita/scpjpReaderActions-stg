const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '../.github/workflows', name), 'utf8').replace(/\r/g, '');
function job(workflow, name) {
  const start = workflow.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `Missing job ${name}`);
  return workflow.slice(start + 1).split(/\n  [\w-]+:\n/)[0];
}
function concurrency(block) {
  const match = block.match(/(?:^|\n)( *)concurrency:\n((?:\1 +[^\n]*\n)+)/);
  assert.ok(match, 'Missing concurrency settings');
  return Object.fromEntries([...match[2].matchAll(/ +([\w-]+): ([^\n]+)/g)].map(m => [m[1], m[2]]));
}

test('long crawls never hold the notification write lock', () => {
  const crawler = read('scp-crawler.yml');
  const notification = read('scheduled-notifications.yml');
  const crawlLock = concurrency(crawler.split('\njobs:')[0]);
  const publishLock = concurrency(job(crawler, 'merge-and-deploy'));
  const sendLock = concurrency(job(notification, 'send'));
  assert.notEqual(crawlLock.group, sendLock.group);
  assert.equal(publishLock.group, sendLock.group);
  assert.doesNotMatch(job(crawler, 'crawl'), /concurrency:/);
  assert.doesNotMatch(notification.split('\njobs:')[0], /concurrency:/);
  for (const lock of [crawlLock, publishLock, sendLock]) {
    assert.equal(lock['cancel-in-progress'], 'false');
    assert.equal(lock.queue, 'max');
  }
});

test('writers load current master after acquiring the lock and never force conflict resolution', () => {
  const publisher = job(read('scp-crawler.yml'), 'merge-and-deploy');
  const sender = job(read('scheduled-notifications.yml'), 'send');
  for (const writer of [publisher, sender]) {
    assert.match(writer, /uses: actions\/checkout@v\d+\n +with:\n +ref: master/);
    assert.match(writer, /timeout-minutes: \d+/);
    assert.doesNotMatch(writer, /git pull|--force|--rebase|-X theirs/);
  }
  assert.ok(publisher.indexOf('ref: master') < publisher.indexOf('node prepare-notification-queue.js'));
});


test('full text retrieval has its own time budget and preserves current-run crawl captures', () => {
  const workflow = read('scp-crawler.yml');
  const crawl = job(workflow, 'crawl');
  const refresh = job(workflow, 'refresh-article-text');
  const publish = job(workflow, 'merge-and-deploy');
  assert.doesNotMatch(crawl, /run: node tool\/refresh-article-text/);
  assert.match(refresh, /needs: \[setup, crawl\]/);
  assert.match(refresh, /timeout-minutes: 360/);
  assert.match(refresh, /name: partial-\$\{\{ matrix.lang \}\}\n +path: partial-data/);
  assert.match(refresh, /run: node tool\/refresh-article-text.js/);
  assert.match(refresh, /CRAWL_REQUEST_INTERVAL_MS: '500'/);
  assert.match(refresh, /if: always\(\)\n +uses: actions\/upload-artifact/);
  assert.match(refresh, /name: article-text-\$\{\{ matrix.lang \}\}\n +path: partial-data\/excerpt-repairs\//);
  assert.match(publish, /needs: \[setup, crawl, refresh-article-text\]/);
  assert.match(publish, /needs.refresh-article-text.result == 'success'/);
  assert.match(publish, /pattern: article-text-\*\n +path: partial-data\/excerpt-repairs/);
  assert.ok(publish.indexOf('pattern: article-text-*') < publish.indexOf('node tool/apply-excerpt-repairs.js'));
});
