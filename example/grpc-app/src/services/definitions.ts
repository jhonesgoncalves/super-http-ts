/**
 * Service Definitions — TypeScript-first, no .proto files
 *
 * This single file is the source of truth for all gRPC contracts.
 * TypeScript types drive both compile-time safety and runtime dispatch.
 */

import {
  defineService,
  unary,
  serverStream,
  clientStream,
  bidi,
} from 'super-http/grpc'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'guest'
  createdAt: string
  active: boolean
}

export interface GetUserRequest {
  id: string
}

export interface ListUsersRequest {
  role?: User['role']
  active?: boolean
  limit?: number
}

export interface CreateUserRequest {
  name: string
  email: string
  role?: User['role']
}

export interface Product {
  id: string
  name: string
  price: number
  stock: number
  category: string
}

export interface GetProductRequest {
  id: string
}

export interface ListProductsRequest {
  category?: string
  inStock?: boolean
}

export interface Order {
  id: string
  userId: string
  items: Array<{ productId: string; quantity: number; unitPrice: number }>
  total: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  createdAt: string
}

export interface PlaceOrderRequest {
  userId: string
  items: Array<{ productId: string; quantity: number }>
}

export interface OrderEvent {
  orderId: string
  status: Order['status']
  timestamp: string
  message: string
}

export interface TrackOrderRequest {
  orderId: string
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error'
  message: string
  service: string
  timestamp: string
  metadata?: Record<string, string>
}

export interface LogUploadSummary {
  received: number
  failed: number
  processingTimeMs: number
}

export interface ChatMessage {
  from: string
  text: string
  timestamp: string
}

// ─── Service Definitions ──────────────────────────────────────────────────────

/**
 * UserService — CRUD + streaming list
 * Demonstrates: unary + server streaming
 */
export const UserServiceDef = defineService('UserService', {
  getUser:    unary<GetUserRequest, User>(),
  createUser: unary<CreateUserRequest, User>(),
  listUsers:  serverStream<ListUsersRequest, User>(),
})

/**
 * ProductService — catalog queries
 * Demonstrates: unary + server streaming
 */
export const ProductServiceDef = defineService('ProductService', {
  getProduct:    unary<GetProductRequest, Product>(),
  listProducts:  serverStream<ListProductsRequest, Product>(),
})

/**
 * OrderService — place orders + live tracking
 * Demonstrates: unary + server streaming (live events)
 */
export const OrderServiceDef = defineService('OrderService', {
  placeOrder:  unary<PlaceOrderRequest, Order>(),
  trackOrder:  serverStream<TrackOrderRequest, OrderEvent>(),
})

/**
 * LogService — bulk log ingestion
 * Demonstrates: client streaming
 */
export const LogServiceDef = defineService('LogService', {
  uploadLogs: clientStream<LogEntry, LogUploadSummary>(),
})

/**
 * ChatService — real-time bidirectional messaging
 * Demonstrates: bidirectional streaming
 */
export const ChatServiceDef = defineService('ChatService', {
  chat: bidi<ChatMessage, ChatMessage>(),
})
