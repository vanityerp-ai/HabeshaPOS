"use client"

import {
  Transaction,
  TransactionItem,
  TransactionType
} from "./transaction-types"

/**
 * Find existing transactions for an appointment
 * 
 * @param transactions - All transactions to search through
 * @param appointmentId - The appointment ID to search for
 * @param bookingReference - Optional booking reference to search for
 * @returns Array of matching transactions
 */
export const getExistingTransactionsForAppointment = (
  transactions: Transaction[],
  appointmentId?: string,
  bookingReference?: string
): Transaction[] => {
  if (!appointmentId && !bookingReference) {
    console.log('⚠️ No appointment ID or booking reference provided for duplicate check');
    return [];
  }

  console.log(`🔍 Searching for existing transactions with appointmentId: ${appointmentId} or bookingReference: ${bookingReference}`);
  
  return transactions.filter(tx => {
    // Check by appointment reference
    if (appointmentId && tx.reference?.type === 'appointment' && tx.reference?.id === appointmentId) {
      console.log(`✅ Found match by appointment reference: ${tx.id}`);
      return true;
    }
    
    // Check by appointment ID in metadata
    if (appointmentId && tx.metadata?.appointmentId === appointmentId) {
      console.log(`✅ Found match by appointment ID in metadata: ${tx.id}`);
      return true;
    }

    // Check by booking reference
    if (bookingReference && tx.metadata?.bookingReference === bookingReference) {
      console.log(`✅ Found match by booking reference: ${tx.id}`);
      return true;
    }
    
    return false;
  });
};

/**
 * Calculate discount information for a transaction
 * 
 * @param originalAmount - The original amount before discount
 * @param discountedAmount - The amount after discount
 * @returns Object containing discount percentage and amount
 */
export const calculateDiscountInfo = (
  originalAmount: number,
  discountedAmount: number
): { discountPercentage: number; discountAmount: number } => {
  if (originalAmount <= 0) {
    console.warn('⚠️ Original amount must be greater than zero');
    return { discountPercentage: 0, discountAmount: 0 };
  }
  
  if (discountedAmount > originalAmount) {
    console.warn('⚠️ Discounted amount cannot be greater than original amount');
    return { discountPercentage: 0, discountAmount: 0 };
  }
  
  const discountAmount = originalAmount - discountedAmount;
  const discountPercentage = Math.round((discountAmount / originalAmount) * 100);
  
  return {
    discountPercentage,
    discountAmount
  };
};

/**
 * Calculate service and product amounts from transaction items
 * 
 * @param items - Transaction items
 * @returns Object containing service and product amounts
 */
export const calculateServiceAndProductAmounts = (
  items?: TransactionItem[]
): { serviceAmount: number; productAmount: number } => {
  if (!items || !Array.isArray(items)) {
    return { serviceAmount: 0, productAmount: 0 };
  }
  
  const serviceAmount = items
    .filter(item => item.type === 'service')
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  
  const productAmount = items
    .filter(item => item.type === 'product')
    .reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  
  return {
    serviceAmount,
    productAmount
  };
};

/**
 * Compare two transactions to determine if they are duplicates
 * 
 * @param tx1 - First transaction
 * @param tx2 - Second transaction
 * @returns Boolean indicating if they are duplicates
 */
export const areTransactionsDuplicates = (
  tx1: Transaction,
  tx2: Transaction
): boolean => {
  // Check for exact ID match
  if (tx1.id === tx2.id) {
    return true;
  }

  // Check for same appointment and transaction type
  if (tx1.reference?.type === 'appointment' && 
      tx2.reference?.type === 'appointment' && 
      tx1.reference.id === tx2.reference.id && 
      tx1.type === tx2.type) {
    return true;
  }
  
  // Check for same appointment ID in metadata
  if (tx1.metadata?.appointmentId && 
      tx2.metadata?.appointmentId && 
      tx1.metadata.appointmentId === tx2.metadata.appointmentId) {
    return true;
  }
  
  // Check for same booking reference
  if (tx1.metadata?.bookingReference && 
      tx2.metadata?.bookingReference && 
      tx1.metadata.bookingReference === tx2.metadata.bookingReference) {
    return true;
  }
  
  return false;
};

/**
 * Determine if a transaction is discounted
 * 
 * @param transaction - The transaction to check
 * @returns Boolean indicating if the transaction is discounted
 */
export const isTransactionDiscounted = (transaction: Transaction): boolean => {
  return !!(transaction.discountPercentage && transaction.discountPercentage > 0);
};

/**
 * Find the most appropriate transaction to keep from a group of duplicates
 * 
 * @param transactions - Array of duplicate transactions
 * @returns The transaction to keep
 */
export const findTransactionToKeep = (transactions: Transaction[]): Transaction => {
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions provided to findTransactionToKeep');
  }
  
  if (transactions.length === 1) {
    return transactions[0];
  }
  
  // First, check for transactions with discount information
  const discountedTransactions = transactions.filter(isTransactionDiscounted);
  
  if (discountedTransactions.length > 0) {
    // If there are multiple discounted transactions, keep the most recent one
    if (discountedTransactions.length > 1) {
      return discountedTransactions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
    }
    
    // Otherwise, keep the single discounted transaction
    return discountedTransactions[0];
  }
  
  // If no discounted transactions, check for different amounts
  const uniqueAmounts = new Set(transactions.map(tx => tx.amount));
  
  if (uniqueAmounts.size > 1) {
    // If there are different amounts, keep the one with the lowest amount (likely discounted)
    return transactions.sort((a, b) => a.amount - b.amount)[0];
  }
  
  // If all transactions have the same amount, keep the most recent one
  return transactions.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];
};

/**
 * Update a transaction with discount information
 * 
 * @param transaction - The transaction to update
 * @param originalAmount - The original amount before discount
 * @param discountedAmount - The amount after discount
 * @returns The updated transaction
 */
export const updateTransactionWithDiscountInfo = (
  transaction: Transaction,
  originalAmount: number,
  discountedAmount: number
): Transaction => {
  // Calculate discount information
  const { discountPercentage, discountAmount } = calculateDiscountInfo(originalAmount, discountedAmount);
  
  // Calculate service and product amounts
  let serviceAmount = transaction.serviceAmount || 0;
  let productAmount = transaction.productAmount || 0;
  
  // If service/product amounts aren't available, try to calculate from items
  if ((!serviceAmount || !productAmount) && transaction.items) {
    const amounts = calculateServiceAndProductAmounts(transaction.items);
    serviceAmount = serviceAmount || amounts.serviceAmount;
    productAmount = productAmount || amounts.productAmount;
  }
  
  // Create an updated transaction with discount information
  const updatedTransaction: Transaction = {
    ...transaction,
    amount: discountedAmount,
    serviceAmount: serviceAmount,
    productAmount: productAmount,
    originalServiceAmount: originalAmount - productAmount,
    discountPercentage: discountPercentage,
    discountAmount: discountAmount,
    updatedAt: new Date()
  };
  
  // Update description to include discount information if not already present
  if (!updatedTransaction.description.includes('% off')) {
    updatedTransaction.description += ` (${discountPercentage}% off)`;
  }
  
  return updatedTransaction;
};

/**
 * Group transactions by appointment ID or booking reference
 * 
 * @param transactions - All transactions to group
 * @returns Map of transaction groups
 */
export const groupTransactionsByAppointment = (
  transactions: Transaction[]
): Map<string, Transaction[]> => {
  const transactionGroups = new Map<string, Transaction[]>();
  
  transactions.forEach(tx => {
    let groupKey = null;
    
    // Try to get a unique identifier for this transaction
    if (tx.reference?.type === 'appointment' && tx.reference?.id) {
      groupKey = `appointment-${tx.reference.id}`;
    } else if (tx.metadata?.appointmentId) {
      groupKey = `appointment-${tx.metadata.appointmentId}`;
    } else if (tx.metadata?.bookingReference) {
      groupKey = `booking-${tx.metadata.bookingReference}`;
    }
    
    // If we found a group key, add this transaction to its group
    if (groupKey) {
      if (!transactionGroups.has(groupKey)) {
        transactionGroups.set(groupKey, []);
      }
      transactionGroups.get(groupKey)?.push(tx);
    }
  });
  
  return transactionGroups;
};

/**
 * Determine the appropriate transaction type based on transaction data
 * 
 * @param transaction - The transaction data
 * @returns The appropriate transaction type
 */
export const determineTransactionType = (transaction: Transaction): TransactionType => {
  let transactionType = transaction.type;
  
  // Auto-correct service sales based on description
  if (transaction.description && 
      (transaction.description.toLowerCase().includes('haircut') ||
       transaction.description.toLowerCase().includes('color') ||
       transaction.description.toLowerCase().includes('style') ||
       transaction.description.toLowerCase().includes('manicure') ||
       transaction.description.toLowerCase().includes('pedicure') ||
       transaction.description.toLowerCase().includes('facial') ||
       transaction.description.toLowerCase().includes('massage')) && 
      transactionType === TransactionType.INCOME) {
    
    transactionType = TransactionType.SERVICE_SALE;
  }

  // Auto-correct consolidated sales based on items
  if (transaction.items && 
      Array.isArray(transaction.items) && 
      transaction.items.some(item => item.type === 'service') &&
      transaction.items.some(item => item.type === 'product')) {
    
    transactionType = TransactionType.CONSOLIDATED_SALE;
  }
  
  return transactionType;
};

/**
 * Generate a transaction ID with a given prefix and 8-digit random number
 * @param prefix e.g. 'PX-', 'AP-', 'CP-'
 */
export function generateTransactionIdWithPrefix(prefix: string): string {
  const num = Math.floor(Math.random() * 100000000); // 0 to 99999999
  const numStr = num.toString().padStart(8, '0');
  return `${prefix}${numStr}`;
}

// Global sequential transaction ID generator with timestamp to ensure uniqueness
let transactionSequence = 1;
let lastTimestamp = Date.now();

export function generateSequentialTransactionId(prefix: string = 'TX-'): string {
  const currentTimestamp = Date.now();
  
  // Reset sequence if more than 1 second has passed (ensures uniqueness across page reloads)
  if (currentTimestamp !== lastTimestamp) {
    lastTimestamp = currentTimestamp;
    transactionSequence = 1;
  }
  
  // Use timestamp + sequence to create a unique ID that won't conflict
  // Format: TX-{timestamp}-{sequence}
  const id = `${prefix}${currentTimestamp}-${transactionSequence}`;
  transactionSequence++;
  return id;
}
