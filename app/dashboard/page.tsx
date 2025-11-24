"use client"

import { useState, Suspense, lazy, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { DashboardFilters } from "@/components/dashboard/dashboard-filters"
import type { DateRange } from "react-day-picker"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { useAuth } from "@/lib/auth-provider"

// Lazy load components to improve initial page load performance
const RevenueChart = lazy(() => import("@/components/dashboard/revenue-chart").then(mod => ({ default: mod.RevenueChart })))
const RecentSales = lazy(() => import("@/components/dashboard/recent-sales").then(mod => ({ default: mod.RecentSales })))
const PopularServices = lazy(() => import("@/components/dashboard/popular-services").then(mod => ({ default: mod.PopularServices })))
const StaffPerformance = lazy(() => import("@/components/dashboard/staff-performance").then(mod => ({ default: mod.StaffPerformance })))
const UpcomingTasks = lazy(() => import("@/components/dashboard/upcoming-tasks").then(mod => ({ default: mod.UpcomingTasks })))
const TodaysAppointments = lazy(() => import("@/components/dashboard/todays-appointments").then(mod => ({ default: mod.TodaysAppointments })))
const InventoryAlerts = lazy(() => import("@/components/dashboard/inventory-alerts").then(mod => ({ default: mod.InventoryAlerts })))
const LocationPerformance = lazy(() => import("@/components/dashboard/location-performance").then(mod => ({ default: mod.LocationPerformance })))
const IntegratedOverview = lazy(() => import("@/components/dashboard/integrated-overview"))
const ActivityFeed = lazy(() => import("@/components/chat/activity-feed").then(mod => ({ default: mod.ActivityFeed })))
const TransactionOverview = lazy(() => import("@/components/dashboard/transaction-overview").then(mod => ({ default: mod.TransactionOverview })))
const SalesAnalytics = lazy(() => import("@/components/dashboard/sales-analytics").then(mod => ({ default: mod.SalesAnalytics })))
import { useDocumentAlertCounts } from "@/components/dashboard/document-alerts"
import { useInventoryAlertCounts } from "@/components/dashboard/inventory-alerts"
import { AlertSummary } from "@/components/dashboard/alert-summary"
const DocumentAlerts = lazy(() => import("@/components/dashboard/document-alerts").then(mod => ({ default: mod.DocumentAlerts })))


// Loading fallbacks for lazy-loaded components
const ChartSkeleton = () => <Skeleton className="h-[300px] w-full" />
const CardSkeleton = () => (
  <Card>
    <CardHeader className="pb-2">
      <Skeleton className="h-5 w-1/3" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-[200px] w-full" />
    </CardContent>
  </Card>
)

export default function DashboardPage() {
  const { hasPermission, user, getFirstAccessiblePage } = useAuth()
  const router = useRouter()
  const documentAlertCounts = useDocumentAlertCounts()
  const inventoryAlertCounts = useInventoryAlertCounts()
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(),
    to: new Date()
  })

  const [activeTab, setActiveTab] = useState("overview")

  const handleDateRangeChange = (newDateRange: DateRange) => {
    setDateRange(newDateRange)
  }

  const handleNavigateToAlerts = (alertType: string) => {
    setActiveTab(alertType)
  }

  // Smart redirect: If user doesn't have dashboard access, redirect to first accessible page
  useEffect(() => {
    if (user && !hasPermission("view_dashboard")) {
      const firstAccessiblePage = getFirstAccessiblePage()
      console.log(`🔀 User "${user.name}" doesn't have dashboard access. Redirecting to: ${firstAccessiblePage}`)
      router.push(firstAccessiblePage)
    }
  }, [user, hasPermission, getFirstAccessiblePage, router])

  // Don't render anything if user doesn't have permission (will redirect)
  if (!hasPermission("view_dashboard")) {
    return null
  }

  return (
    <div className="space-y-6">
      <DashboardFilters onDateRangeChange={handleDateRangeChange} className="mb-6" />

      {/* Alert Summary Banner */}
      <AlertSummary onNavigateToAlerts={handleNavigateToAlerts} />

      <StatsCards dateRange={dateRange} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="sales">Sales Analytics</TabsTrigger>
          <TabsTrigger value="today">Today's Appointments</TabsTrigger>
          <TabsTrigger value="staff">Staff Performance</TabsTrigger>
          <TabsTrigger value="location">Location Performance</TabsTrigger>
          <TabsTrigger value="inventory">
            Inventory Alerts
            {(inventoryAlertCounts.lowStock > 0 || inventoryAlertCounts.expiring > 0) && (
              <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                {inventoryAlertCounts.lowStock + inventoryAlertCounts.expiring}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents">
            Document Alerts
            {(documentAlertCounts.expired > 0 || documentAlertCounts.expiringSoon > 0 ||
              documentAlertCounts.staffExpired > 0 || documentAlertCounts.staffExpiringSoon > 0) && (
              <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                {documentAlertCounts.expired + documentAlertCounts.expiringSoon +
                 documentAlertCounts.staffExpired + documentAlertCounts.staffExpiringSoon}
              </span>
            )}
          </TabsTrigger>

        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-bold">Revenue Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<ChartSkeleton />}>
                  <RevenueChart dateRange={dateRange} />
                </Suspense>
              </CardContent>
            </Card>

            <Suspense fallback={<CardSkeleton />}>
              <RecentSales />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Suspense fallback={<CardSkeleton />}>
              <PopularServices />
            </Suspense>
            <Suspense fallback={<CardSkeleton />}>
              <StaffPerformance />
            </Suspense>
            <Suspense fallback={<CardSkeleton />}>
              <UpcomingTasks />
            </Suspense>
            <Suspense fallback={<CardSkeleton />}>
              <ActivityFeed />
            </Suspense>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Suspense fallback={<div className="space-y-4">{Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>}>
            <IntegratedOverview dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="transactions">
          <Suspense fallback={<div className="space-y-4">{Array(3).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>}>
            <TransactionOverview />
          </Suspense>
        </TabsContent>

        <TabsContent value="sales">
          <Suspense fallback={<div className="space-y-4">{Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>}>
            <SalesAnalytics />
          </Suspense>
        </TabsContent>

        <TabsContent value="today">
          <Suspense fallback={<div className="space-y-4">{Array(3).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>}>
            <TodaysAppointments />
          </Suspense>
        </TabsContent>

        <TabsContent value="staff">
          <Suspense fallback={<div className="space-y-4">{Array(2).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>}>
            <StaffPerformance fullView />
          </Suspense>
        </TabsContent>

        <TabsContent value="location">
          <Suspense fallback={<div className="space-y-4">{Array(2).fill(0).map((_, i) => <CardSkeleton key={i} />)}</div>}>
            <LocationPerformance />
          </Suspense>
        </TabsContent>

        <TabsContent value="inventory">
          <Suspense fallback={<CardSkeleton />}>
            <InventoryAlerts />
          </Suspense>
        </TabsContent>

        <TabsContent value="documents">
          <Suspense fallback={<CardSkeleton />}>
            <DocumentAlerts />
          </Suspense>
        </TabsContent>

      </Tabs>
    </div>
  )
}

