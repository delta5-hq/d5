import { createHtmlElement } from './dom-utils.js';
import { NODE_TYPE } from './node-data.js';
import { createConnector } from './connector.js';

export function createTreeNode(nodeData, config = {}) {
    const { onSelect, onToggle, sparkConfig, depth = 0 } = config;
    
    const container = createHtmlElement('div', 'tree-node');
    const row = createHtmlElement('div', 'tree-node__row');
    
    const hasChildren = nodeData.children && nodeData.children.length > 0;
    const isFolder = nodeData.type === NODE_TYPE.FOLDER;
    
    const chevron = createHtmlElement('span', 'icon icon--chevron');
    if (!hasChildren) {
        chevron.classList.add('icon--chevron-hidden');
    } else if (nodeData.expanded) {
        chevron.classList.add('icon--chevron-expanded');
    }
    
    const icon = createHtmlElement('span', 'icon');
    if (isFolder) {
        icon.classList.add(nodeData.expanded ? 'icon--folder-open' : 'icon--folder');
    } else {
        icon.classList.add('icon--file');
    }
    
    const label = createHtmlElement('span', 'tree-node__label');
    label.textContent = nodeData.label;
    
    row.appendChild(chevron);
    row.appendChild(icon);
    row.appendChild(label);
    container.appendChild(row);
    
    let childrenContainer = null;
    let childNodes = [];
    let connectors = [];
    
    if (hasChildren) {
        childrenContainer = createHtmlElement('div', 'tree-node__children');
        if (!nodeData.expanded) {
            childrenContainer.classList.add('tree-node__children--collapsed');
        }
        
        nodeData.children.forEach((childData, index) => {
            const childWrapper = createHtmlElement('div', 'tree-node__child');
            
            const connector = createConnector(sparkConfig);
            connectors.push(connector);
            childWrapper.appendChild(connector.element);
            
            const childConfig = { ...config, depth: depth + 1 };
            const childNode = createTreeNode(childData, childConfig);
            childNodes.push(childNode);
            childWrapper.appendChild(childNode.element);
            
            childrenContainer.appendChild(childWrapper);
        });
        
        container.appendChild(childrenContainer);
    }
    
    function updateConnectorHeights() {
        if (!childrenContainer || !nodeData.expanded) return;
        
        const PADDING = 2;
        
        requestAnimationFrame(() => {
            const childrenRect = childrenContainer.getBoundingClientRect();
            
            connectors.forEach((connector, index) => {
                const childWrapper = childrenContainer.children[index];
                const childRow = childWrapper.querySelector('.tree-node__row');
                
                if (childRow) {
                    const wrapperRect = childWrapper.getBoundingClientRect();
                    const childRowRect = childRow.getBoundingClientRect();
                    
                    const topOffset = wrapperRect.top - childrenRect.top;
                    const rowCenterY = childRowRect.top + childRowRect.height / 2;
                    const height = rowCenterY - childrenRect.top - PADDING;
                    
                    connector.element.style.top = `-${topOffset}px`;
                    connector.setHeight(Math.max(height, 10));
                }
            });
        });
    }
    
    function toggle() {
        if (!hasChildren) return;
        
        nodeData.expanded = !nodeData.expanded;
        
        chevron.classList.toggle('icon--chevron-expanded', nodeData.expanded);
        icon.classList.remove('icon--folder', 'icon--folder-open');
        icon.classList.add(nodeData.expanded ? 'icon--folder-open' : 'icon--folder');
        
        if (childrenContainer) {
            childrenContainer.classList.toggle('tree-node__children--collapsed', !nodeData.expanded);
        }
        
        if (nodeData.expanded) {
            updateConnectorHeights();
            setTimeout(() => pulseConnectors(), 50);
        }
        
        if (onToggle) onToggle(nodeData);
    }
    
    function pulseConnectors() {
        connectors.forEach((connector, index) => {
            setTimeout(() => connector.pulse(), index * 100);
        });
    }
    
    chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
    });
    
    row.addEventListener('click', () => {
        if (onSelect) onSelect(nodeData);
    });
    
    row.addEventListener('dblclick', () => {
        toggle();
    });
    
    if (hasChildren && nodeData.expanded) {
        setTimeout(updateConnectorHeights, 0);
    }
    
    return {
        element: container,
        data: nodeData,
        childNodes,
        connectors,
        toggle,
        pulseConnectors,
        updateConnectorHeights,
        
        select() {
            row.classList.add('tree-node__row--selected');
        },
        
        deselect() {
            row.classList.remove('tree-node__row--selected');
        }
    };
}
