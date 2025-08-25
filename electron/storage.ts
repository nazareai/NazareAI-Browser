// @ts-ignore - electron-store types issue
import Store from 'electron-store'
import { safeStorage } from 'electron'

interface AIProvider {
  id: string
  name: string
  apiKey?: string
  baseUrl?: string
  models: string[]
  selectedModel?: string
  isActive: boolean
}

interface AppConfig {
  providers: AIProvider[]
  activeProvider: string | null
  browserControlEnabled: boolean
  searchEngine: string
  theme?: 'light' | 'dark'
  // Add other app settings here
}

class SecureStorage {
  private store: any // Using any due to TypeScript issues with electron-store
  
  constructor() {
    // @ts-ignore
    this.store = new Store<AppConfig>({
      name: 'nazareai-config',
      // Use default values instead of schema for simpler setup
      defaults: {
        providers: [],
        activeProvider: null,
        browserControlEnabled: true,
        searchEngine: 'https://search.sh',
        theme: 'light'
      },
      // Encrypt the entire store file
      encryptionKey: 'nazareai-browser-2024'
    })
  }

  // Securely store API keys
  setApiKey(providerId: string, apiKey: string) {
    try {
      // Use Electron's safeStorage for extra security
      const encrypted = safeStorage.isEncryptionAvailable() 
        ? safeStorage.encryptString(apiKey).toString('base64')
        : apiKey
      
      const providers = this.store.get('providers', [])
      const providerIndex = providers.findIndex((p: AIProvider) => p.id === providerId)
      
      if (providerIndex >= 0) {
        providers[providerIndex].apiKey = encrypted
        this.store.set('providers', providers)
      }
    } catch (error) {
      console.error('Failed to store API key:', error)
    }
  }

  // Retrieve and decrypt API keys
  getApiKey(providerId: string): string | null {
    try {
      const providers = this.store.get('providers', [])
      const provider = providers.find((p: AIProvider) => p.id === providerId)
      
      if (provider?.apiKey) {
        // Decrypt if it was encrypted
        if (safeStorage.isEncryptionAvailable()) {
          try {
            const decrypted = safeStorage.decryptString(Buffer.from(provider.apiKey, 'base64'))
            return decrypted
          } catch {
            // Fallback if not encrypted
            return provider.apiKey
          }
        }
        return provider.apiKey
      }
      
      return null
    } catch (error) {
      console.error('Failed to retrieve API key:', error)
      return null
    }
  }

  // Get all settings
  getAll(): AppConfig {
    return {
      providers: this.store.get('providers', []),
      activeProvider: this.store.get('activeProvider', null),
      browserControlEnabled: this.store.get('browserControlEnabled', true),
      searchEngine: this.store.get('searchEngine', 'https://search.sh'),
      theme: this.store.get('theme', 'light')
    }
  }

  // Update specific setting
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    this.store.set(key, value)
  }

  // Get specific setting
  get<K extends keyof AppConfig>(key: K): AppConfig[K] | undefined {
    return this.store.get(key)
  }

  // Clear all settings
  clear() {
    this.store.clear()
  }

  // Export settings (for backup)
  export(): string {
    return JSON.stringify(this.getAll(), null, 2)
  }

  // Import settings (from backup)
  import(data: string) {
    try {
      const parsed = JSON.parse(data) as AppConfig
      
      // Set each property individually
      if (parsed.providers) {
        this.store.set('providers', parsed.providers)
      }
      if (parsed.activeProvider !== undefined) {
        this.store.set('activeProvider', parsed.activeProvider)
      }
      if (parsed.browserControlEnabled !== undefined) {
        this.store.set('browserControlEnabled', parsed.browserControlEnabled)
      }
      if (parsed.searchEngine) {
        this.store.set('searchEngine', parsed.searchEngine)
      }
      if (parsed.theme) {
        this.store.set('theme', parsed.theme)
      }
    } catch (error) {
      console.error('Failed to import settings:', error)
    }
  }
}

// Singleton instance
let storage: SecureStorage | null = null

export function getStorage(): SecureStorage {
  if (!storage) {
    storage = new SecureStorage()
  }
  return storage
}

// IPC handlers for renderer process
export function setupStorageHandlers(ipcMain: any) {
  const store = getStorage()
  
  ipcMain.handle('storage:get', (event: any, key: string) => {
    return store.get(key as keyof AppConfig)
  })
  
  ipcMain.handle('storage:set', (event: any, key: string, value: any) => {
    store.set(key as keyof AppConfig, value)
  })
  
  ipcMain.handle('storage:getApiKey', (event: any, providerId: string) => {
    return store.getApiKey(providerId)
  })
  
  ipcMain.handle('storage:setApiKey', (event: any, providerId: string, apiKey: string) => {
    store.setApiKey(providerId, apiKey)
  })
  
  ipcMain.handle('storage:getAll', () => {
    return store.getAll()
  })
  
  ipcMain.handle('storage:clear', () => {
    store.clear()
  })
} 