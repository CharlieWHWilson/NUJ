import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import MeetUpsHub from "./MeetUpsHub";
import MeetUpDetail from "./MeetUpDetail";
import VenueEntry from "./VenueEntry";
import { DashboardMeetups } from "@/components/DashboardMeetups";
import type { MeetupAttempt, Offer } from "@/lib/meetups";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), venues: vi.fn(), offers: vi.fn(), attempts: vi.fn(),
  saveVenue: vi.fn(), saveOffer: vi.fn(), groups: vi.fn(), select: vi.fn(), join: vi.fn(), leave: vi.fn(), redeem: vi.fn(),
  auth: vi.fn(),
  location: vi.fn(),
}));
vi.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => ({ id: "me" }) }));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { onAuthStateChange: mocks.auth } } }));
vi.mock("@/lib/meetups", async (original) => ({
  ...await original<typeof import("@/lib/meetups")>(),
  isVenueAdmin: mocks.admin, listVenues: mocks.venues, listOffers: mocks.offers,
  listMeetupAttempts: mocks.attempts, saveVenue: mocks.saveVenue, saveOffer: mocks.saveOffer,
  selectMeetupOffer: mocks.select, joinMeetupAttempt: mocks.join, redeemMeetupReward: mocks.redeem,
  leaveMeetupAttempt: mocks.leave,
}));
vi.mock("@/lib/sharedGroups", () => ({ listSharedGroups: mocks.groups }));
vi.mock("@/components/OffersMap", () => ({ default: ({ offers }: { offers: Offer[] }) => <div role="region" aria-label="Map of offer venues">{offers.map((item) => <p key={item.id}>{item.venue.name}</p>)}</div> }));
vi.mock("@/lib/venueLocations", async (original) => ({
  ...await original<typeof import("@/lib/venueLocations")>(), findVenueAddress: mocks.location,
}));

const venue = { id: "venue", name: "Local café", address: "1 High Street", description: "Your local café", timezone: "Europe/London", active: true };
const offer: Offer = { id: "offer", venueId: venue.id, venue, title: "Coffee together", reward: "Free coffee", terms: "One coffee per person", period: "week", periods: 2, unlockRule: "all", minimumMembers: 1, recipients: "qualifying", redemptionDays: 7, endsAt: null, active: true };
const attempt: MeetupAttempt = {
  id: "attempt", groupId: "group", groupName: "Old friends", offerId: offer.id, offer,
  participants: [{ userId: "me", name: "You", accepted: false, qualified: false, current: true }, { userId: "mate", name: "Alex", accepted: false, qualified: false, current: true }],
  participating: false, progress: 0, qualified: false, rewardId: null, rewardEarnedElsewhere: false, unlockedAt: null, expiresAt: null, redeemedAt: null,
};

function mount(page: JSX.Element, detail = false, initialEntry = detail ? "/meetup/offer" : "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[initialEntry]}>
    <Routes><Route path={detail ? "/meetup/:id" : "*"} element={page} /></Routes>
  </MemoryRouter></QueryClientProvider>);
  return client;
}

describe("venue offers frontend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    mocks.admin.mockResolvedValue(true);
    mocks.venues.mockResolvedValue([venue]);
    mocks.offers.mockResolvedValue([offer]);
    mocks.attempts.mockResolvedValue([attempt]);
    mocks.groups.mockResolvedValue([{ id: "group", name: "Old friends", isOwner: true }, { id: "other", name: "Not owned", isOwner: false }]);
    mocks.saveVenue.mockResolvedValue(venue.id);
    mocks.saveOffer.mockResolvedValue(offer.id);
    mocks.select.mockResolvedValue(attempt.id);
    mocks.join.mockResolvedValue(null);
    mocks.leave.mockResolvedValue(null);
    mocks.redeem.mockResolvedValue("redeemed");
    mocks.location.mockResolvedValue([{ name: "Chosen place", latitude: 0, longitude: 0 }]);
  });

  it("clears category and location selections together while Filters is closed", async () => {
    mount(<MeetUpsHub />);
    await screen.findByRole("link", { name: /Local café · Coffee together Category/ });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Other" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "CR4 2BA" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chosen place/ }));
    expect(screen.getByRole("button", { name: "Change postcode / place" })).toHaveTextContent("CR4 2BA");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("CR4 2BA")).toBeVisible();
    expect(screen.getByRole("img", { name: "Selected category: other" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.queryByText("CR4 2BA")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Selected category: other" })).not.toBeInTheDocument();
    expect(screen.queryByText("Distance unavailable")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("button", { name: "Other" })).toHaveAttribute("aria-pressed", "false");
    expect(within(screen.getByRole("dialog", { name: "Filters" })).getByRole("textbox")).toHaveValue("");
  });

  it("combines category filtering with distance sorting in list and map without filtering joined rewards", async () => {
    const makeOffer = (id: string, category: "cafe" | "pub", longitude?: number): Offer => ({
      ...offer, id, venueId: id, venue: { ...venue, id, name: id, category, latitude: longitude === undefined ? undefined : 0, longitude },
    });
    mocks.offers.mockResolvedValue([makeOffer("Far", "cafe", 2), makeOffer("Unknown", "cafe"), makeOffer("Near", "cafe", 0), makeOffer("Pub", "pub", 1)]);
    mount(<MeetUpsHub />);
    const available = screen.getByRole("region", { name: "Available offers" });
    await within(available).findByRole("link", { name: /Far/ });
    expect(screen.queryByRole("textbox", { name: "Postcode or place name" })).not.toBeInTheDocument();
    expect(within(available).getAllByRole("img", { name: "Category: cafe" })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.queryByText("1. Choose a category")).not.toBeInTheDocument();
    expect(within(screen.getByRole("dialog", { name: "Filters" })).getByRole("textbox", { name: "Postcode or place name" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cafe" }));
    expect(screen.getByRole("button", { name: "Cafe" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Cafe" })).toHaveClass("font-bold");
    expect(screen.getByRole("button", { name: "Cafe" }).querySelector("svg.lucide-coffee")).not.toBeNull();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("img", { name: "Selected category: cafe" })).toBeInTheDocument();
    expect(within(available).queryByRole("link", { name: /Pub/ })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Joined Rewards" })).toHaveTextContent(attempt.groupName);
    fireEvent.click(screen.getByRole("button", { name: "Filters · Active" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Postcode or place name" }), { target: { value: "SW17" } });
    expect(mocks.location).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("button", { name: /Chosen place/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(within(available).getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/meetup/")).map((link) => link.querySelector("h3")?.textContent)).toEqual(["Near · Coffee together", "Far · Coffee together", "Unknown · Coffee together"]);
    expect(within(available).getByText("Distance unavailable")).toBeInTheDocument();
    expect(within(available).getByText("SW17")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sort by distance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(within(available).getByText("0.0 miles")).toBeInTheDocument();
    expect(within(available).getByText("138.2 miles")).toBeInTheDocument();
    expect(within(available).getByText("0.0 miles").closest("a")?.firstElementChild).toContainElement(within(available).getByText("0.0 miles"));
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    const map = await screen.findByRole("region", { name: "Map of offer venues" });
    expect(map.textContent).toBe("NearFarUnknown");
    expect(within(available).getByText("SW17")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Change postcode / place" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Selected category: cafe" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Filters · Active" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change postcode / place" }));
    expect(screen.getByRole("textbox")).toHaveValue("SW17");
    fireEvent.click(screen.getByRole("button", { name: "Clear location" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(map.textContent).toBe("FarUnknownNear");
    expect(within(available).queryByText("SW17")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters · Active" }));
    fireEvent.click(screen.getByRole("button", { name: "Pub" }));
    expect(screen.getByRole("button", { name: "Cafe" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pub" })).toHaveAttribute("aria-pressed", "true");
    expect(map).toHaveTextContent("Pub");
    fireEvent.click(screen.getByRole("button", { name: "Cafe" }));
    expect(map.textContent).toBe("Pub");
    fireEvent.click(screen.getByRole("button", { name: "All categories" }));
    expect(map.textContent).toBe("FarUnknownNearPub");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("textbox", { name: "Postcode or place name" })).not.toBeInTheDocument();
  });

  it.each(["dashboard", "offers"] as const)("shows current venue category on %s joined cards without changing saved offer terms", async (surface) => {
    mocks.offers.mockResolvedValue([{ ...offer, venue: { ...venue, category: "cafe" } }]);
    mount(surface === "dashboard" ? <DashboardMeetups userId="me" open onOpenChange={vi.fn()} /> : <MeetUpsHub />);
    const card = (await screen.findByRole("link", { name: "Local café · Coffee together" })).closest("article")!;
    await waitFor(() => expect(within(card).getByRole("img", { name: "Category: cafe" })).toBeInTheDocument());
    expect(within(card).getByRole("img", { name: "Category: cafe" }).parentElement).toContainElement(within(card).getByRole("heading"));
  });

  it("shows only the venue postcode beside the map icon and keeps the full address in terms", async () => {
    mocks.offers.mockResolvedValue([{ ...offer, venue: { ...venue, address: "96 Mitcham Rd, London SW17 9NG" } }]);
    mocks.attempts.mockResolvedValue([]);
    mount(<MeetUpDetail />, true);
    expect(await screen.findByText("SW17 9NG")).toBeInTheDocument();
    expect(screen.queryByText("96 Mitcham Rd, London SW17 9NG")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Open map for ${venue.name}` })).toHaveAttribute("href", expect.stringContaining("96%20Mitcham"));
    fireEvent.click(screen.getByRole("button", { name: "T&Cs" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("96 Mitcham Rd, London SW17 9NG");
  });

  it("saves a venue category selected by the admin", async () => {
    mocks.venues.mockResolvedValue([{ ...venue, category: "pub" }]);
    mount(<VenueEntry />);
    const select = await screen.findByLabelText("Venue to edit");
    await waitFor(() => expect(select).toHaveTextContent(venue.name));
    fireEvent.change(select, { target: { value: venue.id } });
    expect(screen.getByLabelText("Venue category")).toHaveValue("pub");
    fireEvent.change(screen.getByLabelText("Venue category"), { target: { value: "cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Save venue changes" }));
    await waitFor(() => expect(mocks.saveVenue).toHaveBeenCalledWith(expect.objectContaining({ category: "cafe" }), venue.id));
  });
  it("shows venue and reward headline together on joined rewards, with the group below", async () => {
    mount(<MeetUpsHub />);
    const headings = await screen.findAllByRole("heading", { level: 3, name: `${venue.name} · ${offer.title}` });
    expect(headings).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: offer.title })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(["Joined Rewards", "Available offers"]);
    const availableCard = headings[1].closest("a");
    const joinedHeading = headings[0];
    expect(headings[1].parentElement?.nextElementSibling).toHaveTextContent(offer.reward);
    expect(headings[1].parentElement?.nextElementSibling?.nextElementSibling).toHaveClass("text-muted-foreground");
    const attemptCard = joinedHeading.closest("article");
    expect(availableCard).toHaveAttribute("href", "/meetup/offer");
    expect(within(joinedHeading).getByRole("link")).toHaveAttribute("href", "/meetup/offer");
    expect(screen.getByRole("link", { name: attempt.groupName })).toHaveAttribute("href", `/shared-group/${attempt.groupId}`);
    expect(screen.getByRole("link", { name: attempt.groupName }).querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: attempt.groupName }).closest("a")?.parentElement?.closest("a")).toBeNull();
    expect(availableCard).toHaveTextContent(offer.title);
    expect(joinedHeading.parentElement?.nextElementSibling).toHaveTextContent(attempt.groupName);
    expect(joinedHeading.parentElement?.nextElementSibling?.textContent).toBe(attempt.groupName);
    expect(availableCard).toHaveTextContent(offer.reward);
    expect(attemptCard).toHaveTextContent(offer.reward);
  });

  it("hides dashboard meet-ups help when collapsed and supports both expand controls", () => {
    const onOpenChange = vi.fn();
    mount(<DashboardMeetups userId="me" open={false} onOpenChange={onOpenChange} />);
    const expand = screen.getByRole("button", { name: "Expand meet-ups" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Turn the rhythm/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "About meet-ups" })).not.toBeInTheDocument();
    expect(mocks.offers).not.toHaveBeenCalled();
    expect(mocks.attempts).not.toHaveBeenCalled();
    fireEvent.click(expand);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    onOpenChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Meet-ups" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("opens dashboard meet-ups help when expanded without toggling the section", () => {
    const onOpenChange = vi.fn();
    mount(<DashboardMeetups userId="me" open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "About meet-ups" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Turn the rhythm of your NUJ check-ins into real-life meet-ups.");
    expect(screen.getByRole("dialog")).toHaveTextContent("Choose an offer for a shared group.");
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Expand meet-ups" })).toHaveAttribute("aria-expanded", "true");
  });

  it("links each joined offer directly to its details, including multiple offers at one venue", async () => {
    const otherVenue = { ...venue, id: "other-venue", name: "Another café" };
    mocks.attempts.mockResolvedValue([
      { ...attempt, participating: true, offer: { ...offer, active: false } },
      { ...attempt, id: "second-attempt", offerId: "second-offer", participating: true, offer: { ...offer, id: "second-offer", title: "£2 off", reward: "£2 off your first game Mon-Fri" } },
      { ...attempt, id: "unjoined-attempt", offer: { ...offer, venueId: otherVenue.id, venue: otherVenue } },
    ]);
    mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    const [card, secondCard] = await screen.findAllByRole("link", { name: /Local café/ });
    expect(card).toHaveAttribute("href", "/meetup/offer");
    expect(secondCard).toHaveAttribute("href", "/meetup/second-offer");
    expect(card).toHaveTextContent(offer.title);
    expect(secondCard).toHaveTextContent("£2 off");
    expect(secondCard).not.toHaveTextContent("£2 off your first game Mon-Fri");
    expect(card).not.toHaveTextContent(offer.reward);
    expect(card).not.toHaveTextContent(venue.address);
    expect(screen.getAllByRole("heading", { level: 3, name: /Local café/ })).toHaveLength(2);
    const pendingCard = screen.getByRole("link", { name: /Another café/ }).closest("article")!;
    expect(within(pendingCard).getByRole("button", { name: "Opt in" })).toBeInTheDocument();
    expect(pendingCard).toHaveTextContent("Not opted in yet.");
    expect(within(pendingCard).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all offers" })).toHaveAttribute("href", "/meetups");
    expect(screen.queryByText(/Turn the rhythm/)).not.toBeInTheDocument();
  });

  it("shows loading and retry states for meet-ups, then pending group offers", async () => {
    mocks.attempts.mockImplementationOnce(() => new Promise(() => {}));
    const client = mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading joined meet-ups...");
    mocks.attempts.mockRejectedValueOnce(new Error("Meet-ups unavailable"));
    await client.cancelQueries();
    await client.invalidateQueries();
    expect(await screen.findByRole("alert")).toHaveTextContent("Meet-ups unavailable");
    mocks.attempts.mockResolvedValue([attempt]);
    fireEvent.click(screen.getByRole("button", { name: "Retry meet-ups" }));
    expect(await screen.findByRole("button", { name: "Opt in" })).toBeInTheDocument();
    expect(screen.queryByText("No meet-ups joined yet")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all offers" })).toHaveAttribute("href", "/meetups");
  });

  it("shows separate personal progress and current participation for each joined offer", async () => {
    mocks.attempts.mockResolvedValue([
      { ...attempt, participating: true, progress: 1, participants: [
        { userId: "me", name: "You", accepted: true, qualified: false, current: true },
        { userId: "mate", name: "Alex", accepted: true, qualified: true, current: true },
        { userId: "left", name: "Left", accepted: true, qualified: true, current: false },
        { userId: "waiting", name: "Waiting", accepted: false, qualified: false, current: true },
      ] },
      { ...attempt, id: "second-attempt", groupName: "Coffee friends", participating: true, progress: 1, offer: { ...offer, reward: "15% off drinks", periods: 4, unlockRule: "minimum", minimumMembers: 3 } },
    ]);
    mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    const links = await screen.findAllByRole("link", { name: /Local café/ });
    const [card, secondCard] = links.map((link) => link.closest("article")!);
    expect(within(card).queryByText(/^\d+%$/)).not.toBeInTheDocument();
    expect(card).toHaveTextContent("1/2 weeks");
    expect(secondCard).toHaveTextContent("1/4 weeks");
    const groupRow = within(card).getByText(attempt.groupName).closest("p");
    expect(groupRow).toHaveTextContent(`${attempt.groupName}(2)`);
    expect(within(card).getByLabelText("2 joined")).toHaveTextContent("(2)");
    expect(groupRow?.querySelectorAll("svg")).toHaveLength(1);
    expect(within(card).queryByText("2 joined")).not.toBeInTheDocument();
    expect(card).toHaveTextContent("1/4 qualified");
    expect(secondCard).toHaveTextContent("0/3 qualified");
    expect(card).not.toHaveTextContent("Reward unlocked");
    const bars = [within(card).getByRole("progressbar"), within(secondCard).getByRole("progressbar")];
    expect(bars[0]).toHaveAttribute("value", "1");
    expect(bars[0]).toHaveAttribute("max", "2");
    expect(bars[1]).toHaveAttribute("value", "1");
    expect(bars[1]).toHaveAttribute("max", "4");
  });

  it.each([false, true])("shows a full personal streak without implying a reward unless earned: %s", async (earned) => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true, qualified: true, progress: 0, rewardId: earned ? "reward" : null, expiresAt: "2099-01-01T00:00:00Z" }]);
    mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    const card = (await screen.findByRole("link", { name: /Local café/ })).closest("article")!;
    expect(within(card).queryByText(/^\d+%$/)).not.toBeInTheDocument();
    expect(card).toHaveTextContent("2/2 weeks");
    expect(within(card).getByRole("progressbar")).toHaveAttribute("value", "2");
    if (earned) expect(card).toHaveTextContent("Reward unlocked");
    else expect(card).not.toHaveTextContent("Reward unlocked");
  });
  it("clears dashboard venue cards and help on account switch and sign-out", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    await screen.findByRole("link", { name: /Local café/ });
    fireEvent.click(screen.getByRole("button", { name: "About meet-ups" }));
    mocks.attempts.mockResolvedValue([]);
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "other-user", email_confirmed_at: "2026-01-01" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(venue.name)).not.toBeInTheDocument();
    await screen.findByText("No meet-ups joined yet");
    const calls = mocks.attempts.mock.calls.length;
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_OUT", null));
    fireEvent(window, new Event("nuj:refresh"));
    expect(screen.queryByText(venue.name)).not.toBeInTheDocument();
    expect(mocks.attempts).toHaveBeenCalledTimes(calls);
  });

  it("refreshes expanded dashboard venues when the app becomes visible", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    await screen.findByRole("link", { name: /Local café/ });
    const calls = mocks.attempts.mock.calls.length;
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(mocks.attempts.mock.calls.length).toBeGreaterThan(calls));
    vi.restoreAllMocks();
  });

  it("shows the joined-meet-ups empty state with no attempts and refreshes after check-in", async () => {
    mocks.attempts.mockResolvedValue([]);
    mount(<DashboardMeetups userId="me" open onOpenChange={vi.fn()} />);
    await screen.findByText("No meet-ups joined yet");
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    fireEvent(window, new Event("nuj:checkin-updated"));
    expect(await screen.findByRole("link", { name: /Local café/ })).toBeInTheDocument();
    expect(screen.queryByText("No meet-ups joined yet")).not.toBeInTheDocument();
  });

  it("filters available offers by the dashboard venue link without hiding group attempts", async () => {
    mocks.offers.mockResolvedValue([offer, { ...offer, id: "other-offer", venueId: "other-venue", venue: { ...venue, id: "other-venue", name: "Another café" } }]);
    mount(<MeetUpsHub />, false, "/?venue=venue");
    expect(await screen.findByRole("link", { name: /Local café · Coffee together.*Check in/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Another café/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Local café · Coffee together" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Show all offers" }));
    expect(await screen.findByRole("link", { name: /Another café/ })).toBeInTheDocument();
  });

  it("shows a clear empty state when a selected venue no longer has available offers", async () => {
    mount(<MeetUpsHub />, false, "/?venue=missing");
    expect(await screen.findByText("No offers are available at this venue right now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all offers" })).toHaveAttribute("href", "/meetups");
  });

  it("denies admin access before fetching any private data or rendering forms", async () => {
    mocks.admin.mockResolvedValue(false);
    mount(<VenueEntry />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Venue admin access is required");
    expect(mocks.venues).not.toHaveBeenCalled();
    expect(mocks.offers).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Venue name (required)")).not.toBeInTheDocument();
  });

  it("does not fetch private data while access is pending or failed", async () => {
    mocks.admin.mockRejectedValue(new Error("Access check unavailable"));
    mount(<VenueEntry />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Access check unavailable");
    expect(mocks.venues).not.toHaveBeenCalled();
    expect(mocks.offers).not.toHaveBeenCalled();
    mocks.admin.mockResolvedValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Retry access check" }));
    expect(await screen.findByText(/Private venue and offer data has not been loaded/)).toBeInTheDocument();
  });

  it("isolates cached admin data and clears form drafts on account changes", async () => {
    const client = mount(<VenueEntry />);
    fireEvent.change(await screen.findByLabelText("Venue name (required)"), { target: { value: "Private admin draft" } });
    await waitFor(() => expect(client.getQueryData(["venue-admin-offers", "me"])).toEqual([offer]));
    mocks.admin.mockResolvedValue(false);
    const venueCalls = mocks.venues.mock.calls.length;
    const offerCalls = mocks.offers.mock.calls.length;
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "other-user", email_confirmed_at: "2026-01-01" } }));
    expect(screen.queryByDisplayValue("Private admin draft")).not.toBeInTheDocument();
    expect(screen.queryByText(venue.name)).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Venue admin access is required");
    expect(mocks.venues).toHaveBeenCalledTimes(venueCalls);
    expect(mocks.offers).toHaveBeenCalledTimes(offerCalls);
    expect(client.getQueryData(["venue-admin", "other-user"])).toBe(false);
    expect(client.getQueryData(["venue-admin-venues", "other-user"])).toBeUndefined();
    mocks.admin.mockResolvedValue(true);
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "me", email_confirmed_at: "2026-01-01" } }));
    expect(await screen.findByLabelText("Venue name (required)")).toHaveValue("");
  });

  it.each([["hub", false], ["detail", true]] as const)("hides previous-user offer and attempt caches on %s account switch and sign-out", async (_, detail) => {
    const client = mount(detail ? <MeetUpDetail /> : <MeetUpsHub />, detail);
    await screen.findByText(detail ? "Original offer for this attempt" : "Old friends");
    expect(client.getQueryData(["meetup-attempts", "me"])).toEqual([attempt]);
    mocks.offers.mockResolvedValue([]);
    mocks.attempts.mockResolvedValue([]);
    mocks.groups.mockResolvedValue([]);
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "other-user", email_confirmed_at: "2026-01-01" } }));
    expect(screen.queryByText("Original offer for this attempt")).not.toBeInTheDocument();
    expect(screen.queryByText("Old friends")).not.toBeInTheDocument();
    expect(screen.queryByText(offer.reward)).not.toBeInTheDocument();
    await waitFor(() => expect(client.getQueryData(["meetup-attempts", "other-user"])).toEqual([]));
    const calls = mocks.attempts.mock.calls.length;
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_OUT", null));
    expect(screen.queryByText("Old friends")).not.toBeInTheDocument();
    fireEvent(window, new Event("nuj:checkin-updated"));
    expect(mocks.attempts).toHaveBeenCalledTimes(calls);
  });

  it("clears an open reward confirmation on account switch", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true, rewardId: "own-reward", expiresAt: "2099-01-01T00:00:00Z" }]);
    mount(<MeetUpDetail />, true);
    fireEvent.click(await screen.findByRole("button", { name: "Staff review / redeem" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    mocks.offers.mockResolvedValue([]);
    mocks.attempts.mockResolvedValue([]);
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "other-user", email_confirmed_at: "2026-01-01" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.redeem).not.toHaveBeenCalled();
  });

  it("confirms leaving a joined offer, refreshes participation and allows opting in again", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    mocks.leave.mockImplementation(async () => { mocks.attempts.mockResolvedValue([attempt]); return null; });
    mount(<MeetUpDetail />, true);
    fireEvent.click(await screen.findByRole("button", { name: "Leave offer" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("progress will reset");
    expect(dialog).toHaveTextContent("unused reward");
    expect(dialog).toHaveTextContent("stay in the shared group");
    expect(mocks.leave).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Leave offer" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm leave offer" }));
    await waitFor(() => expect(mocks.leave).toHaveBeenCalledWith(attempt.id));
    expect(await screen.findByRole("button", { name: "Opt in to this attempt" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave offer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps leave confirmation open and surfaces backend failures for retry", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    mocks.leave.mockRejectedValueOnce(new Error("Unable to leave offer"));
    mount(<MeetUpDetail />, true);
    fireEvent.click(await screen.findByRole("button", { name: "Leave offer" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm leave offer" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Unable to leave offer");
    expect(within(dialog).getByRole("button", { name: "Confirm leave offer" })).toBeEnabled();
  });

  it.each(["dashboard", "offers"])("allows explicit opt-in, confirmed opt-out and rejoining from %s cards", async (surface) => {
    mocks.groups.mockResolvedValue([]);
    mocks.join.mockImplementation(async () => {
      mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
      return null;
    });
    mocks.leave.mockImplementation(async () => {
      mocks.attempts.mockResolvedValue([attempt]);
      return null;
    });
    mount(surface === "dashboard" ? <DashboardMeetups userId="me" open onOpenChange={vi.fn()} /> : <MeetUpsHub />);
    const optIn = await screen.findByRole("button", { name: "Opt in" });
    expect(screen.getByText(/Not opted in yet/)).toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
    fireEvent.click(optIn);
    await waitFor(() => expect(mocks.join).toHaveBeenCalledWith(attempt.id));
    fireEvent.click(await screen.findByRole("button", { name: "Opt out" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("You will stay in the shared group.");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(mocks.leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Opt out" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm opt out" }));
    await waitFor(() => expect(mocks.leave).toHaveBeenCalledWith(attempt.id));
    expect(await screen.findByRole("button", { name: "Opt in" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["dashboard", "offers"])("surfaces opt-in and opt-out errors on %s cards", async (surface) => {
    mocks.join.mockRejectedValueOnce(new Error("Unable to opt in"));
    mount(surface === "dashboard" ? <DashboardMeetups userId="me" open onOpenChange={vi.fn()} /> : <MeetUpsHub />);
    fireEvent.click(await screen.findByRole("button", { name: "Opt in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to opt in");
    expect(screen.getByRole("button", { name: "Opt in" })).toBeEnabled();
    mocks.join.mockImplementation(async () => {
      mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
      return null;
    });
    fireEvent.click(screen.getByRole("button", { name: "Opt in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Opt out" }));
    mocks.leave.mockRejectedValueOnce(new Error("Unable to opt out"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm opt out" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("Unable to opt out");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm opt out" })).toBeEnabled();
  });

  it.each(["all", "minimum", "individual"] as const)("respects starting roster eligibility for %s offers on cards", async (unlockRule) => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participants: [], offer: { ...offer, unlockRule } }]);
    const hub = mount(<MeetUpsHub />);
    await screen.findByRole("heading", { name: "Joined Rewards" });
    await waitFor(() => expect(hub.getQueryData(["meetup-attempts", "me"])).toBeDefined());
    if (unlockRule === "all") {
      expect(screen.queryByRole("button", { name: "Opt in" })).not.toBeInTheDocument();
      expect(screen.getByText(/limited to the group's starting members/)).toBeInTheDocument();
    } else {
      expect(screen.getByRole("button", { name: "Opt in" })).toBeInTheDocument();
    }
  });

  it.each(["dashboard", "offers", "detail"])("prevents expired offer opt-ins on %s without hiding earned rewards", async (surface) => {
    mocks.attempts.mockResolvedValue([{ ...attempt, offer: { ...offer, endsAt: "2000-01-01T00:00:00Z" } }]);
    mount(surface === "dashboard" ? <DashboardMeetups userId="me" open onOpenChange={vi.fn()} /> : surface === "offers" ? <MeetUpsHub /> : <MeetUpDetail />, surface === "detail");
    expect(await screen.findByText("Offer ended. You can no longer opt in.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Opt in/ })).not.toBeInTheDocument();
    expect(mocks.join).not.toHaveBeenCalled();
  });

  it("keeps earned rewards redeemable after qualification ends", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true, rewardId: "reward", expiresAt: "2099-01-01T00:00:00Z", offer: { ...offer, endsAt: "2000-01-01T00:00:00Z" } }]);
    mount(<MeetUpDetail />, true);
    expect(await screen.findByRole("button", { name: "Staff review / redeem" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave offer" })).toBeInTheDocument();
  });

  it.each(["all", "minimum", "individual"] as const)("shows the correct detail opt-in eligibility for later group members on %s offers", async (unlockRule) => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participants: [], offer: { ...offer, unlockRule } }]);
    mount(<MeetUpDetail />, true);
    await screen.findByText("You have not opted in.");
    if (unlockRule === "all") {
      expect(screen.queryByRole("button", { name: "Opt in to this attempt" })).not.toBeInTheDocument();
      expect(screen.getByText(/not in this attempt’s starting roster/)).toBeInTheDocument();
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Opt in to this attempt" }));
      await waitFor(() => expect(mocks.join).toHaveBeenCalledWith(attempt.id));
    }
  });

  it.each(["dashboard", "offers"])("clears the %s opt-out confirmation on account switch", async (surface) => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    mount(surface === "dashboard" ? <DashboardMeetups userId="me" open onOpenChange={vi.fn()} /> : <MeetUpsHub />);
    fireEvent.click(await screen.findByRole("button", { name: "Opt out" }));
    mocks.attempts.mockResolvedValue([]);
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "other-user", email_confirmed_at: "2026-01-01" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.leave).not.toHaveBeenCalled();
  });

  it("clears leave confirmation on account switch and hides leave for unjoined offers", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true }]);
    mount(<MeetUpDetail />, true);
    fireEvent.click(await screen.findByRole("button", { name: "Leave offer" }));
    mocks.attempts.mockResolvedValue([attempt]);
    act(() => mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "other-user", email_confirmed_at: "2026-01-01" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await screen.findByText("You have not opted in.");
    expect(screen.queryByRole("button", { name: "Leave offer" })).not.toBeInTheDocument();
    expect(mocks.leave).not.toHaveBeenCalled();
  });
  it("creates venues separately with explicit active and timezone values", async () => {
    const client = mount(<VenueEntry />);
    const invalidation = vi.spyOn(client, "invalidateQueries");
    fireEvent.change(await screen.findByLabelText("Venue name (required)"), { target: { value: " New café " } });
    fireEvent.change(screen.getByLabelText("Venue address (required)"), { target: { value: " 2 High Street " } });
    fireEvent.change(screen.getByLabelText("Venue description (required)"), { target: { value: " Friendly café " } });
    fireEvent.click(screen.getByLabelText("Venue active"));
    fireEvent.click(screen.getByRole("button", { name: "Create venue" }));
    await waitFor(() => expect(mocks.saveVenue).toHaveBeenCalledWith({ name: "New café", address: "2 High Street", description: "Friendly café", timezone: "Europe/London", active: false, latitude: null, longitude: null, category: "other" }, null));
    expect(await screen.findByText("Venue saved.")).toBeInTheDocument();
    expect(mocks.saveOffer).not.toHaveBeenCalled();
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ["meetup-offers"] });
  });

  it("loads saved coordinates for editing and clears the pin when the address changes", async () => {
    mocks.venues.mockResolvedValue([{ ...venue, latitude: 51.5, longitude: -0.12 }]);
    mount(<VenueEntry />);
    const select = await screen.findByLabelText("Venue to edit");
    await waitFor(() => expect(select).toHaveTextContent(venue.name));
    fireEvent.change(select, { target: { value: venue.id } });
    expect(screen.getByLabelText("Latitude (optional)")).toHaveValue(51.5);
    expect(screen.getByLabelText("Longitude (optional)")).toHaveValue(-0.12);
    fireEvent.change(screen.getByLabelText("Venue address (required)"), { target: { value: "New address" } });
    expect(screen.getByLabelText("Latitude (optional)")).toHaveValue(null);
    expect(screen.getByLabelText("Longitude (optional)")).toHaveValue(null);
  });

  it("rejects incomplete coordinate pairs and saves valid manual coordinates", async () => {
    mount(<VenueEntry />);
    const select = await screen.findByLabelText("Venue to edit");
    await waitFor(() => expect(select).toHaveTextContent(venue.name));
    fireEvent.change(select, { target: { value: venue.id } });
    fireEvent.change(screen.getByLabelText("Latitude (optional)"), { target: { value: "51.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save venue changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter both latitude");
    expect(mocks.saveVenue).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Longitude (optional)"), { target: { value: "-0.12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save venue changes" }));
    await waitFor(() => expect(mocks.saveVenue).toHaveBeenCalledWith(expect.objectContaining({ latitude: 51.5, longitude: -0.12 }), venue.id));
  });

  it("switches between list and map using only the selected venue's available offers", async () => {
    mocks.attempts.mockResolvedValue([]);
    mocks.offers.mockResolvedValue([offer, { ...offer, id: "other-offer", venueId: "other-venue", venue: { ...venue, id: "other-venue", name: "Other café" } }]);
    mount(<MeetUpsHub />, false, "/?venue=venue");
    await screen.findByRole("link", { name: /Local café · Coffee together.*Check in/ });
    expect(screen.queryByRole("region", { name: "Map of offer venues" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    const map = await screen.findByRole("region", { name: "Map of offer venues" });
    expect(map).toHaveTextContent(venue.name);
    expect(map).not.toHaveTextContent("Other café");
    expect(screen.queryByRole("link", { name: /Local café · Coffee together.*Check in/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(await screen.findByRole("link", { name: /Local café · Coffee together.*Check in/ })).toBeInTheDocument();
  });

  it("normalizes new offer payloads and forces individual rewards to qualifying recipients", async () => {
    mount(<VenueEntry />);
    await screen.findByLabelText("Offer title (required)");
    await waitFor(() => expect(screen.getByLabelText("Offer venue (required)")).toHaveTextContent(venue.name));
    fireEvent.change(screen.getByLabelText("Offer venue (required)"), { target: { value: venue.id } });
    fireEvent.change(screen.getByLabelText("Offer title (required)"), { target: { value: " New offer " } });
    fireEvent.change(screen.getByLabelText("Reward description (required)"), { target: { value: " Tea " } });
    fireEvent.change(screen.getByLabelText("Offer terms (required)"), { target: { value: " One per person " } });
    fireEvent.change(screen.getByLabelText("Check-in period"), { target: { value: "week" } });
    fireEvent.change(screen.getByLabelText("Consecutive periods (1–52)"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Unlock rule"), { target: { value: "minimum" } });
    fireEvent.change(screen.getByLabelText("Minimum qualifying members (required)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Reward recipients"), { target: { value: "all" } });
    fireEvent.change(screen.getByLabelText("Unlock rule"), { target: { value: "individual" } });
    expect(screen.getByLabelText("Reward recipients")).toBeDisabled();
    const ends = "2027-03-05T12:30";
    fireEvent.change(screen.getByLabelText("Offer ends at (optional, your device’s local time)"), { target: { value: ends } });
    fireEvent.click(screen.getByLabelText("Offer active"));
    fireEvent.click(screen.getByRole("button", { name: "Create offer" }));
    await waitFor(() => expect(mocks.saveOffer).toHaveBeenCalledWith({
      venueId: venue.id, title: "New offer", reward: "Tea", terms: "One per person",
      period: "week", periods: 3, unlockRule: "individual", minimumMembers: 1, recipients: "qualifying", redemptionDays: 7,
      endsAt: new Date(ends).toISOString(), active: false,
    }, null));
    expect(await screen.findByText("Offer saved.")).toBeInTheDocument();
    expect(mocks.offers).toHaveBeenCalledWith(true);
  });

  it("edits an existing offer and keeps the server id separate from its payload", async () => {
    mount(<VenueEntry />);
    await waitFor(() => expect(screen.getByLabelText("Offer to edit")).toHaveTextContent(offer.title));
    fireEvent.change(screen.getByLabelText("Offer to edit"), { target: { value: offer.id } });
    fireEvent.change(screen.getByLabelText("Unlock rule"), { target: { value: "minimum" } });
    fireEvent.change(screen.getByLabelText("Minimum qualifying members (required)"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Reward recipients"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Save offer changes" }));
    const { id: _id, venue: _venue, ...input } = offer;
    await waitFor(() => expect(mocks.saveOffer).toHaveBeenCalledWith({ ...input, unlockRule: "minimum", minimumMembers: 2, recipients: "all" }, offer.id));
  });

  it("rejects invalid numeric payloads and shows save failures without claiming success", async () => {
    mount(<VenueEntry />);
    await waitFor(() => expect(screen.getByLabelText("Offer to edit")).toHaveTextContent(offer.title));
    fireEvent.change(screen.getByLabelText("Offer to edit"), { target: { value: offer.id } });
    fireEvent.change(screen.getByLabelText("Consecutive periods (1–52)"), { target: { value: "53" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save offer changes" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Periods must be 1–52");
    expect(mocks.saveOffer).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Consecutive periods (1–52)"), { target: { value: "2" } });
    mocks.saveOffer.mockRejectedValueOnce(new Error("Offer save denied"));
    fireEvent.click(screen.getByRole("button", { name: "Save offer changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Offer save denied");
    expect(screen.queryByText("Offer saved.")).not.toBeInTheDocument();
  });

  it("selects only owned groups and requires separate explicit opt-in", async () => {
    const client = mount(<MeetUpDetail />, true);
    const invalidation = vi.spyOn(client, "invalidateQueries");
    const select = await screen.findByLabelText("Shared group");
    expect(within(select).queryByRole("option", { name: "Not owned" })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "group" } });
    fireEvent.click(screen.getByRole("button", { name: "Select offer for group" }));
    await waitFor(() => expect(mocks.select).toHaveBeenCalledWith("group", "offer"));
    expect(mocks.join).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Opt in to this attempt" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Opt in to this attempt" }));
    await waitFor(() => expect(mocks.join).toHaveBeenCalledWith("attempt"));
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ["meetup-attempts", "me"] });
    fireEvent.click(screen.getAllByRole("button", { name: "T&Cs" })[0]);
    expect(screen.getByText(/Only normal NUJ check-ins after acceptance count/)).toBeInTheDocument();
    expect(screen.getByText(/not calendar weeks/)).toBeInTheDocument();
  });

  it("keeps inactive offer snapshots and blocks later members from all-roster opt-in", async () => {
    mocks.offers.mockResolvedValue([]);
    mocks.attempts.mockResolvedValue([{ ...attempt, offer: { ...offer, active: false }, participants: [attempt.participants[1]] }]);
    mount(<MeetUpDetail />, true);
    expect(await screen.findByText(/not in this attempt’s starting roster/)).toBeInTheDocument();
    expect(screen.getAllByText("1 High Street")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Opt in to this attempt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Select offer for group" })).not.toBeInTheDocument();
  });

  it("uses the immutable snapshot for original rules even when the listing changes", async () => {
    mocks.offers.mockResolvedValue([{ ...offer, title: "Edited listing", reward: "Different reward" }]);
    mount(<MeetUpDetail />, true);
    expect(await screen.findByRole("heading", { name: "Edited listing", level: 2 })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Original offer for this attempt"));
    expect(screen.getByRole("heading", { name: offer.title, level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText(venue.name).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "T&Cs" })[1]);
    expect(screen.getByRole("dialog")).toHaveTextContent(offer.reward);
  });

  it("hides offer details in T&Cs and provides an encoded Google Maps address link", async () => {
    mocks.attempts.mockResolvedValue([]);
    mount(<MeetUpDetail />, true);
    const termsButton = await screen.findByRole("button", { name: "T&Cs" });
    expect(screen.queryByText(offer.terms)).not.toBeInTheDocument();
    expect(screen.queryByText(/Check-in timezone:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Offer ends:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Redeem within/)).not.toBeInTheDocument();
    const map = screen.getByRole("link", { name: `Open map for ${venue.name}` });
    expect(map).toHaveAttribute("href", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name}, ${venue.address}`)}`);
    expect(map).toHaveAttribute("target", "_blank");
    expect(map).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(termsButton);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(offer.terms);
    expect(dialog).toHaveTextContent(`Check-in timezone: ${venue.timezone}`);
    expect(dialog).toHaveTextContent("Offer ends: No end date");
    expect(dialog).toHaveTextContent("Redeem within 7 days of unlocking.");
    expect(dialog).toHaveTextContent("All members in the starting group must qualify.");
    expect(dialog).toHaveTextContent("earlier check-ins do not");
    expect(dialog).toHaveTextContent("not calendar weeks");
  });

  it.each([
    { period: "day" as const, periods: 3, unlockRule: "minimum" as const, minimumMembers: 4, recipients: "all" as const, cadence: "Daily", duration: "3 consecutive days", qualification: "4+ members", rewardFor: "All opted-in members" },
    { period: "week" as const, periods: 2, unlockRule: "individual" as const, minimumMembers: 1, recipients: "qualifying" as const, cadence: "Once a week", duration: "2 consecutive weeks", qualification: "Each person", rewardFor: "Qualifying members only" },
    { period: "day" as const, periods: 1, unlockRule: "all" as const, minimumMembers: 1, recipients: "qualifying" as const, cadence: "Daily", duration: "1 consecutive day", qualification: "All starting members", rewardFor: "Qualifying members only" },
  ])("shows compact cadence with icon-led qualification details in T&Cs for $unlockRule offers", async (rule) => {
    mocks.offers.mockResolvedValue([{ ...offer, ...rule }]);
    mocks.attempts.mockResolvedValue([]);
    mount(<MeetUpDetail />, true);
    await screen.findByRole("button", { name: "T&Cs" });
    expect(screen.getByText(rule.cadence)).toBeInTheDocument();
    expect(screen.getByText(`${rule.periods} ${rule.period === "day" ? rule.periods === 1 ? "day" : "days" : rule.periods === 1 ? "week" : "weeks"} in a row`)).toBeInTheDocument();
    expect(screen.queryByText(rule.duration)).not.toBeInTheDocument();
    expect(screen.queryByText(offer.reward)).not.toBeInTheDocument();
    expect(screen.getAllByText(offer.title)).toHaveLength(1);
    expect(screen.queryByText(/Only accepted opt-ins count/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "T&Cs" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(rule.unlockRule === "minimum" ? "At least 4 members must qualify." : rule.unlockRule === "individual" ? "Each member qualifies independently." : "All members in the starting group must qualify.");
    expect(screen.getByRole("dialog")).toHaveTextContent(offer.reward);
    for (const title of ["Your reward", "Who qualifies", "Check-in rules", "Using your reward", "Leaving or rejoining", "About the venue"]) {
      const heading = within(screen.getByRole("dialog")).getByRole("heading", { name: title });
      expect(heading.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
    expect(screen.getByRole("dialog")).toHaveTextContent(rule.rewardFor);
  });
  it("shows original terms in the snapshot T&Cs after a listing is edited", async () => {
    mocks.offers.mockResolvedValue([{ ...offer, terms: "New terms", redemptionDays: 14 }]);
    mount(<MeetUpDetail />, true);
    fireEvent.click(await screen.findByText("Original offer for this attempt"));
    fireEvent.click(screen.getAllByRole("button", { name: "T&Cs" })[1]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(offer.terms);
    expect(dialog).toHaveTextContent("Redeem within 7 days of unlocking.");
    expect(dialog).not.toHaveTextContent("New terms");
  });
  it("redeems only the member's own reward after a confirmation dialog", async () => {
    const earned = { ...attempt, participating: true, qualified: true, rewardId: "own-reward", expiresAt: "2099-01-01T00:00:00Z" };
    mocks.attempts.mockResolvedValue([earned]);
    mocks.redeem.mockImplementation(async () => {
      mocks.attempts.mockResolvedValue([{ ...earned, redeemedAt: "2026-11-13T10:00:00Z" }]);
      return "redeemed";
    });
    mount(<MeetUpDetail />, true);
    fireEvent.click(await screen.findByRole("button", { name: "Staff review / redeem" }));
    expect(mocks.redeem).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("member-confirmed, not independently venue verified");
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm redemption" }));
    await waitFor(() => expect(mocks.redeem).toHaveBeenCalledWith("own-reward"));
    expect(await screen.findByText(/Redeemed .*Member-confirmed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Staff review / redeem" })).not.toBeInTheDocument();
  });

  it("shows already-earned-elsewhere and disables expired rewards", async () => {
    mocks.attempts.mockResolvedValue([{ ...attempt, participating: true, rewardEarnedElsewhere: true, rewardId: "expired", expiresAt: "2020-01-01T00:00:00Z" }]);
    mount(<MeetUpDetail />, true);
    expect(await screen.findByText(/You already earned this offer with another group/)).toBeInTheDocument();
    expect(screen.getByText(/Reward expired/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Staff review / redeem" })).not.toBeInTheDocument();
  });

  it("lists offers and snapshot attempts, refetching on check-in events", async () => {
    mount(<MeetUpsHub />);
    const link = await screen.findByRole("link", { name: "Local café · Coffee together" });
    expect(link).toHaveAttribute("href", "/meetup/offer");
    expect(screen.getByRole("link", { name: /Local café · Coffee together.*Check in/ })).toHaveAttribute("href", "/meetup/offer");
    const calls = mocks.attempts.mock.calls.length;
    fireEvent(window, new Event("nuj:checkin-updated"));
    await waitFor(() => expect(mocks.attempts.mock.calls.length).toBeGreaterThan(calls));
  });

  it("refreshes group progress when the app becomes visible", async () => {
    mount(<MeetUpDetail />, true);
    await screen.findByLabelText("Shared group");
    const calls = mocks.attempts.mock.calls.length;
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => expect(mocks.attempts.mock.calls.length).toBeGreaterThan(calls));
    vi.restoreAllMocks();
  });

  it("retries failed listing requests and shows independent empty states", async () => {
    mocks.offers.mockRejectedValueOnce(new Error("Offers unavailable"));
    mocks.attempts.mockResolvedValue([]);
    mount(<MeetUpsHub />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Offers unavailable");
    expect(await screen.findByText(/Your groups haven’t selected an offer yet/)).toBeInTheDocument();
    mocks.offers.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Retry offers" }));
    expect(await screen.findByText("No offers are available right now.")).toBeInTheDocument();
  });
});
