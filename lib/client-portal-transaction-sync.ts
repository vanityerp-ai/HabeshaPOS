"use client"

import { ConsolidatedTransactionService } from './consolidated-transaction-service';
import { PaymentMethod, TransactionSource } from './transaction-types';
import { getAllAppointments } from './appointment-service';

/**
 * Service to automatically sync client portal appointments to accounting transactions
 * This ensures client portal bookings appear in the daily sales accounting page
 */
export class ClientPortalTransactionSync {
  
  /**
   * Convert completed client portal appointments to transactions
   * This should be called periodically or when appointments are marked as completed
   */
  static async syncClientPortalAppointments(addTransaction: (transaction: any) => any) {
    console.log('🔄 CLIENT PORTAL SYNC: Starting appointment to transaction sync');

    try {
      // Safety check: ensure addTransaction function is provided
      if (!addTransaction || typeof addTransaction !== 'function') {
        console.error('❌ CLIENT PORTAL SYNC: addTransaction function is not provided or invalid');
        return 0;
      }

      // Get all appointments
      const appointments = await getAllAppointments();
      console.log(`📋 Found ${appointments.length} total appointments`);
      
      // Filter for client portal appointments that are completed but not yet synced
      const clientPortalAppointments = appointments.filter(appointment => {
        const isClientPortal = appointment.source === 'client_portal' || 
                              appointment.bookedVia === 'client_portal' ||
                              appointment.metadata?.source === 'client_portal' ||
                              appointment.metadata?.isClientPortalBooking === true;
        
        const isCompleted = appointment.status === 'completed';
        
        // Check if already synced (we'll store this in metadata)
        const alreadySynced = appointment.metadata?.transactionSynced === true;
        
        return isClientPortal && isCompleted && !alreadySynced;
      });
      
      console.log(`🎯 Found ${clientPortalAppointments.length} client portal appointments to sync`);
      
      let syncedCount = 0;
      
      clientPortalAppointments.forEach(appointment => {
        try {
          console.log(`💰 Syncing appointment ${appointment.id} to transaction`);
          console.log('📋 Appointment data:', {
            id: appointment.id,
            clientName: appointment.clientName,
            service: appointment.service,
            price: appointment.price,
            status: appointment.status,
            source: appointment.source
          });
          
          // Validate appointment data before creating transaction
          if (!appointment.service || !appointment.price || !appointment.clientName) {
            console.error(`❌ Invalid appointment data for ${appointment.id}:`, {
              hasService: !!appointment.service,
              hasPrice: !!appointment.price,
              hasClientName: !!appointment.clientName
            });
            return;
          }
          
          // Create consolidated transaction for the appointment
          let transaction;
          try {
            transaction = ConsolidatedTransactionService.createConsolidatedTransaction(
              appointment,
              PaymentMethod.CREDIT_CARD, // Default payment method for client portal
              0, // No discount by default
              0  // No discount amount
            );
          } catch (createError) {
            console.error(`💥 Error creating consolidated transaction for appointment ${appointment.id}:`, createError);
            console.error('💥 Appointment data:', appointment);
            throw createError;
          }
          
          console.log('💳 Created transaction:', {
            id: transaction.id,
            amount: transaction.amount,
            clientName: transaction.clientName,
            description: transaction.description,
            status: transaction.status,
            type: transaction.type,
            hasItems: !!transaction.items,
            itemsLength: transaction.items?.length || 0
          });
          
          // Ensure the transaction has the correct source
          transaction.source = TransactionSource.CLIENT_PORTAL;
          
          // Add metadata to track this is from client portal sync
          transaction.metadata = {
            ...transaction.metadata,
            syncedFromClientPortal: true,
            originalAppointmentId: appointment.id,
            syncTimestamp: new Date().toISOString()
          };
          
          // Add the transaction
          console.log(`🔄 Adding transaction ${transaction.id} to provider...`);
          
          try {
            const result = addTransaction(transaction);
            
            if (result) {
              console.log(`✅ Successfully synced appointment ${appointment.id} to transaction ${transaction.id}`);
              
              // Mark appointment as synced
              this.markAppointmentAsSynced(appointment.id);
              syncedCount++;
            } else {
              console.error(`❌ Failed to sync appointment ${appointment.id} to transaction - addTransaction returned null/false`);
            }
          } catch (addTransactionError) {
            console.error(`💥 Error in addTransaction for appointment ${appointment.id}:`, addTransactionError);
            console.error('💥 Transaction data that failed:', transaction);
            throw addTransactionError; // Re-throw to be caught by outer catch
          }
          
        } catch (error) {
          console.error(`💥 Error syncing appointment ${appointment.id}:`, error);
          console.error('💥 Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            appointmentData: appointment
          });
        }
      });
      
      console.log(`🎉 CLIENT PORTAL SYNC: Completed! Synced ${syncedCount} appointments to transactions`);
      return syncedCount;
      
    } catch (error) {
      console.error('💥 CLIENT PORTAL SYNC: Error during sync process:', error);
      return 0;
    }
  }
  
  /**
   * Mark an appointment as synced to prevent duplicate transactions
   */
  static markAppointmentAsSynced(appointmentId: string) {
    try {
      const appointments = getAllAppointments();
      const updatedAppointments = appointments.map(appointment => {
        if (appointment.id === appointmentId) {
          return {
            ...appointment,
            metadata: {
              ...appointment.metadata,
              transactionSynced: true,
              syncTimestamp: new Date().toISOString()
            }
          };
        }
        return appointment;
      });
      
      // Save back to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('vanity_appointments', JSON.stringify(updatedAppointments));
      }
      
      console.log(`📝 Marked appointment ${appointmentId} as synced`);
    } catch (error) {
      console.error(`💥 Error marking appointment ${appointmentId} as synced:`, error);
    }
  }
  
  /**
   * Check if an appointment has already been synced to transactions
   */
  static isAppointmentSynced(appointmentId: string): boolean {
    try {
      const appointments = getAllAppointments();
      const appointment = appointments.find(a => a.id === appointmentId);
      return appointment?.metadata?.transactionSynced === true;
    } catch (error) {
      console.error(`💥 Error checking sync status for appointment ${appointmentId}:`, error);
      return false;
    }
  }
}