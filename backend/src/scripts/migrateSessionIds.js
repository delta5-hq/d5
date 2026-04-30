import mongoose from 'mongoose'
import Integration from '../models/Integration'
import IntegrationSession from '../models/IntegrationSession'
import {DB_URI} from '../constants'

const migrateSessionIds = async () => {
  try {
    await mongoose.connect(DB_URI)
    console.log('Connected to database')

    const integrations = await Integration.find({
      $or: [{'rpc.lastSessionId': {$exists: true, $ne: null}}, {'mcp.lastSessionId': {$exists: true, $ne: null}}],
    }).lean()

    console.log(`Found ${integrations.length} integrations with session data`)

    let migratedCount = 0

    for (const integration of integrations) {
      const {userId, rpc = [], mcp = []} = integration

      for (const rpcEntry of rpc) {
        if (rpcEntry.lastSessionId) {
          await IntegrationSession.findOneAndUpdate(
            {userId, alias: rpcEntry.alias, protocol: 'rpc'},
            {$set: {lastSessionId: rpcEntry.lastSessionId}},
            {upsert: true, new: true},
          )
          migratedCount++
          console.log(`Migrated RPC session for ${userId} alias ${rpcEntry.alias}`)
        }
      }

      for (const mcpEntry of mcp) {
        if (mcpEntry.lastSessionId) {
          await IntegrationSession.findOneAndUpdate(
            {userId, alias: mcpEntry.alias, protocol: 'mcp'},
            {$set: {lastSessionId: mcpEntry.lastSessionId}},
            {upsert: true, new: true},
          )
          migratedCount++
          console.log(`Migrated MCP session for ${userId} alias ${mcpEntry.alias}`)
        }
      }
    }

    console.log(`Migration complete. Migrated ${migratedCount} sessions.`)

    await Integration.updateMany(
      {},
      {
        $unset: {
          'rpc.$[].lastSessionId': '',
          'mcp.$[].lastSessionId': '',
        },
      },
    )
    console.log('Cleaned up lastSessionId fields from Integration documents')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from database')
  }
}

migrateSessionIds()
