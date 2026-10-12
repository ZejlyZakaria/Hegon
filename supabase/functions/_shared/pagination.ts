/** Complete PostgREST reads, using the same Range pattern as awards. Callers supply stable order. */
export async function fetchAllRows<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>, pageSize = 1000): Promise<T[]> {
  const out: T[] = [];
  // eslint-disable-next-line no-restricted-syntax -- Sequential pages of one complete read, not a request per item.
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}
