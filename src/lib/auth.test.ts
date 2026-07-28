import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.hoisted(() => vi.fn());
const signInWithPasswordMock = vi.hoisted(() => vi.fn());
const getUserMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const profileRows = vi.hoisted(() => ({
  current: null as null | { username?: string | null; user_code?: string | null },
  upserts: [] as Array<{ payload: unknown; options: unknown }>,
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
        eq() {
          return this;
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

import { getCurrentUser, registerUser } from "./auth";

describe("auth registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRows.current = null;
    profileRows.upserts = [];
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
});