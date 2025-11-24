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

/**
 * Get all appointments from localStorage
 * This is now the single source of truth for appointment data
 */
export function getAllAppointments(): AppointmentData[] {
  // Try to get appointments from localStorage
  let appointments: AppointmentData[] = [];
  try {
    const storedData = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (storedData) {
      const parsed = JSON.parse(storedData);
      // Ensure parsed data is an array
      appointments = Array.isArray(parsed) ? parsed : [];
      if (DEBUG) console.log('AppointmentService: Loaded from localStorage', appointments.length);
    } else {
      // Initialize with empty array if no data exists
      if (DEBUG) console.log('AppointmentService: No appointments found, starting with empty array');
      appointments = [];
    }
  } catch (error) {
    console.error('AppointmentService: Error loading from localStorage', error);
    appointments = [];
  }

  // Ensure all appointments have booking references
  let hasChanges = false;
  appointments = appointments.map(appointment => {
    if (!appointment.bookingReference) {
      hasChanges = true;
      return {
        ...appointment,
        bookingReference: `VH-${Date.now().toString().slice(-6)}`
      };
    }
    return appointment;
  });

  // Save back if we added any booking references
  if (hasChanges) {
    saveAppointments(appointments);
  }

  if (DEBUG) console.log('AppointmentService: Retrieved appointments', appointments.length);
  return appointments;
}

/**
 * Save appointments to localStorage
 */
export function saveAppointments(appointments: AppointmentData[]): void {
  if (DEBUG) console.log('AppointmentService: Saving appointments', appointments.length);

  // Save to localStorage
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
      if (DEBUG) console.log('AppointmentService: Saved to localStorage');
    }
  } catch (error) {
    console.error('AppointmentService: Error saving to localStorage', error);
  }
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
 * Add a new appointment (legacy function - consider using addAppointmentWithValidation)
 */
export function addAppointment(appointment: AppointmentData): AppointmentData {
  if (DEBUG) console.log('AppointmentService: Adding appointment', appointment);

  // Generate booking reference if not provided
  if (!appointment.bookingReference) {
    appointment.bookingReference = `VH-${Date.now().toString().slice(-6)}`;
  }

  // Get all existing appointments
  const allAppointments = getAllAppointments();

  // Check if appointment with this ID already exists
  const existingIndex = allAppointments.findIndex(a => a.id === appointment.id);

  if (existingIndex >= 0) {
    // Update existing appointment
    allAppointments[existingIndex] = appointment;
    if (DEBUG) console.log('AppointmentService: Updated existing appointment');
  } else {
    // Add new appointment
    allAppointments.push(appointment);
    if (DEBUG) console.log('AppointmentService: Added new appointment');
  }

  // Save appointments to all storage locations
  saveAppointments(allAppointments);

  // Emit real-time event for appointment creation
  if (existingIndex < 0) {
    realTimeService.emitEvent(RealTimeEventType.APPOINTMENT_CREATED, {
      appointment,
      clientName: appointment.clientName,
      staffName: appointment.staffName,
      service: appointment.service,
      date: appointment.date
    }, {
      source: 'AppointmentService',
      userId: appointment.staffId,
      locationId: appointment.location
    });

    // Emit appointment sync event for cross-location availability updates
    appointmentSyncService.emitAppointmentCreated(
      appointment.id,
      appointment.staffId,
      appointment.location,
      {
        appointment,
        duration: appointment.duration,
        date: appointment.date
      }
    );
  }

  return appointment;
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
    const currentAppointment = getAppointmentById(appointmentId);
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
 * Update an existing appointment (legacy function - consider using updateAppointmentWithValidation)
 */
export async function updateAppointment(appointmentId: string, updates: Partial<AppointmentData>): Promise<AppointmentData | null> {
  if (DEBUG) console.log('AppointmentService: Updating appointment', appointmentId, updates);

  // Get all existing appointments
  const allAppointments = getAllAppointments();

  // Find the appointment to update
  const appointmentIndex = allAppointments.findIndex(a => a.id === appointmentId);

  if (appointmentIndex >= 0) {
    // Update the appointment
    const updatedAppointment = {
      ...allAppointments[appointmentIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    allAppointments[appointmentIndex] = updatedAppointment;

    // Save appointments to all storage locations
    saveAppointments(allAppointments);

    // Emit real-time event for appointment update
    const eventType = updates.status ? RealTimeEventType.APPOINTMENT_STATUS_CHANGED : RealTimeEventType.APPOINTMENT_UPDATED;
    realTimeService.emitEvent(eventType, {
      appointment: updatedAppointment,
      updates,
      previousStatus: allAppointments[appointmentIndex].status,
      newStatus: updatedAppointment.status
    }, {
      source: 'AppointmentService',
      userId: updatedAppointment.staffId,
      locationId: updatedAppointment.location
    });

    // Emit appointment sync event for cross-location availability updates
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

    // Update reflected appointments if this is not a reflected appointment
    if (!updatedAppointment.isReflected) {
      try {
        await appointmentReflectionService.updateReflectedAppointments(updatedAppointment);
      } catch (error) {
        console.error('Error updating reflected appointments:', error);
        // Don't fail the main appointment update if reflection update fails
      }
    }

    if (DEBUG) console.log('AppointmentService: Appointment updated successfully');
    return updatedAppointment;
  }

  if (DEBUG) console.log('AppointmentService: Appointment not found for update');
  return null;
}

/**
 * Delete an appointment
 */
export async function deleteAppointment(appointmentId: string): Promise<boolean> {
  if (DEBUG) console.log('AppointmentService: Deleting appointment', appointmentId);

  // Get all existing appointments
  const allAppointments = getAllAppointments();

  // Find the appointment to delete (for real-time event)
  const appointmentToDelete = allAppointments.find(a => a.id === appointmentId);

  // Filter out the appointment to delete
  const filteredAppointments = allAppointments.filter(a => a.id !== appointmentId);

  if (filteredAppointments.length < allAppointments.length) {
    // Save appointments to all storage locations
    saveAppointments(filteredAppointments);

    // Emit real-time event for appointment deletion
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

      // Delete reflected appointments if this is not a reflected appointment
      if (!appointmentToDelete.isReflected) {
        try {
          await appointmentReflectionService.deleteReflectedAppointments(appointmentId);
        } catch (error) {
          console.error('Error deleting reflected appointments:', error);
          // Don't fail the main appointment deletion if reflection deletion fails
        }
      }
    }

    if (DEBUG) console.log('AppointmentService: Appointment deleted successfully');
    return true;
  }

  if (DEBUG) console.log('AppointmentService: Appointment not found for deletion');
  return false;
}

/**
 * Get appointment by ID
 */
export function getAppointmentById(appointmentId: string): AppointmentData | null {
  // Get all existing appointments
  const allAppointments = getAllAppointments();

  // Find the appointment
  const appointment = allAppointments.find(a => a.id === appointmentId);

  return appointment || null;
}

/**
 * Initialize the appointment service
 * This ensures that all storage locations are in sync
 */
export function initializeAppointmentService(): void {
  if (DEBUG) console.log('AppointmentService: Initializing');

  // Get all appointments and save them back to ensure consistency
  const allAppointments = getAllAppointments();
  saveAppointments(allAppointments);

  if (DEBUG) console.log('AppointmentService: Initialized with', allAppointments.length, 'appointments');
}

/**
 * Clear all appointments (for testing purposes)
 */
export function clearAllAppointments(): void {
  if (DEBUG) console.log('AppointmentService: Clearing all appointments');

  // Clear localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }

  if (DEBUG) console.log('AppointmentService: All appointments cleared');
}
