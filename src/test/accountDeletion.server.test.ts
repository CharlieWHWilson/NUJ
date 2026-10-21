import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

let handler: (request: Request) => Promise<Response>;
let count: number;
let ownershipError: boolean;
let authenticated: boolean;
const deleteUser = vi.fn();

async function remove(body?: unknown) {
  return handler(new Request("https://example.test/delete-account", {
    method: "POST", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
}

describe("account deletion ownership confirmation", () => {
  beforeEach(() => {
    count = 1;
    ownershipError = false;
    authenticated = true;
    deleteUser.mockReset();
    deleteUser.mockResolvedValue({ error: null });
    const source = ts.transpileModule(readFileSync("supabase/functions/delete-account/index.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const environment: Record<string, string> = { SUPABASE_URL: "https://example.test", SUPABASE_ANON_KEY: "fake-anon", SUPABASE_SERVICE_ROLE_KEY: "fake-admin" };
    vm.runInNewContext(source, {
      exports: {}, Response, console,
      Deno: { env: { get: (name: string) => environment[name] }, serve: (callback: typeof handler) => { handler = callback; } },
      require: () => ({ createClient: (_url: string, _key: string, options?: unknown) => options ? {
        auth: { getUser: async () => ({ data: { user: authenticated ? { id: "caller" } : null }, error: null }) },
      } : {
        auth: { admin: { deleteUser } },
        from: () => ({ select: () => ({ eq: async () => ({ count, error: ownershipError ? { message: "offline" } : null }) }) }),
      } }),
    });
  });

  it("blocks deleting owned groups without explicit confirmation", async () => {
    expect((await remove()).status).toBe(409);
    expect((await remove({ deleteOwnedSharedGroups: "true" })).status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes only the authenticated account after explicit confirmation", async () => {
    expect((await remove({ deleteOwnedSharedGroups: true, userId: "someone-else" })).status).toBe(200);
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith("caller");
  });

  it("does not require group deletion confirmation when no groups are owned", async () => {
    count = 0;
    expect((await remove()).status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith("caller");
  });

  it("fails closed if ownership cannot be checked or the caller is unauthenticated", async () => {
    ownershipError = true;
    expect((await remove({ deleteOwnedSharedGroups: true })).status).toBe(503);
    ownershipError = false;
    authenticated = false;
    expect((await remove({ deleteOwnedSharedGroups: true })).status).toBe(401);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});