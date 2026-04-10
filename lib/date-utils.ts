export function getLocalISODate(timeZone?: string): string {
  const tz = timeZone || process.env.APP_TIMEZONE || 'America/Bahia';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().split('T')[0];
  }

  return `${year}-${month}-${day}`;
}

