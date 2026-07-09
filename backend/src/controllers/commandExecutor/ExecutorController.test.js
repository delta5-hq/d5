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
jest.mock('./commands/utils/getWorkflowData')
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
  getLLM.mockReturnValue({
    llm: {invoke: (...args) => modelCallSpy(...args)},
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

  /*
   * REMOVED in P0.1: "should maintain output structure when executing steps feedback loop"
   *
   * The deleted test wrapped a /steps cell containing a legacy /refine cell that
   * iteratively transformed content via the /chatgpt feedback. Legacy /refine was
   * removed in P0.1; the feedback-loop semantics it provided are now expected to
   * land via /refine :n=N (P0.3-P0.11) and a /chatgpt-based prompt restructure.
   *
   * Surviving architectural coverage:
   *   - /steps orchestration mechanics: runCommand.integrations.test.js (StepsCommand block)
   *   - post-processor priority + recursion: runCommand.postprocess.test.js
   *   - alias resolution + dispatch: this file, "alias resolution and queryType dispatch" describe
   *
   * A new /steps + /chatgpt + /refine :n=N feedback-loop integration test will be
   * added under P0.11 acceptance.
   */

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

      it('should protect /refine from alias override even though top-level /refine is a modifier-root error', async () => {
        loadUserAliases.mockResolvedValueOnce({
          mcp: [{alias: '/refine', name: 'Malicious Override'}],
          rpc: [],
        })
        generateNodeId.mockReturnValueOnce('childId')
        modelCallSpy.mockReturnValueOnce({content: 'Result'})
        chainCallSpy.mockReturnValueOnce({text: 'Result'})

        const body = {
          ...createTestWorkflow('test-cell', '/refine'),
          queryType: 'refine',
        }

        const response = await customerRequest.post(apiEndpoint).send(body)

        // Security: malicious alias was NOT invoked (the central protection invariant).
        expect(MCPCommand.prototype.run).not.toHaveBeenCalled()
        // Behavior: top-level /refine now returns 200 with a visible [✗ invalid] error
        // node instead of a 500 — the alias-protection invariant is the security claim
        // being tested here; the response shape is an observable consequence of P0.488.
        expect(response.status).toBe(200)
        const body2 = response.body
        const changedTitles = (body2?.nodesChanged ?? []).map(n => n.title ?? '')
        expect(changedTitles.some(t => t.includes('[✗ !]'))).toBe(true)
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

  describe('CriteriaFailedError catch branch — HTTP 200 with nodesChanged', () => {
    const apiEndpoint = '/execute'

    const buildValidateWorkflow = () => {
      const root = {
        id: 'root',
        x: 0,
        y: 0,
        width: 1024,
        height: 768,
        parent: null,
        command: '/chat do task',
        title: '/chat do task',
        children: ['v0'],
      }
      const validateNode = {
        id: 'v0',
        x: 0,
        y: 0,
        width: 280,
        height: 50,
        parent: 'root',
        command: '/validate criterion :retry=0',
        title: '/validate criterion :retry=0',
        children: [],
      }
      return {
        workflowId: 'test-wf',
        queryType: 'chat',
        cell: root,
        workflowNodes: {root, v0: validateNode},
        workflowFiles: {},
      }
    }

    it('returns HTTP 200 (not 500) when validate exhausts retry budget', async () => {
      const {ChatCommand} = require('./commands/ChatCommand')
      const {ValidateCommand} = require('./reliability/core/ValidateCommand')
      const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
      const validateSpy = jest
        .spyOn(ValidateCommand.prototype, 'run')
        .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})

      const response = await customerRequest.post(apiEndpoint).send(buildValidateWorkflow())

      chatSpy.mockRestore()
      validateSpy.mockRestore()

      expect(response.status).toBe(200)
    })

    it('returns nodesChanged containing the validate node with failure suffix', async () => {
      const {ChatCommand} = require('./commands/ChatCommand')
      const {ValidateCommand} = require('./reliability/core/ValidateCommand')
      const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
      const validateSpy = jest
        .spyOn(ValidateCommand.prototype, 'run')
        .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})

      const {body} = await customerRequest.post(apiEndpoint).send(buildValidateWorkflow())

      chatSpy.mockRestore()
      validateSpy.mockRestore()

      const validateChanged = body.nodesChanged?.find(n => n.id === 'v0')
      expect(validateChanged).toBeDefined()
      expect(validateChanged.title).toMatch(/\[✗ 1×\]/)
    })

    it('emits emitComplete (not emitError) on CriteriaFailedError', async () => {
      const {progressEventEmitter} = require('../../services/progress-event-emitter')
      const {ChatCommand} = require('./commands/ChatCommand')
      const {ValidateCommand} = require('./reliability/core/ValidateCommand')
      const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
      const validateSpy = jest
        .spyOn(ValidateCommand.prototype, 'run')
        .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})

      await customerRequest.post(apiEndpoint).send(buildValidateWorkflow())

      chatSpy.mockRestore()
      validateSpy.mockRestore()

      expect(progressEventEmitter.emitComplete).toHaveBeenCalled()
      expect(progressEventEmitter.emitError).not.toHaveBeenCalled()
    })
  })

  describe('CriteriaFailedError catch branch — HTTP 422 when store not yet initialized', () => {
    const workflowOnlyId = {
      workflowId: 'wf-no-nodes',
      queryType: 'chat',
      cell: {id: 'root', command: '/chat do task', parent: null, children: [], title: '/chat do task'},
      workflowFiles: {},
    }

    it('returns HTTP 422 when CriteriaFailedError is thrown before store initialization', async () => {
      const {getWorkflowData} = require('./commands/utils/getWorkflowData')
      const {CriteriaFailedError} = require('./reliability/core/CriteriaFailedError')
      getWorkflowData.mockRejectedValueOnce(new CriteriaFailedError('criterion', 0))

      const response = await customerRequest.post(apiEndpoint).send(workflowOnlyId)

      expect(response.status).toBe(422)
    })

    it('emits emitError (not emitComplete) when CriteriaFailedError is thrown before store initialization', async () => {
      const {progressEventEmitter} = require('../../services/progress-event-emitter')
      const {getWorkflowData} = require('./commands/utils/getWorkflowData')
      const {CriteriaFailedError} = require('./reliability/core/CriteriaFailedError')
      getWorkflowData.mockRejectedValueOnce(new CriteriaFailedError('criterion', 0))

      await customerRequest.post(apiEndpoint).send(workflowOnlyId)

      expect(progressEventEmitter.emitError).toHaveBeenCalled()
      expect(progressEventEmitter.emitComplete).not.toHaveBeenCalled()
    })

    it('includes the criterion message in the 422 response body', async () => {
      const {getWorkflowData} = require('./commands/utils/getWorkflowData')
      const {CriteriaFailedError} = require('./reliability/core/CriteriaFailedError')
      getWorkflowData.mockRejectedValueOnce(new CriteriaFailedError('output must mention price', 0))

      const response = await customerRequest.post(apiEndpoint).send(workflowOnlyId)

      expect(response.status).toBe(422)
      expect(response.text).toContain('output must mention price')
    })
  })
})
