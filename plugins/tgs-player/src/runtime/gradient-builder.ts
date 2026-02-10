export const GRADIENT_BUILDER_CODE = `
const GradientBuilder = {
  gradientCounter: 0,
  
  /* Create gradient element once during build phase */
  createGradientElement(svg, gradientShape, gradientId) {
    const isRadial = gradientShape.t === 2;
    
    const gradient = document.createElementNS(SvgBuilder.NS, isRadial ? 'radialGradient' : 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
    
    /* Create stop elements based on color count */
    const colorCount = gradientShape.g ? gradientShape.g.p : 0;
    for (let i = 0; i < colorCount; i++) {
      const stop = document.createElementNS(SvgBuilder.NS, 'stop');
      stop.setAttribute('data-index', i);
      gradient.appendChild(stop);
    }
    
    let defs = svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS(SvgBuilder.NS, 'defs');
      svg.insertBefore(defs, svg.firstChild);
    }
    defs.appendChild(gradient);
    
    return gradient;
  },
  
  /* Update gradient properties per frame */
  updateGradient(gradientElement, gradientShape, frame) {
    const isRadial = gradientShape.t === 2;
    
    if (!isRadial && gradientShape.s && gradientShape.e) {
      const start = Interpolator.interpolateProperty(gradientShape.s, frame);
      const end = Interpolator.interpolateProperty(gradientShape.e, frame);
      gradientElement.setAttribute('x1', start[0]);
      gradientElement.setAttribute('y1', start[1]);
      gradientElement.setAttribute('x2', end[0]);
      gradientElement.setAttribute('y2', end[1]);
    }
    
    if (isRadial && gradientShape.s) {
      const center = Interpolator.interpolateProperty(gradientShape.s, frame);
      gradientElement.setAttribute('cx', center[0]);
      gradientElement.setAttribute('cy', center[1]);
      
      if (gradientShape.e) {
        const endPoint = Interpolator.interpolateProperty(gradientShape.e, frame);
        const dx = endPoint[0] - center[0];
        const dy = endPoint[1] - center[1];
        const radius = Math.sqrt(dx * dx + dy * dy);
        gradientElement.setAttribute('r', radius > 0 ? radius : 256);
      } else {
        gradientElement.setAttribute('r', '256');
      }
      
      if (gradientShape.h && gradientShape.a) {
        const highlightLength = Interpolator.interpolateProperty(gradientShape.h, frame);
        const highlightAngle = Interpolator.interpolateProperty(gradientShape.a, frame);
        const angleRad = (highlightAngle * Math.PI) / 180;
        const fx = center[0] + Math.cos(angleRad) * highlightLength;
        const fy = center[1] + Math.sin(angleRad) * highlightLength;
        gradientElement.setAttribute('fx', fx);
        gradientElement.setAttribute('fy', fy);
      }
    }
    
    if (gradientShape.g && gradientShape.g.k) {
      const colors = Interpolator.interpolateProperty(gradientShape.g.k, frame);
      const colorCount = gradientShape.g.p;
      const stops = gradientElement.querySelectorAll('stop');
      
      /* Lottie gradient format: [colorStops][opacityStops]
       * Color stops: offset, r, g, b (4 values each)
       * Opacity stops: offset, opacity (2 values each, after color data) */
      const colorDataLen = colorCount * 4;
      const hasOpacity = colors.length > colorDataLen;
      
      for (let i = 0; i < colorCount && i < stops.length; i++) {
        const offset = colors[i * 4];
        const r = Math.round(colors[i * 4 + 1] * 255);
        const g = Math.round(colors[i * 4 + 2] * 255);
        const b = Math.round(colors[i * 4 + 3] * 255);
        
        /* Get opacity from separate opacity stops if present */
        let opacity = 1;
        if (hasOpacity) {
          const opacityIdx = colorDataLen + i * 2 + 1;
          if (opacityIdx < colors.length) {
            opacity = colors[opacityIdx];
          }
        }
        
        stops[i].setAttribute('offset', offset);
        stops[i].setAttribute('stop-color', 'rgb(' + r + ',' + g + ',' + b + ')');
        stops[i].setAttribute('stop-opacity', opacity);
      }
    }
  },
  
  generateId(prefix) {
    /* Use prefix (container ID) to ensure unique IDs across multiple players */
    return (prefix || 'g') + '_grad_' + (++this.gradientCounter);
  }
};
`;
