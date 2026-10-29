import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseContributions, parseRepository, createGithubLoader } from '../src/server/github.mjs';

function calendar() {
  const days = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10);
    return { date, index, count: index === 4 ? 12 : 0 };
  });
  // Deliberately return source cells in non-chronological order, as GitHub does.
  return '<h2>12 contributions in the last year</h2>' + days.reverse().map(({ date, index, count }) =>
    '<td data-date="' + date + '" id="day-' + index + '" data-level="' + (count ? 4 : 0) + '"></td>' +
    '<tool-tip for="day-' + index + '">' + (count ? count + ' contributions' : 'No contributions') + ' on this day.</tool-tip>',
  ).join('');
}
test('calendar preserves dates, contribution counts and levels in chronological order', () => {
  const result = parseContributions(calendar());
  assert.equal(result.days.length, 365);
  assert.equal(result.days[0].date, '2025-01-01');
  assert.deepEqual(result.days[4], { date: '2025-01-05', count: 12, level: 4 });
  assert.equal(result.days[0].count, 0);
  assert.equal(result.total, 12);
  assert.equal(result.activeDays, 1);
});
test('changed or error HTML is rejected instead of showing an empty calendar', () => {
  assert.throws(() => parseContributions('<h2>Service unavailable</h2>'));
  assert.throws(() => parseContributions(calendar().replaceAll('data-level', 'removed-attribute')));
});
test('only the intended repository with real numeric statistics is accepted', () => {
  assert.deepEqual(parseRepository({ full_name: 'tuki-labs/tukicode', stargazers_count: 14, forks_count: 0, open_issues_count: 0 }), { stars: 14, forks: 0, issues: 0 });
  assert.throws(() => parseRepository({ full_name: 'other/repo' }));
  assert.throws(() => parseRepository({ full_name: 'tuki-labs/tukicode', stargazers_count: '<script>bad</script>' }));
});
test('concurrent requests coalesce and use the cache; temporary errors preserve the snapshot', async () => {
  let calls = 0;
  let clock = 1000;
  let failing = false;
  const load = createGithubLoader(async url => {
    calls++;
    await Promise.resolve();
    if (failing) return new Response('unavailable', { status: 503 });
    return url.includes('api.github.com')
      ? Response.json({ full_name: 'tuki-labs/tukicode', stargazers_count: 14, forks_count: 0, open_issues_count: 0 })
      : new Response(calendar());
  }, () => clock);
  const [a, b] = await Promise.all([load(), load()]);
  assert.deepEqual(a, b);
  assert.equal(calls, 2);
  await load();
  assert.equal(calls, 2);
  clock += 16 * 60_000;
  failing = true;
  assert.deepEqual(await load(), a);
  assert.equal(calls, 4);
  await load();
  assert.equal(calls, 4);
});
test('a failed source does not hide data from the other source or invent zeros', async () => {
  const load = createGithubLoader(async url => url.includes('api.github.com')
    ? new Response('rate limit', { status: 403 })
    : new Response(calendar()));
  const result = await load();
  assert.equal(result.repository, null);
  assert.equal(result.activity.total, 12);
});
