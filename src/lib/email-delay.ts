export function getRandomDelay(): number {
  return Math.floor(Math.random() * (180 - 45 + 1)) + 45;
}

export async function delay(ms = getRandomDelay() * 1000): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, ms));
}
