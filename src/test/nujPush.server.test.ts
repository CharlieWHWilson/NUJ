import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const eventId = "11111111-1111-4111-8111-111111111111";
const authorized = {
  recipientUserId: "recipient-from-database", title: "Current name sent a NUJ",
  body: "Open NUJ to view it.", data: { type: "new_nuj", nujId: eventId },
};
let handler: (request: Request) => Promise<Response>;
let verified: boolean;
let claim: { data: typeof authorized | null; error: { code: string } | null };
let tokenReads: number;
const delivery = vi.fn<(_url: string, _options?: RequestInit) => Promise<Response>>(async () => new Response("", { status: 200 }));
const claimRpc = vi.fn();
const tokenFilter = vi.fn();

function tokenQuery() {
  const query = {
    select: () => query,
    eq: (field: string, value: string) => { tokenFilter(field, value); return query; },
    then: (resolve: (value: unknown) => unknown) => {
      tokenReads++;
      return Promise.resolve({ data: [{ id: "token-row", token: "fake-device-token", platform: "ios" }], error: null }).then(resolve);
    },
  };
  return query;
}

async function send(body: unknown, authorization: string | null = "Bearer test-user-token") {
  return handler(new Request("https://example.test/send-nuj-push", {
    method: "POST", headers: { "Content-Type": "application/json", ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  }));
}

describe("NUJ push HTTP authorization", () => {
  beforeEach(() => {
    verified = true;
    tokenReads = 0;
    claim = { data: authorized, error: null };
    delivery.mockClear();
    claimRpc.mockReset();
    tokenFilter.mockClear();
    const source = ts.transpileModule(readFileSync("supabase/functions/send-nuj-push/index.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    class Jwt {
      setProtectedHeader() { return this; }
      setIssuedAt() { return this; }
      setExpirationTime() { return this; }
      setAudience() { return this; }
      setIssuer() { return this; }
      async sign() { return "fake-apns-jwt"; }
    }
    const environment: Record<string, string> = {
      SUPABASE_URL: "https://example.test", SUPABASE_SERVICE_ROLE_KEY: "fake-server-key",
      APNS_TEAM_ID: "team", APNS_KEY_ID: "key", APNS_PRIVATE_KEY: "fake-private-key", APNS_TOPIC: "social.nuj.app", APNS_ENV: "production",
    };
    vm.runInNewContext(source, {
      exports: {}, Request, Response, console, fetch: delivery,
      Deno: { env: { get: (name: string) => environment[name] }, serve: (callback: typeof handler) => { handler = callback; } },
      require: (name: string) => name.includes("supabase") ? { createClient: (_url: string, _key: string, options?: unknown) => options ? {
        rpc: (name: string, parameters: unknown) => { claimRpc(name, parameters); return Promise.resolve(claim); },
      } : {
        auth: { getUser: async () => verified
          ? { data: { user: { id: "actor", email_confirmed_at: "2026-01-01" } }, error: null }
          : { data: { user: null }, error: { message: "Invalid token" } } },
        from: () => tokenQuery(), rpc: async () => ({ data: 1, error: null }),
      } } : { SignJWT: Jwt, importPKCS8: async () => ({}) },
    });
  });

  it("rejects missing and invalid user tokens before reading device tokens", async () => {
    expect((await send({ data: { nujId: eventId, type: "new_nuj" } }, null)).status).toBe(401);
    verified = false;
    expect((await send({ data: { nujId: eventId, type: "new_nuj" } })).status).toBe(401);
    expect(tokenReads).toBe(0);
    expect(delivery).not.toHaveBeenCalled();
  });

  it("rejects arbitrary notifications without an actual event identifier", async () => {
    expect((await send({ recipientUserId: "anyone", title: "spoofed", body: "arbitrary" })).status).toBe(400);
    expect(claimRpc).not.toHaveBeenCalled();
    expect(delivery).not.toHaveBeenCalled();
  });

  it("rejects an unauthorized event without touching APNs or device tokens", async () => {
    claim = { data: null, error: { code: "P0001" } };
    expect((await send({ data: { nujId: eventId, type: "new_nuj" } })).status).toBe(403);
    expect(tokenReads).toBe(0);
    expect(delivery).not.toHaveBeenCalled();
  });

  it("ignores forged recipients and text, using only the database-authorized notification", async () => {
    const response = await send({ recipientUserId: "forged-recipient", title: "spoofed", body: "arbitrary", data: { nujId: eventId, type: "new_nuj" } });
    expect(response.status).toBe(200);
    expect(claimRpc).toHaveBeenCalledWith("claim_nuj_push", { p_nuj_id: eventId, p_kind: "new_nuj" });
    expect(tokenFilter).toHaveBeenCalledWith("user_id", authorized.recipientUserId);
    expect(delivery).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(delivery.mock.calls[0]?.[1]?.body));
    expect(payload.aps.alert).toEqual({ title: authorized.title, body: authorized.body });
    expect(payload.data).toEqual(authorized.data);
  });

  it("does not deliver replayed event claims twice", async () => {
    claim = { data: null, error: null };
    const response = await send({ data: { nujId: eventId, type: "new_nuj" } });
    expect(await response.json()).toMatchObject({ duplicate: true, sent: 0 });
    expect(delivery).not.toHaveBeenCalled();
  });
});