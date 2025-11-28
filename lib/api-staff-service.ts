'use client';

import * as React from 'react';
import { StaffMember } from './staff-storage';

/**
 * API-based staff service for database persistence
 * This service replaces localStorage-based operations with API calls
 */
export class ApiStaffService {
  /**
   * Fetch all staff members from the API
   */
  static async getStaff(locationId?: string): Promise<StaffMember[]> {
    try {
      const url = locationId 
        ? `/api/staff?locationId=${encodeURIComponent(locationId)}`
        : '/api/staff';
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch staff: ${response.statusText}`);
      }

      const data = await response.json();
      return data.staff || [];
    } catch (error) {
      console.error('Error fetching staff:', error);
      throw error;
    }
  }

  /**
   * Create a new staff member via API
   */
  static async addStaff(staffData: Omit<StaffMember, 'id'>): Promise<StaffMember> {
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(staffData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Failed to create staff: ${response.statusText}`);
      }

      const data = await response.json();
      return data.staff;
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  }

  /**
   * Update an existing staff member via API
   */
  static async updateStaff(staffData: StaffMember): Promise<StaffMember> {
    try {
      const response = await fetch(`/api/staff/${staffData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(staffData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update staff: ${response.statusText}`);
      }

      const data = await response.json();
      return data.staff;
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  }

  /**
   * Delete a staff member via API
   */
  static async deleteStaff(staffId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/staff/${staffId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to delete staff: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  }

  /**
   * Get a specific staff member by ID
   */
  static async getStaffById(staffId: string): Promise<StaffMember | null> {
    try {
      const allStaff = await this.getStaff();
      return allStaff.find(staff => staff.id === staffId) || null;
    } catch (error) {
      console.error('Error fetching staff by ID:', error);
      throw error;
    }
  }
}

/**
 * React hook for API-based staff management
 */
export function useApiStaff() {
  const [staff, setStaff] = React.useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  // Fetch staff data
  const fetchStaff = React.useCallback(async (locationId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const staffData = await ApiStaffService.getStaff(locationId);
      setStaff(staffData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch staff'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch staff data on mount
  React.useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Add staff member
  const addStaffMember = React.useCallback(async (staffData: Omit<StaffMember, 'id'>) => {
    try {
      const newStaff = await ApiStaffService.addStaff(staffData);
      setStaff(prev => [newStaff, ...prev]);
      return { staff: newStaff, user: null }; // Maintain compatibility with existing interface
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add staff'));
      throw err;
    }
  }, []);

  // Update staff member
  const updateStaffMember = React.useCallback(async (staffData: StaffMember) => {
    try {
      const updatedStaff = await ApiStaffService.updateStaff(staffData);
      setStaff(prev => prev.map(s => s.id === staffData.id ? updatedStaff : s));
      return { staff: updatedStaff, user: null }; // Maintain compatibility with existing interface
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update staff'));
      throw err;
    }
  }, []);

  // Delete staff member
  const deleteStaffMember = React.useCallback(async (staffId: string) => {
    try {
      const success = await ApiStaffService.deleteStaff(staffId);
      if (success) {
        setStaff(prev => prev.filter(s => s.id !== staffId));
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete staff'));
      throw err;
    }
  }, []);

  // Refresh data
  const refreshData = React.useCallback(() => {
    fetchStaff();
  }, [fetchStaff]);

  // Get staff by ID
  const getStaffById = React.useCallback((staffId: string) => {
    return staff.find(s => s.id === staffId);
  }, [staff]);

  return {
    staff,
    isLoading,
    error,
    fetchStaff,
    addStaffMember,
    updateStaffMember,
    deleteStaffMember,
    refreshData,
    getStaffById
  };
}
