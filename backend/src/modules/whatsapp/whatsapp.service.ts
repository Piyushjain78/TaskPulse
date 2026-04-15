import type { Env } from "../../config/env";
import { prisma } from "../../lib/prisma";

export type WhatsAppTemplateKey = "TASK_ASSIGNED" | "TASK_COMPLETED";

export type TemplatePayload = {
  taskTitle: string;
  assigneeName?: string;
  managerName?: string;
};

/**
 * Template-based WhatsApp outbound. Supports Msg91 and Gupshup sandbox.
 * Failures are logged to DeliveryLog; callers do not throw for send failures.
 */
export class WhatsAppService {
  constructor(private env: Env) {}

  async sendTaskEvent(
    taskId: string | undefined,
    toPhone: string | null | undefined,
    templateKey: WhatsAppTemplateKey,
    data: TemplatePayload
  ): Promise<void> {
    if (!toPhone) {
      await this.log(taskId, "skipped", this.env.WHATSAPP_PROVIDER, null, "Recipient has no phone");
      return;
    }
    if (this.env.WHATSAPP_PROVIDER === "none") {
      await this.log(taskId, "skipped", "none", JSON.stringify({ templateKey, toPhone }), "WHATSAPP_PROVIDER=none");
      return;
    }
    try {
      if (this.env.WHATSAPP_PROVIDER === "msg91") {
        await this.sendMsg91(taskId, toPhone, templateKey, data);
      } else if (this.env.WHATSAPP_PROVIDER === "gupshup") {
        await this.sendGupshup(taskId, toPhone, templateKey, data);
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await this.log(taskId, "failed", this.env.WHATSAPP_PROVIDER, JSON.stringify({ templateKey, toPhone }), err);
    }
  }

  private async sendMsg91(
    taskId: string | undefined,
    to: string,
    key: WhatsAppTemplateKey,
    data: TemplatePayload
  ) {
    const auth = this.env.MSG91_AUTH_KEY;
    const integrated = this.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;
    const ns = this.env.MSG91_TEMPLATE_NAMESPACE;
    const templateName =
      key === "TASK_ASSIGNED" ? this.env.MSG91_TEMPLATE_TASK_ASSIGNED : this.env.MSG91_TEMPLATE_TASK_COMPLETED;
    if (!auth || !integrated || !templateName) {
      await this.log(taskId, "failed", "msg91", null, "Missing Msg91 env (MSG91_AUTH_KEY / integrated / template name)");
      return;
    }

    const body = {
      integrated_number: integrated,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: "en", policy: "deterministic" },
          namespace: ns ?? undefined,
          components: this.msg91Components(key, data),
        },
      },
    };

    const res = await fetch("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: auth,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Msg91 HTTP ${res.status}: ${text}`);
    }
    await this.log(taskId, "success", "msg91", text, null);
  }

  private msg91Components(key: WhatsAppTemplateKey, data: TemplatePayload) {
    if (key === "TASK_ASSIGNED") {
      return [
        {
          type: "body",
          parameters: [
            { type: "text", text: data.assigneeName ?? "Assignee" },
            { type: "text", text: data.taskTitle },
          ],
        },
      ];
    }
    return [
      {
        type: "body",
        parameters: [
          { type: "text", text: data.managerName ?? "Manager" },
          { type: "text", text: data.taskTitle },
        ],
      },
    ];
  }

  private async sendGupshup(
    taskId: string | undefined,
    to: string,
    key: WhatsAppTemplateKey,
    data: TemplatePayload
  ) {
    const user = this.env.GUPSHUP_USER_ID;
    const pass = this.env.GUPSHUP_PASSWORD;
    const app = this.env.GUPSHUP_APP_NAME;
    if (!user || !pass) {
      await this.log(taskId, "failed", "gupshup", null, "Missing GUPSHUP_USER_ID / GUPSHUP_PASSWORD");
      return;
    }
    const msg =
      key === "TASK_ASSIGNED"
        ? `Task assigned: ${data.taskTitle}. Assignee: ${data.assigneeName ?? ""}`
        : `Task completed: ${data.taskTitle}. Manager: ${data.managerName ?? ""}`;

    const params = new URLSearchParams({
      method: "SendMessage",
      send_to: to.replace(/^\+/, ""),
      msg: msg,
      msg_type: "TEXT",
      userid: user,
      password: pass,
      auth_scheme: "plain",
      ...(app ? { v: "1.1", format: "text" } : {}),
    });

    const url = `https://media.smsgupshup.com/GatewayAPI/rest?${params.toString()}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) throw new Error(`Gupshup HTTP ${res.status}: ${text}`);
    await this.log(taskId, "success", "gupshup", text, null);
  }

  private async log(
    taskId: string | undefined,
    status: string,
    provider: string,
    payload: string | null,
    error: string | null
  ) {
    await prisma.deliveryLog.create({
      data: {
        taskId: taskId ?? null,
        status,
        provider,
        payload,
        error,
      },
    });
  }
}
