# Testpad Peek for GitHub

A Chrome extension that detects [Testpad](https://testpad.com) **report links** in
GitHub comments and unwraps them inline — showing the tests that didn't pass right
in the comment, styled to look native to GitHub.

Report links look like:

```
https://ownerrez.testpad.com/script/46/report/T?auth=2815afda63fd46db86cb7c0f4c350ef8
```

## What it does

- Runs on `github.com` only.
- Finds any `*.testpad.com/.../report/...` link in a comment and, right below it,
  renders a GitHub-native `Box` with:
  - A header: report title + counts (`N failed`, `N blocked`, `N query`, `N tests`)
    and a **copy** button that puts just the non-passing tests on the clipboard
    as Markdown — ready to paste into an issue or PR.
  - One row per **non-passing** test (fail / blocked / query / anything not a
    clean pass), with its category, test name, and full notes — links, bold, and
    inline thumbnail previews included.
  - A collapsed **Show N passing tests** list, so passes stay out of the way.
- Passing tests are hidden by default (expand the list to see them).
- **Skipped** tests are omitted entirely — not rendered, and not counted. Testpad
  leaves them out of its own run totals, so the counts here match the report's.
  (A test that was simply never run still shows, as `—`.)

## How it works

- A **service worker** ([src/background.js](src/background.js)) fetches the report
  HTML. Content scripts on `github.com` can't fetch `testpad.com` cross-origin
  (CORS), but the worker can via the `https://*.testpad.com/*` host permission. Guest
  report links carry their own `auth=` token, so no login/cookies are needed.
- The **content script** ([src/content.js](src/content.js)) parses that HTML,
  extracts each test's status + notes, drops skipped tests, filters to non-passing, and renders
  them into GitHub's DOM using Primer classes (`Box`, `Label`, …) so it inherits
  GitHub's light/dark theme automatically.
- Testpad's own CSS is **not** injected — only the content is, rendered with
  GitHub's styles.

### The `auth` token

A guest report URL carries an `auth=…` token, and that same token also unlocks
the report's attachments — without it, `/uploaded/…` just redirects to a login
page. So the extension carries the token over onto every link it renders that
points back at the report's own origin (screenshot links, relative Testpad
links). Third-party links in the notes are left untouched, so the token is never
handed to another host.

The **copy** button uses this too: the Markdown it produces embeds screenshots as
`![…](…/uploaded/…?auth=…)`, so they render for anyone reading the pasted
comment, signed in to Testpad or not.

### Notes / limitations

- **Images:** GitHub's Content-Security-Policy blocks `testpad.com` images, so
  full-size images in notes are shown as a **🖼 image** link instead. Thumbnail
  previews that Testpad embeds as `data:` URIs *do* render inline (CSP allows
  `data:`). The copied Markdown has no such limit — it embeds the full-size
  images. Only the report's *own* attachments are embedded, though: an image
  pointing at some other host degrades to a **🖼 link**, so pasting a report
  never silently loads a third party's image into someone else's comment. A
  `data:` thumbnail with no link behind it is dropped, since there's nothing to
  point at.
- **Notes are copied as prose.** A note that starts a line with `1.` or `-` is a
  tester numbering their own steps, not Markdown, so those markers are escaped —
  otherwise GitHub renumbers the steps and swallows the following line into the
  list. Genuine lists in the notes still come through as lists.
- Notes markup is sanitized to a small tag whitelist; scripts, styles, and inline
  event handlers are dropped.
- Only report URLs (path contains `/report/`) are unwrapped — other Testpad links
  are left alone.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select this folder (`testpad-peek`).
4. Open any GitHub issue/PR/discussion comment containing a Testpad report link.

To pick up code changes, hit the **reload** icon on the extension card, then
refresh the GitHub tab.

## Files

```
manifest.json      MV3 manifest (content script + service worker + host perms)
src/background.js  Fetches report HTML for the content script
src/content.js     Detects links, extracts/filters tests, renders inline
icons/             Extension icon (Testpad logo) at 16/32/48/128px
```
