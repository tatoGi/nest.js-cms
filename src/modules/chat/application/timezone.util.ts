// The business operates in a single, fixed-offset timezone (Georgia has had
// no DST since 2004), but this still resolves it properly via Intl rather
// than hardcoding "+04:00" — same env var as ChatGateway.isBusinessHours, so
// the two never drift apart.
//
// Read per call, never captured in a module-level constant: a constant would
// freeze whatever the environment happened to be at import time, which
// silently ignores any later change (tests overriding it in beforeEach, a
// config reload) and makes behavior depend on module load order.
export function getBusinessTimezone(): string {
  return process.env.BUSINESS_HOURS_TIMEZONE || 'Asia/Tbilisi';
}

// Converts a wall-clock date/time *as read in `timeZone`* into the UTC
// instant it actually represents. Standard Intl-based technique (what
// libraries like date-fns-tz do under the hood): format a guessed UTC
// instant back through the target timezone, measure the drift between what
// went in and what came out, and correct for it. Correct across DST
// transitions too, though this business's zone never has one.
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(utcGuess))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  // Intl can render midnight as "24" in hour12: false mode depending on the
  // runtime — normalize back to 0.
  const hourNum = Number(parts.hour) % 24;
  const asUtcOfLocalWallClock = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hourNum,
    Number(parts.minute),
    Number(parts.second),
    ms,
  );
  const offsetMs = asUtcOfLocalWallClock - utcGuess;
  return new Date(utcGuess - offsetMs);
}

const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

// Parses a `YYYY-MM-DD` or `YYYY-MM-DD HH:mm[:ss]` (or `T`-separated) string
// as `timeZone` wall-clock time and returns the equivalent UTC instant.
// `boundary` only matters when no time component is present — it decides
// whether a bare date means the start or end of that day, so `dateFrom`/
// `dateTo` bounds interpret consistently instead of one being UTC-midnight
// and the other being server-local-time (the original bug — see
// buildChatHistoryWhere). Bare-date input stays supported indefinitely
// (not just as a migration shim) since the date-only picker predates the
// datetime one and both remain valid input shapes.
export function parseTbilisiBound(
  raw: string,
  boundary: 'start' | 'end',
  timeZone: string = getBusinessTimezone(),
): Date {
  const match = DATE_TIME_RE.exec(raw.trim());
  if (!match) return new Date(raw);
  const [, y, mo, d, h, mi, s] = match;
  const hasTime = h !== undefined;
  const hour = hasTime ? Number(h) : boundary === 'start' ? 0 : 23;
  const minute = hasTime ? Number(mi) : boundary === 'start' ? 0 : 59;
  const second = hasTime ? Number(s ?? '0') : boundary === 'start' ? 0 : 59;
  const ms = hasTime ? 0 : boundary === 'start' ? 0 : 999;
  return zonedTimeToUtc(Number(y), Number(mo), Number(d), hour, minute, second, ms, timeZone);
}

// Shared by buildChatHistoryWhere and any other date-range filter that needs
// to interpret dateFrom/dateTo consistently as business-timezone wall-clock
// bounds rather than mixed UTC/server-local parsing.
export function resolveTbilisiRange(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  return {
    ...(dateFrom ? { gte: parseTbilisiBound(dateFrom, 'start') } : {}),
    ...(dateTo ? { lte: parseTbilisiBound(dateTo, 'end') } : {}),
  };
}

// For export/report display — formats a UTC Date as `DD/MM/YYYY HH:mm:ss`
// wall-clock time in `timeZone`, instead of relying on the server process's
// own OS timezone (Date#getHours() etc.), which is what produced the wrong
// hours in the original bug report.
export function formatInTbilisi(date: Date, timeZone: string = getBusinessTimezone()): string {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}
