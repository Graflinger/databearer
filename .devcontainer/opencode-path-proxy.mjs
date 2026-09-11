#!/usr/bin/env node
import http from "node:http"
import net from "node:net"

const listenHost = process.env.OPENCODE_PROXY_HOST ?? "0.0.0.0"
const listenPort = Number(process.env.OPENCODE_PROXY_PORT ?? "4098")
const backendHost = process.env.OPENCODE_BACKEND_HOST ?? "127.0.0.1"
const backendPort = Number(process.env.OPENCODE_BACKEND_PORT ?? "4099")
const canonicalDirectory = process.env.OPENCODE_CANONICAL_DIR ?? "/workspaces/databearer"

function normalizePath(value) {
  if (!value) return value

  const text = Array.isArray(value) ? value[0] : String(value)
  return text === canonicalDirectory ? text : canonicalDirectory
}

function normalizedUrl(originalUrl) {
  const url = new URL(originalUrl, `http://${backendHost}:${backendPort}`)

  if (url.searchParams.has("directory")) {
    url.searchParams.set("directory", canonicalDirectory)
  }

  return `${url.pathname}${url.search}`
}

function normalizedHeaders(headers) {
  const next = { ...headers }
  next.host = `${backendHost}:${backendPort}`

  for (const name of Object.keys(next)) {
    if (name.toLowerCase() === "x-opencode-directory") {
      delete next[name]
    }
  }
  next["x-opencode-directory"] = normalizePath(canonicalDirectory)

  return next
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  })
  response.end(body)
}

const server = http.createServer((request, response) => {
  if (
    request.url === "/_databearer/opencode-proxy/health" ||
    request.url === "/_xtv/opencode-proxy/health"
  ) {
    sendJson(response, 200, { healthy: true, directory: canonicalDirectory })
    request.resume()
    return
  }

  const proxyRequest = http.request(
    {
      hostname: backendHost,
      port: backendPort,
      method: request.method,
      path: normalizedUrl(request.url ?? "/"),
      headers: normalizedHeaders(request.headers),
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers)
      proxyResponse.pipe(response)
    },
  )

  proxyRequest.on("error", (error) => {
    if (!response.headersSent) {
      sendJson(response, 502, { healthy: false, error: error.message })
    } else {
      response.destroy(error)
    }
  })

  request.pipe(proxyRequest)
})

server.on("upgrade", (request, socket, head) => {
  const backendSocket = net.connect(backendPort, backendHost, () => {
    const headers = normalizedHeaders(request.headers)
    const path = normalizedUrl(request.url ?? "/")
    const lines = [`${request.method} ${path} HTTP/${request.httpVersion}`]

    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        for (const item of value) lines.push(`${name}: ${item}`)
      } else if (value !== undefined) {
        lines.push(`${name}: ${value}`)
      }
    }

    backendSocket.write(`${lines.join("\r\n")}\r\n\r\n`)
    if (head.length > 0) backendSocket.write(head)
    socket.pipe(backendSocket).pipe(socket)
  })

  backendSocket.on("error", () => {
    socket.destroy()
  })
})

server.listen(listenPort, listenHost, () => {
  console.log(
    `OpenCode path proxy listening on ${listenHost}:${listenPort}, forwarding to ${backendHost}:${backendPort}, directory ${canonicalDirectory}`,
  )
})
