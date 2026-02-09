import type { CSSProperties, ReactNode } from 'react'
import type { TreeNode, TreeNodeCallbacks } from '../core/types'
import type { SegmentContainer } from '../segments/types'
import { TreeNodeDefault } from './tree-node-default'

export interface ContainerRendererProps extends TreeNodeCallbacks {
  container: SegmentContainer
  rowHeight: number
  style: CSSProperties
  selectedId?: string
  autoEditNodeId?: string
}

const DefaultContainerWrapper = ({ children }: { children: ReactNode }) => (
  <div className="rounded-md border border-border/50 bg-accent/5">{children}</div>
)

export const ContainerRenderer = ({
  container,
  rowHeight,
  style,
  onToggle,
  selectedId,
  onSelect,
  onAddChild,
  onRequestDelete,
  onDuplicateNode,
  onRename,
  onRequestRename,
  autoEditNodeId,
}: ContainerRendererProps) => {
  const ContainerComponent = container.config.component || DefaultContainerWrapper
  const paddingTop = container.config.paddingTop ?? 8
  const paddingBottom = container.config.paddingBottom ?? 8
  const parentNode = container.parentTreeNode
  const childCount = container.children.length

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: `${rowHeight}px` }}>
        <TreeNodeDefault
          autoEditNodeId={autoEditNodeId}
          data={parentNode}
          id={parentNode.id}
          isOpen={parentNode.isOpen}
          isSelected={parentNode.id === selectedId}
          onAddChild={onAddChild}
          onDuplicateNode={onDuplicateNode}
          onRename={onRename}
          onRequestDelete={onRequestDelete}
          onRequestRename={onRequestRename}
          onSelect={onSelect}
          onToggle={onToggle}
          rowIndex={container.parentRowIndex}
          style={{}}
          wireExtendDown={paddingTop}
        />
      </div>

      <ContainerComponent depth={container.depth} parentNode={container.parentNode}>
        <div
          style={{
            paddingTop: `${paddingTop}px`,
            paddingBottom: `${paddingBottom}px`,
          }}
        >
          {container.children.map((childNode: TreeNode, index: number) => {
            const isFirstChild = index === 0
            const isLastChild = index === childCount - 1
            return (
              <div
                key={childNode.id}
                style={{
                  position: 'relative',
                  height: `${rowHeight}px`,
                }}
              >
                <TreeNodeDefault
                  autoEditNodeId={autoEditNodeId}
                  data={childNode}
                  id={childNode.id}
                  isOpen={childNode.isOpen}
                  isSelected={childNode.id === selectedId}
                  onAddChild={onAddChild}
                  onDuplicateNode={onDuplicateNode}
                  onRename={onRename}
                  onRequestDelete={onRequestDelete}
                  onRequestRename={onRequestRename}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  rowIndex={container.childRowIndices[index]}
                  style={{}}
                  wireExtendDown={isLastChild ? paddingBottom : 0}
                  wireExtendUp={isFirstChild ? paddingTop : 0}
                />
              </div>
            )
          })}
        </div>
      </ContainerComponent>
    </div>
  )
}
