export {}

declare global {
  interface Window {
    electronAPI: {
      navigateTo: (url: string) => Promise<void>
      goBack: () => Promise<void>
      goForward: () => Promise<void>
      reload: () => Promise<void>
      getPageContent: (url: string) => Promise<{ content: string; url: string }>
      chatWithPage: (message: string, pageContent: string) => Promise<string>
      storeApiKey: (provider: string, key: string) => Promise<{ success: boolean }>
      getApiKey: (provider: string) => Promise<string | null>
      connectMcpServer: (serverUrl: string) => Promise<boolean>
      getMcpCapabilities: () => Promise<any[]>
      newTab: () => Promise<string>
      closeTab: (tabId: string) => Promise<void>
      switchTab: (tabId: string) => Promise<void>
      getSettings: () => Promise<any>
      updateSettings: (settings: any) => Promise<void>
      onTabUpdate: (callback: Function) => void
      onPageLoad: (callback: Function) => void
    }
  }
} 