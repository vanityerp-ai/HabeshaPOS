import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAdminUsers() {
  try {
    console.log('🔍 Checking admin users...\n')
    
    const adminUsers = await prisma.user.findMany({
      where: { 
        role: 'ADMIN',
        isActive: true 
      },
      select: {
        email: true,
        isActive: true,
        createdAt: true,
      }
    })

    console.log(`Found ${adminUsers.length} active admin users:\n`)
    
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. Email: ${user.email}`)
      console.log(`   Active: ${user.isActive}`)
      console.log(`   Created: ${user.createdAt}`)
      console.log('')
    })

    // Also check for the specific email
    const specificUser = await prisma.user.findUnique({
      where: { email: 'admin@vanityhub.com' },
      select: {
        email: true,
        isActive: true,
        role: true,
      }
    })

    if (specificUser) {
      console.log('✅ User admin@vanityhub.com exists:')
      console.log(`   Role: ${specificUser.role}`)
      console.log(`   Active: ${specificUser.isActive}`)
    } else {
      console.log('❌ User admin@vanityhub.com NOT found')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAdminUsers()

