/**
 * Debugging utilities for appointment reflection system
 */

import { getAllAppointments } from '../appointment-service';

export interface AppointmentDebugInfo {
  id: string;
  clientName: string;
  service: string;
  location: string;
  staffName: string;
  isReflected?: boolean;
  originalAppointmentId?: string;
  reflectionType?: string;
}

/**
 * Get debug information about all appointments
 */
export async function getAppointmentDebugInfo(): Promise<{
  original: AppointmentDebugInfo[];
  reflected: AppointmentDebugInfo[];
  orphaned: AppointmentDebugInfo[];
}> {
  const allAppointments = await getAllAppointments();

  const original: AppointmentDebugInfo[] = [];
  const reflected: AppointmentDebugInfo[] = [];
  const orphaned: AppointmentDebugInfo[] = [];

  // Get all original appointment IDs
  const originalIds = new Set(
    allAppointments
      .filter(apt => !apt.isReflected)
      .map(apt => apt.id)
  );

  allAppointments.forEach(apt => {
    const debugInfo: AppointmentDebugInfo = {
      id: apt.id,
      clientName: apt.clientName,
      service: apt.service,
      location: apt.location,
      staffName: apt.staffName,
      isReflected: apt.isReflected,
      originalAppointmentId: apt.originalAppointmentId,
      reflectionType: apt.reflectionType
    };

    if (apt.isReflected) {
      if (apt.originalAppointmentId && originalIds.has(apt.originalAppointmentId)) {
        reflected.push(debugInfo);
      } else {
        orphaned.push(debugInfo);
      }
    } else {
      original.push(debugInfo);
    }
  });

  return { original, reflected, orphaned };
}

/**
 * Log appointment debug information to console
 */
export async function logAppointmentDebugInfo(): Promise<void> {
  const { original, reflected, orphaned } = await getAppointmentDebugInfo();
  
  console.group('🔍 Appointment Debug Information');
  
  console.log('📅 Original Appointments:', original.length);
  original.forEach(apt => {
    console.log(`  - ${apt.id}: ${apt.clientName} | ${apt.service} | ${apt.location} | ${apt.staffName}`);
  });
  
  console.log('🔄 Reflected Appointments:', reflected.length);
  reflected.forEach(apt => {
    console.log(`  - ${apt.id}: ${apt.clientName} | ${apt.service} | ${apt.location} | ${apt.staffName} | Original: ${apt.originalAppointmentId}`);
  });
  
  if (orphaned.length > 0) {
    console.warn('⚠️ Orphaned Reflected Appointments:', orphaned.length);
    orphaned.forEach(apt => {
      console.warn(`  - ${apt.id}: ${apt.clientName} | ${apt.service} | ${apt.location} | ${apt.staffName} | Missing Original: ${apt.originalAppointmentId}`);
    });
  }
  
  console.groupEnd();
}

/**
 * Find the original appointment for a given appointment (if it's reflected)
 */
export function findOriginalAppointment(appointmentId: string): AppointmentDebugInfo | null {
  const allAppointments = getAllAppointments();
  const appointment = allAppointments.find(apt => apt.id === appointmentId);
  
  if (!appointment) return null;
  
  if (!appointment.isReflected) {
    // This is already an original appointment
    return {
      id: appointment.id,
      clientName: appointment.clientName,
      service: appointment.service,
      location: appointment.location,
      staffName: appointment.staffName,
      isReflected: false
    };
  }
  
  // Find the original appointment
  if (appointment.originalAppointmentId) {
    const original = allAppointments.find(apt => apt.id === appointment.originalAppointmentId);
    if (original) {
      return {
        id: original.id,
        clientName: original.clientName,
        service: original.service,
        location: original.location,
        staffName: original.staffName,
        isReflected: false
      };
    }
  }
  
  return null;
}

/**
 * Check if an appointment should be displayed as the primary appointment
 */
export function shouldDisplayAsPrimary(appointment: any): boolean {
  // Never display reflected appointments as primary
  if (appointment.isReflected) {
    return false;
  }
  
  // Original appointments are always primary
  return true;
}

/**
 * Get the display appointment (original if reflected, or the appointment itself)
 */
export async function getDisplayAppointment(appointment: any): Promise<any> {
  if (appointment.isReflected && appointment.originalAppointmentId) {
    const allAppointments = await getAllAppointments();
    const original = allAppointments.find(apt => apt.id === appointment.originalAppointmentId);
    return original || appointment;
  }

  return appointment;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).appointmentDebug = {
    getDebugInfo: getAppointmentDebugInfo,
    logDebugInfo: logAppointmentDebugInfo,
    findOriginal: findOriginalAppointment,
    shouldDisplayAsPrimary,
    getDisplayAppointment
  };
}
