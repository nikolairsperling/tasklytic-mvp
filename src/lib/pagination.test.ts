import { describe, expect, it } from "vitest";
import { buildPagination, getCompactPaginationPages, parsePaginationParams, parseProspectPaginationParams } from "@/lib/pagination";

describe("pagination", () => {
  it("uses page 1 and limit 10 by default", () => {
    expect(parsePaginationParams(new URLSearchParams())).toEqual({
      page: 1,
      limit: 10,
      skip: 0,
      take: 10
    });
  });

  it("calculates page 2 offset for the next 10 results", () => {
    expect(parsePaginationParams(new URLSearchParams("page=2&limit=10"))).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
      take: 10
    });
  });

  it("calculates totalPages correctly", () => {
    expect(buildPagination(1, 10, 21)).toEqual({
      page: 1,
      limit: 10,
      total: 21,
      totalPages: 3
    });
  });

  it("uses 50 prospects per page by default", () => {
    expect(parseProspectPaginationParams(new URLSearchParams())).toEqual({
      page: 1,
      limit: 50,
      skip: 0,
      take: 50
    });
  });

  it("supports 20, 50, 100 and 150 prospects per page", () => {
    expect(parseProspectPaginationParams(new URLSearchParams("page=1&limit=20")).limit).toBe(20);
    expect(parseProspectPaginationParams(new URLSearchParams("page=1&limit=50")).limit).toBe(50);
    expect(parseProspectPaginationParams(new URLSearchParams("page=1&limit=100")).limit).toBe(100);
    expect(parseProspectPaginationParams(new URLSearchParams("page=1&limit=150")).limit).toBe(150);
  });

  it("resets invalid prospect limits to 50", () => {
    expect(parseProspectPaginationParams(new URLSearchParams("limit=10")).limit).toBe(50);
    expect(parseProspectPaginationParams(new URLSearchParams("limit=200")).limit).toBe(50);
    expect(parseProspectPaginationParams(new URLSearchParams("limit=abc")).limit).toBe(50);
  });

  it("calculates prospect totalPages from the selected limit", () => {
    expect(buildPagination(1, 50, 503)).toEqual({
      page: 1,
      limit: 50,
      total: 503,
      totalPages: 11
    });
    expect(buildPagination(1, 100, 503).totalPages).toBe(6);
    expect(buildPagination(1, 150, 503).totalPages).toBe(4);
  });

  it("shows compact pages at the beginning", () => {
    expect(getCompactPaginationPages(1, 50)).toEqual([1, 2, 3, 4, 5, "ellipsis", 50]);
  });

  it("shows compact pages around the current middle page", () => {
    expect(getCompactPaginationPages(10, 50)).toEqual([1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 50]);
  });
});
