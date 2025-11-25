"use client"

import { parseISO, addMinutes, format } from "date-fns"
import { staffAvailabilityService } from "./staff-availability"
import { getAllAppointments } from "../appointment-service"

export interface BookingValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  conflicts: Array<{
    type: 'cross-location' | 'same-location' | 'blocked-time'
    appointmentId?: string
    location: string
    locationType: 'home' | 'physical'
    clientName?: string
    service?: string
    startTime: Date
    endTime: Date
    message: string
  }>
}

export interface BookingRequest {
  staffId: string
  date: string // ISO date string
  duration: number // in minutes
  location: string
  clientName?: string
  service?: string
  excludeAppointmentId?: string // For updates
}

/**
 * Comprehensive booking validation service with detailed error messages
 * for cross-location conflicts and bidirectional blocking
 */
export class BookingValidationService {
  /**
   * Validate a booking request and provide detailed feedback
   */
  async validateBooking(request: BookingRequest): Promise<BookingValidationResult> {
    const result: BookingValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      conflicts: []
    }

    try {
      const startTime = parseISO(request.date)
      const endTime = addMinutes(startTime, request.duration)
      const timeSlot = { start: startTime, end: endTime }

      // Check general availability
      const availabilityResult = await staffAvailabilityService.checkStaffAvailability({
        staffId: request.staffId,
        timeSlot,
        excludeAppointmentId: request.excludeAppointmentId,
        locationId: request.location
      })

      if (!availabilityResult.isAvailable) {
        result.isValid = false

        // Check for bidirectional conflicts
        const bidirectionalCheck = await staffAvailabilityService.checkBidirectionalConflicts(
          request.staffId,
          timeSlot,
          request.location,
          request.excludeAppointmentId
        )

        // Process conflicts and generate detailed messages
        for (const conflict of bidirectionalCheck.conflicts) {
          const conflictMessage = this.generateConflictMessage(conflict, request)
          
          result.conflicts.push({
            type: 'cross-location',
            appointmentId: conflict.appointmentId,
            location: conflict.location,
            locationType: conflict.locationType,
            clientName: conflict.clientName,
            service: conflict.service,
            startTime: conflict.startTime,
            endTime: conflict.endTime,
            message: conflictMessage
          })

          result.errors.push(conflictMessage)
        }

        // Check for same-location conflicts
        const sameLocationConflicts = availabilityResult.conflictingAppointments
          .filter(apt => apt.location === request.location)

        for (const conflict of sameLocationConflicts) {
          const conflictStart = parseISO(conflict.date)
          const conflictEnd = addMinutes(conflictStart, conflict.duration)
          
          const message = `Staff member already has an appointment with ${conflict.clientName} (${conflict.service}) from ${format(conflictStart, 'h:mm a')} to ${format(conflictEnd, 'h:mm a')} at this location.`
          
          result.conflicts.push({
            type: 'same-location',
            appointmentId: conflict.id,
            location: conflict.location,
            locationType: conflict.location === 'home' ? 'home' : 'physical',
            clientName: conflict.clientName,
            service: conflict.service,
            startTime: conflictStart,
            endTime: conflictEnd,
            message
          })

          result.errors.push(message)
        }

        // Check for blocked time conflicts
        for (const blockedTime of availabilityResult.blockedTimeSlots) {
          const blockedStart = parseISO(blockedTime.date)
          const blockedEnd = addMinutes(blockedStart, blockedTime.duration)
          
          const message = `Staff member has blocked time (${blockedTime.title || 'Unavailable'}) from ${format(blockedStart, 'h:mm a')} to ${format(blockedEnd, 'h:mm a')}.`
          
          result.conflicts.push({
            type: 'blocked-time',
            location: request.location,
            locationType: request.location === 'home' ? 'home' : 'physical',
            startTime: blockedStart,
            endTime: blockedEnd,
            message
          })

          result.errors.push(message)
        }

        // If no specific conflicts found, use general reason
        if (result.errors.length === 0 && availabilityResult.reason) {
          result.errors.push(availabilityResult.reason)
        }
      }

      // Add warnings for potential issues
      await this.addWarnings(request, result)

    } catch (error) {
      console.error('Error validating booking:', error)
      result.isValid = false
      result.errors.push('Unable to validate booking. Please try again.')
    }

    return result
  }

  /**
   * Generate a detailed conflict message for cross-location conflicts
   */
  private generateConflictMessage(
    conflict: {
      location: string
      locationType: 'home' | 'physical'
      clientName: string
      service: string
      startTime: Date
      endTime: Date
    },
    request: BookingRequest
  ): string {
    const conflictTimeRange = `${format(conflict.startTime, 'h:mm a')} to ${format(conflict.endTime, 'h:mm a')}`
    const requestedLocationType = request.location === 'home' ? 'home service' : `${request.location}`
    
    if (conflict.locationType === 'home' && request.location !== 'home') {
      return `Staff member has a home service appointment with ${conflict.clientName} (${conflict.service}) from ${conflictTimeRange}. Cannot book at ${requestedLocationType} during this time due to bidirectional blocking.`
    } else if (conflict.locationType === 'physical' && request.location === 'home') {
      const locationName = conflict.location === 'home' ? 'Home Service' : conflict.location
      return `Staff member has an appointment at ${locationName} with ${conflict.clientName} (${conflict.service}) from ${conflictTimeRange}. Cannot book home service during this time due to bidirectional blocking.`
    } else {
      const conflictLocationName = conflict.location === 'home' ? 'Home Service' : conflict.location
      return `Staff member has an appointment at ${conflictLocationName} with ${conflict.clientName} (${conflict.service}) from ${conflictTimeRange}. Cannot book at ${requestedLocationType} during this time.`
    }
  }

  /**
   * Add warnings for potential scheduling issues
   */
  private async addWarnings(request: BookingRequest, result: BookingValidationResult): Promise<void> {
    try {
      const startTime = parseISO(request.date)
      const hour = startTime.getHours()

      // Warning for early morning appointments
      if (hour < 9) {
        result.warnings.push('This appointment is scheduled before normal business hours (9 AM).')
      }

      // Warning for late evening appointments
      if (hour >= 20) {
        result.warnings.push('This appointment is scheduled during late evening hours.')
      }

      // Warning for home service appointments
      if (request.location === 'home') {
        result.warnings.push('Home service appointments require additional travel time. Ensure adequate buffer time between appointments.')
      }

      // Check for back-to-back appointments across different locations
      const allAppointments = await getAllAppointments()
      const staffAppointments = allAppointments.filter(apt =>
        apt.staffId === request.staffId && 
        !['cancelled', 'completed', 'no-show'].includes(apt.status?.toLowerCase()) &&
        apt.id !== request.excludeAppointmentId
      )

      const requestEndTime = addMinutes(startTime, request.duration)
      
      for (const appointment of staffAppointments) {
        const aptStart = parseISO(appointment.date)
        const aptEnd = addMinutes(aptStart, appointment.duration)

        // Check for appointments immediately before or after
        const timeDiffBefore = Math.abs(startTime.getTime() - aptEnd.getTime()) / (1000 * 60) // minutes
        const timeDiffAfter = Math.abs(aptStart.getTime() - requestEndTime.getTime()) / (1000 * 60) // minutes

        if (timeDiffBefore <= 30 && appointment.location !== request.location) {
          const aptLocationName = appointment.location === 'home' ? 'Home Service' : appointment.location
          const reqLocationName = request.location === 'home' ? 'Home Service' : request.location
          result.warnings.push(`Staff member has an appointment at ${aptLocationName} ending 30 minutes before this ${reqLocationName} appointment. Consider travel time.`)
        }

        if (timeDiffAfter <= 30 && appointment.location !== request.location) {
          const aptLocationName = appointment.location === 'home' ? 'Home Service' : appointment.location
          const reqLocationName = request.location === 'home' ? 'Home Service' : request.location
          result.warnings.push(`Staff member has an appointment at ${aptLocationName} starting 30 minutes after this ${reqLocationName} appointment. Consider travel time.`)
        }
      }

    } catch (error) {
      console.error('Error adding warnings:', error)
    }
  }

  /**
   * Get a user-friendly summary of validation results
   */
  getValidationSummary(result: BookingValidationResult): string {
    if (result.isValid) {
      if (result.warnings.length > 0) {
        return `Booking is valid with ${result.warnings.length} warning(s).`
      }
      return 'Booking is valid.'
    }

    const errorCount = result.errors.length
    const conflictCount = result.conflicts.length
    
    if (conflictCount > 0) {
      const crossLocationConflicts = result.conflicts.filter(c => c.type === 'cross-location').length
      if (crossLocationConflicts > 0) {
        return `Cannot book: Staff member has ${crossLocationConflicts} cross-location conflict(s).`
      }
    }

    return `Cannot book: ${errorCount} conflict(s) found.`
  }
}

// Export singleton instance
export const bookingValidationService = new BookingValidationService()

/**
 * Convenience function for quick booking validation
 */
export async function validateBookingRequest(request: BookingRequest): Promise<BookingValidationResult> {
  return bookingValidationService.validateBooking(request)
}
