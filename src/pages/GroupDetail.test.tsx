import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GroupDetail from "./GroupDetail";

const mocks = vi.hoisted(() => ({ update: vi.fn(), remove: vi.fn(), groups: vi.fn() }));
vi.mock("@/hooks/useGroupsSupabase", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/hooks/useGroupsSupabase")>(), useGroupsSupabase: mocks.groups,
}));
vi.mock("@/hooks/useMatesSupabase", () => ({ useMatesSupabase: () => ({ mates: [{ id: "mate", name: "Alex", initials: "A", lastCheckin: "today" }] }) }));

function mount() {
  render(<MemoryRouter initialEntries={["/group/group"]}><Routes><Route path="/group/:id" element={<GroupDetail />} /></Routes></MemoryRouter>);
}

describe("personal group editor feedback", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    mocks.update.mockReset();
    mocks.update.mockResolvedValue(undefined);
    mocks.remove.mockReset();
    mocks.groups.mockReturnValue({ groups: [{ id: "group", name: "School", mates: ["mate"], checkinCadenceDays: 7 }], loading: false, error: null,
      updateGroup: mocks.update, updateGroupCadence: vi.fn(), removeGroup: mocks.remove });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retains an unsuccessful draft and supports retrying the same save", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Couldn't save this group."));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit group name"), { target: { value: "School friends" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save");
    expect(screen.getByLabelText("Edit group name")).toHaveValue("School friends");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument());
    expect(mocks.update).toHaveBeenLastCalledWith("group", { name: "School friends", mateIds: ["mate"] });
  });

  it("shows load failures rather than returning a blank screen", () => {
    mocks.groups.mockReturnValue({ groups: [], loading: false, error: "Unable to load group." });
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load group");
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});