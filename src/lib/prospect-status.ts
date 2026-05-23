export const prospectStatuses = [
  "draft",
  "qualified",
  "landingpage_ready",
  "contacted",
  "responded",
  "disqualified"
] as const;

export type ProspectStatus = (typeof prospectStatuses)[number];

export function isProspectStatus(value: string): value is ProspectStatus {
  return prospectStatuses.includes(value as ProspectStatus);
}
