export async function holdMinDuration(startMs: number, minMs: number): Promise<void> {
  const remaining = minMs - (Date.now() - startMs)
  if (remaining > 0) {
    await new Promise<void>(resolve => setTimeout(resolve, remaining))
  }
}
