export type SavingsInput = {
  dispatchers: number;
  manualHoursPerWeek: number;
  hourlyRate: number;
};

export type SavingsResult = {
  yearlySavings: number;
  fte: number;
  yearlyHours: number;
};

export function calculateSavings({
  dispatchers,
  manualHoursPerWeek,
  hourlyRate
}: SavingsInput): SavingsResult {
  const yearlyHours = dispatchers * manualHoursPerWeek * 52;
  const yearlySavings = yearlyHours * hourlyRate;
  const fte = yearlyHours / 1760;

  return {
    yearlySavings,
    fte,
    yearlyHours
  };
}
