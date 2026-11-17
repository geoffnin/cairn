import { describe, expect, it } from "vitest";
import { formatAgo, formatAgoLong, formatCount, formatDate, formatDay, formatFullDate, formatOwner, shortUrl } from "./format";

const now = new Date("2026-11-17T12:00:00Z");

describe("format", () => {
  it("counts", () => {
    expect(formatCount(1204)).toBe("1,204");
    expect(formatCount(0)).toBe("0");
  });

  it("dates, with the year only outside this one", () => {
    expect(formatDate("2026-11-15", now)).toBe("Nov 15");
    expect(formatDate("2025-03-04", now)).toBe("Mar 4, 2025");
    expect(formatFullDate("2026-03-04")).toBe("Mar 4, 2026");
    expect(formatDay("2026-10-22")).toBe("Thu, Oct 22");
  });

  it("how long ago", () => {
    const ago = (s: number) => new Date(now.getTime() - s * 1000);
    expect(formatAgo(ago(10), now)).toBe("just now");
    expect(formatAgo(ago(4 * 60), now)).toBe("4 min ago");
    expect(formatAgo(ago(3 * 3600), now)).toBe("3h ago");
    expect(formatAgo(ago(2 * 86400), now)).toBe("2d ago");
    expect(formatAgo("2026-07-02T09:00:00Z", now)).toBe("Jul 2");
    expect(formatAgoLong(ago(4 * 60), now)).toBe("4 minutes ago");
    expect(formatAgoLong(ago(3600), now)).toBe("1 hour ago");
  });

  it("owners", () => {
    expect(formatOwner("sam@example.com")).toBe("sam@");
    expect(formatOwner("Me@Example.com", "me@example.com")).toBe("you");
    expect(formatOwner(undefined)).toBe("");
  });

  it("short URLs elide the middle of long paths", () => {
    expect(shortUrl("https://docs.example.com/product/plans/q4-planning?x=1#a")).toBe("docs.example.com/…/q4-planning");
    expect(shortUrl("https://tracker.example.com/browse/{*}")).toBe("tracker.example.com/browse/{*}");
    expect(shortUrl("https://other.example.com/", { scheme: true })).toBe("https://other.example.com/");
    expect(shortUrl("https://example.com")).toBe("example.com");
    expect(shortUrl("mailto:a@example.com")).toBe("mailto:a@example.com");
  });
});
