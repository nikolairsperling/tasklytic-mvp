export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PaginationItem = number | "ellipsis";

export type PaginatedResponse<T> = {
  data: T[];
  pagination: Pagination;
};

const defaultPage = 1;
const defaultLimit = 10;
const maxLimit = 100;

export const prospectsPageSizeOptions = [20, 50, 100, 150] as const;
export const defaultProspectsPageSize = 50;
export const maxProspectsPageSize = 150;
export const prospectsPageSizeStorageKey = "prospectsPageSize";

type PaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
  allowedLimits?: readonly number[];
};

export function parsePaginationParams(searchParams: URLSearchParams, options: PaginationOptions = {}) {
  const fallbackLimit = options.defaultLimit ?? defaultLimit;
  const highestLimit = options.maxLimit ?? maxLimit;
  const page = normalizePositiveInt(searchParams.get("page"), defaultPage);
  const limit = normalizeLimit(searchParams.get("limit"), fallbackLimit, highestLimit, options.allowedLimits);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit
  };
}

export function parseProspectPaginationParams(searchParams: URLSearchParams) {
  return parsePaginationParams(searchParams, {
    defaultLimit: defaultProspectsPageSize,
    maxLimit: maxProspectsPageSize,
    allowedLimits: prospectsPageSizeOptions
  });
}

export function normalizeProspectsPageSize(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return prospectsPageSizeOptions.some((option) => option === parsed) ? parsed : defaultProspectsPageSize;
}

export function buildPagination(page: number, limit: number, total: number): Pagination {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

export function getCompactPaginationPages(currentPage: number, totalPages: number): PaginationItem[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), total);
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis", total];
  }

  if (current >= total - 3) {
    return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "ellipsis", current - 2, current - 1, current, current + 1, current + 2, "ellipsis", total];
}

function normalizePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function normalizeLimit(value: string | null, fallback: number, maximum: number, allowedLimits?: readonly number[]) {
  const parsed = normalizePositiveInt(value, fallback);
  if (allowedLimits?.length) {
    return allowedLimits.some((allowed) => allowed === parsed) ? parsed : fallback;
  }
  return Math.min(parsed, maximum);
}
