/**
 * Test script to verify additional service staff assignments are being saved to database
 */

import { prisma } from '../lib/prisma'

async function testAdditionalServiceStorage() {
  try {
    console.log('🔍 Testing additional service storage...\n')

    // Find appointments with multiple services
    const appointmentsWithMultipleServices = await prisma.appointment.findMany({
      include: {
        services: {
          include: {
            service: {
              select: { name: true }
            },
            staff: {
              select: { id: true, name: true }
            }
          }
        },
        client: {
          select: {
            clientProfile: {
              select: { name: true }
            }
          }
        }
      },
      where: {
        services: {
          some: {}
        }
      },
      take: 10
    })

    console.log(`Found ${appointmentsWithMultipleServices.length} appointments\n`)

    let appointmentsWithAdditionalServices = 0
    let servicesWithStaffAssignment = 0
    let servicesWithoutStaffAssignment = 0

    appointmentsWithMultipleServices.forEach((appointment) => {
      const serviceCount = appointment.services.length
      
      if (serviceCount > 1) {
        appointmentsWithAdditionalServices++
        console.log(`\n📅 Appointment: ${appointment.bookingReference}`)
        console.log(`   Client: ${appointment.client.clientProfile?.name || 'Unknown'}`)
        console.log(`   Services (${serviceCount}):`)
        
        appointment.services.forEach((appointmentService, index) => {
          const isMainService = index === 0
          const label = isMainService ? 'Main Service' : `Additional Service ${index}`
          
          console.log(`   ${index + 1}. ${label}: ${appointmentService.service.name}`)
          
          if (appointmentService.staffId && appointmentService.staff) {
            console.log(`      ✅ Staff: ${appointmentService.staff.name} (ID: ${appointmentService.staffId})`)
            servicesWithStaffAssignment++
          } else {
            console.log(`      ⚠️  No staff assigned`)
            servicesWithoutStaffAssignment++
          }
        })
      } else if (serviceCount === 1) {
        console.log(`\n📅 Appointment: ${appointment.bookingReference} - Single service only`)
      }
    })

    console.log('\n' + '='.repeat(60))
    console.log('📊 SUMMARY:')
    console.log('='.repeat(60))
    console.log(`Total appointments checked: ${appointmentsWithMultipleServices.length}`)
    console.log(`Appointments with additional services: ${appointmentsWithAdditionalServices}`)
    console.log(`Services with staff assignment: ${servicesWithStaffAssignment}`)
    console.log(`Services without staff assignment: ${servicesWithoutStaffAssignment}`)
    
    if (appointmentsWithAdditionalServices > 0) {
      console.log('\n✅ Additional service storage is working!')
      if (servicesWithStaffAssignment > 0) {
        console.log('✅ Staff assignments are being saved to the database!')
      } else {
        console.log('⚠️  No staff assignments found - this may be expected if no additional services have staff assigned yet')
      }
    } else {
      console.log('\nℹ️  No appointments with additional services found yet')
      console.log('   Add an additional service to an appointment to test the feature')
    }

  } catch (error) {
    console.error('❌ Error testing additional service storage:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testAdditionalServiceStorage()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Test failed:', error)
    process.exit(1)
  })
