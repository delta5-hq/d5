export function buildLPath(startX, startY, cornerX, cornerY, endX, endY) {
    return `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${endX} ${endY}`;
}

export function buildVerticalThenHorizontalL(height, width, padding = 0) {
    const startX = padding;
    const startY = padding;
    const cornerX = padding;
    const cornerY = padding + height;
    const endX = padding + width;
    const endY = padding + height;
    return buildLPath(startX, startY, cornerX, cornerY, endX, endY);
}
