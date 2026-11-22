import moment from 'moment';

/** A grid row: [left, right]. */
export type ServiceRow<T> = [T | null, T | null];

/** True when the service's `serviceDate` (YYYY-MM-DD) falls on a Sunday. */
export function isSundayService(svc: { serviceDate: string }): boolean {
  return moment(svc.serviceDate, 'YYYY-MM-DD').day() === 0;
}

/**
 * Places Sunday services in the right cell and non-Sunday services in the left cell.
 * A Sunday pairs with the latest pending non-Sunday before it; other non-Sundays get
 * their own row with an empty right cell. Input must already be sorted by date.
 */
export function buildServiceRows<T extends { serviceDate: string }>(
  services: T[]
): ServiceRow<T>[] {
  const rows: ServiceRow<T>[] = [];
  let pending: T | null = null;
  for (const svc of services) {
    if (isSundayService(svc)) {
      rows.push([pending, svc]);
      pending = null;
    } else {
      if (pending) rows.push([pending, null]);
      pending = svc;
    }
  }
  if (pending) rows.push([pending, null]);
  return rows;
}
