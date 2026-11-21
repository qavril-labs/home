import { DomainError } from "@erp/kernel";

/** An approved message template (PLT-10). Placeholders are written {{name}}. */
export interface EmailTemplate {
  key: string;
  subject: string;
  text: string;
  /** Optional HTML body. Values are HTML-escaped when substituted here. */
  html?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html?: string;
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fill(source: string, vars: Readonly<Record<string, string>>, escape: boolean): string {
  return source.replace(PLACEHOLDER, (_match, name: string) => {
    const value = vars[name];
    if (value === undefined) {
      throw new DomainError("VALIDATION", `Missing value for template placeholder: ${name}`);
    }
    return escape ? escapeHtml(value) : value;
  });
}

/**
 * Fills a template. Every placeholder needs a value: a missing one is an error, never a blank,
 * so a reminder cannot go out with a gap where an amount should be. Subject and text are plain;
 * HTML values are escaped. Header injection is refused by rejecting line breaks in the subject.
 */
export function renderTemplate(template: EmailTemplate, vars: Readonly<Record<string, string>>): RenderedEmail {
  const subject = fill(template.subject, vars, false);
  if (/[\r\n]/.test(subject)) {
    throw new DomainError("VALIDATION", "Subject must be a single line");
  }
  return {
    subject,
    text: fill(template.text, vars, false),
    ...(template.html === undefined ? {} : { html: fill(template.html, vars, true) }),
  };
}
