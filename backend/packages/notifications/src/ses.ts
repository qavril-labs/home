import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import type { EmailProvider } from "./deliver";

export interface SesConfig {
  /** A sender address or domain verified in SES. */
  from: string;
  region: string;
  /** Optional SES configuration set, for bounce and complaint tracking. */
  configurationSet?: string;
  /** Override for tests. Credentials come from the standard AWS provider chain. */
  client?: Pick<SESv2Client, "send">;
}

export function loadSesConfig(env: NodeJS.ProcessEnv): SesConfig | null {
  const from = env.SES_FROM_ADDRESS;
  if (!from) return null;
  return {
    from,
    region: env.AWS_REGION ?? env.SES_REGION ?? "us-east-1",
    ...(env.SES_CONFIGURATION_SET ? { configurationSet: env.SES_CONFIGURATION_SET } : {}),
  };
}

/** Amazon SES (v2) email delivery for PLT-10. */
export class SesEmailProvider implements EmailProvider {
  private readonly client: Pick<SESv2Client, "send">;

  constructor(private readonly config: SesConfig) {
    this.client = config.client ?? new SESv2Client({ region: config.region });
  }

  async send(message: { to: string; email: { subject: string; text: string; html?: string } }): Promise<{ messageId: string }> {
    const { email } = message;
    const result = await this.client.send(
      new SendEmailCommand({
        FromEmailAddress: this.config.from,
        Destination: { ToAddresses: [message.to] },
        ...(this.config.configurationSet ? { ConfigurationSetName: this.config.configurationSet } : {}),
        Content: {
          Simple: {
            Subject: { Data: email.subject, Charset: "UTF-8" },
            Body: {
              Text: { Data: email.text, Charset: "UTF-8" },
              ...(email.html === undefined ? {} : { Html: { Data: email.html, Charset: "UTF-8" } }),
            },
          },
        },
      }),
    );
    if (!result.MessageId) {
      throw new Error("SES accepted the message but returned no MessageId");
    }
    return { messageId: result.MessageId };
  }
}

/** Development provider: logs instead of sending. Used when SES_FROM_ADDRESS is not set. */
export class ConsoleEmailProvider implements EmailProvider {
  constructor(private readonly log: (line: string) => void = console.log) {}

  async send(message: { to: string; email: { subject: string } }): Promise<{ messageId: string }> {
    this.log(`[email:dev] to=${message.to} subject=${message.email.subject}`);
    return { messageId: `dev-${Date.now()}` };
  }
}
