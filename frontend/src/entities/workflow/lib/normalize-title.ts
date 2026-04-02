/**
 * Normalizes a node title for display.
 * Returns the original title if it contains visible characters,
 * or empty string for undefined, empty, and whitespace-only values.
 */
export function normalizeNodeTitle(title: string | undefined): string {
  if (!title || !title.trim()) return ''
  return title
}
