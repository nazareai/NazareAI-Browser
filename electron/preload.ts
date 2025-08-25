import { contextBridge, ipcRenderer } from 'electron'

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Browser functionality
  navigateTo: (url: string) => ipcRenderer.invoke('navigate-to', url),
  goBack: () => ipcRenderer.invoke('go-back'),
  goForward: () => ipcRenderer.invoke('go-forward'),
  reload: () => ipcRenderer.invoke('reload'),
  
  // AI functionality
  getPageContent: (url: string) => ipcRenderer.invoke('get-page-content', url),
  chatWithPage: (message: string, pageContent: string) => 
    ipcRenderer.invoke('chat-with-page', message, pageContent),
  
  // Secure storage API
  storage: {
    get: (key: string) => ipcRenderer.invoke('storage:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('storage:set', key, value),
    getApiKey: (providerId: string) => ipcRenderer.invoke('storage:getApiKey', providerId),
    setApiKey: (providerId: string, apiKey: string) => 
      ipcRenderer.invoke('storage:setApiKey', providerId, apiKey),
    getAll: () => ipcRenderer.invoke('storage:getAll'),
    clear: () => ipcRenderer.invoke('storage:clear')
  },
  
  // Legacy API key management (for backward compatibility)
  storeApiKey: (provider: string, key: string) => 
    ipcRenderer.invoke('storage:setApiKey', provider, key),
  getApiKey: (provider: string) => 
    ipcRenderer.invoke('storage:getApiKey', provider),
  
  // MCP functionality
  connectMcpServer: (serverUrl: string) => 
    ipcRenderer.invoke('connect-mcp-server', serverUrl),
  getMcpCapabilities: () => 
    ipcRenderer.invoke('get-mcp-capabilities'),
  
  // Window management
  newTab: () => ipcRenderer.invoke('new-tab'),
  closeTab: (tabId: string) => ipcRenderer.invoke('close-tab', tabId),
  switchTab: (tabId: string) => ipcRenderer.invoke('switch-tab', tabId),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),
  
  // Event listeners
  onTabUpdate: (callback: Function) => 
    ipcRenderer.on('tab-updated', (event, data) => callback(data)),
  onPageLoad: (callback: Function) => 
    ipcRenderer.on('page-loaded', (event, data) => callback(data)),
  onCreateNewTab: (callback: Function) => 
    ipcRenderer.on('create-new-tab', (event, url) => callback(url)),
  onWebViewCrash: (callback: Function) =>
    ipcRenderer.on('webview-crashed', (event, data) => callback(data)),
  onWebViewLoadFailed: (callback: Function) =>
    ipcRenderer.on('webview-load-failed', (event, data) => callback(data)),
  onCloudflareChallenge: (callback: Function) =>
    ipcRenderer.on('cloudflare-challenge', (event, data) => callback(data)),
})

// Expose type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      navigateTo: (url: string) => Promise<void>
      goBack: () => Promise<void>
      goForward: () => Promise<void>
      reload: () => Promise<void>
      getPageContent: (url: string) => Promise<{ content: string; url: string }>
      chatWithPage: (message: string, pageContent: string) => Promise<string>
      storage: {
        get: (key: string) => Promise<any>
        set: (key: string, value: any) => Promise<void>
        getApiKey: (providerId: string) => Promise<string | null>
        setApiKey: (providerId: string, apiKey: string) => Promise<void>
        getAll: () => Promise<any[]>
        clear: () => Promise<void>
      }
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
      onCreateNewTab: (callback: Function) => void
      onWebViewCrash: (callback: Function) => void
      onWebViewLoadFailed: (callback: Function) => void
      onCloudflareChallenge: (callback: Function) => void
    }
  }
} 