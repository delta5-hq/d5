/**
 * Spark-delay utilities for computing cumulative animation delays
 * so each child spark starts when the parent spark reaches the
 * corner of its L-shaped wire path.
 *
 * The CSS spark animation uses `ease-out` = cubic-bezier(0, 0, 0.58, 1).
 * We invert this timing function to compute arrival times.
 */

/**
 * Evaluate CSS cubic-bezier(0, 0, 0.58, 1) — "ease-out".
 *
 * Given a *time fraction* `t ∈ [0, 1]`, returns the *progress fraction* `p ∈ [0, 1]`.
 *
 * The bezier is defined parametrically with control points
 *   P0 = (0, 0), P1 = (0, 0), P2 = (0.58, 1), P3 = (1, 1)
 *
 *   X(u) = 1.74 u² − 0.74 u³          (time)
 *   Y(u) = 3 u²   − 2 u³              (progress)
 *
 * We binary-search for `u` such that X(u) = t, then return Y(u).
 */
export function easeOutProgress(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1

  // Binary-search for parameter u where X(u) = t  (20 iterations ≈ 1e-6 precision)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    const x = 1.74 * mid * mid - 0.74 * mid * mid * mid
    if (x < t) lo = mid
    else hi = mid
  }
  const u = (lo + hi) / 2
  return 3 * u * u - 2 * u * u * u
}

/**
 * Invert the ease-out timing function:
 * given a *progress fraction* `p`, return the *time fraction* `t`
 * at which the animation reaches that progress.
 */
export function invertEaseOut(progress: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1

  // Binary-search for t where easeOutProgress(t) = progress
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (easeOutProgress(mid) < progress) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Compute the time (ms) for a CSS ease-out spark to travel from the
 * start of its wire path to the *corner* (the bend from vertical to
 * horizontal).
 *
 * The spark travels the full L-path (vertical + horizontal) in
 * `sparkDurationMs` with ease-out timing. The corner is located at
 *
 *   cornerFraction = verticalLength / totalPathLength
 *
 * We invert the ease-out curve to find the time fraction where offset-distance
 * equals that fraction, then multiply by the spark duration.
 *
 * @param rowsFromParent  Number of tree rows between parent and this node
 * @param rowHeight       Height of each tree row (px)
 * @param indentPerLevel  Horizontal indent per depth (px)
 * @param wirePadding     Wire inset from column edge (px)
 * @param sparkDurationMs Duration of the spark-travel CSS animation (ms)
 */
export function computeCornerArrivalMs(
  rowsFromParent: number,
  rowHeight: number,
  indentPerLevel: number,
  wirePadding: number,
  sparkDurationMs: number,
): number {
  if (rowsFromParent <= 0) return 0

  const verticalLength = rowsFromParent * rowHeight
  const horizontalLength = indentPerLevel - 2 * wirePadding
  if (horizontalLength <= 0) return 0

  const totalLength = verticalLength + horizontalLength
  const cornerFraction = verticalLength / totalLength

  const timeFraction = invertEaseOut(cornerFraction)
  return Math.round(timeFraction * sparkDurationMs)
}
