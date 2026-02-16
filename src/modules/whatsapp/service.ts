import type {
  WhatsAppModuleOptions,
  SendTemplatePayload,
  SendTextPayload,
  SendImagePayload,
  TemplateParameter,
} from "./types"
import { formatMexicanPhone } from "./phone"

const GRAPH_API_VERSION = "v21.0"

type InjectedDependencies = {
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void }
}

export default class WhatsAppService {
  protected logger_: InjectedDependencies["logger"]
  protected options_: WhatsAppModuleOptions
  private baseUrl: string

  constructor(
    container: InjectedDependencies,
    options: WhatsAppModuleOptions
  ) {
    this.logger_ = container.logger
    this.options_ = options
    this.baseUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${options.phoneNumberId}/messages`
  }

  private async send(body: SendTemplatePayload | SendTextPayload | SendImagePayload): Promise<any> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options_.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      throw new Error(`WhatsApp API error ${res.status}: ${errorBody}`)
    }

    return res.json()
  }

  getVerifyToken(): string {
    return this.options_.verifyToken
  }

  /**
   * Send a pre-approved template message.
   * Parameters are passed as positional text values ({{1}}, {{2}}, etc.).
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    parameters: string[]
  ): Promise<void> {
    const phone = formatMexicanPhone(to)
    if (!phone) {
      this.logger_.error(
        `[WhatsApp] Invalid phone number: ${to}, skipping template ${templateName}`
      )
      return
    }

    const templateParams: TemplateParameter[] = parameters.map((text) => ({
      type: "text",
      text,
    }))

    const payload: SendTemplatePayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        components: templateParams.length
          ? [{ type: "body", parameters: templateParams }]
          : [],
      },
    }

    try {
      await this.send(payload)
      this.logger_.info(
        `[WhatsApp] Template "${templateName}" sent to ${phone}`
      )
    } catch (error: any) {
      this.logger_.error(
        `[WhatsApp] Failed to send template "${templateName}" to ${phone}: ${error.message || error}`
      )
    }
  }

  /**
   * Send a plain text message (only works within the 24-hour window).
   */
  async sendText(to: string, text: string): Promise<void> {
    const phone = formatMexicanPhone(to)
    if (!phone) {
      this.logger_.error(`[WhatsApp] Invalid phone number: ${to}, skipping text message`)
      return
    }

    const payload: SendTextPayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }

    try {
      await this.send(payload)
      this.logger_.info(`[WhatsApp] Text message sent to ${phone}`)
    } catch (error: any) {
      this.logger_.error(
        `[WhatsApp] Failed to send text to ${phone}: ${error.message || error}`
      )
    }
  }

  /**
   * Send an image message with optional caption (only works within the 24-hour window).
   */
  async sendMedia(to: string, mediaUrl: string, caption?: string): Promise<void> {
    const phone = formatMexicanPhone(to)
    if (!phone) {
      this.logger_.error(`[WhatsApp] Invalid phone number: ${to}, skipping media message`)
      return
    }

    const payload: SendImagePayload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "image",
      image: { link: mediaUrl, caption },
    }

    try {
      await this.send(payload)
      this.logger_.info(`[WhatsApp] Image sent to ${phone}`)
    } catch (error: any) {
      this.logger_.error(
        `[WhatsApp] Failed to send image to ${phone}: ${error.message || error}`
      )
    }
  }
}
