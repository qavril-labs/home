// Legal pages for the four launch regions: United States, Europe (including the UK), the Middle East and
// North Africa, and Asia. These are working drafts prepared for review by qualified counsel in each market.
// They are not legal advice and are not final until counsel signs off. Placeholders in square brackets must
// be filled in before launch: legal entity name, registered address, data protection contact, and the
// hosting region confirmed with the cloud provider.

export const CONTACT_EMAIL = "connect@qavrillabs.com";
export const LEGAL_ENTITY = "[Pending legal review: Legal entity name and registration number]";
export const LEGAL_ADDRESS = "[Pending corporate registration: Registered office address]";

export const LEGAL_PAGES = [
  {
    path: "privacy.html",
    title: "Privacy notice",
    description: "How QAVRIL LABS uses personal information, where it is kept, and your rights in the US, Europe, MENA and Asia.",
    kicker: "Privacy",
    h1: "Privacy notice",
    lead: "Working draft for legal review. This notice explains what personal information we collect, why, where it goes, and what rights you have wherever you live.",
    sections: [
      {
        h: "Who we are",
        paras: [
          `The data controller is ${LEGAL_ENTITY}, ${LEGAL_ADDRESS}. For privacy questions, email ${CONTACT_EMAIL}.`,
          "When a business uses our software, that business is usually the controller of its customers' and employees' records, and we act as its processor under a data processing agreement.",
        ],
      },
      {
        h: "What we collect",
        items: [
          "Request details you send through our forms: name, work email, company, country, the modules you are interested in, a preferred demo slot, your time zone, and any message you write",
          "The time you gave consent, and the version of this notice you consented to",
          "Technical details such as the page you came from, through a campaign link if you used one, and the browser type, used to keep the site secure and to measure which pages help people",
          "Business records that customers store in the software, such as invoices, customer lists and payroll details. We process these only to provide the service",
        ],
      },
      {
        h: "Why we use it, and the legal basis",
        items: [
          "To answer your request and arrange a demo or quote: performance of a request you made, or steps before a contract",
          "To keep the site secure and stop abuse: our legitimate interest in running a safe service",
          "To send product updates: your consent, which you can withdraw at any time",
          "To provide the software to a business: the contract between that business and us, under its instructions",
        ],
      },
      {
        h: "Consent",
        paras: [
          "Where we rely on consent, we ask you to tick a box that is not pre-ticked. We store the time of consent with your request. You can withdraw consent at any time by emailing us, and withdrawal does not affect what was done before.",
        ],
      },
      {
        h: "Who we share it with",
        items: [
          "Our hosting and cloud providers, which store the data on our behalf under contracts that limit its use",
          "Email and messaging providers that send our replies",
          "Payment providers, only when you pay for a plan",
          "Authorities, when the law requires it. We do not sell personal information, and we do not share it for advertising",
        ],
      },
      {
        h: "Where data is stored and moved",
        paras: [
          "Hosting regions are confirmed in your written terms. Where personal information moves between regions, for example from Europe to a processor in the United States, we rely on the transfer mechanisms that the law in that region recognises, such as standard contractual clauses or the UK addendum, and a transfer impact assessment.",
        ],
      },
      {
        h: "How long we keep it",
        paras: [
          "Request details are kept for 24 months after the last contact, then deleted, unless a longer period is needed to meet a legal duty. Business records in the software are kept for the period the customer chooses within the limits of the law in its country.",
        ],
      },
      {
        h: "Your rights",
        paras: [
          "Depending on where you live, you may ask to see, correct, export, delete or restrict the use of your information, and object to some uses. Under the GDPR and UK GDPR you can also complain to your supervisory authority. In California and other US states with privacy laws, you may ask us to disclose what we hold and to delete it, and you can opt out of any sale or sharing, which we do not do. Under the laws of the Middle East and North Africa and Asia, the rights are similar and are listed in the regional section below.",
          `Send requests to ${CONTACT_EMAIL}. We verify your identity before we act, and we reply within the time the law in your region sets, usually one month.`,
        ],
      },
      {
        h: "Regional notes",
        items: [
          "United States: the California Consumer Privacy Act as amended by the CPRA, and other state privacy laws. We do not sell or share personal information for cross-context behavioural advertising.",
          "European Economic Area and UK: the GDPR and UK GDPR. You have the rights listed above and the right to lodge a complaint with your supervisory authority.",
          "Middle East and North Africa: where applicable, the UAE Federal Decree-Law 45 of 2021, the Saudi Personal Data Protection Law, and comparable laws in other countries. Personal data is handled under the same rights as above.",
          "Asia: where applicable, Singapore's Personal Data Protection Act, Japan's Act on the Protection of Personal Information, India's Digital Personal Data Protection Act 2023, and comparable laws. Personal data is handled under the same rights as above.",
        ],
      },
      {
        h: "Children",
        paras: ["Our services are for businesses. We do not knowingly collect personal information from anyone under 16, and we delete it if we learn we have."],
      },
      {
        h: "Security",
        paras: [
          "Access to personal information is limited to people who need it. Records are kept separate for each business, changes are logged, and data is encrypted in transit. We will tell affected people and the regulator when the law requires it after a breach.",
        ],
      },
      {
        h: "Changes to this notice",
        paras: ["When we change this notice, we post the new version here and show the date of the change at the top. Where a change is material, we tell you by email first."],
      },
    ],
  },
  {
    path: "terms.html",
    title: "Terms of use",
    description: "Terms for using QAVRIL LABS: subscriptions, setup fees, acceptable use, your data and liability.",
    kicker: "Terms",
    h1: "Terms of use",
    lead: "Working draft for legal review. These terms apply to the website and to the software. Your signed order form or quote adds to them and wins where it says something different.",
    sections: [
      {
        h: "Who we are and what these terms cover",
        paras: [
          `These terms are between you (the business you act for) and ${LEGAL_ENTITY}, ${LEGAL_ADDRESS}. They cover the website and the cloud software, including the modules, AI bots and support.`,
        ],
      },
      {
        h: "Plans, prices and setup",
        items: [
          "Plans are a monthly subscription, billed monthly, or annually with two months free",
          "The setup fee is a one-time charge for moving your records and training your team. It is confirmed in writing on your quote",
          "Prices are in US dollars unless your quote shows another currency. Taxes that apply in your country are added on the invoice",
          "We may change plan prices with at least 30 days' written notice. The change applies from your next renewal",
        ],
      },
      {
        h: "Free plan",
        paras: ["The free plan is provided as is, within its published limits. We may change or withdraw the free plan with 30 days' notice."],
      },
      {
        h: "Modules and availability",
        paras: [
          "Each module is set up for your business during onboarding, and your order form lists the modules you have chosen. We describe each module on its own page. Where a module, feature or integration is not yet available for your account, we tell you in writing before you pay for it, and you are not charged for it until it is available.",
        ],
      },
      {
        h: "AI bots and automation",
        paras: [
          "AI bots draft, flag and propose actions. A person must approve any action that changes money, stock or a customer, unless you have set an approval limit yourself. You are responsible for the decisions you make on the basis of bot output, and for checking it against your records.",
        ],
      },
      {
        h: "Your data",
        paras: [
          "You keep ownership of the records you enter. You give us the rights we need to store and process them to provide the service. We process them under our data processing agreement, which forms part of these terms.",
          "You can export your data at any time, in the formats the software provides. When your subscription ends, we keep your data for 30 days so you can export it, and then delete it, except where the law requires us to keep it longer.",
        ],
      },
      {
        h: "Acceptable use",
        items: [
          "Use the software only for your own business records and lawful purposes",
          "Do not try to access another customer's data, test our security without written permission, or interfere with the service",
          "Do not use the software to send spam or to breach sanctions or export controls",
          "Keep your log-in details secret. You are responsible for activity under your accounts",
        ],
      },
      {
        h: "Service levels",
        paras: [
          "Uptime targets, support hours, response times and any service credits are set out in your order form. Where none is stated, we use reasonable efforts to keep the service available and to respond to support requests on business days.",
        ],
      },
      {
        h: "Cancellation and refunds",
        paras: [
          "You may cancel a monthly subscription at any time, effective at the end of the paid period. Annual subscriptions and setup fees are refundable only where your order form says so, or where the law in your country requires a refund.",
        ],
      },
      {
        h: "Warranties and liability",
        paras: [
          "We provide the service with reasonable care and skill. To the extent the law allows, we do not guarantee that the software is free of errors or will meet every need. Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for any liability that cannot be limited by law.",
          "Our total liability for claims relating to the service is limited to the fees you paid in the 12 months before the claim. Neither party is liable for indirect or consequential loss, lost profit or lost data beyond the cost of restoring it from backup, except where the law does not allow this limit.",
        ],
      },
      {
        h: "Consumer rights",
        paras: [
          "If you are a consumer in the European Union, the United Kingdom, or another country that gives consumers statutory rights, those rights apply in addition to these terms. These terms are written for business customers.",
        ],
      },
      {
        h: "Governing law and disputes",
        paras: [
          `These terms are governed by the laws of [Pending legal counsel review: governing law to be determined for contracting entity upon incorporation]. Disputes are resolved in the courts of [Pending legal counsel review: venue to be confirmed prior to commercial launch], unless your order form sets out an arbitration clause.`,
        ],
      },
      {
        h: "Changes to these terms",
        paras: ["We will give at least 30 days' notice of material changes by email, and the new terms apply from the date they take effect."],
      },
      {
        h: "Contact",
        paras: [`Questions about these terms: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  {
    path: "cookies.html",
    title: "Cookie notice",
    description: "The cookies and browser storage QAVRIL LABS uses on its website, why, and how to control them. Working draft for legal review.",
    kicker: "Cookies",
    h1: "Cookie notice",
    lead: "Working draft for legal review. This website uses very few cookies, and none for advertising.",
    sections: [
      {
        h: "What we set",
        items: [
          "A theme preference, stored on your device, so the site opens in the light or dark theme you chose. It is not sent to us",
          "A font service that loads the page typography from Google Fonts, which may set its own technical data as the font loads",
          "No advertising, tracking, cross-site or analytics cookies are set by this website",
        ],
      },
      {
        h: "Consent",
        paras: [
          "The theme preference is stored only if you choose a theme. Where a future feature needs a non-essential cookie, we will ask for consent first, in the region where the law requires it, and you can change your choice at any time.",
        ],
      },
      {
        h: "Control",
        paras: ["Your browser settings control cookies and local storage. Blocking them does not stop the site from working, and the booking form does not need any cookie."],
      },
    ],
  },
  {
    path: "accessibility.html",
    title: "Accessibility statement",
    description: "How QAVRIL LABS website is built to be usable with a keyboard, a screen reader, a phone and reduced motion, and how to report a problem. Working draft.",
    kicker: "Accessibility",
    h1: "Accessibility statement",
    lead: "We aim to meet WCAG 2.2 level AA for this website. This statement is a draft until an independent audit has checked it.",
    sections: [
      {
        h: "What we do",
        items: [
          "Every form field has a visible label, and errors are written next to the field and announced to screen readers",
          "Motion is reduced for visitors who ask for it, and the 3D scene is replaced by a still layout",
          "Pages work at phone width, can be zoomed, and can be used with a keyboard alone",
          "Colour contrast is checked in both the light and dark themes",
        ],
      },
      {
        h: "Known limits",
        paras: ["The software's own screens are still being audited against the same standard. We will publish the results before the software is generally available."],
      },
      {
        h: "Report a problem",
        paras: [`If something is hard to use, email ${CONTACT_EMAIL} and tell us the page and what happened. We aim to reply within two business days.`],
      },
    ],
  },
];
