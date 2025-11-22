/**
 * Test Data Factory - API-Based Test Data Management
 * 
 * Unified test data management via HTTP APIs with comprehensive cleanup.
 * 
 * SOLID Principles:
 * - Single Responsibility: API-based test data operations
 * - Open/Closed: Extensible for new data types
 * - Interface Segregation: Specific methods per data type
 * - Dependency Inversion: Tests depend on abstraction
 */

import { syncRequest, administratorRequest, publicRequest, subscriberRequest, customerRequest } from './requests'

export class TestDataFactory {
  constructor() {
    this.createdEntities = {
      users: [],
      workflows: [],
      macros: [],
      templates: [],
      integrations: [],
      vectors: [],
      waitlist: []
    }
  }

  /* User Management */
  async createUser(userData) {
    const timestamp = Date.now()
    const user = {
      id: userData.id || `testuser-${timestamp}`,
      name: userData.name || `testuser-${timestamp}`,
      mail: userData.mail || `testuser-${timestamp}@example.com`,
      password: userData.password || 'TestPass123!',
      confirmed: userData.confirmed !== undefined ? userData.confirmed : true,
      ...userData
    }

    const response = await syncRequest.post('/sync/users').send([user])
    if (response.status === 200) {
      this.createdEntities.users.push(user.id)
      return user
    }
    throw new Error(`Failed to create user: ${response.status}`)
  }

  async createWaitlistUser(userData) {
    const timestamp = Date.now()
    const user = {
      username: userData.username || `waituser-${timestamp}`,
      mail: userData.mail || `waituser-${timestamp}@example.com`,
      password: userData.password || 'TestPass123!',
      ...userData
    }

    const response = await publicRequest.post('/auth/signup').send(user)
    if (response.status === 200) {
      this.createdEntities.waitlist.push(user.mail)
      return user
    }
    throw new Error(`Failed to create waitlist user: ${response.status}`)
  }

  /* Workflow Management */
  async createWorkflow(workflowData, request = null) {
    const workflow = {
      title: workflowData.title || `Test Workflow ${Date.now()}`,
      ...workflowData
    }
    
    /* Select request based on userId parameter or use provided request */
    let selectedRequest = request || administratorRequest
    if (!request && workflowData.userId) {
      /* Map userId to appropriate authenticated request */
      const userIdToRequest = {
        'subscriber': subscriberRequest,
        'customer': customerRequest,
        'admin': administratorRequest
      }
      selectedRequest = userIdToRequest[workflowData.userId] || administratorRequest
    }

    const response = await selectedRequest.post('/workflow').send(workflow)
    if (response.status === 200) {
      const data = JSON.parse(response.text)
      this.createdEntities.workflows.push(data.workflowId)
      return { ...workflow, workflowId: data.workflowId }
    }
    throw new Error(`Failed to create workflow: ${response.status}`)
  }

  /* Macro Management */
  async createMacro(macroData) {
    const macro = {
      name: macroData.name || `Test Macro ${Date.now()}`,
      queryType: macroData.queryType || 'search',
      cell: macroData.cell || {id: 'cell1', title: 'Test', children: [], prompts: []},
      workflowNodes: macroData.workflowNodes || {},
      ...macroData
    }

    const response = await subscriberRequest.post('/macro').send(macro)
    if (response.status === 200) {
      const data = JSON.parse(response.text)
      this.createdEntities.macros.push(data.macroId)
      return { ...macro, macroId: data.macroId }
    }
    throw new Error(`Failed to create macro: ${response.status} - ${response.text}`)
  }

  /* Template Management */
  async createTemplate(templateData) {
    const template = {
      name: templateData.name || `Test Template ${Date.now()}`,
      content: templateData.content || {},
      ...templateData
    }

    const response = await administratorRequest.post('/templates').send(template)
    if (response.status === 200) {
      const data = JSON.parse(response.text)
      this.createdEntities.templates.push(data.templateId)
      return { ...template, templateId: data.templateId }
    }
    throw new Error(`Failed to create template: ${response.status}`)
  }

  /* Integration Management */
  async createIntegration(integrationData) {
    const integration = {
      name: integrationData.name || `Test Integration ${Date.now()}`,
      type: integrationData.type || 'test',
      config: integrationData.config || {},
      ...integrationData
    }

    const response = await subscriberRequest.post('/integration').send(integration)
    if (response.status === 200) {
      const data = JSON.parse(response.text)
      this.createdEntities.integrations.push(data.integrationId)
      return { ...integration, integrationId: data.integrationId }
    }
    throw new Error(`Failed to create integration: ${response.status}`)
  }

  /* LLM Vector Management */
  async createLLMVector(vectorData) {
    const vector = {
      contextName: vectorData.contextName || `test-context-${Date.now()}`,
      type: vectorData.type || 'openai',
      data: vectorData.data || { 'test-source': [{ content: 'test vector' }] },
      ...vectorData
    }

    const response = await subscriberRequest.post('/vector').send(vector)
    if (response.status === 200) {
      const data = JSON.parse(response.text)
      this.createdEntities.vectors.push(data.contextName)
      return { ...vector, contextName: data.contextName }
    }
    throw new Error(`Failed to create LLM vector: ${response.status}`)
  }

  /* Cleanup - Best effort via individual deletion APIs */
  async cleanup() {
    const cleanupPromises = []

    /* Clean workflows */
    for (const workflowId of this.createdEntities.workflows) {
      cleanupPromises.push(
        administratorRequest.delete(`/workflow/${workflowId}`).catch(() => {})
      )
    }

    /* Clean macros */
    for (const macroId of this.createdEntities.macros) {
      cleanupPromises.push(
        subscriberRequest.delete(`/macro/${macroId}`).catch(() => {})
      )
    }

    /* Clean templates */
    for (const templateId of this.createdEntities.templates) {
      cleanupPromises.push(
        administratorRequest.delete(`/template/${templateId}`).catch(() => {})
      )
    }

    /* Clean integrations */
    for (const integrationId of this.createdEntities.integrations) {
      cleanupPromises.push(
        subscriberRequest.delete(`/integration/${integrationId}`).catch(() => {})
      )
    }

    /* Clean vectors */
    for (const contextName of this.createdEntities.vectors) {
      cleanupPromises.push(
        subscriberRequest.delete(`/vector/${contextName}`).catch(() => {})
      )
    }

    await Promise.allSettled(cleanupPromises)

    /* Reset tracking */
    this.createdEntities = {
      users: [],
      workflows: [],
      macros: [],
      templates: [],
      integrations: [],
      vectors: [],
      waitlist: []
    }
  }
}

/* Global instance for tests */
export const testDataFactory = new TestDataFactory()

/* 
 * Deterministic E2E Test Orchestration
 * 
 * ARCHITECTURE PRINCIPLES:
 * - Mock services only (MOCK_EXTERNAL_SERVICES=true required)
 * - Single expected outcomes (no variance in assertions)
 * - HTTP-only patterns (no direct database access)
 * - Immediate failure on misconfiguration (regression protection)
 * 
 * SECURITY: Tests never connect to real external services
 * STABILITY: Consistent mock responses provide long-term reliability
 * MAINTAINABILITY: SOLID/DRY/KISS principles throughout
 */
export const testOrchestrator = {
  async prepareTestEnvironment() {
    /* No automatic cleanup - tests clean up their own data in afterAll/afterEach */
    /* Database cleanup should be done manually between test suite runs if needed */
  },

  async cleanupTestEnvironment() {
    await testDataFactory.cleanup()
  }
}