const SOURCES = {
  repository: 'https://api.github.com/repos/tuki-labs/tukicode',
  activity: 'https://github.com/users/sb4ss/contributions',
};
const integer = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function parseRepository(data) {
  if (data.full_name?.toLowerCase() !== 'tuki-labs/tukicode') throw new Error('Unexpected repository');
  const stars = integer(data.stargazers_count);
  const forks = integer(data.forks_count);
  const issues = integer(data.open_issues_count);
  if ([stars, forks, issues].includes(null)) throw new Error('Missing statistics');
  return { stars, forks, issues };
}

// Extract public calendar data only. GitHub markup is never forwarded as HTML.
export function parseContributions(html) {
  const tooltips = new Map();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id = match[1].match(/\bfor="([^"]+)"/)?.[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const count = /^No contributions\b/.test(text) ? 0 : Number(text.match(/^([\d,]+) contributions?\b/)?.[1]?.replaceAll(',', ''));
    if (id && integer(count) !== null) tooltips.set(id, count);
  }
  const days = [];
  for (const match of html.matchAll(/<td\b[^>]*>/g)) {
    const date = match[0].match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const level = match[0].match(/\bdata-level="([0-4])"/)?.[1];
    const id = match[0].match(/\bid="([^"]+)"/)?.[1];
    if (date && level !== undefined && !Number.isNaN(Date.parse(date))) {
      days.push({ date, level: Number(level), count: tooltips.get(id) ?? null });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  const unique = [...new Map(days.map(day => [day.date, day])).values()];
  if (unique.length < 300 || unique.length > 371) throw new Error('Calendar unavailable');
  const heading = html.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/)?.[0]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const total = heading?.match(/([\d,]+) contributions in the last year/)?.[1];
  return {
    days: unique,
    total: total ? integer(Number(total.replaceAll(',', ''))) : null,
    activeDays: unique.filter(day => day.level > 0).length,
  };
}

export function createGithubLoader(fetcher = fetch, now = Date.now) {
  const cache = new Map();
  async function read(key) {
    const previous = cache.get(key);
    if (previous?.expires > now()) return previous.value;
    if (previous?.pending) return previous.pending;
    const pending = (async () => {
      try {
        const response = await fetcher(SOURCES[key], {
          headers: { 'User-Agent': 'sb4ss-portfolio', Accept: key === 'repository' ? 'application/vnd.github+json' : 'text/html' },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) throw new Error('GitHub unavailable');
        const data = key === 'repository' ? parseRepository(await response.json()) : parseContributions(await response.text());
        const value = { ...data, fetchedAt: new Date(now()).toISOString() };
        cache.set(key, { value, expires: now() + 15 * 60_000 });
        return value;
      } catch {
        // Retain an earlier snapshot during a temporary outage; never invent zeros.
        const value = previous?.value ?? null;
        cache.set(key, { value, expires: now() + 60_000 });
        return value;
      }
    })();
    cache.set(key, { ...previous, pending });
    return pending;
  }
  return async () => {
    const [repository, activity] = await Promise.all([read('repository'), read('activity')]);
    return { repository, activity };
  };
}
