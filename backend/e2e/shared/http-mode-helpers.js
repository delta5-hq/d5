import { syncRequest, administratorRequest, publicRequest } from './requests'

/* HTTP mode helpers - use API calls instead of direct database operations */

export const httpMode = {
  /* Create test user via API signup */
  async createUser(userData) {
    const response = await publicRequest.post('/auth/signup').send(userData)
    return response.body
  },

  /* Create test user via sync API (for tests that need specific user data) */
  async createUserViaSync(userData) {
    const response = await syncRequest.post('/sync/users').send(userData)
    return response.body
  },

  /* Delete user via admin API */
  async deleteUser(userId) {
    const response = await administratorRequest.delete(`/users/${userId}`)
    return response.body
  },

  /* Clear test data - cannot delete all users via API, so this is limited */
  async clearUsers() {
    /* Limited cleanup - API doesn't provide bulk user deletion */
    console.log('HTTP mode: Limited user cleanup available via API')
  },

  /* Clear workflows - would need API endpoint */
  async clearWorkflows() {
    /* No bulk workflow deletion API available */
    console.log('HTTP mode: No bulk workflow deletion API available')
  },

  /* Clear macros - would need API endpoint */
  async clearMacros() {
    /* No bulk macro deletion API available */
    console.log('HTTP mode: No bulk macro deletion API available')
  },

  /* Clear templates - would need API endpoint */
  async clearTemplates() {
    /* No bulk template deletion API available */
    console.log('HTTP mode: No bulk template deletion API available')
  },

  /* Clear integrations - would need API endpoint */
  async clearIntegrations() {
    /* No bulk integration deletion API available */
    console.log('HTTP mode: No bulk integration deletion API available')
  },

  /* Clear LLM vectors - would need API endpoint */
  async clearLLMVectors() {
    /* No bulk LLM vector deletion API available */
    console.log('HTTP mode: No bulk LLM vector deletion API available')
  }
}