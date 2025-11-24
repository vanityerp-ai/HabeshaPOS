import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetAdminPassword() {
  try {
    const email = 'admin@vanityhub.com'
    const newPassword = 'admin123'
    
    console.log('🔐 Resetting password for:', email)
    console.log('🔑 New password will be:', newPassword)
    console.log('')
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    // Update the user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
      select: {
        email: true,
        role: true,
        isActive: true,
      }
    })
    
    console.log('✅ Password reset successful!')
    console.log('')
    console.log('📋 Login Credentials:')
    console.log('   Email:', updatedUser.email)
    console.log('   Password:', newPassword)
    console.log('   Role:', updatedUser.role)
    console.log('   Active:', updatedUser.isActive)
    console.log('')
    console.log('🌐 You can now login at: http://localhost:3001/login')
    
  } catch (error) {
    console.error('❌ Error resetting password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword()

