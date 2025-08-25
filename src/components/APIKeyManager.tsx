import React, { useState } from 'react'
import { Key, Check, X, AlertCircle, Eye, EyeOff, TestTube, ChevronDown, LogOut } from 'lucide-react'
import { useAIStore } from '../stores/aiStore'

const APIKeyManager: React.FC = () => {
  const { providers, activeProvider, updateProvider, setActiveProvider, testConnection, disconnectProvider } = useAIStore()
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  const handleKeyChange = (providerId: string, apiKey: string) => {
    updateProvider(providerId, { apiKey })
  }

  const handleModelChange = (providerId: string, model: string) => {
    updateProvider(providerId, { selectedModel: model })
  }

  const handleTestConnection = async (providerId: string) => {
    setTesting({ ...testing, [providerId]: true })
    try {
      const result = await testConnection(providerId)
      if (result) {
        // Auto-select provider if connection successful and no active provider
        if (!activeProvider) {
          setActiveProvider(providerId)
        }
      }
    } finally {
      setTesting({ ...testing, [providerId]: false })
    }
  }

  const toggleKeyVisibility = (providerId: string) => {
    setShowKeys({ ...showKeys, [providerId]: !showKeys[providerId] })
  }

  const maskApiKey = (key: string) => {
    if (!key || key.length < 8) return key
    return `${key.slice(0, 4)}${'•'.repeat(20)}${key.slice(-4)}`
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">API Key Management</h2>
        <p className="text-xs text-gray-600">Configure your AI provider API keys to enable AI features.</p>
      </div>

      <div className="space-y-3">
        {providers.map((provider) => {
          // Get the actual current provider data to ensure we have the latest models
          const currentProvider = providers.find(p => p.id === provider.id) || provider
          
          return (
          <div
            key={provider.id}
            className={`bg-white/80 backdrop-blur-sm border rounded-lg p-4 transition-all duration-200 ${
              provider.isActive ? 'border-green-300 shadow-md shadow-green-50' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${
                  provider.isActive ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <Key className={`w-3.5 h-3.5 ${
                    provider.isActive ? 'text-green-600' : 'text-gray-500'
                  }`} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-800 text-sm">{provider.name}</h3>
                  <p className="text-[10px] text-gray-500">
                    {currentProvider.models.length} models available
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {provider.isActive && (
                  <span className="flex items-center gap-1 text-green-600 text-xs">
                    <Check className="w-3 h-3" />
                    <span>Connected</span>
                  </span>
                )}
                {activeProvider === provider.id && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">
                    Active
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showKeys[provider.id] ? 'text' : 'password'}
                  value={provider.apiKey || ''}
                  onChange={(e) => handleKeyChange(provider.id, e.target.value)}
                  placeholder={`Enter your ${provider.name} API key...`}
                  className="w-full px-3 py-2 pr-20 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                />
                <button
                  onClick={() => toggleKeyVisibility(provider.id)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showKeys[provider.id] ? (
                    <EyeOff className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                </button>
                <button
                  onClick={() => handleTestConnection(provider.id)}
                  disabled={!provider.apiKey || testing[provider.id]}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  title="Test connection"
                >
                  <TestTube className={`w-3 h-3 ${testing[provider.id] ? 'animate-pulse' : ''}`} />
                </button>
              </div>

              {/* Model Selection */}
              {provider.models.length > 1 && (
                <div className="relative">
                  <select
                    value={provider.selectedModel || provider.models[0]}
                    onChange={(e) => handleModelChange(provider.id, e.target.value)}
                    className="w-full px-3 py-2 pr-8 bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer text-xs"
                    disabled={!provider.apiKey || !provider.isActive}
                  >
                    <option value="" disabled>Select a model</option>
                    {provider.models.map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-[10px] text-gray-500">
                  {provider.apiKey && (
                    <span>Key: {maskApiKey(provider.apiKey)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {provider.apiKey && !provider.isActive && activeProvider !== provider.id && (
                    <button
                      onClick={() => setActiveProvider(provider.id)}
                      className="text-[10px] text-blue-600 hover:text-blue-700"
                    >
                      Set as active
                    </button>
                  )}
                  {provider.apiKey && (
                    <button
                      onClick={() => disconnectProvider(provider.id)}
                      className="flex items-center gap-1 text-[10px] text-red-600 hover:text-red-700"
                      title="Disconnect and clear API key"
                    >
                      <LogOut className="w-3 h-3" />
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            </div>

            {provider.baseUrl && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-500">
                  Base URL: {provider.baseUrl}
                </p>
              </div>
            )}
          </div>
          )
        })}
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-medium mb-0.5">Security Notice</p>
            <p className="text-[10px]">Your API keys are stored locally and encrypted. Never share your API keys with others.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default APIKeyManager 