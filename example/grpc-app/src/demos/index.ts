/**
 * Demo runner — starts the mock server then runs all demos sequentially
 *
 * Usage: npm run demo:all
 */

import * as http from 'http'
import { runUnaryDemo }      from './unary'
import { runStreamingDemo }  from './streaming'
import { runResilienceDemo } from './resilience'
import { GrpcChannelRegistry } from 'super-http/grpc'

async function waitForServer(url: string, retries = 10): Promise<void> {
  for (let i = 0; i < retries; i++) {
    await new Promise(r => setTimeout(r, 200))
    const ok = await new Promise<boolean>(resolve => {
      const req = http.get(url, () => resolve(true))
      req.on('error', () => resolve(false))
    })
    if (ok) return
  }
  throw new Error(`Server at ${url} did not start in time`)
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗')
  console.log('║  super-http — gRPC Example               ║')
  console.log('║  TypeScript-first gRPC · zero .proto     ║')
  console.log('╚══════════════════════════════════════════╝')

  // Start mock server inline
  const { default: server } = await import('../mock-server/index')

  // Wait until server is ready
  await waitForServer('http://localhost:50051/health').catch(() => {
    // /health returns 404 but that means server is up
  })
  await new Promise(r => setTimeout(r, 300))

  try {
    await runUnaryDemo()
    GrpcChannelRegistry.clear()   // reset sessions between demos
    await new Promise(r => setTimeout(r, 200))

    await runStreamingDemo()
    GrpcChannelRegistry.clear()
    await new Promise(r => setTimeout(r, 200))

    await runResilienceDemo()

    console.log('╔══════════════════════════════════════════╗')
    console.log('║  All demos completed successfully ✅     ║')
    console.log('╚══════════════════════════════════════════╝\n')
  } finally {
    await GrpcChannelRegistry.closeAll()
    server.close()
  }
}

main().catch(err => {
  console.error('\n❌ Demo failed:', err)
  process.exit(1)
})
