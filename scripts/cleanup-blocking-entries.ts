/**
 * Cleanup script to remove old additional service blocking entries from the database
 * These were created as separate appointment records but are now handled client-side
 */

import { prisma } from '../lib/prisma'

async function cleanupBlockingEntries() {
  try {
    console.log('🧹 Starting cleanup of blocking entries...')

    // Find all appointments that are blocking entries
    // These have specific text in their notes field
    const blockingEntries = await prisma.appointment.findMany({
      where: {
        notes: { contains: 'Visual blocking entry for additional service' }
      }
    })

    console.log(`Found ${blockingEntries.length} blocking entries to delete`)

    if (blockingEntries.length > 0) {
      // Delete all blocking entries
      const result = await prisma.appointment.deleteMany({
        where: {
          notes: { contains: 'Visual blocking entry for additional service' }
        }
      })

      console.log(`✅ Deleted ${result.count} blocking entries`)
    } else {
      console.log('✅ No blocking entries found to delete')
    }

    console.log('🎉 Cleanup completed successfully!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupBlockingEntries()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed to cleanup blocking entries:', error)
    process.exit(1)
  })
