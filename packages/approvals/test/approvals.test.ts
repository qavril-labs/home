import { describe, expect, it } from "vitest";
import { DomainError, FixedClock } from "@erp/kernel";
import { ApprovalQueue, MemoryApprovalStore } from "../src";

const COMPANY = "11111111-1111-7111-8111-111111111111";
const ASKER = "22222222-2222-7222-8222-222222222222";
const MANAGER = "33333333-3333-7333-8333-333333333333";
const clock = new FixedClock(new Date("2026-11-17T09:00:00Z"));

function setup() {
  return new ApprovalQueue(new MemoryApprovalStore(), clock);
}

const ask = (queue: ApprovalQueue) =>
  queue.request({
    companyId: COMPANY,
    kind: "BOT_ACTION",
    reason: "Invoice INV-2026-000004 is 14 days late; send the reminder.",
    payload: { bot: "chase-chloe", action: "SEND_REMINDER", invoice: "INV-2026-000004" },
    requestedBy: ASKER,
  });

describe("approval queue", () => {
  it("holds a new request as pending, with its reason and payload", async () => {
    const queue = setup();
    const request = await ask(queue);
    expect(request).toMatchObject({ status: "PENDING", kind: "BOT_ACTION", requestedBy: ASKER, decidedBy: null });
    expect(request.payload).toMatchObject({ action: "SEND_REMINDER" });
  });

  it("lets a different person approve, and records who decided and when", async () => {
    const queue = setup();
    const request = await ask(queue);
    const approved = await queue.approve(COMPANY, request.id, MANAGER, "Reminder is fine.");
    expect(approved).toMatchObject({ status: "APPROVED", decidedBy: MANAGER, decisionNote: "Reminder is fine." });
    expect(approved.decidedAt).toBe("2026-11-17T09:00:00.000Z");
  });

  it("never lets the requester approve or reject their own request", async () => {
    const queue = setup();
    const request = await ask(queue);
    await expect(queue.approve(COMPANY, request.id, ASKER)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(queue.reject(COMPANY, request.id, ASKER, "I changed my mind")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await queue.get(COMPANY, request.id))?.status).toBe("PENDING");
  });

  it("refuses a second decision on a decided request", async () => {
    const queue = setup();
    const request = await ask(queue);
    await queue.reject(COMPANY, request.id, MANAGER, "Wait until the customer replies.");
    await expect(queue.approve(COMPANY, request.id, MANAGER)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires a reason for a request and a note for a rejection", async () => {
    const queue = setup();
    await expect(
      queue.request({ companyId: COMPANY, kind: "BOT_ACTION", reason: "short", payload: {}, requestedBy: ASKER }),
    ).rejects.toBeInstanceOf(DomainError);
    const request = await ask(queue);
    await expect(queue.reject(COMPANY, request.id, MANAGER, "no")).rejects.toBeInstanceOf(DomainError);
  });

  it("lets only the requester withdraw, and only while pending", async () => {
    const queue = setup();
    const request = await ask(queue);
    await expect(queue.withdraw(COMPANY, request.id, MANAGER)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const withdrawn = await queue.withdraw(COMPANY, request.id, ASKER);
    expect(withdrawn.status).toBe("WITHDRAWN");
    await expect(queue.approve(COMPANY, request.id, MANAGER)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("keeps companies apart and lists pending requests on their own", async () => {
    const queue = setup();
    const request = await ask(queue);
    expect(await queue.get("44444444-4444-7444-8444-444444444444", request.id)).toBeUndefined();
    expect((await queue.list(COMPANY, "PENDING")).map((item) => item.id)).toEqual([request.id]);
    await queue.approve(COMPANY, request.id, MANAGER);
    expect(await queue.list(COMPANY, "PENDING")).toHaveLength(0);
  });

  it("rejects a kind that is not upper case with underscores", async () => {
    const queue = setup();
    await expect(
      queue.request({ companyId: COMPANY, kind: "bot action", reason: "A valid reason text", payload: {}, requestedBy: ASKER }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
