"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useTransactions } from "@/lib/transaction-provider"
import { integratedAnalyticsService } from "@/lib/integrated-analytics-service"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/date-range-picker"
import { SalesChart } from "@/components/reports/sales-chart"
import { AppointmentsChart } from "@/components/reports/appointments-chart"
import { StaffPerformanceTable } from "@/components/reports/staff-performance-table"
import { ServicePopularityChart } from "@/components/reports/service-popularity-chart"
import { ClientRetentionChart } from "@/components/reports/client-retention-chart"
import { ProductSalesChart } from "@/components/reports/product-sales-chart"
import { InventoryAnalytics } from "@/components/reports/inventory-analytics"
import { PaymentMethodChart } from "@/components/reports/payment-method-chart"
import { PaymentMethodTable } from "@/components/reports/payment-method-table"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ExportOptionsDialog, type ExportSection, type ExportOptions } from "@/components/reports/export-options-dialog"
import { BulkExportDialog, type BulkExportOptions, type ReportType } from "@/components/reports/bulk-export-dialog"
import { useToast } from "@/components/ui/use-toast"
import { FileDown, Printer, TrendingUp, TrendingDown, Calendar, ShoppingCart, Globe, ChevronDown, FileSpreadsheet, FileText, Loader2, Users, DollarSign, Package } from "lucide-react"
import { format, subDays } from "date-fns"
import { TransactionSource, TransactionType, TransactionStatus, getTransactionSourceLabel } from "@/lib/transaction-types"
import type { DateRange } from "react-day-picker"
import {
  exportReportToPDF,
  exportReportToCSV,
  exportReportToExcel,
  prepareChartDataForExport,
  prepareTableDataForExport,
  type ReportData
} from "@/lib/pdf-export"
import {
  aggregateSalesData,
  aggregateAppointmentData,
  aggregateStaffPerformanceData,
  aggregateServicePopularityData,
  aggregatePaymentMethodData,
  aggregateClientRetentionData
} from "@/lib/report-data-aggregator"
import { ReportPrintService, type PrintSection } from "@/lib/report-print-service"
import { useStaff } from "@/lib/use-staff-data"

// General report types for reports page
const GENERAL_REPORT_TYPES: ReportType[] = [
  { id: 'sales', name: 'Sales Reports', description: 'Revenue and sales analytics' },
  { id: 'appointments', name: 'Appointment Reports', description: 'Booking and scheduling data' },
  { id: 'staff', name: 'Staff Performance', description: 'Individual staff metrics' },
  { id: 'inventory', name: 'Inventory Reports', description: 'Stock levels and movements' },
  { id: 'financial', name: 'Financial Reports', description: 'Profit & loss, expenses' },
  { id: 'client', name: 'Client Reports', description: 'Customer analytics and retention' }
]

export default function ReportsPage() {
  const { user, currentLocation, hasPermission } = useAuth()
  const { transactions, filterTransactions } = useTransactions()
  const { staff } = useStaff()
  const { toast } = useToast()
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [analytics, setAnalytics] = useState<any>(null)
  const [realtimeStats, setRealtimeStats] = useState({
    totalRevenue: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    sourceBreakdown: {
      calendar: 0,
      pos: 0,
      clientPortal: 0,
      manual: 0
    },
    paymentMethodBreakdown: {
      creditCard: 0,
      cash: 0,
      mobilePayment: 0,
      cardPayment: 0 // Renamed from 'other' to 'cardPayment'
    }
  })

  // Export/Print state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isBulkExportDialogOpen, setIsBulkExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // Get available export sections
  const getAvailableExportSections = (): ExportSection[] => {
    const filteredTransactions = filterTransactions(transactions, dateRange, selectedSource, currentLocation)
    const salesData = aggregateSalesData(filteredTransactions, dateRange, 'day', currentLocation)
    const appointmentData = aggregateAppointmentData(filteredTransactions, dateRange, currentLocation)
    const staffData = aggregateStaffPerformanceData(filteredTransactions, staff || [], dateRange, currentLocation)
    const serviceData = aggregateServicePopularityData(filteredTransactions, dateRange, currentLocation)
    const paymentData = aggregatePaymentMethodData(filteredTransactions, dateRange, currentLocation)
    const clientData = aggregateClientRetentionData(filteredTransactions, dateRange, currentLocation)

    return [
      {
        id: 'overview',
        name: 'Overview & Summary',
        description: 'Key metrics and summary statistics',
        enabled: true,
        dataCount: Object.keys(realtimeStats).length
      },
      {
        id: 'sales',
        name: 'Sales Data',
        description: 'Revenue breakdown by services and products',
        enabled: true,
        dataCount: salesData.length
      },
      {
        id: 'appointments',
        name: 'Appointments',
        description: 'Appointment volume and completion rates',
        enabled: true,
        dataCount: appointmentData.length
      },
      {
        id: 'staff',
        name: 'Staff Performance',
        description: 'Individual staff metrics and performance',
        enabled: true,
        dataCount: staffData.length
      },
      {
        id: 'services',
        name: 'Service Popularity',
        description: 'Most popular services and revenue',
        enabled: true,
        dataCount: serviceData.length
      },
      {
        id: 'payments',
        name: 'Payment Methods',
        description: 'Payment method breakdown and statistics',
        enabled: true,
        dataCount: paymentData.length
      },
      {
        id: 'clients',
        name: 'Client Retention',
        description: 'New vs returning client analysis',
        enabled: true,
        dataCount: clientData.length
      },
      {
        id: 'transactions',
        name: 'Transaction Details',
        description: 'Detailed transaction records',
        enabled: true,
        dataCount: filteredTransactions.length
      }
    ]
  }

  // Handle export functionality
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true)
    try {
      const filteredTransactions = filterTransactions(transactions, options.dateRange || dateRange, selectedSource, options.location || currentLocation)
      const reportSections: ReportData[] = []

      // Prepare data for selected sections
      for (const sectionId of options.sections) {
        switch (sectionId) {
          case 'overview':
            reportSections.push(prepareTableDataForExport(
              [realtimeStats],
              'Overview & Summary',
              realtimeStats
            ))
            break
          case 'sales':
            const salesData = aggregateSalesData(filteredTransactions, options.dateRange, 'day', options.location)
            reportSections.push(prepareTableDataForExport(salesData, 'Sales Data', undefined))
            break
          case 'appointments':
            const appointmentData = aggregateAppointmentData(filteredTransactions, options.dateRange, options.location)
            reportSections.push(prepareTableDataForExport(appointmentData, 'Appointments', undefined))
            break
          case 'staff':
            const staffData = aggregateStaffPerformanceData(filteredTransactions, staff || [], options.dateRange, options.location)
            reportSections.push(prepareTableDataForExport(staffData, 'Staff Performance', undefined))
            break
          case 'services':
            const serviceData = aggregateServicePopularityData(filteredTransactions, options.dateRange, options.location)
            reportSections.push(prepareTableDataForExport(serviceData, 'Service Popularity', undefined))
            break
          case 'payments':
            const paymentData = aggregatePaymentMethodData(filteredTransactions, options.dateRange, options.location)
            reportSections.push(prepareTableDataForExport(paymentData, 'Payment Methods', undefined))
            break
          case 'clients':
            const clientData = aggregateClientRetentionData(filteredTransactions, options.dateRange, options.location)
            reportSections.push(prepareTableDataForExport(clientData, 'Client Retention', undefined))
            break
          case 'transactions':
            reportSections.push(prepareTableDataForExport(filteredTransactions, 'Transaction Details', undefined))
            break
        }
      }

      // Export based on format
      if (reportSections.length > 0) {
        const mainReport: ReportData = {
          title: 'Reports & Analytics',
          dateRange: options.dateRange || dateRange,
          location: getLocationName(options.location || currentLocation),
          data: reportSections.flatMap(section => section.data),
          summary: options.includeSummary ? realtimeStats : undefined
        }

        switch (options.format) {
          case 'csv':
            await exportReportToCSV(mainReport, options)
            break
          case 'excel':
            await exportReportToExcel(mainReport, options)
            break
          case 'pdf':
            await exportReportToPDF(mainReport, options)
            break
        }

        toast({
          title: "Export Successful",
          description: `Report exported as ${options.format.toUpperCase()} file.`,
        })
      }
    } catch (error) {
      console.error('Export error:', error)
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export report. Please try again.",
      })
    } finally {
      setIsExporting(false)
      setIsExportDialogOpen(false)
    }
  }

  // Handle print functionality
  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const filteredTransactions = filterTransactions(transactions, dateRange, selectedSource, currentLocation)
      const printService = ReportPrintService.getInstance()

      const printSections: PrintSection[] = [
        {
          id: 'overview',
          title: 'Overview & Summary',
          content: JSON.stringify(realtimeStats),
          type: 'summary'
        },
        {
          id: 'sales',
          title: 'Sales Data',
          content: generateTableHTML(aggregateSalesData(filteredTransactions, dateRange, 'day', currentLocation)),
          type: 'table'
        },
        {
          id: 'staff',
          title: 'Staff Performance',
          content: generateTableHTML(aggregateStaffPerformanceData(filteredTransactions, staff || [], dateRange, currentLocation)),
          type: 'table',
          pageBreakBefore: true
        }
      ]

      await printService.printReport({
        title: 'Reports & Analytics',
        dateRange,
        location: getLocationName(currentLocation),
        sections: printSections
      })

      toast({
        title: "Print Initiated",
        description: "Report has been sent to printer.",
      })
    } catch (error) {
      console.error('Print error:', error)
      toast({
        variant: "destructive",
        title: "Print Failed",
        description: "Failed to print report. Please try again.",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  // Quick export functions
  const handleQuickExportCSV = async () => {
    const filteredTransactions = filterTransactions(transactions, dateRange, selectedSource, currentLocation)
    const salesData = aggregateSalesData(filteredTransactions, dateRange, 'day', currentLocation)

    try {
      await exportReportToCSV(prepareTableDataForExport(salesData, 'Sales Report', realtimeStats))
      toast({
        title: "CSV Export Successful",
        description: "Sales data exported to CSV file.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export CSV. Please try again.",
      })
    }
  }

  const handleQuickExportExcel = async () => {
    const filteredTransactions = filterTransactions(transactions, dateRange, selectedSource, currentLocation)
    const salesData = aggregateSalesData(filteredTransactions, dateRange, 'day', currentLocation)

    try {
      await exportReportToExcel(prepareTableDataForExport(salesData, 'Sales Report', realtimeStats), {
        format: 'excel',
        includeSummary: true
      })
      toast({
        title: "Excel Export Successful",
        description: "Sales data exported to Excel file.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Excel. Please try again.",
      })
    }
  }

  // Helper functions
  const getLocationName = (locationId?: string): string => {
    if (!locationId || locationId === 'all') return 'All Locations'
    switch (locationId) {
      case 'loc1': return 'Downtown'
      case 'loc2': return 'Westside'
      case 'loc3': return 'Northside'
      default: return locationId
    }
  }

  const generateTableHTML = (data: any[]): string => {
    if (!data || data.length === 0) return '<p>No data available</p>'

    const headers = Object.keys(data[0])
    const headerRow = headers.map(h => `<th>${h}</th>`).join('')
    const dataRows = data.map(row =>
      `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`
    ).join('')

    return `<table><thead><tr>${headerRow}</tr></thead><tbody>${dataRows}</tbody></table>`
  }

  // Handle bulk export functionality
  const handleBulkExport = async (options: BulkExportOptions) => {
    setIsExporting(true)
    try {
      const filteredTransactions = filterTransactions(transactions, dateRange, selectedSource, currentLocation)
      const exportPromises: Promise<void>[] = []

      // Generate exports for each combination of report type and format
      for (const reportType of options.reportTypes) {
        for (const format of options.formats) {
          let reportData: ReportData

          // Prepare data based on report type
          switch (reportType) {
            case 'sales':
              const salesData = aggregateSalesData(filteredTransactions, dateRange, 'day', currentLocation)
              reportData = prepareTableDataForExport(salesData, 'Sales Report', realtimeStats)
              break
            case 'appointments':
              const appointmentData = aggregateAppointmentData(filteredTransactions, dateRange, currentLocation)
              reportData = prepareTableDataForExport(appointmentData, 'Appointments Report', undefined)
              break
            case 'staff':
              const staffData = aggregateStaffPerformanceData(filteredTransactions, staff || [], dateRange, currentLocation)
              reportData = prepareTableDataForExport(staffData, 'Staff Performance Report', undefined)
              break
            case 'inventory':
              // Mock inventory data for now
              reportData = prepareTableDataForExport([], 'Inventory Report', undefined)
              break
            case 'financial':
              // Mock financial data for now
              reportData = prepareTableDataForExport([], 'Financial Report', undefined)
              break
            case 'client':
              const clientData = aggregateClientRetentionData(filteredTransactions, dateRange, currentLocation)
              reportData = prepareTableDataForExport(clientData, 'Client Report', undefined)
              break
            default:
              continue
          }

          // Set custom filename
          reportData.title = `${reportType}-report`

          // Export based on format
          const exportOptions: ExportOptions = {
            format: format as 'csv' | 'excel' | 'pdf',
            sections: [reportType],
            dateRange,
            includeSummary: true,
            customFileName: `${reportType}-report-${format}-${format(new Date(), 'yyyyMMdd-HHmm')}`
          }

          switch (format) {
            case 'csv':
              exportPromises.push(exportReportToCSV(reportData, exportOptions))
              break
            case 'excel':
              exportPromises.push(exportReportToExcel(reportData, exportOptions))
              break
            case 'pdf':
              exportPromises.push(exportReportToPDF(reportData, exportOptions))
              break
          }
        }
      }

      // Execute all exports
      await Promise.all(exportPromises)

      // Handle scheduling (mock implementation)
      if (options.schedule?.enabled) {
        toast({
          title: "Export Scheduled",
          description: `Reports will be generated ${options.schedule.frequency} at ${options.schedule.time}.`,
        })
      }

      // Handle email delivery (mock implementation)
      if (options.email?.enabled) {
        toast({
          title: "Email Scheduled",
          description: `Reports will be sent to ${options.email.recipients.length} recipients.`,
        })
      }

      toast({
        title: "Bulk Export Successful",
        description: `${exportPromises.length} reports exported successfully.`,
      })
    } catch (error) {
      console.error('Bulk export error:', error)
      toast({
        variant: "destructive",
        title: "Bulk Export Failed",
        description: "Failed to export reports. Please try again.",
      })
    } finally {
      setIsExporting(false)
      setIsBulkExportDialogOpen(false)
    }
  }

  // Calculate real-time analytics from transaction data
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return

    console.log('📊 REPORTS: Calculating real-time analytics from transactions:', {
      dateRange,
      currentLocation,
      selectedSource,
      totalTransactions: transactions.length
    })

    try {
      // Get analytics data for the date range and location
      const analyticsData = integratedAnalyticsService.getAnalytics(
        dateRange.from,
        dateRange.to,
        currentLocation === 'all' ? undefined : currentLocation
      )
      setAnalytics(analyticsData)

      // Filter transactions for real-time stats
      const filters: any = {}
      if (currentLocation !== 'all') {
        filters.location = currentLocation
      }
      if (selectedSource !== 'all') {
        filters.source = selectedSource
      }
      if (dateRange.from && dateRange.to) {
        filters.startDate = dateRange.from
        filters.endDate = dateRange.to
      }

      const filteredTxs = filterTransactions(filters)

      // Calculate source breakdown
      const sourceBreakdown = {
        calendar: filteredTxs.filter(t => t.source === TransactionSource.CALENDAR).reduce((sum, t) => sum + t.amount, 0),
        pos: filteredTxs.filter(t => t.source === TransactionSource.POS).reduce((sum, t) => sum + t.amount, 0),
        clientPortal: filteredTxs.filter(t => t.source === TransactionSource.CLIENT_PORTAL).reduce((sum, t) => sum + t.amount, 0),
        manual: filteredTxs.filter(t => t.source === TransactionSource.MANUAL).reduce((sum, t) => sum + t.amount, 0)
      }

      // Calculate payment method breakdown with updated categorization
      const paymentMethodBreakdown = {
        creditCard: filteredTxs.filter(t => t.paymentMethod === 'credit_card').reduce((sum, t) => sum + t.amount, 0),
        cash: filteredTxs.filter(t => t.paymentMethod === 'cash').reduce((sum, t) => sum + t.amount, 0),
        mobilePayment: filteredTxs.filter(t => ['mobile_payment', 'loyalty_points'].includes(t.paymentMethod)).reduce((sum, t) => sum + t.amount, 0),
        cardPayment: filteredTxs.filter(t => ['bank_transfer', 'check', 'other'].includes(t.paymentMethod)).reduce((sum, t) => sum + t.amount, 0)
      }

      const totalRevenue = filteredTxs.reduce((sum, t) => sum + t.amount, 0)
      const totalTransactions = filteredTxs.length
      const averageOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0

      setRealtimeStats({
        totalRevenue,
        totalTransactions,
        averageOrderValue,
        sourceBreakdown,
        paymentMethodBreakdown
      })

      console.log('📊 REPORTS: Updated real-time stats:', {
        totalRevenue,
        totalTransactions,
        averageOrderValue,
        sourceBreakdown,
        paymentMethodBreakdown,
        filteredTransactions: filteredTxs.length
      })

    } catch (error) {
      console.error('📊 REPORTS: Error calculating analytics:', error)
    }
  }, [dateRange, currentLocation, selectedSource, transactions, filterTransactions])

  // Debug user permissions
  console.log("📊 REPORTS PAGE DEBUG:")
  console.log("User:", user)
  console.log("User role:", user?.role)
  console.log("Has view_reports permission:", hasPermission("view_reports"))
  console.log("Has all permission:", hasPermission("all"))

  // Check if user has permission to access reports
  if (!hasPermission("view_reports")) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view the reports page.</CardDescription>
            <p className="text-xs text-gray-500 mt-2">
              Debug: Role = {user?.role}, Has view_reports = {hasPermission("view_reports").toString()}
            </p>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">
            {currentLocation === "all"
              ? "View reports across all locations"
              : `View reports for ${currentLocation === "loc1" ? "Downtown" : currentLocation === "loc2" ? "Westside" : "Northside"} location`}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              <Calendar className="mr-1 h-3 w-3" />
              {realtimeStats.sourceBreakdown.calendar > 0 && `Appointments: ${realtimeStats.sourceBreakdown.calendar.toFixed(0)}`}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <ShoppingCart className="mr-1 h-3 w-3" />
              {realtimeStats.sourceBreakdown.pos > 0 && `POS: ${realtimeStats.sourceBreakdown.pos.toFixed(0)}`}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Globe className="mr-1 h-3 w-3" />
              {realtimeStats.sourceBreakdown.clientPortal > 0 && `Online: ${realtimeStats.sourceBreakdown.clientPortal.toFixed(0)}`}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="calendar">Appointments</SelectItem>
              <SelectItem value="pos">POS System</SelectItem>
              <SelectItem value="client_portal">Client Portal</SelectItem>
              <SelectItem value="manual">Manual Entry</SelectItem>
            </SelectContent>
          </Select>
          <DatePickerWithRange dateRange={dateRange} onDateRangeChange={setDateRange} />

          {/* Enhanced Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleQuickExportCSV}>
                <FileDown className="mr-2 h-4 w-4" />
                Quick CSV Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleQuickExportExcel}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Quick Excel Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsExportDialogOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Advanced Export...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsBulkExportDialogOpen(true)}>
                <Package className="mr-2 h-4 w-4" />
                Bulk Export & Automation...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Enhanced Print Button */}
          <Button variant="outline" onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          <TabsTrigger value="clients">Client Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <CurrencyDisplay amount={analytics?.totalRevenue || realtimeStats.totalRevenue} />
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Services</span>
                    <span className="text-xs font-medium">
                      <CurrencyDisplay amount={analytics?.serviceRevenue || 0} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Products</span>
                    <span className="text-xs font-medium">
                      <CurrencyDisplay amount={analytics?.productRevenue || 0} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <p className="text-xs text-green-600">Real-time data</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realtimeStats.totalTransactions}</div>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Appointments</span>
                    <span className="text-xs font-medium">
                      {transactions.filter(t => t.source === TransactionSource.CALENDAR).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Online</span>
                    <span className="text-xs font-medium">
                      {transactions.filter(t => t.source === TransactionSource.CLIENT_PORTAL).length}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <p className="text-xs text-green-600">Live updates</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <CurrencyDisplay amount={realtimeStats.averageOrderValue} />
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Credit Card</span>
                    <span className="text-xs font-medium">
                      <CurrencyDisplay amount={realtimeStats.paymentMethodBreakdown.creditCard} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Cash</span>
                    <span className="text-xs font-medium">
                      <CurrencyDisplay amount={realtimeStats.paymentMethodBreakdown.cash} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <p className="text-xs text-green-600">Calculated live</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Transaction Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {realtimeStats.sourceBreakdown.calendar > realtimeStats.sourceBreakdown.pos ? 'Appointments' : 'POS'}
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Calendar</span>
                    <span className="text-xs font-medium">
                      <CurrencyDisplay amount={realtimeStats.sourceBreakdown.calendar} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Online</span>
                    <span className="text-xs font-medium">
                      <CurrencyDisplay amount={realtimeStats.sourceBreakdown.clientPortal} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3 w-3 text-green-600" />
                  <p className="text-xs text-green-600">All sources</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                    : "Select a date range"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SalesChart
                  dateRange={dateRange}
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Appointment Volume</CardTitle>
                <CardDescription>Number of appointments over time</CardDescription>
              </CardHeader>
              <CardContent>
                <AppointmentsChart
                  dateRange={dateRange}
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Top performing staff members</CardDescription>
            </CardHeader>
            <CardContent>
              <StaffPerformanceTable
                dateRange={dateRange}
                limit={5}
                transactions={transactions}
                currentLocation={currentLocation}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Day</CardTitle>
                <CardDescription>Daily revenue breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesChart
                  dateRange={dateRange}
                  groupBy="day"
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
                <CardDescription>Revenue distribution by service category</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ServicePopularityChart
                  dateRange={dateRange}
                  type="revenue"
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Payment Method</CardTitle>
                <CardDescription>Breakdown of revenue by payment type</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <PaymentMethodChart
                  dateRange={dateRange}
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Method Details</CardTitle>
                <CardDescription>Detailed payment method statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <PaymentMethodTable
                  dateRange={dateRange}
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Real-time Transaction Data</CardTitle>
              <CardDescription>Live transaction data from all sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Transaction ID</th>
                      <th className="p-3 text-left font-medium">Source</th>
                      <th className="p-3 text-left font-medium">Type</th>
                      <th className="p-3 text-left font-medium">Payment Method</th>
                      <th className="p-3 text-right font-medium">Amount</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter(tx => {
                        if (!dateRange?.from || !dateRange?.to) return true
                        const txDate = new Date(tx.createdAt)
                        return txDate >= dateRange.from && txDate <= dateRange.to
                      })
                      .filter(tx => {
                        if (currentLocation === 'all') return true
                        return tx.location === currentLocation
                      })
                      .filter(tx => {
                        if (selectedSource === 'all') return true
                        return tx.source === selectedSource
                      })
                      .slice(0, 10)
                      .map((transaction) => (
                        <tr key={transaction.id} className="border-b">
                          <td className="p-3 font-medium text-xs">{transaction.id.slice(0, 8)}...</td>
                          <td className="p-3">
                            <Badge variant="outline" className="text-xs">
                              {transaction.source === TransactionSource.CALENDAR && <Calendar className="mr-1 h-3 w-3" />}
                              {transaction.source === TransactionSource.POS && <ShoppingCart className="mr-1 h-3 w-3" />}
                              {transaction.source === TransactionSource.CLIENT_PORTAL && <Globe className="mr-1 h-3 w-3" />}
                              {getTransactionSourceLabel(transaction.source)}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">{transaction.type}</td>
                          <td className="p-3 text-xs">{transaction.paymentMethod}</td>
                          <td className="p-3 text-right">
                            <CurrencyDisplay amount={transaction.amount} />
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={transaction.status === TransactionStatus.COMPLETED ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {transaction.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">
                            {format(new Date(transaction.createdAt), "MMM dd, HH:mm")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {transactions.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No transactions found for the selected criteria
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <ProductSalesChart
            dateRange={dateRange}
            transactions={transactions}
            currentLocation={currentLocation}
          />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6">
          <InventoryAnalytics
            dateRange={dateRange}
            transactions={transactions}
            currentLocation={currentLocation}
          />
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Volume</CardTitle>
                <CardDescription>Number of appointments over time</CardDescription>
              </CardHeader>
              <CardContent>
                <AppointmentsChart
                  dateRange={dateRange}
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Service Popularity</CardTitle>
                <CardDescription>Most booked services</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ServicePopularityChart
                  dateRange={dateRange}
                  type="count"
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Booking Source</CardTitle>
              <CardDescription>How clients are making appointments</CardDescription>
            </CardHeader>
            <CardContent className="h-[350px]">
              <div className="flex items-center justify-center h-full">
                <div className="w-full max-w-md">
                  <div className="space-y-4">
                    {[
                      { source: "Online Booking", percentage: 45, count: 112 },
                      { source: "Phone", percentage: 30, count: 74 },
                      { source: "Walk-in", percentage: 15, count: 37 },
                      { source: "Mobile App", percentage: 10, count: 25 },
                    ].map((source, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{source.source}</span>
                          <span>
                            {source.percentage}% ({source.count})
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div
                            className="bg-primary h-2.5 rounded-full"
                            style={{ width: `${source.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>Revenue and appointments by staff member</CardDescription>
            </CardHeader>
            <CardContent>
              <StaffPerformanceTable
                dateRange={dateRange}
                transactions={transactions}
                currentLocation={currentLocation}
              />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Service Distribution</CardTitle>
                <CardDescription>Services performed by staff</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <div className="flex items-center justify-center h-full">
                  <div className="w-full max-w-md">
                    <div className="space-y-4">
                      {[
                        { name: "Haircut & Style", percentage: 35 },
                        { name: "Color & Highlights", percentage: 25 },
                        { name: "Treatments", percentage: 15 },
                        { name: "Styling", percentage: 15 },
                        { name: "Other", percentage: 10 },
                      ].map((service, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{service.name}</span>
                            <span>{service.percentage}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5">
                            <div
                              className="bg-primary h-2.5 rounded-full"
                              style={{ width: `${service.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilization Rate</CardTitle>
                <CardDescription>Staff booking efficiency</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">Staff Member</th>
                        <th className="p-3 text-right font-medium">Utilization</th>
                        <th className="p-3 text-right font-medium">Hours Booked</th>
                        <th className="p-3 text-right font-medium">Available Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: "Alex Johnson", utilization: 92, hoursBooked: 147, availableHours: 160 },
                        { name: "Maria Garcia", utilization: 88, hoursBooked: 141, availableHours: 160 },
                        { name: "David Kim", utilization: 85, hoursBooked: 136, availableHours: 160 },
                        { name: "Sarah Chen", utilization: 78, hoursBooked: 125, availableHours: 160 },
                        { name: "James Wilson", utilization: 75, hoursBooked: 120, availableHours: 160 },
                      ].map((staff, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-3 font-medium">{staff.name}</td>
                          <td className="p-3 text-right">{staff.utilization}%</td>
                          <td className="p-3 text-right">{staff.hoursBooked}</td>
                          <td className="p-3 text-right">{staff.availableHours}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>New vs. Returning Clients</CardTitle>
                <CardDescription>Client acquisition and retention</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ClientRetentionChart
                  dateRange={dateRange}
                  transactions={transactions}
                  currentLocation={currentLocation}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Client Retention Rate</CardTitle>
                <CardDescription>Percentage of clients who return</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle
                        className="text-muted stroke-current"
                        strokeWidth="10"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                      ></circle>
                      <circle
                        className="text-primary stroke-current"
                        strokeWidth="10"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        strokeDasharray="251.2"
                        strokeDashoffset="54"
                        transform="rotate(-90 50 50)"
                      ></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold">78%</span>
                      <span className="text-sm text-muted-foreground">Retention Rate</span>
                    </div>
                  </div>
                  <div className="mt-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      78% of clients return within 60 days of their first visit
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Client Lifetime Value</CardTitle>
              <CardDescription>Average revenue per client over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Client Segment</th>
                      <th className="p-3 text-right font-medium">Avg. Visits</th>
                      <th className="p-3 text-right font-medium">Avg. Spend</th>
                      <th className="p-3 text-right font-medium">Lifetime Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { segment: "VIP Clients", visits: 12.4, spend: 185, ltv: 2294 },
                      { segment: "Regular Clients", visits: 8.2, spend: 120, ltv: 984 },
                      { segment: "Occasional Clients", visits: 3.5, spend: 95, ltv: 332.5 },
                      { segment: "New Clients", visits: 1.0, spend: 85, ltv: 85 },
                      { segment: "All Clients", visits: 6.3, spend: 115, ltv: 724.5 },
                    ].map((segment, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-3 font-medium">{segment.segment}</td>
                        <td className="p-3 text-right">{segment.visits}</td>
                        <td className="p-3 text-right"><CurrencyDisplay amount={segment.spend} /></td>
                        <td className="p-3 text-right"><CurrencyDisplay amount={segment.ltv} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export Options Dialog */}
      <ExportOptionsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleExport}
        availableSections={getAvailableExportSections()}
        defaultDateRange={dateRange}
        currentLocation={currentLocation}
        isLoading={isExporting}
      />

      {/* Bulk Export Dialog */}
      <BulkExportDialog
        open={isBulkExportDialogOpen}
        onOpenChange={setIsBulkExportDialogOpen}
        onExport={handleBulkExport}
        reportTypes={GENERAL_REPORT_TYPES}
        isLoading={isExporting}
      />
    </div>
  )
}

