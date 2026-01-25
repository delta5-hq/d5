export function createSvgElement(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

export function createHtmlElement(tag, className) {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    return element;
}

export function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
}
