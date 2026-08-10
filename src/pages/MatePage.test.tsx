import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MatePage from "./MatePage";

const mockRemoveMate = vi.fn();
const mockSendNuj = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "mate-1" }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/useMatesSupabase", () => ({
  useMatesSupabase: () => ({
    mates: [
      {
        id: "mate-1",
        name: "Ava Chen",
        initials: "AC",
        lastCheckin: "today",
        daysSinceCheckin: 0,
        lastCheckinAt: new Date().toISOString(),
        mateUserId: "user-2",
      },
    ],
    removeMate: mockRemoveMate,
  }),
}));

vi.mock("@/hooks/useNujsSupabase", () => ({
  ACTIVE_NUJ_EXISTS_ERROR: "ACTIVE_NUJ_EXISTS_ERROR",
  useNujsSupabase: () => ({
    sendNuj: mockSendNuj,
  }),
}));

describe("MatePage", () => {
  beforeEach(() => {
    mockRemoveMate.mockReset();
    mockSendNuj.mockReset();
    mockNavigate.mockReset();
    vi.restoreAllMocks();
  });

  it("removes the email action and opens WhatsApp and SMS with device-friendly links", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<MatePage />);

    expect(screen.queryByRole("button", { name: /email/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /whatsapp/i }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("https://wa.me/"), "_self");

    fireEvent.click(screen.getByRole("button", { name: /sms/i }));
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining("sms:"), "_self");
  });
});
