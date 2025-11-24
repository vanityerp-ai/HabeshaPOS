import { prisma } from '../lib/prisma'

async function fetchServices() {
  try {
    console.log('🔄 Debug: fetching services using Prisma...')

    const services = await prisma.service.findMany({
      where: { isActive: true },
      include: {
        locations: {
          where: { isActive: true },
          include: { location: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    console.log(`✅ Found ${services.length} services`)
    services.slice(0, 5).forEach(s => {
      console.log(` - ${s.id} ${s.name} (${s.locations.length} locations)`)
    })
  } catch (error) {
    console.error('❌ Debug: error fetching services:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fetchServices()
