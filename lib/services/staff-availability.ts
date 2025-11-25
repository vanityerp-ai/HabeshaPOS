"use client"

import { parseISO, addMinutes, isWithinInterval, isBefore, isAfter, isSameDay } from "date-fns"
import { getAllAppointments } from "@/lib/appointment-service"
import { bufferTimeConfigService, calculateBufferTimes } from "@/lib/services/buffer-time-config"

export interface TimeSlot {
  start: Date
  end: Date
}

export interface StaffAvailabilityCheck {
  staffId: string
  timeSlot: TimeSlot
  excludeAppointmentId?: string // For updates, exclude the appointment being modified
  serviceId?: string // For service-specific buffer times
  locationId?: string // For location-specific buffer times
}

export interface AvailabilityResult {
  isAvailable: boolean
  conflictingAppointments: any[]
  blockedTimeSlots: any[]
  reason?: string
  crossLocationConflicts?: Array<{
    appointmentId: string
    location: string
    clientName: string
    service: string
    startTime: Date
    endTime: Date
  }>
}

export interface BufferTimeConfig {
  beforeAppointment: number // minutes
  afterAppointment: number // minutes
}

export interface AppointmentContext {
  serviceId?: string
  locationId?: string
  appointmentTime?: Date
}

/**
 * Centralized Staff Availability Service
 * Prevents double-booking across all location types (physical locations + home service)
 */
export class StaffAvailabilityService {
  private static instance: StaffAvailabilityService
  private bufferConfig: BufferTimeConfig = {
    beforeAppointment: 0, // Default: no buffer
    afterAppointment: 0   // Default: no buffer
  }

  private constructor() {}

  static getInstance(): StaffAvailabilityService {
    if (!StaffAvailabilityService.instance) {
      StaffAvailabilityService.instance = new StaffAvailabilityService()
    }
    return StaffAvailabilityService.instance
  }

  /**
   * Set buffer time configuration
   */
  setBufferConfig(config: Partial<BufferTimeConfig>) {
    this.bufferConfig = { ...this.bufferConfig, ...config }
  }

  /**
   * Get buffer time configuration
   */
  getBufferConfig(): BufferTimeConfig {
    return { ...this.bufferConfig }
  }

  /**
   * Check if a staff member is available for a specific time slot across ALL locations
   * This implements bidirectional blocking - home service appointments block physical location availability
   * and physical location appointments block home service availability
   */
  async checkStaffAvailability(check: StaffAvailabilityCheck): Promise<AvailabilityResult> {
    try {
      // Get all appointments across all locations for this staff member
      const allAppointments = await getAllAppointments()

      // Filter appointments for this staff member (excluding cancelled/completed/no-show)
      const staffAppointments = allAppointments.filter(appointment => {
        // Skip if different staff member
        if (appointment.staffId !== check.staffId) return false
        
        // Skip if this is the appointment being updated
        if (check.excludeAppointmentId && appointment.id === check.excludeAppointmentId) return false
        
        // Skip cancelled, completed, and no-show appointments
        if (['cancelled', 'completed', 'no-show'].includes(appointment.status?.toLowerCase())) return false
        
        return true
      })

      // Check for conflicts with existing appointments
      const context: AppointmentContext = {
        serviceId: check.serviceId,
        locationId: check.locationId,
        appointmentTime: check.timeSlot.start
      }

      const conflictingAppointments = this.findConflictingAppointments(
        staffAppointments,
        check.timeSlot,
        context
      )

      // Check for blocked time slots
      const blockedTimeSlots = this.findBlockedTimeSlots(
        staffAppointments,
        check.timeSlot
      )

      // Separate cross-location conflicts for better reporting
      const crossLocationConflicts = conflictingAppointments
        .filter(appointment => appointment.location !== check.locationId)
        .map(appointment => ({
          appointmentId: appointment.id,
          location: appointment.location,
          clientName: appointment.clientName,
          service: appointment.service,
          startTime: parseISO(appointment.date),
          endTime: addMinutes(parseISO(appointment.date), appointment.duration)
        }))

      const hasConflicts = conflictingAppointments.length > 0 || blockedTimeSlots.length > 0

      return {
        isAvailable: !hasConflicts,
        conflictingAppointments,
        blockedTimeSlots,
        crossLocationConflicts,
        reason: hasConflicts ? this.generateConflictReason(conflictingAppointments, blockedTimeSlots, crossLocationConflicts) : undefined
      }
    } catch (error) {
      console.error('Error checking staff availability:', error)
      return {
        isAvailable: false,
        conflictingAppointments: [],
        blockedTimeSlots: [],
        reason: 'Error checking availability'
      }
    }
  }

  /**
   * Find appointments that conflict with the requested time slot
   */
  private findConflictingAppointments(
    appointments: any[],
    requestedSlot: TimeSlot,
    context?: AppointmentContext
  ): any[] {
    return appointments.filter(appointment => {
      // Skip blocked time entries (handled separately)
      if (appointment.type === 'blocked') return false

      const appointmentStart = parseISO(appointment.date)
      const appointmentEnd = addMinutes(appointmentStart, appointment.duration)

      // Calculate dynamic buffer times based on context
      let bufferTimes = this.bufferConfig

      if (context && bufferTimeConfigService.isEnabled()) {
        const dynamicBuffer = calculateBufferTimes({
          serviceId: context.serviceId,
          locationId: context.locationId,
          appointmentTime: context.appointmentTime
        })

        // Use the larger of static or dynamic buffer times
        bufferTimes = {
          beforeAppointment: Math.max(this.bufferConfig.beforeAppointment, dynamicBuffer.beforeMinutes),
          afterAppointment: Math.max(this.bufferConfig.afterAppointment, dynamicBuffer.afterMinutes)
        }
      }

      // Apply buffer times
      const bufferedStart = addMinutes(appointmentStart, -bufferTimes.beforeAppointment)
      const bufferedEnd = addMinutes(appointmentEnd, bufferTimes.afterAppointment)

      // Check for overlap with buffer times included
      return this.hasTimeOverlap(
        { start: bufferedStart, end: bufferedEnd },
        requestedSlot
      )
    })
  }

  /**
   * Find blocked time slots that conflict with the requested time slot
   */
  private findBlockedTimeSlots(appointments: any[], requestedSlot: TimeSlot): any[] {
    return appointments.filter(appointment => {
      // Only check blocked time entries
      if (appointment.type !== 'blocked') return false

      const blockedStart = parseISO(appointment.date)
      const blockedEnd = addMinutes(blockedStart, appointment.duration)

      // Check for overlap
      return this.hasTimeOverlap(
        { start: blockedStart, end: blockedEnd },
        requestedSlot
      )
    })
  }

  /**
   * Check if two time slots overlap
   */
  private hasTimeOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    return (
      // slot2 starts during slot1
      (isAfter(slot2.start, slot1.start) && isBefore(slot2.start, slot1.end)) ||
      // slot2 ends during slot1
      (isAfter(slot2.end, slot1.start) && isBefore(slot2.end, slot1.end)) ||
      // slot2 completely contains slot1
      (isBefore(slot2.start, slot1.start) && isAfter(slot2.end, slot1.end)) ||
      // slot1 and slot2 start at the same time
      (slot1.start.getTime() === slot2.start.getTime())
    )
  }

  /**
   * Generate a human-readable reason for conflicts
   */
  private generateConflictReason(
    conflictingAppointments: any[],
    blockedTimeSlots: any[],
    crossLocationConflicts?: Array<{
      appointmentId: string
      location: string
      clientName: string
      service: string
      startTime: Date
      endTime: Date
    }>
  ): string {
    const reasons = []

    if (conflictingAppointments.length > 0) {
      const locations = [...new Set(conflictingAppointments.map(apt => apt.location))]

      // Check for cross-location conflicts specifically
      const homeServiceConflicts = conflictingAppointments.filter(apt => apt.location === 'home')
      const physicalLocationConflicts = conflictingAppointments.filter(apt => apt.location !== 'home')

      if (homeServiceConflicts.length > 0 && physicalLocationConflicts.length > 0) {
        reasons.push('has conflicting appointments across home service and physical locations')
      } else if (homeServiceConflicts.length > 0) {
        reasons.push('has a home service appointment')
      } else if (physicalLocationConflicts.length > 0) {
        if (locations.length === 1) {
          const locationName = locations[0] === 'home' ? 'Home Service' : locations[0]
          reasons.push(`has an appointment at ${locationName}`)
        } else {
          reasons.push('has appointments at multiple locations')
        }
      }
    }

    if (blockedTimeSlots.length > 0) {
      reasons.push('has blocked time')
    }

    return `Staff member ${reasons.join(' and ')}`
  }

  /**
   * Get all conflicting appointments for a staff member on a specific date
   */
  async getStaffConflictsForDate(staffId: string, date: Date): Promise<any[]> {
    const allAppointments = await getAllAppointments()

    return allAppointments.filter(appointment => {
      if (appointment.staffId !== staffId) return false
      if (['cancelled', 'completed', 'no-show'].includes(appointment.status?.toLowerCase())) return false
      
      const appointmentDate = parseISO(appointment.date)
      return isSameDay(appointmentDate, date)
    })
  }

  /**
   * Check for bidirectional conflicts between home service and physical locations
   * This ensures that booking at one location type blocks the other
   */
  async checkBidirectionalConflicts(
    staffId: string,
    timeSlot: TimeSlot,
    requestedLocation: string,
    excludeAppointmentId?: string
  ): Promise<{
    hasConflicts: boolean
    conflicts: Array<{
      appointmentId: string
      location: string
      locationType: 'home' | 'physical'
      clientName: string
      service: string
      startTime: Date
      endTime: Date
    }>
  }> {
    const allAppointments = await getAllAppointments()

    // Filter appointments for this staff member
    const staffAppointments = allAppointments.filter(appointment => {
      if (appointment.staffId !== staffId) return false
      if (excludeAppointmentId && appointment.id === excludeAppointmentId) return false
      if (['cancelled', 'completed', 'no-show'].includes(appointment.status?.toLowerCase())) return false
      return true
    })

    const conflicts = []

    for (const appointment of staffAppointments) {
      const appointmentStart = parseISO(appointment.date)
      const appointmentEnd = addMinutes(appointmentStart, appointment.duration)
      const appointmentSlot = { start: appointmentStart, end: appointmentEnd }

      // Check for time overlap
      if (this.hasTimeOverlap(timeSlot, appointmentSlot)) {
        // Determine if this is a cross-location conflict
        const appointmentLocationType = appointment.location === 'home' ? 'home' : 'physical'
        const requestedLocationType = requestedLocation === 'home' ? 'home' : 'physical'

        // Add to conflicts if it's a different location (bidirectional blocking)
        if (appointment.location !== requestedLocation) {
          conflicts.push({
            appointmentId: appointment.id,
            location: appointment.location,
            locationType: appointmentLocationType,
            clientName: appointment.clientName,
            service: appointment.service,
            startTime: appointmentStart,
            endTime: appointmentEnd
          })
        }
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    }
  }

  /**
   * Check multiple staff members' availability for a time slot
   */
  async checkMultipleStaffAvailability(
    staffIds: string[],
    timeSlot: TimeSlot,
    excludeAppointmentId?: string
  ): Promise<Record<string, AvailabilityResult>> {
    const results: Record<string, AvailabilityResult> = {}

    for (const staffId of staffIds) {
      results[staffId] = await this.checkStaffAvailability({
        staffId,
        timeSlot,
        excludeAppointmentId
      })
    }

    return results
  }

  /**
   * Get available staff members for a specific time slot
   */
  async getAvailableStaff(
    staffIds: string[],
    timeSlot: TimeSlot,
    excludeAppointmentId?: string
  ): Promise<string[]> {
    const availabilityResults = await this.checkMultipleStaffAvailability(
      staffIds,
      timeSlot,
      excludeAppointmentId
    )

    return Object.entries(availabilityResults)
      .filter(([_, result]) => result.isAvailable)
      .map(([staffId, _]) => staffId)
  }
}

// Export singleton instance
export const staffAvailabilityService = StaffAvailabilityService.getInstance()

/**
 * Convenience function to check staff availability
 */
export async function checkStaffAvailability(
  staffId: string,
  startTime: Date,
  duration: number,
  excludeAppointmentId?: string,
  serviceId?: string,
  locationId?: string
): Promise<AvailabilityResult> {
  const timeSlot: TimeSlot = {
    start: startTime,
    end: addMinutes(startTime, duration)
  }

  return staffAvailabilityService.checkStaffAvailability({
    staffId,
    timeSlot,
    excludeAppointmentId,
    serviceId,
    locationId
  })
}

/**
 * Convenience function to check if staff is available (boolean result)
 */
export async function isStaffAvailable(
  staffId: string,
  startTime: Date,
  duration: number,
  excludeAppointmentId?: string,
  serviceId?: string,
  locationId?: string
): Promise<boolean> {
  const result = await checkStaffAvailability(staffId, startTime, duration, excludeAppointmentId, serviceId, locationId)
  return result.isAvailable
}
