import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Health check endpoint
 * 
 * This endpoint can be used to:
 * 1. Check if the API is running
 * 2. Check if the database is connected
 * 3. Keep the Supabase database active (prevents auto-pause)
 * 
 * Usage:
 * - GET /api/health - Basic health check
 * - GET /api/health?db=true - Include database check
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const checkDb = searchParams.get('db') === 'true'

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: {
      connected: false,
      latency: 0
    }
  }

  // Check database connection if requested
  if (checkDb) {
    try {
      const start = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const latency = Date.now() - start
      
      health.database.connected = true
      health.database.latency = latency
      
      console.log(`✅ Health check: Database connected (${latency}ms)`)
    } catch (error) {
      health.status = 'degraded'
      health.database.connected = false
      
      console.error('❌ Health check: Database connection failed:', error)
      
      return NextResponse.json(health, { status: 503 })
    }
  }

  return NextResponse.json(health)
}

