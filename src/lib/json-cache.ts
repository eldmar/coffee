/**
 * A JSON file fetched once per page and shared by every island that wants it.
 *
 * Several widgets now read their data from static files rather than carrying
 * it as island props, which keeps it out of the HTML and lets the browser
 * cache it across pages. They all need the same small thing: one request per
 * page no matter how many components ask, and a cache that clears itself on
 * failure so a later mount can retry.
 *
 * Callers decide what a failure means. This rejects; a widget that should just
 * render nothing catches and substitutes an empty value, while one that owns
 * its whole page surfaces an error state.
 */
export interface JsonCache<T> {
  load: () => Promise<T>;
  /** Test seam: drops the cached request so each case starts from a clean slate. */
  reset: () => void;
}

export function cachedJson<T>(url: string): JsonCache<T> {
  let pending: Promise<T> | undefined;

  return {
    load() {
      pending ??= fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`${url} returned ${response.status}`);
          return response.json() as Promise<T>;
        })
        .catch((error: unknown) => {
          pending = undefined;
          throw error;
        });

      return pending;
    },
    reset() {
      pending = undefined;
    },
  };
}
