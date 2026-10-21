import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Profile from "./Profile";

const mocks = vi.hoisted(() => ({ update: vi.fn(), user: { id: "user", username: "Charlie", email: "charlie@example.test", userCode: "ABC1234" } }));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => mocks.user }));
vi.mock("@/lib/auth", () => ({ updateCurrentUsername: mocks.update, logoutUser: vi.fn() }));
vi.mock("@/lib/dailyReminder", () => ({
  REMINDER_INTERVAL_OPTIONS: [1, 2, 3, 4, 5, 6, 7],
  loadDailyReminderSettings: () => ({ enabled: false, time: "08:00", intervalDays: 1 }),
  requestDailyReminderPermission: vi.fn(), saveDailyReminderSettings: vi.fn(), scheduleDailyReminderNotification: vi.fn(),
}));
vi.mock("@/lib/attentionBadge", () => ({ initializeAttentionBadge: vi.fn() }));

function mount() { render(<MemoryRouter><Profile /></MemoryRouter>); }

describe("profile username editing", () => {
  beforeEach(() => {
    mocks.update.mockReset();
    mocks.update.mockResolvedValue("Charlie Wilson");
  });

  it("starts read-only and keeps the NUJ code unchanged after saving", async () => {
    mount();
    expect(screen.getByLabelText("Username")).toHaveAttribute("readonly");
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Charlie Wilson" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Username saved");
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith("Charlie Wilson");
    expect(screen.getByLabelText("Username")).toHaveValue("Charlie Wilson");
    expect(screen.getByLabelText("Username")).toHaveAttribute("readonly");
    expect(screen.getByText("ABC1234")).toBeInTheDocument();
  });

  it("cancels without writing or changing the displayed username", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Different name" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Username")).toHaveValue("Charlie");
  });

  it("disables blank saves and retains errors without claiming success", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    mocks.update.mockRejectedValueOnce(new Error("That username is already in use. Try another."));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Taken name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already in use");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("Taken name");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Username")).toHaveValue("Charlie");
  });

  it("prevents duplicate saves while the request is running", async () => {
    let finish: (value: string) => void;
    mocks.update.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit username" }));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "Charlie Wilson" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    finish!("Charlie Wilson");
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit username" })).toBeInTheDocument());
    expect(mocks.update).toHaveBeenCalledOnce();
  });
});