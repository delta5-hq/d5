import { createSvgElement, setAttributes } from './dom-utils.js';
import { buildVerticalThenHorizontalL } from './path-builder.js';

const DEFAULT_CONFIG = {
    height: 30,
    width: 60,
    strokeWidth: 2,
    padding: 5
};

export function createWire(config = {}) {
    const { height, width, strokeWidth, padding } = { ...DEFAULT_CONFIG, ...config };
    
    const totalWidth = width + padding * 2;
    const totalHeight = height + padding * 2;
    
    const svg = createSvgElement('svg');
    setAttributes(svg, {
        width: totalWidth,
        height: totalHeight,
        viewBox: `0 0 ${totalWidth} ${totalHeight}`
    });
    
    const pathData = buildVerticalThenHorizontalL(height, width, padding);
    
    const path = createSvgElement('path');
    path.classList.add('wire');
    setAttributes(path, {
        d: pathData
    });
    
    svg.appendChild(path);
    
    return {
        element: svg,
        path: path,
        pathData: pathData,
        dimensions: { width: totalWidth, height: totalHeight },
        padding: padding
    };
}
