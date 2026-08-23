# Wiring this up

Two pieces:

- **`stats_export.py`** — drop this next to your existing `app.py` /
  `database.py` / `indexer.py`. It reads `~/.gate_tracker/gate_tracker.db`
  and writes one JSON file with everything the website needs.
- **`site/`** — the website itself (`index.html`, `style.css`, `app.js`,
  `data/stats.json`). This is what goes in your `gate-track` repo.

## 1. First export

From your tracker app's folder:

```bash
python stats_export.py --out /path/to/gate-track/data/stats.json
```

(or just `python stats_export.py` if you copy `site/` next to it — the
default output path is `site/data/stats.json`.)

This overwrites the sample `data/stats.json` I included with your real
numbers. Re-run it any time you want the website to catch up to the
desktop app — there's no live connection between them, it's a snapshot.

## 2. Publish on GitHub Pages

Since `gate-track` is a dedicated repo for this, the simplest setup is
putting `index.html`, `style.css`, `app.js`, and `data/` **at the repo
root** (not inside a `site/` subfolder), then in **Settings → Pages**
set the source to your default branch, root folder. Then:

```bash
cd gate-track
cp -r /path/to/site/* .
git add .
git commit -m "Add stats dashboard"
git push
```

(If you'd rather keep the `site/` folder as-is, GitHub Pages can also
serve from a `/docs` folder — just rename `site/` to `docs/` and pick
that as the source instead.)

## 3. Keep it updated

Whenever you want the site to reflect new progress:

```bash
python stats_export.py --out /path/to/gate-track/data/stats.json
cd /path/to/gate-track
git add data/stats.json
git commit -m "Update stats"
git push
```

You mentioned wanting the desktop app to push this automatically — happy
to wire that up (e.g. a "Sync to website" button that runs the export
and does the git commit/push for you) whenever you want that as a next
step.

## 4. Set your own password

The site ships with a placeholder password gate. **Change it before you
publish** — replace `PASSWORD_HASH` in `app.js` with the hash of your
own password:

```bash
python3 -c "import hashlib; print(hashlib.sha256('yourpassword'.encode()).hexdigest())"
```

Paste the printed hash in place of the existing value in `app.js`.

**Important caveat:** this is a static site — anyone can view-source or
open dev tools and read `app.js`, so this gate only keeps out casual
visitors who stumble onto the URL. It is not real security. If your
notes/progress data is genuinely sensitive, the safer route is a
**private repo** with GitHub Pages access restricted to you (available
on paid plans), or just not sharing the URL.

## 5. Testing locally before you push

Opening `index.html` directly by double-clicking it may block the
password check (`crypto.subtle` needs a proper origin in some browsers).
Serve it locally instead:

```bash
cd site
python3 -m http.server 8000
```

then open `http://localhost:8000`.
