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
    expect(screen.getByRole("heading", { name: "Stay connected between meet-ups." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How NUJ works" })).toBeInTheDocument();
    const downloads = screen.getAllByRole("link", { name: /Download on the App Store|Get NUJ for iPhone/ });
    expect(downloads).toHaveLength(4);
    for (const link of downloads) {
      expect(link).toHaveAttribute("href", "https://apps.apple.com/gb/app/nuj-social/id6789114237");
    }
    expect(document.querySelector('a[href="/auth"]')).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore a community pilot" })).toHaveAttribute("href", "mailto:charlie@nuj.social?subject=Community%20pilot");
    expect(screen.getByRole("link", { name: "Marmalade Trust's loneliness resources" })).toHaveAttribute("href", "https://www.marmaladetrust.org/loneliness");
    expect(screen.getByText(/not proven outcomes or announced partnerships/)).toBeInTheDocument();
    expect(screen.getByText(/NUJ is not a mental health service/)).toBeInTheDocument();
    expect(screen.queryByRole("banner", { name: "App header" })).not.toBeInTheDocument();
  });

  it("separates the proposition and next steps for mates, community groups and businesses", () => {
    render(<MemoryRouter><Mission /></MemoryRouter>);

    const navigation = screen.getByRole("navigation", { name: "Find what NUJ offers you" });
    expect(within(navigation).getByRole("link", { name: "For groups of mates" })).toHaveAttribute("href", "#mates");
    expect(within(navigation).getByRole("link", { name: "For community and support groups" })).toHaveAttribute("href", "#community-groups");
    expect(within(navigation).getByRole("link", { name: "For businesses and venues" })).toHaveAttribute("href", "#businesses");

    const mates = screen.getByRole("region", { name: "Stay in touch between meet-ups." });
    expect(mates).toHaveAttribute("id", "mates");
    expect(within(mates).getByText(/Sports teams. Pub quiz teams. School mates./)).toBeInTheDocument();
    expect(within(mates).getByRole("link", { name: "Get NUJ for iPhone" })).toHaveAttribute("href", "https://apps.apple.com/gb/app/nuj-social/id6789114237");

    const groups = screen.getByRole("region", { name: "Keep your group connected between meet-ups." });
    expect(groups).toHaveAttribute("id", "community-groups");
    expect(within(groups).getByText(/Walk-and-talk groups, loneliness charities/)).toBeInTheDocument();
    expect(within(groups).queryByText(/safeguarding/)).not.toBeInTheDocument();
    expect(within(groups).getByRole("link", { name: "Explore a community pilot" })).toHaveAttribute("href", "mailto:charlie@nuj.social?subject=Community%20pilot");

    const businesses = screen.getByRole("region", { name: "Give people a reason to meet at your venue." });
    expect(businesses).toHaveAttribute("id", "businesses");
    expect(within(businesses).getByText(/Join NUJ as a venue partner/)).toBeInTheDocument();
    expect(within(businesses).getByText(/Venue offers are not live yet/)).toBeInTheDocument();
    expect(within(businesses).getByRole("link", { name: "Join NUJ as a venue" })).toHaveAttribute("href", "mailto:charlie@nuj.social?subject=Venue%20pilot");
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
