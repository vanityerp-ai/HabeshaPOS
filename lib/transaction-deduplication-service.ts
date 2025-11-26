"use client"

import { Transaction, TransactionType, TransactionSource, TransactionStatus } from "./transaction-types"

/**
 * Service to handle transaction deduplication and prevent duplicate revenue recording
 */
export class TransactionDeduplicationService {
  private static instance: TransactionDeduplicationService
  private processedTransactions: Set<string> = new Set()
  private appointmentTransactions: Map<string, Transaction> = new Map()
  private orderTransactions: Map<string, Transaction> = new Map()

  private constructor() {
    // Only load from localStorage on client side
    if (typeof window !== 'undefined') {
      this.loadProcessedTransactions()
    }
  }

  public static getInstance(): TransactionDeduplicationService {
    if (!TransactionDeduplicationService.instance) {
      TransactionDeduplicationService.instance = new TransactionDeduplicationService()
    }
    return TransactionDeduplicationService.instance
  }

  /**
   * Check if a transaction should be recorded (prevents duplicates)
   */
  public shouldRecordTransaction(transaction: Transaction): boolean {
    // Handle server-side rendering
    if (typeof window === 'undefined') {
      return true // Allow recording on server side
    }

    // For POS transactions without reference IDs, always allow (they have unique timestamp-based IDs)
    if (transaction.source === TransactionSource.POS && !transaction.reference?.id) {
      console.log(`✅ DEDUPLICATION: POS transaction ${transaction.id} approved (no reference ID)`)
      return true
    }

    // Check if transaction is already processed
    if (this.processedTransactions.has(transaction.id)) {
      console.log(`🔄 DEDUPLICATION: Transaction ${transaction.id} already processed, skipping`)
      return false
    }

    // Check for duplicate appointment transactions
    if (transaction.reference?.type === 'appointment' && transaction.reference?.id) {
      const appointmentId = transaction.reference.id
      const existingTransaction = this.appointmentTransactions.get(appointmentId)
      
      if (existingTransaction) {
        // Check if the existing transaction is recent (within the last hour)
        const existingTime = new Date(existingTransaction.createdAt).getTime()
        const currentTime = new Date().getTime()
        const timeDiff = currentTime - existingTime
        const oneHour = 60 * 60 * 1000 // 1 hour in milliseconds
        
        if (timeDiff < oneHour) {
          console.log(`🔄 DEDUPLICATION: Recent duplicate appointment transaction for ${appointmentId} (${timeDiff}ms ago), skipping`)
          return false
        } else {
          console.log(`✅ DEDUPLICATION: Old appointment transaction for ${appointmentId} (${timeDiff}ms ago), allowing new transaction`)
          // Remove the old transaction and allow the new one
          this.appointmentTransactions.delete(appointmentId)
        }
      }
      
      // Mark this appointment as processed
      this.appointmentTransactions.set(appointmentId, transaction)
    }

    // Check for duplicate order transactions
    if (transaction.reference?.type === 'order' && transaction.reference?.id) {
      const orderId = transaction.reference.id
      const existingTransaction = this.orderTransactions.get(orderId)
      
      if (existingTransaction) {
        console.log(`🔄 DEDUPLICATION: Duplicate order transaction for ${orderId}, skipping`)
        return false
      }
      
      // Mark this order as processed
      this.orderTransactions.set(orderId, transaction)
    }

    // Check for home service appointment duplicates
    if (transaction.metadata?.location === 'home' && transaction.metadata?.appointmentId) {
      const appointmentId = transaction.metadata.appointmentId
      const existingTransaction = this.appointmentTransactions.get(appointmentId)
      
      if (existingTransaction) {
        console.log(`🔄 DEDUPLICATION: Duplicate home service transaction for ${appointmentId}, skipping`)
        return false
      }
      
      // Mark this appointment as processed
      this.appointmentTransactions.set(appointmentId, transaction)
    }

    // Mark transaction as processed (only on client side)
    if (typeof window !== 'undefined') {
      this.processedTransactions.add(transaction.id)
      this.saveProcessedTransactions()
    }
    
    console.log(`✅ DEDUPLICATION: Transaction ${transaction.id} approved for recording`)
    return true
  }

  /**
   * Get deduplicated transactions from a list
   */
  public getDeduplicatedTransactions(transactions: Transaction[]): Transaction[] {
    const deduplicated: Transaction[] = []
    const seenAppointments = new Set<string>()
    const seenOrders = new Set<string>()

    for (const transaction of transactions) {
      let shouldInclude = true

      // Check for duplicate appointment transactions
      if (transaction.reference?.type === 'appointment' && transaction.reference?.id) {
        const appointmentId = transaction.reference.id
        if (seenAppointments.has(appointmentId)) {
          shouldInclude = false
        } else {
          seenAppointments.add(appointmentId)
        }
      }

      // Check for duplicate order transactions
      if (transaction.reference?.type === 'order' && transaction.reference?.id) {
        const orderId = transaction.reference.id
        if (seenOrders.has(orderId)) {
          shouldInclude = false
        } else {
          seenOrders.add(orderId)
        }
      }

      // Check for home service appointment duplicates
      if (transaction.metadata?.location === 'home' && transaction.metadata?.appointmentId) {
        const appointmentId = transaction.metadata.appointmentId
        if (seenAppointments.has(appointmentId)) {
          shouldInclude = false
        } else {
          seenAppointments.add(appointmentId)
        }
      }

      if (shouldInclude) {
        deduplicated.push(transaction)
      }
    }

    return deduplicated
  }

  /**
   * Calculate revenue breakdown for a transaction
   */
  public calculateRevenueBreakdown(transaction: Transaction): {
    serviceRevenue: number
    productRevenue: number
    originalAmount: number
    finalAmount: number
    discountAmount: number
  } {
    let serviceRevenue = 0
    let productRevenue = 0
    let originalAmount = 0
    let finalAmount = transaction.amount
    let discountAmount = 0

    if (transaction.type === TransactionType.CONSOLIDATED_SALE && transaction.items) {
      // Calculate service revenue
      serviceRevenue = transaction.items
        .filter(item => item.type === 'service')
        .reduce((sum, item) => sum + (item.totalPrice || 0), 0)

      // Calculate product revenue
      productRevenue = transaction.items
        .filter(item => item.type === 'product')
        .reduce((sum, item) => sum + (item.totalPrice || 0), 0)

      // Calculate original amount
      originalAmount = transaction.items.reduce((sum, item) => {
        if (item.type === 'service') {
          return sum + (item.originalPrice || item.totalPrice || 0)
        } else {
          return sum + (item.totalPrice || 0)
        }
      }, 0)

      // Calculate discount amount
      discountAmount = originalAmount - finalAmount
    } else if (transaction.type === TransactionType.SERVICE_SALE) {
      serviceRevenue = transaction.amount
      originalAmount = transaction.originalServiceAmount || transaction.amount
      discountAmount = originalAmount - finalAmount
    } else if (transaction.type === TransactionType.PRODUCT_SALE || transaction.type === TransactionType.INVENTORY_SALE) {
      productRevenue = transaction.amount
      originalAmount = transaction.amount
    } else {
      // For other transaction types, use the full amount
      originalAmount = transaction.amount
    }

    return {
      serviceRevenue,
      productRevenue,
      originalAmount,
      finalAmount,
      discountAmount
    }
  }

  /**
   * Validate transaction for proper revenue recording
   */
  public validateTransaction(transaction: Transaction): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check required fields
    if (!transaction.id) {
      errors.push('Transaction ID is required')
    }
    if (!transaction.amount || transaction.amount <= 0) {
      errors.push('Transaction amount must be greater than 0')
    }
    if (!transaction.type) {
      errors.push('Transaction type is required')
    }
    if (!transaction.status) {
      errors.push('Transaction status is required')
    }

    // Check for cancelled transactions
    if (transaction.status === TransactionStatus.CANCELLED) {
      errors.push('Cancelled transactions should not be recorded as revenue')
    }

    // Validate consolidated transactions
    if (transaction.type === TransactionType.CONSOLIDATED_SALE) {
      if (!transaction.items || transaction.items.length === 0) {
        errors.push('Consolidated transactions must have items')
      } else {
        const hasServices = transaction.items.some(item => item.type === 'service')
        const hasProducts = transaction.items.some(item => item.type === 'product')
        
        if (!hasServices && !hasProducts) {
          errors.push('Consolidated transactions must have at least one service or product')
        }
      }
    }

    // Validate discount information
    if (transaction.discountPercentage && transaction.discountPercentage < 0) {
      errors.push('Discount percentage cannot be negative')
    }
    if (transaction.discountAmount && transaction.discountAmount < 0) {
      errors.push('Discount amount cannot be negative')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Clear processed transactions (useful for testing)
   */
  public clearProcessedTransactions(): void {
    this.processedTransactions.clear()
    this.appointmentTransactions.clear()
    this.orderTransactions.clear()
    this.saveProcessedTransactions()
  }

  /**
   * Clear old transactions (older than 24 hours)
   */
  public clearOldTransactions(): void {
    const currentTime = new Date().getTime()
    const oneDay = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

    // Clear old appointment transactions
    for (const [appointmentId, transaction] of this.appointmentTransactions.entries()) {
      const transactionTime = new Date(transaction.createdAt).getTime()
      if (currentTime - transactionTime > oneDay) {
        this.appointmentTransactions.delete(appointmentId)
        console.log(`🧹 DEDUPLICATION: Cleared old appointment transaction for ${appointmentId}`)
      }
    }

    // Clear old order transactions
    for (const [orderId, transaction] of this.orderTransactions.entries()) {
      const transactionTime = new Date(transaction.createdAt).getTime()
      if (currentTime - transactionTime > oneDay) {
        this.orderTransactions.delete(orderId)
        console.log(`🧹 DEDUPLICATION: Cleared old order transaction for ${orderId}`)
      }
    }

    this.saveProcessedTransactions()
  }

  private loadProcessedTransactions(): void {
    // Only run on client side
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = localStorage.getItem('vanity_processed_transactions')
      if (stored) {
        const data = JSON.parse(stored)
        this.processedTransactions = new Set(data.processedTransactions || [])
        
        // Rebuild appointment and order maps
        this.appointmentTransactions.clear()
        this.orderTransactions.clear()
        
        if (data.appointmentTransactions) {
          Object.entries(data.appointmentTransactions).forEach(([id, transaction]) => {
            this.appointmentTransactions.set(id, transaction as Transaction)
          })
        }
        
        if (data.orderTransactions) {
          Object.entries(data.orderTransactions).forEach(([id, transaction]) => {
            this.orderTransactions.set(id, transaction as Transaction)
          })
        }
      }
    } catch (error) {
      console.error('Failed to load processed transactions:', error)
    }
  }

  private saveProcessedTransactions(): void {
    // Only run on client side
    if (typeof window === 'undefined') {
      return
    }

    try {
      const data = {
        processedTransactions: Array.from(this.processedTransactions),
        appointmentTransactions: Object.fromEntries(this.appointmentTransactions),
        orderTransactions: Object.fromEntries(this.orderTransactions)
      }
      localStorage.setItem('vanity_processed_transactions', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save processed transactions:', error)
    }
  }
}

// Export singleton instance
export const transactionDeduplicationService = TransactionDeduplicationService.getInstance() 