// Demo data for the stories, matching the critical-user-journey boards. Everything is fixed (a
// seeded generator, a fixed "now"), so stories render the same every time and tests can rely on it.
import type { DirectoryLink, Link } from "../lib/links";
import type { DailyUses, LinkChange } from "../lib/usage";

export const NOW = new Date("2026-11-17T15:00:00Z");
export const ME = "dev@example.com";
export const HOST = "go.example.com";

const at = (iso: string) => new Date(iso).toISOString();
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();

export const directory: DirectoryLink[] = [
  { slug: "q4", url: "https://docs.example.com/planning/2026/q4-planning", description: "Q4 planning", owner: ME, updated: minutesAgo(0) },
  { slug: "bug", url: "https://tracker.example.com/browse/{*}", description: "Open a ticket by key", owner: "sam@example.com", updated: at("2026-07-02T10:00:00Z") },
  { slug: "roadmap", url: "https://docs.example.com/product/plans/roadmap-2027#q1", description: "Product roadmap, 2027", owner: "maya@example.com", updated: minutesAgo(2 * 24 * 60 + 30) },
  { slug: "oncall", url: "https://pager.example.com/teams/platform/schedules/sre", description: "Who’s on call right now", owner: ME, updated: at("2026-10-28T09:00:00Z") },
  { slug: "standup", url: "https://meet.example.com/rooms/eng/daily", description: "Daily standup room", owner: "priya@example.com", updated: at("2026-09-09T09:00:00Z") },
  { slug: "deploy", url: "https://deploy.example.com/org/acme/projects", description: "Deploy dashboard", owner: "lee@example.com", updated: at("2026-11-03T09:00:00Z") },
  { slug: "handbook", url: "https://wiki.example.com/eng/team/handbook", description: "Engineering handbook", owner: "lee@example.com", updated: at("2026-08-14T09:00:00Z") },
  { slug: "pto", url: "https://hr.example.com/people/me/time-off", description: "Request time off", owner: "maya@example.com", updated: at("2026-03-01T09:00:00Z") },
];

export const similar: Link[] = [
  { slug: "oncall", url: "https://pager.example.com/teams/platform/schedules/sre", description: "Who’s on call right now" },
  { slug: "sre", url: "https://wiki.example.com/eng/teams/sre", description: "SRE team home" },
  { slug: "oncall-runbooks", url: "https://wiki.example.com/eng/sre/runbooks", description: "Runbooks for paged alerts" },
];

/** What a common stem matches on a big server: fifty names a letter or two apart. */
export const manySimilar: Link[] = Array.from({ length: 50 }, (_, i) => {
  const team = ["sre", "infra", "data", "web", "mobile"][i % 5]!;
  const n = Math.floor(i / 5) + 1;
  return { slug: `oncall-${team}-${n}`, url: `https://pager.example.com/teams/${team}/schedules/${n}`, description: `On call for ${team}, rotation ${n}` };
});

export const roadmap: Link & { created: string; changed: string } = {
  slug: "roadmap",
  url: "https://docs.example.com/product/plans/roadmap-2027#q1",
  description: "Product roadmap, 2027",
  owner: "maya@example.com",
  created: "2026-03-04T10:00:00Z",
  changed: "2026-11-15T10:00:00Z",
};

export const roadmapChanges: LinkChange[] = [
  { n: 3, date: "2026-11-15", what: "Destination changed", by: "maya@", before: "https://docs.example.com/product/plans/roadmap-2027", after: "https://docs.example.com/product/plans/roadmap-2027#q1" },
  { n: 2, date: "2026-10-22", what: "Description changed", by: "lee@", before: "Product roadmap", after: "Product roadmap, 2027" },
  { n: 1, date: "2026-09-09", what: "Destination changed", by: "maya@", before: "https://docs.example.com/product/plans/roadmap-2026", after: "https://docs.example.com/product/plans/roadmap-2027" },
];

/** 180 days of uses up to NOW: quiet weekends, a jump after the 2027 roadmap went in on Sep 9. */
export const roadmapUses: DailyUses[] = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const end = Date.UTC(2026, 10, 17);
  const out: DailyUses[] = [];
  for (let i = 179; i >= 0; i--) {
    const day = new Date(end - i * 86_400_000);
    const date = day.toISOString().slice(0, 10);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    const base = date < "2026-09-09" ? 24 : 42;
    const spike = date === "2026-09-09" ? 22 : date === "2026-09-10" ? 8 : 0;
    out.push({ date, uses: weekend ? Math.round(3 + rand() * 5) : Math.round(base + spike + (rand() - 0.4) * 16) });
  }
  return out;
})();
