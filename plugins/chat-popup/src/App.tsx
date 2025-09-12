import Chat from "./Chat"
import PopupButton from "./PopupButton"
import { DeltaFiveConfiguration, Configuration, MessageType } from "./_interfaces"
import DeltaFiveApi from "./_lib/api"
import { defaultDelatFiveConfiguration, defaultConfiguration } from "./configuration"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"

const mobileWindowWidthThreshold = 450

function parseSearchParams(params: { [k: string]: string }): Partial<Configuration> {
  const parsed: Partial<Configuration> = { ...params }
  if (params.whitelabel !== undefined) parsed.whitelabel = params.whitelabel.toLowerCase() === "true"
  if (params.addUnreadDot !== undefined) parsed.addUnreadDot = params.addUnreadDot.toLowerCase() === "true"
  if (params.bottomIndent !== undefined) parsed.bottomIndent = parseInt(params.bottomIndent)
  if (params.rightIndent !== undefined) parsed.rightIndent = parseInt(params.rightIndent)
  if (params.zIndex !== undefined) parsed.zIndex = parseInt(params.zIndex)
  if (params.buttonSize !== undefined) parsed.buttonSize = parseInt(params.buttonSize)
  if (params.autoOpen === 'true') parsed.autoOpen = true
  return parsed
}

export default function App() {
  // State of Chat component live here to save it
  // during collapses
  const [searchParams, _setSearchParams] = useSearchParams()
  const [isCollapsed, setIsCollapsed] = useState(searchParams.get('autoOpen') !== 'true')
  const [hasInteracted, setHasInteracted] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<MessageType[]>([])
  const [composeValue, setComposeValue] = useState("")
  const [isMessageLoading, setIsMessageLoading] = useState(false)

  const configuration: Configuration = {
    ...defaultConfiguration,
    ...parseSearchParams(Object.fromEntries(window.deltaFiveQueryParams ?? searchParams)),
  }

  const deltafiveConfiguration: DeltaFiveConfiguration = {
    ...defaultDelatFiveConfiguration,
    token: configuration.token,
  }

  const deltafiveAPI = new DeltaFiveApi({ deltafiveConfiguration: deltafiveConfiguration })

  const messagesInitialState: MessageType[] = [{ role: "assistant", content: configuration.welcomeMessage }]

  function handleResize() {
    setIsMobile(window.innerWidth < mobileWindowWidthThreshold)
  }

  function handleClearConversation() {
    setMessages(messagesInitialState)
    localStorage.setItem(`deltafive-chat-history-${configuration.token}`, JSON.stringify(messagesInitialState))
  }

  useEffect(() => {
    const messagesHistory = localStorage.getItem(`deltafive-chat-history-${configuration.token}`)
    if (messagesHistory) {
      setMessages(JSON.parse(messagesHistory))
    } else {
      setMessages(messagesInitialState)
    }

    if (!localStorage.getItem(`deltafive-has-interacted-${configuration.token}`)) {
      setHasInteracted(false)
    }

    handleResize()
    window.addEventListener("resize", () => handleResize())
    return () => {
      window.removeEventListener("resize", () => handleResize())
    }
  }, [])

  useEffect(() => {
    if (messages.length) {
      localStorage.setItem(`deltafive-chat-history-${configuration.token}`, JSON.stringify(messages))
    }
  }, [messages, configuration.token])

  return (
    <>
      {configuration.token && (isCollapsed || !isMobile) && (
        <PopupButton
          configuration={configuration}
          deltafiveAPI={deltafiveAPI}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          hasInteracted={hasInteracted}
          setHasInteracted={setHasInteracted}
        />
      )}
      {configuration.token && !isCollapsed && (
        <Chat
          configuration={configuration}
          deltafiveAPI={deltafiveAPI}
          setIsCollapsed={setIsCollapsed}
          isMobile={isMobile}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          messages={messages}
          setMessages={setMessages}
          composeValue={composeValue}
          setComposeValue={setComposeValue}
          isMessageLoading={isMessageLoading}
          setIsMessageLoading={setIsMessageLoading}
          handleClearConversation={handleClearConversation}
        />
      )}
    </>
  )
}
