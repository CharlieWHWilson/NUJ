import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { MateConnectionAction } from "./MateConnectionAction";
import { MateRequestsPanel } from "./MateRequestsPanel";
import type { MateConnections } from "@/hooks/useMateConnections";

const { dismiss } = vi.hoisted(() => ({ dismiss: vi.fn() }));
vi.mock("@/lib/mateRequests", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/mateRequests")>(), dismissPreviousMate: dismiss,
}));

let connections: MateConnections;
const incoming = { id: "request", userId: "friend", name: "Alex" };

function mountAction(userId = "friend") {
  render(<MemoryRouter><MateConnectionAction userId={userId} name="Alex" connections={connections} /></MemoryRouter>);
}
function mountPanel() {
  render(<MemoryRouter><MateRequestsPanel connections={connections} /></MemoryRouter>);
}

describe("quiet mate request controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connections = {
      userId: "self", mates: [], incoming: [], outgoing: [], previous: [], loading: false, error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue({ status: "pending", requestId: "request", mateId: null }),
      respond: vi.fn().mockResolvedValue("mate-id"),
    };
  });

  it("does not suggest requesting yourself or send anything on render", () => {
    mountAction("self");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(connections.send).not.toHaveBeenCalled();
  });

  it("sends exactly one request after an explicit tap, not an accepted connection", async () => {
    mountAction();
    fireEvent.click(screen.getByRole("button", { name: "Add Alex as a mate" }));
    await waitFor(() => expect(connections.send).toHaveBeenCalledExactlyOnceWith("friend"));
    expect(await screen.findByRole("status")).toHaveTextContent("Request sent");
    expect(connections.respond).not.toHaveBeenCalled();
  });

  it("shows existing mates as links, not another request action", () => {
    connections.mates = [{ id: "mate-id", mateUserId: "friend", name: "Alex", initials: "A", lastCheckin: "today" }];
    mountAction();
    expect(screen.getByRole("link", { name: "Mate" })).toHaveAttribute("href", "/mate/mate-id");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers explicit acceptance for incoming requests without accepting on render", async () => {
    connections.incoming = [incoming];
    mountAction();
    expect(connections.respond).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Accept Alex's mate request" }));
    await waitFor(() => expect(connections.respond).toHaveBeenCalledWith("request", "accept"));
  });

  it("offers cancellation for an outgoing request instead of sending another", async () => {
    connections.outgoing = [incoming];
    mountAction();
    fireEvent.keyDown(screen.getByRole("button", { name: "Request to Alex pending" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cancel request" }));
    await waitFor(() => expect(connections.respond).toHaveBeenCalledWith("request", "cancel"));
    expect(connections.send).not.toHaveBeenCalled();
  });

  it("keeps errors visible and never claims that a failed request was sent", async () => {
    connections.send = vi.fn().mockRejectedValue(new Error("A request cannot be sent right now."));
    mountAction();
    fireEvent.click(screen.getByRole("button", { name: "Add Alex as a mate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cannot be sent");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no requests or previous additions", () => {
    mountPanel();
    expect(screen.queryByText("Mate requests")).not.toBeInTheDocument();
    expect(screen.queryByText("Previous additions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("supports quiet declines and never displays a public declined status", async () => {
    connections.incoming = [incoming];
    mountPanel();
    fireEvent.click(screen.getByRole("button", { name: "Decline Alex's mate request" }));
    await waitFor(() => expect(connections.respond).toHaveBeenCalledWith("request", "decline"));
    expect(screen.queryByText(/declined/i)).not.toBeInTheDocument();
  });

  it("keeps earlier one-sided additions separate, without sending requests automatically", async () => {
    connections.previous = [{ id: "old", userId: "friend", name: "Alex" }];
    mountPanel();
    expect(screen.getByText(/No requests were sent automatically/)).toBeInTheDocument();
    expect(connections.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss previous addition for Alex" }));
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith("old"));
  });
});