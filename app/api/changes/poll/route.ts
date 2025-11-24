import { NextRequest, NextResponse } from 'next/server'
import { getChangesSince, getLatestChangeTimestamp } from '@/lib/change-tracker'

/**
 * GET /api/changes/poll
 * Poll for data changes since a given timestamp
 * 
 * Query params:
 * - since: ISO timestamp to get changes since
 * - entityTypes: comma-separated list of entity types to filter
 * - locationId: optional location ID to filter changes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sinceParam = searchParams.get('since')
    const entityTypesParam = searchParams.get('entityTypes')
    const locationId = searchParams.get('locationId')

    // If no since param, return the latest timestamp
    if (!sinceParam) {
      const latestTimestamp = await getLatestChangeTimestamp()
      return NextResponse.json({
        timestamp: latestTimestamp?.toISOString() || new Date().toISOString(),
        changes: [],
      })
    }

    const since = new Date(sinceParam)
    
    if (isNaN(since.getTime())) {
      return NextResponse.json(
        { error: 'Invalid since parameter' },
        { status: 400 }
      )
    }

    const entityTypes = entityTypesParam 
      ? entityTypesParam.split(',') as any[]
      : undefined

    const changes = await getChangesSince(since, {
      entityTypes,
      locationId: locationId || undefined,
      limit: 500, // Limit to 500 changes per poll
    })

    // Get the latest timestamp to use for next poll
    const latestTimestamp = changes.length > 0
      ? changes[changes.length - 1].timestamp
      : since

    return NextResponse.json({
      timestamp: latestTimestamp.toISOString(),
      changes: changes.map(change => ({
        id: change.id,
        entityType: change.entityType,
        entityId: change.entityId,
        changeType: change.changeType,
        locationId: change.locationId,
        userId: change.userId,
        timestamp: change.timestamp.toISOString(),
      })),
      hasMore: changes.length === 500,
    })
  } catch (error) {
    console.error('Error polling changes:', error)
    return NextResponse.json(
      { error: 'Failed to poll changes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/changes/poll/cleanup
 * Clean up old change records
 */
export async function POST(request: NextRequest) {
  try {
    const { hoursToKeep = 24 } = await request.json()
    
    const { cleanupOldChanges } = await import('@/lib/change-tracker')
    const deletedCount = await cleanupOldChanges(hoursToKeep)

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} old change records`,
    })
  } catch (error) {
    console.error('Error cleaning up changes:', error)
    return NextResponse.json(
      { error: 'Failed to clean up changes' },
      { status: 500 }
    )
  }
}
