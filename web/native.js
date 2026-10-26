// One small interface over whatever app the page is running in:
//   Android  → window.AndroidBridge (Java, see MainActivity.java)
//   Windows  → window.memeBridge   (Electron, see desktop/preload.js)
//   Browser  → plain fetch / links (for testing)
// Every method returns a Promise.
(function () {
  const pending = {};
  let nextId = 1;

  // Android calls this when a background job finishes
  window.__nativeResolve = (id, ok, value) => {
    const p = pending[id];
    if (!p) return;
    delete pending[id];
    ok ? p.resolve(value) : p.reject(new Error(value));
  };

  function androidCall(method, ...args) {
    return new Promise((resolve, reject) => {
      const id = String(nextId++);
      pending[id] = { resolve, reject };
      window.AndroidBridge[method](id, ...args);
    });
  }

  let impl;
  if (window.AndroidBridge) {
    impl = {
      platform: 'android',
      getText: (url) => androidCall('getText', url),
      save: (url, name) => androidCall('save', url, name),
      share: (url, title) => { window.AndroidBridge.share(url, title); return Promise.resolve(); },
      openFolder: () => Promise.resolve(),
      openLink: (url) => { window.AndroidBridge.openLink(url); return Promise.resolve(); },
    };
  } else if (window.memeBridge) {
    // Electron prefixes errors with "Error invoking remote method…"; keep just the reason
    const clean = (fn) => (...a) => fn(...a).catch((e) => {
      throw new Error(String(e.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    });
    impl = { platform: 'windows' };
    for (const [k, fn] of Object.entries(window.memeBridge)) impl[k] = clean(fn);
  } else {
    impl = {
      platform: 'browser',
      getText: async (url) => (await fetch(url)).text(),
      save: async (url, name) => {
        const a = document.createElement('a');
        a.href = url; a.download = name; a.target = '_blank'; a.click();
        return 'your Downloads';
      },
      share: async (url, title) => { if (navigator.share) await navigator.share({ url, title }); },
      openFolder: async () => {},
      openLink: async (url) => { window.open(url, '_blank'); },
    };
  }
  window.native = impl;
})();
