import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGroupInviteLink, buildGroupInviteMessage, createSharedGroup,
  listSharedGroups, manageSharedGroup, normalizeGroupInvite, parseGroupInvite,
  savePendingGroupInvite, takePendingGroupInvite,
} from "./sharedGroups";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { rpc } }));

const code = "N7J2X9Q";

describe("shared groups", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    rpc.mockReset();
    rpc.mockResolvedValue({ data: [], error: null });
  });

  it("normalizes valid tokens and rejects malformed invitations", () => {
    expect(normalizeGroupInvite(` ${code.toLowerCase()} `)).toBe(code);
    for (const invalid of [null, "", "group-id", "../dashboard", `${code}a`, "ABC123", "ABC!234", "abcdef0123456789abcdef0123456789"]) {
      expect(normalizeGroupInvite(invalid)).toBeNull();
    }
  });

  it("preserves an invite across authentication and consumes it once", () => {
    savePendingGroupInvite(code);
    expect(takePendingGroupInvite()).toBe(code);
    expect(takePendingGroupInvite()).toBeNull();
    savePendingGroupInvite("invalid!");
    expect(takePendingGroupInvite()).toBeNull();
  });

  it("parses codes and NUJ links without accepting lookalike domains", () => {
    expect(parseGroupInvite(code)).toBe(code);
    expect(parseGroupInvite(`https://nuj.social/join/${code}?source=chat`)).toBe(code);
    expect(parseGroupInvite(`https://nuj.social/join/${code.toLowerCase()}`)).toBe(code);
    expect(parseGroupInvite(`https://www.nuj.social/join/${code}/`)).toBe(code);
    expect(parseGroupInvite(`https://nuj.social.example.com/join/${code}`)).toBeNull();
    expect(parseGroupInvite(`https://example.com/join/${code}`)).toBeNull();
    expect(parseGroupInvite(`http://nuj.social/join/${code}`)).toBeNull();
  });

  it("includes a usable link and installation fallback in shared messages", () => {
    expect(buildGroupInviteLink(code)).toBe(`https://nuj.social/join/${code}`);
    expect(buildGroupInviteMessage("School mates", code)).toContain("open this link again");
    expect(buildGroupInviteMessage("School mates", code)).toContain(`Group invite code: ${code}`);
  });

  it("uses permission-checked RPCs to create and manage shared groups", async () => {
    await createSharedGroup("School mates", 7);
    expect(rpc).toHaveBeenCalledWith("create_shared_group", { p_name: "School mates", p_cadence: 7 });
    await manageSharedGroup("group", "remove_member", { memberId: "member" });
    expect(rpc).toHaveBeenLastCalledWith("manage_shared_group", {
      p_group_id: "group", p_action: "remove_member", p_name: null, p_cadence: null, p_member_id: "member",
    });
  });

  it("provides actionable migration and permission errors", async () => {
    rpc.mockResolvedValueOnce({ error: { code: "PGRST202", message: "missing" } });
    await expect(listSharedGroups()).rejects.toThrow("034_shared_groups.sql");
    rpc.mockResolvedValueOnce({ error: { message: "Only the owner can do that." } });
    await expect(manageSharedGroup("group", "delete")).rejects.toThrow("Only the owner");
  });
});