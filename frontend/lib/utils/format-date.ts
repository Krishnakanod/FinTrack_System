/**
 * Format a UTC ISO 8601 datetime string for display in Asia/Kolkata (IST).
 *
 * Storage rule: MongoDB stores all datetimes as UTC.
 * Display rule: convert UTC -> IST (+5:30) before showing to the user.
 *
 * @param isoString UTC ISO 8601 string (e.g. "2026-06-19T18:30:00.000Z")
 * @param mode 'date' -> "20 Jun 2026"; 'datetime' -> "20 Jun 2026, 12:00 AM"
 */
export function formatDateIST(
  isoString: string,
  mode: "date" | "datetime" = "date"
): string {
  const date = new Date(isoString);

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  };

  if (mode === "datetime") {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hour12 = true;
  }

  return new Intl.DateTimeFormat("en-IN", options).format(date);
}
