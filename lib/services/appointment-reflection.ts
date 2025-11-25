"use client"

/**
 * Appointment Reflection Service
 * Handles automatic creation of reflected/shadow appointments for staff with home service capability
 * to prevent double-booking across physical and home service locations
 */

import { getAllAppointments, saveAppointments } from '../appointment-service';
import { StaffStorage } from '../staff-storage';
import { parseISO, addMinutes } from 'date-fns';

export interface ReflectedAppointment {
  id: string;
  originalAppointmentId: string;
  clientId: string;
  staffId: string;
  staffName: string;
  clientName: string;
  service: string;
  date: string;
  duration: number;
  location: string;
  isReflected: true;
  reflectionType: 'physical-to-home' | 'home-to-physical';
  status: 'confirmed' | 'cancelled';
  notes?: string;
}

export interface AppointmentData {
  id: string;
  clientId: string;
  staffId: string;
  staffName: string;
  clientName: string;
  service: string;
  date: string;
  duration: number;
  location: string;
  status: string;
  isReflected?: boolean;
  originalAppointmentId?: string;
  reflectionType?: 'physical-to-home' | 'home-to-physical';
  notes?: string;
}

class AppointmentReflectionService {
  private static instance: AppointmentReflectionService;

  static getInstance(): AppointmentReflectionService {
    if (!AppointmentReflectionService.instance) {
      AppointmentReflectionService.instance = new AppointmentReflectionService();
    }
    return AppointmentReflectionService.instance;
  }

  /**
   * Check if a staff member has home service capability
   */
  private hasHomeServiceCapability(staffId: string): boolean {
    const staff = StaffStorage.getStaff();
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember?.homeService === true || staffMember?.locations.includes('home') || false;
  }

  /**
   * Get the physical locations assigned to a staff member
   */
  private getStaffPhysicalLocations(staffId: string): string[] {
    const staff = StaffStorage.getStaff();
    const staffMember = staff.find(s => s.id === staffId);
    if (!staffMember) return [];
    
    // Filter out 'home' location to get only physical locations
    return staffMember.locations.filter(loc => loc !== 'home');
  }

  /**
   * Create reflected appointments for a new appointment
   */
  async createReflectedAppointments(originalAppointment: AppointmentData): Promise<ReflectedAppointment[]> {
    // Only create reflections for staff with home service capability
    if (!this.hasHomeServiceCapability(originalAppointment.staffId)) {
      console.log(`Staff ${originalAppointment.staffName} does not have home service capability, skipping reflection`);
      return [];
    }

    // Don't create reflections for already reflected appointments
    if (originalAppointment.isReflected) {
      return [];
    }

    const reflectedAppointments: ReflectedAppointment[] = [];
    const allAppointments = await getAllAppointments();

    if (originalAppointment.location === 'home') {
      // Original is home service - create reflections in physical locations
      const physicalLocations = this.getStaffPhysicalLocations(originalAppointment.staffId);
      
      for (const physicalLocation of physicalLocations) {
        const reflectedId = `reflected-${originalAppointment.id}-${physicalLocation}`;
        
        // Check if reflection already exists
        const existingReflection = allAppointments.find(apt => apt.id === reflectedId);
        if (existingReflection) continue;

        const reflectedAppointment: ReflectedAppointment = {
          id: reflectedId,
          originalAppointmentId: originalAppointment.id,
          staffId: originalAppointment.staffId,
          staffName: originalAppointment.staffName,
          clientName: `[HOME SERVICE] ${originalAppointment.clientName}`,
          service: `${originalAppointment.service} (Location Blocking)`,
          date: originalAppointment.date,
          duration: originalAppointment.duration,
          location: physicalLocation,
          isReflected: true,
          reflectionType: 'home-to-physical',
          status: 'confirmed',
          notes: `Automatically created to block availability due to home service appointment`
        };

        reflectedAppointments.push(reflectedAppointment);
      }
    } else {
      // Original is physical location - create reflection in home service
      const reflectedId = `reflected-${originalAppointment.id}-home`;
      
      // Check if reflection already exists
      const existingReflection = allAppointments.find(apt => apt.id === reflectedId);
      if (!existingReflection) {
        const reflectedAppointment: ReflectedAppointment = {
          id: reflectedId,
          originalAppointmentId: originalAppointment.id,
          staffId: originalAppointment.staffId,
          staffName: originalAppointment.staffName,
          clientName: `[${originalAppointment.location.toUpperCase()}] ${originalAppointment.clientName}`,
          service: `${originalAppointment.service} (Location Blocking)`,
          date: originalAppointment.date,
          duration: originalAppointment.duration,
          location: 'home',
          isReflected: true,
          reflectionType: 'physical-to-home',
          status: 'confirmed',
          notes: `Automatically created to block home service availability due to ${originalAppointment.location} appointment`
        };

        reflectedAppointments.push(reflectedAppointment);
      }
    }

    // Add reflected appointments to storage
    if (reflectedAppointments.length > 0) {
      const updatedAppointments = [...allAppointments, ...reflectedAppointments];
      saveAppointments(updatedAppointments);

      console.log(`✅ Created ${reflectedAppointments.length} reflected appointments for ${originalAppointment.staffName}`);
      console.log('📋 Reflected appointments created:', reflectedAppointments.map(ra => ({
        id: ra.id,
        originalId: ra.originalAppointmentId,
        location: ra.location,
        clientName: ra.clientName,
        service: ra.service
      })));
    }

    return reflectedAppointments;
  }

  /**
   * Update reflected appointments when original appointment changes
   */
  async updateReflectedAppointments(originalAppointment: AppointmentData): Promise<void> {
    const allAppointments = await getAllAppointments();

    // Find all reflected appointments for this original appointment
    const reflectedAppointments = allAppointments.filter(apt =>
      apt.originalAppointmentId === originalAppointment.id && apt.isReflected
    );

    if (reflectedAppointments.length === 0) {
      return;
    }

    // Update each reflected appointment
    const updatedAppointments = allAppointments.map(apt => {
      if (apt.originalAppointmentId === originalAppointment.id && apt.isReflected) {
        return {
          ...apt,
          staffName: originalAppointment.staffName,
          date: originalAppointment.date,
          duration: originalAppointment.duration,
          status: originalAppointment.status,
          // Update client name with location prefix
          clientName: originalAppointment.location === 'home' 
            ? `[HOME SERVICE] ${originalAppointment.clientName}`
            : `[${originalAppointment.location.toUpperCase()}] ${originalAppointment.clientName}`,
          // Update service name with location blocking suffix
          service: `${originalAppointment.service} (Location Blocking)`
        };
      }
      return apt;
    });

    saveAppointments(updatedAppointments);
    console.log(`Updated ${reflectedAppointments.length} reflected appointments for ${originalAppointment.staffName}`);
  }

  /**
   * Delete reflected appointments when original appointment is deleted
   */
  async deleteReflectedAppointments(originalAppointmentId: string): Promise<void> {
    const allAppointments = await getAllAppointments();

    // Filter out reflected appointments for this original appointment
    const filteredAppointments = allAppointments.filter(apt =>
      !(apt.originalAppointmentId === originalAppointmentId && apt.isReflected)
    );

    const deletedCount = allAppointments.length - filteredAppointments.length;
    
    if (deletedCount > 0) {
      saveAppointments(filteredAppointments);
      console.log(`Deleted ${deletedCount} reflected appointments for original appointment ${originalAppointmentId}`);
    }
  }

  /**
   * Get all reflected appointments for a specific original appointment
   */
  async getReflectedAppointments(originalAppointmentId: string): Promise<AppointmentData[]> {
    const allAppointments = await getAllAppointments();
    return allAppointments.filter(apt =>
      apt.originalAppointmentId === originalAppointmentId && apt.isReflected
    );
  }

  /**
   * Check if an appointment is a reflected appointment
   */
  async isReflectedAppointment(appointmentId: string): Promise<boolean> {
    const allAppointments = await getAllAppointments();
    const appointment = allAppointments.find(apt => apt.id === appointmentId);
    return appointment?.isReflected === true;
  }

  /**
   * Get the original appointment for a reflected appointment
   */
  async getOriginalAppointment(reflectedAppointmentId: string): Promise<AppointmentData | null> {
    const allAppointments = await getAllAppointments();
    const reflectedAppointment = allAppointments.find(apt => apt.id === reflectedAppointmentId);

    if (!reflectedAppointment?.originalAppointmentId) {
      return null;
    }

    return allAppointments.find(apt => apt.id === reflectedAppointment.originalAppointmentId) || null;
  }

  /**
   * Cleanup orphaned reflected appointments (where original no longer exists)
   */
  async cleanupOrphanedReflections(): Promise<number> {
    const allAppointments = await getAllAppointments();
    const originalAppointmentIds = new Set(
      allAppointments
        .filter(apt => !apt.isReflected)
        .map(apt => apt.id)
    );

    const orphanedReflections = allAppointments.filter(apt => 
      apt.isReflected && 
      apt.originalAppointmentId && 
      !originalAppointmentIds.has(apt.originalAppointmentId)
    );

    if (orphanedReflections.length > 0) {
      const cleanedAppointments = allAppointments.filter(apt => 
        !(apt.isReflected && 
          apt.originalAppointmentId && 
          !originalAppointmentIds.has(apt.originalAppointmentId))
      );

      saveAppointments(cleanedAppointments);
      console.log(`Cleaned up ${orphanedReflections.length} orphaned reflected appointments`);
    }

    return orphanedReflections.length;
  }

  /**
   * Clean up existing reflected appointments to remove location blocking text from service names
   * This function should be called manually when needed to avoid recursion issues
   */
  cleanupReflectedAppointmentServiceNames(): void {
    // Prevent recursion by directly accessing localStorage instead of using getAllAppointments
    let appointments: any[] = [];
    try {
      const storedData = typeof window !== 'undefined' ? localStorage.getItem('vanity_appointments') : null;
      if (storedData) {
        appointments = JSON.parse(storedData);
      }
    } catch (error) {
      console.error('Error loading appointments for cleanup:', error);
      return;
    }

    let hasChanges = false;
    const cleanedAppointments = appointments.map(apt => {
      if (apt.isReflected && apt.service) {
        // Remove "(Location Blocking)" and "(Home Service Blocking)" text from service names
        const cleanedService = apt.service
          .replace(/\s*\(Location Blocking\)$/i, '')
          .replace(/\s*\(Home Service Blocking\)$/i, '');

        if (cleanedService !== apt.service) {
          hasChanges = true;
          console.log(`Cleaning service name: "${apt.service}" -> "${cleanedService}"`);
          return {
            ...apt,
            service: cleanedService
          };
        }
      }
      return apt;
    });

    if (hasChanges) {
      // Directly save to localStorage to avoid recursion
      try {
        localStorage.setItem('vanity_appointments', JSON.stringify(cleanedAppointments));
        console.log('✅ Cleaned up reflected appointment service names');
      } catch (error) {
        console.error('Error saving cleaned appointments:', error);
      }
    } else {
      console.log('No reflected appointments need service name cleanup');
    }
  }
}

// Export singleton instance
export const appointmentReflectionService = AppointmentReflectionService.getInstance();

// Make cleanup function available in browser console for manual execution
if (typeof window !== 'undefined') {
  (window as any).cleanupAppointmentServiceNames = () => {
    appointmentReflectionService.cleanupReflectedAppointmentServiceNames();
  };
}
