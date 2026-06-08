/**
 * Demo 01 — Unary calls
 *
 * Shows: getUser, createUser, getProduct, placeOrder
 * Resilience: circuit breaker + retry (resilient-api preset)
 */

import { GrpcError } from 'super-http/grpc'
import { userClient, productClient, orderClient } from '../services/clients'

export async function runUnaryDemo() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Demo 01 — Unary calls')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // ── 1. getUser — happy path
  console.log('1. getUser({ id: "1" })')
  const user = await userClient.getUser({ id: '1' })
  console.log(`   ✅ ${user.name} <${user.email}> [${user.role}]\n`)

  // ── 2. getUser — not found (GrpcError with code)
  console.log('2. getUser({ id: "999" }) — expect not_found')
  try {
    await userClient.getUser({ id: '999' })
  } catch (err) {
    if (err instanceof GrpcError) {
      console.log(`   ✅ GrpcError caught: code="${err.code}" message="${err.message}"\n`)
    }
  }

  // ── 3. createUser
  console.log('3. createUser({ name: "Felipe", email: "felipe@example.com" })')
  const newUser = await userClient.createUser({ name: 'Felipe', email: 'felipe@example.com', role: 'user' })
  console.log(`   ✅ Created user id=${newUser.id}: ${newUser.name}\n`)

  // ── 4. getProduct
  console.log('4. getProduct({ id: "p1" })')
  const product = await productClient.getProduct({ id: 'p1' })
  console.log(`   ✅ ${product.name} — R$ ${product.price.toFixed(2)} (${product.stock} in stock)\n`)

  // ── 5. placeOrder
  console.log('5. placeOrder — 2 items')
  const order = await orderClient.placeOrder({
    userId: '1',
    items: [
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 2 },
    ],
  })
  console.log(`   ✅ Order ${order.id} — total R$ ${order.total.toFixed(2)} — status: ${order.status}\n`)

  // ── 6. Metrics snapshot
  console.log('6. Metrics snapshot')
  const m = userClient.metrics()
  console.log(`   UserService: ${m.requests} req, ${m.success} ok, ${m.failed} failed, p99=${m.p99Latency}ms`)
  const om = orderClient.metrics()
  console.log(`   OrderService: ${om.requests} req, ${om.success} ok, retries=${om.retries}\n`)
}

// Run standalone
if (require.main === module) {
  runUnaryDemo().catch(console.error)
}
