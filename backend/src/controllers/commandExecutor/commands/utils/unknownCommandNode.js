export const extractCommandAlias = command => command?.trim().split(/\s+/)[0] || '(unknown)'

export const createUnknownCommandNode = (store, cell) => {
  const alias = extractCommandAlias(cell.command)
  store.importer.createErrorNode(`Error: Unknown command "${alias}"`, cell.id)
}
