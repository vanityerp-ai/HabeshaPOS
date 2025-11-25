/**
 * Tests for Appointment Reflection Service
 * Verifies that appointments are properly reflected across locations for home service staff
 */

import { appointmentReflectionService } from '../appointment-reflection';
import { StaffStorage } from '../../staff-storage';
import { getAllAppointments, saveAppointments } from '../../appointment-service';

// Mock dependencies
jest.mock('../../staff-storage');
jest.mock('../../appointment-service');

const mockStaffStorage = StaffStorage as jest.Mocked<typeof StaffStorage>;
const mockGetAllAppointments = getAllAppointments as jest.MockedFunction<typeof getAllAppointments>;
const mockSaveAppointments = saveAppointments as jest.MockedFunction<typeof saveAppointments>;

describe('AppointmentReflectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock staff data
    mockStaffStorage.getStaff.mockReturnValue([
      {
        id: 'staff-1',
        name: 'Woyni',
        email: 'woyni@salon.com',
        phone: '+974 1234 5678',
        role: 'Stylist',
        locations: ['loc1', 'loc2'], // Medinat Khalifa and other location
        status: 'Active',
        avatar: 'W',
        color: 'bg-purple-100 text-purple-800',
        homeService: true, // Has home service capability
      },
      {
        id: 'staff-2',
        name: 'Sara',
        email: 'sara@salon.com',
        phone: '+974 1234 5679',
        role: 'Colorist',
        locations: ['loc1'],
        status: 'Active',
        avatar: 'S',
        color: 'bg-blue-100 text-blue-800',
        homeService: false, // No home service capability
      }
    ]);
  });

  describe('createReflectedAppointments', () => {
    it('should create reflected appointment in home service when booking at physical location for home service staff', async () => {
      // Mock existing appointments
      mockGetAllAppointments.mockReturnValue([]);

      const originalAppointment = {
        id: 'apt-1',


        clientId: 'client-staff-1-kfmr',
        staffId: 'staff-1',
        staffName: 'Woyni',
        clientName: 'John Doe',
        service: 'Haircut',
        date: '2025-06-26T10:00:00.000Z',
        duration: 60,
        location: 'loc1', // Medinat Khalifa
        status: 'confirmed'
      };

      const reflectedAppointments = await appointmentReflectionService.createReflectedAppointments(originalAppointment);

      expect(reflectedAppointments).toHaveLength(1);
      expect(reflectedAppointments[0]).toMatchObject({
        id: 'reflected-apt-1-home',
        originalAppointmentId: 'apt-1',
        staffId: 'staff-1',
        staffName: 'Woyni',
        clientName: '[LOC1] John Doe',
        service: 'Haircut (Location Blocking)',
        location: 'home',
        isReflected: true,
        reflectionType: 'physical-to-home'
      });

      expect(mockSaveAppointments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'reflected-apt-1-home',
            isReflected: true
          })
        ])
      );
    });

    it('should create reflected appointments in physical locations when booking home service for home service staff', async () => {
      mockGetAllAppointments.mockReturnValue([]);

      const originalAppointment = {
        id: 'apt-2',


        clientId: 'client-staff-1-0hor',
        staffId: 'staff-1',
        staffName: 'Woyni',
        clientName: 'Jane Smith',
        service: 'Hair Color',
        date: '2025-06-26T14:00:00.000Z',
        duration: 120,
        location: 'home',
        status: 'confirmed'
      };

      const reflectedAppointments = await appointmentReflectionService.createReflectedAppointments(originalAppointment);

      expect(reflectedAppointments).toHaveLength(2); // One for each physical location
      expect(reflectedAppointments[0]).toMatchObject({
        id: 'reflected-apt-2-loc1',
        originalAppointmentId: 'apt-2',
        location: 'loc1',
        isReflected: true,
        reflectionType: 'home-to-physical'
      });
      expect(reflectedAppointments[1]).toMatchObject({
        id: 'reflected-apt-2-loc2',
        originalAppointmentId: 'apt-2',
        location: 'loc2',
        isReflected: true,
        reflectionType: 'home-to-physical'
      });
    });

    it('should not create reflected appointments for staff without home service capability', async () => {
      mockGetAllAppointments.mockReturnValue([]);

      const originalAppointment = {
        id: 'apt-3',


        clientId: 'client-staff-2-pbuw',
        staffId: 'staff-2', // Sara - no home service
        staffName: 'Sara',
        clientName: 'Bob Wilson',
        service: 'Hair Color',
        date: '2025-06-26T16:00:00.000Z',
        duration: 90,
        location: 'loc1',
        status: 'confirmed'
      };

      const reflectedAppointments = await appointmentReflectionService.createReflectedAppointments(originalAppointment);

      expect(reflectedAppointments).toHaveLength(0);
      expect(mockSaveAppointments).not.toHaveBeenCalled();
    });

    it('should not create reflected appointments for already reflected appointments', async () => {
      mockGetAllAppointments.mockReturnValue([]);

      const reflectedAppointment = {
        id: 'reflected-apt-1-home',
        originalAppointmentId: 'apt-1',
        clientId: 'client-1',
        staffId: 'staff-1',
        staffName: 'Woyni',
        clientName: '[LOC1] John Doe',
        service: 'Haircut (Location Blocking)',
        date: '2025-06-26T10:00:00.000Z',
        duration: 60,
        location: 'home',
        status: 'confirmed',
        isReflected: true,
        reflectionType: 'physical-to-home' as const
      };

      const reflectedAppointments = await appointmentReflectionService.createReflectedAppointments(reflectedAppointment);

      expect(reflectedAppointments).toHaveLength(0);
      expect(mockSaveAppointments).not.toHaveBeenCalled();
    });
  });

  describe('updateReflectedAppointments', () => {
    it('should update reflected appointments when original appointment changes', async () => {
      const existingAppointments = [
        {
          id: 'apt-1',
   clientId: 'client-staff-1-95bh',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: 'John Doe',
          service: 'Haircut',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'loc1',
          status: 'confirmed'
        },
        {
          id: 'reflected-apt-1-home',

          clientId: 'client-staff-1-7o03',
          originalAppointmentId: 'apt-1',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: '[LOC1] John Doe',
          service: 'Haircut (Location Blocking)',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'home',
          status: 'confirmed',
          isReflected: true,
          reflectionType: 'physical-to-home'
        }
      ];

      mockGetAllAppointments.mockReturnValue(existingAppointments);

      const updatedOriginalAppointment = {
        id: 'apt-1',


        clientId: 'client-staff-1-yqln',
        staffId: 'staff-1',
        staffName: 'Woyni',
        clientName: 'John Doe Updated',
        service: 'Haircut & Style',
        date: '2025-06-26T11:00:00.000Z', // Time changed
        duration: 90, // Duration changed
        location: 'loc1',
        status: 'confirmed'
      };

      await appointmentReflectionService.updateReflectedAppointments(updatedOriginalAppointment);

      expect(mockSaveAppointments).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'reflected-apt-1-home',
            clientName: '[LOC1] John Doe Updated',
            service: 'Haircut & Style (Location Blocking)',
            date: '2025-06-26T11:00:00.000Z',
            duration: 90
          })
        ])
      );
    });
  });

  describe('deleteReflectedAppointments', () => {
    it('should delete reflected appointments when original appointment is deleted', async () => {
      const existingAppointments = [
        {
          id: 'apt-1',
   clientId: 'client-staff-1-dr7z',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: 'John Doe',
          service: 'Haircut',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'loc1',
          status: 'confirmed'
        },
        {
          id: 'reflected-apt-1-home',

          clientId: 'client-staff-1-0ok1',
          originalAppointmentId: 'apt-1',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: '[LOC1] John Doe',
          service: 'Haircut (Location Blocking)',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'home',
          status: 'confirmed',
          isReflected: true,
          reflectionType: 'physical-to-home'
        },
        {
          id: 'apt-2',

          clientId: 'client-staff-2-xm6g',
          staffId: 'staff-2',
          staffName: 'Sara',
          clientName: 'Jane Smith',
          service: 'Hair Color',
          date: '2025-06-26T14:00:00.000Z',
          duration: 120,
          location: 'loc1',
          status: 'confirmed'
        }
      ];

      mockGetAllAppointments.mockReturnValue(existingAppointments);

      await appointmentReflectionService.deleteReflectedAppointments('apt-1');

      expect(mockSaveAppointments).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'apt-1' }),
        expect.objectContaining({ id: 'apt-2' })
      ]);
    });
  });

  describe('utility methods', () => {
    it('should correctly identify reflected appointments', async () => {
      mockGetAllAppointments.mockResolvedValue([
        {
          id: 'apt-1',
   clientId: 'client-staff-1-z43q',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: 'John Doe',
          service: 'Haircut',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'loc1',
          status: 'confirmed'
        },
        {
          id: 'reflected-apt-1-home',

          clientId: 'client-staff-1-yisn',
          originalAppointmentId: 'apt-1',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: '[LOC1] John Doe',
          service: 'Haircut (Location Blocking)',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'home',
          status: 'confirmed',
          isReflected: true,
          reflectionType: 'physical-to-home'
        }
      ]);

      expect(await appointmentReflectionService.isReflectedAppointment('apt-1')).toBe(false);
      expect(await appointmentReflectionService.isReflectedAppointment('reflected-apt-1-home')).toBe(true);
    });

    it('should get original appointment for reflected appointment', async () => {
      const appointments = [
        {
          id: 'apt-1',
   clientId: 'client-staff-1-b2e6',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: 'John Doe',
          service: 'Haircut',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'loc1',
          status: 'confirmed'
        },
        {
          id: 'reflected-apt-1-home',

          clientId: 'client-staff-1-541j',
          originalAppointmentId: 'apt-1',
          staffId: 'staff-1',
          staffName: 'Woyni',
          clientName: '[LOC1] John Doe',
          service: 'Haircut (Location Blocking)',
          date: '2025-06-26T10:00:00.000Z',
          duration: 60,
          location: 'home',
          status: 'confirmed',
          isReflected: true,
          reflectionType: 'physical-to-home'
        }
      ];

      mockGetAllAppointments.mockResolvedValue(appointments);

      const originalAppointment = await appointmentReflectionService.getOriginalAppointment('reflected-apt-1-home');
      expect(originalAppointment).toMatchObject({
        id: 'apt-1',
        clientName: 'John Doe'
      });
    });
  });

  describe('Integration Test - End-to-End Reflection', () => {
    it('should create and manage reflected appointments for Woyni scenario', async () => {
      // Initial state - no appointments
      mockGetAllAppointments.mockReturnValue([]);

      // Step 1: Book Woyni at Medinat Khalifa (loc1)
      const medinatAppointment = {
        id: 'woyni-medinat-1',

        clientId: 'client-staff-1-yqc6',
        staffId: 'staff-1',
        staffName: 'Woyni',
        clientName: 'Customer A',
        service: 'Hair Styling',
        date: '2025-06-26T10:00:00.000Z',
        duration: 90,
        location: 'loc1', // Medinat Khalifa
        status: 'confirmed'
      };

      // Create reflected appointments
      const reflectedAppointments = await appointmentReflectionService.createReflectedAppointments(medinatAppointment);

      // Should create one reflected appointment in home service
      expect(reflectedAppointments).toHaveLength(1);
      expect(reflectedAppointments[0]).toMatchObject({
        id: 'reflected-woyni-medinat-1-home',
        location: 'home',
        clientName: '[LOC1] Customer A',
        service: 'Hair Styling (Location Blocking)',
        isReflected: true,
        reflectionType: 'physical-to-home'
      });

      // Verify that the system would prevent double-booking
      // (This would be handled by the existing bidirectional conflict checking)
      console.log('✅ Woyni booked at Medinat Khalifa - Home service automatically blocked');
      console.log('✅ Reflected appointment created in home service location');
    });
  });
});
