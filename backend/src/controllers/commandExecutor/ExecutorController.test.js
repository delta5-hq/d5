import {BaseChatModel} from 'langchain/chat_models/base'
import {LLMChain} from 'langchain'
import {customerRequest} from '../../utils/test/userRequests'
import {getIntegrationSettings, getLLM} from './commands/utils/langchain/getLLM'
import {generateNodeId} from '../../shared/utils/generateId'

jest.mock('./commands/utils/langchain/getLLM')
jest.mock('../../shared/utils/generateId')

describe('ExecutorController', () => {
  const apiEndpoint = '/execute'
  const modelCallSpy = jest.spyOn(BaseChatModel.prototype, 'call')
  const chainCallSpy = jest.spyOn(LLMChain.prototype, 'call')
  getIntegrationSettings.mockResolvedValue({
    openai: {apiKey: 'apiKey', model: 'model'},
  })
  getLLM.mockResolvedValue({
    llm: {},
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // it('should return 404 error without provided body', async () => {
  //   const response = await customerRequest.post(apiEndpoint).send(JSON.stringify({}))

  //   expect(response.status).toBe(404)
  // })

  // it('should return 400 error with not allowed query', async () => {
  //   const response = await customerRequest.post(apiEndpoint).send(JSON.stringify({cell: {}, queryType: 'notexists'}))

  //   expect(response.status).toBe(400)
  // })

  // it('should return json with substituted command execution №1', async () => {
  //   // Setup:
  //   // Unnamed Map (root)
  //   //   /chatgpt hello

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
  //     mapNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //     },
  //     mapFiles: {},
  //   }

  //   const helloResId = 'newId'
  //   const helloResponse = 'Hello! How can I help you today?'
  //   generateNodeId.mockReturnValueOnce(helloResId)
  //   modelCallSpy.mockReturnValueOnce({content: helloResponse})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(3)
  //   expect(mapNodes[helloResId].title).toBe(helloResponse)
  //   expect(mapNodes[helloResId].parent).toBe(cell.id)
  //   expect(mapNodes[cell.id].children).toEqual([helloResId])
  //   expect(mapNodes[cell.id].prompts).toEqual([helloResId])
  //   expect(responseBody.cell).toEqual({...cell, children: [helloResId], prompts: [helloResId]})

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with substituted command execution №2', async () => {
  //   // Setup
  //   // Unnamed Map (root)
  //   //   /chatgpt hello
  //   //     user text
  //   const cell = {
  //     id: 'HtB8mPBrJbH',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 93.6,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     command: '/chatgpt hello',
  //     title: '/chatgpt hello',
  //     children: ['2HBt63LNRTh'],
  //     prompts: ['jQrB6pFmttg'],
  //   }
  //   const userNode = {
  //     id: '2HBt63LNRTh',
  //     x: 0,
  //     y: 0,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HtB8mPBrJbH',
  //     color: '@white',
  //     title: 'user text',
  //   }
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
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'hello\n  user text',
  //     queryType: 'chat',
  //     mapNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //       [userNode.id]: [userNode.id],
  //     },
  //     mapFiles: {},
  //   }

  //   const helloResId = 'newId'
  //   const helloResponse = 'Hello! How can I help you today?'
  //   generateNodeId.mockReturnValueOnce(helloResId)
  //   modelCallSpy.mockReturnValueOnce({content: helloResponse})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(4)
  //   expect(mapNodes[helloResId].title).toBe(helloResponse)
  //   expect(mapNodes[helloResId].parent).toBe(cell.id)
  //   expect(mapNodes[cell.id].children).toEqual([userNode.id, helloResId])
  //   expect(mapNodes[cell.id].prompts).toEqual([helloResId])
  //   expect(responseBody.cell).toEqual({...cell, children: [userNode.id, helloResId], prompts: [helloResId]})

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with substituted command execution and post process', async () => {
  //   // Setup
  //   // Unnamed Map (root)
  //   //   /chatgpt write one cat name
  //   //     /foreach /chatgpt say hello to @@
  //   const cell = {
  //     id: 'HPpjqrbfDhQ',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 93.6,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     children: ['FJT3Fb62qrd'],
  //     command: '/chatgpt write one cat name',
  //     title: '/chatgpt write one cat name',
  //   }
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['HPpjqrbfDhQ'],
  //   }
  //   const foreach = {
  //     id: 'FJT3Fb62qrd',
  //     x: 0,
  //     y: 0,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'HPpjqrbfDhQ',
  //     color: '@white',
  //     command: '/foreach /chatgpt say hello to @@',
  //     title: '/foreach /chatgpt say hello to @@',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'write one cat name',
  //     queryType: 'chat',
  //     mapNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //       [foreach.id]: foreach,
  //     },
  //     mapFiles: {},
  //   }

  //   const sharikId = 'sharikId'
  //   const helloId = 'helloId'
  //   generateNodeId.mockReturnValueOnce(sharikId)
  //   generateNodeId.mockReturnValueOnce(helloId)

  //   const sharikTitle = 'Sharik'
  //   const helloTitle = 'Hello, Sharik!'
  //   modelCallSpy.mockReturnValueOnce({content: sharikTitle})
  //   modelCallSpy.mockReturnValueOnce({content: helloTitle})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(5)
  //   // Check first generated node
  //   expect(mapNodes[sharikId].title).toBe(sharikTitle)
  //   expect(mapNodes[sharikId].parent).toBe(cell.id)
  //   expect(mapNodes[sharikId].command).toBe('/chatgpt say hello to Sharik')
  //   expect(mapNodes[sharikId].prompts).toEqual([helloId])

  //   // Check post process generated node
  //   expect(mapNodes[helloId].title).toBe(helloTitle)
  //   expect(mapNodes[helloId].parent).toBe(sharikId)

  //   // Check parent
  //   expect(mapNodes[cell.id].children).toEqual([foreach.id, sharikId])
  //   expect(mapNodes[cell.id].prompts).toEqual([sharikId])
  //   expect(responseBody.cell).toEqual({...cell, children: [foreach.id, sharikId], prompts: [sharikId]})

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with substituted command execution and reference', async () => {
  //   // Setup
  //   // Unnamed Map (root)
  //   //   /steps
  //   //     #0 /chatgpt write one cat name @cat
  //   //       /foreach /chatgpt say hello to @@
  //   //     #1 /chatgpt what is text about? @@cat
  //   const cell = {
  //     id: '7mFFHDnP26Q',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 171.6,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     children: ['FdFnfQnn7J7', 'jJqn6tHPjHh'],
  //     command: '/steps',
  //     title: '/steps',
  //   }
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['7mFFHDnP26Q'],
  //   }
  //   const step1 = {
  //     id: 'FdFnfQnn7J7',
  //     x: 0,
  //     y: 0,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 109.2,
  //     parent: '7mFFHDnP26Q',
  //     color: '@white',
  //     children: ['BLGLGhM2PGj'],
  //     command: '#0 /chatgpt write one cat name @cat',
  //     title: '#0 /chatgpt write one cat name @cat',
  //   }
  //   const foreach = {
  //     id: 'BLGLGhM2PGj',
  //     x: 0,
  //     y: 0,
  //     width: 514.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'FdFnfQnn7J7',
  //     color: '@salmon-light',
  //     command: '/foreach /chatgpt say hello to @@',
  //     title: '/foreach /chatgpt say hello to @@',
  //   }
  //   const step2 = {
  //     id: 'jJqn6tHPjHh',
  //     x: 0,
  //     y: 124.8,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '7mFFHDnP26Q',
  //     color: '@white',
  //     command: '#1 /chatgpt what is text about? @@cat',
  //     title: '#1 /chatgpt what is text about? @@cat',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     queryType: 'steps',
  //     mapNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //       [step1.id]: step1,
  //       [foreach.id]: foreach,
  //       [step2.id]: step2,
  //     },
  //     mapFiles: {},
  //   }

  //   const sharikId = 'sharikId'
  //   const helloId = 'helloId'
  //   const summaryId = 'summaryId'
  //   generateNodeId.mockReturnValueOnce(sharikId)
  //   generateNodeId.mockReturnValueOnce(helloId)
  //   generateNodeId.mockReturnValueOnce(summaryId)

  //   const sharikTitle = 'Sharik'
  //   const helloTitle = 'Hello, Sharik!'
  //   const summaryTitle = 'Here comes the greeting of a dog named Sharik'
  //   modelCallSpy.mockReturnValueOnce({content: sharikTitle})
  //   modelCallSpy.mockReturnValueOnce({content: helloTitle})
  //   modelCallSpy.mockReturnValueOnce({content: summaryTitle})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(8)
  //   // Check first step generated node
  //   expect(mapNodes[sharikId].title).toBe(sharikTitle)
  //   expect(mapNodes[sharikId].parent).toBe(step1.id)
  //   expect(mapNodes[sharikId].command).toBe('/chatgpt say hello to Sharik')
  //   expect(mapNodes[sharikId].prompts).toEqual([helloId])

  //   // Check post process generated node
  //   expect(mapNodes[helloId].title).toBe(helloTitle)
  //   expect(mapNodes[helloId].parent).toBe(sharikId)

  //   // Check parent
  //   expect(mapNodes[step1.id].children).toEqual([foreach.id, sharikId])
  //   expect(mapNodes[step1.id].prompts).toEqual([sharikId])

  //   // Check second step generated node
  //   expect(mapNodes[summaryId].title).toBe(summaryTitle)
  //   expect(mapNodes[summaryId].parent).toBe(step2.id)

  //   // Check parent
  //   expect(mapNodes[step2.id].children).toEqual([summaryId])
  //   expect(mapNodes[step2.id].prompts).toEqual([summaryId])

  //   // Cell doesn't changed in this case
  //   expect(responseBody.cell).toEqual(cell)

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with substituted foreach execution', async () => {
  //   // Setup
  //   // Unnamed Map (root)
  //   //   Cats
  //   //     Barsik
  //   //     Sam
  //   //     /foreach /chatgpt say hello to @@
  //   const cell = {
  //     id: 'HH9qGR92j9D',
  //     x: 0,
  //     y: 93.6,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     command: '/foreach /chatgpt say hello to @@',
  //     title: '/foreach /chatgpt say hello to @@',
  //   }
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['989HNNQfQ6n'],
  //   }
  //   const parent = {
  //     id: '989HNNQfQ6n',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 156,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     children: ['F8NfQDP4jfb', 'F36jb28Tgm3', 'HH9qGR92j9D'],
  //     title: 'Cats',
  //   }
  //   const child1 = {
  //     id: 'F8NfQDP4jfb',
  //     x: 0,
  //     y: 0,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     title: 'Barsik',
  //   }
  //   const child2 = {
  //     id: 'F36jb28Tgm3',
  //     x: 0,
  //     y: 46.8,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     title: 'Sam',
  //   }
  //   const foreach = {
  //     id: 'HH9qGR92j9D',
  //     x: 0,
  //     y: 93.6,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     command: '/foreach /chatgpt say hello to @@',
  //     title: '/foreach /chatgpt say hello to @@',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     queryType: 'foreach',
  //     mapNodes: {
  //       [root.id]: root,
  //       [parent.id]: parent,
  //       [child1.id]: child1,
  //       [child2.id]: child2,
  //       [foreach.id]: foreach,
  //     },
  //     mapFiles: {},
  //   }

  //   const newChild_1_id = 'newChild1'
  //   const newChild_2_id = 'newChild2'
  //   generateNodeId.mockReturnValueOnce(newChild_1_id)
  //   generateNodeId.mockReturnValueOnce(newChild_2_id)

  //   const barsikTitle = 'Hello, Barsik!'
  //   const samTitle = 'Hello, Sam!'
  //   modelCallSpy.mockReturnValueOnce({content: barsikTitle})
  //   modelCallSpy.mockReturnValueOnce({content: samTitle})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(7)
  //   // Check first created child node
  //   expect(mapNodes[newChild_1_id].title).toBe(barsikTitle)
  //   expect(mapNodes[newChild_1_id].parent).toBe(child1.id)
  //   expect(mapNodes[child1.id].command).toBe('/chatgpt say hello to Barsik')

  //   // Check second created child node
  //   expect(mapNodes[newChild_2_id].title).toBe(samTitle)
  //   expect(mapNodes[newChild_2_id].parent).toBe(child2.id)
  //   expect(mapNodes[child2.id].command).toBe('/chatgpt say hello to Sam')

  //   // Check child1
  //   expect(mapNodes[child1.id].children).toEqual([newChild_1_id])
  //   expect(mapNodes[child1.id].prompts).toEqual([newChild_1_id])

  //   // Check child2
  //   expect(mapNodes[child2.id].children).toEqual([newChild_2_id])
  //   expect(mapNodes[child2.id].prompts).toEqual([newChild_2_id])

  //   // Cell doesn't changed in this case
  //   expect(responseBody.cell).toEqual(cell)

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should return json with nested foreach execution', async () => {
  //   // Setup
  //   // Unnamed Map (root)
  //   //   Cats
  //   //     Barsik
  //   //       Hello, Barsik!
  //   //     Sam
  //   //       Hello, Sam!
  //   //     /foreach /chatgpt say hello to @@
  //   const cell = {
  //     id: 'HH9qGR92j9D',
  //     x: 0,
  //     y: 93.6,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     command: '/foreach /chatgpt say hello to @@',
  //     title: '/foreach /chatgpt say hello to @@',
  //   }
  //   const root = {
  //     id: 'NB32tn6dBNn',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //     children: ['989HNNQfQ6n'],
  //   }
  //   const parent = {
  //     id: '989HNNQfQ6n',
  //     x: 0,
  //     y: 0,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 156,
  //     parent: 'NB32tn6dBNn',
  //     color: '@salmon-light',
  //     children: ['F8NfQDP4jfb', 'F36jb28Tgm3', 'HH9qGR92j9D'],
  //     title: 'Cats',
  //   }
  //   const child1 = {
  //     id: 'F8NfQDP4jfb',
  //     x: 0,
  //     y: 0,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     title: 'Barsik',
  //     children: ['newChild1'],
  //     prompts: ['newChild1'],
  //   }
  //   const child2 = {
  //     id: 'F36jb28Tgm3',
  //     x: 0,
  //     y: 46.8,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     title: 'Sam',
  //     children: ['newChild2'],
  //     prompts: ['newChild2'],
  //   }
  //   const foreach = {
  //     id: 'HH9qGR92j9D',
  //     x: 0,
  //     y: 93.6,
  //     width: 374.4,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: '989HNNQfQ6n',
  //     color: '@white',
  //     command: '/foreach /chatgpt say hello to @@',
  //     title: '/foreach /chatgpt say hello to @@',
  //   }
  //   const newChild1 = {
  //     id: 'newChild1',
  //     title: 'Hello, Barsik!',
  //     children: [],
  //     parent: 'F8NfQDP4jfb',
  //   }
  //   const newChild2 = {
  //     id: 'newChild2',
  //     title: 'Hello, Sam!',
  //     children: [],
  //     parent: 'F36jb28Tgm3',
  //   }
  //   const body = {
  //     workflowId: 'n3F4HRqbJpD',
  //     cell: {...cell},
  //     queryType: 'foreach',
  //     mapNodes: {
  //       [root.id]: root,
  //       [parent.id]: parent,
  //       [child1.id]: child1,
  //       [child2.id]: child2,
  //       [foreach.id]: foreach,
  //       [newChild1.id]: newChild1,
  //       [newChild2.id]: newChild2,
  //     },
  //     mapFiles: {},
  //   }

  //   const nested1 = 'nested1'
  //   const nested2 = 'nested2'
  //   generateNodeId.mockReturnValueOnce(nested1)
  //   generateNodeId.mockReturnValueOnce(nested2)

  //   const barsikTitle = 'Hello, Barsik!'
  //   const samTitle = 'Hello, Sam!'
  //   modelCallSpy.mockReturnValueOnce({content: barsikTitle})
  //   modelCallSpy.mockReturnValueOnce({content: samTitle})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(9)
  //   // Check first created child node
  //   expect(mapNodes[nested1].title).toBe(barsikTitle)
  //   expect(mapNodes[nested1].parent).toBe(newChild1.id)
  //   expect(mapNodes[newChild1.id].command).toBe('/chatgpt say hello to Hello, Barsik!')

  //   // Check second created child node
  //   expect(mapNodes[nested2].title).toBe(samTitle)
  //   expect(mapNodes[nested2].parent).toBe(newChild2.id)
  //   expect(mapNodes[newChild2.id].command).toBe('/chatgpt say hello to Hello, Sam!')

  //   // Check child1
  //   expect(mapNodes[newChild1.id].children).toEqual([nested1])
  //   expect(mapNodes[newChild1.id].prompts).toEqual([nested1])

  //   // Check child2
  //   expect(mapNodes[newChild2.id].children).toEqual([nested2])
  //   expect(mapNodes[newChild2.id].prompts).toEqual([nested2])

  //   // Cell doesn't changed in this case
  //   expect(responseBody.cell).toEqual(cell)

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should update node IDs when re-executing a command', async () => {
  //   // Setup:
  //   // Unnamed Map (root)
  //   //  hi
  //   //   Hello! How can I assist you today?
  //   //  new node
  //   const root = {
  //     id: 'r7N6TRJttHd',
  //     x: 0,
  //     y: 0,
  //     width: 1024,
  //     scale: 0.6666666666666666,
  //     height: 768,
  //     title: 'Unnamed Workflow',
  //   }
  //   const cell = {
  //     id: 'GQtLbdGdTJn',
  //     x: 0,
  //     y: -234,
  //     width: 280.8,
  //     scale: 0.6666666666666666,
  //     height: 31.2,
  //     parent: 'r7N6TRJttHd',
  //     command: ' hi',
  //     title: ' hi',
  //     prompts: ['RMJQDGBmdnQ'],
  //     children: ['RMJQDGBmdnQ'],
  //   }
  //   const existingResponse = {
  //     id: 'RMJQDGBmdnQ',
  //     title: 'Hello! How can I assist you today?',
  //     children: [],
  //     parent: 'GQtLbdGdTJn',
  //   }
  //   const anotherNode = {
  //     height: 31.2,
  //     width: 280.8,
  //     x: 0,
  //     y: -187.20000000000002,
  //     parent: 'r7N6TRJttHd',
  //     scale: 0.6666666666666666,
  //     id: 'jg7JrBgL23r',
  //   }
  //   const body = {
  //     workflowId: 'qdb4dFjg4Hm',
  //     cell: {...cell},
  //     context: 'Context:\n```\n```\n',
  //     prompt: 'hi',
  //     queryType: 'chat',
  //     mapNodes: {
  //       [root.id]: root,
  //       [cell.id]: {...cell},
  //       [anotherNode.id]: anotherNode,
  //       [existingResponse.id]: existingResponse,
  //     },
  //     mapFiles: {},
  //     userId: 'admin',
  //   }

  //   const helloResId = 'newId'
  //   const helloResponse = 'Hello! How can I help you today?'
  //   generateNodeId.mockReturnValueOnce(helloResId)
  //   modelCallSpy.mockReturnValueOnce({content: helloResponse})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))
  //   const {mapNodes} = responseBody

  //   expect(Object.keys(mapNodes).length).toBe(4)
  //   expect(mapNodes[helloResId].title).toBe(helloResponse)
  //   expect(mapNodes[helloResId].parent).toBe(cell.id)
  //   expect(mapNodes[cell.id].children).toEqual([helloResId])
  //   expect(mapNodes[cell.id].prompts).toEqual([helloResId])
  //   expect(responseBody.cell).toEqual({...cell, children: [helloResId], prompts: [helloResId]})

  //   // other properties should not change
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.context).toBe(body.context)
  //   expect(responseBody.prompt).toBe(body.prompt)
  //   expect(responseBody.queryType).toBe(body.queryType)
  // })

  // it('should update node IDs when re-executing a refine command', async () => {
  //   const body = {
  //     nodesChanged: [
  //       {
  //         id: 'G3nqbfp47rL',
  //         title:
  //           "**\"Hi, Green Dog!** ��🐾 (Maybe you're extra eco-friendly or just love the color green? Either way, you're pawsome!) ",
  //         children: [],
  //         parent: 'tjbT7M4n2nD',
  //       },
  //       {
  //         id: 'mg7GqDHbGpM',
  //         title: 'Let me know if "Green Dog" has a special story—I’d love to hear it! 🌱😄"',
  //         children: [],
  //         parent: 'tjbT7M4n2nD',
  //       },
  //     ],
  //     queryType: 'refine',
  //     cell: {
  //       id: 'tjbT7M4n2nD',
  //       x: 15.599999999999966,
  //       y: -234,
  //       width: 280.8,
  //       scale: 0.6666666666666666,
  //       height: 62.4,
  //       parent: 'r7N6TRJttHd',
  //       children: ['G3nqbfp47rL', 'mg7GqDHbGpM'],
  //       command: '/refine Say hi to green dog',
  //       title: '/refine Say hi to green dog',
  //       prompts: ['G3nqbfp47rL', 'mg7GqDHbGpM'],
  //     },
  //     userId: 'admin',
  //     workflowId: 'qdb4dFjg4Hm',
  //     mapNodes: {
  //       r7N6TRJttHd: {
  //         id: 'r7N6TRJttHd',
  //         x: 0,
  //         y: 0,
  //         width: 1024,
  //         scale: 0.6666666666666666,
  //         height: 768,
  //         title: 'Execute Keep Output Structure Test',
  //         children: ['hRgFBLLmRBR', '7dn3N8mpnGm', 'tjbT7M4n2nD'],
  //       },
  //       tjbT7M4n2nD: {
  //         id: 'tjbT7M4n2nD',
  //         x: 15.599999999999966,
  //         y: -234,
  //         width: 280.8,
  //         scale: 0.6666666666666666,
  //         height: 62.4,
  //         parent: 'r7N6TRJttHd',
  //         children: ['G3nqbfp47rL', 'mg7GqDHbGpM'],
  //         command: '/refine Say hi to green dog',
  //         title: '/refine Say hi to green dog',
  //         prompts: ['G3nqbfp47rL', 'mg7GqDHbGpM'],
  //       },
  //       G3nqbfp47rL: {
  //         id: 'G3nqbfp47rL',
  //         title:
  //           "**\"Hi, Green Dog!** ��🐾 (Maybe you're extra eco-friendly or just love the color green? Either way, you're pawsome!) ",
  //         children: [],
  //         parent: 'tjbT7M4n2nD',
  //       },
  //       mg7GqDHbGpM: {
  //         id: 'mg7GqDHbGpM',
  //         title: 'Let me know if "Green Dog" has a special story—I’d love to hear it! 🌱😄"',
  //         children: [],
  //         parent: 'tjbT7M4n2nD',
  //       },
  //     },
  //     mapFiles: {},
  //   }

  //   generateNodeId.mockReturnValueOnce('DTNJLhPGbjG')
  //   generateNodeId.mockReturnValueOnce('PtTgj6t8bTb')

  //   chainCallSpy.mockReturnValueOnce({text: 'Greeting line #1\nGreeting line #2'})

  //   const {body: responseBody} = await customerRequest.post(apiEndpoint).send(JSON.stringify(body))

  //   expect(responseBody.nodesChanged).toEqual([
  //     {
  //       id: 'DTNJLhPGbjG',
  //       title: 'Greeting line #1',
  //       children: [],
  //       parent: 'tjbT7M4n2nD',
  //     },
  //     {
  //       id: 'PtTgj6t8bTb',
  //       title: 'Greeting line #2',
  //       children: [],
  //       parent: 'tjbT7M4n2nD',
  //     },
  //   ])
  //   expect(responseBody.cell.children).toEqual(['DTNJLhPGbjG', 'PtTgj6t8bTb'])
  //   expect(responseBody.cell.prompts).toEqual(['DTNJLhPGbjG', 'PtTgj6t8bTb'])
  //   expect(Object.keys(responseBody.mapNodes)).toHaveLength(4)
  //   expect(responseBody.mapNodes).toHaveProperty('DTNJLhPGbjG')
  //   expect(responseBody.mapNodes).toHaveProperty('PtTgj6t8bTb')
  //   expect(responseBody.mapNodes).not.toHaveProperty('G3nqbfp47rL')
  //   expect(responseBody.mapNodes).not.toHaveProperty('mg7GqDHbGpM')
  //   expect(responseBody.workflowId).toBe(body.workflowId)
  //   expect(responseBody.queryType).toBe('refine')
  // })

  it('should maintain output structure when executing steps feedback loop', async () => {
    const body = {
      workflowId: 'qdb4dFjg4Hm',
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
      mapNodes: {
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
      mapFiles: {},
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
    expect(responseBody.mapNodes.QDNRrJTmRQB.prompts).toContain('g26fG76b39g')
    expect(responseBody.mapNodes['84hqFJb4htM'].prompts).toContain('fr6nT3mpbMG')
    expect(responseBody.mapNodes).toHaveProperty('g26fG76b39g')
    expect(responseBody.mapNodes).toHaveProperty('fr6nT3mpbMG')
    expect(responseBody.mapNodes).not.toHaveProperty('GH68GpRFMfP')
    expect(responseBody.mapNodes).not.toHaveProperty('hBQMG8rTH7T')
    expect(responseBody.workflowId).toBe(body.workflowId)
    expect(responseBody.queryType).toBe('steps')
  })
})
