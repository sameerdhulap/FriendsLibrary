// check-book.js
// Checks availability of one or more books on friendslibrary.in and emails the status.
// Designed to run in GitHub Actions on a cron, but works anywhere Node 18+ runs.
//
// Env vars required for email:
//   SMTP_USER  - Gmail address used to send (e.g. yourname@gmail.com)
//   SMTP_PASS  - Gmail App Password (NOT your normal password)
//   MAIL_TO    - recipient (samir.dhulap@gmail.com)
// Optional:
//   BOOK_URLS        - one or more book page URLs, separated by comma or newline.
//                      Takes precedence over BOOK_URL.
//   BOOK_URL         - single book URL (kept for backwards compatibility).
//   NOTIFY_ALWAYS    - "true" to email every run; default only emails when copies > 0

const nodemailer = require("nodemailer");

const DEFAULT_BOOK_URL = "https://friendslibrary.in/book/2569/rarang-dhang";
const NOTIFY_ALWAYS = (process.env.NOTIFY_ALWAYS || "false") === "true";

// Build the list of books to watch. BOOK_URLS (comma/newline separated) wins;
// otherwise fall back to the single BOOK_URL, otherwise the default.
function getBookUrls() {
  const raw = process.env.BOOK_URLS || process.env.BOOK_URL || DEFAULT_BOOK_URL;
  const urls = raw
    .split(/[\n,]+/)
    .map((u) => u.trim())
    .filter(Boolean);
  // De-duplicate while preserving order.
  return [...new Set(urls)];
}

async function fetchStatus(bookUrl) {
  const res = await fetch(bookUrl, {
    headers: { "User-Agent": "Mozilla/5.0 (book-availability-watcher)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${bookUrl}`);
  const html = await res.text();

  // The page renders e.g.:
  //   <li>Available Copies <span>0</span></li>  (markup may vary; match loosely)
  const availMatch = html.match(/Available\s*Copies[^0-9]*(\d+)/i);
  const totalMatch = html.match(/Total\s*Copies[^0-9]*(\d+)/i);
  const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

  if (!availMatch) {
    throw new Error(
      "Could not find 'Available Copies' on the page — layout may have changed."
    );
  }

  return {
    url: bookUrl,
    title: titleMatch ? titleMatch[1].trim() : "Unknown title",
    available: parseInt(availMatch[1], 10),
    total: totalMatch ? parseInt(totalMatch[1], 10) : null,
  };
}

async function sendMail(subject, body) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"Book Watcher" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO,
    subject,
    text: body,
  });
}

function formatLine(status) {
  return `${status.title}: ${status.available} of ${status.total ?? "?"} copies available`;
}

(async () => {
  const bookUrls = getBookUrls();
  console.log(`Checking ${bookUrls.length} book(s).`);

  // Check every book, capturing per-book failures so one bad page doesn't
  // stop the others from being checked.
  const results = await Promise.all(
    bookUrls.map(async (url) => {
      try {
        return { ok: true, status: await fetchStatus(url) };
      } catch (err) {
        return { ok: false, url, error: err.message };
      }
    })
  );

  const available = [];
  const unavailable = [];
  const failures = [];

  for (const result of results) {
    if (!result.ok) {
      failures.push(result);
      console.error(`Failed: ${result.url} — ${result.error}`);
      continue;
    }
    const line = formatLine(result.status);
    const status = result.status.available > 0 ? "Available" : "Not available";
    console.log(new Date().toISOString(), "-", `${line} (${status})`);
    if (result.status.available > 0) {
      available.push(result.status);
    } else {
      unavailable.push(result.status);
    }
  }

  if (available.length > 0) {
    const subject =
      available.length === 1
        ? `📗 AVAILABLE: ${available[0].title} (${available[0].available} cop${available[0].available > 1 ? "ies" : "y"})`
        : `📗 ${available.length} watched books are available`;
    const body = available
      .map((s) => `${formatLine(s)}\nGrab it: ${s.url}`)
      .join("\n\n");
    await sendMail(subject, body);
    console.log(`Availability email sent for ${available.length} book(s).`);
  } else if (NOTIFY_ALWAYS) {
    const body = unavailable.map((s) => `${formatLine(s)}\n${s.url}`).join("\n\n");
    await sendMail(
      `Book watch: none of ${unavailable.length} book(s) available`,
      body || "No books checked successfully."
    );
    console.log("Status email sent (NOTIFY_ALWAYS).");
  } else {
    console.log("Nothing available — no email sent (set NOTIFY_ALWAYS=true to always email).");
  }

  // Surface a non-zero exit only if every book failed to fetch, so a single
  // broken page doesn't mask otherwise-successful checks.
  if (failures.length === bookUrls.length) {
    throw new Error("All book checks failed.");
  }
})().catch((err) => {
  console.error("Watcher failed:", err.message);
  process.exit(1);
});
