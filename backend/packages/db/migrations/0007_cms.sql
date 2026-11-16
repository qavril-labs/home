-- 0007_cms.sql: Dynamic CMS & Marketing Platform Content Engine

CREATE TABLE IF NOT EXISTS cms_settings (
  key VARCHAR(80) PRIMARY KEY,
  value TEXT NOT NULL,
  description VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_pages (
  slug VARCHAR(120) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  meta_description TEXT,
  kicker VARCHAR(100),
  hero_headline TEXT,
  hero_subhead TEXT,
  hero_badge VARCHAR(100),
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cms_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL UNIQUE,
  type VARCHAR(32) NOT NULL DEFAULT 'blog', -- 'blog' | 'case_study' | 'news'
  title VARCHAR(255) NOT NULL,
  excerpt TEXT,
  content_markdown TEXT NOT NULL,
  author VARCHAR(100) NOT NULL DEFAULT 'QAVRIL LABS Team',
  read_time VARCHAR(30) DEFAULT '5 min read',
  category_tag VARCHAR(60) NOT NULL DEFAULT 'General',
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_articles_type_pub ON cms_articles(type, is_published, published_at DESC);

CREATE TABLE IF NOT EXISTS cms_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(80) NOT NULL DEFAULT 'General',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_faqs_cat_order ON cms_faqs(category, sort_order ASC);

CREATE TABLE IF NOT EXISTS cms_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(120) NOT NULL,
  company VARCHAR(160) NOT NULL,
  role VARCHAR(100),
  quote TEXT NOT NULL,
  metric_highlight VARCHAR(100),
  avatar_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Initial Default Settings
INSERT INTO cms_settings (key, value, description) VALUES
  ('brand_name', 'QAVRIL LABS', 'Display name of the company brand'),
  ('tagline', 'BUILD. INTELLIGENCE. TRANSFORM.', 'Core tri-pillar tagline'),
  ('contact_email', 'connect@qavrillabs.com', 'Primary intake contact email'),
  ('announcement_active', 'true', 'Whether the global announcement ticker is enabled'),
  ('announcement_text', '11 Technology Studios · 7 Intelligence Products · Exact-to-the-Cent Ledger · 100% Tenant Isolation', 'Global top banner text')
ON CONFLICT (key) DO NOTHING;

-- Seed Initial Core Pages
INSERT INTO cms_pages (slug, title, meta_description, kicker, hero_headline, hero_subhead, hero_badge, is_published) VALUES
  ('home', 'QAVRIL LABS — Intelligent Enterprise Systems & AI Swarms', 'Global AI, Automation & Technology Company unifying Build, Intelligence and Transform across 11 specialist studios.', 'Unified Global Technology Company', 'Your business. Intelligent technology. Zero operational chaos.', 'We research, design, engineer and deploy intelligent enterprise systems, AI agent swarms and workflow automation for organisations worldwide.', 'v2.4 Platform Live', true),
  ('products', 'Proprietary Intelligence Suite | QAVRIL LABS', 'Core General Ledger, Sales Invoicing, Purchasing, Inventory, Payroll HR and Autonomous Agent Swarms.', 'Product Suite', 'Autonomous enterprise modules engineered for precision.', 'Immutable ledger posting, multi-currency engines, and human-in-the-loop autonomous bots.', '7 Modules', true),
  ('pricing', 'Transparent Pricing & Pilot Plans | QAVRIL LABS', 'Transparent plans for early-stage and enterprise deployments with exact-to-the-cent calculation.', 'Predictable Investment', 'Straightforward plans. No hidden implementation lock-in.', 'Choose from self-serve pilot sandboxes to turnkey enterprise deployments.', 'Free Pilots', true)
ON CONFLICT (slug) DO NOTHING;

-- Seed Initial FAQs
INSERT INTO cms_faqs (category, question, answer, sort_order) VALUES
  ('General', 'What makes QAVRIL LABS different from legacy ERPs?', 'Unlike monolithic legacy ERPs that take 18 months to deploy and rely on error-prone floating-point math, QAVRIL LABS is built on an exact-to-the-cent immutable double-entry ledger, strict PostgreSQL row-level tenancy, and autonomous AI agents with mandatory human token approval.', 1),
  ('Security', 'How is customer tenant data isolated?', 'Every tenant is strictly partitioned with PostgreSQL Row-Level Security (RLS) policies and cryptographic session claims. Zero cross-tenant data bleed occurs at the database or memory layers.', 2),
  ('AI Bots', 'Can autonomous bots alter financial ledgers without approval?', 'No. All autonomous bot actions operate with deterministic guardrails. Any action that alters balances or posts ledger journals requires a single-use cryptographically signed approval token from an authorized human operator.', 3)
ON CONFLICT DO NOTHING;
