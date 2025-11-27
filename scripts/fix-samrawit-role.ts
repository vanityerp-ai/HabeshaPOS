import { prisma } from '../lib/prisma'

async function main() {
  console.log('🔍 Finding Samrawit in database...\n')

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
      isActive: true
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
        isActive: true
      }
    })
    console.table(allStaff)
    return
  }

  console.log('✅ Found Samrawit:')
  console.log('   ID:', samrawit.id)
  console.log('   Name:', samrawit.name)
  console.log('   Email:', samrawit.email)
  console.log('   Current Role:', samrawit.role)
  console.log('   Active:', samrawit.isActive)
  console.log('')

  if (samrawit.role === 'SALES') {
    console.log('✅ Samrawit already has the SALES role. No update needed.')
    return
  }

  console.log(`🔄 Updating role from "${samrawit.role}" to "SALES"...`)
  
  const updated = await prisma.staff.update({
    where: { id: samrawit.id },
    data: { role: 'SALES' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  })

  console.log('✅ Successfully updated!')
  console.log('   New Role:', updated.role)
  console.log('')
  console.log('🔄 Please tell Samrawit to:')
  console.log('   1. Log out completely')
  console.log('   2. Clear browser cache (Ctrl+Shift+Delete)')
  console.log('   3. Log back in')
  console.log('')
  console.log('Or alternatively, just clear localStorage by running this in browser console:')
  console.log('   localStorage.clear(); location.reload();')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .then(() => {
    process.exit(0)
  })
