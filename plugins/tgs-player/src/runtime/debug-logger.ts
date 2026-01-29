export const DEBUG_LOGGER_CODE = `
const DebugLogger = {
  enabled: (function() {
    if (typeof window === 'undefined') return false;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('TGS_DEBUG');
        if (stored === 'true') {
          window.TGS_DEBUG = true;
          return true;
        }
      }
    } catch (e) { /* localStorage may be blocked */ }
    return window.TGS_DEBUG === true;
  })(),
  
  setEnabled(value) {
    this.enabled = value;
    if (typeof window !== 'undefined') {
      window.TGS_DEBUG = value;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('TGS_DEBUG', value ? 'true' : 'false');
      }
    } catch (e) { /* localStorage may be blocked */ }
    console.log('[TGS:DEBUG] Logging ' + (value ? 'ENABLED' : 'DISABLED') + ' (persisted to localStorage)');
  },
  
  log(prefix, message, data) {
    if (!this.enabled) return;
    const timestamp = performance.now().toFixed(2);
    console.log('[TGS:' + prefix + ':' + timestamp + 'ms]', message, data !== undefined ? data : '');
  },
  
  warn(prefix, message, data) {
    const timestamp = performance.now().toFixed(2);
    console.warn('[TGS:' + prefix + ':' + timestamp + 'ms]', message, data !== undefined ? data : '');
  },
  
  feature(featureName, status, details) {
    if (!this.enabled) return;
    const symbol = status === 'supported' ? '✓' : (status === 'partial' ? '⚠' : '✗');
    console.log('[TGS:FEATURE] ' + symbol + ' ' + featureName, details !== undefined ? details : '');
  },
  
  path(label, pathData) {
    if (!this.enabled) return;
    if (!pathData) {
      console.log('[TGS:PATH] ' + label + ': NULL');
      return;
    }
    console.log('[TGS:PATH] ' + label + ':', {
      vertices: pathData.v ? pathData.v.slice(0, 3) : 'missing',
      vertexCount: pathData.v ? pathData.v.length : 0,
      closed: pathData.c,
      inHandles: pathData.i ? pathData.i.slice(0, 2) : 'missing',
      outHandles: pathData.o ? pathData.o.slice(0, 2) : 'missing'
    });
  },
  
  transform(label, transform) {
    if (!this.enabled) return;
    console.log('[TGS:TRANSFORM] ' + label + ':', transform);
  }
};

/* Auto-enable on load if persisted */
if (typeof window !== 'undefined' && DebugLogger.enabled) {
  console.log('[TGS:DEBUG] Auto-enabled from localStorage');
}
`;
