export const TRIM_PATHS_CODE = `
const TrimPaths = {
  apply(pathElement, trimStart, trimEnd, trimOffset) {
    DebugLogger.log('TRIM', 'Applying trim', { start: trimStart, end: trimEnd, offset: trimOffset });
    
    /* Convert offset from degrees to percentage (lottie uses 0-360 degrees) */
    const offsetPercent = (trimOffset % 360) / 360 * 100;
    
    /* Normalize start/end with offset - handle 100% correctly (don't wrap to 0) */
    let rawS = trimStart + offsetPercent;
    let rawE = trimEnd + offsetPercent;
    /* Only apply modulo if > 100, preserve 100% as 1.0 */
    let s = rawS > 100 ? (rawS % 100) / 100 : rawS / 100;
    let e = rawE > 100 ? (rawE % 100) / 100 : rawE / 100;
    if (s < 0) s += 1;
    if (e < 0) e += 1;
    
    /* Swap if start > end (like lottie-web) */
    if (s > e) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    
    /* Round to avoid floating point issues (like lottie-web) */
    s = Math.round(s * 10000) * 0.0001;
    e = Math.round(e * 10000) * 0.0001;
    
    const totalLength = pathElement.getTotalLength();
    
    /* Full path - no trim needed */
    if ((s === 0 && e === 1) || (s === 1 && e === 0)) {
      pathElement.removeAttribute('stroke-dasharray');
      pathElement.removeAttribute('stroke-dashoffset');
      return;
    }
    
    /* Empty path - use zero-length dash instead of visibility:hidden */
    if (s === e) {
      pathElement.setAttribute('stroke-dasharray', '0 ' + totalLength);
      pathElement.setAttribute('stroke-dashoffset', '0');
      return;
    }
    
    const startLength = totalLength * s;
    const endLength = totalLength * e;
    const dashLength = endLength - startLength;
    
    pathElement.setAttribute('stroke-dasharray', dashLength + ' ' + totalLength);
    pathElement.setAttribute('stroke-dashoffset', -startLength);
  },
  
  findTrimShape(shapes) {
    for (let i = 0; i < shapes.length; i++) {
      if (shapes[i].ty === 'tm') {
        return shapes[i];
      }
    }
    return null;
  }
};
`;
