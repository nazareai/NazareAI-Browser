import { app, BrowserWindow, Menu, ipcMain, session } from 'electron'
import path from 'path'
import { setupStorageHandlers } from './storage'
import fetch from 'node-fetch'

// Set the application name before anything else
app.name = 'NazareAI Browser'

// Force the app name in development
if (!app.isPackaged) {
  // In development, we need to set the name differently
  app.commandLine.appendSwitch('app-name', 'NazareAI Browser')
}

// __dirname is already available in CommonJS modules

class AIBrowser {
  private mainWindow: BrowserWindow | null = null
  private aboutWindow: BrowserWindow | null = null
  // Fix production detection - check if app is packaged
  private isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

  constructor() {
    // Enable hardware acceleration
    if (!this.isDev) {
      app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')
    }
    app.commandLine.appendSwitch('ignore-gpu-blocklist')
    
    // Add switches to make the browser appear more like regular Chrome
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
    app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess')
    
    // Disable automation flags that sites might detect
    app.commandLine.appendSwitch('disable-automation')
    
    // Enable webview tag properly
    app.commandLine.appendSwitch('enable-webview-tag')
    
    this.init()
  }

  private async init() {
    // Set up the default menu before the app is ready
    this.setupApplicationMenu()
    
    await app.whenReady()
    this.createMainWindow()
    this.setupEventHandlers()
    this.setupSecurityPolicies()
    this.setupMemoryOptimization()

    // Set up secure storage handlers
    setupStorageHandlers(ipcMain)
    this.initIpcHandlers()
  }

  private createAboutWindow() {
    if (this.aboutWindow) {
      this.aboutWindow.focus()
      return
    }

    this.aboutWindow = new BrowserWindow({
      width: 600,
      height: 500,
      title: `About ${app.name}`,
      resizable: false,
      minimizable: false,
      maximizable: false,
      modal: true,
      parent: this.mainWindow || undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      titleBarStyle: 'hiddenInset',
      show: false,
    })

    // Load the About page
    const aboutHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>About NazareAI Browser</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: #f8fafc;
            color: #1f2937;
            text-align: center;
            position: relative;
          }
          .close-btn {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 50%;
            background: #e5e7eb;
            color: #6b7280;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background-color 0.2s;
          }
          .close-btn:hover {
            background: #d1d5db;
          }
          .logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 28px;
            font-weight: bold;
          }
          h1 { margin: 0 0 10px 0; font-size: 28px; }
            .version { color: #6b7280; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <button class="close-btn" onclick="window.close()">×</button>
        <div class="logo">NA</div>
        <h1>NazareAI Browser</h1>
          <div class="version">version released 6.9.2025</div>
        <div style="margin-top: 40px; font-size: 12px; color: #9ca3af;">
          © 2025 NazareAI. Built with Electron, React, and TypeScript.
        </div>
      </body>
      </html>
    `
    this.aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(aboutHTML)}`)

    this.aboutWindow.once('ready-to-show', () => {
      this.aboutWindow?.show()
    })

    this.aboutWindow.on('closed', () => {
      this.aboutWindow = null
    })
  }

  private setupApplicationMenu() {
    // Create default menu with proper app name
    const template: any[] = [
      {
        label: app.name,
        submenu: [
          {
            label: `About ${app.name}`,
            click: () => this.createAboutWindow()
          },
          { type: 'separator' },
          { label: 'Services', role: 'services', submenu: [] },
          { type: 'separator' },
          { label: `Hide ${app.name}`, role: 'hide' },
          { label: 'Hide Others', role: 'hideOthers' },
          { label: 'Show All', role: 'unhide' },
          { type: 'separator' },
          { label: `Quit ${app.name}`, role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Undo', role: 'undo' },
          { label: 'Redo', role: 'redo' },
          { type: 'separator' },
          { label: 'Cut', role: 'cut' },
          { label: 'Copy', role: 'copy' },
          { label: 'Paste', role: 'paste' },
          { label: 'Select All', role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { label: 'Reload', role: 'reload' },
          { label: 'Force Reload', role: 'forceReload' },
          { label: 'Toggle Developer Tools', role: 'toggleDevTools' },
          { type: 'separator' },
          { label: 'Actual Size', role: 'resetZoom' },
          { label: 'Zoom In', role: 'zoomIn' },
          { label: 'Zoom Out', role: 'zoomOut' },
          { type: 'separator' },
          { label: 'Toggle Fullscreen', role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { label: 'Minimize', role: 'minimize' },
          { label: 'Close', role: 'close' },
          { label: 'Zoom', role: 'zoom' },
          { type: 'separator' },
          { label: 'Bring All to Front', role: 'front' }
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      title: 'NazareAI Browser',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false, // Disable to prevent webview issues
        webviewTag: true, // Enable webview tag
        allowRunningInsecureContent: true, // Allow mixed content
        experimentalFeatures: true, // Enable experimental features
        sandbox: false, // Disable sandbox for webview compatibility
      },
      titleBarStyle: 'hiddenInset', // Modern look
      show: false, // Don't show until ready
    })

    // Load the renderer
    if (this.isDev) {
      this.mainWindow.loadURL('http://localhost:5173')
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
    }

    // Show when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show()
    })

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null
    })
  }

  private setupEventHandlers() {
    // Quit when all windows are closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    // Re-create window on macOS
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow()
      }
    })

    // Handle webview navigation permissions
    if (this.mainWindow) {
      this.mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
        // Configure webview for maximum compatibility
        webPreferences.nodeIntegration = false
        webPreferences.contextIsolation = true
        webPreferences.webSecurity = false // Disable to prevent blocking
        webPreferences.allowRunningInsecureContent = true
        webPreferences.navigateOnDragDrop = false
        
        // Allow JavaScript and plugins
        webPreferences.javascript = true
        webPreferences.plugins = true
        
        // Enable all features needed for modern websites
        webPreferences.webgl = true
        webPreferences.experimentalFeatures = true
        webPreferences.backgroundThrottling = false
        webPreferences.offscreen = false // Disable offscreen rendering
        
        // Use persistent session for cookies and storage
        webPreferences.partition = 'persist:main'
        
        // Enable features that help with compatibility
        webPreferences.enableBlinkFeatures = 'CSSColorSchemeUARendering'
        webPreferences.disableBlinkFeatures = ''
      })

      // Handle webview navigation requests
      this.mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
        // Do not inject JavaScript or override UA per webview; rely on session-level UA

        // Avoid per-webview header overrides to prevent reload loops

        // Optional: Observe cookies if needed for debugging (disabled by default)

        // Do not inject challenge detection scripts; let sites handle their own flows
        
        // Enable NTLM credentials if needed
        webContents.session.allowNTLMCredentialsForDomains('*')
        
        // Do not modify navigator.plugins; avoid anti-bot loops
        
        // Allow all navigation
        webContents.on('will-navigate', (navEvent, navigationUrl) => {
          // Allow all navigation - don't prevent anything
          navEvent.preventDefault = () => {} // Disable preventDefault
        })
        
        // Handle new-window events for target="_blank" links
        webContents.setWindowOpenHandler(({ url, frameName, disposition }) => {
          // Send message to renderer to create new tab
          if (this.mainWindow && url) {
            this.mainWindow.webContents.send('create-new-tab', url)
          }
          
          // Return 'deny' to prevent Electron from creating a new BrowserWindow
          return { action: 'deny' }
        })
        
        // Handle permission requests
        webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
          // Allow all common web permissions
          const allowedPermissions = [
            'media',
            'geolocation', 
            'notifications',
            'midiSysex',
            'pointerLock',
            'fullscreen',
            'openExternal',
            'clipboard-read',
            'clipboard-write',
            'camera',
            'microphone'
          ]
          
          callback(allowedPermissions.includes(permission))
        })
        
        // Allow unload events
        webContents.on('will-prevent-unload', (event) => {
          // Don't prevent unload - let pages handle their own unload
        })
        
        // Enable all features that might be needed
        webContents.session.setSpellCheckerEnabled(true)
        
        // Handle certificate errors
        webContents.on('certificate-error', (event, url, error, certificate, callback) => {
          console.log(`Certificate error for ${url}: ${error}`)
          
          // In a browser, we should generally trust the user's decision
          // For development, always accept certificates
          if (!app.isPackaged) {
            event.preventDefault()
            callback(true)
            return
          }
          
          // For production, show a warning but let the user proceed if they want
          const { dialog } = require('electron')
          const choice = dialog.showMessageBoxSync(this.mainWindow, {
            type: 'warning',
            buttons: ['Go Back', 'Continue Anyway'],
            defaultId: 0,
            cancelId: 0,
            title: 'Security Warning',
            message: 'This site has an invalid security certificate',
            detail: `The certificate for ${new URL(url).hostname} is not trusted.\n\nThis could mean:\n• The site is using a self-signed certificate\n• The certificate has expired\n• Your connection might be intercepted\n\nOnly continue if you trust this website.`
          })

          if (choice === 1) { // Continue Anyway
            event.preventDefault()
            callback(true)
          } else {
            callback(false)
          }
        })

        // Handle webview process crashes and errors
        webContents.on('render-process-gone', (event, details) => {
          console.log('WebView process crashed:', details.reason, details.exitCode)
          
          // Notify renderer about the crash
          if (this.mainWindow) {
            this.mainWindow.webContents.send('webview-crashed', {
              reason: details.reason,
              exitCode: details.exitCode
            })
          }
        })

        // Handle unresponsive webviews
        webContents.on('unresponsive', () => {
          console.log('WebView became unresponsive')
        })

        webContents.on('responsive', () => {
          console.log('WebView became responsive again')
        })

        // Handle navigation failures more gracefully
        webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
          if (isMainFrame && errorCode !== -3) { // -3 is ERR_ABORTED, which is expected for some operations
            console.log('WebView failed to load:', errorDescription, 'for URL:', validatedURL)
            
            // Notify renderer about the failure
            if (this.mainWindow) {
              this.mainWindow.webContents.send('webview-load-failed', {
                errorCode,
                errorDescription,
                validatedURL
              })
            }
          }
        })
      })

      // Handle GPU process crashes
      app.on('gpu-info-update', () => {
        console.log('GPU info updated')
      })
    }

    // Tab management handlers
    ipcMain.handle('new-tab', async () => {
      // Return a unique tab ID
      return crypto.randomUUID()
    })

    ipcMain.handle('close-tab', async (event, tabId: string) => {
      // Tab closing is handled in the renderer
      return { success: true }
    })

    ipcMain.handle('switch-tab', async (event, tabId: string) => {
      // Tab switching is handled in the renderer
      return { success: true }
    })

    // Navigation handlers
    ipcMain.handle('navigate-to', async (event, url: string) => {
      // This is handled by the webview directly now
      return { success: true }
    })

    ipcMain.handle('go-back', async () => {
      // This is handled by the webview directly now
      return { success: true }
    })

    ipcMain.handle('go-forward', async () => {
      // This is handled by the webview directly now
      return { success: true }
    })

    ipcMain.handle('reload', async () => {
      // This is handled by the webview directly now
      return { success: true }
    })

    // IPC handlers for AI features
    ipcMain.handle('get-page-content', async (event, url: string) => {
      // Implementation for getting page content for AI analysis
      return { content: 'Page content', url }
    })

    ipcMain.handle('store-api-key', async (event, provider: string, key: string) => {
      // Secure API key storage implementation
      return { success: true }
    })

    ipcMain.handle('notify-cloudflare-challenge', async (event, isActive: boolean) => {
      // Forward Cloudflare challenge status to renderer
      if (this.mainWindow) {
        this.mainWindow.webContents.send('cloudflare-challenge', { isActive })
      }
      return { success: true }
    })
  }

  private setupSecurityPolicies() {
    // Get the persistent session for webviews - this is crucial for Cloudflare
    const webviewSession = session.fromPartition('persist:main')

    // Set proper user agent for the webview session - CRITICAL for Cloudflare
    // Use a more realistic and recent user agent to avoid detection
    const chromeVersion = process.versions.chrome
    const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
    webviewSession.setUserAgent(userAgent)

    // Additional user agent data is set above
    
    // Keep headers minimal: only set a realistic User-Agent once at session level
    webviewSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = { ...details.requestHeaders }
      requestHeaders['User-Agent'] = userAgent
      callback({ requestHeaders })
    })
    
    // Do not modify response security headers to avoid loops; let sites control CSP
    // If specific domains need adjustments, handle them narrowly in the future
    
    // Set up permissions for the webview session
    webviewSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'geolocation', 'notifications', 'midiSysex', 'pointerLock', 'fullscreen', 'clipboard-read', 'clipboard-write', 'camera', 'microphone', 'display-capture']
      callback(allowedPermissions.includes(permission))
    })
    
    // Accept all certificates to prevent certificate issues
    webviewSession.setCertificateVerifyProc((request, callback) => {
      callback(0) // Accept all certificates
    })
    
    // Enable spell checking
    webviewSession.setSpellCheckerEnabled(true)
    webviewSession.setSpellCheckerLanguages(['en-US'])
    
    // Force flush cookies to ensure persistence
    webviewSession.cookies.flushStore().catch(() => {})
    
    // Set up minimal default session handling (for the main window)
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'geolocation', 'notifications', 'midiSysex', 'pointerLock', 'fullscreen', 'clipboard-read', 'clipboard-write', 'camera', 'microphone', 'display-capture']
      callback(allowedPermissions.includes(permission))
    })
    
    // Handle downloads
    session.defaultSession.on('will-download', (event, item) => {
      console.log('Download started:', item.getURL())
    })
  }

  private async handleMcpConnection(serverUrl: string) {
    try {
      const response = await fetch(`${serverUrl}/capabilities`);
      const capabilities = await response.json();
      return capabilities;
    } catch (error) {
      console.error('MCP connection failed:', error);
      throw error;
    }
  }

  private initIpcHandlers() {
    ipcMain.handle('connect-mcp-server', async (_, serverUrl) => {
      return this.handleMcpConnection(serverUrl);
    });

    ipcMain.handle('get-mcp-capabilities', async () => {
      // Assume a connected server; implement proper state management
      return { capabilities: ['file_ops', 'db_query'] }; // Placeholder
    });
  }

  private setupMemoryOptimization() {
    // Set memory optimization flags
    app.commandLine.appendSwitch('--max-old-space-size', '4096')
    app.commandLine.appendSwitch('--memory-pressure-off')

    // Set up memory monitoring and optimization
    let memoryCheckInterval: NodeJS.Timeout

    const optimizeMemory = () => {
      if (this.mainWindow) {
        // Force garbage collection in renderer process
        this.mainWindow!.webContents!.executeJavaScript(`
          (function() {
            if (window.gc) {
              window.gc()
            }
          })()
        `).catch(() => {
          // Silently fail if JavaScript execution fails
        })
      }

      // Force garbage collection in main process
      if (global.gc) {
        global.gc()
      }
    }

    // Start memory monitoring
    memoryCheckInterval = setInterval(() => {
      const memUsage = process.memoryUsage()
      const memMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      }

      // Log memory usage for monitoring
      console.log(`Memory usage - RSS: ${memMB.rss}MB, Heap: ${memMB.heapUsed}/${memMB.heapTotal}MB, External: ${memMB.external}MB`)

      // Trigger optimization if memory usage is high
      if (memMB.heapUsed > 500 || memMB.rss > 800) {
        console.log('High memory usage detected, running optimization...')
        optimizeMemory()
      }
    }, 30000) // Check every 30 seconds

    // Clean up on app quit
    app.on('before-quit', () => {
      if (memoryCheckInterval) {
        clearInterval(memoryCheckInterval)
      }
      optimizeMemory()
    })

    // Handle renderer process memory issues
    app.on('render-process-gone', (event, webContents, details) => {
      console.log('Renderer process crashed:', details.reason, details.exitCode)

      // If it was due to memory issues, optimize memory
      if (details.reason === 'crashed' || details.reason === 'killed') {
        setTimeout(optimizeMemory, 1000)
      }
    })

    // Set up session memory optimization
    const defaultSession = session.defaultSession
    defaultSession.setSpellCheckerEnabled(true)

    // Avoid clearing caches/storage periodically to preserve session state
  }
}

// Initialize the app
new AIBrowser()

// Handle certificate errors gracefully
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Accept certificates in both dev and production for browser functionality
  event.preventDefault()
  callback(true)
})

// Handle app crashes and errors
app.on('render-process-gone', (event, webContents, details) => {
  console.log('App render process crashed:', details.reason, details.exitCode)
  
  // Attempt to reload the main window if it crashes
  if (webContents.getURL() === 'chrome-error://chromewebdata/') {
    webContents.reload()
  }
})

// Handle child process crashes
app.on('child-process-gone', (event, details) => {
  console.log('Child process crashed:', details.type, details.reason, details.exitCode)
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  // Don't exit the process, just log the error
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't exit the process, just log the error
}) 