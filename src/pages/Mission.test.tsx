import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import Mission from "./Mission";

describe("Mission", () => {
  it("explains the connection between meet-ups and links to its sources and next steps", () => {
    render(<MemoryRouter><Mission /></MemoryRouter>);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "NUJ home" })).toHaveTextContent("NUJ");
    expect(screen.queryByRole("img", { name: "NUJ" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stay connected" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How NUJ works" })).toBeInTheDocument();
    const checkInRow = screen.getByText("Check in.").closest(".mission-rhythm-row");
    const nujRow = screen.getByText("Send a NUJ.").closest(".mission-rhythm-row");
    expect(checkInRow).toHaveTextContent("👍");
    expect(screen.getByText("See your mates' check-ins.").closest(".mission-rhythm-row")).toHaveTextContent("👋");
    expect(nujRow).toHaveTextContent("👉");
    expect(nujRow?.querySelector("svg")).toBeNull();
    const downloads = screen.getAllByRole("link", { name: /Download on the App Store|Get NUJ for iPhone/ });
    expect(downloads).toHaveLength(5);
    for (const link of downloads) {
      expect(link).toHaveAttribute("href", "https://apps.apple.com/gb/app/nuj-social/id6789114237");
    }
    const signups = screen.getAllByRole("link", { name: /create an account online/i });
    expect(signups).toHaveLength(2);
    for (const link of signups) {
      expect(link).toHaveAttribute("href", "/auth?mode=register");
    }
    expect(screen.getByText("There's no need to keep NUJ open or spend time browsing, it is designed to keep you connected between the times you can see each other in person.")).toBeInTheDocument();
    const emailLinks = screen.getAllByRole("link", { name: "Email - charlie@nuj.social" });
    expect(emailLinks).toHaveLength(1);
    for (const link of emailLinks) {
      expect(link).toHaveAttribute("href", "mailto:charlie@nuj.social");
    }
    expect(screen.queryByText(/Groups and venues can try NUJ and share what helps/)).not.toBeInTheDocument();
    expect(screen.getByText(/NUJ is not a mental health service/)).toBeInTheDocument();
    expect(screen.queryByRole("banner", { name: "App header" })).not.toBeInTheDocument();
  });

  it("separates the proposition and next steps for mates, community groups and businesses", () => {
    render(<MemoryRouter><Mission /></MemoryRouter>);

    const navigation = screen.getByRole("navigation", { name: "Find what NUJ offers you" });
    expect(within(navigation).getByRole("link", { name: "For groups of mates" })).toHaveAttribute("href", "#mates");
    expect(within(navigation).getByRole("link", { name: "For community and support groups" })).toHaveAttribute("href", "#community-groups");
    expect(within(navigation).getByRole("link", { name: "For businesses and venues" })).toHaveAttribute("href", "#businesses");

    const mates = screen.getByRole("region", { name: "Stay connected without messaging" });
    expect(mates).toHaveAttribute("id", "mates");
    expect(within(mates).getByText("Team mates, school mates, holiday mates etc.")).toBeInTheDocument();
    expect(within(mates).getByText(/Stay aware of each other’s presence between real life meet-ups/)).toBeInTheDocument();
    expect(within(mates).getByRole("link", { name: "Get NUJ for iPhone" })).toHaveAttribute("href", "https://apps.apple.com/gb/app/nuj-social/id6789114237");

    const groups = screen.getByRole("region", { name: "Keep your group connected between meetings." });
    expect(groups).toHaveAttribute("id", "community-groups");
    expect(within(groups).getByText("Organised meet-up groups with a leader, host or organiser.")).toBeInTheDocument();
    expect(within(groups).getByText(/If you run or host a group, invite members to a shared NUJ group/)).toBeInTheDocument();
    expect(within(groups).queryByText(/safeguarding/)).not.toBeInTheDocument();
    expect(within(groups).getByRole("link", { name: "Get NUJ for iPhone" })).toHaveAttribute("href", "https://apps.apple.com/gb/app/nuj-social/id6789114237");

    const businesses = screen.getByRole("region", { name: "Give people a reason to meet at your venue." });
    expect(businesses).toHaveAttribute("id", "businesses");
    expect(within(businesses).getByText(/Join NUJ as a venue partner/)).toBeInTheDocument();
    expect(within(businesses).getByText(/Venue offers are not live yet/)).toBeInTheDocument();
    expect(within(businesses).getByRole("link", { name: "Email - charlie@nuj.social" })).toHaveAttribute("href", "mailto:charlie@nuj.social");
    expect(screen.queryByText(/^0[123]( \/|$)/)).not.toBeInTheDocument();
  });

  it("sets a page title and restores it when leaving", () => {
    document.title = "NUJ";
    const { unmount } = render(<MemoryRouter><Mission /></MemoryRouter>);
    expect(document.title).toBe("About NUJ");
    unmount();
    expect(document.title).toBe("NUJ");
  });
});
