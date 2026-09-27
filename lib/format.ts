// Naira formatting. DB stores integer kobo (1 ₦ = 100 kobo).

const ngn0 = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function koboToNaira(kobo: bigint | number): number {
  return Number(kobo) / 100;
}

export function formatKobo(kobo: bigint | number): string {
  return ngn0.format(koboToNaira(kobo)).replace("NGN", "₦").trim();
}

export function parseNairaToKobo(input: string): bigint {
  const digits = input.replace(/[^0-9]/g, "");
  if (!digits) throw new Error("Enter an amount in naira");
  return BigInt(digits) * 100n;
}
