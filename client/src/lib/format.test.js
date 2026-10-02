import { ago, annualize, hashOf, initials, money, salaryText } from "./format";
import { canonicalSkill } from "./skills";
import { matchRoute } from "../hooks/useRouter";

test("money and salary text", () => {
  expect(money(153200, "USD")).toBe("$153.2K");
  expect(money(153200, "USD", { compact: false })).toBe("$153,200");
  expect(money(45.5, "USD")).toBe("$45.50");
  expect(salaryText({ min: 50, max: 60, currency: "USD", period: "hour" })).toBe("$50–$60/hr");
  expect(salaryText({ min: null, max: 90000, currency: "USD", period: "year" })).toBe("Up to $90K/yr");
  expect(salaryText({ min: 90000, max: null, currency: "GBP", period: "year" })).toBe("From £90K/yr");
});

test("annualize", () => {
  expect(annualize({ min: 50, max: 60, period: "hour", currency: "USD" })).toEqual({ min: 104000, max: 124800, mid: 114400, currency: "USD" });
  expect(annualize(null)).toBeNull();
});

test("relative time, initials, hashing", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  expect(ago("2026-09-30T12:00:00Z", now)).toBe("yesterday");
  expect(ago("2026-10-01T11:59:30Z", now)).toBe("just now");
  expect(initials("General Motors Corporation")).toBe("GM");
  expect(initials("The Walt Disney Company")).toBe("WD");
  expect(hashOf({ a: 1 })).toBe(hashOf({ a: 1 }));
  expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
});

test("skill aliases", () => {
  expect(canonicalSkill("reactjs")).toBe("React");
  expect(canonicalSkill("postgres")).toBe("PostgreSQL");
  expect(canonicalSkill("Figma")).toBe("Figma");
  expect(canonicalSkill("Basket weaving")).toBe("Basket weaving");
});

test("routes", () => {
  expect(matchRoute("/")).toEqual({ name: "hunt" });
  expect(matchRoute("/search/6abe7440310ff9f28e467b3e")).toEqual({ name: "hunt", searchId: "6abe7440310ff9f28e467b3e" });
  expect(matchRoute("/job/6abe7440310ff9f28e467b3e/")).toEqual({ name: "job", jobId: "6abe7440310ff9f28e467b3e" });
  expect(matchRoute("/tracker")).toEqual({ name: "tracker" });
  expect(matchRoute("/nope")).toEqual({ name: "notFound" });
});
