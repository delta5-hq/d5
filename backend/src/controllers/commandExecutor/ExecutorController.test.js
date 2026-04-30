import {BaseChatModel} from '@langchain/core/language_models/chat_models'
import {LLMChain} from '@langchain/classic/chains'
import {customerRequest} from '../../utils/test/userRequests'
import {getIntegrationSettings, getLLM} from './commands/utils/langchain/getLLM'
import {generateNodeId} from '../../shared/utils/generateId'
import {loadUserAliases} from './commands/aliases/loadUserAliases'
import {MCPCommand} from './commands/MCPCommand'
import {RPCCommand} from './commands/RPCCommand'

jest.mock('./commands/utils/langchain/getLLM')
jest.mock('../../shared/utils/generateId')
jest.mock('./commands/aliases/loadUserAliases')
jest.mock('./commands/MCPCommand')
jest.mock('./commands/RPCCommand')
jest.mock('../../services/progress-event-emitter', () => ({
  progressEventEmitter: {
    emitStart: jest.fn(),
    emitRunning: jest.fn(),
    emitComplete: jest.fn(),
    emitError: jest.fn(),
  },
}))

describe('ExecutorController', () => {
  const apiEndpoint = '/execute'
  const modelCallSpy = jest.spyOn(BaseChatModel.prototype, 'invoke')
  const chainCallSpy = jest.spyOn(LLMChain.prototype, 'invoke')
  getIntegrationSettings.mockResolvedValue({
    openai: {apiKey: 'apiKey', model: 'model'},
  })
  getLLM.mockResolvedValue({
    llm: {},
  })
  loadUserAliases.mockResolvedValue({
    mcp: [],
    rpc: [],
  })
  MCPCommand.prototype.run = jest.fn().mockResolvedValue(undefined)
  RPCCommand.prototype.run = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    jest.clearAllMocks()
    loadUserAliases.mockResolvedValue({
      mcp: [],
      rpc: [],
    })
  })

  // it('should return 404 error without provided body', async () => {
  //   const response = await customerRequest.post(apiEndpoint).send(JSON.stringify({}))
  //
  //   expect(response.status).toBe(404)
  // })

  // it('should return 400 error with not allowed query', async () => {
  //   const response = await customerRequest.post(apiEndpoint).send(JSON.stringify({cell: {}, queryType: 'notexists'}))
  //
  //   expect(response.status).toBe(400)
  // })

  // it('should return json with substituted command execution №1', async () => {
  //   // Setup:
  //   // Unnamed Workflow (root)
  //   //   /chatgpt hello
  //
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HtB8mPBrJbH'],
  //   }
  //   const cell = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/chatgpt hello',
  //     title: '/chatgpt hello',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'hello',
  //     queryType: 'chat',
  //     workflowNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //     },
  //     workflowFiles: {},
  //   }
  //
  //   const helloResId = 'newId'
  //   const helloResponse = 'Hello! How can I help you today?'
  //   generateNodeId.mockReturnValueOnce(helloResId)
  //   modelCallSpy.mockReturnValueOnce({content: helloResponse})
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {workflowNodes} = responseBody
  //
  //   expect(Object.keys(workflowNodes).length).toBe(3)
  //   expect(workflowNodes[helloResId].title).toBe(helloResponse)
  //   expect(workflowNodes[helloResId].parent).toBe(cell.id)
  //   expect(workflowNodes[cell.id].children).toEqual([helloResId])
  //   expect(workflowNodes[cell.id].prompts).toEqual([helloResId])
  //   expect(responseBody.cell).toEqual({...cell, children: [helloResId], prompts: [helloResId]})
  //
  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with substituted command execution №2', async () => {
  //   // Setup:
  //   // Unnamed Workflow (root)
  //   //   /chatgpt what is the number
  //   //     5
  //   //   /chatgpt multiply the @number by 2
  //
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HtB8mPBrJbH', '234LRRMsQxh'],
  //   }
  //   const parentCell = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/chatgpt what is the number @number',
  //     title: '/chatgpt what is the number @number',
  //     children: ['x3bx96xdLrg'],
  //   }
  //   const referenceCell = {
  //     id: 'x3bx96xdLrg',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HtB8mPBrJbH',
  //     color: '@white',
  //     title: '5',
  //     command: '',
  //   }
  //   const cell = {
  //     id: '234LRRMsQxh',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/chatgpt multiply the @number by 2',
  //     title: '/chatgpt multiply the @number by 2',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'multiply the @number by 2',
  //     queryType: 'chat',
  //     workflowNodes: {
  //       [root.id]: root,
  //       [parentCell.id]: parentCell,
  //       [referenceCell.id]: referenceCell,
  //       [cell.id]: {...cell},
  //     },
  //     workflowFiles: {},
  //   }
  //
  //   const multiplyResId = 'newId'
  //   const multiplyResponse = '10'
  //   generateNodeId.mockReturnValueOnce(multiplyResId)
  //   modelCallSpy.mockReturnValueOnce({content: multiplyResponse})
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {workflowNodes} = responseBody
  //
  //   expect(Object.keys(workflowNodes).length).toBe(5)
  //   expect(workflowNodes[multiplyResId].title).toBe(multiplyResponse)
  //   expect(workflowNodes[multiplyResId].parent).toBe(cell.id)
  //   expect(workflowNodes[cell.id].children).toEqual([multiplyResId])
  //   expect(workflowNodes[cell.id].prompts).toEqual([multiplyResId])
  //   expect(responseBody.cell).toEqual({...cell, children: [multiplyResId], prompts: [multiplyResId]})
  //
  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with substituted execution №3', async () => {
  //   // Setup:
  //   // Unnamed Workflow (root)
  //   //   /chat hello
  //
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HtB8mPBrJbH'],
  //   }
  //   const cell = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/chat hello',
  //     title: '/chat hello',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'hello',
  //     queryType: 'chat',
  //     workflowNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //     },
  //     workflowFiles: {},
  //   }
  //
  //   const helloResId = 'newId'
  //   const helloResponse = 'Hello! How can I help you today?'
  //   generateNodeId.mockReturnValueOnce(helloResId)
  //   modelCallSpy.mockReturnValueOnce({content: helloResponse})
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {workflowNodes} = responseBody
  //
  //   expect(Object.keys(workflowNodes).length).toBe(3)
  //   expect(workflowNodes[helloResId].title).toBe(helloResponse)
  //   expect(workflowNodes[helloResId].parent).toBe(cell.id)
  //   expect(workflowNodes[cell.id].children).toEqual([helloResId])
  //   expect(workflowNodes[cell.id].prompts).toEqual([helloResId])
  //   expect(responseBody.cell).toEqual({...cell, children: [helloResId], prompts: [helloResId]})
  //
  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should execute /steps', async () => {
  //   // Setup:
  //   // Unnamed Workflow (root)
  //   //   /steps
  //   //     /chatgpt hello
  //   //     /chatgpt world
  //
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HtB8mPBrJbH'],
  //   }
  //   const parent = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/steps',
  //     title: '/steps',
  //     children: ['x3bx96xdLrg', 'w8Mz9BxZQxk'],
  //   }
  //   const childFirst = {
  //     id: 'x3bx96xdLrg',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HtB8mPBrJbH',
  //     command: '/chatgpt hello',
  //     title: '/chatgpt hello',
  //   }
  //   const childSecond = {
  //     id: 'w8Mz9BxZQxk',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HtB8mPBrJbH',
  //     command: '/chatgpt world',
  //     title: '/chatgpt world',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...parent},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'hello',
  //     queryType: 'steps',
  //     workflowNodes: {
  //       [root.id]: root,
  //       [parent.id]: parent,
  //       [childFirst.id]: childFirst,
  //       [childSecond.id]: childSecond,
  //     },
  //     workflowFiles: {},
  //   }
  //
  //   const firstResId = 'newId1'
  //   const firstResponse = 'Hello'
  //   const secondResId = 'newId2'
  //   const secondResponse = 'World'
  //   generateNodeId.mockReturnValueOnce(firstResId)
  //   generateNodeId.mockReturnValueOnce(secondResId)
  //   modelCallSpy.mockReturnValueOnce({content: firstResponse})
  //   modelCallSpy.mockReturnValueOnce({content: secondResponse})
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {workflowNodes} = responseBody
  //
  //   expect(Object.keys(workflowNodes).length).toBe(6)
  //   expect(workflowNodes[firstResId].title).toBe(firstResponse)
  //   expect(workflowNodes[firstResId].parent).toBe(childFirst.id)
  //   expect(workflowNodes[secondResId].title).toBe(secondResponse)
  //   expect(workflowNodes[secondResId].parent).toBe(childSecond.id)
  //   expect(workflowNodes[parent.id].children).toEqual([childFirst.id, childSecond.id])
  //   expect(workflowNodes[childFirst.id].children).toEqual([firstResId])
  //   expect(workflowNodes[childSecond.id].children).toEqual([secondResId])
  //
  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should execute foreach with no context', async () => {
  //   // Setup:
  //   // Unnamed Workflow (root)
  //   //   /foreach @goals
  //   //     /chatgpt @@item Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough.
  //   //       - write an essay @goal897
  //   //       - provide feedback
  //
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HtB8mPBrJbH'],
  //   }
  //   const parent = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/foreach @goals',
  //     title: '/foreach @goals',
  //     children: ['x3bx96xdLrg'],
  //   }
  //   const child = {
  //     id: 'x3bx96xdLrg',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HtB8mPBrJbH',
  //     command:
  //       "@@item Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough. @goal897",
  //     title:
  //       "@@item Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough. @goal897",
  //     children: ['5Pgx6h8qLqB', '4Tgx7h9qLqB'],
  //   }
  //   const childFirst = {
  //     id: '5Pgx6h8qLqB',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'x3bx96xdLrg',
  //     command: '- write an essay',
  //     title: '- write an essay',
  //   }
  //   const childSecond = {
  //     id: '4Tgx7h9qLqB',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'x3bx96xdLrg',
  //     command: '- provide feedback',
  //     title: '- provide feedback',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...parent},
  //     queryType: 'foreach',
  //     workflowNodes: {
  //       [root.id]: root,
  //       [parent.id]: parent,
  //       [child.id]: child,
  //       [childFirst.id]: childFirst,
  //       [childSecond.id]: childSecond,
  //     },
  //     workflowFiles: {},
  //   }
  //
  //   const firstResId = 'newId1'
  //   const firstResponse = 'Result'
  //   generateNodeId.mockReturnValueOnce(firstResId)
  //   modelCallSpy.mockReturnValueOnce({content: firstResponse})
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {workflowNodes} = responseBody
  //
  //   expect(Object.keys(workflowNodes).length).toBe(6)
  //   expect(workflowNodes[firstResId].title).toBe(firstResponse)
  //   expect(workflowNodes[firstResId].parent).toBe(child.id)
  //   expect(workflowNodes[parent.id].children).toEqual([child.id])
  //   expect(workflowNodes[child.id].children).toEqual([childFirst.id, childSecond.id, firstResId])
  //
  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should execute foreach with context', async () => {
  //   // Setup:
  //   // Unnamed Workflow (root)
  //   //   /foreach @goals
  //   //     /chatgpt @@item Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough.
  //   //       - write an essay @goal897
  //   //       - provide feedback
  //
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HtB8mPBrJbH'],
  //   }
  //   const parent = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/foreach @goals',
  //     title: '/foreach @goals',
  //     children: ['x3bx96xdLrg'],
  //   }
  //   const child = {
  //     id: 'x3bx96xdLrg',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HtB8mPBrJbH',
  //     command:
  //       "@@item Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough. @goal897",
  //     title:
  //       "@@item Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough. @goal897",
  //     children: ['5Pgx6h8qLqB', '4Tgx7h9qLqB'],
  //   }
  //   const childFirst = {
  //     id: '5Pgx6h8qLqB',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'x3bx96xdLrg',
  //     command: '- write an essay',
  //     title: '- write an essay',
  //   }
  //   const childSecond = {
  //     id: '4Tgx7h9qLqB',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'x3bx96xdLrg',
  //     command: '- provide feedback',
  //     title: '- provide feedback',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...parent},
  //     context: 'Context:\n```\n- write an essay\n- provide feedback\n```\n',
  //     prompt: '@goals',
  //     queryType: 'foreach',
  //     workflowNodes: {
  //       [root.id]: root,
  //       [parent.id]: parent,
  //       [child.id]: child,
  //       [childFirst.id]: childFirst,
  //       [childSecond.id]: childSecond,
  //     },
  //     workflowFiles: {},
  //   }
  //
  //   const firstResId = 'newId1'
  //   const firstResponse = 'Result 1'
  //   const secondResId = 'newId2'
  //   const secondResponse = 'Result 2'
  //   generateNodeId.mockReturnValueOnce(firstResId)
  //   generateNodeId.mockReturnValueOnce(secondResId)
  //   modelCallSpy.mockReturnValueOnce({content: firstResponse})
  //   modelCallSpy.mockReturnValueOnce({content: secondResponse})
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {workflowNodes} = responseBody
  //
  //   expect(Object.keys(workflowNodes).length).toBe(7)
  //   expect(workflowNodes[parent.id].children).toEqual([child.id])
  //   expect(workflowNodes[child.id].children).toEqual([childFirst.id, childSecond.id, firstResId, secondResId])
  //
  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should execute /refine', async () => {
  //   const root = {
  //     id: 'r7N6TRJttHd',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Execute Keep Output Structure Test',
  //     children: ['tjbT7M4n2nD', 'LQffD2r83pf'],
  //   }
  //   const workflowMaterials = {
  //     id: 'tjbT7M4n2nD',
  //     title: 'Write a story about dog',
  //     color: '@white',
  //     scale: 0.6666666666666666,
  //     x: 0,
  //     y: 0,
  //     width: 374.4,
  //     height: 31.2,
  //     autoshrink: false,
  //     parent: 'r7N6TRJttHd',
  //   }
  //   const body = {
  //     cell: {
  //       id: 'LQffD2r83pf',
  //       title: '/refine Write a better story',
  //       color: '@salmon-light',
  //       scale: 0.6666666666666666,
  //       width: 280.8,
  //       height: 405.59999999999997,
  //       autoshrink: false,
  //       command: '/refine Write a better story',
  //       prompts: [],
  //       tags: [],
  //       parent: 'r7N6TRJttHd',
  //       x: 327.59999999999997,
  //       y: 140.39999999999998,
  //       children: [],
  //     },
  //     queryType: 'refine',
  //     workflowNodes: {
  //       r7N6TRJttHd: root,
  //       tjbT7M4n2nD: workflowMaterials,
  //       LQffD2r83pf: {
  //         id: 'LQffD2r83pf',
  //         title: '/refine Write a better story',
  //         color: '@salmon-light',
  //         scale: 0.6666666666666666,
  //         width: 280.8,
  //         height: 405.59999999999997,
  //         autoshrink: false,
  //         command: '/refine Write a better story',
  //         prompts: [],
  //         tags: [],
  //         parent: 'r7N6TRJttHd',
  //         x: 327.59999999999997,
  //         y: 140.39999999999998,
  //         children: [],
  //       },
  //     },
  //     workflowFiles: {},
  //   }
  //   generateNodeId.mockReturnValueOnce('g26fG76b39g')
  //
  //   chainCallSpy.mockReturnValueOnce({
  //     text: 'Once upon a time, there was a young dog who always wanted to explore the world.',
  //   })
  //
  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)
  //
  //   expect(responseBody.nodesChanged).toEqual([
  //     {
  //       id: 'LQffD2r83pf',
  //       title: '/refine Write a better story',
  //       color: '@salmon-light',
  //       scale: 0.6666666666666666,
  //       width: 280.8,
  //       height: 405.59999999999997,
  //       autoshrink: false,
  //       command: '/refine Write a better story',
  //       prompts: ['g26fG76b39g'],
  //       tags: [],
  //       parent: 'r7N6TRJttHd',
  //       x: 327.59999999999997,
  //       y: 140.39999999999998,
  //       children: ['g26fG76b39g'],
  //     },
  //     {
  //       id: 'g26fG76b39g',
  //       title: 'Once upon a time, there was a young dog who always wanted to explore the world.',
  //       children: [],
  //       parent: 'LQffD2r83pf',
  //     },
  //   ])
  //   expect(responseBody.cell.children).toEqual(['g26fG76b39g'])
  //   expect(responseBody.workflowNodes).toHaveProperty('g26fG76b39g')
  //   expect(responseBody.queryType).toBe('refine')
  // })

  it('should maintain output structure when executing steps feedback loop', async () => {
    const body = {
      cell: {
        id: 'LQffD2r83pf',
        title: '/steps Feedback Loop',
        color: '@salmon-light',
        scale: 0.6666666666666666,
        width: 280.8,
        height: 405.59999999999997,
        autoshrink: false,
        command: '/steps Feedback Loop',
        prompts: [],
        tags: [],
        parent: 'r7N6TRJttHd',
        children: ['9d66n9242PR', 'LqgRnG28nqf'],
        x: 327.59999999999997,
        y: 140.39999999999998,
      },
      queryType: 'steps',
      workflowNodes: {
        r7N6TRJttHd: {
          id: 'r7N6TRJttHd',
          x: 0,
          y: 0,
          width: 1024,
          scale: 0.6666666666666666,
          height: 768,
          title: 'Execute Keep Output Structure Test',
          children: ['tjbT7M4n2nD', 'LQffD2r83pf'],
        },
        LQffD2r83pf: {
          id: 'LQffD2r83pf',
          title: '/steps Feedback Loop',
          color: '@salmon-light',
          scale: 0.6666666666666666,
          width: 280.8,
          height: 405.59999999999997,
          autoshrink: false,
          command: '/steps Feedback Loop',
          prompts: [],
          tags: [],
          parent: 'r7N6TRJttHd',
          children: ['9d66n9242PR', 'LqgRnG28nqf'],
          x: 327.59999999999997,
          y: 140.39999999999998,
        },
        '9d66n9242PR': {
          id: '9d66n9242PR',
          scale: 0.6666666666666666,
          x: 0,
          y: 0,
          width: 280.8,
          height: 62.4,
          autoshrink: false,
          prompts: [],
          tags: [],
          parent: 'LQffD2r83pf',
          command:
            "@goal897 Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough",
          title:
            "@goal897 Ensure young writer writes about white bears and has dramatic ending. When it has bears and drama, say it's good enough",
        },
        LqgRnG28nqf: {
          id: 'LqgRnG28nqf',
          title: '/steps',
          color: '@salmon-light',
          scale: 0.6666666666666666,
          x: 0,
          y: 78,
          width: 280.8,
          height: 405.59999999999997,
          autoshrink: false,
          command: '/steps',
          prompts: [],
          tags: [],
          parent: 'LQffD2r83pf',
          children: ['QDNRrJTmRQB', '84hqFJb4htM'],
        },
        QDNRrJTmRQB: {
          id: 'QDNRrJTmRQB',
          scale: 0.6666666666666666,
          x: 0,
          y: 15.599999999999998,
          width: 280.8,
          height: 156,
          autoshrink: false,
          prompts: ['GH68GpRFMfP'],
          tags: [],
          parent: 'LqgRnG28nqf',
          children: ['7DDTLTPG6BH'],
          command:
            '#0 /refine rewrite the provided story of 30 words @writing897 , taking into account this feedback: ``` @@feedback897 ```',
          title:
            '#0 /refine rewrite the provided story of 30 words @writing897 , taking into account this feedback: ``` @@feedback897 ```',
        },
        '84hqFJb4htM': {
          id: '84hqFJb4htM',
          scale: 0.6666666666666666,
          x: 0,
          y: 187.2,
          width: 280.8,
          height: 296.4,
          autoshrink: false,
          prompts: ['hBQMG8rTH7T'],
          tags: [],
          parent: 'LqgRnG28nqf',
          command:
            '#1 /chatgpt writing: ``` @@writing897 ``` give your feedback as a reviewer of a young writer. Your goal: @@goal897 . be concise and constructive, no more than 8 words. @feedback897',
          title:
            '#1 /chatgpt writing: ``` @@writing897 ``` give your feedback as a reviewer of a young writer. Your goal: @@goal897 . be concise and constructive, no more than 8 words. @feedback897  ',
          children: [],
        },
        '7DDTLTPG6BH': {
          id: '7DDTLTPG6BH',
          x: 0,
          y: 0,
          width: 374.4,
          scale: 0.6666666666666666,
          height: 31.2,
          color: '@white',
          title: 'a dog who jumped over a fox ',
          command: '',
          autoshrink: false,
          parent: 'QDNRrJTmRQB',
        },
      },
      workflowFiles: {},
    }
    generateNodeId.mockReturnValueOnce('g26fG76b39g')
    generateNodeId.mockReturnValueOnce('fr6nT3mpbMG')

    chainCallSpy.mockReturnValueOnce({
      text: 'A swift dog leaped gracefully over a sly fox, their movements a blur of fur and cunning beneath the golden sun. The chase was brief but thrilling.',
    })
    modelCallSpy.mockReturnValueOnce({
      content: 'Include white bears and a more dramatic ending.',
    })

    const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

    expect(responseBody.nodesChanged).toEqual([
      {
        id: 'LqgRnG28nqf',
        title: '/steps',
        color: '@salmon-light',
        scale: 0.6666666666666666,
        x: 0,
        y: 78,
        width: 280.8,
        height: 405.59999999999997,
        autoshrink: false,
        command: '/steps',
        prompts: [],
        tags: [],
        parent: 'LQffD2r83pf',
        children: ['QDNRrJTmRQB', '84hqFJb4htM'],
      },
      {
        id: 'QDNRrJTmRQB',
        scale: 0.6666666666666666,
        x: 0,
        y: 15.599999999999998,
        width: 280.8,
        height: 156,
        autoshrink: false,
        prompts: ['g26fG76b39g'],
        tags: [],
        parent: 'LqgRnG28nqf',
        children: ['g26fG76b39g'],
        command:
          '#0 /refine rewrite the provided story of 30 words @writing897 , taking into account this feedback: ``` @@feedback897 ```',
        title:
          '#0 /refine rewrite the provided story of 30 words @writing897 , taking into account this feedback: ``` @@feedback897 ```',
      },
      {
        id: 'g26fG76b39g',
        title:
          'A swift dog leaped gracefully over a sly fox, their movements a blur of fur and cunning beneath the golden sun. The chase was brief but thrilling.',
        children: [],
        parent: 'QDNRrJTmRQB',
      },
      {
        id: '84hqFJb4htM',
        scale: 0.6666666666666666,
        x: 0,
        y: 187.2,
        width: 280.8,
        height: 296.4,
        autoshrink: false,
        prompts: ['fr6nT3mpbMG'],
        tags: [],
        parent: 'LqgRnG28nqf',
        command:
          '#1 /chatgpt writing: ``` @@writing897 ``` give your feedback as a reviewer of a young writer. Your goal: @@goal897 . be concise and constructive, no more than 8 words. @feedback897',
        title:
          '#1 /chatgpt writing: ``` @@writing897 ``` give your feedback as a reviewer of a young writer. Your goal: @@goal897 . be concise and constructive, no more than 8 words. @feedback897  ',
        children: ['fr6nT3mpbMG'],
      },
      {
        id: 'fr6nT3mpbMG',
        title: 'Include white bears and a more dramatic ending.',
        children: [],
        parent: '84hqFJb4htM',
      },
    ])
    expect(responseBody.cell.children).toEqual(expect.arrayContaining(['9d66n9242PR', 'LqgRnG28nqf']))
    expect(responseBody.workflowNodes.QDNRrJTmRQB.prompts).toContain('g26fG76b39g')
    expect(responseBody.workflowNodes['84hqFJb4htM'].prompts).toContain('fr6nT3mpbMG')
    expect(responseBody.workflowNodes).toHaveProperty('g26fG76b39g')
    expect(responseBody.workflowNodes).toHaveProperty('fr6nT3mpbMG')
    expect(responseBody.workflowNodes).not.toHaveProperty('GH68GpRFMfP')
    expect(responseBody.workflowNodes).not.toHaveProperty('hBQMG8rTH7T')
    expect(responseBody.workflowId).toBe(body.workflowId)
    expect(responseBody.queryType).toBe('steps')
  })

  describe('alias resolution and queryType dispatch', () => {
    const createTestNode = (id, command, parent = 'root') => ({
      id,
      x: 0,
      y: 0,
      width: 280,
      height: 50,
      parent,
      command,
      title: command,
    })

    const createTestWorkflow = (cellId, command, workflowId = 'test-workflow') => {
      const root = {
        id: 'root',
        x: 0,
        y: 0,
        width: 1024,
        height: 768,
        title: 'Test Workflow',
        children: [cellId],
      }
      const cell = createTestNode(cellId, command)
      return {
        workflowId,
        cell,
        workflowNodes: {root, [cellId]: cell},
        workflowFiles: {},
      }
    }

    describe('MCP alias priority', () => {
      it('should override LLM built-in queryType when MCP alias shadows command', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/custom', name: 'Custom Agent'}],
          rpc: [],
        })

        const body = {
          ...createTestWorkflow('cell1', '/custom test prompt'),
          queryType: 'custom_llm',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(MCPCommand.prototype.run).toHaveBeenCalled()
        expect(responseBody.queryType).toBe('mcp:custom')
        expect(loadUserAliases).toHaveBeenCalledWith(expect.any(String), 'test-workflow')
      })

      it.each([
        ['/chatgpt', 'chat', 'mcp:chatgpt'],
        ['/web', 'web', 'mcp:web'],
        ['/claude', 'claude', 'mcp:claude'],
        ['/custom', 'custom_llm', 'mcp:custom'],
      ])(
        'should dispatch %s to MCP when alias exists (frontend: %s → backend: %s)',
        async (command, frontendQueryType, expectedBackendQueryType) => {
          loadUserAliases.mockResolvedValueOnce({
            mcp: [{alias: command, name: 'Test Agent'}],
            rpc: [],
          })

          const body = {
            ...createTestWorkflow('test-cell', `${command} prompt`),
            queryType: frontendQueryType,
          }

          const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

          expect(MCPCommand.prototype.run).toHaveBeenCalled()
          expect(responseBody.queryType).toBe(expectedBackendQueryType)
        },
      )
    })

    describe('RPC alias priority', () => {
      it('should override LLM built-in queryType when RPC alias shadows command', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [],
          rpc: [{alias: '/custom', name: 'Custom RPC'}],
        })

        const body = {
          ...createTestWorkflow('cell2', '/custom test'),
          queryType: 'custom_llm',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(RPCCommand.prototype.run).toHaveBeenCalled()
        expect(responseBody.queryType).toBe('rpc:custom')
      })

      it('should prioritize MCP over RPC when both have same alias', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/shared', name: 'MCP Shared'}],
          rpc: [{alias: '/shared', name: 'RPC Shared'}],
        })

        const body = {
          ...createTestWorkflow('cell3', '/shared cmd'),
          queryType: 'chat',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(MCPCommand.prototype.run).toHaveBeenCalled()
        expect(RPCCommand.prototype.run).not.toHaveBeenCalled()
        expect(responseBody.queryType).toBe('mcp:shared')
      })
    })

    describe('control-flow command protection', () => {
      it.each([
        ['/steps', 'steps'],
        ['/foreach', 'foreach'],
        ['/refine', 'refine'],
        ['/memorize', 'memorize'],
      ])('should protect %s from alias override (remains %s)', async (command, expectedQueryType) => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: command, name: 'Malicious Override'}],
          rpc: [],
        })
        generateNodeId.mockReturnValueOnce('childId')
        modelCallSpy.mockReturnValueOnce({content: 'Result'})
        chainCallSpy.mockReturnValueOnce({text: 'Result'})

        const body = {
          ...createTestWorkflow('test-cell', command),
          queryType: expectedQueryType,
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe(expectedQueryType)
        expect(MCPCommand.prototype.run).not.toHaveBeenCalled()
      })
    })

    describe('non-alias command preservation', () => {
      it('should preserve frontend queryType when command matches no alias', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/qa', name: 'QA Agent'}],
          rpc: [],
        })
        modelCallSpy.mockReturnValueOnce({content: 'LLM response'})
        generateNodeId.mockReturnValueOnce('llm-response-id')

        const body = {
          ...createTestWorkflow('cell4', '/chatgpt hello'),
          context: 'Context:\n```\n```\n',
          prompt: 'hello',
          queryType: 'chat',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('chat')
        expect(MCPCommand.prototype.run).not.toHaveBeenCalled()
        expect(modelCallSpy).toHaveBeenCalled()
      })

      it('should dispatch /chatgpt to built-in chat handler when no alias exists', async () => {
        loadUserAliases.mockResolvedValueOnce({mcp: [], rpc: []})
        modelCallSpy.mockReturnValueOnce({content: 'Response'})
        generateNodeId.mockReturnValueOnce('response-id')

        const body = {
          ...createTestWorkflow('test-cell', '/chatgpt prompt'),
          context: 'Context:\n```\n```\n',
          prompt: 'prompt',
          queryType: 'chat',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('chat')
        expect(MCPCommand.prototype.run).not.toHaveBeenCalled()
        expect(modelCallSpy).toHaveBeenCalled()
      })
    })

    describe('edge cases', () => {
      it('should handle undefined cell.command gracefully', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/custom', name: 'Agent'}],
          rpc: [],
        })
        modelCallSpy.mockReturnValueOnce({content: 'Response'})
        generateNodeId.mockReturnValueOnce('responseId')

        const body = {
          ...createTestWorkflow('cell5', undefined),
          queryType: 'chat',
        }
        body.cell.command = undefined

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('chat')
      })

      it('should handle empty alias arrays', async () => {
        loadUserAliases.mockResolvedValueOnce({mcp: [], rpc: []})
        modelCallSpy.mockReturnValueOnce({content: 'Response'})
        generateNodeId.mockReturnValueOnce('responseId')

        const body = {
          ...createTestWorkflow('cell6', '/chatgpt test'),
          queryType: 'chat',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('chat')
        expect(loadUserAliases).toHaveBeenCalled()
      })

      it('should handle alias loading failure gracefully', async () => {
        loadUserAliases.mockRejectedValueOnce(new Error('DB connection failed'))
        modelCallSpy.mockReturnValueOnce({content: 'Response'})
        generateNodeId.mockReturnValueOnce('fallback-response-id')

        const body = {
          ...createTestWorkflow('cell7', '/chatgpt test'),
          context: 'Context:\n```\n```\n',
          prompt: 'test',
          queryType: 'chat',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('chat')
        expect(modelCallSpy).toHaveBeenCalled()
      })

      it('should pass workflowId to alias loader for scoped resolution', async () => {
        loadUserAliases.mockResolvedValueOnce({mcp: [], rpc: []})
        modelCallSpy.mockReturnValueOnce({content: 'Response'})
        generateNodeId.mockReturnValueOnce('responseId')

        const body = {
          ...createTestWorkflow('cell8', '/chatgpt test', 'specific-workflow-id'),
          queryType: 'chat',
        }

        await customerRequest.post(apiEndpoint).send(body)

        expect(loadUserAliases).toHaveBeenCalledWith(expect.any(String), 'specific-workflow-id')
      })

      it('should handle null workflowId', async () => {
        loadUserAliases.mockResolvedValueOnce({mcp: [], rpc: []})
        modelCallSpy.mockReturnValueOnce({content: 'Response'})
        generateNodeId.mockReturnValueOnce('responseId')

        const body = {
          ...createTestWorkflow('cell9', '/chatgpt test'),
          queryType: 'chat',
        }
        delete body.workflowId

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('chat')
        expect(loadUserAliases).toHaveBeenCalledWith(expect.any(String), undefined)
      })
    })

    describe('queryType consistency across response and events', () => {
      it('should ensure resolved queryType in HTTP response matches what runCommand received', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/custom', name: 'Agent'}],
          rpc: [],
        })

        const body = {
          ...createTestWorkflow('cell10', '/custom test'),
          queryType: 'custom_llm',
        }

        const {body: responseBody} = await customerRequest.post(apiEndpoint).send(body)

        expect(responseBody.queryType).toBe('mcp:custom')
      })

      it('should emit consistent queryType across all progress events', async () => {
        const {progressEventEmitter} = require('../../services/progress-event-emitter')

        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/custom', name: 'Agent'}],
          rpc: [],
        })

        const body = {
          ...createTestWorkflow('cell11', '/custom test'),
          queryType: 'custom_llm',
        }

        await customerRequest.post(apiEndpoint).send(body)

        expect(progressEventEmitter.emitStart).toHaveBeenCalledWith('cell11', {queryType: 'mcp:custom'})
        expect(progressEventEmitter.emitRunning).toHaveBeenCalledWith('cell11', {queryType: 'mcp:custom'})
        expect(progressEventEmitter.emitComplete).toHaveBeenCalledWith('cell11', {queryType: 'mcp:custom'})
      })

      it('should emit error events with resolved queryType', async () => {
        const {progressEventEmitter} = require('../../services/progress-event-emitter')

        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/custom', name: 'Agent'}],
          rpc: [],
        })
        MCPCommand.prototype.run = jest.fn().mockRejectedValue(new Error('MCP failed'))

        const body = {
          ...createTestWorkflow('cell12', '/custom test'),
          queryType: 'custom_llm',
        }

        try {
          await customerRequest.post(apiEndpoint).send(body)
        } catch {
          // eslint-disable-next-line no-empty
        }

        expect(progressEventEmitter.emitError).toHaveBeenCalledWith('cell12', expect.any(Error), {
          queryType: 'mcp:custom',
        })
      })
    })
  })
})
