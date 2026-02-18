#!/usr/bin/env node
/**
 * Production Node.js server for Explorer
 * Lightweight alternative to wrangler dev
 */

import http from 'node:http'
import url from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

// Simple request logger
function logRequest(req, status, duration) {
  const timestamp = new Date().toISOString()
  console.log(`${timestamp} ${req.method} ${req.url} ${status} ${duration}ms`)
}

// Determine content type
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
  }
  return types[ext] || 'application/octet-stream'
}

// Find main JS file
function findMainJs() {
  try {
    const assetsDir = path.join(process.cwd(), 'dist/client/assets')
    const files = fs.readdirSync(assetsDir)
    const mainFile = files.find(f => f.startsWith('main-') && f.endsWith('.js'))
    return mainFile ? `/assets/${mainFile}` : null
  } catch {
    return null
  }
}

// Serve static file
function serveStatic(req, res, filePath) {
  try {
    const resolvedPath = path.join(process.cwd(), 'dist/client', filePath)
    
    // Security check - prevent directory traversal
    const clientDir = path.join(process.cwd(), 'dist/client')
    if (!resolvedPath.startsWith(clientDir)) {
      return false
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
      return false
    }

    const content = fs.readFileSync(resolvedPath)
    res.writeHead(200, { 
      'Content-Type': getContentType(resolvedPath),
      'Cache-Control': filePath.startsWith('/assets/') ? 'public, max-age=31536000' : 'no-cache'
    })
    res.end(content)
    return true
  } catch {
    return false
  }
}

// Handle API requests (proxy to RPC)
async function handleApiRequest(req, res) {
  const parsedUrl = url.parse(req.url || '', true)
  
  // Health check endpoint
  if (parsedUrl.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', chain: process.env.VITE_CHAIN_NAME || 'unknown' }))
    return true
  }

  // Proxy RPC requests
  if (parsedUrl.pathname?.startsWith('/api/rpc')) {
    const rpcUrl = process.env.VITE_RPC_URL
    if (!rpcUrl) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'RPC not configured' }))
      return true
    }

    try {
      // Forward request to RPC
      const body = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', chunk => data += chunk)
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })

      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      })

      const responseBody = await response.text()
      res.writeHead(response.status, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(responseBody)
      return true
    } catch (error) {
      console.error('RPC proxy error:', error)
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'RPC unavailable' }))
      return true
    }
  }

  return false
}

// Generate and serve index.html
function serveIndex(req, res) {
  const mainJs = findMainJs()
  
  if (!mainJs) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Main JavaScript file not found')
    return
  }

  const chainName = process.env.VITE_CHAIN_NAME || 'OtterEVM'
  const chainId = process.env.VITE_CHAIN_ID || '7447'
  const rpcUrl = process.env.VITE_RPC_URL || ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Explorer ⋅ ${chainName}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon-light.svg" media="(prefers-color-scheme: light)">
  <link rel="icon" type="image/svg+xml" href="/favicon-dark.svg" media="(prefers-color-scheme: dark)">
  <script>
    window.__EXPLORER_CONFIG__ = {
      chainName: "${chainName}",
      chainId: "${chainId}",
      rpcUrl: "${rpcUrl}"
    };
  </script>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="${mainJs}"></script>
</body>
</html>`
  
  res.writeHead(200, { 
    'Content-Type': 'text/html',
    'Cache-Control': 'no-cache'
  })
  res.end(html)
}

// Create server
const server = http.createServer(async (req, res) => {
  const start = Date.now()
  const parsedUrl = url.parse(req.url || '', true)
  const pathname = parsedUrl.pathname || '/'

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    // Try API first
    if (pathname.startsWith('/api/')) {
      if (await handleApiRequest(req, res)) {
        logRequest(req, res.statusCode || 200, Date.now() - start)
        return
      }
    }

    // Try static files (skip for root path)
    if (pathname !== '/') {
      if (serveStatic(req, res, pathname)) {
        logRequest(req, 200, Date.now() - start)
        return
      }
    }

    // Fallback to index.html (SPA)
    serveIndex(req, res)
    logRequest(req, 200, Date.now() - start)
  } catch (error) {
    console.error('Server error:', error)
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
    logRequest(req, 500, Date.now() - start)
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    process.exit(0)
  })
})

// Start server
server.listen(Number(PORT), HOST, () => {
  console.log(`🚀 Explorer server running at http://${HOST}:${PORT}`)
  console.log(`   Chain: ${process.env.VITE_CHAIN_NAME || 'OtterEVM'}`)
  console.log(`   Chain ID: ${process.env.VITE_CHAIN_ID || '7447'}`)
  console.log(`   RPC: ${process.env.VITE_RPC_URL || 'not configured'}`)
})
