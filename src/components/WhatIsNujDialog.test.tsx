import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WhatIsNujDialog } from "./WhatIsNujDialog";

const carousel = vi.hoisted(() => {
  const listeners = new Map<string, Set<(api: unknown) => void>>();
  let selected = 0;
  const move = (index: number) => {
    selected = Math.max(0, Math.min(5, index));
    listeners.get("select")?.forEach((listener) => listener(api));
  };
  const api = {
    selectedScrollSnap: () => selected,
    canScrollPrev: () => selected > 0,
    canScrollNext: () => selected < 5,
    scrollPrev: () => move(selected - 1),
    scrollNext: () => move(selected + 1),
    scrollTo: (index: number) => move(index),
    on(event: string, listener: (api: unknown) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return api;
    },
    off(event: string, listener: (api: unknown) => void) {
      listeners.get(event)?.delete(listener);
      return api;
    },
  };
  return { api, reset: () => { selected = 0; listeners.clear(); } };
});
vi.mock("embla-carousel-react", () => ({ default: () => [() => undefined, carousel.api] }));

function open() {
  render(<MemoryRouter><WhatIsNujDialog /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "What is NUJ?" }));
}

describe("What is NUJ carousel", () => {
  beforeEach(() => carousel.reset());

  it("opens on the first slide with six direct navigation dots and no autoplay", () => {
    open();
    expect(screen.getByRole("dialog", { name: "What is NUJ?" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stay connected" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Go to slide/ })).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 1 of 6");
    expect(screen.getByText("NUJ is the easy way to stay connected with mates. No pressure, guilt or obligation to send a message.")).toBeInTheDocument();
    expect(screen.getAllByText("👋").length).toBeGreaterThan(0);
    expect(screen.getAllByText("👍").length).toBeGreaterThan(0);
    expect(screen.getAllByText("👉").length).toBeGreaterThan(0);
  });

  it("opens the same carousel from a text-button trigger", () => {
    render(<MemoryRouter><WhatIsNujDialog trigger={<button type="button">What is NUJ?</button>} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "What is NUJ?" }));
    expect(screen.getByRole("region", { name: "About NUJ" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Go to slide/ })).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 5: Shared groups" }));
    expect(screen.getByRole("heading", { name: "Shared groups" })).toBeInTheDocument();
  });

  it("moves forward and backward using arrows and announces the active slide", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
    expect(screen.getByRole("heading", { name: "Check in" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 2 of 6");
    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(screen.getByRole("heading", { name: "Stay connected" })).toBeInTheDocument();
  });

  it("keeps contact available on every slide and returns to the current slide after closing it", () => {
    open();
    for (const button of screen.getAllByRole("button", { name: /Go to slide/ })) {
      fireEvent.click(button);
      expect(screen.getByRole("button", { name: "Get in touch" })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Get in touch" }));
    const contact = screen.getByRole("dialog", { name: "Get in touch" });
    expect(within(contact).getByText("charlie@nuj.social")).toBeInTheDocument();
    expect(within(contact).getByRole("link", { name: "Support" })).toHaveAttribute("href", "/support");
    fireEvent.click(within(contact).getByRole("button", { name: "Close" }));
    expect(screen.getByRole("heading", { name: "Gentle nudges" })).toBeInTheDocument();
  });

  it("explains shared-group joining and its separation from individual mates", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 5: Shared groups" }));
    expect(screen.getByRole("heading", { name: "Shared groups" })).toBeInTheDocument();
    expect(screen.getByText("Create a shared group and share a link or group code so your mates can join.")).toBeInTheDocument();
    expect(screen.getByText(/Joining a group doesn't automatically add individual mates/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to slide 5: Shared groups" })).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("heading", { name: "Stay connected" })).not.toBeInTheDocument();
  });

  it("supports keyboard navigation and a Done action on the last slide", () => {
    open();
    fireEvent.keyDown(screen.getByRole("region", { name: "About NUJ" }), { key: "ArrowRight" });
    expect(screen.getByRole("status")).toHaveTextContent("Slide 2 of 6");
    fireEvent.click(screen.getByRole("button", { name: "Go to slide 6: Gentle nudges" }));
    expect(screen.queryByRole("button", { name: "Next slide" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});