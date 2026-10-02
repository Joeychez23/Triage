import { render, screen, fireEvent } from "@testing-library/react";
import JobCard from "./JobCard";

const job = {
  id: "j1",
  title: "Senior React Engineer",
  company: "Acme Corp",
  location: "Austin, TX",
  source: "linkedin",
  alsoOn: [{ source: "glassdoor", url: "https://example.com" }],
  postedAt: new Date().toISOString(),
  salary: { min: 150000, max: 180000, currency: "USD", period: "year", source: "employer" },
  analysis: { arrangement: "remote", seniority: "senior", years: "5_7", sponsorship: "will_not", redFlags: 0.6 },
};

test("shows the X-ray chips, boards, and fit score", () => {
  const onSelect = jest.fn();
  render(<JobCard job={job} scored={{ score: 82, hit: false, dealbreakers: [] }} onSelect={onSelect} profileReady />);
  expect(screen.getByText("Senior React Engineer")).toBeInTheDocument();
  expect(screen.getByText("Remote")).toBeInTheDocument();
  expect(screen.getByText("5–7 years")).toBeInTheDocument();
  expect(screen.getByText("No sponsorship")).toBeInTheDocument();
  expect(screen.getByText("Red flags")).toBeInTheDocument();
  expect(screen.getByText("$150K–$180K/yr")).toBeInTheDocument();
  expect(screen.getByText("Glassdoor")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Fit 82 out of 100, Strong fit/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Senior React Engineer at Acme Corp/ }));
  expect(onSelect).toHaveBeenCalledWith("j1");
});

test("flags a dealbreaker", () => {
  render(<JobCard job={job} scored={{ score: 20, hit: true, dealbreakers: [{ text: "Requires on-call", p: 0.9 }] }} onSelect={() => {}} profileReady />);
  expect(screen.getByText(/Dealbreaker: Requires on-call/)).toBeInTheDocument();
});
