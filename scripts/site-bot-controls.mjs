// What the customer controls for each bot: approvals, limits and the switch.
export const BOT_CONTROLS = {
  pip: ["Choose which customers and quotes the bot may follow up", "Set the days without a reply before a follow-up is drafted", "Approve each draft, edit it, or reject it"],
  "ledger-lou": ["Choose the bank accounts and periods the bot reads", "Set the tolerance for a matched difference", "Review the checklist before any period is closed"],
  "restock-rex": ["Set the reorder point and the supplier for each item", "Choose which shops the bot watches", "Approve every purchase order before it is sent"],
  "chase-chloe": ["Set the reminder days, for example 3, 14 and 30", "Choose the channel: email, SMS or a call task", "Pause reminders for any customer at once"],
  "forecast-finn": ["Set the cash floor that triggers a warning", "Choose which payments and payroll dates the forecast uses", "Change assumptions and see the new forecast"],
  "guard-gus": ["Set the discount and expense limits that trigger a flag", "Choose who reviews each flag", "Mark a flag reviewed, with the reviewer's name kept"],
  "ticket-tess": ["Choose the answers the bot may give from your knowledge base", "Set the topics that always go to a person", "Read every conversation in the customer record"],
  "onboard-ola": ["Choose the role and checklist for each new starter", "Approve each access change before it is made", "Set the date when a leaver's access ends"],
};
