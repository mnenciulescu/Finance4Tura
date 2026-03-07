/**
 * Expands a date range into individual ISO-date strings using UTC arithmetic.
 * @param {string} startDate  ISO date string (YYYY-MM-DD)
 * @param {string} endDate    ISO date string (YYYY-MM-DD), inclusive
 * @param {"daily"|"weekly"|"monthly"} frequency
 * @returns {string[]}
 */
export function expandDates(startDate, endDate, frequency) {
  const dates = [];
  let current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));

    if (frequency === "daily") {
      current = new Date(current.getTime() + 86_400_000);
    } else if (frequency === "weekly") {
      current = new Date(current.getTime() + 7 * 86_400_000);
    } else if (frequency === "monthly") {
      const next = new Date(current);
      next.setUTCMonth(next.getUTCMonth() + 1);
      current = next;
    } else {
      break;
    }
  }

  return dates;
}
