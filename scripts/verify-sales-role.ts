import { prisma } from '../lib/prisma'
import { ROLE_PERMISSIONS, PERMISSIONS } from '../lib/permissions'

async function main() {
  console.log('🔍 Verifying Sales role configuration...\n')

  // Find Samrawit
  const samrawit = await prisma.staff.findFirst({
    where: {
      name: {
        contains: 'Samrawit',
        mode: 'insensitive'
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      locations: true,
      isActive: true
    }
  })

  if (!samrawit) {
    console.log('❌ Samrawit not found in database')
    return
  }

  console.log('✅ Found Samrawit:')
  console.log('   ID:', samrawit.id)
  console.log('   Name:', samrawit.name)
  console.log('   Email:', samrawit.email)
  console.log('   Role:', samrawit.role)
  console.log('   Locations:', samrawit.locations)
  console.log('   Active:', samrawit.isActive)
  console.log('')

  // Get role permissions
  const roleKey = samrawit.role.toUpperCase() as keyof typeof ROLE_PERMISSIONS
  const permissions = ROLE_PERMISSIONS[roleKey] || []

  console.log('📋 Permissions for', samrawit.role, 'role:')
  console.log('   Total permissions:', permissions.length)
  console.log('')

  // Check specific permissions
  const checkPermissions = [
    PERMISSIONS.VIEW_POS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.VIEW_APPOINTMENTS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.EDIT_INVENTORY,
    PERMISSIONS.TRANSFER_INVENTORY
  ]

  console.log('🔐 Permission checks:')
  checkPermissions.forEach(permission => {
    const hasIt = permissions.includes(permission)
    const status = hasIt ? '✅' : '❌'
    console.log(`   ${status} ${permission}`)
  })
  console.log('')

  // Show all permissions
  console.log('📝 Full permission list:')
  permissions.forEach(permission => {
    console.log(`   - ${permission}`)
  })
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
