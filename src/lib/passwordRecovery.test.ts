import { beforeEach, describe, expect, it, vi } from "vitest";
import { establishRecoverySession } from "./passwordRecovery";
import { getInAppPathFromUrl } from "./mateInvite";

const mocks = vi.hoisted(() => ({ setSession: vi.fn(), exchange: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { auth: { setSession: mocks.setSession, exchangeCodeForSession: mocks.exchange } } }));

describe("password recovery links", () => {
  beforeEach(() => {
    mocks.setSession.mockReset();
    mocks.exchange.mockReset();
    mocks.setSession.mockResolvedValue({ error: null });
    mocks.exchange.mockResolvedValue({ error: null });
    window.history.replaceState(null, "", "/account/update-password");
  });

  it("keeps recovery fragments intact during native URL routing", () => {
    expect(getInAppPathFromUrl("https://nuj.social/account/update-password#access_token=test&refresh_token=refresh&type=recovery"))
      .toBe("/account/update-password#access_token=test&refresh_token=refresh&type=recovery");
  });

  it("establishes an implicit recovery session and removes tokens from the URL", async () => {
    const url = `${window.location.origin}/account/update-password#access_token=test&refresh_token=refresh&type=recovery`;
    window.history.replaceState(null, "", url);
    await establishRecoverySession(url);
    expect(mocks.setSession).toHaveBeenCalledWith({ access_token: "test", refresh_token: "refresh" });
    expect(window.location.hash).toBe("");
  });

  it("exchanges a PKCE code and removes it from the URL", async () => {
    const url = `${window.location.origin}/account/update-password?code=test-code`;
    window.history.replaceState(null, "", url);
    await establishRecoverySession(url);
    expect(mocks.exchange).toHaveBeenCalledWith("test-code");
    expect(window.location.search).toBe("");
  });

  it("rejects incomplete and invalid recovery tokens without exposing them in errors", async () => {
    await expect(establishRecoverySession(`${window.location.origin}/account/update-password#access_token=test`)).rejects.toThrow("expired");
    mocks.setSession.mockResolvedValueOnce({ error: { message: "Secret token rejected" } });
    await expect(establishRecoverySession(`${window.location.origin}/account/update-password#access_token=test&refresh_token=refresh`)).rejects.toThrow("expired");
  });
});