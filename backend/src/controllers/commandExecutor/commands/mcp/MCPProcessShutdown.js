const activeClients = new Set()

export const registerMCPClient = client => {
  activeClients.add(client)
  return () => activeClients.delete(client)
}

export const closeAllMCPClients = async () => {
  const closePromises = Array.from(activeClients).map(client => client.close().catch(() => {}))
  await Promise.allSettled(closePromises)
  activeClients.clear()
}

let shutdownHandlersRegistered = false

export const registerShutdownHandlers = () => {
  if (shutdownHandlersRegistered) return
  shutdownHandlersRegistered = true

  process.on('SIGTERM', async () => {
    await closeAllMCPClients()
  })

  process.on('SIGINT', async () => {
    await closeAllMCPClients()
  })
}
