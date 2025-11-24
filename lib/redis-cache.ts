// Enhanced Redis Caching Service for Vanity Hub
// Note: Redis is optional - using memory cache fallback

// Cache configuration interface
interface CacheConfig {
  ttl: number // Time to live in seconds
  priority: 'critical' | 'high' | 'medium' | 'low'
  compress?: boolean // Whether to compress large data
  serialize?: boolean // Whether to serialize objects
}

// Cache entry interface
interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  priority: string
  compressed?: boolean
}

// Cache statistics interface
interface CacheStats {
  hits: number
  misses: number
  sets: number
  deletes: number
  errors: number
  totalKeys: number
  memoryUsage: number
}

class RedisCacheService {
  private redis: any = null
  private fallbackCache = new Map<string, CacheEntry>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    totalKeys: 0,
    memoryUsage: 0
  }

  constructor() {
    this.initializeRedis()
    this.startCleanupInterval()
  }

  private initializeRedis() {
    // Redis is optional - using memory cache fallback for serverless deployment
    try {
      if (process.env.REDIS_URL) {
        console.log('Redis URL configured, but using memory cache for serverless deployment')
        // const { Redis } = require('ioredis')
        // this.redis = new Redis(process.env.REDIS_URL, {
        //   maxRetriesPerRequest: 3,
        //   lazyConnect: true,
        //   enableReadyCheck: true,
        //   enableOfflineQueue: false,
        //   connectTimeout: 10000,
        //   commandTimeout: 5000,
        // })
      }
    } catch (error) {
      console.warn('Failed to initialize Redis, using fallback cache:', error)
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = `cache:${key}`

    try {
      if (this.redis) {
        const cached = await this.redis.get(cacheKey)
        if (cached) {
          this.stats.hits++
          const entry: CacheEntry<T> = JSON.parse(cached)
          
          // Check if entry is still valid
          if (Date.now() - entry.timestamp < entry.ttl * 1000) {
            return entry.data
          } else {
            // Entry expired, delete it
            await this.delete(key)
          }
        }
      } else {
        // Fallback to memory cache
        const entry = this.fallbackCache.get(cacheKey)
        if (entry && Date.now() - entry.timestamp < entry.ttl * 1000) {
          this.stats.hits++
          return entry.data
        } else if (entry) {
          this.fallbackCache.delete(cacheKey)
        }
      }

      this.stats.misses++
      return null
    } catch (error) {
      console.error('Cache get error:', error)
      this.stats.errors++
      return null
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, config: CacheConfig): Promise<boolean> {
    const cacheKey = `cache:${key}`
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: config.ttl,
      priority: config.priority,
      compressed: config.compress || false
    }

    try {
      const serialized = JSON.stringify(entry)

      if (this.redis) {
        await this.redis.setex(cacheKey, config.ttl, serialized)
      } else {
        // Fallback to memory cache
        this.fallbackCache.set(cacheKey, entry)
      }

      this.stats.sets++
      return true
    } catch (error) {
      console.error('Cache set error:', error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string): Promise<boolean> {
    const cacheKey = `cache:${key}`

    try {
      if (this.redis) {
        await this.redis.del(cacheKey)
      } else {
        this.fallbackCache.delete(cacheKey)
      }

      this.stats.deletes++
      return true
    } catch (error) {
      console.error('Cache delete error:', error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    const searchPattern = `cache:${pattern}*`
    let deletedCount = 0

    try {
      if (this.redis) {
        const keys = await this.redis.keys(searchPattern)
        if (keys.length > 0) {
          deletedCount = await this.redis.del(...keys)
        }
      } else {
        // Fallback to memory cache
        for (const [key] of this.fallbackCache) {
          if (key.startsWith(searchPattern.replace('*', ''))) {
            this.fallbackCache.delete(key)
            deletedCount++
          }
        }
      }

      this.stats.deletes += deletedCount
      return deletedCount
    } catch (error) {
      console.error('Cache delete pattern error:', error)
      this.stats.errors++
      return 0
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    const cacheKey = `cache:${key}`

    try {
      if (this.redis) {
        return (await this.redis.exists(cacheKey)) === 1
      } else {
        return this.fallbackCache.has(cacheKey)
      }
    } catch (error) {
      console.error('Cache exists error:', error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      if (this.redis) {
        const info = await this.redis.info('memory')
        const memoryMatch = info.match(/used_memory:(\d+)/)
        this.stats.memoryUsage = memoryMatch ? parseInt(memoryMatch[1]) : 0
        
        const keyCount = await this.redis.dbsize()
        this.stats.totalKeys = keyCount
      } else {
        this.stats.totalKeys = this.fallbackCache.size
        this.stats.memoryUsage = JSON.stringify([...this.fallbackCache.entries()]).length
      }

      return { ...this.stats }
    } catch (error) {
      console.error('Cache stats error:', error)
      this.stats.errors++
      return { ...this.stats }
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    try {
      if (this.redis) {
        await this.redis.flushdb()
      } else {
        this.fallbackCache.clear()
      }

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0,
        totalKeys: 0,
        memoryUsage: 0
      }

      return true
    } catch (error) {
      console.error('Cache clear error:', error)
      this.stats.errors++
      return false
    }
  }

  /**
   * Start cleanup interval for expired entries in fallback cache
   */
  private startCleanupInterval() {
    if (!this.redis) {
      setInterval(() => {
        const now = Date.now()
        for (const [key, entry] of this.fallbackCache) {
          if (now - entry.timestamp > entry.ttl * 1000) {
            this.fallbackCache.delete(key)
          }
        }
      }, 60000) // Clean up every minute
    }
  }

  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses
    return total > 0 ? this.stats.hits / total : 0
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy', details: any }> {
    try {
      if (this.redis) {
        const start = Date.now()
        await this.redis.ping()
        const latency = Date.now() - start

        return {
          status: latency < 100 ? 'healthy' : 'degraded',
          details: {
            redis: true,
            latency,
            hitRatio: this.getHitRatio(),
            totalKeys: this.stats.totalKeys
          }
        }
      } else {
        return {
          status: 'degraded',
          details: {
            redis: false,
            fallbackCache: true,
            hitRatio: this.getHitRatio(),
            totalKeys: this.stats.totalKeys
          }
        }
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          redis: false,
          fallbackCache: !this.redis
        }
      }
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCacheService()

// Export cache configurations for different data types
export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  // Critical data - short TTL, high priority
  appointments: { ttl: 300, priority: 'critical' }, // 5 minutes
  inventory: { ttl: 180, priority: 'critical' }, // 3 minutes
  transactions: { ttl: 300, priority: 'critical' }, // 5 minutes
  realTime: { ttl: 30, priority: 'critical' }, // 30 seconds
  
  // High priority data - medium TTL
  clients: { ttl: 600, priority: 'high' }, // 10 minutes
  staff: { ttl: 900, priority: 'high' }, // 15 minutes
  notifications: { ttl: 60, priority: 'high' }, // 1 minute
  
  // Medium priority data - longer TTL
  services: { ttl: 1800, priority: 'medium' }, // 30 minutes
  products: { ttl: 1800, priority: 'medium' }, // 30 minutes
  analytics: { ttl: 600, priority: 'medium' }, // 10 minutes
  
  // Low priority data - long TTL
  locations: { ttl: 3600, priority: 'low' }, // 1 hour
  settings: { ttl: 3600, priority: 'low' }, // 1 hour
  reports: { ttl: 1800, priority: 'low' }, // 30 minutes
}
