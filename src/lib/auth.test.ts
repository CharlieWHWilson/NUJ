import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const profileRows = vi.hoisted(() => ({
  current: null as null | { username?: string | null; user_code?: string | null },
  upserts: [] as Array<{ payload: unknown; options: unknown }>,
  updates: [] as Array<{ username: string }>,
  filters: [] as Array<{ field: string; value: string }>,
  updateError: null as null | { code: string; message: string },
}));

vi.mock("@/lib/pushNotifications", () => ({
  removeCurrentPushToken: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: signUpMock,
      signInWithPassword: signInWithPasswordMock,
      getUser: getUserMock,
      getSession: getSessionMock,
    },
    from: vi.fn((table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select() {
          return this;
        },
        eq(field: string, value: string) {
          profileRows.filters.push({ field, value });
          return this;
        },
        update(payload: { username: string }) {
          profileRows.updates.push(payload);
          return this;
        },
        single() {
          return Promise.resolve({ data: profileRows.updateError ? null : profileRows.updates.at(-1), error: profileRows.updateError });
        },
        maybeSingle() {
          return Promise.resolve({ data: profileRows.current, error: null });
        },
        upsert(payload: unknown, options: unknown) {
          profileRows.upserts.push({ payload, options });
          return Promise.resolve({ data: null, error: null });
        },
      };
    }),
  },
}));

import { getCurrentUser, registerUser, updateCurrentUsername } from "./auth";

describe("auth registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRows.current = null;
    profileRows.upserts = [];
    profileRows.updates = [];
    profileRows.filters = [];
    profileRows.updateError = null;
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1", email_confirmed_at: "2026-01-01T00:00:00Z" } }, error: null });
  });

  it("sends the display name under both metadata keys and upserts the profile", async () => {
    signUpMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: { access_token: "token" },
      },
      error: null,
    });

    const result = await registerUser({
      name: "  Lyra   Wilson  ",
      email: "lyra@example.com",
      password: "password123",
    });

    expect(result).toEqual({ ok: true, requiresEmailConfirmation: false });
    expect(signUpMock).toHaveBeenCalledWith({
      email: "lyra@example.com",
      password: "password123",
      options: {
        emailRedirectTo: "http://localhost:3000/check-in",
        data: {
          name: "Lyra Wilson",
          full_name: "Lyra Wilson",
          username: "Lyra Wilson",
          display_name: "Lyra Wilson",
          phone: "",
        },
      },
    });
    expect(profileRows.upserts).toEqual([
      {
        payload: { id: "user-1", username: "Lyra Wilson" },
        options: { onConflict: "id" },
      },
    ]);
  });

  it("repairs a blank profile username when the user is authenticated", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "lyra@example.com",
          email_confirmed_at: "2026-07-23T00:00:00.000Z",
          user_metadata: { name: "Lyra Wilson", username: "Lyra Wilson" },
        },
      },
      error: null,
    });
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });
    profileRows.current = { username: "   ", user_code: "ABC1234" };

    const result = await getCurrentUser();

    expect(result).toEqual({
      id: "user-2",
      username: "Lyra Wilson",
      email: "lyra@example.com",
      userCode: "ABC1234",
    });
    expect(profileRows.upserts).toEqual([
      {
        payload: { id: "user-2", username: "Lyra Wilson" },
        options: { onConflict: "id" },
      },
    ]);
  });

  it("treats an unverified auth user as unauthenticated", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-3",
          email: "lyra@example.com",
          email_confirmed_at: null,
          user_metadata: { name: "Lyra Wilson", username: "Lyra Wilson" },
        },
      },
      error: null,
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("maps database signup failures to an actionable migration message", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Database error saving new user" },
    });

    const result = await registerUser({
      name: "Lyra",
      email: "lyra@example.com",
      password: "password123",
    });

    expect(result).toEqual({
      ok: false,
      message:
        "Signup failed because your Supabase profiles trigger/schema is out of date. Run migrations 026_harden_profile_signup_trigger.sql and 027_remove_phone_storage.sql, then try again.",
    });
  });

  it("saves a normalized username only on the authenticated user's profile", async () => {
    await expect(updateCurrentUsername("  Charlie   Wilson  ")).resolves.toBe("Charlie Wilson");
    expect(profileRows.updates).toEqual([{ username: "Charlie Wilson" }]);
    expect(profileRows.filters).toEqual([{ field: "id", value: "user-1" }]);
    expect(profileRows.upserts).toEqual([]);
  });

  it("rejects empty or overly long usernames without writing", async () => {
    await expect(updateCurrentUsername("   ")).rejects.toThrow("Enter a username");
    await expect(updateCurrentUsername("x".repeat(81))).rejects.toThrow("80 characters");
    expect(profileRows.updates).toEqual([]);
  });

  it("does not update a profile without verified authentication", async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(updateCurrentUsername("Charlie")).rejects.toThrow("sign in again");
    expect(profileRows.updates).toEqual([]);
  });

  it("keeps duplicate-name and database failures actionable", async () => {
    profileRows.updateError = { code: "23505", message: "duplicate username" };
    await expect(updateCurrentUsername("Charlie")).rejects.toThrow("already in use");
    profileRows.updateError = { code: "42501", message: "permission denied" };
    await expect(updateCurrentUsername("Charlie")).rejects.toThrow("Couldn't save");
  });
});