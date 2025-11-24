import { NextRequest, NextResponse } from 'next/server'

// In-memory store for development (when Redis is not available)
const memoryStore = new Map<string, { count: number; resetTime: number }>()

// Redis client type (optional, falls back to memory store)
let redis: any = null

// Redis is optional - we use memory store in production without Redis
// try {
//   if (process.env.REDIS_URL) {
//     const { Redis } = require('ioredis')
//     redis = new Redis(process.env.REDIS_URL)
//   }
// } catch (error) {
//   console.warn('Redis not available, using memory store for rate limiting')
// }

export interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (request: NextRequest) => string
  onLimitReached?: (request: NextRequest) => void
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

// Default key generator (IP + User Agent)
function defaultKeyGenerator(request: NextRequest): string {
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return `${ip}:${userAgent.substring(0, 50)}`
}

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP || remoteAddr || 'unknown'
}

// Rate limiting implementation
export async function rateLimit(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
  } = options

  const key = `rate_limit:${keyGenerator(request)}`
  const now = Date.now()
  const windowStart = now - windowMs

  try {
    if (redis) {
      return await redisRateLimit(key, now, windowStart, maxRequests, windowMs)
    } else {
      return memoryRateLimit(key, now, windowStart, maxRequests, windowMs)
    }
  } catch (error) {
    console.error('Rate limiting error:', error)
    // On error, allow the request to proceed
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    }
  }
}

// Redis-based rate limiting
async function redisRateLimit(
  key: string,
  now: number,
  windowStart: number,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const pipeline = redis!.pipeline()
  
  // Remove expired entries
  pipeline.zremrangebyscore(key, 0, windowStart)
  
  // Count current requests in window
  pipeline.zcard(key)
  
  // Add current request
  pipeline.zadd(key, now, `${now}-${Math.random()}`)
  
  // Set expiration
  pipeline.expire(key, Math.ceil(windowMs / 1000))
  
  const results = await pipeline.exec()
  const count = results![1][1] as number
  
  const resetTime = now + windowMs
  const remaining = Math.max(0, maxRequests - count - 1)
  
  if (count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetTime,
      retryAfter: Math.ceil(windowMs / 1000),
    }
  }
  
  return {
    success: true,
    limit: maxRequests,
    remaining,
    resetTime,
  }
}

// Memory-based rate limiting (fallback)
function memoryRateLimit(
  key: string,
  now: number,
  windowStart: number,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupMemoryStore(now)
  }
  
  const entry = memoryStore.get(key)
  const resetTime = now + windowMs
  
  if (!entry || entry.resetTime <= now) {
    // First request in window or window expired
    memoryStore.set(key, { count: 1, resetTime })
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetTime,
    }
  }
  
  if (entry.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    }
  }
  
  entry.count++
  const remaining = Math.max(0, maxRequests - entry.count)
  
  return {
    success: true,
    limit: maxRequests,
    remaining,
    resetTime: entry.resetTime,
  }
}

// Clean up expired entries from memory store
function cleanupMemoryStore(now: number) {
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetTime <= now) {
      memoryStore.delete(key)
    }
  }
}

// Rate limiting middleware factory
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    const result = await rateLimit(request, options)
    
    if (!result.success) {
      const response = NextResponse.json(
        {
          error: options.message || 'Too many requests',
          retryAfter: result.retryAfter,
        },
        { status: 429 }
      )
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', result.limit.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString())
      
      if (result.retryAfter) {
        response.headers.set('Retry-After', result.retryAfter.toString())
      }
      
      // Call onLimitReached callback if provided
      if (options.onLimitReached) {
        options.onLimitReached(request)
      }
      
      return response
    }
    
    return null // Continue to next middleware/handler
  }
}

// Predefined rate limiters
export const loginRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts. Please try again later.',
  keyGenerator: (request) => {
    const ip = getClientIP(request)
    return `login:${ip}`
  },
  onLimitReached: (request) => {
    console.warn(`Login rate limit exceeded for IP: ${getClientIP(request)}`)
  },
})

export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 API requests per 15 minutes
  message: 'API rate limit exceeded. Please slow down.',
})

export const registrationRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 registrations per hour per IP
  message: 'Too many registration attempts. Please try again later.',
  keyGenerator: (request) => {
    const ip = getClientIP(request)
    return `registration:${ip}`
  },
})

export const uploadRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 uploads per hour
  message: 'Upload rate limit exceeded. Please try again later.',
})

// User-specific rate limiting (requires authentication)
export function createUserRateLimit(userId: string, options: RateLimitOptions) {
  return createRateLimitMiddleware({
    ...options,
    keyGenerator: () => `user:${userId}`,
  })
}

// Endpoint-specific rate limiting
export function createEndpointRateLimit(endpoint: string, options: RateLimitOptions) {
  return createRateLimitMiddleware({
    ...options,
    keyGenerator: (request) => {
      const ip = getClientIP(request)
      return `endpoint:${endpoint}:${ip}`
    },
  })
}

// Rate limit status check
export async function getRateLimitStatus(
  request: NextRequest,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  return await rateLimit(request, options)
}

// Reset rate limit for a specific key (admin function)
export async function resetRateLimit(key: string): Promise<void> {
  try {
    if (redis) {
      await redis.del(`rate_limit:${key}`)
    } else {
      memoryStore.delete(`rate_limit:${key}`)
    }
  } catch (error) {
    console.error('Error resetting rate limit:', error)
  }
}
