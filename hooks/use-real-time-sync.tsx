"use client"

import { useEffect, useCallback, useRef, useState } from 'react'
import { EntityType } from '@/lib/change-tracker'

export interface DataChange {
  id: string
  entityType: string
  entityId: string
  changeType: 'CREATE' | 'UPDATE' | 'DELETE'
  locationId?: string | null
  userId?: string | null
  timestamp: string
}

export interface UseRealTimeSyncOptions {
  enabled?: boolean
  pollInterval?: number // milliseconds
  entityTypes?: EntityType[]
  locationId?: string
  onChanges?: (changes: DataChange[]) => void
}

/**
 * Hook for real-time synchronization using database polling
 * This replaces the localStorage-based real-time service for multi-device support
 */
export function useRealTimeSync(options: UseRealTimeSyncOptions = {}) {
  const {
    enabled = true,
    pollInterval = 10000, // Poll every 10 seconds by default
    entityTypes,
    locationId,
    onChanges,
  } = options

  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [changes, setChanges] = useState<DataChange[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onChangesRef = useRef(onChanges)

  // Keep onChanges ref updated
  useEffect(() => {
    onChangesRef.current = onChanges
  }, [onChanges])

  // Initialize: Get current timestamp
  useEffect(() => {
    if (!enabled) return

    const initializeSync = async () => {
      try {
        const response = await fetch('/api/changes/poll')
        const data = await response.json()
        setLastSyncTime(data.timestamp)
      } catch (error) {
        console.error('Failed to initialize sync:', error)
      }
    }

    initializeSync()
  }, [enabled])

  // Poll for changes
  const pollChanges = useCallback(async () => {
    if (!lastSyncTime || isPolling) return

    setIsPolling(true)
    
    try {
      const params = new URLSearchParams({
        since: lastSyncTime,
      })

      if (entityTypes && entityTypes.length > 0) {
        params.append('entityTypes', entityTypes.join(','))
      }

      if (locationId) {
        params.append('locationId', locationId)
      }

      const response = await fetch(`/api/changes/poll?${params.toString()}`)
      const data = await response.json()

      if (data.changes && data.changes.length > 0) {
        setChanges(prev => [...data.changes, ...prev].slice(0, 100)) // Keep last 100 changes
        
        // Call the callback if provided
        if (onChangesRef.current) {
          onChangesRef.current(data.changes)
        }
      }

      // Update last sync time
      setLastSyncTime(data.timestamp)
    } catch (error) {
      console.error('Failed to poll changes:', error)
    } finally {
      setIsPolling(false)
    }
  }, [lastSyncTime, isPolling, entityTypes, locationId])

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !lastSyncTime) return

    intervalRef.current = setInterval(pollChanges, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, lastSyncTime, pollInterval, pollChanges])

  // Manual refresh
  const refresh = useCallback(() => {
    pollChanges()
  }, [pollChanges])

  return {
    changes,
    isPolling,
    lastSyncTime,
    refresh,
  }
}

/**
 * Hook to track specific entity changes
 */
export function useEntityChanges(
  entityType: EntityType,
  onEntityChange?: (change: DataChange) => void
) {
  const handleChanges = useCallback((changes: DataChange[]) => {
    changes
      .filter(change => change.entityType === entityType)
      .forEach(change => {
        if (onEntityChange) {
          onEntityChange(change)
        }
      })
  }, [entityType, onEntityChange])

  return useRealTimeSync({
    entityTypes: [entityType],
    onChanges: handleChanges,
  })
}
