/** Express route/query values may be typed as string | string[]. Normalize to a single string. */
export function pathParam(value: string | string[] | undefined): string {
  if (value == null) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}
