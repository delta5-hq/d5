export const NODE_TYPE = {
    FOLDER: 'folder',
    FILE: 'file'
};

export function createNodeData(label, type = NODE_TYPE.FILE, children = []) {
    return {
        label,
        type,
        expanded: type === NODE_TYPE.FOLDER,
        children
    };
}

export function createFolderData(label, children = []) {
    return createNodeData(label, NODE_TYPE.FOLDER, children);
}

export function createFileData(label) {
    return createNodeData(label, NODE_TYPE.FILE, []);
}
