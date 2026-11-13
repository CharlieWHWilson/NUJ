import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";

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
    vi.restoreAllMocks();
  });

  it("opens the website explainer without waiting for authentication", async () => {
    window.history.pushState({}, "", "/explainer");
    isAuthenticatedMock.mockImplementation(() => new Promise<boolean>(() => {}));

    render(<App />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Stay connected");
    expect(window.location.pathname).toBe("/explainer");
    expect(screen.queryByText("Sign in or create an account")).not.toBeInTheDocument();
  });

  it("keeps the explainer out of the native app and hides its sign-in link", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    vi.spyOn(Capacitor, "getPlatform").mockReturnValue("android");
    window.history.pushState({}, "", "/explainer");
    isAuthenticatedMock.mockResolvedValue(false);

    render(<App />);

    expect(await screen.findByText("Sign in or create an account")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
    expect(screen.queryByRole("link", { name: "About NUJ" })).not.toBeInTheDocument();
  });

  it("lands on auth from / when unauthenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(false);

    render(<App />);

    expect(await screen.findByText("Sign in or create an account")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
    expect(screen.queryByRole("button", { name: "Get in touch" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "About NUJ" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What is NUJ?" })).toBeInTheDocument();
  });

  it("lands on check-in from / when authenticated", async () => {
    isAuthenticatedMock.mockResolvedValue(true);

    render(<App />);

    expect(await screen.findByText("You good?")).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/check-in");
    });
  });

  it("opens registration directly from the explainer's online signup link", async () => {
    window.history.pushState({}, "", "/explainer");
    isAuthenticatedMock.mockResolvedValue(false);
    render(<App />);

    const links = await screen.findAllByRole("link", { name: /create an account online/i });
    fireEvent.click(links[0]);

    expect(await screen.findByPlaceholderText("Confirm password")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
    expect(window.location.search).toBe("?mode=register");
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

  it("requires sign-in before opening the unlisted venue-entry page", async () => {
    window.history.pushState({}, "", "/admin/venues");
    isAuthenticatedMock.mockResolvedValue(false);
    render(<App />);
    expect(await screen.findByText("Sign in or create an account")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
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
    expect(within(content).getByRole("heading", { name: "Personal groups" })).toBeInTheDocument();
    expect(within(content).getByRole("heading", { name: "Shared groups" })).toBeInTheDocument();
    fireEvent.click(within(content).getByRole("button", { name: "About personal groups" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Organise your mates into groups and see when each mate last checked in.");
    expect(screen.getByRole("dialog")).toHaveTextContent("Personal groups are just for you and aren't visible to others.");
    expect(screen.getByRole("dialog")).toHaveTextContent("To take part in meet-up offers, create a shared group instead.");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    fireEvent.click(within(content).getByRole("button", { name: "About shared groups" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Connect a larger group without adding everyone as mates.");
    expect(screen.getByRole("dialog")).toHaveTextContent("such as daily or weekly.");
    expect(screen.getByRole("dialog")).toHaveTextContent("Exact check-in times stay private.");
    expect(screen.getByRole("dialog")).toHaveTextContent("Join meet-up offers with your shared group and earn rewards through check-ins, giving you a reason to meet in person.");
    expect(screen.getByRole("dialog")).toHaveTextContent("A win-win for your group and the venue.");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(within(content).getByRole("separator", { name: "Personal and shared groups" })).toBeInTheDocument();
    expect(screen.getByRole("banner", { name: "App header" })).toBe(header);
    expect(screen.getByRole("contentinfo", { name: "App footer" })).toBe(footer);
  });
});
