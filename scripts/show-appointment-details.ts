/**
 * Show detailed appointment information including additional services and staff assignments
 */

import { prisma } from '../lib/prisma'

async function showAppointmentDetails() {
  try {
    const bookingRef = process.argv[2] || 'VH-495347'; // Maria's appointment from screenshot
    
    console.log(`\n🔍 Looking up appointment: ${bookingRef}\n`)

    const appointment = await prisma.appointment.findUnique({
      where: { bookingReference: bookingRef },
      include: {
        client: {
          select: {
            clientProfile: {
              select: { name: true }
            }
          }
        },
        staff: {
          select: { id: true, name: true }
        },
        location: {
          select: { name: true }
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true, duration: true }
            },
            staff: {
              select: { id: true, name: true }
            }
          }
        }
      }
    })

    if (!appointment) {
      console.log(`❌ Appointment ${bookingRef} not found\n`)
      return
    }

    console.log('📅 APPOINTMENT DETAILS')
    console.log('='.repeat(60))
    console.log(`Booking Reference: ${appointment.bookingReference}`)
    console.log(`Client: ${appointment.client.clientProfile?.name || 'Unknown'}`)
    console.log(`Main Staff: ${appointment.staff.name}`)
    console.log(`Location: ${appointment.location.name}`)
    console.log(`Date: ${appointment.date.toISOString()}`)
    console.log(`Status: ${appointment.status}`)
    console.log(`\n📋 SERVICES (${appointment.services.length} total):\n`)

    appointment.services.forEach((appointmentService, index) => {
      const isMain = index === 0
      console.log(`${index + 1}. ${isMain ? '🔹 MAIN SERVICE' : '➕ ADDITIONAL SERVICE'}`)
      console.log(`   Service: ${appointmentService.service.name}`)
      console.log(`   Price: QAR ${appointmentService.price}`)
      console.log(`   Duration: ${appointmentService.duration} minutes`)
      
      if (appointmentService.staffId) {
        console.log(`   ✅ Assigned Staff: ${appointmentService.staff?.name || 'Unknown'} (ID: ${appointmentService.staffId})`)
      } else {
        console.log(`   ⚠️  No staff assigned`)
      }
      console.log('')
    })

    console.log('='.repeat(60))
    
    // Summary
    const servicesWithStaff = appointment.services.filter(s => s.staffId).length
    const servicesWithoutStaff = appointment.services.length - servicesWithStaff
    
    console.log('\n📊 SUMMARY:')
    console.log(`Total services: ${appointment.services.length}`)
    console.log(`Services with staff: ${servicesWithStaff} ✅`)
    console.log(`Services without staff: ${servicesWithoutStaff} ${servicesWithoutStaff > 0 ? '⚠️' : ''}`)

    if (servicesWithoutStaff > 0 && appointment.services.length > 1) {
      console.log('\n💡 TIP: Additional services without staff assignments won\'t show blocking on the calendar')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

showAppointmentDetails()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error)
    process.exit(1)
  })
