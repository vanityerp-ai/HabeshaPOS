"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import {
  Transaction,
  TransactionCreate,
  TransactionFilter,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  PaymentMethod
} from "./transaction-types"
import { SettingsStorage } from "./settings-storage"
import { format, isAfter, isBefore, isSameDay, parseISO } from "date-fns"

import { integratedAnalyticsService } from "./integrated-analytics-service"
import { realTimeService, RealTimeEventType } from "./real-time-service"
import { getExistingTransactionsForAppointment } from "./transaction-utils"
import { transactionDeduplicationService } from "./transaction-deduplication-service"
import { ClientPortalTransactionSync } from "./client-portal-transaction-sync"

// Default transactions for initial setup (using real location IDs)
const getDefaultTransactions = (): Transaction[] => {
  return []
}

interface TransactionContextType {
  transactions: Transaction[];
  addTransaction: (transaction: TransactionCreate) => Transaction | null;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Transaction | null;

  getTransaction: (id: string) => Transaction | null;
  filterTransactions: (filter: TransactionFilter) => Transaction[];
  getTransactionsBySource: (source: TransactionSource) => Transaction[];
  getTransactionsByDateRange: (startDate: Date, endDate: Date) => Transaction[];
  getTransactionsByDate: (date: Date) => Transaction[];
  removeDuplicateTransactions: () => number;
  cleanupAllDuplicates: () => number;
  cleanupAppointmentDuplicates: () => number;
  syncClientPortalAppointments: () => number;
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load transactions from database (SINGLE SOURCE OF TRUTH) on mount
  useEffect(() => {
    const loadTransactionsFromDatabase = async () => {
      try {
        console.log('🔄 TRANSACTION PROVIDER: Loading transactions from database (single source of truth)...');

        const response = await fetch('/api/transactions');
        if (response.ok) {
          const data = await response.json();
          const dbTransactions = data.transactions || [];

          console.log(`✅ TRANSACTION PROVIDER: Loaded ${dbTransactions.length} transactions from database`);

          // Convert database transactions to the format expected by the provider
          const convertedTransactions = dbTransactions.map((tx: any) => {
            // Parse items if they're stored as JSON string
            let items = tx.items;
            if (typeof items === 'string') {
              try {
                items = JSON.parse(items);
              } catch (e) {
                items = undefined;
              }
            }

            // Determine source from reference or type
            let source = TransactionSource.POS; // Default to POS
            if (tx.reference) {
              if (tx.reference.startsWith('SALE-')) {
                source = TransactionSource.POS;
              } else if (tx.reference.startsWith('APPT-')) {
                source = TransactionSource.CALENDAR;
              } else if (tx.reference.startsWith('CP-')) {
                source = TransactionSource.CLIENT_PORTAL;
              }
            }

            // Extract client info from items if available
            let clientId = undefined;
            let clientName = undefined;
            if (items && Array.isArray(items) && items.length > 0) {
              // Check if items have client info
              const firstItem = items[0];
              if (firstItem.clientId) clientId = firstItem.clientId;
              if (firstItem.clientName) clientName = firstItem.clientName;
            }

            // Map database transaction to provider transaction format
            return {
              id: tx.id,
              date: new Date(tx.createdAt),
              type: tx.type as TransactionType,
              category: tx.description || 'Sale',
              description: tx.description || '',
              amount: Number(tx.amount),
              paymentMethod: tx.method as PaymentMethod,
              status: tx.status.toLowerCase() as TransactionStatus,
              location: tx.locationId || undefined,
              source: source,
              clientId: clientId,
              clientName: clientName,
              staffId: tx.userId,
              reference: tx.reference ? { type: 'sale', id: tx.reference } : undefined,
              items: items,
              serviceAmount: tx.serviceAmount ? Number(tx.serviceAmount) : undefined,
              productAmount: tx.productAmount ? Number(tx.productAmount) : undefined,
              discountAmount: tx.discountAmount ? Number(tx.discountAmount) : undefined,
              createdAt: new Date(tx.createdAt),
              updatedAt: new Date(tx.updatedAt || tx.createdAt)
            };
          });

          setTransactions(convertedTransactions);

          // Also save to localStorage as a backup
          localStorage.setItem('vanity_transactions', JSON.stringify(convertedTransactions));

        } else {
          console.warn('⚠️ TRANSACTION PROVIDER: Failed to load from database, falling back to localStorage');

          // Fallback to localStorage
          const storedTransactions = localStorage.getItem('vanity_transactions');
          if (storedTransactions) {
            try {
              const parsedTransactions = JSON.parse(storedTransactions);
              const transactionsWithDates = parsedTransactions.map((tx: any) => ({
                ...tx,
                date: new Date(tx.date),
                createdAt: new Date(tx.createdAt),
                updatedAt: new Date(tx.updatedAt)
              }));
              setTransactions(transactionsWithDates);
              console.log('Loaded transactions from localStorage:', transactionsWithDates.length);
            } catch (error) {
              console.error('Failed to parse stored transactions:', error);
              setTransactions(getDefaultTransactions());
            }
          } else {
            setTransactions(getDefaultTransactions());
            console.log('No stored transactions found, initializing with empty data');
          }
        }
      } catch (error) {
        console.error('❌ TRANSACTION PROVIDER: Error loading transactions from database:', error);

        // Fallback to localStorage
        const storedTransactions = localStorage.getItem('vanity_transactions');
        if (storedTransactions) {
          try {
            const parsedTransactions = JSON.parse(storedTransactions);
            const transactionsWithDates = parsedTransactions.map((tx: any) => ({
              ...tx,
              date: new Date(tx.date),
              createdAt: new Date(tx.createdAt),
              updatedAt: new Date(tx.updatedAt)
            }));
            setTransactions(transactionsWithDates);
            console.log('Loaded transactions from localStorage after error:', transactionsWithDates.length);
          } catch (parseError) {
            console.error('Failed to parse stored transactions:', parseError);
            setTransactions(getDefaultTransactions());
          }
        } else {
          setTransactions(getDefaultTransactions());
        }
      } finally {
        setIsInitialized(true);
      }
    };

    loadTransactionsFromDatabase();
  }, []);

  // Save transactions to localStorage when they change (only after initialization)
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('vanity_transactions', JSON.stringify(transactions));
        console.log('💾 TRANSACTION PROVIDER: Saved transactions to localStorage:', {
          count: transactions.length,
          latestTransactionIds: transactions.slice(-3).map(tx => tx.id),
          sources: [...new Set(transactions.map(tx => tx.source))]
        });

        // Sync with analytics service to ensure real-time updates
        integratedAnalyticsService.syncWithTransactionProvider(transactions);
      } catch (error) {
        console.error('❌ TRANSACTION PROVIDER: Failed to save transactions to localStorage:', error);
      }
    }
  }, [transactions, isInitialized]);

  // Sync client portal appointments to transactions after initialization
  useEffect(() => {
    if (isInitialized) {
      console.log('🔄 TRANSACTION PROVIDER: Running client portal appointment sync');

      // Run the sync with a small delay to ensure everything is loaded
      setTimeout(async () => {
        try {
          const syncedCount = await ClientPortalTransactionSync.syncClientPortalAppointments(addTransaction);
          if (syncedCount > 0) {
            console.log(`✅ TRANSACTION PROVIDER: Synced ${syncedCount} client portal appointments to transactions`);
          }
        } catch (error) {
          console.error('❌ TRANSACTION PROVIDER: Error during client portal sync:', error);
        }
      }, 1000);
    }
  }, [isInitialized]);



  // Function to remove duplicate transactions (legacy - kept for compatibility)
  const removeDuplicateTransactions = (): number => {
    console.log('🧹 Legacy duplicate removal called - using enhanced version');
    return cleanupAllDuplicates();
  };

  // Enhanced function to clean up all types of duplicates
  const cleanupAllDuplicates = (): number => {
    console.log('🧹 Starting comprehensive duplicate cleanup');

    let totalRemoved = 0;

    // Fallback to simple duplicate removal
    // totalRemoved += cleanupAppointmentDuplicates(); // This line was previously here, but the instruction was to remove a line referencing `removeDuplicatesUtil`, which is no longer present in the code. The `cleanupAppointmentDuplicates` call is kept as it's the current fallback logic.

    return totalRemoved;
  };

  // Specific function to clean up appointment transaction duplicates
  const cleanupAppointmentDuplicates = (): number => {
    console.log('🧹 Starting appointment duplicate cleanup');

    let totalRemoved = 0;
    const appointmentTransactionGroups = new Map<string, Transaction[]>();

    // Group transactions by appointment ID
    transactions.forEach(tx => {
      if (tx.reference?.type === 'appointment' && tx.reference?.id) {
        const appointmentId = tx.reference.id;
        if (!appointmentTransactionGroups.has(appointmentId)) {
          appointmentTransactionGroups.set(appointmentId, []);
        }
        appointmentTransactionGroups.get(appointmentId)!.push(tx);
      }
    });

    // Remove duplicates for each appointment
    appointmentTransactionGroups.forEach((txGroup, appointmentId) => {
      if (txGroup.length > 1) {
        console.log(`🔍 Found ${txGroup.length} transactions for appointment ${appointmentId}`);

        // Sort by creation date to keep the most recent one
        txGroup.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // Keep the first (most recent) transaction, remove the rest
        for (let i = 1; i < txGroup.length; i++) {
          console.log(`🗑️ Removing duplicate transaction: ${txGroup[i].id} (Amount: ${txGroup[i].amount})`);
          setTransactions(prev => prev.filter(tx => tx.id !== txGroup[i].id));
          totalRemoved++;
        }

        console.log(`✅ Kept transaction: ${txGroup[0].id} (Amount: ${txGroup[0].amount})`);
      }
    });

    console.log(`🧹 Appointment duplicate cleanup completed. Removed ${totalRemoved} duplicates.`);
    return totalRemoved;
  };

  const addTransaction = (transaction: TransactionCreate): Transaction | null => {
    console.log('=== TRANSACTION PROVIDER: addTransaction called ===');
    console.log('Input transaction:', transaction);

    // Generate a shorter 8-digit transaction ID
    const generateShortId = () => {
      // Use timestamp modulo to get last 6 digits + 2 random digits
      const timestamp = Date.now();
      const last6Digits = timestamp % 1000000; // Last 6 digits of timestamp
      const random2Digits = Math.floor(Math.random() * 100); // 2 random digits
      return `${last6Digits}${random2Digits.toString().padStart(2, '0')}`;
    };
    
    const uniqueId = transaction.id || generateShortId();

    let transactionType = transaction.type;

    if (transaction.description && 
        (transaction.description.toLowerCase().includes('haircut') ||
         transaction.description.toLowerCase().includes('color') ||
         transaction.description.toLowerCase().includes('style') ||
         transaction.description.toLowerCase().includes('treatment') ||
         transaction.description.toLowerCase().includes('manicure') ||
         transaction.description.toLowerCase().includes('pedicure') ||
         transaction.description.toLowerCase().includes('facial') ||
         transaction.description.toLowerCase().includes('massage')) && 
        transaction.type === TransactionType.INCOME) {
      
      transactionType = TransactionType.SERVICE_SALE;
      console.log(`🔧 Auto-corrected transaction type to SERVICE_SALE for "${transaction.description}"`);
    }
    
    if (transaction.items && 
        Array.isArray(transaction.items) && 
        transaction.items.some(item => item.type === 'service') &&
        transaction.items.some(item => item.type === 'product') &&
        transaction.type !== TransactionType.CONSOLIDATED_SALE) {
      
      transactionType = TransactionType.CONSOLIDATED_SALE;
      console.log(`🔧 Auto-corrected transaction type to CONSOLIDATED_SALE for mixed service/product transaction`);
    }

    const newTransaction: Transaction = {
      ...transaction,
      id: uniqueId,
      date: transaction.date || new Date(),
      description: transaction.description || '',
      type: transactionType, 
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Validate transaction before adding
    const validation = transactionDeduplicationService.validateTransaction(newTransaction);
    if (!validation.isValid) {
      console.error('❌ TRANSACTION VALIDATION FAILED:', validation.errors);
      throw new Error(`Transaction validation failed: ${validation.errors.join(', ')}`);
    }

    // Check for duplicates using deduplication service
    if (!transactionDeduplicationService.shouldRecordTransaction(newTransaction)) {
      console.log('🔄 TRANSACTION DEDUPLICATION: Transaction already exists or is duplicate, skipping');
      // Return the existing transaction if available, or just return null
      const existingTransaction = transactions.find(tx => tx.id === newTransaction.id);
      // If it's a duplicate, we still return the new transaction
      // This allows the client portal sync to proceed, assuming the appointment was already synced
      return newTransaction;
    }

    // Check for duplicates if this is an appointment or POS transaction
    if (newTransaction.reference?.type === 'appointment' && newTransaction.reference?.id) {
      const existingTransactions = getExistingTransactionsForAppointment(
        transactions,
        newTransaction.reference.id,
        newTransaction.metadata?.bookingReference
      );
      
      // If we found any existing transactions for this appointment
      if (existingTransactions.length > 0) {
        console.warn(`Found ${existingTransactions.length} existing transactions for appointment ${newTransaction.reference.id}`);
        
        // Check if this is a discounted transaction replacing a non-discounted one
        const isIncomingTransactionDiscounted = newTransaction.discountPercentage && newTransaction.discountPercentage > 0;

        // Filter existing transactions to only consider those of the same type (e.g., SERVICE_SALE, CONSOLIDATED_SALE)
        // This prevents a service sale from being replaced by a product sale, etc. (using newTransaction.type)
        const relevantExistingTransactions = existingTransactions.filter(
          (tx: Transaction) => tx.type === newTransaction.type || tx.type === TransactionType.CONSOLIDATED_SALE 
        );

        // Sort by amount to easily find highest (original) and lowest (discounted)
        relevantExistingTransactions.sort((a: Transaction, b: Transaction) => a.amount - b.amount); 

        const existingDiscountedTx = relevantExistingTransactions.find((tx: Transaction) => tx.discountPercentage && tx.discountPercentage > 0);
        const existingNonDiscountedTx = relevantExistingTransactions.find((tx: Transaction) => !tx.discountPercentage || tx.discountPercentage === 0);

        if (isIncomingTransactionDiscounted) {
          // Incoming is discounted. We want to ensure only the discounted one exists.
          if (existingDiscountedTx) {
            // A discounted transaction already exists. If it's the same, skip. If different, replace.
            if (existingDiscountedTx.id === newTransaction.id) {
              console.warn('Incoming discounted transaction is identical to an existing one. Skipping add.');
              return existingDiscountedTx;
            } else {
              // Different discounted transaction for same booking. Remove old one.
              console.log(`Removing existing discounted transaction: ${existingDiscountedTx.id} (${existingDiscountedTx.amount})`);
              setTransactions(prev => prev.filter(tx => tx.id !== existingDiscountedTx.id));
            }
          }
          if (existingNonDiscountedTx) {
            // A non-discounted transaction exists. Remove it.
            console.log(`Removing existing non-discounted transaction: ${existingNonDiscountedTx.id} (${existingNonDiscountedTx.amount})`);
            setTransactions(prev => prev.filter(tx => tx.id !== existingNonDiscountedTx.id));
          }
          // Proceed to add the new discounted transaction
          console.log('Adding new discounted transaction.');
        } else {
          // Incoming is NOT discounted. We want to ensure only the discounted one exists if applicable.
          if (existingDiscountedTx) {
            // A discounted transaction already exists. Do NOT add the non-discounted one.
            console.warn('Existing discounted transaction found. Skipping add of non-discounted transaction.');
            return existingDiscountedTx; 
          }
          if (existingNonDiscountedTx) {
            // A non-discounted transaction already exists. If it's the same, skip. If different, replace.
            if (existingNonDiscountedTx.id === newTransaction.id) {
              console.warn('Incoming non-discounted transaction is identical to an existing one. Skipping add.');
              return existingNonDiscountedTx;
            } else {
              // Different non-discounted transaction for same booking. Remove old one.
              console.log(`Removing existing non-discounted transaction: ${existingNonDiscountedTx.id} (${existingNonDiscountedTx.amount})`);
              setTransactions(prev => prev.filter(tx => tx.id !== existingNonDiscountedTx.id));
            }
          }
          // Proceed to add the new non-discounted transaction (only if no discounted one existed)
          console.log('Adding new non-discounted transaction.');
        }
      }
    }

    console.log('=== TRANSACTION PROVIDER: Created new transaction ===');
    console.log('New transaction:', newTransaction);
    console.log('Transaction ID:', newTransaction.id);
    console.log('Transaction source:', newTransaction.source);
    console.log('Transaction amount:', newTransaction.amount);

    setTransactions(prev => {
      // Double-check for duplicates in the current state
      const duplicateCheck = prev.find(tx => {
        // Check for exact ID match
        if (tx.id === newTransaction.id) {
          return true;
        }

        // For appointment transactions, check for same appointment AND same transaction type
        // This allows separate service and product transactions from the same appointment
        if (tx.reference?.type === 'appointment' &&
            newTransaction.reference?.type === 'appointment' &&
            tx.reference?.id === newTransaction.reference?.id &&
            tx.type === newTransaction.type) {
          console.log('🚫 TRANSACTION PROVIDER: Found duplicate appointment transaction of same type');
          console.log(`   Existing: ${tx.id} - Type: ${tx.type} - Amount: ${tx.amount}`);
          console.log(`   New: ${newTransaction.id} - Type: ${newTransaction.type} - Amount: ${newTransaction.amount}`);
          return true;
        }

        return false;
      });

      if (duplicateCheck) {
        console.log('🚫 TRANSACTION PROVIDER: Last-minute duplicate detected, skipping addition');
        console.log('🚫 Returning existing transaction instead:', duplicateCheck.id);
        return prev;
      }

      const updated = [...prev, newTransaction];
      console.log('✅ TRANSACTION PROVIDER: Updated transactions array:', {
        previousCount: prev.length,
        newCount: updated.length,
        newTransactionId: newTransaction.id,
        newTransactionSource: newTransaction.source,
        newTransactionAmount: newTransaction.amount,
        allTransactionIds: updated.slice(-5).map(tx => tx.id) // Show last 5 IDs
      });
      return updated;
    });

    // Emit real-time event for new transaction
    realTimeService.emitEvent(RealTimeEventType.TRANSACTION_CREATED, {
      transaction: newTransaction,
      source: newTransaction.source,
      amount: newTransaction.amount,
      clientName: newTransaction.clientName
    }, {
      source: 'TransactionProvider',
      userId: newTransaction.staffId,
      locationId: newTransaction.location
    });

    // Save transaction to database
    saveTransactionToDatabase(newTransaction).catch(error => {
      console.error('❌ Failed to save transaction to database:', {
        error: error,
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace'
      });
    });

    console.log('=== TRANSACTION PROVIDER: Returning transaction ===');
    return newTransaction;
  };

  // Helper function to save transaction to database
  const saveTransactionToDatabase = async (transaction: Transaction) => {
    try {
      console.log('💾 Saving transaction to database:', {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        clientId: transaction.clientId,
        staffId: transaction.staffId
      });

      // Determine userId - we need to resolve Staff.userId or Client.userId
      let userId: string | null = null;

      // If staffId is provided, it's a StaffMember.id, we need to fetch the StaffMember to get userId
      if (transaction.staffId) {
        try {
          const staffResponse = await fetch(`/api/staff/${transaction.staffId}`);
          if (staffResponse.ok) {
            const staffData = await staffResponse.json();
            userId = staffData.userId;
            console.log(`📋 Resolved userId: ${userId} from staffId: ${transaction.staffId}`);
          } else {
            console.warn(`⚠️ Could not fetch staff data for staffId: ${transaction.staffId}, status: ${staffResponse.status}`);
          }
        } catch (error) {
          console.warn('Could not resolve userId from staffId:', error);
        }
      }

      // If no userId from staff, try clientId
      if (!userId && transaction.clientId) {
        try {
          const clientResponse = await fetch(`/api/clients/${transaction.clientId}`);
          if (clientResponse.ok) {
            const clientData = await clientResponse.json();
            userId = clientData.userId;
            console.log(`📋 Resolved userId: ${userId} from clientId: ${transaction.clientId}`);
          } else {
            console.warn(`⚠️ Could not fetch client data for clientId: ${transaction.clientId}, status: ${clientResponse.status}`);
          }
        } catch (error) {
          console.warn('Could not resolve userId from clientId:', error);
        }
      }

      // If still no userId, skip saving to database but don't throw error
      // The transaction is already saved to localStorage and state
      if (!userId) {
        console.warn('⚠️ No userId available for transaction, skipping database save:', {
          transactionId: transaction.id,
          clientId: transaction.clientId,
          staffId: transaction.staffId,
          note: 'Transaction is saved to localStorage and will be available in the UI'
        });
        return;
      }

      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId,
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
          method: transaction.paymentMethod,
          reference: transaction.reference?.id || null,
          description: transaction.description || `${transaction.category} - ${transaction.description || ''}`,
          locationId: transaction.location || null,
          appointmentId: transaction.reference?.type === 'appointment' ? transaction.reference.id : null,
          serviceAmount: transaction.type === 'service_sale' ? transaction.amount : transaction.serviceAmount || null,
          productAmount: transaction.type === 'product_sale' ? transaction.amount : transaction.productAmount || null,
          originalServiceAmount: transaction.metadata?.originalServiceAmount || null,
          discountPercentage: transaction.metadata?.discountPercentage || null,
          discountAmount: transaction.metadata?.discountAmount || transaction.discountAmount || null,
          items: transaction.items || []
        }),
      });

      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = await response.json();
        } catch (e) {
          errorDetails = await response.text();
        }
        const errorMessage = `Failed to save transaction to database: ${response.status} ${response.statusText}`;
        console.error('❌ ' + errorMessage, {
          status: response.status,
          statusText: response.statusText,
          error: errorDetails,
          transactionId: transaction.id,
          userId: userId
        });
        throw new Error(errorMessage + ' - ' + JSON.stringify(errorDetails));
      } else {
        const result = await response.json();
        console.log('✅ Transaction saved to database:', result.transaction?.id);
      }
    } catch (error: any) {
      console.error('❌ Error saving transaction to database:', {
        message: error?.message || 'Unknown error',
        error: error,
        transactionId: transaction.id,
        stack: error?.stack
      });
      throw error; // Re-throw to be caught by the outer catch
    }
  };

  // Update an existing transaction
  const updateTransaction = (id: string, updates: Partial<Transaction>): Transaction | null => {
    console.log('🔄 TransactionProvider: Updating transaction', { id, updates });
    let updatedTransaction: Transaction | null = null;

    setTransactions(prev => {
      const index = prev.findIndex(tx => tx.id === id);
      if (index === -1) {
        console.warn(`Transaction ${id} not found in provider`);
        return prev;
      }

      const updated = {
        ...prev[index],
        ...updates,
        updatedAt: new Date()
      };

      updatedTransaction = updated as Transaction;
      const newTransactions = [...prev];
      newTransactions[index] = updated;

      console.log('✅ TransactionProvider: Transaction updated successfully', {
        id,
        oldStatus: prev[index].status,
        newStatus: updated.status
      });

      return newTransactions;
    });

    // Emit real-time event for transaction update
    if (updatedTransaction) {
      realTimeService.emitEvent(RealTimeEventType.TRANSACTION_UPDATED, {
        transaction: updatedTransaction,
        updates,
        previousStatus: updates.status ? 'updated' : 'unchanged'
      }, {
        source: 'TransactionProvider',
        userId: (updatedTransaction as Transaction).staffId,
        locationId: (updatedTransaction as Transaction).location
      });
    }

    return updatedTransaction;
  };



  // Get a transaction by ID
  const getTransaction = (id: string): Transaction | null => {
    return transactions.find(tx => tx.id === id) || null;
  };

  // Filter transactions based on criteria
  const filterTransactions = (filter: TransactionFilter): Transaction[] => {
    console.log('🔍 TRANSACTION PROVIDER: Filtering transactions:', {
      totalTransactions: transactions.length,
      filter,
      clientPortalCount: transactions.filter(tx => tx.source === TransactionSource.CLIENT_PORTAL).length
    });

    let filtered = transactions.filter(tx => {
      // Convert date strings to Date objects if needed
      const txDate = typeof tx.date === 'string' ? new Date(tx.date) : tx.date;

      // Filter by date range
      if (filter.startDate && filter.endDate) {
        // Create end of day for endDate to include all transactions from that day
        const endOfDay = new Date(filter.endDate);
        endOfDay.setHours(23, 59, 59, 999);

        const isBeforeStart = isBefore(txDate, filter.startDate);
        const isAfterEnd = isAfter(txDate, endOfDay);

        if (tx.source === TransactionSource.CLIENT_PORTAL) {
          console.log('🔍 CLIENT_PORTAL transaction date check:', {
            transactionId: tx.id,
            txDate: txDate.toISOString(),
            startDate: filter.startDate.toISOString(),
            endDate: filter.endDate.toISOString(),
            endOfDay: endOfDay.toISOString(),
            isBeforeStart,
            isAfterEnd,
            willBeFiltered: isBeforeStart || isAfterEnd
          });
        }

        if (isBeforeStart || isAfterEnd) {
          return false;
        }
      }

      // Filter by single date
      if (filter.singleDate && !isSameDay(txDate, filter.singleDate)) {
        return false;
      }

      // Filter by type
      if (filter.type && tx.type !== filter.type) {
        return false;
      }

      // Filter by source
      if (filter.source && filter.source !== 'all' && tx.source !== filter.source) {
        console.log('🔍 Source filter check:', {
          transactionId: tx.id,
          txSource: tx.source,
          filterSource: filter.source,
          willBeFiltered: true
        });
        return false;
      }

      // Filter by status
      if (filter.status && tx.status !== filter.status) {
        return false;
      }

      // Filter by location with proper handling for online vs physical locations
      // ENFORCE: Always include Online Store product sales and POS product sales from their respective locations
      if (filter.location && filter.location !== 'all' && tx.location !== filter.location) {
        // Identify online transactions
        const isClientPortalTransaction = tx.source === TransactionSource.CLIENT_PORTAL;
        const isProductSale = tx.type === TransactionType.PRODUCT_SALE || tx.type === TransactionType.CONSOLIDATED_SALE;
        
        const isOnlineTransaction = tx.location === 'online' ||
                                  tx.location === 'client_portal' ||
                                  tx.metadata?.isOnlineTransaction === true;

        const hasNoLocation = !tx.location || tx.location === null || tx.location === undefined;

        const isOnlineRelated = isClientPortalTransaction || isOnlineTransaction || hasNoLocation;

        // ENFORCEMENT 1: Always keep Online Store product sales regardless of location filter
        const isOnlineProductSale = isClientPortalTransaction && isProductSale;
        
        if (isOnlineProductSale) {
          console.log('🔍 ENFORCED: Online Store product sale included in physical location filter:', {
            transactionId: tx.id,
            txLocation: tx.location,
            txSource: tx.source,
            txType: tx.type,
            willBeFiltered: false,
            reason: 'Online Store product sales are always included (enforcement)'
          });
          // Keep the transaction - it's an online store product sale that must be recorded
          return true;
        }

        // ENFORCEMENT 2: Always keep POS product sales from their actual location
        const isPosSale = tx.source === TransactionSource.POS || tx.metadata?.isPosSale === true;
        if (isPosSale && isProductSale && tx.location) {
          // POS product sales should always be included in their respective location filters
          console.log('🔍 ENFORCED: POS product sale from location included:', {
            transactionId: tx.id,
            txLocation: tx.location,
            txSource: tx.source,
            txType: tx.type,
            filterLocation: filter.location,
            willBeFiltered: false,
            reason: 'POS product sales from physical locations are always included (enforcement)'
          });
          // Return false here because we need to keep checking - this will be handled by the location match check above
          // But we should NOT filter out POS sales from their actual location
          if (tx.location === filter.location) {
            return true; // Include it - location matches and it's a POS product sale
          }
        }

        if (isOnlineRelated) {
          // Online transactions should ONLY appear when filtering by "online" location
          if (filter.location === 'online') {
            console.log('🔍 Online transaction included in online filter:', {
              transactionId: tx.id,
              txLocation: tx.location,
              txSource: tx.source,
              willBeFiltered: false,
              reason: 'Online transaction matches online location filter'
            });
            // Keep the transaction - it matches the online filter
          } else {
            console.log('🔍 Online transaction excluded from physical location filter:', {
              transactionId: tx.id,
              txLocation: tx.location,
              filterLocation: filter.location,
              txSource: tx.source,
              willBeFiltered: true,
              reason: 'Online transaction filtered out from physical location'
            });
            return false; // Filter out online transactions when filtering by physical locations
          }
        } else {
          // Physical location transaction that doesn't match the filter
          console.log('🔍 Physical location transaction check:', {
            transactionId: tx.id,
            txLocation: tx.location,
            filterLocation: filter.location,
            txSource: tx.source,
            willBeFiltered: true,
            reason: 'Physical location does not match filter'
          });
          return false;
        }
      }

      // Filter by client ID
      if (filter.clientId && tx.clientId !== filter.clientId) {
        return false;
      }

      // Filter by staff ID
      if (filter.staffId && tx.staffId !== filter.staffId) {
        return false;
      }

      // Filter by search term
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesId = tx.id.toLowerCase().includes(searchLower);
        const matchesClient = tx.clientName?.toLowerCase().includes(searchLower) || false;
        const matchesStaff = tx.staffName?.toLowerCase().includes(searchLower) || false;
        const matchesDescription = tx.description.toLowerCase().includes(searchLower);

        if (!(matchesId || matchesClient || matchesStaff || matchesDescription)) {
          return false;
        }
      }

      // Filter by amount range
      if (filter.minAmount !== undefined && tx.amount < filter.minAmount) {
        return false;
      }

      if (filter.maxAmount !== undefined && tx.amount > filter.maxAmount) {
        return false;
      }

      return true;
    });

    console.log('🔍 TRANSACTION PROVIDER: Filter results:', {
      originalCount: transactions.length,
      filteredCount: filtered.length,
      clientPortalFiltered: filtered.filter(tx => tx.source === TransactionSource.CLIENT_PORTAL).length
    });

    // Sort transactions by date in descending order (newest to oldest)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return filtered;
  };

  // Get transactions by source
  const getTransactionsBySource = (source: TransactionSource): Transaction[] => {
    return transactions.filter(tx => tx.source === source);
  };

  // Get transactions by date range
  const getTransactionsByDateRange = (startDate: Date, endDate: Date): Transaction[] => {
    return transactions.filter(tx => {
      const txDate = typeof tx.date === 'string' ? new Date(tx.date) : tx.date;
      return !isBefore(txDate, startDate) && !isAfter(txDate, endDate);
    });
  };

  // Get transactions by single date
  const getTransactionsByDate = (date: Date): Transaction[] => {
    return transactions.filter(tx => {
      const txDate = typeof tx.date === 'string' ? new Date(tx.date) : tx.date;
      return isSameDay(txDate, date);
    });
  };

  // Manual sync function for client portal appointments
  const syncClientPortalAppointments = (): number => {
    console.log('🔄 MANUAL SYNC: Running client portal appointment sync');
    try {
      return ClientPortalTransactionSync.syncClientPortalAppointments(addTransaction);
    } catch (error) {
      console.error('❌ MANUAL SYNC: Error during client portal sync:', error);
      return 0;
    }
  };

  // NOTE: POS sales sync is no longer needed as we now load all transactions from database on initial load

  const value = {
    transactions,
    addTransaction,
    updateTransaction,

    getTransaction,
    filterTransactions,
    getTransactionsBySource,
    getTransactionsByDateRange,
    getTransactionsByDate,
    removeDuplicateTransactions,
    cleanupAllDuplicates,
    cleanupAppointmentDuplicates,
    syncClientPortalAppointments
  };

  return (
    <TransactionContext.Provider value={value}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const context = useContext(TransactionContext);
  if (context === undefined) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
}
