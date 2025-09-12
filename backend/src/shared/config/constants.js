const {env} = process

export const API_BASE_PATH = '/api/v1'

export const PERPLEXITY_API_URL = 'https://api.perplexity.ai'

export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'

export const QWEN_API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

export const DEEPSEEK_API_URL = 'https://api.deepseek.com'

export const ROLES = {
  subscriber: 'subscriber',
  org_subscriber: 'org_subscriber',
  customer: 'customer',
  administrator: 'administrator',
}

export const ACCESS_ROLES = {
  owner: 'owner',
  contributor: 'contributor',
  reader: 'reader',
}

export const MEDIA_POSITIONS = {
  crop: 'crop',
  body: 'body',
  stretch: 'stretch',
  fullWidth: 'fullWidth',
  // bottomLeft: 'bottomLeft',
  // repeat: 'repeat',
}

export let COMPACT_CHUNK_SIZE = env.COMPACT_CHUNK_SIZE || 10

export let LOAD_CHUNK_SIZE = env.LOAD_CHUNK_SIZE || 1000

export const EmbStorageType = {
  openai: 'openai',
  yandex: 'yandex',
  custom_llm: 'custom_llm',
  qwen: 'qwen',
}

export const MODELS = ['OpenAI', 'YandexGPT', 'Claude', 'Qwen', 'Deepseek', 'CustomLLM']

export const USER_DEFAULT_MODEL = 'auto'

export const LANGUAGES = [
  {
    code: 'af',
    name: 'Afrikaans',
  },
  {
    code: 'ar',
    name: 'Arabic',
  },
  {
    code: 'ast',
    name: 'Asturian',
  },
  {
    code: 'az',
    name: 'Azerbaijani',
  },
  {
    code: 'bg',
    name: 'Bulgarian',
  },
  {
    code: 'be',
    name: 'Belarusian',
  },
  {
    code: 'bn',
    name: 'Bengali',
  },
  {
    code: 'br',
    name: 'Breton',
  },
  {
    code: 'bs',
    name: 'Bosnian',
  },
  {
    code: 'ca',
    name: 'Catalan',
  },
  {
    code: 'cs',
    name: 'Czech',
  },
  {
    code: 'cy',
    name: 'Welsh',
  },
  {
    code: 'da',
    name: 'Danish',
  },
  {
    code: 'de',
    name: 'Deutsch',
  },
  {
    code: 'dsb',
    name: 'Lower Sorbian',
  },
  {
    code: 'el',
    name: 'Greek',
  },
  {
    name: 'English',
    code: 'en',
  },
  {
    code: 'en-au',
    name: 'Australian English',
  },
  {
    code: 'en-gb',
    name: 'British English',
  },
  {
    code: 'eo',
    name: 'Esperanto',
  },
  {
    name: 'Español',
    code: 'es',
  },
  {
    code: 'es-ar',
    name: 'Argentinian Spanish',
  },
  {
    code: 'es-co',
    name: 'Colombian Spanish',
  },
  {
    code: 'es-mx',
    name: 'Mexican Spanish',
  },
  {
    code: 'es-ni',
    name: 'Nicaraguan Spanish',
  },
  {
    code: 'es-ve',
    name: 'Venezuelan Spanish',
  },
  {
    code: 'et',
    name: 'Estonian',
  },
  {
    code: 'eu',
    name: 'Basque',
  },
  {
    code: 'fa',
    name: 'Persian',
  },
  {
    code: 'fi',
    name: 'Finnish',
  },
  {
    code: 'fr',
    name: 'Français',
  },
  {
    code: 'fy',
    name: 'Frisian',
  },
  {
    code: 'ga',
    name: 'Irish',
  },
  {
    code: 'gd',
    name: 'Scottish Gaelic',
  },
  {
    code: 'gl',
    name: 'Galician',
  },
  {
    code: 'he',
    name: 'Hebrew',
  },
  {
    code: 'hi',
    name: 'Hindi',
  },
  {
    code: 'hr',
    name: 'Croatian',
  },
  {
    code: 'hsb',
    name: 'Upper Sorbian',
  },
  {
    code: 'hu',
    name: 'Hungarian',
  },
  {
    code: 'ia',
    name: 'Interlingua',
  },
  {
    code: 'id',
    name: 'Indonesian',
  },
  {
    code: 'io',
    name: 'Ido',
  },
  {
    code: 'is',
    name: 'Icelandic',
  },
  {
    code: 'it',
    name: 'Italiano',
  },
  {
    code: 'ja',
    name: 'Japanese',
  },
  {
    code: 'ka',
    name: 'Georgian',
  },
  {
    code: 'kk',
    name: 'Kazakh',
  },
  {
    code: 'km',
    name: 'Khmer',
  },
  {
    code: 'kn',
    name: 'Kannada',
  },
  {
    code: 'ko',
    name: 'Korean',
  },
  {
    code: 'lb',
    name: 'Luxembourgish',
  },
  {
    code: 'lt',
    name: 'Lithuanian',
  },
  {
    code: 'lv',
    name: 'Latvian',
  },
  {
    code: 'mk',
    name: 'Macedonian',
  },
  {
    code: 'ml',
    name: 'Malayalam',
  },
  {
    code: 'mn',
    name: 'Mongolian',
  },
  {
    code: 'mr',
    name: 'Marathi',
  },
  {
    code: 'my',
    name: 'Burmese',
  },
  {
    code: 'nb',
    name: 'Norwegian Bokmål',
  },
  {
    code: 'ne',
    name: 'Nepali',
  },
  {
    code: 'nl',
    name: 'Dutch',
  },
  {
    code: 'nn',
    name: 'Norwegian Nynorsk',
  },
  {
    code: 'os',
    name: 'Ossetic',
  },
  {
    code: 'pa',
    name: 'Punjabi',
  },
  {
    code: 'pl',
    name: 'Polish',
  },
  {
    code: 'pt',
    name: 'Portuguese',
  },
  {
    code: 'pt-br',
    name: 'Brazilian Portuguese',
  },
  {
    code: 'ro',
    name: 'Romanian',
  },
  {
    code: 'ru',
    name: 'Russian',
  },
  {
    code: 'sk',
    name: 'Slovak',
  },
  {
    code: 'sl',
    name: 'Slovenian',
  },
  {
    code: 'sq',
    name: 'Albanian',
  },
  {
    code: 'sr',
    name: 'Serbian',
  },
  {
    code: 'sr-latn',
    name: 'Serbian Latin',
  },
  {
    code: 'sv',
    name: 'Swedish',
  },
  {
    code: 'sw',
    name: 'Swahili',
  },
  {
    code: 'ta',
    name: 'Tamil',
  },
  {
    code: 'te',
    name: 'Telugu',
  },
  {
    code: 'th',
    name: 'Thai',
  },
  {
    code: 'tr',
    name: 'Turkish',
  },
  {
    code: 'tt',
    name: 'Tatar',
  },
  {
    code: 'udm',
    name: 'Udmurt',
  },
  {
    code: 'uk',
    name: 'Ukrainian',
  },
  {
    code: 'ur',
    name: 'Urdu',
  },
  {
    code: 'vi',
    name: 'Vietnamese',
  },
  {
    code: 'zh-hant',
    name: 'Traditional Chinese',
  },
  {
    name: '中文',
    code: 'zh-hans',
  },
]

export const USER_DEFAULT_LANGUAGE = 'none'
