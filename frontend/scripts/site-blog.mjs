import { BLOG_MORE } from "./site-blog-more.mjs";
// Blog posts. Each becomes its own page under blog/ with its own URL, dates and structured data.
// Bodies are trusted HTML written in this repository; keep links relative to the blog folder's parent.

const BLOG_BASE = [
  {
    slug: "month-end",
    title: "Month-end should take an afternoon, not a weekend",
    description: "Most month-ends are slow for one reason: the same numbers get typed in more than once.",
    body: "      <p>Most month-ends are slow for one reason: the same numbers get typed in more than once. Sales sit in one place, stock in another, and payments in a bank app. Someone spends the weekend matching them.</p>\n      <p>A system that records each sale once, and updates stock and the books at the same time, removes most of that work. Your accountant then reviews the result instead of rebuilding it.</p>\n      <p><strong>Try this now:</strong> list the three reports you open at every month-end, and note which numbers you retype from one to another. That list is the work to remove first.</p>"
  },
  {
    slug: "invoice-numbers",
    title: "Why your invoice numbers should never skip",
    description: "Tax authorities, auditors and customers all expect invoice numbers to run in order.",
    body: "      <p>Tax authorities, auditors and customers all expect invoice numbers to run in order. A gap invites questions, even when the cause was an invoice that was never finished.</p>\n      <p>Good software gives a number only when a document is actually saved, so an abandoned draft leaves no hole. Ask any system you evaluate how it numbers documents, and how it shows that none were skipped.</p>"
  },
  {
    slug: "seven-questions",
    title: "Seven questions to ask before you choose an ERP",
    description: "Can we start with the modules we need today and add others later? Growth should not mean a new system.",
    body: "      <ol>\n      <li><strong>Can we start with the modules we need today and add others later?</strong> Growth should not mean a new system.</li>\n      <li><strong>Does it handle the currencies and tax rules we use?</strong> Ask for an example from your own country.</li>\n      <li><strong>Who can see what?</strong> Check that each person sees only the records their role allows.</li>\n      <li><strong>What happens when the internet drops?</strong> Ask whether the till and stock screens keep working offline.</li>\n      <li><strong>Can we get our data out?</strong> Ask how exports work before you sign.</li>\n      <li><strong>Who helps us go live?</strong> Ask what onboarding includes and who does the work.</li>\n      <li><strong>What is the full cost?</strong> Ask about setup, training and each module, not only the monthly fee.</li>\n      </ol>"
  },
  {
    slug: "first-demo",
    title: "What to expect from your first demo",
    description: "A good demo lasts 20 minutes and is about your business, not a tour of every screen.",
    body: "      <p>A good demo lasts 20 minutes and is about your business, not a tour of every screen. Bring one real task: a sale, a month-end report, or a stock count.</p>\n      <p>Tell us your industry and your biggest headache. We show how that task would run, and we answer every question straight.</p>\n      <p class=\"cta-row\"><a class=\"btn btn-lime\" href=\"book.html?interest=demo\" data-modal=\"demo\">Book a demo slot</a> <a class=\"btn btn-ghost\" href=\"book.html?interest=trial\" data-modal=\"trial\">Request a free trial</a></p>"
  },
  {
    slug: "stock-counts",
    title: "Stock counts that people actually trust",
    description: "A stock count that everyone distrusts is worse than none, because people start guessing.",
    body: "      <p>A stock count that everyone distrusts is worse than none, because people start guessing. Counts go wrong for predictable reasons: goods leave without being recorded, a delivery is put away in the wrong place, or a count is typed in twice.</p>\n      <p>Count one shelf at a time, record the count against the system's figure, and investigate only the differences. Small, regular counts beat one huge annual count, and they show you where the losses happen.</p>\n      <p><strong>Try this now:</strong> pick your three fastest-moving items and count them every Monday for a month. The pattern will show you where the trouble is.</p>"
  },
  {
    slug: "paying-suppliers",
    title: "Pay suppliers on time without paying twice",
    description: "Paying a bill twice, or paying for goods you never received, usually happens when the bill, the order and the delivery note live in three places.",
    body: "      <p>Paying a bill twice, or paying for goods you never received, usually happens when the bill, the order and the delivery note live in three places. The fix is to check the three against each other before anything is paid.</p>\n      <p>Agree a simple rule with your team: no bill is paid until someone has confirmed the goods or services arrived. Then pay in a fixed weekly run, so suppliers know when to expect the money and you know exactly what has gone out.</p>"
  },
  {
    slug: "bots-and-you",
    title: "How AI bots can take over the routine, safely",
    description: "Most of the work in a small business is repetitive: a reminder for a late invoice, a reorder for a fast seller, a check that a bill has not been paid twice",
    body: "      <p>Most of the work in a small business is repetitive: a reminder for a late invoice, a reorder for a fast seller, a check that a bill has not been paid twice. A bot can do that work, but only if it is clear what it may do.</p>\n      <p>The rule we suggest is simple. A bot drafts and flags, a person approves anything that moves money, stock or a customer, and every action is written down. Start with one bot and one task, and widen its role only once the drafts are reliably good.</p>"
  },
  {
    slug: "first-month-online",
    title: "Your first month on a new system",
    description: "The first month decides whether a new system sticks, so plan it before you switch off the old one.",
    body: "      <p>The first month decides whether a new system sticks. Keep the old system running in parallel for two weeks, so you can compare the numbers before you switch off anything.</p>\n      <p>Pick one team member as the owner of the change, and agree which reports you will check each week. Most problems show up in the first month-end, so plan for it, rather than being surprised by it.</p>"
  }
];

export const BLOG_POSTS = [...BLOG_BASE, ...BLOG_MORE];
