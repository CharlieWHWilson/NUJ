import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isAuthenticatedMock = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
const getCurrentUserMock = vi.hoisted(() => vi.fn());
const supabaseGetUserMock = vi.hoisted(() => vi.fn());
const resetPasswordMock = vi.hoisted(() => vi.fn());
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
  requestPasswordReset: resetPasswordMock,
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
  recordLastCheckin: vi.fn(),
  hasReminderIntervalElapsed: vi.fn(() => true),
  isCheckinReminderNotificationId: vi.fn(() => false),
  loadDailyReminderSettings: vi.fn(() => ({ enabled: false, time: "08:00", intervalDays: 1 })),
}));

import App from "./App";

describe("App integration routing", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    getCurrentUserMock.mockResolvedValue(null);
    supabaseGetUserMock.mockResolvedValue({ data: { user: null } });
    resetPasswordMock.mockReset();
    resetPasswordMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lands on auth from / when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);

    render(<App />);

    expect(await screen.findByText("Sign in or create an account")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
    expect(screen.queryByRole("button", { name: "Get in touch" })).not.toBeInTheDocument();
  });

  it("lands on check-in from / when authenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(true);

    render(<App />);

    expect(await screen.findByText("You good?")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/check-in");
    });
  });

  it("lets a logged-out user request password recovery and retry a failed request", async () => {
    isAuthenticatedMock.mockResolvedValue(false);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Reset email"), { target: { value: "friend@example.test" } });
    resetPasswordMock.mockRejectedValueOnce(new Error("Couldn't send a reset email. Please try again."));
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("try again");
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("If an account exists");
    expect(resetPasswordMock).toHaveBeenCalledTimes(2);
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
    const header = screen.getByRole("banner", { name: "App header" });
    const content = screen.getByRole("main", { name: "Dashboard content" });
    const footer = screen.getByRole("contentinfo", { name: "App footer" });
    expect(within(footer).getByText("Stay connected")).toHaveClass("text-black");
    expect(content).not.toContainElement(footer);
    expect(header).toContainElement(screen.getByText("Not checked in yet"));
    expect(within(header).getByRole("button", { name: "Profile" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "What is NUJ?" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Get in touch" })).toBeInTheDocument();
    expect(content).not.toContainElement(header);
    const groups = within(content).getByRole("button", { name: /Groups/ });
    fireEvent.click(groups);
    expect(groups).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("banner", { name: "App header" })).toBe(header);
    expect(screen.getByRole("contentinfo", { name: "App footer" })).toBe(footer);
  });
});
