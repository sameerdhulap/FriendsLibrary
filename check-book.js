// check-book.js
// Checks availability of a book on friendslibrary.in and emails the status.
// Designed to run in GitHub Actions on a 12-hour cron, but works anywhere Node 18+ runs.
//
// Env vars required for email:
//   SMTP_USER  - Gmail address used to send (e.g. yourname@gmail.com)
//   SMTP_PASS  - Gmail App Password (NOT your normal password)
//   MAIL_TO    - recipient (samir.dhulap@gmail.com)
// Optional:
//   BOOK_URL         - defaults to the Rarang Dhang page
//   NOTIFY_ALWAYS    - "true" to email every run; default only emails when copies > 0

const nodemailer = require("nodemailer");

const BOOK_URL =
  process.env.BOOK_URL || "https://friendslibrary.in/book/2569/rarang-dhang";
const NOTIFY_ALWAYS = (process.env.NOTIFY_ALWAYS || "false") === "true";

async function fetchStatus() {
  const res = await fetch(BOOK_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (book-availability-watcher)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${BOOK_URL}`);
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

(async () => {
  const status = await fetchStatus();
  const line = `${status.title}: ${status.available} of ${status.total ?? "?"} copies available`;
  console.log(new Date().toISOString(), "-", line);

  if (status.available > 0) {
    await sendMail(
      `📗 AVAILABLE: ${status.title} (${status.available} cop${status.available > 1 ? "ies" : "y"})`,
      `${line}\n\nGrab it: ${BOOK_URL}`
    );
    console.log("Availability email sent.");
  } else if (NOTIFY_ALWAYS) {
    await sendMail(`Book watch: ${status.title} still unavailable`, `${line}\n\n${BOOK_URL}`);
    console.log("Status email sent (NOTIFY_ALWAYS).");
  } else {
    console.log("Not available — no email sent (set NOTIFY_ALWAYS=true to always email).");
  }
})().catch((err) => {
  console.error("Watcher failed:", err.message);
  process.exit(1);
});
