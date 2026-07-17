# Book Availability Watcher

Checks https://friendslibrary.in/book/2569/rarang-dhang every 12 hours and emails
samir.dhulap@gmail.com when a copy becomes available.

The site has no public API, but availability ("Available Copies") is rendered
server-side in the page HTML, so the script just fetches and parses it.

## Setup (GitHub Actions — recommended, free, no machine needed)

1. Create a new **private** GitHub repo and push these files
   (`check-book.js`, `package.json`, `package-lock.json`, `.github/workflows/watch.yml`).

2. Create a Gmail **App Password** (your normal password won't work):
   - Google Account → Security → 2-Step Verification must be ON
   - Then Security → App passwords → create one for "Mail"
   - You get a 16-character password

3. In the repo: Settings → Secrets and variables → Actions → New repository secret
   - `SMTP_USER` = the Gmail address you're sending from
   - `SMTP_PASS` = the 16-char app password

4. Go to the **Actions** tab → "Book availability watch" → **Run workflow**
   to test it manually. Check the run log — it prints the current status.

By default it only emails when Available Copies > 0. Uncomment
`NOTIFY_ALWAYS: "true"` in the workflow to get a status email every run.

Schedule: 03:30 and 15:30 UTC (≈ 9 AM / 9 PM IST). Edit the cron in
`.github/workflows/watch.yml` to change it. Note GitHub may delay scheduled
runs by a few minutes.

## Alternative: run on your Mac with launchd/cron

```bash
npm install
SMTP_USER=you@gmail.com SMTP_PASS=xxxx MAIL_TO=samir.dhulap@gmail.com node check-book.js
```

crontab entry (runs 9 AM and 9 PM local):
```
0 9,21 * * * cd /path/to/book-watcher && SMTP_USER=... SMTP_PASS=... MAIL_TO=samir.dhulap@gmail.com /usr/local/bin/node check-book.js >> watcher.log 2>&1
```

Downside: your Mac must be awake at those times — GitHub Actions avoids that.
