// Centralized appointment management service
// This service handles all appointment operations and ensures data consistency
// between the client portal and the appointment calendar

import { AppointmentStatus } from '@/lib/types/appointment';
import { realTimeService, RealTimeEventType } from './real-time-service';
import { staffAvailabilityService, checkStaffAvailability } from '@/lib/services/staff-availability';
import { bookingValidationService } from '@/lib/services/booking-validation';
import { appointmentSyncService } from '@/lib/services/appointment-sync';
import { appointmentReflectionService } from '@/lib/services/appointment-reflection';
import { parseISO, addMinutes } from 'date-fns';

// Extend window interface for cleanup tracking
declare global {
  interface Window {
    hasRunReflectionCleanup?: boolean;
  }
}

// Define the appointment interface
export interface AppointmentData {
  id: string;
  clientId: string;
  clientName: string;
  staffId: string;
  staffName: string;
  service: string;
  serviceId?: string;
  date: string; // ISO date string
  duration: number; // in minutes
  location: string;
  price?: number;
  notes?: string;
  status: AppointmentStatus | string;
  statusHistory?: Array<{
    status: string;
    timestamp: string;
    updatedBy?: string;
  }>;
  type?: string;
  additionalServices?: Array<any>;
  products?: Array<any>;
  createdAt?: string;
  updatedAt?: string;
  // Payment information
  paymentStatus?: "paid" | "unpaid" | "partial";
  paymentMethod?: string;
  paymentDate?: string;
  [key: string]: any; // Allow additional properties
}

// Storage key for localStorage
const STORAGE_KEY = 'vanity_appointments';

// Debug flag - set to true to enable console logging
const DEBUG = true;

// Cache for appointments (client-side only)
let appointmentsCache: AppointmentData[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Get all appointments from database via API
 * This is now the single source of truth for appointment data
 */
export async function getAllAppointments(): Promise<AppointmentData[]> {
  // Server-side: return empty array
  if (typeof window === 'undefined') {
    return [];
  }

  // Use cache if fresh
  const now = Date.now();
  if (appointmentsCache && (now - lastFetchTime) < CACHE_DURATION) {
    if (DEBUG) console.log('AppointmentService: Using cached appointments', appointmentsCache.length);
    return appointmentsCache;
  }

  try {
    const response = await fetch('/api/appointments');
    if (!response.ok) {
      throw new Error('Failed to fetch appointments');
    }
    const data = await response.json();
    appointmentsCache = data.appointments || [];
    lastFetchTime = now;
    
    if (DEBUG) console.log('AppointmentService: Fetched from API', appointmentsCache.length);
    return appointmentsCache;
  } catch (error) {
    console.error('AppointmentService: Error fetching appointments', error);
    // Return cache if available, otherwise empty array
    return appointmentsCache || [];
  }
}

/**
 * Invalidate the appointments cache to force a refresh
 */
export function invalidateAppointmentsCache(): void {
  appointmentsCache = null;
  lastFetchTime = 0;
  if (DEBUG) console.log('AppointmentService: Cache invalidated');
}

/**
 * Deprecated: No longer saves to localStorage
 * Appointments are now stored in database via API
 */
export function saveAppointments(appointments: AppointmentData[]): void {
  // No-op - kept for backward compatibility
  if (DEBUG) console.log('AppointmentService: saveAppointments is deprecated');
}

/**
 * Validate staff availability before creating/updating an appointment
 * Includes bidirectional blocking between home service and physical locations
 * Uses comprehensive booking validation with detailed error messages
 */
export async function validateStaffAvailability(
  appointment: AppointmentData,
  excludeAppointmentId?: string
): Promise<{ isValid: boolean; error?: string; conflicts?: any[]; warnings?: string[] }> {
  try {
    // Use the comprehensive booking validation service
    const validationResult = await bookingValidationService.validateBooking({
      staffId: appointment.staffId,
      date: appointment.date,
      duration: appointment.duration,
      location: appointment.location,
      clientName: appointment.clientName,
      service: appointment.service,
      excludeAppointmentId
    });

    if (!validationResult.isValid) {
      // Return the first error message (most relevant)
      const primaryError = validationResult.errors[0] || 'Staff member is not available for this time slot';

      return {
        isValid: false,
        error: primaryError,
        conflicts: validationResult.conflicts,
        warnings: validationResult.warnings
      };
    }

    return {
      isValid: true,
      warnings: validationResult.warnings
    };
  } catch (error) {
    console.error('Error validating staff availability:', error);
    return {
      isValid: false,
      error: 'Unable to validate staff availability'
    };
  }
}

/**
 * Add a new appointment with availability validation
 */
export async function addAppointmentWithValidation(appointment: AppointmentData): Promise<{ success: boolean; appointment?: AppointmentData; error?: string }> {
  // Validate staff availability across all locations
  const validation = await validateStaffAvailability(appointment);

  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error
    };
  }

  // If validation passes, create the appointment
  const createdAppointment = addAppointment(appointment);

  // Create reflected appointments for staff with home service capability
  try {
    await appointmentReflectionService.createReflectedAppointments(createdAppointment);
  } catch (error) {
    console.error('Error creating reflected appointments:', error);
    // Don't fail the main appointment creation if reflection fails
  }

  return {
    success: true,
    appointment: createdAppointment
  };
}

/**
 * Add a new appointment via API
 */
export async function addAppointment(appointment: AppointmentData): Promise<AppointmentData> {
  if (DEBUG) console.log('AppointmentService: Adding appointment', appointment);

  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment)
    });

    if (!response.ok) {
      throw new Error('Failed to create appointment');
    }

    const data = await response.json();
    
    // Invalidate cache to force refresh
    invalidateAppointmentsCache();
    
    // Emit real-time event for appointment creation
    realTimeService.emitEvent(RealTimeEventType.APPOINTMENT_CREATED, {
      appointment: data.appointment,
      clientName: data.appointment.clientName,
      staffName: data.appointment.staffName,
      service: data.appointment.service,
      date: data.appointment.date
    }, {
      source: 'AppointmentService',
      userId: data.appointment.staffId,
      locationId: data.appointment.location
    });

    // Emit appointment sync event
    appointmentSyncService.emitAppointmentCreated(
      data.appointment.id,
      data.appointment.staffId,
      data.appointment.location,
      {
        appointment: data.appointment,
        duration: data.appointment.duration,
        date: data.appointment.date
      }
    );

    if (DEBUG) console.log('AppointmentService: Created appointment via API');
    return data.appointment;
  } catch (error) {
    console.error('AppointmentService: Error creating appointment', error);
    throw error;
  }
}

/**
 * Update an existing appointment with availability validation
 */
export async function updateAppointmentWithValidation(
  appointmentId: string,
  updates: Partial<AppointmentData>
): Promise<{ success: boolean; appointment?: AppointmentData; error?: string }> {
  // If the update includes staff, date, or duration changes, validate availability
  if (updates.staffId || updates.date || updates.duration) {
    const currentAppointment = await getAppointmentById(appointmentId);
    if (!currentAppointment) {
      return {
        success: false,
        error: 'Appointment not found'
      };
    }

    // Create the updated appointment data for validation
    const updatedAppointmentData = {
      ...currentAppointment,
      ...updates
    };

    // Validate staff availability (excluding the current appointment)
    const validation = await validateStaffAvailability(updatedAppointmentData, appointmentId);

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }
  }

  // If validation passes, update the appointment
  const updatedAppointment = await updateAppointment(appointmentId, updates);

  if (!updatedAppointment) {
    return {
      success: false,
      error: 'Failed to update appointment'
    };
  }

  return {
    success: true,
    appointment: updatedAppointment
  };
}

/**
 * Update an existing appointment via API
 */
export async function updateAppointment(appointmentId: string, updates: Partial<AppointmentData>): Promise<AppointmentData | null> {
  if (DEBUG) console.log('AppointmentService: Updating appointment', appointmentId, updates);

  try {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update appointment');
    }

    const data = await response.json();
    const updatedAppointment = data.appointment;
    
    // Invalidate cache
    invalidateAppointmentsCache();

    // Emit real-time event
    const eventType = updates.status ? RealTimeEventType.APPOINTMENT_STATUS_CHANGED : RealTimeEventType.APPOINTMENT_UPDATED;
    realTimeService.emitEvent(eventType, {
      appointment: updatedAppointment,
      updates,
      newStatus: updatedAppointment.status
    }, {
      source: 'AppointmentService',
      userId: updatedAppointment.staffId,
      locationId: updatedAppointment.location
    });

    // Emit appointment sync event
    appointmentSyncService.emitAppointmentUpdated(
      updatedAppointment.id,
      updatedAppointment.staffId,
      updatedAppointment.location,
      {
        appointment: updatedAppointment,
        updates,
        duration: updatedAppointment.duration,
        date: updatedAppointment.date
      }
    );

    // Update reflected appointments
    if (!updatedAppointment.isReflected) {
      try {
        await appointmentReflectionService.updateReflectedAppointments(updatedAppointment);
      } catch (error) {
        console.error('Error updating reflected appointments:', error);
      }
    }

    if (DEBUG) console.log('AppointmentService: Appointment updated via API');
    return updatedAppointment;
  } catch (error) {
    console.error('AppointmentService: Error updating appointment', error);
    return null;
  }
}

/**
 * Delete an appointment via API
 */
export async function deleteAppointment(appointmentId: string): Promise<boolean> {
  if (DEBUG) console.log('AppointmentService: Deleting appointment', appointmentId);

  try {
    // Get appointment details first for events
    const allAppointments = await getAllAppointments();
    const appointmentToDelete = allAppointments.find(a => a.id === appointmentId);

    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete appointment');
    }

    // Invalidate cache
    invalidateAppointmentsCache();

    // Emit real-time event
    if (appointmentToDelete) {
      realTimeService.emitEvent(RealTimeEventType.APPOINTMENT_DELETED, {
        appointmentId,
        appointment: appointmentToDelete,
        clientName: appointmentToDelete.clientName,
        staffName: appointmentToDelete.staffName
      }, {
        source: 'AppointmentService',
        userId: appointmentToDelete.staffId,
        locationId: appointmentToDelete.location
      });

      // Delete reflected appointments
      if (!appointmentToDelete.isReflected) {
        try {
          await appointmentReflectionService.deleteReflectedAppointments(appointmentId);
        } catch (error) {
          console.error('Error deleting reflected appointments:', error);
        }
      }
    }

    if (DEBUG) console.log('AppointmentService: Appointment deleted via API');
    return true;
  } catch (error) {
    console.error('AppointmentService: Error deleting appointment', error);
    return false;
  }
}

/**
 * Get appointment by ID
 */
export async function getAppointmentById(appointmentId: string): Promise<AppointmentData | null> {
  // Get all existing appointments
  const allAppointments = await getAllAppointments();

  // Find the appointment
  const appointment = allAppointments.find(a => a.id === appointmentId);

  return appointment || null;
}

/**
 * Initialize the appointment service
 * No-op now that we use database storage
 */
export function initializeAppointmentService(): void {
  if (DEBUG) console.log('AppointmentService: Initialize called (no-op)');
}

/**
 * Clear appointments cache (for testing purposes)
 */
export function clearAllAppointments(): void {
  if (DEBUG) console.log('AppointmentService: Clearing appointments cache');
  invalidateAppointmentsCache();
  if (DEBUG) console.log('AppointmentService: Cache cleared');
}
