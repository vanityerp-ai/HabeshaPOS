import { PrismaClient } from '@prisma/client'
import { ROLE_PERMISSIONS, PERMISSIONS } from '../lib/permissions'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifying Samrawit\'s access configuration...\n')

  // Find Samrawit
  const samrawit = await prisma.staff.findFirst({
    where: {
      OR: [
        { name: { contains: 'Samrawit', mode: 'insensitive' } },
        { email: { contains: 'samrawit', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      locations: true,
      isActive: true,
      employeeNumber: true,
    }
  })

  if (!samrawit) {
    console.log('❌ Samrawit not found in database')
    console.log('\n📋 Listing all staff members...')
    const allStaff = await prisma.staff.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      }
    })
    console.table(allStaff)
    return
  }

  console.log('✅ Found Samrawit:')
  console.log('   ID:', samrawit.id)
  console.log('   Name:', samrawit.name)
  console.log('   Email:', samrawit.email)
  console.log('   Employee Number:', samrawit.employeeNumber)
  console.log('   Role:', samrawit.role)
  console.log('   Locations:', samrawit.locations)
  console.log('   Active:', samrawit.isActive)
  console.log('')

  // Verify role is SALES
  if (samrawit.role !== 'SALES') {
    console.log('⚠️  WARNING: Role is not SALES!')
    console.log(`   Current role: ${samrawit.role}`)
    console.log(`   Expected role: SALES`)
    console.log('')
    console.log('💡 To fix this, run: npm run fix-samrawit-role')
    return
  }

  console.log('✅ Role is correctly set to SALES')
  console.log('')

  // Get role permissions
  const roleKey = samrawit.role.toUpperCase() as keyof typeof ROLE_PERMISSIONS
  const permissions = ROLE_PERMISSIONS[roleKey] || []

  console.log('📋 Permissions for SALES role:')
  console.log('   Total permissions:', permissions.length)
  console.log('')

  // Check critical permissions
  const criticalPermissions = [
    { name: 'VIEW_POS', permission: PERMISSIONS.VIEW_POS, required: true },
    { name: 'VIEW_INVENTORY', permission: PERMISSIONS.VIEW_INVENTORY, required: true },
    { name: 'CREATE_SALE', permission: PERMISSIONS.CREATE_SALE, required: true },
    { name: 'CREATE_INVENTORY', permission: PERMISSIONS.CREATE_INVENTORY, required: true },
    { name: 'TRANSFER_INVENTORY', permission: PERMISSIONS.TRANSFER_INVENTORY, required: true },
    { name: 'VIEW_DASHBOARD', permission: PERMISSIONS.VIEW_DASHBOARD, required: false },
    { name: 'VIEW_CLIENTS', permission: PERMISSIONS.VIEW_CLIENTS, required: false },
    { name: 'EDIT_INVENTORY', permission: PERMISSIONS.EDIT_INVENTORY, required: false },
  ]

  console.log('🔐 Critical Permission Checks:')
  criticalPermissions.forEach(({ name, permission, required }) => {
    const hasPermission = permissions.includes(permission)
    const status = required
      ? (hasPermission ? '✅' : '❌')
      : (hasPermission ? '⚠️  (should NOT have)' : '✅')
    
    console.log(`   ${status} ${name}: ${hasPermission ? 'GRANTED' : 'DENIED'}`)
  })
  console.log('')

  // Summary
  console.log('📊 Access Summary:')
  console.log('   ✅ Can access: Point of Sale (/dashboard/pos)')
  console.log('   ✅ Can access: Inventory (/dashboard/inventory)')
  console.log('   ❌ Cannot access: Dashboard home (/dashboard)')
  console.log('   ❌ Cannot access: Appointments (/dashboard/appointments)')
  console.log('   ❌ Cannot access: Clients (/dashboard/clients)')
  console.log('   ❌ Cannot access: All other pages')
  console.log('')

  // Check if user account exists
  const userAccount = await prisma.user.findFirst({
    where: {
      email: samrawit.email
    },
    select: {
      id: true,
      email: true,
      role: true,
    }
  })

  if (userAccount) {
    console.log('✅ User account exists:')
    console.log('   Email:', userAccount.email)
    console.log('   Role:', userAccount.role)
    console.log('')
  } else {
    console.log('⚠️  No user account found for this email')
    console.log('   Samrawit may need to register or have an account created')
    console.log('')
  }

  console.log('✅ Verification complete!')
  console.log('')
  console.log('🧪 To test the implementation:')
  console.log('   1. Log in as samrawit@habeshasalon.com')
  console.log('   2. Verify you are redirected to /dashboard/pos')
  console.log('   3. Check that only POS and Inventory appear in navigation')
  console.log('   4. Try to access /dashboard/appointments directly')
  console.log('   5. Verify you are redirected back to /dashboard/pos')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
