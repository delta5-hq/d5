import { createHtmlElement } from './dom-utils.js';
import { createTreeNode } from './tree-node.js';

export function createTree(rootData, config = {}) {
    const container = createHtmlElement('div', 'tree');
    
    let selectedNode = null;
    
    const treeConfig = {
        ...config,
        onSelect: (nodeData) => {
            if (selectedNode) {
                selectedNode.deselect();
            }
            const node = findNodeByData(rootNode, nodeData);
            if (node) {
                node.select();
                selectedNode = node;
            }
            if (config.onSelect) config.onSelect(nodeData);
        },
        sparkConfig: config.spark || { duration: 400, easing: 'ease-out' }
    };
    
    const rootNode = createTreeNode(rootData, treeConfig);
    container.appendChild(rootNode.element);
    
    function findNodeByData(node, data) {
        if (node.data === data) return node;
        for (const child of node.childNodes) {
            const found = findNodeByData(child, data);
            if (found) return found;
        }
        return null;
    }
    
    return {
        element: container,
        rootNode,
        
        getSelectedData() {
            return selectedNode ? selectedNode.data : null;
        }
    };
}
