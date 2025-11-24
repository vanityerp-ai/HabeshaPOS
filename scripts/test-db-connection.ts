#!/usr/bin/env tsx

/**
 * Test Database Connection Script
 *
 * This script tests the connection to your Supabase database
 * and provides helpful diagnostics.
 *
 * Usage:
 *   npx tsx scripts/test-db-connection.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function testConnection() {
  console.log('🔍 Testing database connection...\n')

  // Extract database info from URL
  const dbUrl = process.env.DATABASE_URL || ''
  const match = dbUrl.match(/@([^:]+):(\d+)\/([^?]+)/)

  if (match) {
    console.log('📊 Database Information:')
    console.log(`   Host: ${match[1]}`)
    console.log(`   Port: ${match[2]}`)
    console.log(`   Database: ${match[3]}`)
    console.log('')
  }

  try {
    // Test 1: Basic connection
    console.log('Test 1: Connecting to database...')
    const start = Date.now()
    await prisma.$connect()
    const connectTime = Date.now() - start
    console.log(`✅ Connected successfully (${connectTime}ms)\n`)

    // Test 2: Simple query
    console.log('Test 2: Running simple query...')
    const queryStart = Date.now()
    await prisma.$queryRaw`SELECT 1 as test`
    const queryTime = Date.now() - queryStart
    console.log(`✅ Query executed successfully (${queryTime}ms)\n`)

    // Test 3: Count records
    console.log('Test 3: Counting records...')
    const [
      userCount,
      clientCount,
      serviceCount,
      locationCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.service.count(),
      prisma.location.count()
    ])

    console.log('✅ Record counts:')
    console.log(`   Users: ${userCount}`)
    console.log(`   Clients: ${clientCount}`)
    console.log(`   Services: ${serviceCount}`)
    console.log(`   Locations: ${locationCount}`)
    console.log('')

    // Summary
    console.log('🎉 All tests passed!')
    console.log('✅ Database is connected and working properly\n')

    await prisma.$disconnect()
    process.exit(0)

  } catch (error) {
    console.error('\n❌ Database connection failed!\n')

    if (error instanceof Error) {
      console.error('Error:', error.message)

      // Provide helpful diagnostics
      if (error.message.includes("Can't reach database")) {
        console.error('\n💡 Possible solutions:')
        console.error('   1. Your Supabase database may be paused (free tier auto-pauses after 1 week)')
        console.error('   2. Go to https://supabase.com/dashboard and wake up your project')
        console.error('   3. Check if your DATABASE_URL is correct in .env file')
        console.error('   4. Verify your internet connection')
      } else if (error.message.includes('authentication failed')) {
        console.error('\n💡 Possible solutions:')
        console.error('   1. Check your database password in DATABASE_URL')
        console.error('   2. Verify credentials in Supabase dashboard')
      } else if (error.message.includes('timeout')) {
        console.error('\n💡 Possible solutions:')
        console.error('   1. Your network may be blocking the connection')
        console.error('   2. Try using a VPN')
        console.error('   3. Check firewall settings')
      }
    }

    await prisma.$disconnect()
    process.exit(1)
  }
}

// Run the test
testConnection()