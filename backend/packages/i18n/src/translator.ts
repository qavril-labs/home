/** Flat map from stable message key to text. Keys are identifiers, never English sentences. */
export type MessageCatalog = Readonly<Record<string, string>>;

const normalizeLocale = (locale: string): string => locale.trim().toLowerCase().replace(/_/g, "-");

/** "ar-sa" with default "en" gives ["ar-sa", "ar", "en"]. */
export function fallbackChain(locale: string, defaultLocale: string): string[] {
  const parts = normalizeLocale(locale).split("-");
  const chain: string[] = [];
  for (let length = parts.length; length > 0; length--) {
    chain.push(parts.slice(0, length).join("-"));
  }
  chain.push(normalizeLocale(defaultLocale));
  return [...new Set(chain)];
}

export class Translator {
  private readonly catalogs = new Map<string, MessageCatalog>();

  constructor(private readonly defaultLocale = "en") {}

  register(locale: string, messages: MessageCatalog): void {
    const key = normalizeLocale(locale);
    this.catalogs.set(key, { ...this.catalogs.get(key), ...messages });
  }

  /**
   * Looks up `key` through the locale's fallback chain. Unknown keys return the key itself,
   * so missing translations are visible rather than blank. Placeholders look like {name}.
   */
  t(key: string, params: Readonly<Record<string, string | number>> = {}, locale: string = this.defaultLocale): string {
    const template = this.lookup(key, locale) ?? key;
    return template.replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      Object.hasOwn(params, name) ? String(params[name]) : placeholder,
    );
  }

  private lookup(key: string, locale: string): string | undefined {
    for (const candidate of fallbackChain(locale, this.defaultLocale)) {
      const messages = this.catalogs.get(candidate);
      if (messages && Object.hasOwn(messages, key)) {
        return messages[key];
      }
    }
    return undefined;
  }
}
