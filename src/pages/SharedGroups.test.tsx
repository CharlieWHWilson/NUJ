import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JoinSharedGroup from "./JoinSharedGroup";
import SharedGroupDetail from "./SharedGroupDetail";
import { SharedGroupsSection } from "@/components/SharedGroupsSection";

const mocks = vi.hoisted(() => ({
  preview: vi.fn(), join: vi.fn(), manage: vi.fn(), create: vi.fn(), save: vi.fn(), query: vi.fn(), connections: vi.fn(),
}));

vi.mock("@/lib/sharedGroups", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/sharedGroups")>(),
  previewSharedGroup: mocks.preview, joinSharedGroup: mocks.join,
  manageSharedGroup: mocks.manage, createSharedGroup: mocks.create, savePendingGroupInvite: mocks.save,
}));
vi.mock("@/hooks/useSharedGroupsSupabase", () => ({ useSharedGroupsSupabase: mocks.query }));
vi.mock("@/hooks/useMateConnections", () => ({ useMateConnections: mocks.connections }));

const code = "N7J2X9Q";
const group = {
  id: "group-id", name: "School mates", ownerId: "owner", ownerName: "Charlie",
  isOwner: true, cadenceDays: 7, inviteCode: code,
  members: [{ id: "owner", name: "Charlie", checkedIn: true }, { id: "member", name: "Alex", checkedIn: false }],
};

const Destination = () => <p>Destination: {useLocation().pathname}</p>;

function mount(element: JSX.Element, route: string, path: string) {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[route]}>
      <Routes><Route path={path} element={element} /><Route path="*" element={<Destination />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

describe("shared-group screens", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    vi.clearAllMocks();
    mocks.preview.mockResolvedValue({ id: group.id, name: group.name, ownerName: "Charlie", cadenceDays: 7, memberCount: 2 });
    mocks.join.mockResolvedValue(group.id);
    mocks.manage.mockResolvedValue(null);
    mocks.create.mockResolvedValue(group.id);
    mocks.query.mockReturnValue({ data: [group], isPending: false, error: null, refetch: vi.fn() });
    mocks.connections.mockReturnValue({ userId: "owner", mates: [], incoming: [], outgoing: [], previous: [], loading: false, error: null, refresh: vi.fn(), send: vi.fn(), respond: vi.fn() });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("previews privacy terms without joining and preserves the invite before sign-in", async () => {
    mount(<JoinSharedGroup authenticated={false} />, `/join/${code}`, "/join/:code");
    expect(await screen.findByRole("heading", { name: "School mates" })).toBeInTheDocument();
    expect(screen.getByText(/Your check-in history stays private/)).toBeInTheDocument();
    expect(screen.queryByText(/personal notes/i)).not.toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign in or sign up to join" }));
    expect(mocks.save).toHaveBeenCalledWith(code);
    expect(screen.getByText("Destination: /auth")).toBeInTheDocument();
  });

  it("requires explicit confirmation before joining and opens the joined group", async () => {
    mount(<JoinSharedGroup authenticated />, `/join/${code}`, "/join/:code");
    fireEvent.click(await screen.findByRole("button", { name: "Join group" }));
    await waitFor(() => expect(mocks.join).toHaveBeenCalledWith(code));
    expect(await screen.findByText("Destination: /shared-group/group-id")).toBeInTheDocument();
  });

  it("keeps join errors visible without claiming membership", async () => {
    mocks.join.mockRejectedValueOnce(new Error("You have been removed from this group."));
    mount(<JoinSharedGroup authenticated />, `/join/${code}`, "/join/:code");
    fireEvent.click(await screen.findByRole("button", { name: "Join group" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("removed");
    expect(screen.getByRole("button", { name: "Join group" })).toBeEnabled();
  });

  it("rejects malformed links without querying the backend", async () => {
    mount(<JoinSharedGroup authenticated />, "/join/invalid!", "/join/:code");
    expect(await screen.findByRole("alert")).toHaveTextContent("isn't valid");
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Join group" })).not.toBeInTheDocument();
  });

  it("shows owner-only controls and confirms member removal", async () => {
    mount(<SharedGroupDetail />, "/shared-group/group-id", "/shared-group/:id");
    expect(screen.getByText("Owned by you")).toBeInTheDocument();
    const information = screen.getByRole("contentinfo", { name: "Group information" });
    expect(information).toHaveTextContent("Members can see names and check-in status. Group membership does not add individual mates. To leave, transfer ownership to another member first, or delete the group.");
    expect(screen.getByRole("heading", { name: "Members · 2" }).parentElement).toHaveClass("nuj-card", "p-4");
    expect(screen.getByText(`Group code: ${code}`)).toBeInTheDocument();
    expect(screen.queryByText(`https://nuj.social/join/${code}`)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy link" })).not.toHaveTextContent("Copy link");
    expect(screen.queryByText("Copy link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite" })).toHaveClass("text-sm");
    expect(screen.getByRole("button", { name: "Share invite" })).not.toHaveClass("text-xs");
    expect(screen.queryByTitle("Today")).not.toBeInTheDocument();
    expect(screen.queryByTitle(/days since check-in/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset invite link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave group" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Options for Alex" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove Alex" }));
    await waitFor(() => expect(mocks.manage).toHaveBeenCalledWith("group-id", "remove_member", { memberId: "member" }));
    expect(window.confirm).toHaveBeenCalled();
  });

  it("lets members leave without exposing owner controls or invite codes", async () => {
    mocks.query.mockReturnValue({ data: [{ ...group, isOwner: false, inviteCode: null }], isPending: false, error: null });
    mount(<SharedGroupDetail />, "/shared-group/group-id", "/shared-group/:id");
    expect(screen.getByText("Owner: Charlie")).toBeInTheDocument();
    const information = screen.getByRole("contentinfo", { name: "Group information" });
    expect(information).toHaveTextContent("Members can see names and check-in status. Group membership does not add individual mates.");
    expect(information).not.toHaveTextContent("To leave, transfer ownership");
    expect(screen.queryByRole("button", { name: "Edit group" })).not.toBeInTheDocument();
    expect(screen.queryByText("Invite")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave group" }));
    expect(await screen.findByText("Destination: /dashboard")).toBeInTheDocument();
    expect(mocks.manage).toHaveBeenCalledWith("group-id", "leave", undefined);
  });

  it("creates a shared group without requiring existing mates", async () => {
    mount(<SharedGroupsSection groups={[]} loading={false} error={null} refresh={vi.fn()} />, "/dashboard", "/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Shared group" }));
    expect(screen.queryByText(/personal notes/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "School mates" } });
    const cadence = screen.getByRole("slider");
    for (let step = 0; step < 6; step++) fireEvent.keyDown(cadence, { key: "ArrowRight" });
    expect(screen.getByText("Every week")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create shared group" }));
    expect(await screen.findByText("Destination: /shared-group/group-id")).toBeInTheDocument();
    expect(mocks.create).toHaveBeenCalledWith("School mates", 7);
  });

  it("uses the personal-group slider style when editing and only saves on confirmation", async () => {
    mount(<SharedGroupDetail />, "/shared-group/group-id", "/shared-group/:id");
    fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
    const cadence = screen.getByRole("slider");
    expect(cadence).toHaveAttribute("aria-valuenow", "6");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.keyDown(cadence, { key: "End" });
    expect(screen.getByText("Every month")).toBeInTheDocument();
    expect(mocks.manage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.manage).toHaveBeenCalledWith("group-id", "update", { name: "School mates", cadenceDays: 30 }));
  });

  it("accepts a pasted invite link and takes the user to a preview", async () => {
    mount(<SharedGroupsSection groups={[]} loading={false} error={null} refresh={vi.fn()} />, "/dashboard", "/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Join group" }));
    fireEvent.change(screen.getByLabelText("Group invite link or code"), { target: { value: `https://nuj.social/join/${code}` } });
    fireEvent.click(screen.getByRole("button", { name: "Preview group" }));
    expect(await screen.findByText(`Destination: /join/${code}`)).toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
  });
});