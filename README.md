# Book Availability Watcher

Checks one or more books on friendslibrary.in on a schedule and emails you when a
copy becomes available. The recipient is set by `MAIL_TO` in
[`.github/workflows/watch.yml`](.github/workflows/watch.yml).

The site has no public API, but availability ("Available Copies") is rendered
server-side in the page HTML, so the script just fetches and parses it.

## Watching multiple books

Set the `BOOK_URLS` repo **variable** (Settings → Secrets and variables → Actions
→ **Variables**) to a list of book page URLs, separated by **commas or newlines**
(you can mix them). One URL per line is the tidiest:

```
https://friendslibrary.in/book/2569/rarang-dhang
https://friendslibrary.in/book/55612/the-cruel-prince-part-1
https://friendslibrary.in/book/60761/dont-let-him-in-1
```

Every book is checked each run. You get a **single email** listing whichever books
are available (it notifies as soon as *any* watched book has a copy — it does not
wait for all of them). A single broken/renamed page is logged and skipped without
stopping the others. The run log shows each book's status, e.g.
`Rarang Dhang: 0 of 2 copies available (Not available)`.

The older single-book `BOOK_URL` variable still works as a fallback if `BOOK_URLS`
is unset.

## Setup (GitHub Actions — recommended, free, no machine needed)

1. Push these files to a GitHub repo
   (`check-book.js`, `package.json`, `package-lock.json`, `.github/workflows/watch.yml`).

2. Create a Gmail **App Password** (your normal password won't work):
   - Google Account → Security → 2-Step Verification must be ON
   - Then Security → App passwords → create one for "Mail"
   - You get a 16-character password

3. In the repo: Settings → Secrets and variables → Actions, add:
   - **Secrets** (New repository secret):
     - `SMTP_USER` = the Gmail address you're sending from
     - `SMTP_PASS` = the 16-char app password
   - **Variables** (New repository variable):
     - `BOOK_URLS` = your comma/newline-separated list of book URLs
     - `NOTIFY` = `true` to email on **every** run (optional; see below)

   The recipient (`MAIL_TO`) is set directly in the workflow file.

4. Go to the **Actions** tab → "Book availability watch" → **Run workflow**
   to test it manually. Check the run log — it prints each book's status.

By default it only emails when a book has copies available. Set the `NOTIFY` repo
variable to `true` to get a status email every run (the workflow passes it as
`NOTIFY_ALWAYS`).

Schedule: every 3 hours (`cron: "0 */3 * * *"`). Edit the cron in
[`.github/workflows/watch.yml`](.github/workflows/watch.yml) to change it. Note
GitHub may delay scheduled runs by a few minutes.

## Alternative: run on your Mac with launchd/cron

Requires Node 18+.

```bash
npm install
SMTP_USER=you@gmail.com SMTP_PASS=xxxx MAIL_TO=you@gmail.com \
  BOOK_URLS="url1,url2" node check-book.js
```

crontab entry (runs every 3 hours):
```
0 */3 * * * cd /path/to/book-watcher && SMTP_USER=... SMTP_PASS=... MAIL_TO=you@gmail.com BOOK_URLS="url1,url2" /usr/local/bin/node check-book.js >> watcher.log 2>&1
```

Downside: your Mac must be awake at those times — GitHub Actions avoids that.
