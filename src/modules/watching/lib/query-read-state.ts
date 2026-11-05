/** A missing response is an error, not an empty collection. Cached data survives refetch errors. */
export interface ReadQuery {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}
export function queryReadState(queries: ReadQuery[]) {
  return {
    loading: queries.some(q => q.isLoading),
    blocked: queries.some(q => q.isError && q.data === undefined),
    stale: queries.some(q => q.isError && q.data !== undefined),
    retry: () => { void Promise.all(queries.filter(q => q.isError).map(q => q.refetch())); },
  };
}
