"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/date-range-picker"
import { FinancialOverview } from "@/components/accounting/financial-overview"
import { Transactions } from "@/components/accounting/transactions"
import { Expenses } from "@/components/accounting/expenses"
import { StaffCosts } from "@/components/accounting/staff-costs"
import { Reports } from "@/components/accounting/reports"
import { DailySales } from "@/components/accounting/daily-sales"
import { NewTransactionDialog } from "@/components/accounting/new-transaction-dialog"
import { NewExpenseDialog } from "@/components/accounting/new-expense-dialog"
import { LocationButtons } from "@/components/location-buttons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ExportOptionsDialog, type ExportSection, type ExportOptions } from "@/components/reports/export-options-dialog"
import { BulkExportDialog, type BulkExportOptions, type ReportType } from "@/components/reports/bulk-export-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Search, FileDown, Printer, CalendarIcon, ChevronDown, FileSpreadsheet, FileText, Loader2, Package, MoreHorizontal, Eye, Download } from "lucide-react"
import { subDays } from "date-fns"
import type { DateRange } from "react-day-picker"
import {
  exportReportToPDF,
  exportReportToCSV,
  exportReportToExcel,
  prepareTableDataForExport,
  type ReportData
} from "@/lib/pdf-export"
import {
  aggregateFinancialSummary,
  aggregateDailySalesData,
  aggregateTransactionSummary,
  aggregateStaffCostsData,
  aggregateExpenseData
} from "@/lib/accounting-data-aggregator"
import { useTransactions } from "@/lib/transaction-provider"
import { useStaff } from "@/lib/use-staff-data"
import { type Transaction, type TransactionSource } from "@/lib/transaction-types"
import { SettingsStorage } from "@/lib/settings-storage"


// Accounting-specific report types
const ACCOUNTING_REPORT_TYPES: ReportType[] = [
  { id: 'financial_summary', name: 'Financial Summary', description: 'Revenue, expenses, and profit analysis' },
  { id: 'transactions', name: 'Transaction Reports', description: 'Detailed transaction records' },
  { id: 'daily_sales', name: 'Daily Sales', description: 'Daily sales performance and trends' },
  { id: 'expenses', name: 'Expense Reports', description: 'Business expenses and cost analysis' },
  { id: 'staff_costs', name: 'Staff Costs', description: 'Payroll and staff-related expenses' },
  { id: 'tax_reports', name: 'Tax Reports', description: 'Tax calculations and compliance reports' }
]
import { ReportPrintService, type PrintSection } from "@/lib/report-print-service"


export default function AccountingPage() {
  const { user, currentLocation, hasPermission } = useAuth()
  const { getLocationName, getActiveLocations } = useLocations()
  const { transactions, filterTransactions } = useTransactions()
  const { staff } = useStaff()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [singleDate, setSingleDate] = useState<Date | undefined>(new Date())
  const [dateMode, setDateMode] = useState<"single" | "range">("range")
  // Remove local selectedLocation state - use global currentLocation from useAuth instead
  const [selectedSource, setSelectedSource] = useState<string>("all")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Handler for viewing details
  const handleViewDetails = (tx: Transaction) => {
    setSelectedTransaction(tx)
    setIsDetailsOpen(true)
  }

  // Handler for printing receipt (placeholder)
  const handlePrintReceipt = (tx: Transaction) => {
    // Get branding name from settings
    const settings = SettingsStorage.getGeneralSettings();
    const companyName = settings.branding?.companyName || settings.businessName || "Vanity Hub";
    
    // Generate bilingual, thermal-printer-friendly receipt HTML
    const itemsHtml = (tx.items || []).map(function(item) {
      return `
        <div style="display: flex; font-size: 12px; border-bottom: 1px dashed #aaa;">
          <div style="flex: 2;">${item.name}</div>
          <div style="flex: 1;">${item.type}</div>
          <div style="flex: 1; text-align: right;">QAR ${item.originalPrice ?? '-'}</div>
          <div style="flex: 1; text-align: right;">${item.discountApplied ? (item.discountPercentage || 0) + '%' : '-'}</div>
          <div style="flex: 1; text-align: right;">QAR ${item.totalPrice}</div>
        </div>
        <div style="display: flex; font-size: 11px; direction: rtl; border-bottom: 1px dashed #aaa;">
          <div style="flex: 2;">${item.name}</div>
          <div style="flex: 1;">${item.type}</div>
          <div style="flex: 1; text-align: left;">${item.originalPrice ? toArabicNumber(item.originalPrice) + ' ر.ق' : '-'}</div>
          <div style="flex: 1; text-align: left;">${item.discountApplied ? toArabicNumber(item.discountPercentage || 0) + '٪' : '-'}</div>
          <div style="flex: 1; text-align: left;">${item.totalPrice ? toArabicNumber(item.totalPrice) + ' ر.ق' : '-'}</div>
        </div>
      `;
    }).join('');

    // Helper for Arabic numerals
    function toArabicNumber(num: number|string) {
      return String(num).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
    }

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${tx.id}</title>
          <style>
            body { width: 300px; font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 8px; }
            .title { font-weight: bold; font-size: 16px; }
            .subtitle { font-weight: bold; font-size: 14px; }
            .subtitle-ar { font-weight: bold; font-size: 14px; direction: rtl; }
            .info, .summary { margin-bottom: 8px; }
            .label { font-weight: bold; }
            .label-ar { font-weight: bold; direction: rtl; font-size: 11px; }
            .total { font-weight: bold; font-size: 14px; }
            .discount { color: #15803d; font-weight: bold; }
            .thankyou { text-align: center; margin-top: 10px; font-size: 12px; }
            .thankyou-ar { text-align: center; direction: rtl; font-size: 11px; }
            hr { margin: 8px 0; border: none; border-top: 1px solid #000; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${companyName}</div>
          </div>
          <div class="info">
            <div><span class="label">Transaction ID:</span> ${tx.id}</div>
            <div class="label-ar">معرّف المعاملة: ${tx.id}</div>
            <div><span class="label">Date:</span> ${(typeof tx.date === 'string' ? new Date(tx.date).toLocaleString() : tx.date.toLocaleString())}</div>
            <div class="label-ar">التاريخ: ${(typeof tx.date === 'string' ? toArabicNumber(new Date(tx.date).toLocaleString()) : toArabicNumber(tx.date.toLocaleString()))}</div>
            <div><span class="label">Client:</span> ${tx.clientName || '-'}</div>
            <div class="label-ar">العميل: ${tx.clientName || '-'}</div>
            <div><span class="label">Staff:</span> ${tx.staffName || '-'}</div>
            <div class="label-ar">الموظف: ${tx.staffName || '-'}</div>
            <div><span class="label">Location:</span> ${getLocationName(tx.location)}</div>
            <div class="label-ar">الموقع: ${getLocationName(tx.location)}</div>
          </div>
          <hr/>
          <div style="display: flex; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px;">
            <div style="flex: 2;">Item</div>
            <div style="flex: 1;">Type</div>
            <div style="flex: 1; text-align: right;">Price</div>
            <div style="flex: 1; text-align: right;">Discount</div>
            <div style="flex: 1; text-align: right;">Total</div>
          </div>
          <div style="display: flex; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; direction: rtl; font-size: 11px;">
            <div style="flex: 2;">الصنف</div>
            <div style="flex: 1;">النوع</div>
            <div style="flex: 1; text-align: left;">السعر</div>
            <div style="flex: 1; text-align: left;">الخصم</div>
            <div style="flex: 1; text-align: left;">الإجمالي</div>
          </div>
          ${itemsHtml}
          <hr/>
          <div class="summary">
            <div><span class="label">Payment Method:</span> ${tx.paymentMethod || '-'}</div>
            <div class="label-ar">طريقة الدفع: ${tx.paymentMethod || '-'}</div>
            <div><span class="label">Status:</span> ${tx.status || '-'}</div>
            <div class="label-ar">الحالة: ${tx.status || '-'}</div>
            <div><span class="label">Original Total:</span> ${tx.originalServiceAmount ? '<s>QAR ' + tx.originalServiceAmount + '</s>' : '-'}</div>
            <div class="label-ar">الإجمالي الأصلي: ${tx.originalServiceAmount ? '<s>' + toArabicNumber(tx.originalServiceAmount) + ' ر.ق</s>' : '-'}</div>
            <div><span class="label">Discount:</span> ${tx.discountAmount ? '<span class="discount">QAR ' + tx.discountAmount + ' (' + (tx.discountPercentage || 0) + '%)</span>' : '-'}</div>
            <div class="label-ar">الخصم: ${tx.discountAmount ? '<span class="discount">' + toArabicNumber(tx.discountAmount) + ' ر.ق (' + toArabicNumber(tx.discountPercentage || 0) + '٪)</span>' : '-'}</div>
            <div class="total"><span class="label">Final Amount Paid:</span> QAR ${tx.amount}</div>
            <div class="total label-ar">المبلغ النهائي المدفوع: ${toArabicNumber(tx.amount)} ر.ق</div>
          </div>
          <div class="thankyou">Thank you for your business!</div>
          <div class="thankyou-ar">شكراً لتعاملكم معنا!</div>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
    }
  };

  // Handler for exporting to PDF (placeholder)
  const handleExportPDF = (tx: Transaction) => {
    alert(`Export to PDF for ${tx.id}`)
    // TODO: Implement real export logic
  }

  // Debug current location
  console.log('🏢 ACCOUNTING PAGE: Current location:', currentLocation)

  // Get the active tab from URL params or default to "overview"
  const searchParams = useSearchParams()
  const activeTab = searchParams?.get("tab") || "overview"

  // Debug user permissions
  console.log("🔐 ACCOUNTING PAGE DEBUG:")
  console.log("User:", user)
  console.log("User role:", user?.role)
  console.log("Has view_accounting permission:", hasPermission("view_accounting"))
  console.log("Has all permission:", hasPermission("all"))

  // Get available export sections
  const getAvailableExportSections = (): ExportSection[] => {
    const safeDateRange = dateRange && dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined;
    const filteredTransactions = filterTransactions({
      search,
      location: currentLocation !== "all" ? currentLocation : undefined,
      source: normalizedSource,
      startDate: safeDateRange?.from,
      endDate: safeDateRange?.to,
      singleDate: dateMode === "single" && singleDate ? singleDate : undefined
    })
    const financialSummary = aggregateFinancialSummary(filteredTransactions, [], safeDateRange, currentLocation)
    const dailySalesData = aggregateDailySalesData(filteredTransactions, safeDateRange, currentLocation)
    const transactionSummary = aggregateTransactionSummary(filteredTransactions, safeDateRange, currentLocation)
    const staffCostsData = aggregateStaffCostsData(staff || [], filteredTransactions, safeDateRange, currentLocation)
    const expenseData = aggregateExpenseData(safeDateRange, currentLocation)

    return [
      {
        id: 'financial-overview',
        name: 'Financial Overview',
        description: 'Revenue, expenses, and profit summary',
        enabled: true,
        dataCount: 1
      },
      {
        id: 'daily-sales',
        name: 'Daily Sales',
        description: 'Daily sales breakdown and cash movement',
        enabled: true,
        dataCount: dailySalesData.length
      },
      {
        id: 'transactions',
        name: 'Transaction Details',
        description: 'Detailed transaction records',
        enabled: true,
        dataCount: filteredTransactions.length
      },
      {
        id: 'staff-costs',
        name: 'Staff Costs',
        description: 'Staff salary and cost analysis',
        enabled: true,
        dataCount: staffCostsData.length
      },
      {
        id: 'expenses',
        name: 'Expenses',
        description: 'Business expense records',
        enabled: true,
        dataCount: expenseData.length
      }
    ]
  }

  // Handle export functionality
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true)
    try {
      const safeDateRange = dateRange && dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined;
      const filteredTransactions = filterTransactions({
        search,
        location: options.location || currentLocation,
        source: normalizedSource,
        startDate: options.dateRange?.from ? options.dateRange.from : undefined,
        endDate: options.dateRange?.to ? options.dateRange.to : undefined,
        singleDate: dateMode === "single" && singleDate ? singleDate : undefined
      })
      const reportSections: ReportData[] = []

      // Prepare data for selected sections
      for (const sectionId of options.sections) {
        switch (sectionId) {
          case 'financial-overview':
            const financialSummary = aggregateFinancialSummary(filteredTransactions, [], safeDateRange, options.location)
            reportSections.push(prepareTableDataForExport([financialSummary], 'Financial Overview', financialSummary))
            break
          case 'daily-sales':
            const dailySalesData = aggregateDailySalesData(filteredTransactions, safeDateRange, options.location)
            reportSections.push(prepareTableDataForExport(dailySalesData, 'Daily Sales'))
            break
          case 'transactions':
            reportSections.push(prepareTableDataForExport(filteredTransactions, 'Transaction Details'))
            break
          case 'staff-costs':
            const staffCostsData = aggregateStaffCostsData(staff || [], filteredTransactions, safeDateRange, options.location)
            reportSections.push(prepareTableDataForExport(staffCostsData, 'Staff Costs'))
            break
          case 'expenses':
            const expenseData = aggregateExpenseData(safeDateRange, options.location)
            reportSections.push(prepareTableDataForExport(expenseData, 'Expenses'))
            break
        }
      }

      // Export based on format
      if (reportSections.length > 0) {
        const mainReport: ReportData = {
          title: 'Accounting Report',
          dateRange: safeDateRange,
          location: getLocationName(options.location || currentLocation),
          data: reportSections.flatMap(section => section.data),
          summary: options.includeSummary ? aggregateFinancialSummary(filteredTransactions, [], safeDateRange, options.location) : undefined
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
          description: `Accounting report exported as ${options.format.toUpperCase()} file.`,
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

  // Quick export functions
  const handleQuickExportCSV = async () => {
    const safeDateRange = dateRange && dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined;
    const filteredTransactions = filterTransactions({
      search,
      location: currentLocation,
      source: normalizedSource,
      startDate: safeDateRange?.from,
      endDate: safeDateRange?.to,
      singleDate: dateMode === "single" && singleDate ? singleDate : undefined
    })
    const financialSummary = aggregateFinancialSummary(filteredTransactions, [], safeDateRange, currentLocation)

    try {
      await exportReportToCSV(prepareTableDataForExport([financialSummary], 'Financial Summary', financialSummary))
      toast({
        title: "CSV Export Successful",
        description: "Financial data exported to CSV file.",
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
    const safeDateRange = dateRange && dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined;
    const filteredTransactions = filterTransactions({
      search,
      location: currentLocation,
      source: normalizedSource,
      startDate: safeDateRange?.from,
      endDate: safeDateRange?.to,
      singleDate: dateMode === "single" && singleDate ? singleDate : undefined
    })
    const financialSummary = aggregateFinancialSummary(filteredTransactions, [], safeDateRange, currentLocation)

    try {
      await exportReportToExcel(prepareTableDataForExport([financialSummary], 'Financial Summary', financialSummary), {
        format: 'excel',
        includeSummary: true
      })
      toast({
        title: "Excel Export Successful",
        description: "Financial data exported to Excel file.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: "Failed to export Excel. Please try again.",
      })
    }
  }

  // Handle print functionality
  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const safeDateRange = dateRange && dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined;
      const filteredTransactions = filterTransactions({
        search,
        location: currentLocation,
        source: normalizedSource,
        startDate: safeDateRange?.from,
        endDate: safeDateRange?.to,
        singleDate: dateMode === "single" && singleDate ? singleDate : undefined
      })
      const printService = ReportPrintService.getInstance()

      const printSections: PrintSection[] = [
        {
          id: 'financial-overview',
          title: 'Financial Overview',
          content: JSON.stringify(aggregateFinancialSummary(filteredTransactions, [], safeDateRange, currentLocation)),
          type: 'summary'
        },
        {
          id: 'daily-sales',
          title: 'Daily Sales',
          content: generateTableHTML(aggregateDailySalesData(filteredTransactions, safeDateRange, currentLocation)),
          type: 'table',
          pageBreakBefore: true
        }
      ]

      await printService.printReport({
        title: 'Accounting Report',
        dateRange: safeDateRange,
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

  // Helper function to generate table HTML
  const generateTableHTML = (data: any[]): string => {
    if (!data || data.length === 0) return '<p>No data available</p>'

    const headers = Object.keys(data[0])
    const headerRow = headers.map(h => `<th>${h}</th>`).join('')
    const dataRows = data.map(row =>
      `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`
    ).join('')

    return `<table><thead><tr>${headerRow}</tr></thead><tbody>${dataRows}</tbody></table>`
  }

  // Check if user has permission to access accounting
  if (!hasPermission("view_accounting")) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <p className="text-muted-foreground">You don't have permission to view the accounting page.</p>
            <p className="text-xs text-gray-500 mt-2">
              Debug: Role = {user?.role}, Has view_accounting = {hasPermission("view_accounting").toString()}
            </p>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const safeDateRange = dateRange && dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : undefined;
  const normalizedSource: 'all' | TransactionSource | undefined = selectedSource === 'all' ? 'all' : (selectedSource as TransactionSource | undefined);
  const filteredTransactions = filterTransactions({
    search,
    location: currentLocation !== "all" ? currentLocation : undefined,
    source: normalizedSource,
    startDate: safeDateRange?.from,
    endDate: safeDateRange?.to,
    singleDate: dateMode === "single" && singleDate ? singleDate : undefined
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Accounting</h2>
          <p className="text-muted-foreground">Manage your salon's finances, expenses, and reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <DatePickerWithRange
            dateRange={dateRange}
            singleDate={singleDate}
            mode={dateMode}
            onDateRangeChange={setDateRange}
            onSingleDateChange={setSingleDate}
            onModeChange={setDateMode}
          />
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
              <DropdownMenuItem onClick={() => {}}>
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

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="daily-sales">Daily Sales</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="staff-costs">Staff Costs</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <FinancialOverview dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="daily-sales">
          <DailySales
            dateRange={dateRange}
            singleDate={singleDate}
            dateMode={dateMode}
            selectedLocation={currentLocation}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <div className="space-y-4">
            {/* Transaction Management */}
            <div className="space-y-4">
              {/* Search and Filters Row */}
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transactions..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 w-[200px] md:w-[300px]"
                    />
                  </div>

                  {/* Location Buttons */}
                  <LocationButtons />

                  {/* Source Filter */}
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="client_portal">🛒 Client Portal</SelectItem>
                      <SelectItem value="pos">🏪 Point of Sale</SelectItem>
                      <SelectItem value="calendar">📅 Appointments</SelectItem>
                      <SelectItem value="manual">✏️ Manual Entry</SelectItem>
                      <SelectItem value="inventory">📦 Inventory</SelectItem>
                      <SelectItem value="home_service">🏠 Home Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    title="Refresh transactions"
                  >
                    Refresh
                  </Button>
                  <Button onClick={() => setIsTransactionDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Transaction
                  </Button>
                </div>
              </div>
            </div>
            {/* Simple Transactions Table */}
            <div className="rounded-md border overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2">Transaction ID</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Client</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Service</th>
                    <th className="px-2 py-2">Product</th>
                    <th className="px-2 py-2">Original amount</th>
                    <th className="px-2 py-2">Final Amount</th>
                    <th className="px-2 py-2">Payment Method</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-4">No transactions found.</td>
                    </tr>
                  ) : (
                    filteredTransactions.map(tx => {
                      const isConsolidated = tx.type === 'consolidated_sale';
                      return (
                        <tr key={tx.id} className="align-top border-b">
                          <td className="px-2 py-2 font-mono whitespace-nowrap">{tx.id}</td>
                          <td className="px-2 py-2">
                            <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                              {tx.source === 'calendar' ? 'Walk-in' : tx.source.charAt(0).toUpperCase() + tx.source.slice(1)}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{typeof tx.date === 'string' ? new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : tx.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{tx.clientName || ''}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{tx.type.replace('_', ' ')}</td>
                          <td className="px-2 py-2">
                            <div>{tx.description}</div>
                            {isConsolidated && tx.items && (
                              <div className="mt-1 text-xs text-gray-600">
                                {tx.items.map(item => (
                                  <div key={item.id} className="flex justify-between">
                                    <span>{item.name} {item.type === 'service' ? '(service)' : '(product)'}</span>
                                    <span>
                                      {item.discountApplied ? (
                                        <>
                                          <span className="line-through mr-1">{item.originalPrice}</span>
                                          <span className="text-green-700">{item.totalPrice}</span>
                                        </>
                                      ) : (
                                        <span>{item.totalPrice}</span>
                                      )}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {tx.discountPercentage && (
                              <div className="text-green-600 mt-1">{tx.discountPercentage}% discount applied to services</div>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {isConsolidated && tx.serviceAmount ? (
                              <span>QAR {tx.serviceAmount}</span>
                            ) : ''}
                          </td>
                          <td className="px-2 py-2">
                            {isConsolidated && tx.productAmount ? (
                              <span>QAR {tx.productAmount}</span>
                            ) : ''}
                          </td>
                          <td className="px-2 py-2">
                            {tx.originalServiceAmount && Number(tx.originalServiceAmount) > 0 ? (
                              tx.discountPercentage && Number(tx.discountPercentage) > 0 ? (
                                <span className="line-through text-gray-500">QAR {Number(tx.originalServiceAmount).toFixed(2)}</span>
                              ) : (
                                <span>QAR {Number(tx.originalServiceAmount).toFixed(2)}</span>
                              )
                            ) : (
                              tx.serviceAmount && Number(tx.serviceAmount) > 0 ? (
                                <span>QAR {Number(tx.serviceAmount).toFixed(2)}</span>
                              ) : ''
                            )}
                          </td>
                          <td className="px-2 py-2 font-bold">QAR {tx.amount}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{tx.paymentMethod}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{getLocationName(tx.location)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{tx.status}</span>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(tx)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePrintReceipt(tx)}>
                                  <Printer className="mr-2 h-4 w-4" />
                                  Print Receipt
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportPDF(tx)}>
                                  <Download className="mr-2 h-4 w-4" />
                                  Export to PDF
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="mb-4 flex justify-between items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px] md:w-[300px]"
              />
            </div>
            <Button onClick={() => setIsExpenseDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Expense
            </Button>
          </div>
          <Expenses search={search} dateRange={dateRange} selectedLocation={currentLocation} />
        </TabsContent>

        <TabsContent value="staff-costs">
          <StaffCosts dateRange={dateRange} />
        </TabsContent>

        <TabsContent value="reports">
          <Reports dateRange={dateRange} />
        </TabsContent>
      </Tabs>

      <NewTransactionDialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen} />
      <NewExpenseDialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen} />

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
        open={false} // TODO: Implement bulk export for accounting
        onOpenChange={() => {}}
        onExport={async () => {}} // TODO: Implement bulk export for accounting
        reportTypes={ACCOUNTING_REPORT_TYPES}
        isLoading={isExporting}
      />

      {/* Transaction Details Modal */}
      {isDetailsOpen && selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg max-w-xl w-full p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
              onClick={() => setIsDetailsOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold">Transaction Details</h2>
              <Button size="sm" variant="outline" onClick={() => handlePrintReceipt(selectedTransaction)}>
                <Printer className="h-4 w-4 mr-1" /> Print Receipt
              </Button>
            </div>
            <div className="text-sm text-gray-500 mb-4">
              Complete information for transaction {selectedTransaction.id}
            </div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="font-bold text-xl text-gray-900">QAR {selectedTransaction.amount}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Services: QAR {selectedTransaction.serviceAmount || 0} &nbsp;|
                  Products: QAR {selectedTransaction.productAmount || 0} &nbsp;|
                  Discount: QAR {selectedTransaction.discountAmount || 0}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Original services: {selectedTransaction.originalServiceAmount ? <span className="line-through">QAR {selectedTransaction.originalServiceAmount}</span> : '-'}
                  {selectedTransaction.discountPercentage ? <span className="ml-2 text-green-700">{selectedTransaction.discountPercentage}% discount applied</span> : null}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-mono text-xs text-gray-700 mb-1">{selectedTransaction.id}</span>
                <span className="text-xs text-gray-500">{typeof selectedTransaction.date === 'string' ? new Date(selectedTransaction.date).toLocaleString() : selectedTransaction.date.toLocaleString()}</span>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium mt-2 ${selectedTransaction.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{selectedTransaction.status}</span>
              </div>
            </div>
            {/* Itemized breakdown */}
            {selectedTransaction.items && selectedTransaction.items.length > 0 && (
              <div className="mb-4">
                <div className="font-semibold mb-2">Items</div>
                <table className="w-full text-xs border rounded">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-right">Original Price</th>
                      <th className="p-2 text-right">Discount</th>
                      <th className="p-2 text-right">Final Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items.map(item => (
                      <tr key={item.id}>
                        <td className="p-2">{item.name}</td>
                        <td className="p-2">{item.type}</td>
                        <td className="p-2 text-right">{item.discountApplied ? <span className="line-through">QAR {item.originalPrice}</span> : <>QAR {item.originalPrice}</>}</td>
                        <td className="p-2 text-right">{item.discountApplied ? `${item.discountPercentage || 0}%` : '-'}</td>
                        <td className="p-2 text-right font-bold">QAR {item.totalPrice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <hr className="my-3" />
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-500">Source</div>
                <div className="font-medium">{selectedTransaction.source === 'calendar' ? 'Walk-in' : selectedTransaction.source.charAt(0).toUpperCase() + selectedTransaction.source.slice(1)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Payment Method</div>
                <div className="font-medium">{selectedTransaction.paymentMethod}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Client</div>
                <div className="font-medium">{selectedTransaction.clientName || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Location</div>
                <div className="font-medium">{getLocationName(selectedTransaction.location)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Staff</div>
                <div className="font-medium">{selectedTransaction.staffName || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Type</div>
                <div className="font-medium">{selectedTransaction.type.replace('_', ' ')}</div>
              </div>
            </div>
            {selectedTransaction.discountPercentage ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-2">
                <div className="font-semibold mb-2 text-green-800">Discount Applied</div>
                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                  <div>
                    <div className="text-gray-500">Discount Percentage</div>
                    <div className="font-bold">{selectedTransaction.discountPercentage}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Discount Amount</div>
                    <div className="font-bold">QAR {selectedTransaction.discountAmount}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Original Total</div>
                    <div className="font-bold line-through">QAR {selectedTransaction.originalServiceAmount}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Final Amount Paid</div>
                    <div className="font-bold text-green-700">QAR {selectedTransaction.amount}</div>
                  </div>
                </div>
                <div className="text-green-700 font-medium mt-2">{selectedTransaction.discountPercentage}% discount applied to services. You saved QAR {selectedTransaction.discountAmount}!</div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

