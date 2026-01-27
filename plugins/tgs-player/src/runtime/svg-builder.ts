export const SVG_BUILDER_CODE = `
const SvgBuilder = {
  NS: 'http://www.w3.org/2000/svg',

  createSvg(width, height) {
    const svg = document.createElementNS(this.NS, 'svg');
    /* Lottie uses top-left origin (0,0), same as SVG default */
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'hidden';
    return svg;
  },

  createGroup() {
    return document.createElementNS(this.NS, 'g');
  },

  createPath() {
    return document.createElementNS(this.NS, 'path');
  },

  pathDataToString(pathData) {
    if (!pathData || !pathData.v || pathData.v.length === 0) return '';
    
    const v = pathData.v;
    const i = pathData.i;
    const o = pathData.o;
    const closed = pathData.c;

    const parts = ['M' + v[0][0] + ',' + v[0][1]];

    for (let j = 1; j < v.length; j++) {
      const prevOut = o[j - 1];
      const currIn = i[j];
      const curr = v[j];
      const prev = v[j - 1];
      
      parts.push(
        'C' + (prev[0] + prevOut[0]) + ',' + (prev[1] + prevOut[1]) +
        ' ' + (curr[0] + currIn[0]) + ',' + (curr[1] + currIn[1]) +
        ' ' + curr[0] + ',' + curr[1]
      );
    }

    if (closed && v.length > 1) {
      const lastOut = o[v.length - 1];
      const firstIn = i[0];
      const last = v[v.length - 1];
      const first = v[0];
      
      parts.push(
        'C' + (last[0] + lastOut[0]) + ',' + (last[1] + lastOut[1]) +
        ' ' + (first[0] + firstIn[0]) + ',' + (first[1] + firstIn[1]) +
        ' ' + first[0] + ',' + first[1] + 'Z'
      );
    }

    return parts.join(' ');
  },

  applyTransform(element, transform) {
    /* Lottie matrix build order:
     * M = pre * translate(-a) * scale(s) * rotate(-r) * translate(p)
     * Point transformation: p' = M * p
     * Effective order on point: -anchor → scale → rotate → position
     * 
     * SVG transform="A B C" applies A(B(C(point))), i.e., C first, A last.
     * So we need: translate(p), rotate(r), scale(s), translate(-a)
     * Note: Keeping rotation POSITIVE - the negation in lottie is internal to matrix math
     */
    
    /* Format number to avoid scientific notation and NaN */
    const fmt = (n) => {
      if (!Number.isFinite(n)) return 0;
      return Math.round(n * 1000) / 1000;
    };
    
    const px = fmt(transform.position ? transform.position[0] : 0);
    const py = fmt(transform.position ? transform.position[1] : 0);
    const ax = fmt(transform.anchor ? transform.anchor[0] : 0);
    const ay = fmt(transform.anchor ? transform.anchor[1] : 0);
    const r = fmt(transform.rotation || 0);
    const sx = fmt(transform.scale ? transform.scale[0] / 100 : 1);
    const sy = fmt(transform.scale ? transform.scale[1] / 100 : 1);
    
    const parts = [];
    
    /* Order: position last (outermost), anchor first (innermost) */
    parts.push('translate(' + px + ',' + py + ')');
    
    if (r !== 0) {
      parts.push('rotate(' + r + ')');
    }
    
    if (sx !== 1 || sy !== 1) {
      parts.push('scale(' + sx + ',' + sy + ')');
    }
    
    if (ax !== 0 || ay !== 0) {
      parts.push('translate(' + (-ax) + ',' + (-ay) + ')');
    }

    if (parts.length > 0) {
      element.setAttribute('transform', parts.join(' '));
    } else {
      element.removeAttribute('transform');
    }
    
    if (transform.opacity !== undefined) {
      const opacity = Math.max(0, Math.min(100, transform.opacity)) / 100;
      if (opacity < 1) {
        element.setAttribute('opacity', opacity);
      } else {
        element.removeAttribute('opacity');
      }
    }
  },

  rgbToString(color) {
    /* If already pre-computed string, use directly */
    if (typeof color === 'string') return color;
    const r = Math.round(Math.max(0, Math.min(1, color[0])) * 255);
    const g = Math.round(Math.max(0, Math.min(1, color[1])) * 255);
    const b = Math.round(Math.max(0, Math.min(1, color[2])) * 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  applyFill(element, color, opacity) {
    if (color) {
      /* Pre-computed string or array - rgbToString handles both */
      element.setAttribute('fill', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('fill-opacity', op);
    }
  },

  applyStroke(element, color, opacity, width, lineCap, lineJoin) {
    /* Do not set fill here - fill is managed separately */
    
    if (color) {
      /* Pre-computed string or array - rgbToString handles both */
      element.setAttribute('stroke', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('stroke-opacity', op);
    }
    if (width !== undefined && width > 0) {
      element.setAttribute('stroke-width', width);
      /* Lottie renders stroke under fill - use paint-order to match */
      element.setAttribute('paint-order', 'stroke');
    }
    /* lc: 1=butt, 2=round, 3=square */
    const capMap = { 1: 'butt', 2: 'round', 3: 'square' };
    element.setAttribute('stroke-linecap', capMap[lineCap] || 'round');
    /* lj: 1=miter, 2=round, 3=bevel */
    const joinMap = { 1: 'miter', 2: 'round', 3: 'bevel' };
    element.setAttribute('stroke-linejoin', joinMap[lineJoin] || 'round');
  },

  createClipPath(id, width, height) {
    const clipPath = document.createElementNS(this.NS, 'clipPath');
    clipPath.setAttribute('id', id);
    const rect = document.createElementNS(this.NS, 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    clipPath.appendChild(rect);
    return clipPath;
  },

  createDefs() {
    return document.createElementNS(this.NS, 'defs');
  },

  applyClipPath(element, clipId) {
    element.setAttribute('clip-path', 'url(#' + clipId + ')');
  }
};
`;
