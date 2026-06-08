/**
 * Demo 02 — Streaming calls
 *
 * Shows:
 *   - Server streaming: listUsers, listProducts, trackOrder
 *   - Client streaming: uploadLogs
 *   - Bidirectional streaming: chat
 */

import { userClient, productClient, orderClient, logClient, chatClient } from '../services/clients'
import type { LogEntry, ChatMessage } from '../services/definitions'

export async function runStreamingDemo() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Demo 02 — Streaming calls')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── 1. Server streaming: listUsers (active only)
  console.log('1. Server stream — listUsers({ active: true })')
  let count = 0
  for await (const user of userClient.listUsers({ active: true })) {
    console.log(`   📨 ${user.name} <${user.email}> [${user.role}]`)
    count++
  }
  console.log(`   ✅ Received ${count} users\n`)

  // ── 2. Server streaming: listProducts by category
  console.log('2. Server stream — listProducts({ category: "electronics" })')
  const products: string[] = []
  for await (const p of productClient.listProducts({ category: 'electronics' })) {
    products.push(`${p.name} (R$ ${p.price.toFixed(2)})`)
  }
  console.log(`   ✅ Products: ${products.join(', ')}\n`)

  // ── 3. Server streaming: trackOrder (live events)
  console.log('3. Server stream — trackOrder (3 live status events)')
  const orderId = 'ord-0001'
  for await (const event of orderClient.trackOrder({ orderId })) {
    const ts = new Date(event.timestamp).toLocaleTimeString()
    console.log(`   📦 [${ts}] ${event.status.toUpperCase()}: ${event.message}`)
  }
  console.log('   ✅ Order fully tracked\n')

  // ── 4. Client streaming: uploadLogs
  console.log('4. Client stream — uploadLogs (100 log entries)')
  async function* generateLogs(): AsyncIterable<LogEntry> {
    const levels: LogEntry['level'][] = ['info', 'warn', 'error']
    for (let i = 0; i < 100; i++) {
      yield {
        level:     levels[i % 3],
        message:   `Log entry #${i + 1} from grpc-example`,
        service:   'grpc-example',
        timestamp: new Date().toISOString(),
        metadata:  { requestId: `req-${i}` },
      }
    }
  }

  const summary = await logClient.uploadLogs(generateLogs())
  console.log(`   ✅ Uploaded ${summary.received} logs in ${summary.processingTimeMs}ms\n`)

  // ── 5. Bidirectional streaming: chat
  // Give the HTTP/2 session a moment to complete its SETTINGS handshake
  // before opening the bidi stream (avoids NGHTTP2_REFUSED_STREAM on fresh sessions).
  await new Promise(r => setTimeout(r, 300))

  console.log('5. Bidi stream — chat (3 messages)')
  async function* userMessages(): AsyncIterable<ChatMessage> {
    const messages = ['Olá!', 'Como você está?', 'Tchau!']
    for (const text of messages) {
      yield { from: 'user', text, timestamp: new Date().toISOString() }
      await new Promise(r => setTimeout(r, 50))
    }
  }

  for await (const reply of chatClient.chat(userMessages())) {
    console.log(`   💬 bot: ${reply.text}`)
  }
  console.log('   ✅ Chat complete\n')
}

// Run standalone
if (require.main === module) {
  runStreamingDemo().catch(console.error)
}
