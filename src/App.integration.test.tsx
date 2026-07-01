import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isAuthenticatedMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
const getCurrentUserMock = vi.hoisted(() => vi.fn());
const supabaseGetUserMock = vi.hoisted(() => vi.fn());
const onAuthStateChangeMock = vi.hoisted(() =>
  vi.fn(() => ({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  }))
);

vi.mock("./lib/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
  getCurrentUser: getCurrentUserMock,
}));

vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: supabaseGetUserMock,
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

vi.mock("./lib/dailyReminder", () => ({
  scheduleDailyReminderNotification: vi.fn(),
}));

import App from "./App";

describe("App integration routing", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    getCurrentUserMock.mockResolvedValue(null);
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lands on auth from / when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);

    render(<App />);

    expect(await screen.findByText("Sign in or create an account")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
  });

  it("lands on check-in from / when authenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(true);

    render(<App />);

    expect(await screen.findByText("You good?")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/check-in");
    });
  });

  it("redirects logged-out users from /dashboard to /auth", async () => {
    window.history.pushState({}, "", "/dashboard");
    isAuthenticatedMock.mockResolvedValue(false);

    render(<App />);

    expect(await screen.findByText("Sign in or create an account")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/auth");
    });
  });

  it("keeps logged-in users on /dashboard", async () => {
    window.history.pushState({}, "", "/dashboard");
    isAuthenticatedMock.mockResolvedValue(true);

    render(<App />);

    expect(await screen.findByText("Not checked in yet")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/dashboard");
    });
  });
});
