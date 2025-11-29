import { DeltaFiveConfiguration, Configuration } from "./_interfaces"

// When adding non-string values, do not forget to
// parse them in `parseSearchParams` function in `App.tsx`
export const defaultConfiguration: Configuration = {
  token: "",
  color: "15BE6C",
  popupIcon: "", // if empty, /images/popup/icon-default.svg will be used
  popupMessage: "Try <b>AI-powered</b> search!",
  addUnreadDot: true,
  whitelabel: false,
  lang: "en-US",
  windowHeading: "Chat with AI Assistant",
  welcomeMessage: "👋 Hi! Ask me anything...",
  bottomIndent: 24,
  rightIndent: 24,
  zIndex: 99999,
  buttonSize: 64,
  macroName: '',
  autoOpen: false
}

export const defaultDelatFiveConfiguration: DeltaFiveConfiguration = {
  token: "",
  apiVersion: "/api/v2",
  streamGetAnswer: false,
  sourcePattern: "{ *doc_idx *: *([^}]*)}",
}

export const API_ROOT = window._env_?.API_ROOT || process.env.API_ROOT