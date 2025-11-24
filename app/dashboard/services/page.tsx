"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ServicesList } from "@/components/services/services-list"
import { ServiceCategories } from "@/components/services/service-categories"
import { NewServiceDialog } from "@/components/services/new-service-dialog"
import { NewCategoryDialog } from "@/components/services/new-category-dialog"
import { LocationUpdateNotification } from "@/components/services/location-update-notification"
import { AccessDenied } from "@/components/access-denied"
import { Plus, Search } from "lucide-react"

export default function ServicesPage() {
  const { currentLocation, hasPermission } = useAuth()
  const { getLocationName, refreshLocations } = useLocations()
  const [search, setSearch] = useState("")
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false)
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false)

  // Check if user has permission to view services page
  if (!hasPermission("view_services")) {
    return (
      <AccessDenied
        description="You don't have permission to view the services management page."
        backButtonHref="/dashboard/appointments"
      />
    )
  }

  // Refresh locations when the page loads
  useEffect(() => {
    refreshLocations()
  }, [])

  return (
    <div className="space-y-6">
      <LocationUpdateNotification />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Services Management</h2>
          <p className="text-muted-foreground">
            {currentLocation === "all"
              ? "Manage services across all locations"
              : `Manage services at ${getLocationName(currentLocation)} location`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[200px] md:w-[300px]"
            />
          </div>
          <Button onClick={() => setIsServiceDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </div>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="services">
          <ServicesList search={search} />
        </TabsContent>

        <TabsContent value="categories">
          <div className="flex justify-end mb-4">
            <Button onClick={() => setIsCategoryDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </div>
          <ServiceCategories search={search} />
        </TabsContent>
      </Tabs>

      <NewServiceDialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen} />
      <NewCategoryDialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen} />
    </div>
  )
}

