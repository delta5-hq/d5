/**
 * Service Configuration Layer
 *
 * This module encapsulates ALL environment variable access for external services.
 * Service implementations receive config via constructor - no direct ENV access.
 *
 * Benefits:
 * - Single source of truth for configuration
 * - Easy to mock for testing
 * - Clear dependency tracking
 * - DI container ready
 */

const env = process.env

/* Runtime mode configuration */
export const serviceMode = {
  isE2EMode: env.MOCK_EXTERNAL_SERVICES === 'true',
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
}

/* Email Service Configuration */
export const emailConfig = {
  host: env.MAIL_HOST,
  port: parseInt(env.MAIL_PORT || '465', 10),
  secure: true,
  user: env.MAIL_USER,
  password: env.MAIL_PASSWORD,
  from: env.MAIL_USER,
}

/* Thumbnail Service Configuration */
export const thumbnailConfig = {
  htmlServiceUrl: env.HTML_SERVICE_URL || 'http://localhost:3101/image',
}

/* OpenAI Service Configuration */
export const openaiConfig = {
  apiKey: env.OPENAI_API_KEY || 'mock-openai-key',
  baseUrl: 'https://api.openai.com/v1',
  defaultModel: env.DEFAULT_OPENAI_MODEL_NAME || 'gpt-4',
}

/* Claude Service Configuration */
export const claudeConfig = {
  apiKey: env.CLAUDE_API_KEY,
  baseUrl: 'https://api.anthropic.com/v1',
  version: '2023-06-01',
  defaultModel: 'claude-3-sonnet-20240229',
}

/* Perplexity Service Configuration */
export const perplexityConfig = {
  apiKey: env.PERPLEXITY_API_KEY,
  baseUrl: 'https://api.perplexity.ai',
  defaultModel: 'sonar',
}

/* Yandex Service Configuration */
export const yandexConfig = {
  apiKey: env.YANDEX_API_KEY,
  folderId: env.YANDEX_FOLDER_ID,
  baseUrl: 'https://llm.api.cloud.yandex.net',
  defaultModel: 'yandexgpt/latest',
}

/* Midjourney Service Configuration */
export const midjourneyConfig = {
  apiKey: env.GOAPI_API_KEY || env.MIDJOURNEY_API_KEY || 'mock-midjourney-key',
  apiUrl: env.MIDJOURNEY_API_URL || 'https://api.midjourneyapi.xyz',
}

/* Zoom Service Configuration */
export const zoomConfig = {
  clientId: env.ZOOM_CLIENT_ID,
  clientSecret: env.ZOOM_CLIENT_SECRET,
  redirectUri: env.ZOOM_REDIRECT_URI,
  baseUrl: 'https://api.zoom.us',
}

/* Freepik Service Configuration */
export const freepikConfig = {
  apiKey: env.FREEPIK_API_KEY || 'mock-freepik-key',
  baseUrl: 'https://api.freepik.com/v1',
}

/* Web Scraper Service Configuration */
export const webScraperConfig = {
  serpApiKey: env.SERP_API_KEY,
  userAgent: env.USER_AGENT || 'Delta5-Bot/1.0',
}

/* Export complete service configuration */
export const serviceConfig = {
  mode: serviceMode,
  email: emailConfig,
  thumbnail: thumbnailConfig,
  openai: openaiConfig,
  claude: claudeConfig,
  perplexity: perplexityConfig,
  yandex: yandexConfig,
  midjourney: midjourneyConfig,
  zoom: zoomConfig,
  freepik: freepikConfig,
  webScraper: webScraperConfig,
}
