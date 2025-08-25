import React, { useState, useEffect, useRef } from 'react'
import { Send, Settings, X, MessageCircle, Loader, Bot, User, Clock, Globe, ChevronDown, ChevronUp, Trash2, History, AlertCircle, CheckCircle, XCircle, FileText, Zap, File as FileIcon } from 'lucide-react'
import { useAIStore } from '../stores/aiStore'
import { useBrowserStore } from '../stores/browserStore'
import APIKeyManager from './APIKeyManager'

interface AIChatProps {
  onClose: () => void
}

const AIChat: React.FC<AIChatProps> = ({ onClose }) => {
  const [message, setMessage] = useState('')
  const [usePageContext, setUsePageContext] = useState(true)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showDomainHistory, setShowDomainHistory] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  
  const { 
    isConnected, 
    streamChat, 
    activeProvider, 
    providers, 
    isLoading, 
    streamingMessageId,
    browserControlEnabled,
    setBrowserControlEnabled,
    switchToDomain,
    getCurrentDomainChat,
    getAllDomainChats,
    detectPageType,
    clearDomainChat,
    currentDomain
  } = useAIStore()
  
  const { getCurrentPageContent, currentTab } = useBrowserStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const activeProviderData = providers.find(p => p.id === activeProvider)
  const currentModel = activeProviderData?.selectedModel || activeProviderData?.models[0]
  const domainChat = getCurrentDomainChat()
  const allDomainChats = getAllDomainChats()
  const currentPageType = currentTab?.url ? detectPageType(currentTab.url) : 'unknown'
  const isPDF = currentPageType === 'pdf'

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [domainChat?.messages, forceUpdate])

  // Auto-switch domain when tab changes
  useEffect(() => {
    if (!currentTab || currentTab.url === 'about:blank' || !currentTab.url) {
      // Clear domain when no tab or about:blank
      if (currentDomain) {
        switchToDomain('', '', 'unknown')
      }
    } else {
      try {
        const url = new URL(currentTab.url)
        const domain = url.hostname
        const pageType = detectPageType(currentTab.url)
        
        if (domain !== currentDomain) {
          switchToDomain(domain, currentTab.url, pageType)
        }
      } catch (error) {
        console.error('Failed to parse URL:', error)
      }
    }
  }, [currentTab?.url, currentTab?.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !isConnected || isLoading) return

    console.log('🔵 Chat Submit:', { 
      message: message.trim(), 
      isPDF, 
      currentTab: currentTab?.url, 
      usePageContext,
      currentDomain 
    })

    let context = ''
    
    // Get page context if enabled, there's a current tab, and not on about:blank
    if (usePageContext && currentTab?.url && currentTab.url !== 'about:blank' && currentDomain) {
      setIsLoadingContext(true)
      try {
        console.log('🔵 Getting page content for context...')
        context = await getCurrentPageContent()
        console.log('🔵 Page content retrieved:', { 
          contextLength: context.length, 
          contextPreview: context.slice(0, 200) + '...' 
        })
      } catch (error) {
        console.error('❌ Failed to get page content:', error)
        context = '[Page context extraction failed]'
      }
      setIsLoadingContext(false)
    }

    try {
      const userMessage = message
      setMessage('')
      console.log('🔵 Starting stream chat...', { userMessage, contextLength: context.length })
      await streamChat(userMessage, context)
      setForceUpdate(prev => prev + 1)
      console.log('🔵 Stream chat completed')
    } catch (error) {
      console.error('❌ Chat error:', error)
      // Show error to user
      alert(`Chat error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const renderBrowserActions = (message: any) => {
    if (!message.actions || !message.actionResults) return null

    return (
      <div className="mt-2 p-2 bg-gray-100 rounded-md text-xs">
        <div className="flex items-center gap-1 mb-1">
          <Globe className="w-3 h-3 text-blue-500" />
          <span className="font-medium text-gray-700">Browser Actions</span>
        </div>
        {message.actions.map((action: any, index: number) => {
          const result = message.actionResults[index]
          return (
            <div key={index} className="flex items-center gap-2 text-xs">
              {result?.success ? (
                <CheckCircle className="w-3 h-3 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500" />
              )}
              <span className="capitalize">{action.type}</span>
              {action.url && <span className="text-gray-500">→ {action.url}</span>}
              {action.query && <span className="text-gray-500">"{action.query}"</span>}
              {result && (
                <span className={`text-xs ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                  {result.message}
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const getCurrentDomainDisplay = () => {
    if (!currentDomain) {
      return (
        <div className="flex items-center gap-1 text-gray-500">
          <Globe className="w-3 h-3" />
          <span>No tab open</span>
        </div>
      )
    }
    
    let icon = <Globe className="w-3 h-3" />
    let typeLabel = ''
    
    switch (currentPageType) {
      case 'pdf':
        icon = <FileIcon className="w-3 h-3 text-red-500" />
        typeLabel = 'PDF'
        break
      case 'image':
        icon = <FileText className="w-3 h-3 text-blue-500" />
        typeLabel = 'Image'
        break
      case 'video':
        icon = <FileText className="w-3 h-3 text-purple-500" />
        typeLabel = 'Video'
        break
      default:
        typeLabel = 'Web'
    }
    
    return (
      <div className="flex items-center gap-1">
        {icon}
        <span className="truncate max-w-[120px]">{currentDomain}</span>
        {typeLabel && (
          <span className="text-[9px] bg-gray-200 px-1 rounded">{typeLabel}</span>
        )}
      </div>
    )
  }

  // In component
  const handleSummarizeYouTube = async () => {
    if (currentPageType === 'video') {
      const content = await getCurrentPageContent()
      const summary = await streamChat(`Summarize this YouTube video transcript: ${content}`)
      // Display summary in chat
    }
  }

  const effectiveMessages = domainChat ? domainChat.messages : useAIStore.getState().chatHistory

  return (
    <div className="flex flex-col h-full bg-white/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm">AI Assistant</h3>
            {activeProviderData && (
              <p className="text-[10px] text-gray-600 mt-0.5">
                {activeProviderData.name} • {currentModel}
                {browserControlEnabled && (
                  <span className="ml-1 text-blue-600">• Browser Control</span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {allDomainChats.length > 1 && (
            <button
              onClick={() => setShowDomainHistory(!showDomainHistory)}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Domain Chat History"
            >
              <Clock className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Domain Context */}
      <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-700">
            {getCurrentDomainDisplay()}
          </div>
          {domainChat && currentDomain && (
            <button
              onClick={() => currentDomain && clearDomainChat(currentDomain)}
              className="text-[10px] text-red-500 hover:text-red-700"
            >
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* Domain History Dropdown */}
      {showDomainHistory && (
        <div className="border-b border-gray-200 bg-gray-50 max-h-32 overflow-y-auto">
          {allDomainChats.map((chat) => (
            <button
              key={chat.domain}
              onClick={() => {
                switchToDomain(chat.domain, chat.title, chat.pageType)
                setShowDomainHistory(false)
              }}
              className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-100 border-l-2 ${
                chat.domain === currentDomain ? 'border-blue-500 bg-blue-50' : 'border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {chat.pageType === 'pdf' ? (
                    <FileIcon className="w-3 h-3 text-red-500" />
                  ) : (
                    <Globe className="w-3 h-3" />
                  )}
                  <span className="font-medium truncate max-w-[100px]">{chat.domain}</span>
                </div>
                <span className="text-gray-500">({chat.messages.length} msgs)</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={browserControlEnabled}
                onChange={(e) => setBrowserControlEnabled(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Enable browser control</span>
              </span>
            </label>
            <p className="text-[10px] text-gray-500 ml-5">
              {isPDF 
                ? "Enhanced PDF support: content extraction, analysis, and navigation"
                : "Let AI navigate pages, search, extract content, and control browser actions"
              }
            </p>
          </div>
        </div>
      )}

      {/* Page Context Toggle */}
      {currentTab?.url && currentTab.url !== 'about:blank' && currentDomain && (
        <div className="px-4 py-2 border-b border-gray-200">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={usePageContext}
              onChange={(e) => setUsePageContext(e.target.checked)}
              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              <span>{isPDF ? 'Include PDF content' : 'Include page context'}</span>
            </span>
          </label>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" key={forceUpdate}>
        {effectiveMessages.length === 0 ? (
          <div className="text-center text-gray-600">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-1">
                {isPDF ? 'PDF Assistant Ready!' : 'Ready to chat!'}
              </h4>
              <p className="text-xs mb-2">
                {!isConnected 
                  ? "Please configure an AI provider in settings first."
                  : !currentDomain
                  ? "No tab is currently open. Create a new tab or open a website to start chatting."
                  : isPDF
                  ? "I can help you discuss this PDF document."
                  : `Chat about ${currentDomain}.`
                }
              </p>
              {!isConnected && (
                <p className="text-[10px] text-red-500 mb-2">
                  Debug: Provider={activeProvider}, Connected={isConnected}
                </p>
              )}
              {!currentDomain && isConnected && (
                <button
                  onClick={() => {
                    // Add a new tab
                    const browserStore = useBrowserStore.getState()
                    browserStore.addTab('https://search.sh')
                  }}
                  className="mt-2 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-md hover:bg-blue-600 transition-colors"
                >
                  Open New Tab
                </button>
              )}
              {browserControlEnabled && !isPDF && currentDomain && (
                <div className="text-[10px] text-gray-500 space-y-1">
                  <p>I can help you with:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Navigate to websites ("go to google.com")</li>
                    <li>Search the web ("search for cats")</li>
                    <li>Extract page content ("get all links", "extract table data")</li>
                    <li>Control browser ("scroll down", "new tab")</li>
                    <li>Smart form filling ("fill the form")</li>
                    <li>Page analysis ("analyze this page", "summarize page")</li>
                    <li>Element interaction ("click the submit button")</li>
                    <li>Advanced automation ("take screenshot", "find forms")</li>
                  </ul>
                </div>
              )}
              {browserControlEnabled && !currentDomain && isConnected && (
                <div className="text-[10px] text-gray-500 space-y-1">
                  <p>Even without a tab, I can help you:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Navigate to any website ("go to youtube.com")</li>
                    <li>Search the web ("search for recipes")</li>
                    <li>Open new tabs with specific sites</li>
                    <li>Answer general questions</li>
                  </ul>
                </div>
              )}
              {isPDF && currentDomain && (
                <div className="text-[10px] text-gray-500 space-y-1">
                  <p>For PDFs, I can help with:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Read and analyze the complete PDF content</li>
                    <li>Answer questions about specific document details</li>
                    <li>Summarize sections or the entire document</li>
                    <li>Find specific information, quotes, or data</li>
                    <li>Explain concepts and technical content</li>
                    <li>Navigate to other pages</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {effectiveMessages.map((msg) => (
              <div key={msg.id}>
                <div
                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white ml-4 shadow-sm'
                      : 'bg-gray-50 text-gray-800 mr-4 border border-gray-200'
                  } ${msg.id === streamingMessageId ? 'animate-pulse' : ''}`}
                >
                  <p className="whitespace-pre-wrap">
                    {msg.content}
                    {msg.id === streamingMessageId && msg.content && (
                      <span className="inline-block w-1 h-3 bg-gray-600 ml-0.5 animate-blink"></span>
                    )}
                  </p>
                  {renderBrowserActions(msg)}
                </div>
              </div>
            ))}
            {isLoading && streamingMessageId && effectiveMessages.find(m => m.id === streamingMessageId)?.content === '' && (
              <div className="flex items-center gap-2 text-xs text-gray-500 ml-4">
                <Loader className="w-3 h-3 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              isConnected 
                ? isLoadingContext 
                  ? "Loading page context..." 
                  : isLoading
                  ? "Waiting for response..."
                  : isPDF
                  ? "Ask about this PDF..."
                  : browserControlEnabled
                  ? "Ask me anything or give me a command..."
                  : "Ask me anything..."
                : "Configure AI provider first"
            }
            disabled={!isConnected || isLoadingContext || isLoading}
            className="flex-1 px-3 py-2 text-xs text-gray-800 placeholder-gray-500 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          />
          <button
            type="submit"
            disabled={!message.trim() || !isConnected || isLoadingContext || isLoading}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500 transition-colors"
          >
            {isLoading ? (
              <Loader className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        {browserControlEnabled && !isPDF && (
          <div className="mt-2 text-[10px] text-gray-500">
            <p>💡 Try: "go to google.com", "search for weather", "extract all links", "scroll down"</p>
          </div>
        )}
        {isPDF && (
          <div className="mt-2 text-[10px] text-gray-500">
            <p>📄 PDF Mode: I can read and analyze this PDF content directly. Ask me anything about the document!</p>
          </div>
        )}
        {currentPageType === 'video' && (
          <button onClick={handleSummarizeYouTube}>Summarize Video</button>
        )}
      </form>
    </div>
  )
}

export default AIChat 