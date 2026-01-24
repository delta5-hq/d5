export const SVG_BUILDER_CODE = `
const SvgBuilder = {
  NS: 'http://www.w3.org/2000/svg',

  createSvg(width, height) {
    const svg = document.createElementNS(this.NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.overflow = 'visible';
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
    const parts = [];
    
    if (transform.anchor) {
      parts.push('translate(' + (-transform.anchor[0]) + ',' + (-transform.anchor[1]) + ')');
    }
    
    if (transform.position) {
      parts.push('translate(' + transform.position[0] + ',' + transform.position[1] + ')');
    }
    
    if (transform.rotation) {
      parts.push('rotate(' + transform.rotation + ')');
    }
    
    if (transform.scale) {
      const sx = transform.scale[0] / 100;
      const sy = transform.scale[1] / 100;
      if (sx !== 1 || sy !== 1) {
        parts.push('scale(' + sx + ',' + sy + ')');
      }
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
    const r = Math.round(Math.max(0, Math.min(1, color[0])) * 255);
    const g = Math.round(Math.max(0, Math.min(1, color[1])) * 255);
    const b = Math.round(Math.max(0, Math.min(1, color[2])) * 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  },

  applyFill(element, color, opacity) {
    if (color) {
      element.setAttribute('fill', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('fill-opacity', op);
    }
  },

  applyStroke(element, color, opacity, width) {
    element.setAttribute('fill', 'none');
    
    if (color) {
      element.setAttribute('stroke', this.rgbToString(color));
    }
    if (opacity !== undefined) {
      const op = Math.max(0, Math.min(100, opacity)) / 100;
      element.setAttribute('stroke-opacity', op);
    }
    if (width !== undefined && width > 0) {
      element.setAttribute('stroke-width', width);
    }
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
  }
};
`;
