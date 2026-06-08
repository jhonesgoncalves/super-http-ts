/**
 * Mock Connect-RPC JSON server over HTTP/2 (cleartext)
 *
 * Uses native node:http2 so the GrpcTransport can connect directly.
 * Start it with: npm run mock-server
 */

import * as http2 from 'http2'

const PORT = 50051

// ─── In-memory data ───────────────────────────────────────────────────────────

const USERS: User[] = [
  { id: '1', name: 'Ana Lima',    email: 'ana@example.com',   role: 'admin', createdAt: '2024-01-01', active: true },
  { id: '2', name: 'Bruno Silva', email: 'bruno@example.com', role: 'user',  createdAt: '2024-02-01', active: true },
  { id: '3', name: 'Carla Mota',  email: 'carla@example.com', role: 'user',  createdAt: '2024-03-01', active: false },
  { id: '4', name: 'Diego Costa', email: 'diego@example.com', role: 'guest', createdAt: '2024-04-01', active: true },
  { id: '5', name: 'Eva Rocha',   email: 'eva@example.com',   role: 'admin', createdAt: '2024-05-01', active: true },
]

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Notebook Pro',    price: 4999.90, stock: 12, category: 'electronics' },
  { id: 'p2', name: 'Wireless Mouse',  price:  149.90, stock: 85, category: 'electronics' },
  { id: 'p3', name: 'Standing Desk',   price: 1299.00, stock:  5, category: 'furniture'   },
  { id: 'p4', name: 'Ergonomic Chair', price: 2199.00, stock:  8, category: 'furniture'   },
  { id: 'p5', name: 'Coffee Mug',      price:   49.90, stock: 200,category: 'kitchen'     },
]

let orderCounter = 1

// ─── Domain types (minimal — just enough for the server) ─────────────────────

interface User    { id: string; name: string; email: string; role: string; createdAt: string; active: boolean }
interface Product { id: string; name: string; price: number; stock: number; category: string }

// ─── Envelope framing ─────────────────────────────────────────────────────────

function encodeEnvelope(data: object, flags = 0x00): Buffer {
  const body = Buffer.from(JSON.stringify(data), 'utf-8')
  const header = Buffer.allocUnsafe(5)
  header[0] = flags
  header.writeUInt32BE(body.length, 1)
  return Buffer.concat([header, body])
}

function encodeEndStream(): Buffer {
  const buf = Buffer.allocUnsafe(5)
  buf[0] = 0x02
  buf.writeUInt32BE(0, 1)
  return buf
}

// ─── Read full request body ───────────────────────────────────────────────────

function readBody(stream: http2.ServerHttp2Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    stream.on('data', (c: Buffer) => chunks.push(c))
    stream.on('end',  () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

function parseJson<T>(buf: Buffer): T {
  return JSON.parse(buf.toString('utf-8')) as T
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function replyJson(stream: http2.ServerHttp2Stream, status: number, body: object) {
  const payload = JSON.stringify(body)
  stream.respond({ ':status': status, 'content-type': 'application/connect+json' })
  stream.end(payload)
}

async function handleGetUser(stream: http2.ServerHttp2Stream, body: Buffer) {
  const { id } = parseJson<{ id: string }>(body)
  const user = USERS.find(u => u.id === id)
  if (!user) return replyJson(stream, 404, { code: 'not_found', message: `User ${id} not found` })
  replyJson(stream, 200, user)
}

async function handleCreateUser(stream: http2.ServerHttp2Stream, body: Buffer) {
  const input = parseJson<{ name: string; email: string; role?: string }>(body)
  const user: User = {
    id: String(USERS.length + 1), name: input.name, email: input.email,
    role: input.role ?? 'user', createdAt: new Date().toISOString(), active: true,
  }
  USERS.push(user)
  replyJson(stream, 200, user)
}

async function handleListUsers(stream: http2.ServerHttp2Stream, body: Buffer) {
  const filter = parseJson<{ role?: string; active?: boolean; limit?: number }>(body)
  stream.respond({ ':status': 200, 'content-type': 'application/connect+json' })

  const results = USERS.filter(u => {
    if (filter.role   !== undefined && u.role   !== filter.role)   return false
    if (filter.active !== undefined && u.active !== filter.active) return false
    return true
  }).slice(0, filter.limit ?? 100)

  for (const user of results) {
    await new Promise(r => setTimeout(r, 30))
    stream.write(encodeEnvelope(user))
  }
  stream.write(encodeEndStream())
  stream.end()
}

async function handleGetProduct(stream: http2.ServerHttp2Stream, body: Buffer) {
  const { id } = parseJson<{ id: string }>(body)
  const product = PRODUCTS.find(p => p.id === id)
  if (!product) return replyJson(stream, 404, { code: 'not_found', message: `Product ${id} not found` })
  replyJson(stream, 200, product)
}

async function handleListProducts(stream: http2.ServerHttp2Stream, body: Buffer) {
  const filter = parseJson<{ category?: string; inStock?: boolean }>(body)
  stream.respond({ ':status': 200, 'content-type': 'application/connect+json' })

  const results = PRODUCTS.filter(p => {
    if (filter.category !== undefined && p.category !== filter.category) return false
    if (filter.inStock  !== undefined && filter.inStock && p.stock <= 0)  return false
    return true
  })

  for (const product of results) {
    await new Promise(r => setTimeout(r, 20))
    stream.write(encodeEnvelope(product))
  }
  stream.write(encodeEndStream())
  stream.end()
}

async function handlePlaceOrder(stream: http2.ServerHttp2Stream, body: Buffer) {
  const input = parseJson<{ userId: string; items: Array<{ productId: string; quantity: number }> }>(body)
  const items = input.items.map(item => ({
    productId: item.productId,
    quantity:  item.quantity,
    unitPrice: PRODUCTS.find(p => p.id === item.productId)?.price ?? 0,
  }))
  const order = {
    id: `ord-${String(orderCounter++).padStart(4, '0')}`,
    userId: input.userId,
    items,
    total: items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  }
  replyJson(stream, 200, order)
}

async function handleTrackOrder(stream: http2.ServerHttp2Stream, body: Buffer) {
  const { orderId } = parseJson<{ orderId: string }>(body)
  stream.respond({ ':status': 200, 'content-type': 'application/connect+json' })

  const statuses = ['confirmed', 'shipped', 'delivered'] as const
  for (const status of statuses) {
    await new Promise(r => setTimeout(r, 200))
    stream.write(encodeEnvelope({ orderId, status, timestamp: new Date().toISOString(), message: `Order ${status}` }))
  }
  stream.write(encodeEndStream())
  stream.end()
}

async function handleUploadLogs(stream: http2.ServerHttp2Stream, body: Buffer) {
  let offset = 0, received = 0
  const t0 = Date.now()
  while (offset + 5 <= body.length) {
    const len = body.readUInt32BE(offset + 1)
    if (offset + 5 + len > body.length) break
    offset += 5 + len
    received++
  }
  replyJson(stream, 200, { received, failed: 0, processingTimeMs: Date.now() - t0 })
}

async function handleChat(stream: http2.ServerHttp2Stream, body: Buffer) {
  stream.respond({ ':status': 200, 'content-type': 'application/connect+json' })
  let offset = 0
  while (offset + 5 <= body.length) {
    const len = body.readUInt32BE(offset + 1)
    if (offset + 5 + len > body.length) break
    const msg = parseJson<{ from: string; text: string }>(body.slice(offset + 5, offset + 5 + len))
    stream.write(encodeEnvelope({ from: 'bot', text: `Got your message: "${msg.text}"`, timestamp: new Date().toISOString() }))
    offset += 5 + len
  }
  stream.write(encodeEndStream())
  stream.end()
}

// ─── Router ───────────────────────────────────────────────────────────────────

const ROUTES: Record<string, (stream: http2.ServerHttp2Stream, body: Buffer) => Promise<void>> = {
  '/UserService/getUser':           handleGetUser,
  '/UserService/createUser':        handleCreateUser,
  '/UserService/listUsers':         handleListUsers,
  '/ProductService/getProduct':     handleGetProduct,
  '/ProductService/listProducts':   handleListProducts,
  '/OrderService/placeOrder':       handlePlaceOrder,
  '/OrderService/trackOrder':       handleTrackOrder,
  '/LogService/uploadLogs':         handleUploadLogs,
  '/ChatService/chat':              handleChat,
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = http2.createServer()

server.on('stream', async (stream, headers) => {
  const path = String(headers[':path'] ?? '')
  console.log(`  → POST ${path}`)

  const handler = ROUTES[path]
  if (!handler) {
    stream.respond({ ':status': 404, 'content-type': 'application/connect+json' })
    stream.end(JSON.stringify({ code: 'not_found', message: `No handler for ${path}` }))
    return
  }

  try {
    const body = await readBody(stream)
    await handler(stream, body)
  } catch (err) {
    console.error('  server error:', err)
    if (!stream.destroyed) {
      stream.respond({ ':status': 500, 'content-type': 'application/connect+json' })
      stream.end(JSON.stringify({ code: 'internal', message: String(err) }))
    }
  }
})

server.on('error', (err) => console.error('Server error:', err))

server.listen(PORT, () => {
  console.log(`\n🚀 Mock Connect-RPC server (HTTP/2) listening on http://localhost:${PORT}\n`)
  console.log('  Endpoints:')
  Object.keys(ROUTES).forEach(r => console.log(`  POST ${r}`))
  console.log()
})

export default server
