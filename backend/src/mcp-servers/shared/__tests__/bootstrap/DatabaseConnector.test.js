import {DatabaseConnector} from '../../bootstrap/DatabaseConnector'
import * as db from '../../../../db'

jest.mock('../../../../db', () => ({
  connectDb: jest.fn(),
  closeDb: jest.fn(),
}))

describe('DatabaseConnector', () => {
  let connector

  beforeEach(() => {
    connector = new DatabaseConnector()
    jest.clearAllMocks()
  })

  describe('connect', () => {
    it('delegates to db.connectDb', async () => {
      db.connectDb.mockResolvedValue()

      await connector.connect()

      expect(db.connectDb).toHaveBeenCalledTimes(1)
    })

    it('propagates connection errors', async () => {
      db.connectDb.mockRejectedValue(new Error('MongoDB unavailable'))

      await expect(connector.connect()).rejects.toThrow('MongoDB unavailable')
    })

    it('propagates network timeout errors', async () => {
      db.connectDb.mockRejectedValue(new Error('connection timeout'))

      await expect(connector.connect()).rejects.toThrow('connection timeout')
    })

    it('can be called multiple times in succession', async () => {
      db.connectDb.mockResolvedValue()

      await connector.connect()
      await connector.connect()
      await connector.connect()

      expect(db.connectDb).toHaveBeenCalledTimes(3)
    })
  })

  describe('disconnect', () => {
    it('delegates to db.closeDb', async () => {
      db.closeDb.mockResolvedValue()

      await connector.disconnect()

      expect(db.closeDb).toHaveBeenCalledTimes(1)
    })

    it('propagates disconnection errors', async () => {
      db.closeDb.mockRejectedValue(new Error('Cannot close connection'))

      await expect(connector.disconnect()).rejects.toThrow('Cannot close connection')
    })

    it('can be called multiple times without errors', async () => {
      db.closeDb.mockResolvedValue()

      await connector.disconnect()
      await connector.disconnect()

      expect(db.closeDb).toHaveBeenCalledTimes(2)
    })

    it('can be called without prior connect', async () => {
      db.closeDb.mockResolvedValue()

      await connector.disconnect()

      expect(db.closeDb).toHaveBeenCalledTimes(1)
      expect(db.connectDb).not.toHaveBeenCalled()
    })
  })

  describe('lifecycle sequence', () => {
    it('supports connect → disconnect → connect sequence', async () => {
      db.connectDb.mockResolvedValue()
      db.closeDb.mockResolvedValue()

      await connector.connect()
      await connector.disconnect()
      await connector.connect()

      expect(db.connectDb).toHaveBeenCalledTimes(2)
      expect(db.closeDb).toHaveBeenCalledTimes(1)
    })
  })
})
