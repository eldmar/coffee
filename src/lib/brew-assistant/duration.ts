/**
 * One way to write a brew time, whatever the method counts in.
 *
 * Everything inside the assistant stores seconds, but a cold steep is most of a
 * day and "86400 sec" is not something anybody recognises as sixteen hours.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  if (seconds >= 3600) {
    const hours = seconds / 3600;
    const rounded = Math.round(hours * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`;
  }
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
  }
  return `${Math.round(seconds)} sec`;
}

/** A window written with one unit rather than repeating it on both ends. */
export function formatDurationRange(min: number, max: number): string {
  if (min >= 3600 || max >= 3600) {
    const toHours = (value: number) => Math.round((value / 3600) * 10) / 10;
    return `${toHours(min)}\u2013${toHours(max)} hours`;
  }
  if (max >= 60) return `${formatDuration(min)}\u2013${formatDuration(max)}`;
  return `${min}\u2013${max} sec`;
}
