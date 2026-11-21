// Company pages for the capabilities QAVRIL LABS offers as services and teams. Each page states what the
// team delivers today and how work starts. Nothing here describes a self-service product. Services are
// engagements run by the studios; the 57 proposed services are listed on the services page as planned
// engagement types, not as separate pages.

export const EXPERT_PAGES = [
  {
    path: "expert-network.html",
    title: "QAVRIL Expert Network",
    description: "QAVRIL Expert Network connects AI teams with qualified domain experts for data generation, evaluation and model improvement.",
    kicker: "Expert Intelligence",
    h1: "Human expertise for AI development",
    lead: "The Expert Network is QAVRIL EXPERT INTELLIGENCE's managed service. AI teams commission qualified domain experts for data, evaluation and feedback. Experts contribute specialist work under confidentiality and quality review.",
    sections: [
      {
        h: "What AI teams can commission",
        items: [
          "Domain-specific data generation",
          "Expert annotation and labelling",
          "Model output evaluation and preference ranking",
          "AI agent task evaluation and red teaming",
          "Domain-specific benchmark creation",
          "Expert validation and quality review",
        ],
      },
      {
        h: "How a project runs",
        items: [
          "Scoping call to agree the domain, volume, quality bar and timeline",
          "Expert matching from the verified experts for that domain",
          "Secure workspace, confidentiality agreement and data-handling terms before work starts",
          "Two-stage quality review, with disagreements adjudicated by a senior reviewer",
          "Delivery with a provenance record for every item",
        ],
      },
      {
        h: "Start here",
        paras: [
          "Companies commission work through the company enquiry. Experts apply through the expert registration. The Expert Network launches as a managed enquiry and onboarding service, not a self-service marketplace.",
        ],
      },
    ],
    cta: [
      { label: "Commission expert work", href: "expert-network/for-companies.html", kind: "lime" },
      { label: "Register as an expert", href: "expert-network/for-experts.html", kind: "ghost" },
    ],
  },
  {
    path: "expert-network/for-companies.html",
    title: "Expert Network for AI companies",
    description: "Commission qualified domain experts for AI data, evaluation and model improvement, with confidentiality and quality review.",
    kicker: "Expert Network",
    h1: "Commission domain experts for your AI",
    lead: "For AI research labs, model developers, AI start-ups and enterprise AI teams that need specialist judgement on data and model outputs.",
    sections: [
      {
        h: "Governance",
        items: [
          "Confidentiality agreement signed before any project data is shared",
          "Data rights and intellectual property ownership agreed in writing",
          "Secure workspaces; sensitive or regulated data handled under agreed controls",
          "Conflict-of-interest checks before an expert is matched",
          "Quality management with double review and adjudication",
        ],
      },
      {
        h: "What we need from you to scope a project",
        items: [
          "The domain and the specific task",
          "The volume and the target delivery date",
          "The quality criteria, examples of good and poor output",
          "Any data rules: personal data, licences, regulated content",
        ],
      },
    ],
    cta: [{ label: "Send a project enquiry", href: "book.html?interest=partner", kind: "lime" }],
  },
  {
    path: "expert-network/for-experts.html",
    title: "Expert Network for experts",
    description: "Apply to contribute your domain expertise to AI data, evaluation and training projects, with verification and confidentiality.",
    kicker: "Expert Network",
    h1: "Contribute your expertise to AI",
    lead: "For qualified professionals who want to shape how AI systems are trained and evaluated in their field.",
    sections: [
      {
        h: "Who can apply",
        items: [
          "Practising professionals in a supported domain, such as medicine, law, finance, engineering, science, software, education, agriculture or manufacturing",
          "Relevant qualifications and experience, checked against the credentials you provide",
          "Confidentiality and conflict-of-interest declarations",
        ],
      },
      {
        h: "What the process looks like",
        items: [
          "Register your interest with your domain and credentials",
          "Verification of credentials, as appropriate to your jurisdiction",
          "Assessment task in your domain",
          "Project participation under quality standards and confidentiality terms",
        ],
      },
      {
        h: "Payment",
        paras: ["Payment is set out in the terms for each project and is made only under the approved operating terms."],
      },
    ],
    cta: [{ label: "Register your interest", href: "book.html?interest=partner", kind: "lime" }],
  },
];

export const STUDIO_PAGES = [
  { slug: "forge", name: "QAVRIL FORGE", role: "Enterprise software and product engineering", does: "Designs and builds enterprise software and SaaS platforms, from architecture through delivery and maintenance.", services: ["Enterprise Software Development", "Custom SaaS Platform Development", "Web and mobile application engineering"], divisions: ["Enterprise Platforms", "Technology Consulting & Innovation"] },
  { slug: "nexus", name: "QAVRIL NEXUS", role: "AI, LLMs and multi-agent systems", does: "Builds AI assistants, retrieval systems and multi-agent workflows, with evaluation and human approval designed in.", services: ["Generative AI and LLM Engineering", "AI Agent Development", "Enterprise Knowledge Systems and RAG"], divisions: ["AI & Intelligence"] },
  { slug: "quantum", name: "QAVRIL QUANTUM", role: "Advanced research and deep technology", does: "Runs research and proof-of-concept work on new methods, with results written up for decision-makers.", services: ["AI Strategy and Consulting", "Architecture and security reviews"], divisions: ["Technology Consulting & Innovation"] },
  { slug: "forma", name: "QAVRIL FORMA", role: "Product design and user experience", does: "Designs product flows, interfaces and design systems that are tested with real users before they are built.", services: ["UI/UX and Product Design", "Design Systems", "Product Prototyping"], divisions: ["Digital Experience & Immersive Tech"] },
  { slug: "immersa", name: "QAVRIL IMMERSA", role: "AR/VR, spatial computing and digital twins", does: "Builds immersive experiences, 3D product views and digital twins of sites and equipment.", services: ["AR/VR Experiences", "Digital Twins", "3D Product and Environment Experiences"], divisions: ["Digital Experience & Immersive Tech"] },
  { slug: "frame", name: "QAVRIL FRAME", role: "Media and creative technology", does: "Produces interactive media, explainers and creative technology for product and brand communication.", services: ["3D Product and Environment Experiences", "Digital Product Strategy"], divisions: ["Digital Experience & Immersive Tech"] },
  { slug: "pulse", name: "QAVRIL PULSE", role: "Growth, marketing and brand technology", does: "Builds the measurement, content and conversion systems that help a product find and keep customers.", services: ["Digital Product Strategy"], divisions: ["Technology Consulting & Innovation"] },
  { slug: "flow", name: "QAVRIL FLOW", role: "Automation and enterprise integration", does: "Automates business processes and connects enterprise systems with APIs, middleware and document processing.", services: ["Business Process Automation", "Enterprise System Integration", "API Integration and Middleware"], divisions: ["Automation & Integration"] },
  { slug: "prism", name: "QAVRIL PRISM", role: "Data engineering and decision intelligence", does: "Builds data pipelines, dashboards and forecasting that turn operational records into decisions.", services: ["Data Engineering", "Business Intelligence and Dashboards", "Predictive Forecasting"], divisions: ["Data & Decision Intelligence"] },
  { slug: "verity", name: "QAVRIL VERITY", role: "Quality engineering, reliability and AI evaluation", does: "Tests software and AI systems for correctness, reliability and safety, and runs evaluation programmes for models and agents.", services: ["AI Model Evaluation and Red Teaming", "Engineering and Quality Consulting"], divisions: ["Expert Intelligence", "Technology Consulting & Innovation"] },
  { slug: "ventures", name: "QAVRIL VENTURES", role: "Incubation and commercialisation", does: "Takes promising internal prototypes through validation and into a commercial product decision, with clear go and no-go criteria.", services: ["Product Discovery and Development Strategy"], divisions: ["Technology Consulting & Innovation"] },
];

export const SERVICE_PAGES = [
  { slug: "enterprise-software-development", name: "Enterprise Software Development", studio: "forge", summary: "Design and build of enterprise software to a written specification, delivered and maintained by the FORGE team.", delivers: ["Requirements and architecture", "Build with automated tests", "Deployment and handover", "Maintenance agreement"], uses: ["Back-office systems", "Internal portals", "Operational tools"] },
  { slug: "saas-platform-development", name: "Custom SaaS Platform Development", studio: "forge", summary: "Multi-tenant software-as-a-service platforms, with tenant isolation, billing hooks and an operations console.", delivers: ["Tenant isolation design", "Billing and subscription integration", "Operations and support console", "Release process and monitoring"], uses: ["Vertical SaaS products", "Partner platforms", "Internal multi-site systems"] },
  { slug: "generative-ai-llm-engineering", name: "Generative AI and LLM Engineering", studio: "nexus", summary: "Integration of large language models into business workflows, with prompt design, evaluation and cost control.", delivers: ["Use-case selection", "Model integration and prompt design", "Evaluation against agreed test sets", "Cost and latency monitoring"], uses: ["Drafting and summarising", "Classification and extraction", "Conversational assistants"] },
  { slug: "ai-agent-development", name: "AI Agent Development", studio: "nexus", summary: "Software agents that carry out multi-step tasks inside limits the customer sets, with every action logged and reviewable.", delivers: ["Task and tool design", "Permission and spending limits", "Approval steps for sensitive actions", "Audit log and kill switch"], uses: ["Routine follow-ups", "Reconciliation checks", "Document handling"] },
  { slug: "enterprise-knowledge-rag", name: "Enterprise Knowledge Systems and RAG", studio: "nexus", summary: "Search and question answering over a company's own documents, with sources shown for every answer.", delivers: ["Document ingestion and access rules", "Retrieval and ranking", "Answers with sources", "Quality checks on answers"], uses: ["Policy and procedure search", "Technical knowledge bases", "Contract and project records"] },
  { slug: "business-process-automation", name: "Business Process Automation", studio: "flow", summary: "Automation of repetitive business steps, with clear triggers, conditions and an approval where money or customers are affected.", delivers: ["Process mapping", "Automated steps and rules", "Approval points", "Run log and exception handling"], uses: ["Order to cash", "Procure to pay", "Month-end preparation"] },
  { slug: "enterprise-system-integration", name: "Enterprise System Integration", studio: "flow", summary: "Connection of existing systems so data moves once and is trusted in each place it lands.", delivers: ["Integration design", "Connectors and transformations", "Error handling and retries", "Monitoring of data flows"], uses: ["ERP to banking", "CRM to billing", "Warehouse to storefront"] },
  { slug: "api-integration-middleware", name: "API Integration and Middleware", studio: "flow", summary: "Secure APIs and the middleware that connects them, with versioning, authentication and rate limits.", delivers: ["API design and documentation", "Authentication and access control", "Versioning and rate limits", "Monitoring and alerts"], uses: ["Partner integrations", "Mobile backends", "Internal service connections"] },
  { slug: "data-engineering", name: "Data Engineering", studio: "prism", summary: "Reliable pipelines that collect, clean and store operational data for analysis and AI.", delivers: ["Pipeline design", "Data quality rules", "Storage and access controls", "Scheduling and monitoring"], uses: ["Sales and stock data", "Sensor and telemetry data", "Customer records"] },
  { slug: "business-intelligence-dashboards", name: "Business Intelligence and Dashboards", studio: "prism", summary: "Dashboards and reports built on agreed definitions, so every figure means the same thing to every reader.", delivers: ["KPI definitions agreed with owners", "Dashboards and scheduled reports", "Access by role", "Training for report owners"], uses: ["Sales performance", "Stock and margin", "Operations and delivery"] },
  { slug: "ui-ux-product-design", name: "UI/UX and Product Design", studio: "forma", summary: "Product design from research to tested prototypes and a design system the engineers can build from.", delivers: ["User research and task analysis", "Prototypes tested with users", "Design system and component library", "Accessibility review against WCAG 2.2 AA"], uses: ["New product flows", "Redesigns of existing tools", "Mobile and web experiences"] },
  { slug: "expert-ai-training-evaluation", name: "Expert-Powered AI Training and Evaluation", studio: "verity", summary: "Qualified domain experts create, label and evaluate data and model outputs for AI teams, under confidentiality and quality review.", delivers: ["Domain expert matching", "Annotation and labelling", "Two-stage quality review", "Provenance record for each item"], uses: ["Model evaluation", "Preference ranking", "Domain benchmark creation"] },
];

export const NEW_INDUSTRIES = [
  { slug: "apparel-fashion", name: "Apparel, Garments and Fashion", pains: "Styles and sizes tracked in spreadsheets, fabric and trim bought without a clear need, and orders that slip between sampling, cutting and dispatch.", first: "Purchasing and inventory first, with size-and-colour stock. Production and sampling workflows come later as an industry pack.", example: "A garment maker buys fabric for a season. Stock is held by size and colour, and a reorder is proposed when a best-selling size runs low." },
  { slug: "fmcg-consumer-goods", name: "FMCG and Consumer Goods", pains: "Distributors and retailers placing orders in several channels, stock held in many depots, and promotions whose cost is found only after the month closes.", first: "Sales, invoicing and inventory across depots first. Trade promotions and route sales come later as an industry pack.", example: "A distributor serves forty outlets from three depots. Each order reserves stock from the nearest depot, and the invoice shows any promotion applied." },
  { slug: "automotive-garage", name: "Automotive and Garage Operations", pains: "Job cards on paper, parts bought for one job and never billed, and customers who cannot see what was done to their vehicle.", first: "Job costing, parts inventory and invoicing first. Vehicle history and workshop scheduling come later as an industry pack.", example: "A workshop opens a job card for a service. Parts used are taken from stock and billed to the job, and the customer receives an itemised invoice." },
  { slug: "financial-services-insurance", name: "Financial Services and Insurance", pains: "Records split across systems, reconciliations done by hand each period, and reporting that takes days because data arrives in different formats.", first: "Ledger, reconciliation and reporting first. Product rules and regulated workflows are added only with qualified review and the relevant approvals.", example: "A small insurance agency reconciles premiums received against policies issued. Differences are listed for review, and the period report is produced from the same ledger." },
];
