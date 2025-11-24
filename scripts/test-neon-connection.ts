import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function testConnection() {
  console.log('🔍 Testing Neon PostgreSQL connection...\n')
  
  try {
    // Test connection
    await prisma.$connect()
    console.log('✅ Connection successful!\n')
    
    // Test query
    const result = await prisma.$queryRaw`SELECT version(), current_database(), current_user`
    console.log('📊 Database info:', result)
    
    // List all tables
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `
    console.log('\n📋 Tables in database:', tables)
    
  } catch (error) {
    console.error('❌ Connection failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
