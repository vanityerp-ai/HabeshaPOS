import { prisma } from './prisma'

export type ChangeType = 'CREATE' | 'UPDATE' | 'DELETE'

export type EntityType = 
  | 'User' 
  | 'StaffMember' 
  | 'Client' 
  | 'Location' 
  | 'Service' 
  | 'Product' 
  | 'ProductLocation'
  | 'Appointment' 
  | 'Transaction'
  | 'Transfer'
  | 'InventoryAudit'

export interface TrackChangeOptions {
  entityType: EntityType
  entityId: string
  changeType: ChangeType
  locationId?: string
  userId?: string
}

/**
 * Track a data change for real-time synchronization across devices
 */
export async function trackChange(options: TrackChangeOptions): Promise<void> {
  try {
    await prisma.dataChange.create({
      data: {
        entityType: options.entityType,
        entityId: options.entityId,
        changeType: options.changeType,
        locationId: options.locationId,
        userId: options.userId,
        timestamp: new Date(),
      },
    })
  } catch (error) {
    console.error('Failed to track change:', error)
    // Don't throw - we don't want to break the main operation if change tracking fails
  }
}

/**
 * Get changes since a given timestamp
 */
export async function getChangesSince(
  since: Date,
  options?: {
    entityTypes?: EntityType[]
    locationId?: string
    limit?: number
  }
) {
  const where: any = {
    timestamp: {
      gt: since,
    },
  }

  if (options?.entityTypes && options.entityTypes.length > 0) {
    where.entityType = {
      in: options.entityTypes,
    }
  }

  if (options?.locationId) {
    where.OR = [
      { locationId: options.locationId },
      { locationId: null }, // Include global changes
    ]
  }

  return prisma.dataChange.findMany({
    where,
    orderBy: {
      timestamp: 'asc',
    },
    take: options?.limit || 1000,
  })
}

/**
 * Clean up old change records (older than 24 hours)
 * Should be run periodically via a cron job or scheduled task
 */
export async function cleanupOldChanges(hoursToKeep: number = 24): Promise<number> {
  const cutoffDate = new Date()
  cutoffDate.setHours(cutoffDate.getHours() - hoursToKeep)

  const result = await prisma.dataChange.deleteMany({
    where: {
      timestamp: {
        lt: cutoffDate,
      },
    },
  })

  return result.count
}

/**
 * Get the latest change timestamp
 */
export async function getLatestChangeTimestamp(): Promise<Date | null> {
  const latestChange = await prisma.dataChange.findFirst({
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      timestamp: true,
    },
  })

  return latestChange?.timestamp || null
}
