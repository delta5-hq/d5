export const API_URL = import.meta.env.API_URL || ''
export const API_BASE_PATH = import.meta.env.API_BASE_PATH || ''

export const ENV_MODE = import.meta.env.MODE
export const IS_DEV = ENV_MODE === 'development'
export const IS_PROD = ENV_MODE === 'production'
