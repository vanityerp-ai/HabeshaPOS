"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useLocations } from "@/lib/location-provider"
import { useClients } from "@/lib/client-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ClientDirectory } from "@/components/clients/client-directory"
import { ClientSegments } from "@/components/clients/client-segments"
import { EnhancedClientCommunication } from "@/components/clients/enhanced-client-communication"
import { EnhancedNewClientDialog } from "@/components/clients/enhanced-new-client-dialog"
import { AccessDenied } from "@/components/access-denied"
import { Plus, Search, RefreshCw } from "lucide-react"

export default function ClientsPage() {
  const { user, currentLocation, hasPermission } = useAuth()
  const { getLocationName } = useLocations()
  const { clients, refreshClients } = useClients()
  const [search, setSearch] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if user has permission to view clients page
  if (!hasPermission("view_clients")) {
    return (
      <AccessDenied
        description="You don't have permission to view the client management page."
        backButtonHref="/dashboard/appointments"
      />
    )
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshClients()
      console.log("Clients refreshed successfully")
    } catch (error) {
      console.error("Error refreshing clients:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Client Management</h2>
          <p className="text-muted-foreground">
            {currentLocation === "all"
              ? "Manage clients across all locations"
              : `Manage clients at ${getLocationName(currentLocation)} location`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-[200px] md:w-[300px]"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh ({clients.length})
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      <Tabs defaultValue="directory" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="segments">Segments</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <ClientDirectory search={search} />
        </TabsContent>

        <TabsContent value="segments">
          <ClientSegments />
        </TabsContent>

        <TabsContent value="communication">
          <EnhancedClientCommunication />
        </TabsContent>
      </Tabs>

      <EnhancedNewClientDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  )
}

