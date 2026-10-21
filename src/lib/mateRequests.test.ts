import { beforeEach, describe, expect, it, vi } from "vitest";
import { listMateRequests, MATES_UPDATED_EVENT, removeMateConnection, respondToMateRequest, sendMateRequest } from "./mateRequests";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { rpc } }));

describe("mate request API", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { status: "pending", requestId: "request", mateId: null }, error: null });
  });

  it("sends a request through the consent RPC rather than inserting a mate", async () => {
    expect(await sendMateRequest("friend")).toEqual({ status: "pending", requestId: "request", mateId: null });
    expect(rpc).toHaveBeenCalledWith("send_mate_request", { p_recipient_id: "friend" });
  });

  it("keeps acceptance, decline and cancellation explicit", async () => {
    for (const action of ["accept", "decline", "cancel"] as const) {
      await respondToMateRequest("request", action);
      expect(rpc).toHaveBeenLastCalledWith("respond_to_mate_request", { p_request_id: "request", p_action: action });
    }
  });

  it("removes the connection through its permission-checked RPC", async () => {
    await removeMateConnection("mate-row");
    expect(rpc).toHaveBeenCalledWith("remove_mate_connection", { p_mate_id: "mate-row" });
  });

  it("refreshes local mate state without invoking notification APIs", async () => {
    const onUpdated = vi.fn();
    window.addEventListener(MATES_UPDATED_EVENT, onUpdated);
    await listMateRequests();
    expect(onUpdated).not.toHaveBeenCalled();
    await sendMateRequest("friend");
    expect(onUpdated).toHaveBeenCalledOnce();
    window.removeEventListener(MATES_UPDATED_EVENT, onUpdated);
  });

  it("reports missing migrations and permission errors without claiming success", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "PGRST202" } });
    await expect(sendMateRequest("friend")).rejects.toThrow("036_mate_requests.sql");
    rpc.mockResolvedValueOnce({ error: { message: "Only the recipient can accept." } });
    await expect(respondToMateRequest("request", "accept")).rejects.toThrow("Only the recipient");
  });
});