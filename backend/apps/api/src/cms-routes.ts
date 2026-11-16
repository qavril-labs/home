import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Pool } from "@erp/db";

const PageBody = z.object({
  title: z.string().min(1).max(200),
  metaDescription: z.string().optional().default(""),
  kicker: z.string().optional().default(""),
  heroHeadline: z.string().optional().default(""),
  heroSubhead: z.string().optional().default(""),
  heroBadge: z.string().optional().default(""),
  contentJson: z.record(z.string(), z.any()).optional().default({}),
  isPublished: z.boolean().optional().default(true),
});

const ArticleBody = z.object({
  slug: z.string().min(1).max(160),
  type: z.enum(["blog", "case_study", "news"]).default("blog"),
  title: z.string().min(1).max(255),
  excerpt: z.string().optional().default(""),
  contentMarkdown: z.string().min(1),
  author: z.string().max(100).default("QAVRIL LABS Team"),
  readTime: z.string().max(30).default("5 min read"),
  categoryTag: z.string().max(60).default("General"),
  isFeatured: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

const FaqBody = z.object({
  category: z.string().min(1).max(80),
  question: z.string().min(1),
  answer: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export function registerCmsRoutes(app: FastifyInstance, pool: Pool, adminKey: string): void {
  // --- Admin Authentication Guard ---
  function requireAdmin(req: FastifyRequest, reply: FastifyReply, next: () => void) {
    const key = req.headers["x-admin-key"] || (req.headers.authorization || "").replace(/^Bearer\s+/, "");
    if (!key || key !== adminKey) {
      reply.status(401).send({ error: "Unauthorized: Invalid or missing admin authorization key" });
      return;
    }
    next();
  }

  // ==========================================
  // PUBLIC CMS ENDPOINTS (For Dynamic Website)
  // ==========================================

  // 1. Site Settings
  app.get("/v1/public/cms/settings", async (_req, reply) => {
    try {
      const res = await pool.query("SELECT key, value FROM cms_settings");
      const settings: Record<string, string> = {};
      for (const row of res.rows) {
        settings[row.key] = row.value;
      }
      return reply.send({ ok: true, settings });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 2. Pages
  app.get("/v1/public/cms/pages", async (_req, reply) => {
    try {
      const res = await pool.query(
        "SELECT slug, title, meta_description, kicker, hero_headline, hero_subhead, hero_badge, updated_at FROM cms_pages WHERE is_published = true ORDER BY slug ASC"
      );
      return reply.send({ ok: true, pages: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/v1/public/cms/pages/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      const res = await pool.query("SELECT * FROM cms_pages WHERE slug = $1 AND is_published = true", [slug]);
      if (res.rows.length === 0) {
        return reply.status(404).send({ error: "Page not found in CMS" });
      }
      return reply.send({ ok: true, page: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 3. Articles (Blogs / Case Studies)
  app.get("/v1/public/cms/articles", async (req, reply) => {
    const query = req.query as { type?: string; tag?: string; limit?: string };
    const type = query.type || "blog";
    const limit = Math.min(Number(query.limit) || 20, 100);
    try {
      let sql = "SELECT id, slug, type, title, excerpt, author, read_time, category_tag, is_featured, published_at FROM cms_articles WHERE is_published = true AND type = $1";
      const params: any[] = [type];
      if (query.tag) {
        sql += " AND category_tag = $2";
        params.push(query.tag);
      }
      sql += " ORDER BY is_featured DESC, published_at DESC LIMIT " + limit;
      const res = await pool.query(sql, params);
      return reply.send({ ok: true, articles: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.get("/v1/public/cms/articles/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    try {
      const res = await pool.query("SELECT * FROM cms_articles WHERE slug = $1 AND is_published = true", [slug]);
      if (res.rows.length === 0) {
        return reply.status(404).send({ error: "Article not found" });
      }
      return reply.send({ ok: true, article: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // 4. FAQs
  app.get("/v1/public/cms/faqs", async (_req, reply) => {
    try {
      const res = await pool.query("SELECT * FROM cms_faqs WHERE is_active = true ORDER BY category ASC, sort_order ASC");
      return reply.send({ ok: true, faqs: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // ==========================================
  // ADMIN CMS ENDPOINTS (For CMS Admin Panel)
  // ==========================================

  // Auth verify
  app.post("/v1/admin/cms/auth/verify", async (req, reply) => {
    const body = req.body as { key?: string };
    if (!body?.key || body.key !== adminKey) {
      return reply.status(401).send({ ok: false, error: "Invalid admin key" });
    }
    return reply.send({ ok: true, message: "Admin authenticated successfully" });
  });

  // Admin Overview Stats
  app.get("/v1/admin/cms/overview", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const pagesCount = (await pool.query("SELECT COUNT(*) FROM cms_pages")).rows[0].count;
      const articlesCount = (await pool.query("SELECT COUNT(*) FROM cms_articles")).rows[0].count;
      const faqsCount = (await pool.query("SELECT COUNT(*) FROM cms_faqs")).rows[0].count;
      const leadsCount = (await pool.query("SELECT COUNT(*) FROM leads")).rows[0].count;
      const recentLeads = (await pool.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 5")).rows;
      return reply.send({
        ok: true,
        stats: {
          totalPages: Number(pagesCount),
          totalArticles: Number(articlesCount),
          totalFaqs: Number(faqsCount),
          totalLeads: Number(leadsCount),
        },
        recentLeads,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Admin Settings Management
  app.get("/v1/admin/cms/settings", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const res = await pool.query("SELECT * FROM cms_settings ORDER BY key ASC");
      return reply.send({ ok: true, settings: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.put("/v1/admin/cms/settings", { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as { settings: Record<string, string> };
    if (!body?.settings) return reply.status(400).send({ error: "Missing settings object" });
    try {
      for (const [key, value] of Object.entries(body.settings)) {
        await pool.query(
          "INSERT INTO cms_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()",
          [key, String(value)]
        );
      }
      return reply.send({ ok: true, message: "Settings saved successfully" });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Admin Pages Management
  app.get("/v1/admin/cms/pages", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const res = await pool.query("SELECT * FROM cms_pages ORDER BY slug ASC");
      return reply.send({ ok: true, pages: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.put("/v1/admin/cms/pages/:slug", { preHandler: requireAdmin }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const parse = PageBody.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.issues });
    const b = parse.data;
    try {
      const res = await pool.query(
        `INSERT INTO cms_pages (slug, title, meta_description, kicker, hero_headline, hero_subhead, hero_badge, content_json, is_published, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (slug) DO UPDATE SET
           title = $2, meta_description = $3, kicker = $4, hero_headline = $5, hero_subhead = $6, hero_badge = $7, content_json = $8, is_published = $9, updated_at = NOW()
         RETURNING *`,
        [slug, b.title, b.metaDescription, b.kicker, b.heroHeadline, b.heroSubhead, b.heroBadge, JSON.stringify(b.contentJson), b.isPublished]
      );
      return reply.send({ ok: true, page: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Admin Articles Management
  app.get("/v1/admin/cms/articles", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const res = await pool.query("SELECT * FROM cms_articles ORDER BY created_at DESC");
      return reply.send({ ok: true, articles: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/v1/admin/cms/articles", { preHandler: requireAdmin }, async (req, reply) => {
    const parse = ArticleBody.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.issues });
    const b = parse.data;
    try {
      const res = await pool.query(
        `INSERT INTO cms_articles (slug, type, title, excerpt, content_markdown, author, read_time, category_tag, is_featured, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [b.slug, b.type, b.title, b.excerpt, b.contentMarkdown, b.author, b.readTime, b.categoryTag, b.isFeatured, b.isPublished]
      );
      return reply.status(201).send({ ok: true, article: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.put("/v1/admin/cms/articles/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parse = ArticleBody.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.issues });
    const b = parse.data;
    try {
      const res = await pool.query(
        `UPDATE cms_articles SET
           slug = $1, type = $2, title = $3, excerpt = $4, content_markdown = $5, author = $6, read_time = $7, category_tag = $8, is_featured = $9, is_published = $10, updated_at = NOW()
         WHERE id = $11 RETURNING *`,
        [b.slug, b.type, b.title, b.excerpt, b.contentMarkdown, b.author, b.readTime, b.categoryTag, b.isFeatured, b.isPublished, id]
      );
      if (res.rows.length === 0) return reply.status(404).send({ error: "Article not found" });
      return reply.send({ ok: true, article: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/v1/admin/cms/articles/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await pool.query("DELETE FROM cms_articles WHERE id = $1", [id]);
      return reply.send({ ok: true, message: "Article deleted" });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Admin FAQs Management
  app.get("/v1/admin/cms/faqs", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const res = await pool.query("SELECT * FROM cms_faqs ORDER BY category ASC, sort_order ASC");
      return reply.send({ ok: true, faqs: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.post("/v1/admin/cms/faqs", { preHandler: requireAdmin }, async (req, reply) => {
    const parse = FaqBody.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.issues });
    const b = parse.data;
    try {
      const res = await pool.query(
        "INSERT INTO cms_faqs (category, question, answer, sort_order, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [b.category, b.question, b.answer, b.sortOrder, b.isActive]
      );
      return reply.status(201).send({ ok: true, faq: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.put("/v1/admin/cms/faqs/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parse = FaqBody.safeParse(req.body);
    if (!parse.success) return reply.status(400).send({ error: parse.error.issues });
    const b = parse.data;
    try {
      const res = await pool.query(
        "UPDATE cms_faqs SET category = $1, question = $2, answer = $3, sort_order = $4, is_active = $5, updated_at = NOW() WHERE id = $6 RETURNING *",
        [b.category, b.question, b.answer, b.sortOrder, b.isActive, id]
      );
      if (res.rows.length === 0) return reply.status(404).send({ error: "FAQ not found" });
      return reply.send({ ok: true, faq: res.rows[0] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  app.delete("/v1/admin/cms/faqs/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await pool.query("DELETE FROM cms_faqs WHERE id = $1", [id]);
      return reply.send({ ok: true, message: "FAQ deleted" });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // Admin Leads Management
  app.get("/v1/admin/cms/leads", { preHandler: requireAdmin }, async (_req, reply) => {
    try {
      const res = await pool.query("SELECT * FROM leads ORDER BY created_at DESC LIMIT 100");
      return reply.send({ ok: true, leads: res.rows });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
