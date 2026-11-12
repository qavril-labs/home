// More notes from building it. Each entry becomes its own page under blog/ with a date and author.
export const BLOG_MORE = [
  {
    slug: "why-one-ledger",
    title: "Why every module posts into one ledger",
    description: "A sale, a bill and a stock move should land in the same books at the same moment, not in three reports that someone reconciles later.",
    body: `      <p>The fastest way to lose trust in a system is to find two totals that disagree. That usually happens when each module keeps its own version of the truth and a report tries to stitch them together at month-end.</p>
      <p>We chose one ledger that every module posts into. A sale reduces stock and creates the receivable in the same step, so the stock report and the balance sheet can never tell different stories.</p>
      <p><strong>Try this now:</strong> pick one sale from last week and follow it through your stock count and your accounts. If you have to look in two places, that is the gap a single ledger closes.</p>`,
  },
  {
    slug: "exact-money",
    title: "Why we store money as whole minor units",
    description: "Floating-point numbers round small amounts in ways that show up as one-cent differences at the end of the month. We avoid them entirely.",
    body: `      <p>Money in a computer is easy to get wrong. A binary floating-point number cannot hold 0.10 exactly, so a long list of small amounts can drift by a cent or two, and nobody can say where it went.</p>
      <p>We store every amount as a whole number of the smallest unit, such as cents, and round only when a rate is applied, with the rounding rule written down. Totals then add up exactly, and a reversal removes exactly what was posted.</p>`,
  },
  {
    slug: "bots-need-approval",
    title: "Why our bots draft and never send on their own",
    description: "A bot that sends a payment reminder is useful. A bot that sends it to the wrong customer is a problem. Here is how we keep a person in the loop.",
    body: `      <p>The bots in the product do routine work: follow-ups, reminders, reorders and checks. What they do not do is change money, stock or a customer on their own.</p>
      <p>Each action is a draft in an approval queue, with the reason it was proposed. A person approves, edits or rejects it, and the decision is logged. You can switch any bot off at once, and the drafts it has already made stay for review.</p>`,
  },
  {
    slug: "reversals-not-edits",
    title: "Why we fix mistakes with reversals, not edits",
    description: "When an entry is wrong, we post a reversal and a correction. The original entry stays in the history, so the books always show what happened.",
    body: `      <p>In many systems a mistake is fixed by editing the old entry. That makes the history look as though the mistake never happened, which is exactly what an auditor will ask about.</p>
      <p>A reversal undoes the entry at its original amounts, and the correction is posted as a new entry. Both stay visible. It takes a few more clicks, and it means the books can always explain themselves.</p>`,
  },
];
