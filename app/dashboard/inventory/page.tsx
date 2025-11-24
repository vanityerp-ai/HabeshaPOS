"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useProducts, type Product as ProviderProduct } from "@/lib/product-provider"
import { useLocations } from "@/lib/location-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NewProductDialog } from "@/components/inventory/new-product-dialog"
import { NewProfessionalProductDialog } from "@/components/inventory/new-professional-product-dialog"
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog"
import { ProductEditDialog } from "@/components/inventory/product-edit-dialog"
import { CategoryManagementDialog } from "@/components/inventory/category-management-dialog"
import { ProductTransferDialog } from "@/components/inventory/product-transfer-dialog"
import { TransferDetailsDialog } from "@/components/inventory/transfer-details-dialog"
import { LocationStockDisplay, LocationStockHorizontal } from "@/components/inventory/location-stock-display"
import { LocationStockColumns } from "@/components/inventory/location-stock-columns"
import { MultiLocationStockDialog } from "@/components/inventory/multi-location-stock-dialog"
import { AccessDenied } from "@/components/access-denied"
import { AlertCircle, Plus, Search, Eye, EyeOff, Edit, Star, ShoppingCart, Image as ImageIcon, Settings, ArrowRightLeft, Loader2, Download, Database, Calendar, Filter, BarChart3, TrendingUp, MapPin, Package, User, FileText, X } from "lucide-react"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { useCurrency } from "@/lib/currency-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"

// Use Product type from provider
type Product = ProviderProduct

interface ProductLocation {
  id: string
  productId: string
  locationId: string
  stock: number
  price?: number
  isActive: boolean
  location?: {
    id: string
    name: string
  }
}

export default function InventoryPage() {
  const { currentLocation, hasPermission } = useAuth()

  // Check if user has permission to view inventory page
  if (!hasPermission("view_inventory")) {
    return (
      <AccessDenied
        description="You don't have permission to view the inventory management page."
        backButtonHref="/dashboard/appointments"
      />
    )
  }
  const { formatCurrency } = useCurrency()
  const { products, transfers, getTransferById, cancelTransfer, refreshProducts, isLoading, error } = useProducts()
  const { locations, getLocationById, getLocationName, getActiveLocations } = useLocations()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("all")


  const [isNewProductDialogOpen, setIsNewProductDialogOpen] = useState(false)
  const [isNewProfessionalProductDialogOpen, setIsNewProfessionalProductDialogOpen] = useState(false)
  const [isStockAdjustmentDialogOpen, setIsStockAdjustmentDialogOpen] = useState(false)
  const [isProductEditDialogOpen, setIsProductEditDialogOpen] = useState(false)
  const [isCategoryManagementDialogOpen, setIsCategoryManagementDialogOpen] = useState(false)
  const [isProductTransferDialogOpen, setIsProductTransferDialogOpen] = useState(false)
  const [isMultiLocationStockDialogOpen, setIsMultiLocationStockDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  // Transfer tab state
  const [transferSearch, setTransferSearch] = useState("")
  const [transferDateFilter, setTransferDateFilter] = useState("all")
  const [transferLocationFilter, setTransferLocationFilter] = useState("all")
  const [transferStatusFilter, setTransferStatusFilter] = useState("all")
  const [transferProductFilter, setTransferProductFilter] = useState("all")
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null)
  const [isTransferDetailsOpen, setIsTransferDetailsOpen] = useState(false)

  // Database-driven product data state
  const [isSeeding, setIsSeeding] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Use the ProductProvider's refresh function
  const fetchProducts = refreshProducts

  // Seed database with comprehensive product catalog
  const seedDatabase = async () => {
    setIsSeeding(true)
    try {
      const response = await fetch('/api/products/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to seed database')
      }

      const result = await response.json()
      console.log('✅ Database seeded successfully:', result)

      // Refresh products after seeding
      await refreshProducts()
    } catch (err) {
      console.error('❌ Error seeding database:', err)
      // Error is already logged to console
    } finally {
      setIsSeeding(false)
    }
  }

  // Add stock to all locations for all products
  const addStockToAllLocations = async () => {
    setIsSeeding(true)
    try {
      const response = await fetch('/api/inventory/add-stock-all-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stockToAdd: 10 })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add stock to all locations')
      }

      const result = await response.json()
      console.log('✅ Stock added successfully:', result)

      // Show success message
      alert(`✅ Success!\n\nAdded 10 stock to each location for ${result.result.productsUpdated} products.\n\nLocations updated: ${result.result.locations.map((l: any) => l.name).join(', ')}`)

      // Refresh products to show updated stock levels
      await refreshProducts()
    } catch (err) {
      console.error('❌ Error adding stock:', err)
      alert(`❌ Error: ${err instanceof Error ? err.message : "Failed to add stock to all locations"}`)
    } finally {
      setIsSeeding(false)
    }
  }

  // Fetch data on component mount and when location changes
  useEffect(() => {
    refreshProducts()
  }, [currentLocation, refreshProducts])

  // Note: No need for separate transfer refresh effect since ProductProvider handles this

  // Check if user has permission to view inventory page
  if (!hasPermission("view_inventory")) {
    return (
      <AccessDenied
        description="You don't have permission to view the inventory management page."
        backButtonHref="/dashboard"
      />
    )
  }

  // Get stock for current location with validation
  const getProductStock = (product: ProviderProduct): number => {
    // Validate product input
    if (!product) {
      console.warn("⚠️ getProductStock called with null/undefined product")
      return 0
    }

    // If product has location-specific stock data, use it
    if (product.locations && product.locations.length > 0) {
      if (currentLocation === "all") {
        const totalStock = product.locations.reduce((total, loc) => {
          const stock = loc.stock || 0
          if (stock < 0) {
            console.warn(`⚠️ Negative stock detected for product ${product.name} at location ${loc.locationId}: ${stock}`)
          }
          return total + stock
        }, 0)
        return Math.max(0, totalStock) // Ensure non-negative result
      }

      // For retail products in the retail tab, show stock from any available location
      if (activeTab === "retail" && product.isRetail) {
        // First try to find online store stock by matching location name
        const onlineLocation = product.locations.find(loc => {
          const location = locations.find(l => l.id === loc.locationId)
          return location?.name?.toLowerCase().includes('online')
        })
        if (onlineLocation) {
          const stock = onlineLocation.stock || 0
          return Math.max(0, stock) // Ensure non-negative result
        }

        // If no online stock found, return total stock from all locations
        const totalStock = product.locations.reduce((total, loc) => {
          const stock = loc.stock || 0
          return total + stock
        }, 0)
        return Math.max(0, totalStock) // Ensure non-negative result
      }

      const locationStock = product.locations.find(loc => loc.locationId === currentLocation)
      const stock = locationStock?.stock || 0

      // Log stock retrieval for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Stock for ${product.name} at ${currentLocation}: ${stock}`)
      }

      return Math.max(0, stock) // Ensure non-negative result
    }

    // Fallback to product.stock property for products without location-specific data
    const fallbackStock = (product as any).stock || 0
    if (process.env.NODE_ENV === 'development' && fallbackStock > 0) {
      console.log(`📊 Using fallback stock for ${product.name}: ${fallbackStock}`)
    }
    return Math.max(0, fallbackStock) // Ensure non-negative result
  }

  // Get minimum stock level (using product's minStock or 5 as default)
  const getMinStock = (product: ProviderProduct): number => {
    return (product as any).minStock || 5 // Use product's minStock or default to 5
  }

  // Validate and auto-fix stock data integrity after changes
  const validateStockData = (productId?: string) => {
    if (!products || products.length === 0) return true

    const productsToCheck = productId
      ? products.filter(p => p.id === productId)
      : products

    let issuesFound = 0
    let issuesFixed = 0

    productsToCheck.forEach(product => {
      if (!product.locations || product.locations.length === 0) {
        console.warn(`⚠️ Product ${product.name} has no location data - this is expected for some products`)
        return // Don't count this as an error
      }

      product.locations.forEach(location => {
        // Auto-fix negative stock
        if (location.stock < 0) {
          console.warn(`🔧 Auto-fixing negative stock: ${product.name} at location ${location.locationId}: ${location.stock} → 0`)
          location.stock = 0
          issuesFixed++
        }

        // Auto-fix non-integer stock
        if (location.stock !== Math.floor(location.stock)) {
          const originalStock = location.stock
          location.stock = Math.floor(location.stock)
          console.warn(`🔧 Auto-fixing non-integer stock: ${product.name} at location ${location.locationId}: ${originalStock} → ${location.stock}`)
          issuesFixed++
        }

        // Auto-fix invalid stock types
        if (typeof location.stock !== 'number' || isNaN(location.stock)) {
          console.warn(`🔧 Auto-fixing invalid stock type: ${product.name} at location ${location.locationId}: ${location.stock} → 0`)
          location.stock = 0
          issuesFixed++
        }
      })
    })

    if (issuesFixed > 0) {
      console.log(`🔧 Stock validation auto-fixed ${issuesFixed} issue(s) for ${productsToCheck.length} product(s)`)
    } else {
      console.log(`✅ Stock validation passed for ${productsToCheck.length} product(s)`)
    }

    return true // Always return true since we auto-fix issues
  }

  // Filter products based on search term and active tab
  const filteredProducts = React.useMemo(() => {
    if (!products || products.length === 0) {
      return []
    }

    return products.filter((product) => {
      // Filter by search term
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          product.name.toLowerCase().includes(searchLower) ||
          (product.sku && product.sku.toLowerCase().includes(searchLower)) ||
          (product.barcode && product.barcode.toLowerCase().includes(searchLower)) ||
          product.category.toLowerCase().includes(searchLower)

        if (!matchesSearch) return false
      }

      // Filter by tab
      if (activeTab === "retail" && !product.isRetail) {
        return false
      }

      if (activeTab === "professional" && product.isRetail) {
        return false
      }

      if (activeTab === "low-stock") {
        const stock = getProductStock(product)
        const minStock = getMinStock(product)
        if (stock >= minStock) return false
      }

      return true
    })
  }, [products, search, activeTab, getProductStock, getMinStock])



  const handleAdjustStock = (product: any) => {
    setSelectedProduct(product)
    setIsStockAdjustmentDialogOpen(true)
  }

  const handleEditProduct = (product: any) => {
    setSelectedProduct(product)

    // Check if this is a professional product (not retail)
    if (!product.isRetail) {
      // Open professional product dialog in edit mode
      setIsNewProfessionalProductDialogOpen(true)
    } else {
      // Open regular product edit dialog for retail products
      setIsProductEditDialogOpen(true)
    }
  }

  const handleTransferProduct = (product: any) => {
    setSelectedProduct(product)
    setIsProductTransferDialogOpen(true)
  }

  const handleMultiLocationStockEdit = (product: any) => {
    setSelectedProduct(product)
    setIsMultiLocationStockDialogOpen(true)
  }

  const handleStockAdjusted = async () => {
    console.log("🔄 Stock adjusted - force refreshing inventory data...")
    try {
      // Trigger immediate re-render
      setRefreshKey(prev => prev + 1)

      // Perform multiple refresh attempts with proper error handling
      const maxRetries = 3
      let retryCount = 0

      const performRefresh = async (): Promise<void> => {
        try {
          console.log(`🔄 Refresh attempt ${retryCount + 1}/${maxRetries}...`)
          await refreshProducts()
          console.log(`✅ Refresh attempt ${retryCount + 1} successful`)

          // Update refresh key to trigger UI re-render
          setRefreshKey(prev => prev + 1)

          // If this is not the last attempt, wait before next refresh
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (error) {
          console.error(`❌ Refresh attempt ${retryCount + 1} failed:`, error)
          if (retryCount === maxRetries - 1) {
            throw error // Re-throw on final attempt
          }
        }
      }

      // Perform all refresh attempts
      for (retryCount = 0; retryCount < maxRetries; retryCount++) {
        await performRefresh()
      }

      console.log("✅ All inventory data refresh attempts completed")

      // Validate stock data after refresh
      setTimeout(() => {
        try {
          validateStockData()
        } catch (validationError) {
          console.warn('⚠️ Stock validation encountered an error (non-critical):', validationError)
          // Don't throw the error - validation issues are auto-fixed
        }
      }, 100) // Small delay to ensure state has updated

    } catch (error) {
      console.error("❌ Error refreshing inventory data:", error)
      // Show user-friendly error message
      toast({
        variant: "destructive",
        title: "Refresh Error",
        description: "Failed to refresh inventory data. Please refresh the page manually.",
      })
    }
  }

  // Export inventory data to CSV
  const exportInventoryData = () => {
    const csvHeaders = [
      'Product Name',
      'SKU',
      'Category',
      'Type',
      'Retail Price',
      'Cost Price',
      'Stock',
      'Min Stock',
      'Max Stock',
      'Status',
      'Location'
    ]

    const csvData = products.map(product => [
      product.name,
      product.sku,
      product.category,
      product.type,
      product.price,
      product.cost,
      product.stock,
      product.minStock,
      (product as any).maxStock || '',
      product.isRetail ? 'Retail' : 'Professional',
      product.location
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `inventory-${currentLocation}-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export transfer data to CSV
  const exportTransferData = () => {
    const csvHeaders = [
      'Transfer ID',
      'Date Created',
      'Product Name',
      'Product ID',
      'From Location',
      'To Location',
      'Quantity',
      'Status',
      'Created By',
      'Completed Date',
      'Notes'
    ]

    const csvData = transfers.map(transfer => [
      transfer.id,
      format(new Date(transfer.createdAt), "yyyy-MM-dd HH:mm:ss"),
      transfer.productName,
      transfer.productId,
      getLocationName(transfer.fromLocationId),
      getLocationName(transfer.toLocationId),
      transfer.quantity,
      transfer.status,
      transfer.createdBy,
      transfer.completedAt ? format(new Date(transfer.completedAt), "yyyy-MM-dd HH:mm:ss") : '',
      transfer.notes || ''
    ])

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `transfers-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const lowStockCount = products.filter((product) => {
    const stock = getProductStock(product)
    const minStock = getMinStock(product)
    return stock < minStock
  }).length

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
            <p className="text-muted-foreground">Loading inventory data...</p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading inventory...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Inventory Management</h2>
          <p className="text-muted-foreground">
            {currentLocation === "all"
              ? "Manage inventory across all locations"
              : `Manage inventory at ${locations.find(l => l.id === currentLocation)?.name || "selected"} location`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {products.length === 0 && !isLoading && (
            <Button
              variant="outline"
              onClick={seedDatabase}
              disabled={isSeeding}
              title="Populate database with comprehensive product catalog"
            >
              {isSeeding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {isSeeding ? "Seeding..." : "Seed Database"}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => exportInventoryData()}
            title="Export inventory data to CSV"
            disabled={products.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            variant="outline"
            onClick={addStockToAllLocations}
            disabled={isSeeding}
            title="Add 10 stock to all locations for all products"
          >
            {isSeeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            Add Stock
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsCategoryManagementDialogOpen(true)}
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage Categories
          </Button>
          {hasPermission("create_inventory") && (
            <Button onClick={() => setIsNewProductDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Inventory</AlertTitle>
          <AlertDescription>
            {error}. Please refresh the page or contact support if the issue persists.
          </AlertDescription>
        </Alert>
      )}



      {lowStockCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            {lowStockCount} product{lowStockCount > 1 ? "s" : ""} {lowStockCount > 1 ? "are" : "is"} below the minimum
            stock level.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-0 pb-2">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>Product Inventory</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <CardDescription>Manage your salon's retail and professional products. Retail products automatically appear in the client shop.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Products</TabsTrigger>
              <TabsTrigger value="retail">Retail & Shop</TabsTrigger>
              <TabsTrigger value="professional">Professional Use</TabsTrigger>
              <TabsTrigger value="low-stock" className="relative">
                Low Stock
                {lowStockCount > 0 && (
                  <Badge variant="destructive" className="ml-2 px-1.5 py-0.5 h-5 min-w-5 text-xs">
                    {lowStockCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="transfers">
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfers
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      {(() => {
                        const activeLocations = getActiveLocations()
                        const expectedLocationNames = ['D-Ring Road', 'Muaither', 'Medinat Khalifa', 'Online Store']

                        // Sort locations to match the expected order, with any additional locations at the end
                        const sortedLocations = [...activeLocations].sort((a, b) => {
                          const aIndex = expectedLocationNames.indexOf(a.name)
                          const bIndex = expectedLocationNames.indexOf(b.name)

                          // If both locations are in expected list, sort by their expected order
                          if (aIndex !== -1 && bIndex !== -1) {
                            return aIndex - bIndex
                          }

                          // If only one is in expected list, prioritize it
                          if (aIndex !== -1) return -1
                          if (bIndex !== -1) return 1

                          // If neither is in expected list, sort alphabetically
                          return a.name.localeCompare(b.name)
                        })

                        return sortedLocations.map((location) => (
                          <TableHead key={location.id} className="text-center">
                            <div className="flex flex-col items-center">
                              <MapPin className="h-3 w-3 mb-1 text-gray-500" />
                              <span className="text-xs">{location.name}</span>
                            </div>
                          </TableHead>
                        ))
                      })()}
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7 + getActiveLocations().length} className="h-24 text-center">
                          No products found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => {
                        return (
                          <TableRow key={`${product.id}-${refreshKey}`}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.sku || "-"}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className="text-right">
                              {product.price > 0 ? <CurrencyDisplay amount={product.price} /> : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {product.cost ? <CurrencyDisplay amount={product.cost} /> : "-"}
                            </TableCell>
                            <LocationStockColumns
                              key={`stock-${product.id}-${refreshKey}`}
                              product={product}
                              getMinStock={getMinStock}
                            />
                            <TableCell>
                              <Badge variant={product.isRetail ? "default" : "secondary"}>
                                {product.isRetail ? "Retail" : "Professional"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} title="Edit product">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleMultiLocationStockEdit(product)} title="Edit stock for all locations">
                                  <Package className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleAdjustStock(product)} title="Adjust stock (single location)">
                                  Adjust
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleTransferProduct(product)} title="Transfer stock">
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="retail" className="m-0">

              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-blue-900">E-commerce & Client Shop Management</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-blue-700">
                      Multi-Location Stock View
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        refreshProducts()
                      }}
                      title="Refresh product data"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addStockToAllLocations}
                      disabled={isSeeding}
                      title="Add 10 stock to all locations for all products"
                    >
                      {isSeeding ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Package className="mr-2 h-4 w-4" />
                      )}
                      Add Stock
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-blue-700">
                  Manage retail products that appear in your client portal shop. Stock levels are shown for each active location.
                </p>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      {(() => {
                        const activeLocations = getActiveLocations()
                        const expectedLocationNames = ['D-Ring Road', 'Muaither', 'Medinat Khalifa', 'Online Store']

                        // Sort locations to match the expected order, with any additional locations at the end
                        const sortedLocations = [...activeLocations].sort((a, b) => {
                          const aIndex = expectedLocationNames.indexOf(a.name)
                          const bIndex = expectedLocationNames.indexOf(b.name)

                          // If both locations are in expected list, sort by their expected order
                          if (aIndex !== -1 && bIndex !== -1) {
                            return aIndex - bIndex
                          }

                          // If only one is in expected list, prioritize it
                          if (aIndex !== -1) return -1
                          if (bIndex !== -1) return 1

                          // If neither is in expected list, sort alphabetically
                          return a.name.localeCompare(b.name)
                        })

                        return sortedLocations.map((location) => (
                          <TableHead key={location.id} className="text-center">
                            {location.name}
                          </TableHead>
                        ))
                      })()}
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Features</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8 + getActiveLocations().length} className="h-24 text-center">
                          No retail products found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => {
                        const stock = getProductStock(product)

                        return (
                          <TableRow key={`${product.id}-${refreshKey}`}>
                            <TableCell>
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                                  <ImageIcon className="h-4 w-4 text-gray-400" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{product.name}</div>
                                {product.rating && product.rating > 0 && (
                                  <div className="flex items-center gap-1 text-sm text-gray-500">
                                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    {product.rating} ({product.reviewCount} reviews)
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{product.sku || "-"}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <TableCell className="text-right">
                              <div>
                                {product.salePrice ? (
                                  <div>
                                    <div className="line-through text-gray-500 text-sm">
                                      <CurrencyDisplay amount={product.price} />
                                    </div>
                                    <div className="text-red-600 font-medium">
                                      <CurrencyDisplay amount={product.salePrice} />
                                    </div>
                                  </div>
                                ) : (
                                  <CurrencyDisplay amount={product.price} />
                                )}
                              </div>
                            </TableCell>
                            <LocationStockColumns
                              key={`stock-${product.id}-${refreshKey}`}
                              product={product}
                              getMinStock={getMinStock}
                            />
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center">
                                {product.isActive ? (
                                  <div title="Visible in shop">
                                    <Eye className="h-4 w-4 text-green-600" />
                                  </div>
                                ) : (
                                  <div title="Hidden from shop">
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-wrap gap-1 justify-center">
                                {product.isFeatured && (
                                  <Badge variant="default" className="text-xs">Featured</Badge>
                                )}
                                {product.isNew && (
                                  <Badge variant="secondary" className="text-xs">New</Badge>
                                )}
                                {product.isBestSeller && (
                                  <Badge variant="outline" className="text-xs">Best Seller</Badge>
                                )}
                                {product.isSale && (
                                  <Badge variant="destructive" className="text-xs">Sale</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} title="Edit product">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleMultiLocationStockEdit(product)} title="Edit stock for all locations">
                                  <Package className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleAdjustStock(product)} title="Adjust stock (single location)">
                                  Stock
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="professional" className="m-0">
              <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-amber-600" />
                    <h3 className="font-medium text-amber-900">Professional Use Products</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-amber-700">
                      {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                    </div>
                    {hasPermission("create_inventory") && (
                      <Button
                        size="sm"
                        onClick={() => setIsNewProfessionalProductDialogOpen(true)}
                        className="bg-amber-600 hover:bg-amber-700"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Professional Product
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-amber-700">
                  Manage products for professional salon use only. These products will not appear in the client shop and are used for internal operations.
                </p>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Details</TableHead>
                      <TableHead>SKU/Barcode</TableHead>
                      <TableHead>Category & Type</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      {(() => {
                        const activeLocations = getActiveLocations()
                        const expectedLocationNames = ['D-Ring Road', 'Muaither', 'Medinat Khalifa', 'Online Store']

                        // Sort locations to match the expected order, with any additional locations at the end
                        const sortedLocations = [...activeLocations].sort((a, b) => {
                          const aIndex = expectedLocationNames.indexOf(a.name)
                          const bIndex = expectedLocationNames.indexOf(b.name)

                          // If both locations are in expected list, sort by their expected order
                          if (aIndex !== -1 && bIndex !== -1) {
                            return aIndex - bIndex
                          }

                          // If only one is in expected list, prioritize it
                          if (aIndex !== -1) return -1
                          if (bIndex !== -1) return 1

                          // If neither is in expected list, sort alphabetically
                          return a.name.localeCompare(b.name)
                        })

                        return sortedLocations.map((location) => (
                          <TableHead key={location.id} className="text-center">
                            <div className="flex flex-col items-center">
                              <MapPin className="h-3 w-3 mb-1 text-gray-500" />
                              <span className="text-xs">{location.name}</span>
                            </div>
                          </TableHead>
                        ))
                      })()}
                      <TableHead className="text-center">Expiry Date</TableHead>
                      <TableHead className="text-center">Professional Info</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7 + getActiveLocations().length} className="h-24 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Settings className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <div className="font-medium">No professional products found</div>
                              <div className="text-sm text-muted-foreground">
                                {hasPermission("create_inventory")
                                  ? "Click 'Add Professional Product' to get started"
                                  : "No professional products have been added yet"
                                }
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => {
                        const stock = getProductStock(product)
                        const minStock = getMinStock(product)
                        const isLowStock = stock < minStock
                        const isOutOfStock = stock === 0





                        // Extract professional-specific info from features
                        const features = product.features || []
                        const hasTraining = features.some(f => f.includes("Requires Training"))
                        const isHazardous = features.some(f => f.includes("Hazardous Material"))
                        const usageInfo = features.find(f => f.startsWith("Usage:"))
                        const safetyInfo = features.find(f => f.startsWith("Safety:"))

                        // Extract expiry date from features or metadata
                        const expiryInfo = features.find(f => f.startsWith("Expiry:"))
                        const expiryDate = expiryInfo ? expiryInfo.replace("Expiry: ", "") :
                          ((product as any).metadata?.expiryDate || null)

                        // Format expiry date for display
                        const formatExpiryDate = (dateStr: string | null) => {
                          if (!dateStr) return null
                          try {
                            const date = new Date(dateStr)
                            if (isNaN(date.getTime())) return null
                            return date.toLocaleDateString()
                          } catch {
                            return null
                          }
                        }

                        const formattedExpiryDate = formatExpiryDate(expiryDate)
                        const isExpiringSoon = expiryDate ? new Date(expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : false
                        const isExpired = expiryDate ? new Date(expiryDate) <= new Date() : false

                        return (
                          <TableRow key={product.id} className={isOutOfStock ? "bg-red-50" : isLowStock ? "bg-yellow-50" : ""}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{product.name}</div>
                                {product.brand && (
                                  <div className="text-sm text-muted-foreground">Brand: {product.brand}</div>
                                )}
                                {product.description && (
                                  <div className="text-sm text-muted-foreground line-clamp-2">{product.description}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {product.sku && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">SKU:</span> {product.sku}
                                  </div>
                                )}
                                {product.barcode && (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Barcode:</span> {product.barcode}
                                  </div>
                                )}
                                {!product.sku && !product.barcode && (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Badge variant="outline">{product.category}</Badge>
                                {product.type && product.type !== product.category && (
                                  <div className="text-sm text-muted-foreground">{product.type}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {product.cost ? <CurrencyDisplay amount={product.cost} /> : "-"}
                            </TableCell>
                            <LocationStockColumns
                              key={`stock-${product.id}-${refreshKey}`}
                              product={product}
                              getMinStock={getMinStock}
                            />
                            <TableCell className="text-center">
                              {formattedExpiryDate ? (
                                <div className="space-y-1">
                                  <div className={`text-sm font-medium ${isExpired ? "text-red-600" :
                                      isExpiringSoon ? "text-yellow-600" :
                                        "text-gray-900"
                                    }`}>
                                    {formattedExpiryDate}
                                  </div>
                                  {isExpired && (
                                    <Badge variant="destructive" className="text-xs">
                                      Expired
                                    </Badge>
                                  )}
                                  {!isExpired && isExpiringSoon && (
                                    <Badge variant="secondary" className="text-xs">
                                      Expiring Soon
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No expiry</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                {hasTraining && (
                                  <Badge variant="secondary" className="text-xs">
                                    Training Required
                                  </Badge>
                                )}
                                {isHazardous && (
                                  <Badge variant="destructive" className="text-xs">
                                    Hazardous
                                  </Badge>
                                )}
                                {!hasTraining && !isHazardous && (
                                  <span className="text-xs text-muted-foreground">Standard</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditProduct(product)}
                                  title="Edit product details"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMultiLocationStockEdit(product)}
                                  title="Edit stock for all locations"
                                >
                                  <Package className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAdjustStock(product)}
                                  title="Adjust stock levels"
                                >
                                  Adjust
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTransferProduct(product)}
                                  title="Transfer between locations"
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Professional Products Summary */}
              {filteredProducts.length > 0 && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-sm font-medium text-blue-900">Total Products</div>
                    <div className="text-2xl font-bold text-blue-600">{filteredProducts.length}</div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-sm font-medium text-green-900">In Stock</div>
                    <div className="text-2xl font-bold text-green-600">
                      {filteredProducts.filter(p => getProductStock(p) > 0).length}
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-sm font-medium text-yellow-900">Low Stock</div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {filteredProducts.filter(p => {
                        const stock = getProductStock(p)
                        const minStock = getMinStock(p)
                        return stock > 0 && stock < minStock
                      }).length}
                    </div>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="text-sm font-medium text-red-900">Out of Stock</div>
                    <div className="text-2xl font-bold text-red-600">
                      {filteredProducts.filter(p => getProductStock(p) === 0).length}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="low-stock" className="m-0">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      {(() => {
                        const activeLocations = getActiveLocations()
                        const expectedLocationNames = ['D-Ring Road', 'Muaither', 'Medinat Khalifa', 'Online Store']

                        // Sort locations to match the expected order, with any additional locations at the end
                        const sortedLocations = [...activeLocations].sort((a, b) => {
                          const aIndex = expectedLocationNames.indexOf(a.name)
                          const bIndex = expectedLocationNames.indexOf(b.name)

                          // If both locations are in expected list, sort by their expected order
                          if (aIndex !== -1 && bIndex !== -1) {
                            return aIndex - bIndex
                          }

                          // If only one is in expected list, prioritize it
                          if (aIndex !== -1) return -1
                          if (bIndex !== -1) return 1

                          // If neither is in expected list, sort alphabetically
                          return a.name.localeCompare(b.name)
                        })

                        return sortedLocations.map((location) => (
                          <TableHead key={location.id} className="text-center">
                            <div className="flex flex-col items-center">
                              <MapPin className="h-3 w-3 mb-1 text-gray-500" />
                              <span className="text-xs">{location.name}</span>
                            </div>
                          </TableHead>
                        ))
                      })()}
                      <TableHead className="text-center">Min Stock</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6 + getActiveLocations().length} className="h-24 text-center">
                          No low stock products found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProducts.map((product) => {
                        const minStock = getMinStock(product)

                        return (
                          <TableRow key={`${product.id}-${refreshKey}`}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.sku || "-"}</TableCell>
                            <TableCell>{product.category}</TableCell>
                            <LocationStockColumns
                              key={`stock-${product.id}-${refreshKey}`}
                              product={product}
                              getMinStock={getMinStock}
                            />
                            <TableCell className="text-center">
                              <Badge variant="outline" className="w-16">
                                {minStock}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={product.isRetail ? "default" : "secondary"}>
                                {product.isRetail ? "Retail" : "Professional"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => handleEditProduct(product)} title="Edit product">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleMultiLocationStockEdit(product)} title="Edit stock for all locations">
                                  <Package className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleAdjustStock(product)} title="Adjust stock (single location)">
                                  Adjust
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleTransferProduct(product)} title="Transfer stock">
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="transfers" className="m-0">
              <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-green-900">Product Transfer Management</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-green-700">
                      {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} total
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportTransferData}
                      disabled={transfers.length === 0}
                      title="Export transfer data to CSV"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                    {hasPermission("create_inventory") && (
                      <Button
                        size="sm"
                        onClick={() => setIsProductTransferDialogOpen(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        New Transfer
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-green-700">
                  Track and manage inventory transfers between salon locations. Monitor transfer history and status.
                </p>
              </div>

              {/* Transfer Filters */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transfers..."
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={transferDateFilter} onValueChange={setTransferDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 days</SelectItem>
                    <SelectItem value="month">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={transferLocationFilter} onValueChange={setTransferLocationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={transferStatusFilter} onValueChange={setTransferStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransferSearch("")
                    setTransferDateFilter("all")
                    setTransferLocationFilter("all")
                    setTransferStatusFilter("all")
                    setTransferProductFilter("all")
                  }}
                  className="w-full"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Filters
                </Button>
              </div>

              {/* Transfer Statistics */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <div className="text-sm font-medium text-blue-900">Total Transfers</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{transfers.length}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <div className="text-sm font-medium text-green-900">Completed</div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {transfers.filter(t => t.status === 'completed').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-yellow-600" />
                      <div className="text-sm font-medium text-yellow-900">Pending</div>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {transfers.filter(t => t.status === 'pending').length}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-red-600" />
                      <div className="text-sm font-medium text-red-900">Cancelled</div>
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                      {transfers.filter(t => t.status === 'cancelled').length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transfer Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transfer ID</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-center">Quantity</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
                            <div>
                              <div className="font-medium">No transfers found</div>
                              <div className="text-sm text-muted-foreground">
                                {hasPermission("create_inventory")
                                  ? "Click 'New Transfer' to create your first transfer"
                                  : "No transfers have been created yet"
                                }
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      transfers
                        .filter((transfer) => {
                          // Apply search filter
                          if (transferSearch) {
                            const searchLower = transferSearch.toLowerCase()
                            const matchesSearch =
                              transfer.id.toLowerCase().includes(searchLower) ||
                              transfer.productName.toLowerCase().includes(searchLower) ||
                              transfer.createdBy.toLowerCase().includes(searchLower) ||
                              (transfer.notes && transfer.notes.toLowerCase().includes(searchLower))
                            if (!matchesSearch) return false
                          }

                          // Apply date filter
                          if (transferDateFilter !== "all") {
                            const transferDate = new Date(transfer.createdAt)
                            const now = new Date()
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

                            switch (transferDateFilter) {
                              case "today":
                                if (transferDate < today) return false
                                break
                              case "week":
                                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                                if (transferDate < weekAgo) return false
                                break
                              case "month":
                                const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                                if (transferDate < monthAgo) return false
                                break
                            }
                          }

                          // Apply location filter
                          if (transferLocationFilter !== "all") {
                            if (transfer.fromLocationId !== transferLocationFilter &&
                              transfer.toLocationId !== transferLocationFilter) {
                              return false
                            }
                          }

                          // Apply status filter
                          if (transferStatusFilter !== "all" && transfer.status !== transferStatusFilter) {
                            return false
                          }

                          return true
                        })
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((transfer) => {
                          const fromLocation = getLocationById(transfer.fromLocationId)
                          const toLocation = getLocationById(transfer.toLocationId)

                          return (
                            <TableRow key={transfer.id}>
                              <TableCell className="font-mono text-sm">
                                {transfer.id.slice(0, 8)}...
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">
                                    {format(new Date(transfer.createdAt), "MMM dd, yyyy")}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(transfer.createdAt), "HH:mm")}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">{transfer.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    ID: {transfer.productId.slice(0, 8)}...
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-blue-600" />
                                    <span className="text-sm">{fromLocation?.name || 'Unknown'}</span>
                                  </div>
                                  <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                                  <div className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-green-600" />
                                    <span className="text-sm">{toLocation?.name || 'Unknown'}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline" className="w-16">
                                  {transfer.quantity}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={
                                    transfer.status === 'completed' ? 'default' :
                                      transfer.status === 'pending' ? 'secondary' :
                                        'destructive'
                                  }
                                >
                                  {transfer.status.charAt(0).toUpperCase() + transfer.status.slice(1)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-sm">{transfer.createdBy}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTransfer(transfer)
                                      setIsTransferDetailsOpen(true)
                                    }}
                                    title="View transfer details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  {transfer.status === 'pending' && hasPermission("edit_inventory") && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => cancelTransfer(transfer.id)}
                                      title="Cancel transfer"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {isNewProductDialogOpen && (
        <NewProductDialog open={isNewProductDialogOpen} onOpenChange={setIsNewProductDialogOpen} />
      )}

      {isNewProfessionalProductDialogOpen && (
        <NewProfessionalProductDialog
          open={isNewProfessionalProductDialogOpen}
          onOpenChange={(open) => {
            setIsNewProfessionalProductDialogOpen(open)
            if (!open) {
              setSelectedProduct(null) // Reset selected product when dialog closes
            }
          }}
          product={selectedProduct && !selectedProduct.isRetail ? selectedProduct : null}
          mode={selectedProduct && !selectedProduct.isRetail ? "edit" : "add"}
          currentLocation={currentLocation}
          getProductStock={getProductStock}
        />
      )}

      <ProductEditDialog
        open={isProductEditDialogOpen}
        onOpenChange={setIsProductEditDialogOpen}
        product={selectedProduct}
      />

      <StockAdjustmentDialog
        open={isStockAdjustmentDialogOpen}
        onOpenChange={setIsStockAdjustmentDialogOpen}
        product={selectedProduct}
        onStockAdjusted={handleStockAdjusted}
      />

      {isCategoryManagementDialogOpen && (
        <CategoryManagementDialog
          open={isCategoryManagementDialogOpen}
          onOpenChange={setIsCategoryManagementDialogOpen}
        />
      )}

      <ProductTransferDialog
        open={isProductTransferDialogOpen}
        onOpenChange={setIsProductTransferDialogOpen}
        product={selectedProduct}
      />

      <TransferDetailsDialog
        open={isTransferDetailsOpen}
        onOpenChange={setIsTransferDetailsOpen}
        transfer={selectedTransfer}
      />

      <MultiLocationStockDialog
        open={isMultiLocationStockDialogOpen}
        onOpenChange={setIsMultiLocationStockDialogOpen}
        product={selectedProduct}
        onStockAdjusted={handleStockAdjusted}
      />
    </div>
  )
}

