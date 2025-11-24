"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { ChevronLeft, ChevronRight, FileDown, Plus, ChevronDown, FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ExportOptionsDialog, type ExportSection, type ExportOptions } from "@/components/reports/export-options-dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  exportReportToPDF,
  exportReportToCSV,
  exportReportToExcel,
  prepareTableDataForExport,
  type ReportData
} from "@/lib/pdf-export"
import { aggregateDailySalesData } from "@/lib/accounting-data-aggregator"
import { ReportPrintService, type PrintSection } from "@/lib/report-print-service"
import { transactionDeduplicationService } from "@/lib/transaction-deduplication-service"

// Helper function to truncate description for table display
function truncateDescription(description: string, maxLength: number = 20): string {
  if (!description) return '';
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + '...';
}
import { format, addDays, subDays, isSameDay } from "date-fns"
import type { DateRange } from "react-day-picker"
import { useTransactions } from "@/lib/transaction-provider"
import { TransactionType, TransactionStatus, TransactionSource, PaymentMethod } from "@/lib/transaction-types"

interface DailySalesProps {
  dateRange?: DateRange
  singleDate?: Date
  dateMode?: "single" | "range"
  selectedLocation?: string
}

interface TransactionSummaryItem {
  itemType: string
  salesQty: number
  refundQty: number
  grossTotal: number
  productRevenue?: number // Only for Products row
}

interface CashMovementItem {
  paymentType: string
  paymentsCollected: number
  refundsPaid: number
}

export function DailySales({
  dateRange,
  singleDate,
  dateMode = "single",
  selectedLocation = "all"
}: DailySalesProps) {
  const { transactions, filterTransactions } = useTransactions()
  const { toast } = useToast()
  const [currentDate, setCurrentDate] = useState<Date>(singleDate || new Date())
  const [activeSection, setActiveSection] = useState("daily-sales-summary")
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // Get transactions for the current date (with Online Store product sales enforced to always appear)
  const dailyTransactions = useMemo(() => {
    const filters: any = {
      singleDate: currentDate
    }

    if (selectedLocation !== "all") {
      filters.location = selectedLocation
    }

    return filterTransactions(filters)
  }, [currentDate, selectedLocation, filterTransactions])

  // Calculate transaction summary data
  const transactionSummary = useMemo(() => {
    const summary: TransactionSummaryItem[] = [];
    // Map to accumulate category data
    const itemTypes = new Map<string, { sales: number, refunds: number, grossTotal: number }>();
    const standardCategories = [
      "Services",
      "Products",
      "Shipping",
      "Gift cards",
      "Memberships",
      "Late cancellation fees",
      "No-show fees",
      "Refund amount"
    ];
    standardCategories.forEach(category => {
      itemTypes.set(category, { sales: 0, refunds: 0, grossTotal: 0 });
    });

    let serviceRevenue = 0;
    let productRevenue = 0;
    let serviceSales = 0;
    let productSales = 0;
    let serviceRefunds = 0;
    let productRefunds = 0;

    dailyTransactions.forEach(tx => {
      const breakdown = transactionDeduplicationService.calculateRevenueBreakdown(tx);
      // Services
      if (breakdown.serviceRevenue > 0) {
        if (tx.status === TransactionStatus.REFUNDED || tx.type === TransactionType.REFUND) {
          serviceRefunds += 1;
        } else if (tx.status === TransactionStatus.COMPLETED) {
          serviceRevenue += breakdown.serviceRevenue;
          serviceSales += 1;
        }
      }
      // Products
      if (breakdown.productRevenue > 0) {
        if (tx.status === TransactionStatus.REFUNDED || tx.type === TransactionType.REFUND) {
          productRefunds += 1;
        } else if (tx.status === TransactionStatus.COMPLETED) {
          productRevenue += breakdown.productRevenue;
          productSales += 1;
        }
      }
      // Other categories (legacy logic)
      let itemType = null;
      if (tx.type === TransactionType.GIFT_CARD_SALE) {
        itemType = "Gift cards";
      } else if (tx.type === TransactionType.MEMBERSHIP_SALE || tx.type === TransactionType.MEMBERSHIP_RENEWAL) {
        itemType = "Memberships";
      } else if (tx.description && tx.description.toLowerCase().includes("shipping")) {
        itemType = "Shipping";
      } else if (tx.description && tx.description.toLowerCase().includes("late cancellation")) {
        itemType = "Late cancellation fees";
      } else if (tx.description && tx.description.toLowerCase().includes("no-show")) {
        itemType = "No-show fees";
      } else if (tx.type === TransactionType.REFUND) {
        itemType = "Refund amount";
      }
      if (itemType && itemTypes.has(itemType)) {
        const item = itemTypes.get(itemType)!;
        if (tx.status === TransactionStatus.REFUNDED || tx.type === TransactionType.REFUND) {
          item.refunds += 1;
          item.grossTotal -= Math.abs(tx.amount);
        } else if (tx.status === TransactionStatus.COMPLETED) {
          item.sales += 1;
          item.grossTotal += tx.amount;
        }
      }
    });

    // Push Services and Products with improved logic
    summary.push({
      itemType: 'Services',
      salesQty: serviceSales,
      refundQty: serviceRefunds,
      grossTotal: serviceRevenue
    });
    summary.push({
      itemType: 'Products',
      salesQty: productSales,
      refundQty: productRefunds,
      grossTotal: productRevenue
    });
    // Push other categories
    standardCategories.slice(2).forEach(category => {
      const data = itemTypes.get(category)!;
      summary.push({
        itemType: category,
        salesQty: data.sales,
        refundQty: data.refunds,
        grossTotal: data.grossTotal
      });
    });
    // Add total row
    const totalSales = summary.reduce((sum, item) => sum + item.salesQty, 0);
    const totalRefunds = summary.reduce((sum, item) => sum + item.refundQty, 0);
    const totalGross = summary.reduce((sum, item) => sum + item.grossTotal, 0);
    summary.push({
      itemType: "Total Sales",
      salesQty: totalSales,
      refundQty: totalRefunds,
      grossTotal: totalGross
    });
    return summary;
  }, [dailyTransactions]);

  // Calculate discount statistics
  const discountStats = useMemo(() => {
    // Filter transactions with discounts (both old metadata format and new consolidated format)
    const discountedTransactions = dailyTransactions.filter(tx =>
      tx.metadata?.discountApplied || (tx.discountPercentage && tx.discountPercentage > 0)
    )

    const totalDiscountAmount = discountedTransactions.reduce((sum, tx) => {
      // Handle both old metadata format and new consolidated format
      const discountAmount = tx.discountAmount ||
        ((tx.metadata?.originalTotal || tx.originalServiceAmount || 0) - tx.amount)
      return sum + discountAmount
    }, 0)

    const averageDiscountPercentage = discountedTransactions.length > 0
      ? discountedTransactions.reduce((sum, tx) => {
          const discountPercentage = tx.discountPercentage || tx.metadata?.discountPercentage || 0
          return sum + discountPercentage
        }, 0) / discountedTransactions.length
      : 0

    return {
      totalDiscountedTransactions: discountedTransactions.length,
      totalDiscountAmount,
      averageDiscountPercentage: Math.round(averageDiscountPercentage * 100) / 100
    }
  }, [dailyTransactions])

  // Calculate cash movement summary data
  const cashMovementSummary = useMemo(() => {
    const summary: CashMovementItem[] = []
    const paymentTypes = new Map<string, { collected: number, refunded: number }>()

    // Initialize with updated payment types for better categorization
    const standardPaymentTypes = [
      "Cash",
      "Card Payment",
      "Mobile Payment",
      "Gift card redemptions",
      "Payments collected",
      "Of which tips"
    ]

    standardPaymentTypes.forEach(type => {
      paymentTypes.set(type, { collected: 0, refunded: 0 })
    })

    dailyTransactions.forEach(tx => {
      let paymentType = "Card Payment" // Default to Card Payment instead of Other

      switch (tx.paymentMethod) {
        case PaymentMethod.CASH:
          paymentType = "Cash"
          break
        case PaymentMethod.CREDIT_CARD:
        case PaymentMethod.BANK_TRANSFER:
        case PaymentMethod.CHECK:
          paymentType = "Card Payment"
          break
        case PaymentMethod.MOBILE_PAYMENT:
          paymentType = "Mobile Payment"
          break
        case PaymentMethod.GIFT_CARD:
          paymentType = "Gift card redemptions"
          break
        case PaymentMethod.LOYALTY_POINTS:
          paymentType = "Mobile Payment" // Loyalty points are typically mobile/app-based
          break
        case PaymentMethod.OTHER:
          paymentType = "Card Payment" // Migrate existing "Other" payments to Card Payment
          break
        default:
          paymentType = "Card Payment" // Default fallback to Card Payment
      }

      const payment = paymentTypes.get(paymentType)!

      if (tx.status === TransactionStatus.REFUNDED || tx.type === TransactionType.REFUND) {
        payment.refunded += Math.abs(tx.amount)
      } else if (tx.status === TransactionStatus.COMPLETED) {
        payment.collected += tx.amount

        // Add to "Payments collected" total
        const paymentsCollected = paymentTypes.get("Payments collected")!
        paymentsCollected.collected += tx.amount
      }
    })

    // Convert to array format
    paymentTypes.forEach((data, paymentType) => {
      summary.push({
        paymentType,
        paymentsCollected: data.collected,
        refundsPaid: data.refunded
      })
    })

    return summary
  }, [dailyTransactions])

  const handlePreviousDay = () => {
    setCurrentDate(prev => subDays(prev, 1))
  }

  const handleNextDay = () => {
    setCurrentDate(prev => addDays(prev, 1))
  }

  // Get available export sections
  const getAvailableExportSections = (): ExportSection[] => {
    return [
      {
        id: 'daily-summary',
        name: 'Daily Sales Summary',
        description: 'Summary of daily sales and transactions',
        enabled: true,
        dataCount: transactionSummary.length
      },
      {
        id: 'cash-movement',
        name: 'Cash Movement',
        description: 'Payment method breakdown and cash flow',
        enabled: true,
        dataCount: cashMovementSummary.length
      },
      {
        id: 'transactions',
        name: 'Transaction Details',
        description: 'Detailed transaction records for the day',
        enabled: true,
        dataCount: dailyTransactions.length
      }
    ]
  }

  // Handle export functionality
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true)
    try {
      const reportSections: any[] = []

      for (const sectionId of options.sections) {
        switch (sectionId) {
          case 'daily-summary':
            reportSections.push(...transactionSummary)
            break
          case 'cash-movement':
            reportSections.push(...cashMovementSummary)
            break
          case 'transactions':
            reportSections.push(...dailyTransactions)
            break
        }
      }

      const reportData = prepareTableDataForExport(
        reportSections,
        `Daily Sales Report - ${format(currentDate, 'MMM dd, yyyy')}`,
        options.includeSummary ? {
          date: format(currentDate, 'MMM dd, yyyy'),
          totalTransactions: dailyTransactions.length,
          totalSales: dailyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
          location: selectedLocation
        } : undefined
      )

      reportData.dateRange = { from: currentDate, to: currentDate }
      reportData.location = selectedLocation

      switch (options.format) {
        case 'csv':
          await exportReportToCSV(reportData, options)
          break
        case 'excel':
          await exportReportToExcel(reportData, options)
          break
        case 'pdf':
          await exportReportToPDF(reportData, options)
          break
      }

      toast({
        title: "Export Successful",
        description: `Daily sales report exported as ${options.format.toUpperCase()} file.`,
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export daily sales. Please try again.",
      })
    } finally {
      setIsExporting(false)
      setIsExportDialogOpen(false)
    }
  }

  // Quick export functions
  const handleQuickExportCSV = async () => {
    try {
      const reportData = prepareTableDataForExport(transactionSummary, `Daily Sales - ${format(currentDate, 'MMM dd, yyyy')}`)
      await exportReportToCSV(reportData)
      toast({
        title: "CSV Export Successful",
        description: "Daily sales exported to CSV file.",
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
    try {
      const reportData = prepareTableDataForExport(transactionSummary, `Daily Sales - ${format(currentDate, 'MMM dd, yyyy')}`)
      await exportReportToExcel(reportData, { format: 'excel', includeSummary: true })
      toast({
        title: "Excel Export Successful",
        description: "Daily sales exported to Excel file.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Excel. Please try again.",
      })
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const isToday = isSameDay(currentDate, new Date())

  return (
    <div className="flex gap-6">
      {/* Left Sidebar Navigation */}
      <div className="w-56 space-y-1">
        <Card className="p-2">
          <div className="space-y-1">
            <Button
              variant={activeSection === "daily-sales-summary" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("daily-sales-summary")}
            >
              Daily sales summary
            </Button>
            <Button
              variant={activeSection === "appointments" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("appointments")}
            >
              Appointments
            </Button>
            <Button
              variant={activeSection === "sales" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("sales")}
            >
              Sales
            </Button>
            <Button
              variant={activeSection === "payments" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("payments")}
            >
              Payments
            </Button>
            <Button
              variant={activeSection === "gift-cards-sold" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("gift-cards-sold")}
            >
              Gift cards sold
            </Button>
            <Button
              variant={activeSection === "memberships-sold" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("memberships-sold")}
            >
              Memberships sold
            </Button>
            <Button
              variant={activeSection === "discounts" ? "default" : "ghost"}
              className="w-full justify-start text-sm h-8"
              onClick={() => setActiveSection("discounts")}
            >
              Discounts Applied
              {discountStats.totalDiscountedTransactions > 0 && (
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                  {discountStats.totalDiscountedTransactions}
                </span>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-semibold">Daily sales</h2>
            <p className="text-sm text-muted-foreground">View, filter and export the transactions and cash movement for the day.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Enhanced Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
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
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add new
            </Button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousDay}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant={isToday ? "default" : "outline"}
            size="sm"
            onClick={handleToday}
          >
            Today
          </Button>
          <span className="text-sm font-medium px-2">
            {format(currentDate, "EEEE d MMM, yyyy")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextDay}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Content based on active section */}
        {activeSection === "daily-sales-summary" && (
          <div className="grid grid-cols-2 gap-6">
            {/* Transaction Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Transaction summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-medium">Item type</TableHead>
                        <TableHead className="text-right font-medium">Sales qty</TableHead>
                        <TableHead className="text-right font-medium">Refund qty</TableHead>
                        <TableHead className="text-right font-medium">Gross total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactionSummary.map((item, index) => (
                        <TableRow
                          key={index}
                          className={item.itemType === "Total Sales" ? "font-semibold border-t-2 bg-muted/30" : ""}
                        >
                          <TableCell className="py-2">{item.itemType}</TableCell>
                          <TableCell className="text-right py-2">{item.salesQty}</TableCell>
                          <TableCell className="text-right py-2">{item.refundQty}</TableCell>
                          <TableCell className="text-right py-2">
                            <CurrencyDisplay amount={item.grossTotal} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Cash Movement Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Cash movement summary</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-medium">Payment type</TableHead>
                        <TableHead className="text-right font-medium">Payments collected</TableHead>
                        <TableHead className="text-right font-medium">Refunds paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashMovementSummary.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="py-2">{item.paymentType}</TableCell>
                          <TableCell className="text-right py-2">
                            <CurrencyDisplay amount={item.paymentsCollected} />
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <CurrencyDisplay amount={item.refundsPaid} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Other sections content */}
        {activeSection === "appointments" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Time</TableHead>
                      <TableHead className="font-medium">Client</TableHead>
                      <TableHead className="font-medium">Service</TableHead>
                      <TableHead className="text-right font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyTransactions
                      .filter(tx => tx.reference?.type === 'appointment')
                      .map((tx, index) => (
                        <TableRow key={index}>
                          <TableCell className="py-2">{format(new Date(tx.date), 'HH:mm')}</TableCell>
                          <TableCell className="py-2">{tx.clientName || 'N/A'}</TableCell>
                          <TableCell className="py-2">
                            <span title={tx.description}>{truncateDescription(tx.description)}</span>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex flex-col items-end">
                              <CurrencyDisplay amount={tx.amount} />
                              {((tx.metadata?.discountApplied && tx.metadata?.originalTotal) ||
                                (tx.discountPercentage && tx.discountPercentage > 0 && tx.originalServiceAmount)) && (
                                <div className="text-xs text-muted-foreground line-through">
                                  <CurrencyDisplay amount={tx.metadata?.originalTotal || tx.originalServiceAmount || 0} />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">{tx.status}</TableCell>
                        </TableRow>
                      ))}
                    {dailyTransactions.filter(tx => tx.reference?.type === 'appointment').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No appointments found for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "sales" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Time</TableHead>
                      <TableHead className="font-medium">Item</TableHead>
                      <TableHead className="font-medium">Quantity</TableHead>
                      <TableHead className="text-right font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyTransactions
                      .filter(tx => tx.type === TransactionType.PRODUCT_SALE || tx.type === TransactionType.SERVICE_SALE)
                      .map((tx, index) => (
                        <TableRow key={index}>
                          <TableCell className="py-2">{format(new Date(tx.date), 'HH:mm')}</TableCell>
                          <TableCell className="py-2">
                            <span title={tx.description}>{truncateDescription(tx.description)}</span>
                          </TableCell>
                          <TableCell className="py-2">{tx.quantity || 1}</TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex flex-col items-end">
                              <CurrencyDisplay amount={tx.amount} />
                              {((tx.metadata?.discountApplied && tx.metadata?.originalTotal) ||
                                (tx.discountPercentage && tx.discountPercentage > 0 && tx.originalServiceAmount)) && (
                                <div className="text-xs text-muted-foreground line-through">
                                  <CurrencyDisplay amount={tx.metadata?.originalTotal || tx.originalServiceAmount || 0} />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">{tx.paymentMethod}</TableCell>
                        </TableRow>
                      ))}
                    {dailyTransactions.filter(tx => tx.type === TransactionType.PRODUCT_SALE || tx.type === TransactionType.SERVICE_SALE).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No sales found for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Time</TableHead>
                      <TableHead className="font-medium">Client</TableHead>
                      <TableHead className="font-medium">Payment Method</TableHead>
                      <TableHead className="text-right font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyTransactions
                      .filter(tx => tx.status === TransactionStatus.COMPLETED)
                      .map((tx, index) => (
                        <TableRow key={index}>
                          <TableCell className="py-2">{format(new Date(tx.date), 'HH:mm')}</TableCell>
                          <TableCell className="py-2">
                            {tx.clientName || 'N/A'}
                            {(tx.metadata?.discountApplied || (tx.discountPercentage && tx.discountPercentage > 0)) && (
                              <div className="text-xs text-green-600 mt-1">
                                {tx.discountPercentage || tx.metadata?.discountPercentage}% discount
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="py-2">{tx.paymentMethod}</TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex flex-col items-end">
                              <CurrencyDisplay amount={tx.amount} />
                              {((tx.metadata?.discountApplied && tx.metadata?.originalTotal) ||
                                (tx.discountPercentage && tx.discountPercentage > 0 && tx.originalServiceAmount)) && (
                                <div className="text-xs text-muted-foreground line-through">
                                  <CurrencyDisplay amount={tx.metadata?.originalTotal || tx.originalServiceAmount || 0} />
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">{tx.status}</TableCell>
                        </TableRow>
                      ))}
                    {dailyTransactions.filter(tx => tx.status === TransactionStatus.COMPLETED).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No payments found for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "gift-cards-sold" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Gift Cards Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Time</TableHead>
                      <TableHead className="font-medium">Client</TableHead>
                      <TableHead className="font-medium">Gift Card Code</TableHead>
                      <TableHead className="text-right font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyTransactions
                      .filter(tx => tx.type === TransactionType.GIFT_CARD_SALE)
                      .map((tx, index) => (
                        <TableRow key={index}>
                          <TableCell className="py-2">{format(new Date(tx.date), 'HH:mm')}</TableCell>
                          <TableCell className="py-2">{tx.clientName || 'N/A'}</TableCell>
                          <TableCell className="py-2">{tx.metadata?.giftCardCode || 'N/A'}</TableCell>
                          <TableCell className="text-right py-2">
                            <CurrencyDisplay amount={tx.amount} />
                          </TableCell>
                          <TableCell className="py-2">{tx.paymentMethod}</TableCell>
                        </TableRow>
                      ))}
                    {dailyTransactions.filter(tx => tx.type === TransactionType.GIFT_CARD_SALE).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No gift cards sold for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "memberships-sold" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Memberships Sold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-medium">Time</TableHead>
                      <TableHead className="font-medium">Client</TableHead>
                      <TableHead className="font-medium">Membership Tier</TableHead>
                      <TableHead className="text-right font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyTransactions
                      .filter(tx => tx.type === TransactionType.MEMBERSHIP_SALE || tx.type === TransactionType.MEMBERSHIP_RENEWAL)
                      .map((tx, index) => (
                        <TableRow key={index}>
                          <TableCell className="py-2">{format(new Date(tx.date), 'HH:mm')}</TableCell>
                          <TableCell className="py-2">{tx.clientName || 'N/A'}</TableCell>
                          <TableCell className="py-2">{tx.metadata?.membershipTier || 'N/A'}</TableCell>
                          <TableCell className="text-right py-2">
                            <CurrencyDisplay amount={tx.amount} />
                          </TableCell>
                          <TableCell className="py-2">{tx.paymentMethod}</TableCell>
                        </TableRow>
                      ))}
                    {dailyTransactions.filter(tx => tx.type === TransactionType.MEMBERSHIP_SALE || tx.type === TransactionType.MEMBERSHIP_RENEWAL).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                          No memberships sold for this date.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSection === "discounts" && (
          <div className="space-y-6">
            {/* Discount Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-medium">Discount Summary</CardTitle>
                <CardDescription>
                  Overview of discounts applied on {format(currentDate, 'MMMM d, yyyy')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 mb-6">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      {discountStats.totalDiscountedTransactions}
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      Transactions with Discount
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      <CurrencyDisplay amount={discountStats.totalDiscountAmount} />
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      Total Discount Amount
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-2xl font-bold text-green-700">
                      {discountStats.averageDiscountPercentage}%
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      Average Discount %
                    </div>
                  </div>
                </div>

                {/* Detailed Discount Transactions */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-medium">Time</TableHead>
                        <TableHead className="font-medium">Client</TableHead>
                        <TableHead className="font-medium">Service/Product</TableHead>
                        <TableHead className="font-medium">Discount %</TableHead>
                        <TableHead className="text-right font-medium">Original Amount</TableHead>
                        <TableHead className="text-right font-medium">Discount Amount</TableHead>
                        <TableHead className="text-right font-medium">Final Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyTransactions
                        .filter(tx => tx.metadata?.discountApplied || (tx.discountPercentage && tx.discountPercentage > 0))
                        .map((tx, index) => {
                          // Handle both old metadata format and new consolidated format
                          const originalAmount = tx.metadata?.originalTotal || tx.originalServiceAmount || 0
                          const discountAmount = tx.discountAmount || (originalAmount - tx.amount)
                          const discountPercentage = tx.discountPercentage || tx.metadata?.discountPercentage || 0

                          return (
                            <TableRow key={index}>
                              <TableCell className="py-2">{format(new Date(tx.date), 'HH:mm')}</TableCell>
                              <TableCell className="py-2">{tx.clientName || 'N/A'}</TableCell>
                              <TableCell className="py-2">
                                <span title={tx.description}>{truncateDescription(tx.description)}</span>
                              </TableCell>
                              <TableCell className="py-2 text-green-600 font-medium">
                                {discountPercentage}%
                              </TableCell>
                              <TableCell className="text-right py-2">
                                <CurrencyDisplay amount={originalAmount} />
                              </TableCell>
                              <TableCell className="text-right py-2 text-green-600">
                                -<CurrencyDisplay amount={discountAmount} />
                              </TableCell>
                              <TableCell className="text-right py-2 font-medium">
                                <CurrencyDisplay amount={tx.amount} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      {dailyTransactions.filter(tx => tx.metadata?.discountApplied || (tx.discountPercentage && tx.discountPercentage > 0)).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No discounts applied on this date.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Export Options Dialog */}
      <ExportOptionsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleExport}
        availableSections={getAvailableExportSections()}
        defaultDateRange={{ from: currentDate, to: currentDate }}
        currentLocation={selectedLocation}
        isLoading={isExporting}
      />
    </div>
  )
}
