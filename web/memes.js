// Fetches batches of random memes and keeps a shuffled queue.
// Source 1: meme-api.com (random posts from a subreddit)
// Source 2: Reddit's public JSON, if meme-api is down
(function () {
  const IMAGE = /\.(jpe?g|png|gif|webp)(\?.*)?$/i;
  const SEEN_KEY = 'mr_seen';
  const DEAD_KEY = 'mr_dead_subs';

  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

  const seen = new Set(load(SEEN_KEY, []));
  const dead = new Set(load(DEAD_KEY, []));

  function remember(url) {
    seen.add(url);
    if (seen.size > 800) seen.delete(seen.values().next().value);
    store(SEEN_KEY, [...seen]);
  }

  function regionOf(sub) {
    const s = sub.toLowerCase();
    return window.REGIONS.find((r) => r.subs.some((x) => x.toLowerCase() === s)) || window.REGIONS[0];
  }

  /** Keeps only safe, still images we haven't shown before. */
  function usable(m) {
    return m && m.url && !m.nsfw && !m.spoiler && IMAGE.test(m.url) && !seen.has(m.url);
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function fromMemeApi(sub) {
    const text = await window.native.getText(`https://meme-api.com/gimme/${encodeURIComponent(sub)}/20`);
    const data = JSON.parse(text);
    if (!data.memes) throw new Error(data.message || 'no memes');
    return data.memes.map((m) => ({
      url: m.url, title: m.title, sub: m.subreddit, author: m.author, ups: m.ups,
      link: m.postLink, nsfw: m.nsfw, spoiler: m.spoiler,
    }));
  }

  async function fromReddit(sub) {
    const sort = ['hot', 'top.json?t=week&', 'top.json?t=month&'][Math.floor(Math.random() * 3)];
    const path = sort === 'hot' ? 'hot.json?' : sort;
    const text = await window.native.getText(`https://www.reddit.com/r/${encodeURIComponent(sub)}/${path}limit=60&raw_json=1`);
    const posts = JSON.parse(text).data.children.map((c) => c.data);
    return posts.map((p) => ({
      url: p.url_overridden_by_dest || p.url, title: p.title, sub: p.subreddit, author: p.author, ups: p.ups,
      link: 'https://www.reddit.com' + p.permalink, nsfw: p.over_18, spoiler: p.spoiler,
    }));
  }

  async function fetchSub(sub) {
    try {
      return await fromMemeApi(sub);
    } catch (e1) {
      try {
        return await fromReddit(sub);
      } catch (e2) {
        dead.add(sub);
        store(DEAD_KEY, [...dead]);
        return [];
      }
    }
  }

  const queue = [];
  let loading = null;
  let generation = 0; // bumps when the region changes, so old fetches are ignored

  /** Subreddits to draw from for the chosen region ('all' mixes everything). */
  function poolFor(regionId) {
    const regions = regionId === 'all' ? window.REGIONS : window.REGIONS.filter((r) => r.id === regionId);
    let subs = regions.flatMap((r) => r.subs).filter((s) => !dead.has(s));
    if (!subs.length) { // everything failed once: give them another chance
      dead.clear();
      store(DEAD_KEY, []);
      subs = regions.flatMap((r) => r.subs);
    }
    return subs;
  }

  async function refill(regionId) {
    const gen = generation;
    const subs = shuffle(poolFor(regionId)).slice(0, 3);
    const batches = await Promise.all(subs.map(fetchSub));
    if (gen !== generation) return 0;
    const fresh = [];
    const urls = new Set(queue.map((m) => m.url));
    for (const m of batches.flat()) {
      if (usable(m) && !urls.has(m.url)) {
        urls.add(m.url);
        const r = regionOf(m.sub);
        fresh.push({ ...m, flag: r.flag, region: r.name });
      }
    }
    queue.push(...shuffle(fresh));
    return fresh.length;
  }

  window.Memes = {
    regionOf,
    /** Next meme for the region. Fetches more as needed. */
    async next(regionId) {
      for (let tries = 0; queue.length < 4 && tries < 3; tries++) {
        if (!loading) loading = refill(regionId).finally(() => { loading = null; });
        const got = await loading;
        if (queue.length) break;
        if (!got && tries === 2) break;
      }
      const m = queue.shift();
      if (m) remember(m.url);
      if (queue.length < 6 && !loading) loading = refill(regionId).catch(() => 0).finally(() => { loading = null; });
      return m || null;
    },
    /** Drop queued memes when switching region. */
    reset() { queue.length = 0; generation++; loading = null; },
    peek(n) { return queue.slice(0, n); },
  };
})();
