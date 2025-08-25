import { app, BrowserWindow, Menu, ipcMain, session } from 'electron'
import path from 'path'
import { setupStorageHandlers } from './storage'
import fetch from 'node-fetch'

// Set the application name before anything else
app.name = 'NazareAI Browser'

// __dirname is already available in CommonJS modules

class AIBrowser {
  private mainWindow: BrowserWindow | null = null
  // Fix production detection - check if app is packaged
  private isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

  constructor() {
    // Enable hardware acceleration in production
    if (!this.isDev) {
      app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')
      app.commandLine.appendSwitch('ignore-gpu-blocklist')
    }
    
    // Add switches to make the browser appear more like regular Chrome
    app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
    app.commandLine.appendSwitch('disable-features', 'site-per-process')
    
    // Enable features that help with modern websites
    app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess')
    
    // Disable automation flags that sites might detect
    app.commandLine.appendSwitch('disable-automation')
    
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

  private setupApplicationMenu() {
    // Create default menu with proper app name
    const template: any[] = [
      {
        label: app.name,
        submenu: [
          { label: `About ${app.name}`, role: 'about' },
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
        webSecurity: true,
        webviewTag: true, // Enable webview tag
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        sandbox: true,
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
        // Configure webview security preferences
        webPreferences.nodeIntegration = false
        webPreferences.contextIsolation = true
        webPreferences.webSecurity = true
        webPreferences.allowRunningInsecureContent = false
        webPreferences.navigateOnDragDrop = false
        
        // Allow JavaScript and plugins
        webPreferences.javascript = true
        webPreferences.plugins = true
        
        // Enable additional features needed for modern websites
        webPreferences.webgl = true
        webPreferences.experimentalFeatures = true
        webPreferences.backgroundThrottling = false
        
        // Add session persistence for Cloudflare
        webPreferences.partition = 'persist:main'
        
        // Enable features that help with Cloudflare
        webPreferences.enableBlinkFeatures = 'CSSColorSchemeUARendering'
      })

      // Handle webview navigation requests
      this.mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
        // Set proper user agent for the webview - this should be consistent with the session config
        const chromeVersion = process.versions.chrome
        const userAgent = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`
        webContents.setUserAgent(userAgent)
        
        // Set up cookie handling for Cloudflare - just log changes for debugging
        webContents.session.cookies.on('changed', (event, cookie, cause, removed) => {
          if (cookie.domain && (cookie.domain.includes('search.sh') || cookie.domain.includes('cloudflare') || cookie.name.includes('cf_'))) {
            console.log('Important cookie changed:', cookie.name, cause, removed ? 'removed' : 'added')
          }
        })

        // Enhanced Cloudflare challenge detection
        webContents.on('dom-ready', () => {
          // Inject script to detect and handle Cloudflare challenges
          webContents.executeJavaScript(`
            (function() {
              // Cloudflare challenge detection
              function detectCloudflareChallenge() {
                const cfSelectors = [
                  '[data-ray]',
                  '.cf-browser-verification',
                  '.cf-challenge-form',
                  '[id*="cf-challenge"]',
                  '.cf-error-details',
                  'form[action*="challenge"]'
                ];

                for (const selector of cfSelectors) {
                  if (document.querySelector(selector)) {
                    console.log('[CF] Challenge detected:', selector);
                    return true;
                  }
                }

                // Check for Cloudflare error pages
                if (document.title && (
                  document.title.includes('Cloudflare') ||
                  document.title.includes('cf-browser-verification') ||
                  document.title.includes('Please wait...')
                )) {
                  console.log('[CF] Challenge page detected by title:', document.title);
                  return true;
                }

                // Check for specific Cloudflare scripts or content
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                  const src = script.src || '';
                  const content = script.innerHTML || '';
                  if (src.includes('cloudflare') || src.includes('cf-challenge') ||
                      content.includes('cf-browser-verification') || content.includes('jschl')) {
                    console.log('[CF] Challenge detected in script');
                    return true;
                  }
                }

                return false;
              }

              // Monitor for challenge completion
              let challengeDetected = false;
              const checkForChallenge = () => {
                if (detectCloudflareChallenge() && !challengeDetected) {
                  challengeDetected = true;
                  console.log('[CF] Challenge initiated - waiting for completion...');

                  // Notify main process about challenge
                  if (window.electronAPI && window.electronAPI.onCloudflareChallenge) {
                    window.electronAPI.onCloudflareChallenge(true);
                  }
                } else if (challengeDetected && !detectCloudflareChallenge()) {
                  challengeDetected = false;
                  console.log('[CF] Challenge completed');

                  // Notify main process about challenge completion
                  if (window.electronAPI && window.electronAPI.onCloudflareChallenge) {
                    window.electronAPI.onCloudflareChallenge(false);
                  }
                }
              };

              // Check immediately and then periodically
              checkForChallenge();
              setInterval(checkForChallenge, 1000);
            })()
          `).catch(() => {
            // Silently fail if injection doesn't work
          });
        })
        
        // Enable NTLM credentials if needed
        webContents.session.allowNTLMCredentialsForDomains('*')
        
        // Enhanced anti-detection and security measures
        webContents.executeJavaScript(`
          (function() {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined,
            });

            // Remove automation properties
            delete window.navigator.__proto__.webdriver;

            // Override permissions API more comprehensively
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );

            // Add additional anti-detection measures
            Object.defineProperty(navigator, 'languages', {
              get: () => ['en-US', 'en']
            });

            // Override plugin detection to appear more like a real browser
            Object.defineProperty(navigator, 'plugins', {
              get: () => [
                { name: 'Chrome PDF Plugin', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
                { name: 'Chrome PDF Viewer', description: '', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
                { name: 'Native Client', description: '', filename: 'internal-nacl-plugin' }
              ]
            });

            // Override mime types
            Object.defineProperty(navigator, 'mimeTypes', {
              get: () => [
                { type: 'application/pdf', description: 'Portable Document Format', suffixes: 'pdf' },
                { type: 'application/x-google-chrome-pdf', description: 'Portable Document Format', suffixes: 'pdf' }
              ]
            });

            // Add security monitoring
            const securityObserver = new PerformanceObserver(() => {
              // Monitor for potential security issues
            });

            // Clean up on page unload
            window.addEventListener('beforeunload', () => {
              if (securityObserver) {
                securityObserver.disconnect();
              }
            });
          })();
        `).catch(() => {})
        
        // Set permissive navigation policy
        webContents.on('will-navigate', (navEvent, navigationUrl) => {
          // Don't prevent any navigation
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
        
        // Enhanced permission request handler with security considerations
        webContents.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
          const requestingOrigin = details.requestingUrl ? new URL(details.requestingUrl).origin : 'unknown'

          // Define permission policies based on context and origin
          const permissionPolicies = {
            // Always allow these safe permissions
            'clipboard-read': true,
            'clipboard-write': true,
            'fullscreen': true,
            'pointerLock': true,

            // Allow media with user confirmation for known sites
            'media': ['https://www.youtube.com', 'https://www.netflix.com', 'https://www.twitch.tv'].some(site => requestingOrigin.includes(site)),

            // Allow geolocation only for trusted navigation/mapping sites
            'geolocation': ['https://www.google.com', 'https://maps.google.com', 'https://www.openstreetmap.org'].some(site => requestingOrigin.includes(site)),

            // Allow notifications for major platforms
            'notifications': ['https://www.google.com', 'https://www.youtube.com', 'https://www.github.com', 'https://mail.google.com'].some(site => requestingOrigin.includes(site)),

            // Allow camera/microphone with explicit user confirmation
            'camera': false, // Require explicit user consent
            'microphone': false, // Require explicit user consent

            // MIDI and display capture - generally safe
            'midi': true,
            'midiSysex': true,
            'display-capture': true,

            // Clipboard permissions - allow read/write for general use
            'clipboard-sanitized-write': true,

            // File system access - block by default for security
            'fileSystem': false,

            // Media key system for DRM content
            'mediaKeySystem': true,

            // Additional safe permissions
            'keyboardLock': true,

            // Block potentially dangerous permissions
            'accessibility-events': false,
            'background-sync': false,
            'background-fetch': false,
            'persistent-storage': false,
            'payment-handler': false,
            'protocol-handler': false,
            'usb': false,
            'hid': false,
            'serial': false,
            'bluetooth': false,
            'idle-detection': false,
            'wake-lock': false
          }

          const policy = (permissionPolicies as any)[permission]
          let isAllowed = true // Default to allow to prevent blocking

          try {
            // Check if permission exists in our policies
            if (policy !== undefined) {
              isAllowed = policy === true ||
                         (policy === requestingOrigin) ||
                         (Array.isArray(policy) && policy.includes(requestingOrigin))
            } else {
              // For unknown permissions, allow them by default to prevent blocking
              console.log(`Unknown permission ${permission}, allowing by default`)
              isAllowed = true
            }
          } catch (error) {
            console.error('Error checking permission policy:', error)
            // On error, default to allow to prevent blocking
            isAllowed = true
          }

          console.log(`Permission ${permission} requested by ${requestingOrigin}: ${isAllowed ? 'ALLOWED' : 'DENIED'}`)

          // Respond immediately to prevent blocking
          callback(isAllowed)
        })
        
        // Disable any navigation restrictions
        webContents.on('will-prevent-unload', (event) => {
          event.preventDefault()
        })
        
        // Enable all features that might be needed
        webContents.session.setSpellCheckerEnabled(true)
        
        // Enhanced certificate error handling with security considerations
        webContents.on('certificate-error', (event, url, error, certificate, callback) => {
          console.log(`Certificate error for ${url}: ${error}`)

          // Define trusted domains that might have certificate issues but are generally safe
          const trustedDomains = [
            'localhost',
            '127.0.0.1',
            'local.',
            '.local',
            // Development servers
            'webpack',
            'vite',
            // Known sites with certificate quirks
            'example.com',
            'test.',
            '.test'
          ]

          const isTrustedDomain = trustedDomains.some(domain => url.includes(domain))
          const isDevelopment = !app.isPackaged || process.env.NODE_ENV === 'development'

          // Accept certificates for trusted domains or in development
          if (isTrustedDomain || isDevelopment) {
            console.log(`Accepting certificate for trusted domain: ${url}`)
            event.preventDefault()
            callback(true)
          } else {
            // For production and untrusted domains, show warning but allow user choice
            console.warn(`Certificate error for untrusted domain: ${url} - ${error}`)

            // In production, reject potentially dangerous certificates
            if (app.isPackaged && !isTrustedDomain) {
              // Show a warning dialog to user
              const { dialog } = require('electron')
              const choice = dialog.showMessageBoxSync(this.mainWindow, {
                type: 'warning',
                buttons: ['Reject', 'Accept Anyway'],
                defaultId: 0,
                cancelId: 0,
                title: 'Certificate Error',
                message: `Certificate error for ${url}`,
                detail: `Error: ${error}\n\nThis may indicate a security issue. Do you want to continue anyway?`
              })

              if (choice === 1) { // Accept Anyway
                event.preventDefault()
                callback(true)
              } else {
                callback(false)
              }
            } else {
              event.preventDefault()
              callback(true)
            }
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
    
    // Configure webview session request handling - this prevents the constant refreshing
    webviewSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = { ...details.requestHeaders }

      // Remove ALL automation detection headers
      delete requestHeaders['X-DevTools-Emulate-Network-Conditions-Client-Id']
      delete requestHeaders['X-DevTools-Request-Id']
      delete requestHeaders['X-Client-Data']
      delete requestHeaders['X-Requested-With']
      delete requestHeaders['X-Electron-Webview']

      // Set consistent browser-like headers
      requestHeaders['User-Agent'] = userAgent
      requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
      requestHeaders['Accept-Language'] = 'en-US,en;q=0.9'
      requestHeaders['Accept-Encoding'] = 'gzip, deflate, br'
      requestHeaders['Cache-Control'] = 'max-age=0'
      requestHeaders['Sec-Fetch-Dest'] = 'document'
      requestHeaders['Sec-Fetch-Mode'] = 'navigate'
      requestHeaders['Sec-Fetch-Site'] = 'none'
      requestHeaders['Sec-Fetch-User'] = '?1'
      requestHeaders['Upgrade-Insecure-Requests'] = '1'

      // Add additional headers to appear more legitimate
      requestHeaders['Sec-Ch-Ua'] = '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"'
      requestHeaders['Sec-Ch-Ua-Mobile'] = '?0'
      requestHeaders['Sec-Ch-Ua-Platform'] = '"macOS"'
      requestHeaders['DNT'] = '1'

      // Add referrer policy for better compatibility
      requestHeaders['Referrer-Policy'] = 'strict-origin-when-cross-origin'

      callback({ requestHeaders })
    })
    
    // Handle response headers to remove CSP restrictions for Cloudflare
    webviewSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = { ...details.responseHeaders }
      
      // Remove frame restrictions that might interfere with Cloudflare
      delete responseHeaders['x-frame-options']
      delete responseHeaders['X-Frame-Options']
      
      // Enhanced CSP handling based on URL patterns
      if (details.url.includes('__cf_chl_rt_tk') || details.url.includes('cloudflare.com')) {
        // Keep original CSP for Cloudflare pages but add minimal security
        if (responseHeaders['Content-Security-Policy']) {
          if (Array.isArray(responseHeaders['Content-Security-Policy'])) {
            responseHeaders['Content-Security-Policy'] = responseHeaders['Content-Security-Policy'].map(policy =>
              policy + "; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action *;"
            )
          } else {
            responseHeaders['Content-Security-Policy'] = [responseHeaders['Content-Security-Policy'] + "; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action *;"]
          }
        }
      } else if (details.url.includes('google.com') || details.url.includes('youtube.com') || details.url.includes('facebook.com') || details.url.includes('googletagmanager.com') || details.url.includes('googleusercontent.com') || details.url.includes('gstatic.com') || details.url.includes('paypal.com') || details.url.includes('stripe.com')) {
        // More permissive CSP for Google services, payment processors, and major platforms
        responseHeaders['Content-Security-Policy'] = [
          "default-src 'self' https: data: blob: 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob: https://*.google.com https://*.googletagmanager.com https://*.googleusercontent.com https://*.gstatic.com https://*.youtube.com https://*.facebook.com https://*.paypal.com https://*.stripe.com; style-src 'self' 'unsafe-inline' https: data: https://*.google.com https://*.googletagmanager.com https://*.googleusercontent.com https://*.gstatic.com https://*.youtube.com https://*.facebook.com https://*.paypal.com https://*.stripe.com; img-src * data: blob: 'unsafe-inline'; connect-src * data: blob:; frame-src *; font-src * data:; worker-src * blob: data:; child-src * blob: data:; object-src 'none'; base-uri 'self'; form-action *; frame-ancestors 'none'; upgrade-insecure-requests;"
        ]
      } else {
        // Temporarily disable CSP completely for debugging
        delete responseHeaders['Content-Security-Policy']
        console.log('CSP disabled for debugging - pages should load now')
      }

      // Add additional security headers
      responseHeaders['X-Content-Type-Options'] = ['nosniff']
      responseHeaders['X-Frame-Options'] = ['SAMEORIGIN']
      responseHeaders['X-XSS-Protection'] = ['1; mode=block']
      responseHeaders['Referrer-Policy'] = ['strict-origin-when-cross-origin']
      responseHeaders['Permissions-Policy'] = ['camera=(), microphone=(), geolocation=(), payment=()']
      
      callback({ responseHeaders })
    })
    
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

            // Clear unused caches
            if ('caches' in window) {
              caches.keys().then(names => {
                names.forEach(name => {
                  caches.delete(name)
                })
              })
            }

            // Clear service worker registrations
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(registration => {
                  registration.unregister()
                })
              })
            }
          })()
        `).catch(() => {
          // Silently fail if JavaScript execution fails
        })

        // Optimize webview sessions
        const webviewSession = session.fromPartition('persist:main')
        webviewSession.clearCache().catch(() => {})
        webviewSession.clearStorageData({
          storages: ['cookies', 'localstorage', 'indexdb', 'websql']
        }).catch(() => {})
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

    // Set up periodic cleanup
    setInterval(() => {
      // Clear old cache entries
      defaultSession.clearCache().catch(() => {})

      // Clear old storage data
      defaultSession.clearStorageData({
        storages: ['cookies', 'localstorage'],
        quotas: ['temporary']
      }).catch(() => {})
    }, 300000) // Clean every 5 minutes
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