// Testpad Peek — runs on github.com only.
//
// Finds Testpad *report* links inside comments and unwraps them: the report is
// fetched, the failed tests are extracted, and they're rendered inline right
// after the link as a native GitHub "Box" — so it inherits GitHub's own styling
// instead of dragging Testpad's CSS onto the page.

(() => {
  "use strict";

  // Matches links like:
  //   https://ownerrez.testpad.com/script/46/report/T?auth=2815afda...
  // i.e. any *.testpad.com URL whose path contains "/report/". HTTPS only —
  // the report URL carries an auth token we don't want traversing cleartext.
  const REPORT_RE = /^https:\/\/[a-z0-9-]+\.testpad\.com\/.*\/report\//i;

  const PROCESSED = "data-testpad-peek"; // marks anchors we've already handled
  const inflight = new Map();            // url -> Promise<{ok, html|error}>
  const hosts = new WeakMap();           // anchor -> its injected peek box

  // Extension icon, inlined as a data: URI. GitHub's CSP blocks chrome-extension://
  // image URLs but allows data:, so this is the reliable way to show it in-page.
  const LOGO =
    "data:image/png;base64,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";

  // Tags we allow through from Testpad's notes into GitHub's DOM.
  const INLINE_TAGS = new Set([
    "A", "B", "STRONG", "I", "EM", "U", "S", "CODE", "PRE", "BR",
    "P", "DIV", "SPAN", "UL", "OL", "LI", "SMALL", "SUP", "SUB",
  ]);

  // ---- discovery -----------------------------------------------------------

  function scan(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("a[href*='.testpad.com/']").forEach((a) => {
      if (!REPORT_RE.test(a.href)) return;
      // Skip links inside a peek we rendered ourselves — notably the
      // "Open full report" link, which is itself a report URL and would
      // otherwise trigger an endless unwrap loop.
      if (a.closest(".testpad-peek")) return;
      if (a.hasAttribute(PROCESSED)) {
        // Already handled — unless a Turbo "morph" kept the anchor but removed
        // our injected box, in which case rebuild it.
        const existing = hosts.get(a);
        if (existing && existing.isConnected) return;
      }
      a.setAttribute(PROCESSED, "1");
      unwrap(a);
    });
  }

  // GitHub is a SPA: comments arrive via Turbo navigations and lazy loading.
  // Observe the DOM and, on the next frame, scan only the subtrees that changed
  // (cheaper than re-scanning the whole document on every mutation batch).
  const dirty = new Set();
  let pending = null;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) dirty.add(n); });
      // A Turbo "morph" can remove our injected box while keeping the marked
      // anchor; re-scan its container so the peek is rebuilt (see unwrap).
      m.removedNodes.forEach((n) => { if (n.nodeType === 1) dirty.add(m.target); });
    }
    if (pending || !dirty.size) return;
    pending = requestAnimationFrame(() => {
      pending = null;
      const roots = [...dirty];
      dirty.clear();
      roots.forEach((r) => { if (r.isConnected) scan(r); });
    });
  });

  scan(document);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // ---- unwrap one link -----------------------------------------------------

  function fetchReport(url) {
    if (!inflight.has(url)) {
      const p = new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({ type: "fetchReport", url }, (res) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              resolve(res || { ok: false, error: "No response from extension." });
            }
          });
        } catch (err) {
          // e.g. "Extension context invalidated" after a reload/update — this
          // throws synchronously rather than via lastError.
          resolve({ ok: false, error: err && err.message ? err.message : String(err) });
        }
      });
      // Cache successes only, so a transient failure can be retried later
      // (e.g. after a Turbo re-render re-triggers the scan).
      p.then((res) => { if (!res || !res.ok) inflight.delete(url); });
      inflight.set(url, p);
    }
    return inflight.get(url);
  }

  function unwrap(anchor) {
    const host = box();
    host.classList.add("testpad-peek");
    host.style.margin = "8px 0";
    host.appendChild(row("Loading Testpad report…", "color-fg-muted"));

    insertPeek(host, anchor);
    hosts.set(anchor, host);

    fetchReport(anchor.href)
      .then((res) => {
        if (!res.ok) {
          showError(host, anchor.href, "Testpad Peek: " + res.error);
          return;
        }
        try {
          render(host, res.html, anchor.href);
        } catch (err) {
          showError(host, anchor.href, "Could not parse report: " + err.message);
        }
      })
      .catch((err) => {
        showError(host, anchor.href, "Testpad Peek: " + (err && err.message ? err.message : String(err)));
      });
  }

  function showError(host, href, msg) {
    host.replaceChildren(header(href, null, null));
    host.appendChild(row(msg, "color-fg-danger"));
  }

  // Insert the peek after the link's block, hoisting out of any table/list so
  // we never inject a <div> between <td>s or as a direct child of <ul>/<ol>.
  function insertPeek(host, anchor) {
    const BLOCK = new Set(["P", "DIV", "BLOCKQUOTE", "PRE", "LI", "TD", "TH"]);
    let node = anchor;
    while (node.parentElement && !BLOCK.has(node.tagName)) {
      if (node.classList && node.classList.contains("comment-body")) break;
      node = node.parentElement;
    }
    const struct = node.closest ? node.closest("table, ul, ol, dl") : null;
    const ref = struct || node;
    if (ref.matches && ref.matches(".comment-body, .markdown-body")) {
      ref.appendChild(host); // stay inside the comment so GitHub styles apply
    } else if (ref.parentNode) {
      ref.parentNode.insertBefore(host, ref.nextSibling);
    } else {
      ref.appendChild(host);
    }
  }

  // ---- render --------------------------------------------------------------

  function render(host, html, href) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const origin = new URL(href).origin;

    const title =
      (doc.querySelector(".heading h1")?.textContent || "").trim() ||
      (doc.title || "").replace(/^TESTPAD REPORT\s*\|?\s*/i, "").trim() ||
      "Testpad report";

    const tests = extractTests(doc);
    // Surface everything that isn't a clean pass: fails, blocked, query, and
    // any other non-pass state. Ordered so fails come first.
    const passed = tests.filter((t) => t.status === "pass");
    const notPassed = tests
      .filter((t) => t.status !== "pass")
      .sort((a, b) => statusRank(a.status) - statusRank(b.status));

    const counts = {
      total: tests.length,
      fail: tests.filter((t) => t.status === "fail").length,
      blocked: tests.filter((t) => t.status === "blocked").length,
      query: tests.filter((t) => t.status === "query").length,
      other: tests.filter((t) => !["pass", "fail", "blocked", "query"].includes(t.status)).length,
    };

    host.replaceChildren(header(href, title, counts));

    if (!tests.length) {
      host.appendChild(row("No tests found in this report.", "color-fg-muted"));
      return;
    }

    if (!notPassed.length) {
      host.appendChild(row("✅ All " + passed.length + " tests passed.", "color-fg-muted"));
    }

    notPassed.forEach((t) => host.appendChild(issueRow(t, origin)));

    // A quiet, collapsed list of the passing tests (titles only).
    if (passed.length) {
      const details = document.createElement("details");
      details.className = "Box-row";
      const summary = document.createElement("summary");
      summary.className = "color-fg-muted";
      summary.style.cssText = "cursor:pointer;font-size:12px;";
      summary.textContent = `Show ${passed.length} passing test${passed.length === 1 ? "" : "s"}`;
      details.appendChild(summary);
      const ul = document.createElement("ul");
      ul.style.cssText = "margin:8px 0 0;padding-left:18px;font-size:13px;";
      passed.forEach((t) => {
        const li = document.createElement("li");
        li.className = "color-fg-muted";
        li.style.marginBottom = "2px";
        li.append(statusBadge(t.status), document.createTextNode(" " + titleText(t)));
        ul.appendChild(li);
      });
      details.appendChild(ul);
      host.appendChild(details);
    }
  }

  function header(href, title, counts) {
    const h = document.createElement("div");
    h.className = "Box-header d-flex flex-items-center";
    h.style.cssText = "gap:8px;flex-wrap:wrap;";

    const logo = document.createElement("img");
    logo.src = LOGO;
    logo.alt = "";
    logo.width = 16;
    logo.height = 16;
    logo.style.cssText = "flex:none;vertical-align:text-bottom;border-radius:3px;";
    h.appendChild(logo);

    const name = document.createElement("span");
    name.style.fontWeight = "600";
    name.textContent = title || "Testpad report";
    h.appendChild(name);

    if (counts) {
      if (counts.fail > 0) h.appendChild(label(counts.fail + " failed", "Label--danger"));
      if (counts.blocked > 0) h.appendChild(label(counts.blocked + " blocked", "Label--secondary"));
      if (counts.query > 0) h.appendChild(label(counts.query + " query", "Label--accent"));
      if (counts.other > 0) h.appendChild(label(counts.other + " other", "Label--secondary"));
      h.appendChild(label(counts.total + " test" + (counts.total === 1 ? "" : "s"), "color-fg-muted"));
    }

    const spacer = document.createElement("span");
    spacer.className = "flex-auto";
    h.appendChild(spacer);

    const open = document.createElement("a");
    open.textContent = "Open full report ↗";
    open.href = href;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.style.fontSize = "12px";
    h.appendChild(open);
    return h;
  }

  function issueRow(t, origin) {
    const r = document.createElement("div");
    r.className = "Box-row";

    const head = document.createElement("div");
    head.className = "d-flex flex-items-baseline";
    head.style.gap = "8px";
    head.appendChild(statusBadge(t.status));

    // Single line: bold "Category · Test", with the row number muted, in
    // parens, at the end.
    const title = document.createElement("div");
    const rest = document.createElement("span");
    rest.style.fontWeight = "600";
    rest.textContent = [t.category, t.leaf].filter(Boolean).join(" · ");
    title.appendChild(rest);
    if (t.num) {
      const num = document.createElement("span");
      num.className = "color-fg-muted";
      num.style.fontWeight = "400";
      num.textContent = " (" + t.num + ")";
      title.appendChild(num);
    }
    head.appendChild(title);
    r.appendChild(head);

    if (t.cell) {
      const notes = buildNotes(t.cell, origin);
      if (notes) r.appendChild(notes);
    }
    return r;
  }

  // Build the notes block: screenshots/thumbnails are pulled into their own
  // strip so the notes text starts on a clean new line below them, instead of
  // wrapping around the images with a ragged left edge.
  function buildNotes(cell, origin) {
    const scratch = document.createElement("div");
    sanitizeInto(scratch, cell, origin);

    // Collect media: inline thumbnails (kept in their wrapping link if any) and
    // the "🖼 image" placeholders/links for CSP-blocked images. Skip anything
    // already contained by a node we've picked, so nested markup isn't split.
    const media = [];
    const claim = (node) => {
      if (media.includes(node)) return;
      if (media.some((m) => m.contains(node))) return;
      media.push(node);
    };
    scratch.querySelectorAll("img").forEach((img) => claim(img.closest("a") || img));
    scratch.querySelectorAll("a, span").forEach((el) => {
      if (el.textContent === "🖼 image") claim(el);
    });

    const container = document.createElement("div");
    container.style.marginTop = "8px";

    if (media.length) {
      const strip = document.createElement("div");
      strip.style.cssText =
        "display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;margin-bottom:8px;";
      media.forEach((m) => strip.appendChild(m)); // moves each out of scratch
      container.appendChild(strip);
    }

    // Remaining text/markup, with any now-empty leading whitespace trimmed.
    const text = document.createElement("div");
    text.style.cssText = "font-size:13px;line-height:1.5;overflow-wrap:anywhere;";
    while (scratch.firstChild) text.appendChild(scratch.firstChild);
    while (text.firstChild && text.firstChild.nodeType === 3 && !text.firstChild.nodeValue.trim()) {
      text.removeChild(text.firstChild);
    }
    if (text.textContent.trim() || text.querySelector("a")) container.appendChild(text);

    return container.childNodes.length ? container : null;
  }

  // ---- extraction ----------------------------------------------------------

  // Testpad renders each test twice: a compact grid (tr.parent = category,
  // tr.leaf = the test, with a td.result per run) and, when comment detail is
  // on, a detail area pairing tr.cdcrumb (title, keyed by .rownum) with tr.notes
  // (the rich notes). The grid is the *complete* list; the detail area only
  // contains tests that have notes and repeats per run. So we drive the test
  // list from the grid and attach notes by row number — this keeps counts
  // correct and avoids per-run duplicates.
  function extractTests(doc) {
    const leaves = doc.querySelectorAll("tr.leaf");

    if (leaves.length) {
      // Map row number -> its notes cell (last write wins = most recent run).
      const notesByNum = new Map();
      doc.querySelectorAll("tr.notes").forEach((tr) => {
        const crumb = crumbOf(tr);
        const num = text(crumb && crumb.querySelector(".rownum"));
        if (num) notesByNum.set(num, tr.querySelector("td.notes"));
      });

      const tests = [];
      leaves.forEach((leaf) => {
        const num = text(leaf.querySelector("td.id"));
        let p = leaf.previousElementSibling;
        while (p && !p.classList.contains("parent")) p = p.previousElementSibling;
        tests.push({
          status: leafStatus(leaf),
          num,
          category: p ? text(p.querySelector("td.case")) : "",
          leaf: text(leaf.querySelector("td.case")),
          cell: num ? notesByNum.get(num) || null : null,
        });
      });
      return tests;
    }

    // Fallback: no grid (e.g. scripts not inlined) — derive from the detail
    // area, deduped by row number so repeated runs don't double-count.
    const byNum = new Map();
    doc.querySelectorAll("tr.notes").forEach((tr) => {
      const crumb = crumbOf(tr);
      if (!crumb) return; // stray notes row with no title — not a test
      const num = text(crumb.querySelector(".rownum"));
      byNum.set(num || byNum.size + 1, {
        status: statusOf(tr.querySelector("td.result")),
        num,
        category: text(crumb.querySelector("b")),
        leaf: text(crumb.querySelector(".leaf")),
        cell: tr.querySelector("td.notes"),
      });
    });
    return [...byNum.values()];
  }

  function crumbOf(notesRow) {
    const prev = notesRow.previousElementSibling;
    return prev && prev.classList.contains("cdcrumb") ? prev.querySelector(".crumb") : null;
  }

  // A leaf has one td.result per run; take the most recent run with a definitive
  // result (later run overrides earlier), falling back to "other" (e.g. not run).
  function leafStatus(leaf) {
    let status = "other";
    leaf.querySelectorAll("td.result").forEach((cell) => {
      const s = statusOf(cell);
      if (s !== "other") status = s;
    });
    return status;
  }

  function statusOf(resultCell) {
    if (!resultCell) return "other";
    const cl = resultCell.classList;
    if (cl.contains("fail")) return "fail";
    if (cl.contains("pass")) return "pass";
    if (cl.contains("blocked")) return "blocked";
    if (cl.contains("query")) return "query";
    return "other";
  }

  // ---- sanitizer -----------------------------------------------------------

  // Copy Testpad's notes markup into a fresh tree, keeping only whitelisted
  // tags/attributes. Every href is scheme-checked; images become plain links
  // (GitHub's CSP blocks testpad.com images anyway); scripts/styles and inline
  // event handlers are dropped. `inAnchor` prevents nesting a link inside a link.
  function sanitizeInto(target, source, origin, inAnchor, depth) {
    depth = depth || 0;
    if (depth > 50) {
      // Pathologically deep markup — bail to plain text rather than recurse.
      target.appendChild(document.createTextNode(source.textContent || ""));
      return;
    }
    source.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        target.appendChild(document.createTextNode(node.nodeValue));
        return;
      }
      if (node.nodeType !== 1) return;

      const tag = node.tagName;
      if (tag === "IMG") {
        const src = node.getAttribute("src") || "";
        // Testpad inlines thumbnail previews as data: URIs (allowed by GitHub's
        // CSP) — render those inline. Real testpad.com image URLs are CSP-blocked,
        // so those become a link, or a plain placeholder if already inside a link
        // (the wrapping <a> usually points at the full-size image).
        if (/^data:image\//i.test(src)) {
          target.appendChild(thumbImg(src, node.getAttribute("alt")));
        } else if (inAnchor) {
          target.appendChild(imagePlaceholder());
        } else {
          target.appendChild(imageLink(src, origin));
        }
        return;
      }
      if (tag === "SCRIPT" || tag === "STYLE") return;

      if (tag === "A") {
        const href = safeHref(node.getAttribute("href"), origin);
        if (href) {
          const a = document.createElement("a");
          a.href = href;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          sanitizeInto(a, node, origin, true, depth + 1);
          target.appendChild(a);
        } else {
          // Disallowed scheme (javascript:, data:text, …) — drop the link,
          // keep its text.
          sanitizeInto(target, node, origin, inAnchor, depth + 1);
        }
        return;
      }

      if (INLINE_TAGS.has(tag)) {
        const clean = document.createElement(tag.toLowerCase());
        sanitizeInto(clean, node, origin, inAnchor, depth + 1);
        target.appendChild(clean);
      } else {
        // Unknown wrapper: keep its contents, drop the element itself.
        sanitizeInto(target, node, origin, inAnchor, depth + 1);
      }
    });
  }

  // Returns a safe absolute URL, or "" if the scheme isn't allowed.
  function safeHref(raw, origin) {
    const href = absUrl(raw, origin);
    return /^(https?:|mailto:)/i.test(href) ? href : "";
  }

  function thumbImg(src, alt) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt || "";
    img.style.cssText =
      "max-height:120px;max-width:100%;border-radius:4px;vertical-align:middle;margin:2px;";
    return img;
  }

  function imagePlaceholder() {
    const s = document.createElement("span");
    s.textContent = "🖼 image";
    s.style.fontSize = "12px";
    return s;
  }

  function imageLink(src, origin) {
    const href = safeHref(src, origin);
    if (!href) return imagePlaceholder(); // unsafe src → non-clickable placeholder
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "🖼 image";
    a.style.fontSize = "12px";
    return a;
  }

  // ---- small UI helpers ----------------------------------------------------

  function box() {
    const d = document.createElement("div");
    d.className = "Box";
    return d;
  }

  function row(textContent, cls) {
    const r = document.createElement("div");
    r.className = "Box-row " + (cls || "");
    r.style.fontSize = "13px";
    r.textContent = textContent;
    return r;
  }

  function label(textContent, cls) {
    const s = document.createElement("span");
    s.className = "Label " + (cls || "");
    s.textContent = textContent;
    return s;
  }

  function statusBadge(status) {
    const map = {
      fail: ["FAIL", "Label--danger"],
      pass: ["PASS", "Label--success"],
      blocked: ["BLOCKED", "Label--secondary"],
      query: ["QUERY", "Label--accent"],
      other: ["—", "Label--secondary"],
    };
    const [txt, cls] = map[status] || map.other;
    const s = label(txt, cls);
    s.style.flex = "none";
    return s;
  }

  // Ordering for the surfaced (non-pass) rows: fails first, then blocked,
  // query, then anything else.
  function statusRank(status) {
    return { fail: 0, blocked: 1, query: 2 }[status] ?? 3;
  }

  function titleText(t) {
    const parts = [];
    if (t.category) parts.push(t.category);
    if (t.leaf) parts.push(t.leaf);
    return parts.join(" › ") + (t.num ? " (" + t.num + ")" : "");
  }

  function text(node) { return node ? node.textContent.trim() : ""; }

  function absUrl(raw, origin) {
    if (!raw) return "";
    try { return new URL(raw, origin).href; } catch (_) { return raw; }
  }
})();
