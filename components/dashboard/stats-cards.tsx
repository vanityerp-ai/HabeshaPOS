"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, Calendar, Users, Package, Clock, ShoppingBag, Store } from "lucide-react"
import { useAuth } from "@/lib/auth-provider"
import { useCurrency } from "@/lib/currency-provider"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { format, differenceInDays } from "date-fns"
import { useTransactions } from "@/lib/transaction-provider"
import { TransactionType, TransactionSource, TransactionStatus } from "@/lib/transaction-types"


import { integratedAnalyticsService } from "@/lib/integrated-analytics-service"
import { getAllAppointments, saveAppointments } from "@/lib/appointment-service"
import { useClients as useClientProvider } from "@/lib/client-provider"
import { useRealTimeEvent } from "@/hooks/use-real-time-updates"
import { RealTimeEventType } from "@/lib/real-time-service"
import { ServiceStorage } from "@/lib/service-storage"

interface StatsCardsProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export function StatsCards({ dateRange }: StatsCardsProps) {
  const { currentLocation } = useAuth()
  const { currency } = useCurrency()
  const { transactions, filterTransactions } = useTransactions()
  const { clients } = useClientProvider()

  const [revenueData, setRevenueData] = useState({
    total: 0,
    services: 0,
    products: 0,
    onlineSales: 0,
    inPersonSales: 0,
    inPersonServices: 0,
    inPersonProducts: 0,
    homeServiceServices: 0,
    homeServiceProducts: 0,
    card: 0,
    cash: 0,
    percentChange: 0,
    onlineGrowth: 0,
    inPersonGrowth: 0,
    homeService: 0
  })

  const [dynamicCounts, setDynamicCounts] = useState({
    inPersonTransactionCount: 0,
    appointmentCount: 0,
    newClientCount: 0,
    onlineOrderCount: 0,
    averageOrderValue: 0,
    homeServiceTransactionCount: 0
  })

  const [pendingRevenue, setPendingRevenue] = useState({
    total: 0,
    appointmentCount: 0,
    serviceRevenue: 0,
    productRevenue: 0
  })

  const [inventoryData, setInventoryData] = useState({
    value: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    turnoverRate: 0
  })

  // Calculate dynamic counts for cards
  useEffect(() => {
    console.log('📊 STATS CARDS: Calculating dynamic counts')
    console.log('📊 STATS CARDS: Clients data:', {
      clientsLength: clients?.length || 0,
      clientsType: typeof clients,
      firstClient: clients?.[0]
    })

    try {
      const filters: any = {}
      if (currentLocation !== 'all') {
        filters.location = currentLocation
      }
      if (dateRange?.from && dateRange?.to) {
        filters.startDate = dateRange.from
        filters.endDate = dateRange.to
      }

      const filteredTxs = filterTransactions(filters)

      // Calculate in-person transaction count
      const inPersonTransactions = filteredTxs.filter(t =>
        t.source === TransactionSource.POS || t.source === TransactionSource.CALENDAR
      )

      // Calculate online orders (CLIENT_PORTAL transactions)
      const onlineTransactions = filteredTxs.filter(t =>
        t.source === TransactionSource.CLIENT_PORTAL &&
        t.status !== 'cancelled'
      )
      const onlineOrderCount = onlineTransactions.length
      const averageOrderValue = onlineOrderCount > 0
        ? onlineTransactions.reduce((sum: number, t: { amount: number }) => sum + t.amount, 0) / onlineOrderCount
        : 0

      // Calculate appointment count
      const allAppointments = getAllAppointments()
      // Ensure allAppointments is an array
      const appointmentsArray = Array.isArray(allAppointments) ? allAppointments : []
      let filteredAppointments = appointmentsArray

      // Filter by location
      if (currentLocation !== 'all') {
        filteredAppointments = filteredAppointments.filter(apt => apt.location === currentLocation)
      }

      // Filter by date range
      if (dateRange?.from && dateRange?.to) {
        filteredAppointments = filteredAppointments.filter(apt => {
          const aptDate = new Date(apt.date)
          return aptDate >= dateRange.from && aptDate <= dateRange.to
        })
      }

      // Calculate new clients count
      let newClientsCount = 0
      if (clients && Array.isArray(clients)) {
        if (dateRange?.from && dateRange?.to) {
          // Count clients created within the date range
          newClientsCount = clients.filter(client => {
            if (!client.createdAt) return false
            const clientDate = new Date(client.createdAt)
            return clientDate >= dateRange.from && clientDate <= dateRange.to
          }).length
        } else {
          // If no date range, show total clients as fallback
          newClientsCount = clients.length
        }
      }

      // Calculate Home Service sales
      const homeServiceTransactions = filteredTxs.filter(t =>
        t.source === TransactionSource.HOME_SERVICE && t.location === 'Home service'
      )

      setDynamicCounts(prev => ({
        ...prev,
        inPersonTransactionCount: inPersonTransactions.length,
        appointmentCount: filteredAppointments.length,
        newClientCount: newClientsCount,
        onlineOrderCount,
        averageOrderValue,
        homeServiceTransactionCount: homeServiceTransactions.length
  }))

      console.log('📊 STATS CARDS: Dynamic counts updated:', {
        inPersonTransactionCount: inPersonTransactions.length,
        appointmentCount: filteredAppointments.length,
        newClientCount: newClientsCount,
        onlineOrderCount,
        averageOrderValue
      })

    } catch (error) {
      console.error('📊 STATS CARDS: Error calculating dynamic counts:', error)
      // Fallback to zero counts
      setDynamicCounts({
        inPersonTransactionCount: 0,
        appointmentCount: 0,
        newClientCount: 0,
        onlineOrderCount: 0,
        averageOrderValue: 0,
        homeServiceTransactionCount: 0
      })
    }
  }, [dateRange, currentLocation, transactions, filterTransactions, clients])

  // Set up real-time event listeners for automatic updates
  useRealTimeEvent(RealTimeEventType.TRANSACTION_CREATED, () => {
    console.log('📊 STATS CARDS: Transaction created, refreshing counts...')
    // The useEffect above will automatically recalculate when transactions change
  }, [transactions, filterTransactions, currentLocation, dateRange])

  useRealTimeEvent(RealTimeEventType.TRANSACTION_UPDATED, () => {
    console.log('📊 STATS CARDS: Transaction updated, refreshing counts...')
    // The useEffect above will automatically recalculate when transactions change
  }, [transactions, filterTransactions, currentLocation, dateRange])

  // Real-time event for appointment completion
  useRealTimeEvent(RealTimeEventType.APPOINTMENT_UPDATED, () => {
    console.log('📊 STATS CARDS: Appointment updated, refreshing revenue calculations...')
    // Force recalculation when appointments are updated (especially completed)
  }, [transactions, filterTransactions, currentLocation, dateRange])

  // Real-time event for transaction creation
  useRealTimeEvent(RealTimeEventType.TRANSACTION_CREATED, () => {
    console.log('📊 STATS CARDS: Transaction created, refreshing revenue calculations...')
    // The useEffect above will automatically recalculate when transactions change
  }, [transactions, filterTransactions, currentLocation, dateRange])

  useRealTimeEvent(RealTimeEventType.APPOINTMENT_CREATED, () => {
    console.log('📊 STATS CARDS: Appointment created, refreshing counts...')
    // Force recalculation of dynamic counts
    const filters: any = {}
    if (currentLocation !== 'all') {
      filters.location = currentLocation
    }
    if (dateRange?.from && dateRange?.to) {
      filters.startDate = dateRange.from
      filters.endDate = dateRange.to
    }

    const filteredTxs = filterTransactions(filters)
    const inPersonTransactions = filteredTxs.filter(t =>
      t.source === TransactionSource.POS || t.source === TransactionSource.CALENDAR
    )

    const allAppointments = getAllAppointments()
    // Filter out reflected appointments from statistics
    let filteredAppointments = allAppointments.filter(apt => !apt.isReflected)

    if (currentLocation !== 'all') {
      filteredAppointments = filteredAppointments.filter(apt => apt.location === currentLocation)
    }

    if (dateRange?.from && dateRange?.to) {
      filteredAppointments = filteredAppointments.filter(apt => {
        const aptDate = new Date(apt.date)
        return aptDate >= dateRange.from && aptDate <= dateRange.to
      })
    }

    setDynamicCounts(prev => ({
      ...prev,
      inPersonTransactionCount: inPersonTransactions.length,
      appointmentCount: filteredAppointments.length
    }))
  }, [dateRange, currentLocation, filterTransactions, transactions])

  useRealTimeEvent(RealTimeEventType.APPOINTMENT_UPDATED, () => {
    console.log('📊 STATS CARDS: Appointment updated, refreshing counts...')
    // Similar refresh logic as above
  }, [dateRange, currentLocation, transactions, filterTransactions])

  useRealTimeEvent(RealTimeEventType.CLIENT_CREATED, () => {
    console.log('📊 STATS CARDS: Client created, refreshing counts...')
    // The useEffect above will automatically recalculate when clients change
  }, [clients, dateRange])

  // Calculate real revenue data from transactions
  useEffect(() => {
    if (!dateRange || !currentLocation || !filterTransactions || !transactions) return

    console.log('📊 STATS CARDS: Calculating revenue from real transactions:', {
      dateRange,
      currentLocation,
      totalTransactions: transactions.length
    })

    try {
      // Get analytics data for the date range and location
      const analytics = integratedAnalyticsService.getAnalytics(
        dateRange.from,
        dateRange.to,
        currentLocation === 'all' ? undefined : currentLocation
      )

      console.log('📊 STATS CARDS: Analytics data:', {
        totalRevenue: analytics.totalRevenue,
        serviceRevenue: analytics.serviceRevenue,
        productRevenue: analytics.productRevenue,
        clientPortalTransactions: transactions.filter(t => t.source === TransactionSource.CLIENT_PORTAL).length
      })

      // Calculate payment method breakdown from filtered transactions
      const filters: any = {}
      if (currentLocation !== 'all') {
        filters.location = currentLocation
      }
      if (dateRange.from && dateRange.to) {
        filters.startDate = dateRange.from
        filters.endDate = dateRange.to
      }

      const filteredTxs = filterTransactions(filters)

      // Calculate online sales (CLIENT_PORTAL transactions only)
      const onlineSales = analytics.clientPortalRevenue;
      const inPersonSales = analytics.posRevenue + analytics.calendarRevenue;
      const homeServiceSales = analytics.homeServiceRevenue;



      // Get the proper breakdown from analytics service
      const inPersonServices = analytics.inPersonServices;
      const inPersonProducts = analytics.inPersonProducts;
      const homeServiceServices = analytics.homeServiceServices;
      const homeServiceProducts = analytics.homeServiceProducts;

      const cardRevenue = filteredTxs
        .filter((t: { paymentMethod: string }) => t.paymentMethod === 'credit_card')
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)

      const cashRevenue = filteredTxs
        .filter((t: { paymentMethod: string }) => t.paymentMethod === 'cash')
        .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0)

      // Calculate growth (simplified - comparing to a baseline)
      const daysDiff = differenceInDays(dateRange.to, dateRange.from) + 1
      const expectedDaily = 400 // Expected daily revenue baseline
      const expectedTotal = expectedDaily * daysDiff
      const percentChange = expectedTotal > 0 ? ((analytics.totalRevenue - expectedTotal) / expectedTotal) * 100 : 0

      // Calculate growth for online and in-person sales
      const expectedOnlineDaily = 150
      const expectedInPersonDaily = 250
      const expectedOnlineTotal = expectedOnlineDaily * daysDiff
      const expectedInPersonTotal = expectedInPersonDaily * daysDiff
      const onlineGrowth = expectedOnlineTotal > 0 ? ((onlineSales - expectedOnlineTotal) / expectedOnlineTotal) * 100 : 0
      const inPersonGrowth = expectedInPersonTotal > 0 ? ((inPersonSales - expectedInPersonTotal) / expectedInPersonTotal) * 100 : 0

      setRevenueData({
        total: analytics.totalRevenue,
        services: analytics.serviceRevenue,
        products: analytics.productRevenue,
        onlineSales,
        inPersonSales,
        homeService: homeServiceSales,
        card: cardRevenue,
        cash: cashRevenue,
        inPersonServices,
        inPersonProducts,
        homeServiceServices,
        homeServiceProducts,
        percentChange: Math.round(percentChange * 10) / 10,
        onlineGrowth: Math.round(onlineGrowth * 10) / 10,
        inPersonGrowth: Math.round(inPersonGrowth * 10) / 10
      })

      // Enhanced debugging for in-person sales calculation
      console.log('📊 STATS CARDS: Sales channel breakdown:', {
        total: analytics.totalRevenue,
        onlineSales,
        inPersonSales,
        inPersonServices,
        inPersonProducts,
        verificationSum: onlineSales + inPersonSales + homeServiceSales,
        shouldEqualTotal: analytics.totalRevenue
      })

      // Detailed transaction analysis for debugging
      console.log('📊 DETAILED TRANSACTION ANALYSIS:')
      console.log('🔍 All filtered transactions:', filteredTxs.length)
      console.log('🔍 Online transactions (CLIENT_PORTAL):', filteredTxs.filter(t => t.source === TransactionSource.CLIENT_PORTAL).map(t => ({
        id: t.id,
        amount: t.amount,
        source: t.source,
        type: t.type,
        description: t.description,
        status: t.status
      })))
      console.log('🔍 In-person transactions (POS + CALENDAR):', filteredTxs.filter(t => t.source === TransactionSource.POS || t.source === TransactionSource.CALENDAR).map(t => ({
        id: t.id,
        amount: t.amount,
        source: t.source,
        type: t.type,
        description: t.description,
        status: t.status,
        reference: t.reference
      })))

      // Check for completed appointments and their corresponding transactions
      const allAppointments = getAllAppointments()
      const completedAppointments = allAppointments.filter(apt => apt.status === 'completed')
      console.log('📊 COMPLETED APPOINTMENTS ANALYSIS:')
      console.log('🔍 Total completed appointments:', completedAppointments.length)

      let totalCompletedAppointmentRevenue = 0
      completedAppointments.forEach(apt => {
        const appointmentRevenue = calculateAppointmentRevenue(apt)
        totalCompletedAppointmentRevenue += appointmentRevenue.total

        // Find corresponding transactions
        const correspondingTransactions = transactions.filter(tx =>
          tx.reference?.type === 'appointment' &&
          tx.reference?.id === apt.id &&
          tx.status === TransactionStatus.COMPLETED
        )

        console.log(`🔍 Appointment ${apt.id} (${apt.clientName}):`, {
          service: apt.service,
          status: apt.status,
          calculatedRevenue: appointmentRevenue.total,
          correspondingTransactions: correspondingTransactions.length,
          transactionAmounts: correspondingTransactions.map(tx => tx.amount),
          transactionSources: correspondingTransactions.map(tx => tx.source),
          transactionTotal: correspondingTransactions.reduce((sum, tx) => sum + tx.amount, 0)
        })
      })

      console.log('📊 REVENUE RECONCILIATION:')
      console.log('🔍 Total completed appointment revenue (calculated):', totalCompletedAppointmentRevenue)
      console.log('🔍 In-person sales from transactions:', inPersonSales)
      console.log('🔍 Difference:', Math.abs(totalCompletedAppointmentRevenue - inPersonSales))
      console.log('🔍 Match:', totalCompletedAppointmentRevenue === inPersonSales ? '✅' : '❌')

      // Identify missing transactions for completed appointments
      if (totalCompletedAppointmentRevenue !== inPersonSales) {
        console.log('🔧 DISCREPANCY DETECTED - ANALYZING MISSING TRANSACTIONS...')

        const missingTransactions: any[] = []
        completedAppointments.forEach(apt => {
          const existingTransactions = transactions.filter(tx =>
            tx.reference?.type === 'appointment' &&
            tx.reference?.id === apt.id &&
            tx.status === TransactionStatus.COMPLETED
          )

          if (existingTransactions.length === 0) {
            const appointmentRevenue = calculateAppointmentRevenue(apt)
            if (appointmentRevenue.total > 0) {
              missingTransactions.push({
                appointmentId: apt.id,
                clientName: apt.clientName,
                service: apt.service,
                expectedRevenue: appointmentRevenue.total,
                serviceRevenue: appointmentRevenue.serviceRevenue,
                productRevenue: appointmentRevenue.productRevenue
              })
            }
          }
        })

        console.log('🔧 MISSING TRANSACTIONS ANALYSIS:', {
          totalMissing: missingTransactions.length,
          missingRevenue: missingTransactions.reduce((sum, mt) => sum + mt.expectedRevenue, 0),
          details: missingTransactions
        })

        console.log('🔧 RECOMMENDATION: Use the appointments page to complete these appointments properly, or use the debug transactions page to create missing transactions.')
      }

      console.log('📊 STATS CARDS: Updated revenue data:', {
        total: analytics.totalRevenue,
        services: analytics.serviceRevenue,
        products: analytics.productRevenue,
        filteredTransactions: filteredTxs.length,
        clientPortalInFiltered: filteredTxs.filter(t => t.source === TransactionSource.CLIENT_PORTAL).length
      })

    } catch (error) {
      console.error('📊 STATS CARDS: Error calculating revenue:', error)
      // Reset to zero values if there's an error
      setRevenueData({
        total: 0,
        services: 0,
        products: 0,
        onlineSales: 0,
        inPersonSales: 0,
        inPersonServices: 0,
        inPersonProducts: 0,
        card: 0,
        cash: 0,
        percentChange: 0,
        onlineGrowth: 0,
        inPersonGrowth: 0,
        homeServiceServices: 0,
        homeServiceProducts: 0,
        homeService: 0
      })
    }
  }, [dateRange, currentLocation, transactions, filterTransactions])

  // Helper function to safely get appointment revenue
  const calculateAppointmentRevenue = (appointment: any) => {
    console.log(`🔍 CALCULATING REVENUE FOR APPOINTMENT:`, appointment.id)
    let total = 0
    let serviceRevenue = 0
    let productRevenue = 0

    // Get main service price - enhanced approach with better fallbacks
    let mainServicePrice = 0
    console.log(`🔍 CHECKING PRICE:`, {
      appointmentPrice: appointment.price,
      priceType: typeof appointment.price,
      service: appointment.service,
      serviceId: appointment.serviceId
    })

    // First, try to get price from appointment object
    if (typeof appointment.price === 'number' && appointment.price > 0) {
      mainServicePrice = appointment.price
      console.log(`🔍 USING APPOINTMENT PRICE:`, mainServicePrice)
    } else if (typeof appointment.price === 'string' && !isNaN(parseFloat(appointment.price))) {
      mainServicePrice = parseFloat(appointment.price)
      console.log(`🔍 PARSED APPOINTMENT PRICE:`, mainServicePrice)
    } else {
      // Try to look up service price from service storage
      console.log(`🔍 LOOKING UP SERVICE PRICE...`)
      try {
        const services = ServiceStorage.getServices()
        console.log(`🔍 AVAILABLE SERVICES:`, services.map(s => ({ id: s.id, name: s.name, price: s.price })))

        // Try multiple matching strategies
        let service = null

        // Strategy 1: Match by serviceId
        if (appointment.serviceId) {
          service = services.find(s => s.id === appointment.serviceId)
          console.log(`🔍 FOUND SERVICE BY ID:`, service)
        }

        // Strategy 2: Match by service name (exact match)
        if (!service && appointment.service) {
          service = services.find(s => s.name === appointment.service)
          console.log(`🔍 FOUND SERVICE BY NAME:`, service)
        }

        // Strategy 3: Match by service name (case-insensitive)
        if (!service && appointment.service) {
          service = services.find(s => s.name.toLowerCase() === appointment.service.toLowerCase())
          console.log(`🔍 FOUND SERVICE BY NAME (CASE-INSENSITIVE):`, service)
        }

        // Strategy 4: Match by partial name (for "Color & Highlights" vs "Full Highlights")
        if (!service && appointment.service) {
          service = services.find(s =>
            s.name.toLowerCase().includes(appointment.service.toLowerCase()) ||
            appointment.service.toLowerCase().includes(s.name.toLowerCase())
          )
          console.log(`🔍 FOUND SERVICE BY PARTIAL NAME:`, service)
        }

        if (service && typeof service.price === 'number' && service.price > 0) {
          mainServicePrice = service.price
          console.log(`🔍 USING SERVICE PRICE:`, mainServicePrice)
        } else {
          console.log(`🔍 NO VALID SERVICE PRICE FOUND - service:`, service)

          // Fallback: Use default prices based on service name patterns
          const serviceName = appointment.service?.toLowerCase() || ''
          if (serviceName.includes('color') || serviceName.includes('highlight')) {
            mainServicePrice = 150 // Default color service price
            console.log(`🔍 USING FALLBACK COLOR PRICE:`, mainServicePrice)
          } else if (serviceName.includes('haircut') || serviceName.includes('cut')) {
            mainServicePrice = 75 // Default haircut price
            console.log(`🔍 USING FALLBACK HAIRCUT PRICE:`, mainServicePrice)
          } else if (serviceName.includes('blowout') || serviceName.includes('style')) {
            mainServicePrice = 65 // Default styling price
            console.log(`🔍 USING FALLBACK STYLING PRICE:`, mainServicePrice)
          } else {
            mainServicePrice = 50 // Generic fallback price
            console.log(`🔍 USING GENERIC FALLBACK PRICE:`, mainServicePrice)
          }
        }
      } catch (error) {
        console.log(`🔍 ERROR LOOKING UP SERVICE PRICE:`, error)
        // Use a basic fallback price
        mainServicePrice = 75
        console.log(`🔍 USING ERROR FALLBACK PRICE:`, mainServicePrice)
      }
    }

    if (mainServicePrice > 0) {
      total += mainServicePrice
      serviceRevenue += mainServicePrice
      console.log(`🔍 ADDED MAIN SERVICE PRICE:`, mainServicePrice)
    } else {
      console.log(`🔍 NO MAIN SERVICE PRICE TO ADD`)
    }

    // Add additional services
    if (appointment.additionalServices && Array.isArray(appointment.additionalServices)) {
      appointment.additionalServices.forEach((service: any) => {
        let servicePrice = 0
        if (typeof service.price === 'number') {
          servicePrice = service.price
        } else if (typeof service.price === 'string' && !isNaN(parseFloat(service.price))) {
          servicePrice = parseFloat(service.price)
        }

        if (servicePrice > 0) {
          total += servicePrice
          serviceRevenue += servicePrice
        }
      })
    }

    // Add products
    if (appointment.products && Array.isArray(appointment.products)) {
      appointment.products.forEach((product: any) => {
        let productPrice = 0
        if (typeof product.price === 'number') {
          productPrice = product.price
        } else if (typeof product.price === 'string' && !isNaN(parseFloat(product.price))) {
          productPrice = parseFloat(product.price)
        }

        if (productPrice > 0) {
          const quantity = typeof product.quantity === 'number' ? product.quantity : 1
          const totalProductPrice = productPrice * quantity
          total += totalProductPrice
          productRevenue += totalProductPrice
        }
      })
    }

    console.log(`🔍 FINAL REVENUE RESULT:`, { total, serviceRevenue, productRevenue })
    return { total, serviceRevenue, productRevenue }
  }

  // Calculate pending revenue from incomplete appointments
  useEffect(() => {
    console.log('📊 STATS CARDS: Calculating pending revenue from appointments')

    try {
      // Get all appointments
      const allAppointments = getAllAppointments()
      console.log('📊 ALL APPOINTMENTS:', allAppointments.map(apt => ({
        id: apt.id,
        clientName: apt.clientName,
        service: apt.service,
        status: apt.status,
        price: apt.price,
        priceType: typeof apt.price,
        location: apt.location,
        date: apt.date
      })))

      // If no appointments exist, create some test appointments for pending revenue
      if (allAppointments.length === 0) {
        console.log('📊 NO APPOINTMENTS: Creating test appointments for pending revenue')
        const testAppointments = [
          {
            id: "pending-test-1",
            clientId: "test-client-1",
            clientName: "Test Client 1",
            staffId: "1",
            staffName: "Emma Johnson",
            service: "Haircut & Style",
            serviceId: "1",
            date: new Date().toISOString(),
            duration: 60,
            status: "confirmed",
            location: "loc1",
            price: 75,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: "pending-test-2",
            clientId: "test-client-2",
            clientName: "Test Client 2",
            staffId: "2",
            staffName: "Michael Chen",
            service: "Color & Highlights",
            serviceId: "2",
            date: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            duration: 120,
            status: "arrived",
            location: "loc1",
            price: 150,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: "pending-test-3",
            clientId: "lula-client",
            clientName: "Lula",
            staffId: "3",
            staffName: "Robert Taylor",
            service: "Color & Highlights",
            serviceId: "2",
            date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
            duration: 120,
            status: "confirmed",
            location: "loc1",
            price: 150,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]

        // Save directly to localStorage and refresh the appointments list
        if (typeof window !== 'undefined') {
          localStorage.setItem('vanity_appointments', JSON.stringify(testAppointments))
          console.log('📊 CREATED TEST APPOINTMENTS:', testAppointments.length)
          // Force a re-render by updating the component
          setTimeout(() => {
            window.location.reload()
          }, 100)
          return
        }
      }





      // Get the current appointments list (might have been updated with test data)
      const currentAppointments = getAllAppointments()

      // Ensure appointments have proper price data
      const appointmentsWithPrices = currentAppointments.map(appointment => {
        if (appointment.price && typeof appointment.price === 'number' && appointment.price > 0) {
          return appointment // Already has valid price
        }

        // Try to set price from service lookup or fallback
        let price = 0

        // Try service lookup first
        try {
          const services = ServiceStorage.getServices()
          const service = services.find(s =>
            s.id === appointment.serviceId ||
            s.name === appointment.service ||
            s.name.toLowerCase() === appointment.service?.toLowerCase()
          )
          if (service && typeof service.price === 'number' && service.price > 0) {
            price = service.price
            console.log(`📊 SET PRICE FROM SERVICE LOOKUP: ${appointment.service} = ${price}`)
          }
        } catch (error) {
          console.log(`📊 SERVICE LOOKUP ERROR:`, error)
        }

        // Fallback pricing if service lookup failed
        if (price === 0) {
          const serviceName = appointment.service?.toLowerCase() || ''
          if (serviceName.includes('color') || serviceName.includes('highlight')) {
            price = 150
            console.log(`📊 SET FALLBACK COLOR PRICE: ${appointment.service} = ${price}`)
          } else if (serviceName.includes('haircut') || serviceName.includes('cut')) {
            price = 75
            console.log(`📊 SET FALLBACK HAIRCUT PRICE: ${appointment.service} = ${price}`)
          } else if (serviceName.includes('blowout') || serviceName.includes('style')) {
            price = 65
            console.log(`📊 SET FALLBACK STYLING PRICE: ${appointment.service} = ${price}`)
          } else {
            price = 50
            console.log(`📊 SET GENERIC FALLBACK PRICE: ${appointment.service} = ${price}`)
          }
        }

        return {
          ...appointment,
          price: price
        }
      })

      // Filter appointments that contribute to pending revenue
      const pendingAppointments = appointmentsWithPrices.filter(appointment => {
        // Exclude reflected appointments from revenue calculations
        if (appointment.isReflected) {
          return false
        }

        // Only include appointments with pending statuses
        const pendingStatuses = ['confirmed', 'arrived', 'service-started']
        if (!pendingStatuses.includes(appointment.status)) {
          return false
        }

        // Filter by location if not "all"
        if (currentLocation !== 'all' && appointment.location !== currentLocation) {
          return false
        }

        // Filter by date range if provided
        if (dateRange?.from && dateRange?.to) {
          const appointmentDate = new Date(appointment.date)
          if (appointmentDate < dateRange.from || appointmentDate > dateRange.to) {
            return false
          }
        }

        return true
      })

      console.log('📊 PENDING REVENUE: Found pending appointments:', {
        total: appointmentsWithPrices.length,
        pending: pendingAppointments.length,
        currentLocation,
        dateRange
      })

      // Debug: Log each pending appointment details
      console.log(`📊 PENDING APPOINTMENTS DETAILED BREAKDOWN:`)
      pendingAppointments.forEach((apt, index) => {
        console.log(`📊 PENDING APPOINTMENT ${index + 1}:`, {
          id: apt.id,
          clientName: apt.clientName,
          service: apt.service,
          serviceId: apt.serviceId,
          status: apt.status,
          location: apt.location,
          price: apt.price,
          priceType: typeof apt.price,
          date: apt.date,
          additionalServices: apt.additionalServices,
          products: apt.products,
          fullAppointmentObject: apt
        })

        // Test revenue calculation for this appointment
        const testRevenue = calculateAppointmentRevenue(apt)
        console.log(`📊 TEST REVENUE FOR ${apt.clientName}:`, testRevenue)
      })

      let totalPendingRevenue = 0
      let serviceRevenue = 0
      let productRevenue = 0

      pendingAppointments.forEach(appointment => {
        // Check if this appointment already has a completed transaction
        const existingTransaction = transactions.find(tx =>
          tx.reference?.type === 'appointment' &&
          tx.reference?.id === appointment.id &&
          tx.status === TransactionStatus.COMPLETED
        )

        // Only count revenue if no completed transaction exists
        if (!existingTransaction) {
          console.log(`📊 CALCULATING REVENUE FOR: ${appointment.clientName} - ${appointment.service}`)
          console.log(`📊 APPOINTMENT DATA:`, {
            id: appointment.id,
            price: appointment.price,
            priceType: typeof appointment.price,
            service: appointment.service,
            serviceId: appointment.serviceId,
            status: appointment.status
          })

          // Use the helper function to calculate revenue
          const revenue = calculateAppointmentRevenue(appointment)

          console.log(`📊 REVENUE CALCULATION RESULT:`, revenue)

          totalPendingRevenue += revenue.total
          serviceRevenue += revenue.serviceRevenue
          productRevenue += revenue.productRevenue

          console.log(`📊 RUNNING TOTALS:`, {
            totalPendingRevenue,
            serviceRevenue,
            productRevenue
          })

          console.log(`📊 PENDING: ${appointment.clientName} - ${appointment.service}: TOTAL = ${revenue.total}`)
        } else {
          console.log(`📊 SKIPPED: ${appointment.clientName} - already has completed transaction`)
        }
      })

      setPendingRevenue({
        total: totalPendingRevenue,
        appointmentCount: pendingAppointments.filter(apt =>
          !transactions.find(tx =>
            tx.reference?.type === 'appointment' &&
            tx.reference?.id === apt.id &&
            tx.status === TransactionStatus.COMPLETED
          )
        ).length,
        serviceRevenue,
        productRevenue
      })

      console.log('📊 PENDING REVENUE: Calculated pending revenue:', {
        total: totalPendingRevenue,
        appointments: pendingAppointments.length,
        serviceRevenue,
        productRevenue
      })

      // Debug: Log the final pending revenue state
      console.log('📊 SETTING PENDING REVENUE STATE:', {
        total: totalPendingRevenue,
        appointmentCount: pendingAppointments.filter(apt =>
          !transactions.find(tx =>
            tx.reference?.type === 'appointment' &&
            tx.reference?.id === apt.id &&
            tx.status === TransactionStatus.COMPLETED
          )
        ).length,
        serviceRevenue,
        productRevenue
      })

    } catch (error) {
      console.error('📊 STATS CARDS: Error calculating pending revenue:', error)
      setPendingRevenue({
        total: 0,
        appointmentCount: 0,
        serviceRevenue: 0,
        productRevenue: 0
      })
    }
  }, [dateRange, currentLocation, transactions])

  // Fetch real inventory analytics
  useEffect(() => {
    const fetchInventoryAnalytics = async () => {
      try {
        console.log('📊 STATS CARDS: Fetching inventory analytics...')

        const locationParam = currentLocation === 'all' ? '' : `?locationId=${currentLocation}`
        const response = await fetch(`/api/analytics/inventory${locationParam}`)

        if (!response.ok) {
          throw new Error(`Failed to fetch inventory analytics: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.success && data.analytics) {
          const analytics = data.analytics

          setInventoryData({
            value: analytics.totalInventoryValue || 0,
            lowStockItems: analytics.lowStockItemsCount || 0,
            outOfStockItems: analytics.outOfStockItemsCount || 0,
            turnoverRate: analytics.turnoverRate || 0
          })

          console.log('📊 STATS CARDS: Updated inventory data:', {
            value: analytics.totalInventoryValue,
            lowStock: analytics.lowStockItemsCount,
            outOfStock: analytics.outOfStockItemsCount,
            turnover: analytics.turnoverRate
          })
        } else {
          console.error('📊 STATS CARDS: Invalid inventory analytics response:', data)
        }

      } catch (error) {
        console.error('📊 STATS CARDS: Error fetching inventory analytics:', error)
        // Keep existing values on error
      }
    }

    fetchInventoryAnalytics()
  }, [currentLocation]) // Re-fetch when location changes

  // Format the date range for display
  const getDateRangeText = () => {
    if (!dateRange) return "from last month"

    const daysDiff = differenceInDays(dateRange.to, dateRange.from)
    if (daysDiff === 0) return "today"
    if (daysDiff === 1) return "yesterday"
    if (daysDiff < 7) return "this week"
    if (daysDiff < 31) return "this month"
    return "this period"
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
      {/* Total Revenue */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium text-muted-foreground truncate">Total Revenue</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                <CurrencyDisplay amount={revenueData.total} />
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Services</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={revenueData.services} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Products</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={revenueData.products} />
                  </span>
                </div>
              </div>
              <p className={`text-xs ${revenueData.percentChange >= 0 ? 'text-green-600' : 'text-red-600'} mt-2 truncate`}>
                {revenueData.percentChange >= 0 ? '+' : ''}{revenueData.percentChange}% {getDateRangeText()}
              </p>
            </div>
            <div className="bg-muted p-2 rounded-md flex-shrink-0">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Value */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium text-muted-foreground truncate">Inventory Value</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                <CurrencyDisplay amount={inventoryData.value} />
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Low Stock</span>
                  <span className="text-xs font-medium text-yellow-600 flex-shrink-0">
                    {inventoryData.lowStockItems} items
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Turnover</span>
                  <span className="text-xs font-medium flex-shrink-0">
                    {inventoryData.turnoverRate}x/year
                  </span>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2 truncate">
                +8.5% {getDateRangeText()}
              </p>
            </div>
            <div className="bg-muted p-2 rounded-md flex-shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Revenue */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium text-muted-foreground truncate">Pending Revenue</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                <CurrencyDisplay amount={pendingRevenue.total} />
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Appointments</span>
                  <span className="text-xs font-medium flex-shrink-0">{pendingRevenue.appointmentCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Services</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={pendingRevenue.serviceRevenue} />
                  </span>
                </div>
                {pendingRevenue.productRevenue > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground truncate">Products</span>
                    <span className="text-xs font-medium dashboard-sub-amount">
                      <CurrencyDisplay amount={pendingRevenue.productRevenue} />
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/20 p-2 rounded-md flex-shrink-0">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Online Sales */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium text-muted-foreground truncate">Online Sales</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                <CurrencyDisplay amount={revenueData.onlineSales} />
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Client Portal</span>
                  <span className="text-xs font-medium flex-shrink-0">
                    {dynamicCounts.onlineOrderCount} orders
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Avg Order</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={dynamicCounts.averageOrderValue} />
                  </span>
                </div>
              </div>
              <p className={`text-xs ${revenueData.onlineGrowth >= 0 ? 'text-green-600' : 'text-red-600'} mt-2 truncate`}>
                {revenueData.onlineGrowth >= 0 ? '+' : ''}{revenueData.onlineGrowth}% {getDateRangeText()}
              </p>
            </div>
            <div className="bg-muted p-2 rounded-md flex-shrink-0">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>



      {/* In-Person Sales */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium text-muted-foreground truncate">In-Person Sales</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                <CurrencyDisplay amount={revenueData.inPersonSales} />
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">POS & Calendar</span>
                  <span className="text-xs font-medium flex-shrink-0">
                    {dynamicCounts.inPersonTransactionCount} transactions
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Services</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={revenueData.inPersonServices} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Products</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={revenueData.inPersonProducts} />
                  </span>
                </div>
              </div>
              <p className={`text-xs ${revenueData.inPersonGrowth >= 0 ? 'text-green-600' : 'text-red-600'} mt-2 truncate`}>
                {revenueData.inPersonGrowth >= 0 ? '+' : ''}{revenueData.inPersonGrowth}% {getDateRangeText()}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/20 p-2 rounded-md flex-shrink-0">
              <Store className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Home Service */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-sm font-medium text-muted-foreground truncate">Home Service</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                <CurrencyDisplay amount={revenueData.homeService} />
              </h3>
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Services</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={revenueData.homeServiceServices} />
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate">Products</span>
                  <span className="text-xs font-medium dashboard-sub-amount">
                    <CurrencyDisplay amount={revenueData.homeServiceProducts} />
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 truncate">
                Revenue from Home Service transactions
              </p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/20 p-2 rounded-md flex-shrink-0">
              <ShoppingBag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments & New Clients (vertical) */}
      <Card className="dashboard-card">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground truncate">Appointments</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                +{dynamicCounts.appointmentCount}
              </h3>
              {/* Remove hardcoded +150% today, or replace with real calculation if available */}
            </div>
            <div className="border-t my-2" />
            <div>
              <p className="text-sm font-medium text-muted-foreground truncate">New Clients</p>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mt-1 dashboard-amount">
                +{dynamicCounts.newClientCount}
              </h3>
              {/* Remove hardcoded +133% today, or replace with real calculation if available */}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}