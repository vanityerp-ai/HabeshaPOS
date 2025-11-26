"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import type { DateRange } from "react-day-picker"
import {
  Eye,
  MoreHorizontal,
  Calendar,
  ShoppingCart,
  Edit,
  Package,
  Globe,
  FileText,
  Printer,
  Download,
  ExternalLink,
  FileDown,
  ChevronDown,
  FileSpreadsheet,
  Loader2
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTransactions } from "@/lib/transaction-provider"
import { useLocations } from "@/lib/location-provider"
import {
  Transaction,
  TransactionSource,
  TransactionStatus,
  getTransactionSourceLabel
} from "@/lib/transaction-types"
import { transactionDeduplicationService } from "@/lib/transaction-deduplication-service"
import { format } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { TransactionDetailsDialog } from "./transaction-details-dialog"
import { printReceipt } from "./receipt-printer.ts"
import { exportTransactionToHTMLPDF, exportReportToCSV, exportReportToExcel, exportReportToPDF, prepareTableDataForExport } from "@/lib/pdf-export"
import { ExportOptionsDialog, type ExportSection, type ExportOptions } from "@/components/reports/export-options-dialog"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { OrderDetailsDialog } from "@/components/orders/order-details-dialog"
import { useOrders } from "@/lib/order-provider"

interface TransactionsProps {
  search: string
  dateRange?: DateRange
  singleDate?: Date
  selectedLocation?: string
  selectedSource?: string
  dateMode?: "single" | "range"
}

export function Transactions({
  search,
  dateRange,
  singleDate,
  selectedLocation = "all",
  selectedSource = "all",
  dateMode = "range"
}: TransactionsProps) {
  const { transactions, filterTransactions } = useTransactions()
  const { getLocationName } = useLocations()
  const { getOrder, updateOrderStatus, createOrderFromTransaction } = useOrders()
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [isOrderDetailsOpen, setIsOrderDetailsOpen] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  // Apply filters whenever inputs change
  useEffect(() => {
    console.log('🔍 TRANSACTIONS COMPONENT: Applying filters:', {
      search,
      selectedLocation,
      selectedSource,
      dateMode,
      dateRange,
      singleDate,
      totalTransactions: transactions.length
    });

    const filters: any = { search }

    if (selectedLocation !== "all") {
      filters.location = selectedLocation
    }

    if (selectedSource !== "all") {
      filters.source = selectedSource
    }

    if (dateMode === "range" && dateRange?.from) {
      filters.startDate = dateRange.from
      filters.endDate = dateRange.to || dateRange.from
    } else if (dateMode === "single" && singleDate) {
      filters.singleDate = singleDate
    }
    // Do not set filters.type unless user explicitly selects a type
    // (If you have a type dropdown, add logic here to include it only if not 'all')
    const filtered = filterTransactions(filters)
    console.log('🔍 TRANSACTIONS COMPONENT: Filtered results:', {
      originalCount: transactions.length,
      filteredCount: filtered.length,
      clientPortalTransactions: filtered.filter(tx => tx.source === TransactionSource.CLIENT_PORTAL).length,
      filters
    });

    // Sort by date (newest first)
    const sorted = filtered.sort((a, b) => {
      const dateA = typeof a.date === 'string' ? new Date(a.date) : a.date
      const dateB = typeof b.date === 'string' ? new Date(b.date) : b.date
      return dateB.getTime() - dateA.getTime()
    })
    setFilteredTransactions(sorted)
  }, [search, dateRange, singleDate, selectedLocation, selectedSource, dateMode, filterTransactions, transactions])

  // Helper function to get source icon
  const getSourceIcon = (source: TransactionSource) => {
    switch (source) {
      case TransactionSource.POS:
        return <ShoppingCart className="h-4 w-4" />
      case TransactionSource.CALENDAR:
        return <Calendar className="h-4 w-4" />
      case TransactionSource.MANUAL:
        return <Edit className="h-4 w-4" />
      case TransactionSource.INVENTORY:
        return <Package className="h-4 w-4" />
      case TransactionSource.ONLINE:
        return <Globe className="h-4 w-4" />
      case TransactionSource.CLIENT_PORTAL:
        return <Globe className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  // Helper function to get source label (using shared utility)
  const getSourceLabel = (source: TransactionSource) => {
    return getTransactionSourceLabel(source)
  }

  // Helper function to get status badge variant
  const getStatusVariant = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.COMPLETED:
        return "success"
      case TransactionStatus.PENDING:
        return "outline"
      case TransactionStatus.CANCELLED:
        return "destructive"
      case TransactionStatus.REFUNDED:
        return "secondary"
      case TransactionStatus.PARTIAL:
        return "warning"
      default:
        return "default"
    }
  }

  // Helper function to format location name (now using real location service)
  const formatLocationName = (locationId: string) => {
    return getLocationName(locationId)
  }

  // Helper functions for revenue breakdown using deduplication service
  const calculateServiceRevenue = (transaction: Transaction) => {
    const breakdown = transactionDeduplicationService.calculateRevenueBreakdown(transaction);
    return breakdown.serviceRevenue;
  };

  const calculateProductRevenue = (transaction: Transaction) => {
    const breakdown = transactionDeduplicationService.calculateRevenueBreakdown(transaction);
    return breakdown.productRevenue;
  };

  const calculateOriginalAmount = (transaction: Transaction) => {
    const breakdown = transactionDeduplicationService.calculateRevenueBreakdown(transaction);
    return breakdown.originalAmount;
  };

  // Action handlers
  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsDetailsDialogOpen(true)
  }

  const handlePrintReceipt = (transaction: Transaction) => {
    try {
      printReceipt(transaction)
      toast({
        title: "Receipt Printed",
        description: "Receipt has been sent to printer.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Print Error",
        description: "Failed to print receipt. Please try again.",
      })
    }
  }

  const handleExportPDF = (transaction: Transaction) => {
    try {
      exportTransactionToHTMLPDF(transaction)
      toast({
        title: "PDF Exported",
        description: "Transaction details have been exported to PDF.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Error",
        description: "Failed to export PDF. Please try again.",
      })
    }
  }

  // Get available export sections for transactions
  const getAvailableExportSections = (): ExportSection[] => {
    return [
      {
        id: 'transactions',
        name: 'Transaction Details',
        description: 'All transaction records with full details',
        enabled: true,
        dataCount: filteredTransactions.length
      },
      {
        id: 'summary',
        name: 'Transaction Summary',
        description: 'Summary statistics and totals',
        enabled: true,
        dataCount: 1
      }
    ]
  }

  // Handle bulk export functionality
  const handleBulkExport = async (options: ExportOptions) => {
    setIsExporting(true)
    try {
      const reportSections: any[] = []

      for (const sectionId of options.sections) {
        switch (sectionId) {
          case 'transactions':
            reportSections.push(...filteredTransactions)
            break
          case 'summary':
            const summary = {
              totalTransactions: filteredTransactions.length,
              totalAmount: filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0),
              completedTransactions: filteredTransactions.filter(t => t.status === 'completed').length,
              pendingTransactions: filteredTransactions.filter(t => t.status === 'pending').length,
              averageAmount: filteredTransactions.length > 0 ?
                filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0) / filteredTransactions.length : 0
            }
            reportSections.push(summary)
            break
        }
      }

      const reportData = prepareTableDataForExport(
        reportSections,
        'Transaction Report',
        options.includeSummary ? {
          totalTransactions: filteredTransactions.length,
          totalAmount: filteredTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
        } : undefined
      )

      if (options.dateRange?.from && options.dateRange?.to) {
        reportData.dateRange = {
          from: options.dateRange.from,
          to: options.dateRange.to
        }
      }
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
        description: `Transaction report exported as ${options.format.toUpperCase()} file.`,
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export transactions. Please try again.",
      })
    } finally {
      setIsExporting(false)
      setIsExportDialogOpen(false)
    }
  }

  // Quick export functions
  const handleQuickExportCSV = async () => {
    try {
      const reportData = prepareTableDataForExport(filteredTransactions, 'Transactions Export')
      await exportReportToCSV(reportData)
      toast({
        title: "CSV Export Successful",
        description: "Transactions exported to CSV file.",
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
      const reportData = prepareTableDataForExport(filteredTransactions, 'Transactions Export')
      await exportReportToExcel(reportData, { format: 'excel', includeSummary: true })
      toast({
        title: "Excel Export Successful",
        description: "Transactions exported to Excel file.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Excel. Please try again.",
      })
    }
  }

  const handleViewReference = (transaction: Transaction) => {
    if (!transaction.reference) {
      toast({
        variant: "destructive",
        title: "No Reference",
        description: "This transaction has no associated reference.",
      })
      return
    }

    try {
      switch (transaction.source) {
        case TransactionSource.CALENDAR:
          // Navigate to appointments page
          router.push('/dashboard/appointments')
          toast({
            title: "Navigating to Appointments",
            description: "Opening appointments page to view related appointment.",
          })
          break
        case TransactionSource.CLIENT_PORTAL:
          // Handle client portal order viewing
          handleViewOrder(transaction)
          break
        case TransactionSource.POS:
          // Navigate to POS or sales history
          router.push('/dashboard/point-of-sale')
          toast({
            title: "Navigating to POS",
            description: "Opening Point of Sale to view related transaction.",
          })
          break
        case TransactionSource.INVENTORY:
          // Navigate to inventory
          router.push('/dashboard/inventory')
          toast({
            title: "Navigating to Inventory",
            description: "Opening inventory to view related changes.",
          })
          break
        default:
          toast({
            title: "Reference Information",
            description: `Reference: ${transaction.reference.type} - ${transaction.reference.id}`,
          })
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Navigation Error",
        description: "Failed to navigate to reference. Please try again.",
      })
    }
  }

  const handleViewOrder = (transaction: Transaction) => {
    if (transaction.reference?.type === "client_portal_order" && transaction.reference?.id) {
      // Try to get existing order
      let order = getOrder(transaction.reference.id)

      // If order doesn't exist, create it from transaction data
      if (!order && transaction.metadata?.orderData) {
        order = createOrderFromTransaction(transaction)
      }

      if (order) {
        setSelectedOrder(order)
        setIsOrderDetailsOpen(true)
      } else {
        toast({
          variant: "destructive",
          title: "Order Not Found",
          description: "Could not find order details for this transaction.",
        })
      }
    } else {
      toast({
        variant: "destructive",
        title: "Invalid Order",
        description: "This transaction is not associated with a client portal order.",
      })
    }
  }

  const handleOrderStatusUpdate = (orderId: string, status: any, tracking?: any, notes?: string) => {
    console.log('🔄 Updating order status:', { orderId, status, tracking, notes })

    const updatedOrder = updateOrderStatus(orderId, status, tracking, notes)
    if (updatedOrder) {
      console.log('✅ Order updated successfully:', updatedOrder)

      // Update the selected order state to reflect changes immediately
      setSelectedOrder(updatedOrder)

      toast({
        title: "Order Updated",
        description: `Order status updated to ${status}`,
      })
    } else {
      console.error('❌ Failed to update order status')
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Failed to update order status. Please try again.",
      })
    }
  }



  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transaction ID</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Original Amount</TableHead>
              <TableHead>Final Amount</TableHead>
              <TableHead>Payment Method</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={14} className="h-24 text-center">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((transaction) => {
                // Calculate revenue breakdown for display
                const serviceRevenue = calculateServiceRevenue(transaction);
                const productRevenue = calculateProductRevenue(transaction);
                // Calculate original amount: if originalServiceAmount exists, use it + productAmount, else use transaction.amount
                const originalAmount = transaction.originalServiceAmount 
                  ? (Number(transaction.originalServiceAmount) + (transaction.productAmount ? Number(transaction.productAmount) : 0))
                  : transaction.amount;
                const finalAmount = transaction.amount;

                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getSourceIcon(transaction.source)}
                        <span className="ml-1">{getSourceLabel(transaction.source)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {typeof transaction.date === 'string'
                        ? transaction.date
                        : format(transaction.date, 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>{transaction.clientName || 'N/A'}</TableCell>
                    <TableCell>{transaction.type}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center">
                          <span>{transaction.description}</span>
                          {/* Visual indicator for discounted transactions */}
                          {((transaction.discountPercentage && transaction.discountPercentage > 0) ||
                            transaction.metadata?.discountApplied) && (
                              <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                                Discounted
                              </Badge>
                            )}
                        </div>
                        {/* Show consolidated transaction breakdown */}
                        {transaction.type === 'consolidated_sale' && transaction.items && transaction.items.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {transaction.items.map((item, index) => (
                              <div key={index} className="flex justify-between">
                                <span>{item.name} ({item.type})</span>
                                <span>
                                  {item.discountApplied ? (
                                    <>
                                      <span className="line-through">{item.originalPrice}</span>
                                      <span className="ml-1 text-green-600">{item.totalPrice}</span>
                                    </>
                                  ) : (
                                    item.totalPrice
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Enhanced discount information display */}
                        {(transaction.discountPercentage && transaction.discountPercentage > 0) && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            {transaction.discountPercentage}% discount applied
                            {transaction.discountAmount && (
                              <span className="ml-1">(-<CurrencyDisplay amount={transaction.discountAmount} />)</span>
                            )}
                          </div>
                        )}
                        {transaction.metadata?.discountApplied && !transaction.discountPercentage && (
                          <div className="text-xs text-green-600 mt-1 font-medium">
                            {transaction.metadata.discountPercentage}% discount applied
                            {transaction.metadata.discountAmount && (
                              <span className="ml-1">(-<CurrencyDisplay amount={transaction.metadata.discountAmount} />)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="font-medium">
                          <CurrencyDisplay amount={serviceRevenue} />
                        </div>
                        {/* Show service breakdown for consolidated transactions */}
                        {transaction.type === 'consolidated_sale' && transaction.items && transaction.items.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {transaction.items
                              .filter(item => item.type === 'service')
                              .map((item, index) => (
                                <div key={index} className="flex justify-between">
                                  <span>{item.name}</span>
                                  <span>
                                    {item.discountApplied ? (
                                      <>
                                        <span className="line-through">{item.originalPrice}</span>
                                        <span className="ml-1 text-green-600">{item.totalPrice}</span>
                                      </>
                                    ) : (
                                      item.totalPrice
                                    )}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="font-medium">
                          <CurrencyDisplay amount={productRevenue} />
                        </div>
                        {/* Show product breakdown for consolidated transactions */}
                        {transaction.type === 'consolidated_sale' && transaction.items && transaction.items.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {transaction.items
                              .filter(item => item.type === 'product')
                              .map((item, index) => (
                                <div key={index} className="flex justify-between">
                                  <span>{item.name}</span>
                                  <span>{item.totalPrice}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="font-medium">
                          <CurrencyDisplay amount={originalAmount} />
                        </div>
                        {/* Show original amount breakdown */}
                        {originalAmount > finalAmount && (
                          <div className="text-xs text-muted-foreground">
                            Before discount
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="font-medium">
                          <CurrencyDisplay amount={finalAmount} />
                        </div>
                        {/* Show discount information if applicable */}
                        {originalAmount > finalAmount && (
                          <div className="text-xs text-green-600 font-medium">
                            After discount
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{transaction.paymentMethod}</TableCell>
                    <TableCell>{formatLocationName(transaction.location)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(transaction)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrintReceipt(transaction)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportPDF(transaction)}>
                            <Download className="mr-2 h-4 w-4" />
                            Export to PDF
                          </DropdownMenuItem>
                          {transaction.reference && (
                            <DropdownMenuItem onClick={() => handleViewReference(transaction)}>
                              {transaction.source === TransactionSource.CALENDAR ? (
                                <>
                                  <Calendar className="mr-2 h-4 w-4" />
                                  View appointment
                                </>
                              ) : transaction.source === TransactionSource.POS ? (
                                <>
                                  <ShoppingCart className="mr-2 h-4 w-4" />
                                  View sale
                                </>
                              ) : transaction.source === TransactionSource.CLIENT_PORTAL ? (
                                <>
                                  <Globe className="mr-2 h-4 w-4" />
                                  View order
                                </>
                              ) : transaction.source === TransactionSource.INVENTORY ? (
                                <>
                                  <Package className="mr-2 h-4 w-4" />
                                  View inventory
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  View reference
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Transaction Details Dialog */}
      <TransactionDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        transaction={selectedTransaction}
        onPrintReceipt={handlePrintReceipt}
        onExportPDF={handleExportPDF}
        onViewReference={handleViewReference}
      />

      {/* Order Details Dialog */}
      <OrderDetailsDialog
        open={isOrderDetailsOpen}
        onOpenChange={setIsOrderDetailsOpen}
        order={selectedOrder}
        onStatusUpdate={handleOrderStatusUpdate}
      />

      {/* Export Options Dialog */}
      <ExportOptionsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        onExport={handleBulkExport}
        availableSections={getAvailableExportSections()}
        defaultDateRange={dateRange}
        currentLocation={selectedLocation}
        isLoading={isExporting}
      />
    </Card>
  )
}

