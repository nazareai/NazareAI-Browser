import React, { useState } from 'react'
import { useAIStore } from '../stores/aiStore'

const MCPManager: React.FC = () => {
  const [mcpUrl, setMcpUrl] = useState('')
  const { mcpServers, addMcpServer } = useAIStore()

  const handleConnectMcp = async () => {
    if (mcpUrl) {
      try {
        await window.electronAPI.connectMcpServer(mcpUrl)
        addMcpServer(mcpUrl)
        setMcpUrl('')
      } catch (error) {
        console.error('Failed to connect MCP:', error)
      }
    }
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">MCP Server Manager</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={mcpUrl}
          onChange={(e) => setMcpUrl(e.target.value)}
          placeholder="Enter MCP Server URL"
          className="flex-1 border rounded p-2"
        />
        <button 
          onClick={handleConnectMcp}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Connect
        </button>
      </div>
      <h3 className="font-semibold mb-2">Connected Servers:</h3>
      <ul className="border rounded divide-y">
        {mcpServers.map((url, index) => (
          <li key={index} className="p-2">
            {url}
          </li>
        ))}
        {mcpServers.length === 0 && (
          <li className="p-2 text-gray-500">No servers connected</li>
        )}
      </ul>
    </div>
  )
}

export default MCPManager 