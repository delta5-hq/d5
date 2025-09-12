import { Configuration, MessageType } from "../_interfaces"
import DeltaFiveApi from "../_lib/api"
import { MacroExecutor } from "../_lib/MacroExecutor"
import Compose from "./Compose"
import Footer from "./Footer"
import Header from "./Header"
import Message from "./Message"
import styles from "./styles.module.css"
import { FormEvent, useEffect, useRef } from "react"

const chatScreenIndent = 20

export default function Chat({
  configuration,
  deltafiveAPI,
  setIsCollapsed,
  isMobile,
  isExpanded,
  setIsExpanded,
  messages,
  setMessages,
  composeValue,
  setComposeValue,
  isMessageLoading,
  setIsMessageLoading,
  handleClearConversation,
}: {
  configuration: Configuration
  deltafiveAPI: DeltaFiveApi
  setIsCollapsed: (value: boolean) => void
  isMobile: boolean
  isExpanded: boolean
  setIsExpanded: (value: boolean) => void
  messages: MessageType[]
  setMessages: (value: MessageType[]) => void
  composeValue: string
  setComposeValue: (value: string) => void
  isMessageLoading: boolean
  setIsMessageLoading: (value: boolean) => void
  handleClearConversation: () => void
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }

  function handleCollapseButtonClick() {
    setIsCollapsed(true)
  }

  function handleResizeClick() {
    setIsExpanded(!isExpanded)
  }

  async function handleSubmitUserMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsMessageLoading(true)

    const newMessagesUser: MessageType[] = [...messages, { role: "user", content: composeValue }]
    setComposeValue("")
    setMessages(newMessagesUser)

    const newMessagesAssistant: MessageType[] = [...newMessagesUser, { role: "assistant", content: "" }]
    setMessages(newMessagesAssistant)

    const executor = new MacroExecutor(deltafiveAPI, configuration.macroName)
    const newContent = await executor.run(composeValue)
    
    const newMessages: MessageType[] = [...newMessagesAssistant]
    newMessages[newMessages.length - 1].content = newContent
    setMessages(newMessages)

    setIsMessageLoading(false)
  }

  return (
    <div
      className={`${styles.chat} ${
        isMobile
          ? styles.chatMobile
          : `${styles.chatDesktop} ${isExpanded ? styles.chatDesktopExpanded : styles.chatDesktopNormal}`
      }`}
      style={{
        bottom: isMobile ? 0 : configuration.bottomIndent + configuration.buttonSize + configuration.buttonSize / 8,
        right: isMobile ? 0 : configuration.rightIndent,
        borderRadius: isMobile ? "0px" : "16px",
        zIndex: configuration.zIndex,
        width: isMobile
          ? "100%"
          : isExpanded
          ? `calc(100vw - ${configuration.rightIndent + chatScreenIndent}px)`
          : "450px",
        height: isMobile
          ? "100%"
          : isExpanded
          ? `calc(100vh - ${
              configuration.bottomIndent + configuration.buttonSize + configuration.buttonSize / 8 + chatScreenIndent
            }px)`
          : "650px",
        maxWidth: isMobile ? "unset" : `calc(100vw - ${configuration.rightIndent + chatScreenIndent}px)`,
        maxHeight: isMobile
          ? "unset"
          : `calc(100vh - ${
              configuration.bottomIndent + configuration.buttonSize + configuration.buttonSize / 8 + chatScreenIndent
            }px)`,
      }}
    >
      <Header
        configuration={configuration}
        onClearButtonClick={handleClearConversation}
        isMobile={isMobile}
        onCollapseButtonClick={handleCollapseButtonClick}
      />
      <div className={styles.content}>
        {messages.map((message, index) => {
          return (
            <Message
              key={index}
              message={message}
              selectedColor={"#" + configuration.color}
              isFirst={index === 0}
              isLast={messages.length - 1 === index}
              isLoading={isMessageLoading}
              deltafiveAPI={deltafiveAPI}
            />
          )
        })}
        <div ref={messagesEndRef} />
      </div>
      <Compose
        configuration={configuration}
        composeValue={composeValue}
        setComposeValue={setComposeValue}
        isLoading={isMessageLoading}
        onSubmitUserMessage={handleSubmitUserMessage}
        onResizeClick={handleResizeClick}
        isMobile={isMobile}
      />
      {!configuration.whitelabel && <Footer />}
    </div>
  )
}
