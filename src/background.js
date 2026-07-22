// Service worker: fetches Testpad report HTML on behalf of the content script.
//
// Content scripts on github.com cannot fetch testpad.com cross-origin (CORS),
// but the service worker can because https://*.testpad.com/* is in
// host_permissions. Guest report links carry their own `auth=` token, so no
// cookies are required.

const CACHE = new Map();      // url -> { html, at }
const TTL_MS = 60 * 1000;     // report results can change — keep entries briefly
const MAX_ENTRIES = 50;       // bound memory (the SW is also killed when idle)

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fetchReport" && typeof msg.url === "string") {
    fetchReport(msg.url).then(sendResponse);
    return true; // keep the message channel open for the async response
  }
});

// Independently verify the URL rather than trusting the caller: HTTPS, and a
// host on testpad.com. The service worker holds the cross-origin fetch
// capability, so it enforces its own bounds.
function isAllowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)testpad\.com$/i.test(u.hostname);
  } catch (_) {
    return false;
  }
}

async function fetchReport(url) {
  if (!isAllowed(url)) {
    return { ok: false, error: "Refusing to fetch non-Testpad URL." };
  }

  const hit = CACHE.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return { ok: true, html: hit.html };
  }

  try {
    const resp = await fetch(url, { credentials: "omit", redirect: "follow" });
    if (!resp.ok) {
      return { ok: false, error: `Testpad returned HTTP ${resp.status}` };
    }
    const html = await resp.text();
    if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(url, { html, at: Date.now() });
    return { ok: true, html };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}
