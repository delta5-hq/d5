import {EventEmitter} from 'events'
import {MOCK_EXTERNAL_SERVICES_ALLOW_ENV} from './config/mockExternalServices'
import {withEnvAsync} from './test/env'
import {startUp} from './index'
import {connectDb, closeDb} from './db'
import server from './server'

jest.mock('prom-client', () => ({collectDefaultMetrics: jest.fn()}))
jest.mock('./constants', () => ({PORT: 43210}))
jest.mock('./db', () => ({connectDb: jest.fn(), closeDb: jest.fn()}))
jest.mock('./controllers/commandExecutor/streaming/StreamBridge', () => ({shutdown: jest.fn()}))
jest.mock('./server', () => ({listen: jest.fn()}))

const createListeningServer = () => {
  const httpServer = new EventEmitter()
  httpServer.off = httpServer.removeListener.bind(httpServer)
  process.nextTick(() => httpServer.emit('listening'))
  return httpServer
}

describe('backend startup mock-runtime preflight', () => {
  let exitSpy
  let errorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    connectDb.mockResolvedValue(undefined)
    closeDb.mockResolvedValue(undefined)
    server.listen.mockImplementation(createListeningServer)
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('refuses unsafe mock runtime before DB connection or HTTP listen', async () => {
    await withEnvAsync({MOCK_EXTERNAL_SERVICES: 'true', NODE_ENV: 'production'}, () => startUp())

    expect(connectDb).not.toHaveBeenCalled()
    expect(server.listen).not.toHaveBeenCalled()
    expect(closeDb).toHaveBeenCalledTimes(1)
    expect(exitSpy).toHaveBeenCalledWith(2)
  })

  it('starts approved e2e mock runtime', async () => {
    await withEnvAsync(
      {MOCK_EXTERNAL_SERVICES: 'true', NODE_ENV: 'e2e', [MOCK_EXTERNAL_SERVICES_ALLOW_ENV]: 'true'},
      () => startUp(),
    )

    expect(connectDb).toHaveBeenCalledTimes(1)
    expect(server.listen).toHaveBeenCalledWith(43210)
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('starts real-provider runtime without mock allowance', async () => {
    await withEnvAsync({MOCK_EXTERNAL_SERVICES: undefined, NODE_ENV: 'production'}, () => startUp())

    expect(connectDb).toHaveBeenCalledTimes(1)
    expect(server.listen).toHaveBeenCalledWith(43210)
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
