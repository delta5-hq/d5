jest.mock('../models/Macro', () => ({
  findOne: jest.fn(),
}))

import MacroController from './MacroController'
import Macro from '../models/Macro'

describe('MacroController Authorization', () => {
  let mockCtx
  let mockNext
  const userId = 'userId'

  beforeEach(() => {
    mockCtx = {
      state: {},
      throw: jest.fn(),
      request: {
        json: jest.fn(),
      },
      body: null,
    }
    mockNext = jest.fn()
  })

  it('should throw 401 when no userId is present', async () => {
    mockCtx.state = {}

    await MacroController.authorization(mockCtx, mockNext)

    expect(mockCtx.throw).toHaveBeenCalledWith(401, 'Authentication needed.')
  })

  it('should call next when userId is present', async () => {
    mockCtx.state = {userId}

    await MacroController.authorization(mockCtx, mockNext)

    expect(mockCtx.throw).not.toHaveBeenCalled()
  })
})

describe('MacroController load', () => {
  let mockCtx
  let mockNext
  const userId = 'user123'
  const macroId = 'macro123'

  beforeEach(() => {
    mockCtx = {
      params: {macroId},
      state: {userId},
      throw: jest.fn().mockReturnValue(),
    }
    mockNext = jest.fn()

    jest.clearAllMocks()
  })

  it('should throw 404 if macro not found', async () => {
    Macro.findOne.mockResolvedValueOnce(null)

    await MacroController.load(mockCtx, mockNext)

    expect(Macro.findOne).toHaveBeenCalledWith({_id: macroId})
    expect(mockCtx.throw).toHaveBeenCalledWith(404, 'Macro not found.')
  })

  it('should throw 403 if user does not own the macro', async () => {
    const macro = {_id: macroId, userId: 'otherUser'}
    Macro.findOne.mockResolvedValueOnce(macro)

    await MacroController.load(mockCtx, mockNext)

    expect(mockCtx.throw).toHaveBeenCalledWith(403, 'Permissions denied.')
  })

  it('should set ctx.state.macro and call next on success', async () => {
    const macro = {_id: macroId, userId}
    Macro.findOne.mockResolvedValueOnce(macro)

    await MacroController.load(mockCtx, mockNext)

    expect(Macro.findOne).toHaveBeenCalledWith({_id: macroId})
    expect(mockCtx.throw).not.toHaveBeenCalled()
    expect(mockCtx.state.macro).toBe(macro)
  })
})
