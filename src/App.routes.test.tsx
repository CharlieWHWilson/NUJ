import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HomeRoute } from "./App";

describe("HomeRoute", () => {
  it("redirects unauthenticated users from / to /auth", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomeRoute authState="unauthenticated" />} />
          <Route path="/auth" element={<div>Auth Page</div>} />
          <Route path="/check-in" element={<div>Check-In Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Auth Page")).toBeInTheDocument();
  });

  it("redirects authenticated users from / to /check-in", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomeRoute authState="authenticated" />} />
          <Route path="/auth" element={<div>Auth Page</div>} />
          <Route path="/check-in" element={<div>Check-In Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Check-In Page")).toBeInTheDocument();
  });

  it("shows loading while auth state is loading", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomeRoute authState="loading" />} />
          <Route path="/auth" element={<div>Auth Page</div>} />
          <Route path="/check-in" element={<div>Check-In Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Loading authentication...")).toBeInTheDocument();
  });
});
