export function parseLanguageId(header?: string, queryParam?: number): number {
  if (queryParam) return queryParam;
  if (!header) return 1;
  const parsed = parseInt(header, 10);
  return isNaN(parsed) ? 1 : parsed;
}
