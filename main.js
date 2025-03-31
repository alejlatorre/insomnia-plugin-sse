/**
 * @module insomnia-plugin-sse
 */

// @ts-nocheck

// Constants
const SSE_READYSTATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSED: 2,
}

const SSE_STATUS_MESSAGES = {
  CONNECTING: { color: 'orange', message: '🔄 Connecting...' },
  OPEN: { color: 'green', message: '✅ Connection established' },
  ERROR: { color: 'red', message: '❌ Error: ' },
  RECONNECTING: { color: 'orange', message: '🔄 Reconnecting...' },
  COMPLETE: { color: 'green', message: '✅ Stream completed' },
}

const SSE_CONFIG = {
  DELAY_MS: 0,
  RECONNECT_INTERVAL_MS: 3000,
  MAX_RECONNECT_ATTEMPTS: 3,
}

const SSE_INTERNAL_HEADERS = new Set(['x-sse', 'x-event-name'])

const CSS_STYLES = {
  SSE_BOX: {
    STANDARD: {
      position: 'relative',
      padding: '15px',
      backgroundColor: '#FFFFFF10',
      height: 'auto',
      minHeight: '50px',
      maxHeight: '200px',
      width: 'calc(100% - 30px)',
      // margin: '10px',
      border: '1px solid #3333',
      borderRadius: '3px',
      display: 'flex',
      alignItems: 'center',
    },
    FLOATING: {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#333',
      color: 'white',
      padding: '10px',
      borderRadius: '3px',
      height: 'auto',
      minHeight: '50px',
      maxHeight: '200px',
      width: '350px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
    },
  },
  BUTTON: {
    position: 'absolute',
    top: '50%',
    right: '15px',
    transform: 'translateY(-50%)',
    border: '1px solid rgb(187, 187, 187)',
    padding: '5px 10px',
    cursor: 'pointer',
    background: 'none',
    borderRadius: '2px',
    zIndex: 2,
  },
  STATUS_TEXT: {
    fontWeight: 'bold',
    minHeight: '20px',
    fontSize: '14px',
    lineHeight: '20px',
    display: 'inline-block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 'calc(100% - 120px)',
    margin: '0 110px 0 0',
  },
}

// Helper function to apply styles to an element
function applyStyles(element, styles) {
  Object.assign(element.style, styles)
}

/**
 * Safely removes any existing SSE response box from the DOM
 * @param {Document} document - DOM document
 */
function removeOldSSEBox(document) {
  try {
    const oldBox = document.getElementById('sse-response-box')
    if (!oldBox) return

    const closeButton = oldBox.querySelector('button')
    if (closeButton) {
      closeButton.click()
    } else if (oldBox.parentNode) {
      oldBox.parentNode.removeChild(oldBox)
    }
  } catch (error) {
    console.error('Error removing old SSE box:', error)
  }
}

/**
 * Creates a floating SSE box as a fallback
 * @param {Document} document - DOM document
 * @param {CustomEventSource} source - Event source instance
 * @returns {HTMLElement} - The created floating box
 */
function createFloatingSSEBox(document, source) {
  // Create the SSE box
  const box = document.createElement('div')
  box.id = 'sse-response-box'
  applyStyles(box, CSS_STYLES.SSE_BOX.FLOATING)

  // Add status text
  const status = document.createElement('div')
  status.className = 'status-text'
  applyStyles(status, CSS_STYLES.STATUS_TEXT)
  box.appendChild(status)

  // Add close button
  const button = document.createElement('button')
  button.innerText = 'Stop Streaming'
  applyStyles(button, CSS_STYLES.BUTTON)
  button.addEventListener('click', () => {
    box.parentNode?.removeChild(box)
    source.close()
  })
  box.appendChild(button)

  document.body.appendChild(box)
  return box
}

/**
 * Updates the status message in the SSE box
 * @param {HTMLElement} sseBox - The SSE box container
 * @param {string} message - Status message text
 * @param {string} color - Text color
 */
function updateStatusMessage(sseBox, message, color) {
  if (!sseBox) return

  try {
    const statusText = sseBox.querySelector('.status-text')
    if (!statusText) return

    // Update the text content and color
    statusText.textContent = message
    statusText.style.color = color
  } catch (error) {
    console.error('Error updating status message:', error)
  }
}

/**
 * Custom EventSource implementation that supports any HTTP method
 */
class CustomEventSource {
  /**
   * Creates a new CustomEventSource instance
   * @param {string} url - The endpoint URL
   * @param {string} method - HTTP method
   * @param {Object} headers - Request headers
   * @param {string|null} body - Request body
   */
  constructor(url, method, headers, body) {
    this.url = url
    this.method = method || 'GET'
    this.headers = headers || {}
    this.body = body
    this.eventListeners = {}
    this.readyState = SSE_READYSTATE.CONNECTING
    this.xhr = null
    this.reconnectAttempts = 0
    this.connect()
  }

  /**
   * Establishes connection to the SSE endpoint
   */
  connect() {
    this.readyState = SSE_READYSTATE.CONNECTING
    const xhr = new XMLHttpRequest()
    this.xhr = xhr

    xhr.open(this.method, this.url, true)
    this.setRequestHeaders(xhr)

    let buffer = ''
    xhr.onreadystatechange = () => this.handleStateChange(xhr, buffer)
    xhr.onerror = (error) => this.handleError(error)
    xhr.send(this.body)
  }

  /**
   * Sets the appropriate request headers
   * @param {XMLHttpRequest} xhr - The XHR object
   */
  setRequestHeaders(xhr) {
    // Set required SSE headers
    xhr.setRequestHeader('Accept', 'text/event-stream')
    xhr.setRequestHeader('Cache-Control', 'no-cache')

    // Set custom headers
    Object.entries(this.headers).forEach(([key, value]) => {
      if (
        key.toLowerCase() !== 'accept' &&
        key.toLowerCase() !== 'cache-control'
      ) {
        xhr.setRequestHeader(key, value)
      }
    })
  }

  /**
   * Handles XHR state changes
   * @param {XMLHttpRequest} xhr - The XHR object
   * @param {string} buffer - Response buffer
   */
  handleStateChange(xhr, buffer) {
    if (xhr.readyState <= 2) return

    if (xhr.status === 200) {
      if (this.readyState === SSE_READYSTATE.CONNECTING) {
        this.readyState = SSE_READYSTATE.OPEN
        this.dispatchEvent({ type: 'open' })
        this.reconnectAttempts = 0 // Reset reconnect attempts on successful connection
      }

      // Process received chunk
      const chunk = xhr.responseText.substring(buffer.length)
      buffer = xhr.responseText
      this.processChunk(chunk)

      // Check if connection is complete (server closed it naturally)
      if (xhr.readyState === 4) {
        this.dispatchEvent({ type: 'complete' })
        this.close()
      }
    } else {
      this.handleError({
        status: xhr.status,
        statusText: xhr.statusText,
      })
    }
  }

  /**
   * Handles connection errors and attempts reconnection
   * @param {Object} error - Error details
   */
  handleError(error) {
    this.readyState = SSE_READYSTATE.CLOSED
    this.dispatchEvent({
      type: 'error',
      status: error?.status ?? 0,
      statusText: error?.statusText ?? 'Connection failed',
    })

    // Try to reconnect if limit not reached
    if (this.reconnectAttempts < SSE_CONFIG.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++
      this.dispatchEvent({
        type: 'reconnecting',
        attempt: this.reconnectAttempts,
        maxAttempts: SSE_CONFIG.MAX_RECONNECT_ATTEMPTS,
      })

      setTimeout(() => this.connect(), SSE_CONFIG.RECONNECT_INTERVAL_MS)
    } else {
      this.dispatchEvent({
        type: 'connectionFailed',
        message: 'Maximum reconnection attempts reached',
      })
      this.close()
    }
  }

  /**
   * Processes a chunk of SSE data
   * @param {string} chunk - Data chunk
   */
  processChunk(chunk) {
    if (!chunk || chunk.length === 0) return

    // Split the chunk into individual events
    const events = chunk.split('\n\n')

    // Process all complete events
    for (let i = 0; i < events.length - 1; i++) {
      this.processEvent(events[i])
    }
  }

  /**
   * Processes a single SSE event
   * @param {string} eventStr - Event string
   */
  processEvent(eventStr) {
    const eventParts = eventStr.split('\n')
    let eventType = 'message'
    let data = ''

    // Parse event parts
    for (const part of eventParts) {
      if (part.startsWith('event:')) {
        eventType = part.substring(6).trim()
      } else if (part.startsWith('data:')) {
        data = part.substring(5).trim()
      }
    }

    // Dispatch the event
    this.dispatchEvent({ type: eventType, data: data })
  }

  /**
   * Adds an event listener
   * @param {string} type - Event type
   * @param {Function} callback - Event handler
   */
  addEventListener(type, callback) {
    if (!type || typeof callback !== 'function') return

    if (!this.eventListeners[type]) {
      this.eventListeners[type] = []
    }
    this.eventListeners[type].push(callback)
  }

  /**
   * Removes an event listener
   * @param {string} type - Event type
   * @param {Function} callback - Event handler to remove
   */
  removeEventListener(type, callback) {
    if (!this.eventListeners[type]) return

    this.eventListeners[type] = this.eventListeners[type].filter(
      (listener) => listener !== callback
    )
  }

  /**
   * Dispatches an event to all registered listeners
   * @param {Object} event - Event object
   */
  dispatchEvent(event) {
    if (!event?.type) return

    const listeners = this.eventListeners[event.type] || []
    listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        console.error(`Error in SSE ${event.type} listener:`, error)
      }
    })

    // Also call onX handler if defined
    const handlerName = `on${event.type}`
    if (typeof this[handlerName] === 'function') {
      try {
        this[handlerName](event)
      } catch (error) {
        console.error(`Error in SSE ${handlerName} handler:`, error)
      }
    }
  }

  /**
   * Closes the SSE connection
   */
  close() {
    if (this.readyState !== SSE_READYSTATE.CLOSED) {
      this.readyState = SSE_READYSTATE.CLOSED
      this.xhr?.abort()
      this.dispatchEvent({ type: 'close' })
      this.eventListeners = {} // Clean up all listeners
    }
  }
}

/**
 * Extracts headers from request context
 * @param {Object} request - Request object
 * @returns {Object} - Headers object
 */
function extractHeaders(request) {
  const headers = {}
  for (const header of request.getHeaders()) {
    if (!isSSEInternalHeader(header.name)) {
      headers[header.name] = header.value
    }
  }
  return headers
}

/**
 * Handles SSE request setup and connection
 * @param {Object} context - Request context
 */
function handleSSERequest(context) {
  try {
    removeOldSSEBox(document)

    const method = context.request.getMethod()
    const url = context.request.getUrl()
    const headers = extractHeaders(context.request)
    const body =
      method !== 'GET' ? context.request.getBody()?.text ?? null : null
    const eventName = context.request.getHeader('x-event-name') || 'message'
    console.debug('eventName', eventName)

    // Create custom EventSource
    const source = new CustomEventSource(url, method, headers, body)
    const sseBox = createFloatingSSEBox(document, source)

    // Set initial status
    updateStatusMessage(
      sseBox,
      SSE_STATUS_MESSAGES.CONNECTING.message,
      SSE_STATUS_MESSAGES.CONNECTING.color
    )

    // Set up event listeners
    source.addEventListener('open', () => {
      updateStatusMessage(
        sseBox,
        SSE_STATUS_MESSAGES.OPEN.message,
        SSE_STATUS_MESSAGES.OPEN.color
      )
    })

    source.addEventListener('error', (error) => {
      updateStatusMessage(
        sseBox,
        `${SSE_STATUS_MESSAGES.ERROR.message} ${error.status} ${
          error.statusText ?? ''
        }`,
        SSE_STATUS_MESSAGES.ERROR.color
      )
    })

    source.addEventListener('reconnecting', (event) => {
      updateStatusMessage(
        sseBox,
        `${SSE_STATUS_MESSAGES.RECONNECTING.message} (${event.attempt}/${event.maxAttempts})...`,
        SSE_STATUS_MESSAGES.RECONNECTING.color
      )
    })

    source.addEventListener('connectionFailed', () => {
      updateStatusMessage(
        sseBox,
        `${SSE_STATUS_MESSAGES.CONNECTION_FAILED.message}`,
        SSE_STATUS_MESSAGES.CONNECTION_FAILED.color
      )

      // Auto-close the box after showing the failure message
      setTimeout(() => {
        if (sseBox.parentNode) {
          sseBox.parentNode.removeChild(sseBox)
        }
      }, 5000)
    })

    // Handle stream completion - automatically remove the SSE box
    source.addEventListener('complete', () => {
      updateStatusMessage(
        sseBox,
        SSE_STATUS_MESSAGES.COMPLETE.message,
        SSE_STATUS_MESSAGES.COMPLETE.color
      )

      // Auto-close the box after a brief delay to show the completion message
      setTimeout(() => {
        if (sseBox.parentNode) {
          sseBox.parentNode.removeChild(sseBox)
        }
      }, 2000)
    })
  } catch (error) {
    console.error('Error in SSE handler:', error)
  }
}

/**
 * Checks if a header is an internal SSE header
 * @param {string} headerName - Header name
 * @returns {boolean} - Whether it's an internal header
 */
function isSSEInternalHeader(headerName) {
  return SSE_INTERNAL_HEADERS.has(headerName.toLowerCase())
}

/**
 * Checks if the request is an SSE request based on headers
 * @param {Object} request - Request object
 * @returns {boolean} - Whether it's an SSE request
 */
function isSSERequest(request) {
  return Boolean(request.getHeader('x-sse'))
}

/**
 * Hides the overlay element
 * @param {Document} document - DOM document
 */
function hideOverlay(document) {
  const overlay = document.querySelector('.response-pane .overlay')
  if (overlay) {
    overlay.style.display = 'none'
  }
}

// Export plugin hooks
module.exports.requestHooks = [
  async (context) => {
    try {
      // Check if this is an SSE request
      if (isSSERequest(context.request) && typeof document !== 'undefined') {
        hideOverlay(document)
        setTimeout(() => handleSSERequest(context), SSE_CONFIG.DELAY_MS)
      }
    } catch (error) {
      console.error('Error in request hook:', error)
    }
  },
]
