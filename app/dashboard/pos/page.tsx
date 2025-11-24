"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-provider"
import { useCurrency } from "@/lib/currency-provider"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
import { Search, Plus, Trash2, CreditCard, User, Loader2 } from "lucide-react"
import { ClientSearchDialog } from "@/components/pos/client-search-dialog"
import { PaymentDialog } from "@/components/pos/payment-dialog"
import { AccessDenied } from "@/components/access-denied"
import { useTransactions } from "@/lib/transaction-provider"
import { ConsolidatedTransactionService } from "@/lib/consolidated-transaction-service"
import { TransactionType, TransactionSource, TransactionStatus, PaymentMethod, Transaction } from "@/lib/transaction-types"
import { SettingsStorage } from "@/lib/settings-storage"

import { useServices } from "@/lib/service-provider"
import { generateTransactionIdWithPrefix, generateSequentialTransactionId } from "@/lib/transaction-utils"
import { locationCache } from "@/lib/location-cache"

// Product interface for POS
interface POSProduct {
  id: string
  name: string
  category: string
  type: string
  price: number
  cost?: number
  stock: number
  description?: string
  image?: string
  sku?: string
  barcode?: string
  isRetail: boolean
  isActive: boolean
}

export default function POSPage() {
  const { currentLocation, user, hasPermission, getUserPermissions } = useAuth()
  const { toast } = useToast()
  const { formatCurrency } = useCurrency()
  const { addTransaction, transactions } = useTransactions()
  const { services, categories } = useServices()



  // Debug permissions
  console.log("User role:", user?.role)
  console.log("User permissions:", getUserPermissions())
  console.log("Has VIEW_POS permission:", hasPermission("view_pos"))

  // Check permission - no special cases
  if (!hasPermission("view_pos")) {
    console.log("Access denied - user does not have view_pos permission")
    return (
      <AccessDenied
        description="You don't have permission to view the Point of Sale page."
        backButtonHref="/dashboard/appointments"
      />
    )
  }

  // State management
  const [activeTab, setActiveTab] = useState("services")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [cartItems, setCartItems] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState<any>(null)
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)

  // Discount state
  const [discountPercentage, setDiscountPercentage] = useState("")
  const [discountError, setDiscountError] = useState("")

  // Product state
  const [products, setProducts] = useState<POSProduct[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  // Last transaction state
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null)

  // Fetch products from database
  const fetchProducts = useCallback(async () => {
    setIsLoadingProducts(true)
    setProductError(null)

    try {
      console.log('🔄 POS: Fetching products from database...')

      // Build query parameters
      const params = new URLSearchParams()
      params.append('isRetail', 'true') // Only get retail products for POS

      if (currentLocation && currentLocation !== 'all') {
        params.append('locationId', currentLocation)
      }

      const response = await fetch(`/api/products?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`✅ POS: Loaded ${data.products?.length || 0} products`)

      // Transform products to POS format
      const posProducts: POSProduct[] = (data.products || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        type: product.type || 'Product',
        price: product.salePrice || product.price,
        cost: product.cost || product.price * 0.6,
        stock: product.locations?.reduce((total: number, loc: any) => total + (loc.stock || 0), 0) || 0,
        description: product.description,
        image: product.image,
        sku: product.sku,
        barcode: product.barcode,
        isRetail: product.isRetail,
        isActive: product.isActive
      }))

      setProducts(posProducts)

      if (posProducts.length === 0) {
        toast({
          title: "No products found",
          description: "No retail products are available in the database.",
          variant: "destructive"
        })
      }
    } catch (err) {
      console.error("❌ POS: Error fetching products:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load products"
      setProductError(errorMessage)
      toast({
        title: "Failed to load products",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsLoadingProducts(false)
    }
  }, [currentLocation, toast])

  // Load products on component mount and when location changes
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Get unique categories for services and products
  const serviceCategories = categories.map(category => category.name)
  const productCategories = [...new Set(products.map(product => product.category))].sort()

  // Filter items based on search term, active tab, and selected category
  const filteredItems =
    activeTab === "services"
      ? services.filter(
          (service) => {
            // Filter by search term
            const matchesSearch =
              service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (categories.find(cat => cat.id === service.category)?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

            // Filter by selected category if one is active
            const serviceCategoryName = categories.find(cat => cat.id === service.category || cat.name === service.category)?.name;
            const matchesCategory = !activeCategory || serviceCategoryName === activeCategory;

            return matchesSearch && matchesCategory;
          }
        )
      : products.filter(
          (product) => {
            // Filter by search term
            const matchesSearch =
              product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));

            // Filter by selected category if one is active
            const matchesCategory = !activeCategory || product.category === activeCategory;

            return matchesSearch && matchesCategory && product.isActive;
          }
        )

  // Get checkout settings for dynamic tax rate
  const checkoutSettings = SettingsStorage.getCheckoutSettings()

  // Calculate cart totals
  const serviceSubtotal = cartItems.reduce((sum, item) => item.type === 'service' ? sum + item.price * item.quantity : sum, 0);
  const productSubtotal = cartItems.reduce((sum, item) => item.type === 'product' ? sum + item.price * item.quantity : sum, 0);
  const subtotal = serviceSubtotal + productSubtotal;
  const taxRate = checkoutSettings.taxRate / 100 // Convert percentage to decimal
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Calculate discount amounts
  const discountPercent = parseFloat(discountPercentage) || 0
  const discountAmount = (total * discountPercent) / 100
  const finalTotal = total - discountAmount

  // Handle discount percentage change with validation
  const handleDiscountChange = (value: string) => {
    setDiscountPercentage(value)
    setDiscountError("")

    const percent = parseFloat(value)
    if (value && (isNaN(percent) || percent < 0 || percent > 100)) {
      setDiscountError("Discount must be between 0 and 100")
    }
  }

  const addToCart = (item: any, type: "service" | "product") => {
    const existingItemIndex = cartItems.findIndex((cartItem) => cartItem.id === item.id && cartItem.type === type)

    if (existingItemIndex >= 0) {
      // Item already in cart, increment quantity
      const updatedCart = [...cartItems]
      updatedCart[existingItemIndex].quantity += 1
      setCartItems(updatedCart)
    } else {
      // Add new item to cart
      setCartItems([...cartItems, { ...item, type, quantity: 1 }])
    }

    toast({
      description: `Added ${item.name} to cart`,
      duration: 2000,
    })
  }

  const removeFromCart = (index: number) => {
    const newCart = [...cartItems]
    newCart.splice(index, 1)
    setCartItems(newCart)
  }

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return

    const newCart = [...cartItems]
    newCart[index].quantity = newQuantity
    setCartItems(newCart)
  }

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Cart is empty",
        description: "Please add items to the cart before checkout",
      })
      return
    }

    // Check permission to create sales
    if (hasPermission("create_sale")) {
      setIsPaymentDialogOpen(true)
    } else {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "You don't have permission to process sales",
      })
    }
  }

  // Function to record POS transaction
  const handlePaymentComplete = useCallback(async (paymentMethod: string, giftCardCode?: string, giftCardAmount?: number, discountPercentage?: number, discountAmount?: number, serviceDiscountAmount?: number) => {
    // Guard: Prevent zero or negative total transactions
    const finalTotal = discountAmount ? total - discountAmount : total;
    if (finalTotal <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid Transaction Amount",
        description: "Transaction amount must be greater than zero. Please check your cart and discounts.",
      });
      return;
    }
    try {
      console.log('[POS] handlePaymentComplete called', { paymentMethod, cartItems, finalTotal });
      const items = cartItems.map((item, index) => ({
        id: `${item.type}-${item.id}-${index}`,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity,
        category: item.type === 'service' ? 'Service' : 'Product',
        sku: item.id,
        type: item.type === 'service' ? 'service' : 'product'
      }));

      // Calculate service and product amounts from cartItems
      const serviceAmount = cartItems.filter(item => item.type === 'service').reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const productAmount = cartItems.filter(item => item.type === 'product').reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Create a mock appointment object for the consolidated transaction service
      const finalServiceTotal = serviceDiscountAmount ? serviceSubtotal - serviceDiscountAmount : serviceSubtotal;
      const hasServices = cartItems.some(item => item.type === 'service');
      const hasProducts = cartItems.some(item => item.type === 'product');
      const mockAppointment = {
        id: `pos-${Date.now()}`,
        clientId: selectedClient?.id,
        clientName: selectedClient?.name || "Walk-in Customer",
        staffId: user?.id,
        staffName: user?.name || "Staff",
        location: currentLocation || "loc1",
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          type: item.type,
          category: item.type === 'service' ? 'Service' : 'Product'
        })),
        service: cartItems.filter(item => item.type === 'service').map(item => item.name).join(', '),
        price: finalTotal,
        originalServiceAmount: finalServiceTotal,
        discountPercentage: discountPercentage || 0,
        discountAmount: discountAmount || 0,
        source: 'pos',
      };

      // Determine payment method enum
      let paymentMethodEnum = PaymentMethod.CASH;
      if (paymentMethod.toLowerCase().includes('gift card')) {
        paymentMethodEnum = PaymentMethod.GIFT_CARD;
      } else if (paymentMethod.toLowerCase().includes('card') || paymentMethod.toLowerCase().includes('credit')) {
        paymentMethodEnum = PaymentMethod.CREDIT_CARD;
      } else if (paymentMethod.toLowerCase().includes('mobile')) {
        paymentMethodEnum = PaymentMethod.MOBILE_PAYMENT;
      }

      // Create separate transactions for products and services
      const transactions = [];
      
      // Create product sale transaction if there are products
      if (hasProducts) {
        const productItems = cartItems.filter(item => item.type === 'product');
        const productTotal = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Create detailed product description
        const productDescriptions = productItems.map(item => 
          `${item.name} (${item.quantity}x @ ${formatCurrency(item.price)})`
        ).join(', ');
        
        const productTransaction = {
          id: generateSequentialTransactionId('TX-'),
          clientId: selectedClient?.id,
          clientName: selectedClient?.name || "Walk-in Customer",
          type: "product_sale" as TransactionType,
          category: "Product Sale",
          description: productDescriptions,
          amount: productTotal,
          productAmount: productAmount,
          serviceAmount: serviceAmount,
          paymentMethod: paymentMethodEnum,
          status: TransactionStatus.COMPLETED,
          location: currentLocation || "loc1",
          date: new Date().toISOString(),
          source: TransactionSource.POS,
          items: productItems.map(item => ({
            id: item.id,
            name: item.name,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
            quantity: item.quantity,
            type: 'product' as const
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        transactions.push(productTransaction);
        console.log('[POS] Created product transaction:', productTransaction);
      }
      
      // Create service sale transaction if there are services
      if (hasServices) {
        const serviceItems = cartItems.filter(item => item.type === 'service');
        const serviceTotal = serviceItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const serviceTransaction = {
          id: generateSequentialTransactionId('TX-'),
          clientId: selectedClient?.id,
          clientName: selectedClient?.name || "Walk-in Customer",
          type: "service_sale" as TransactionType,
          category: "Service Sale",
          description: `POS Service Sale - ${serviceItems.length} service${serviceItems.length > 1 ? 's' : ''}`,
          amount: serviceTotal,
          serviceAmount: serviceAmount,
          productAmount: productAmount,
          paymentMethod: paymentMethodEnum,
          status: TransactionStatus.COMPLETED,
          location: currentLocation || "loc1",
          date: new Date().toISOString(),
          source: TransactionSource.POS,
          items: serviceItems.map(item => ({
            id: item.id,
            name: item.name,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
            quantity: item.quantity,
            type: 'service' as const
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        transactions.push(serviceTransaction);
        console.log('[POS] Created service transaction:', serviceTransaction);
      }

      // Add all transactions to the provider
      console.log('[POS] Adding transactions to provider:', transactions.length);
      transactions.forEach(transaction => {
        addTransaction(transaction);
      });

      // Store the last completed transaction for printing
      setLastTransaction(transactions[0]); // Or use the main transaction as needed
      // Do not close the payment dialog automatically
      // setIsPaymentDialogOpen(false); // Remove or comment this line

      // Update inventory for product sales
      if (hasProducts) {
        console.log('[POS] Updating inventory for product sales');
        
        // Test the inventory API first
        try {
          console.log('[POS] Testing inventory API...');
          const testResponse = await fetch('/api/inventory/adjust', {
            method: 'GET',
          });
          console.log('[POS] Inventory API test response:', testResponse.status, await testResponse.text());
        } catch (testError) {
          console.error('[POS] Inventory API test failed:', testError);
        }
        
        const productItems = cartItems.filter(item => item.type === 'product');
        
        // Track inventory update failures
        const inventoryFailures: string[] = [];
        
        for (const item of productItems) {
          // Get the actual location ID from the location cache for each item
          let actualLocationId = currentLocation;
          if (currentLocation && currentLocation !== 'all') {
            const location = locationCache.getLocationById(currentLocation);
            if (location && location.id !== 'all') {
              actualLocationId = location.id;
            }
          }
          // Defensive check for valid locationId
          if (!actualLocationId || actualLocationId === 'all') {
            console.error('[POS] Invalid or missing locationId for inventory adjustment:', actualLocationId);
            toast({
              variant: "destructive",
              title: "Inventory Adjustment Error",
              description: "Please select a specific location before completing the sale.",
            });
            continue; // Skip this item
          }
          console.log(`[POS] Using location ID: ${actualLocationId} (original: ${currentLocation})`);
          
          try {
            console.log(`[POS] Attempting to update inventory for ${item.name} (ID: ${item.id})`);
            
            const requestBody = {
              productId: item.id,
              locationId: actualLocationId,
              adjustmentType: 'remove',
              quantity: item.quantity,
              reason: `POS sale - ${item.name}`,
              notes: `Sold via POS to ${selectedClient?.name || 'Walk-in Customer'}`
            };
            
            console.log(`[POS] Inventory request body:`, requestBody);
            
            const inventoryResponse = await fetch('/api/inventory/adjust', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });
            
            console.log(`[POS] Inventory response status:`, inventoryResponse.status);
            console.log(`[POS] Inventory response headers:`, Object.fromEntries(inventoryResponse.headers.entries()));
            
            if (!inventoryResponse.ok) {
              let errorData, rawText;
              try {
                rawText = await inventoryResponse.text();
                errorData = JSON.parse(rawText);
              } catch (parseError) {
                errorData = { error: 'Failed to parse error response', status: inventoryResponse.status, raw: rawText };
              }
              console.error(`[POS] Inventory API error for ${item.name}:`, errorData, rawText);
              inventoryFailures.push(`${item.name}: ${errorData.error || 'Unknown error'}`);
              // Continue with other items instead of throwing
              continue;
            }
            
            let responseData;
            try {
              responseData = await inventoryResponse.json();
            } catch (parseError) {
              console.error(`[POS] Failed to parse success response for ${item.name}:`, parseError);
              responseData = { success: true, message: 'Response received but could not parse JSON' };
            }
            
            console.log(`[POS] Successfully updated inventory for ${item.name}:`, responseData);
          } catch (error) {
            console.error(`[POS] Failed to update inventory for ${item.name}:`, error, (error as Error)?.message, (error as Error)?.stack);
            inventoryFailures.push(`${item.name}: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
            // Continue with other items instead of throwing
          }
        }
        
        // Show summary of inventory update results
        if (inventoryFailures.length > 0) {
          console.warn(`[POS] Inventory update failures:`, inventoryFailures);
          toast({
            variant: "destructive",
            title: "Some Inventory Updates Failed",
            description: `Transaction completed but ${inventoryFailures.length} inventory update(s) failed. Please check stock levels manually.`,
          });
        } else {
          console.log('[POS] All inventory updates completed successfully');
        }
      }

      console.log('[POS] Payment completed successfully');
      toast({
        title: "Payment Completed",
        description: `Successfully processed payment for $${finalTotal.toFixed(2)}`,
      });

      // Clear cart and reset client
      setCartItems([]);
      setSelectedClient(null);
      // setIsPaymentDialogOpen(false); // This line is now handled by the payment dialog's onOpenChange
    } catch (error) {
      console.error("[POS] Error processing payment:", error);
      toast({
        variant: "destructive",
        title: "Payment Error",
        description: "Payment was processed but transaction recording failed.",
      });
      setIsPaymentDialogOpen(false);
    }
  }, [total, serviceSubtotal, addTransaction, formatCurrency, toast, cartItems, selectedClient, user, currentLocation, transactions]);


  const handleSelectClient = (client: any) => {
    setSelectedClient(client)
    setIsClientSearchOpen(false)

    toast({
      description: `Selected client: ${client.name}`,
      duration: 2000,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Point of Sale</h2>
          <p className="text-muted-foreground">
            {currentLocation === "all"
              ? "Process sales across all locations"
              : `Process sales at ${currentLocation === "loc1" ? "Downtown" : currentLocation === "loc2" ? "Westside" : "Northside"} location`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        {/* Products and Services */}
        <Card>
          <CardHeader className="space-y-0 pb-3">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <CardTitle>Add Items</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="services" value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6">
                <TabsList className="w-full">
                  <TabsTrigger value="services" className="flex-1">
                    Services
                  </TabsTrigger>
                  <TabsTrigger value="products" className="flex-1">
                    Products
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="services" className="m-0 border-t">
                {/* Service Categories - Horizontal Layout */}
                <div className="p-4 border-b">
                  <div className="flex overflow-x-auto -mx-2 px-2 pb-2 hide-scrollbar">
                    <div className="flex space-x-2 min-w-full">
                      <Button
                        variant={activeCategory === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveCategory(null)}
                        className="flex-shrink-0"
                      >
                        All Categories
                      </Button>
                      {serviceCategories.map((category) => (
                        <Button
                          key={category}
                          variant={activeCategory === category ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveCategory(category)}
                          className="flex-shrink-0"
                        >
                          {category}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Services Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredItems.map((service) => (
                      <Card key={service.id} className="overflow-hidden">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-base">{service.name}</CardTitle>
                          <CardDescription>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full mr-2">
                              {categories.find(cat => cat.id === service.category)?.name || service.category}
                            </span>
                            {service.type === 'service' && (service as any).duration} min
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="p-4 pt-2 flex justify-between">
                          <p className="font-medium"><CurrencyDisplay amount={service.price} /></p>
                          <Button size="sm" onClick={() => addToCart(service, "service")}>
                            <Plus className="h-4 w-4 mr-1" /> Add
                          </Button>
                        </CardFooter>
                      </Card>
                    ))}

                    {filteredItems.length === 0 && (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        No services found matching your search.
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="products" className="m-0 border-t">
                {/* Product Categories - Horizontal Layout */}
                <div className="p-4 border-b">
                  <div className="flex overflow-x-auto -mx-2 px-2 pb-2 hide-scrollbar">
                    <div className="flex space-x-2 min-w-full">
                      <Button
                        variant={activeCategory === null ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveCategory(null)}
                        className="flex-shrink-0"
                      >
                        All Categories
                      </Button>
                      {productCategories.map((category) => (
                        <Button
                          key={category}
                          variant={activeCategory === category ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveCategory(category)}
                          className="flex-shrink-0"
                        >
                          {category}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Products Grid */}
                <div className="p-6">
                  {isLoadingProducts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-muted-foreground">Loading products...</span>
                    </div>
                  ) : productError ? (
                    <div className="text-center py-8">
                      <p className="text-destructive mb-2">Error loading products</p>
                      <p className="text-muted-foreground text-sm mb-4">{productError}</p>
                      <Button variant="outline" onClick={fetchProducts}>
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {filteredItems.map((product) => (
                        <Card key={product.id} className="overflow-hidden">
                          <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-base">{product.name}</CardTitle>
                            <CardDescription>
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full mr-2">
                                {product.category}
                              </span>
                              {product.type === 'product' && `In stock: ${(product as any).stock}`}
                            </CardDescription>
                          </CardHeader>
                          <CardFooter className="p-4 pt-2 flex justify-between">
                            <p className="font-medium"><CurrencyDisplay amount={product.price} /></p>
                            <Button
                              size="sm"
                              onClick={() => addToCart(product, "product")}
                              disabled={product.type === 'product' && (product as any).stock <= 0}
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}

                      {filteredItems.length === 0 && !isLoadingProducts && !productError && (
                        <div className="col-span-full text-center py-8 text-muted-foreground">
                          No products found matching your search.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Cart */}
        <Card>
          <CardHeader>
            <CardTitle>Cart</CardTitle>
            <div className="flex items-center justify-between">
              <CardDescription>
                {cartItems.length} item{cartItems.length !== 1 ? "s" : ""}
              </CardDescription>
              {cartItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-muted-foreground"
                  onClick={() => setCartItems([])}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="px-6 py-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setIsClientSearchOpen(true)}>
                <User className="mr-2 h-4 w-4" />
                {selectedClient ? selectedClient.name : "Select Client"}
              </Button>
            </div>

            {cartItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border-t">
                Cart is empty. Add items to proceed.
              </div>
            ) : (
              <div className="border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cartItems.map((item, index) => (
                      <TableRow key={`${item.type}-${item.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <Badge variant="outline" className="mt-1">
                              {item.type === "service" ? "Service" : "Product"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                            >
                              -
                            </Button>
                            <span className="w-8 text-center">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right"><CurrencyDisplay amount={item.price * item.quantity} /></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col">
            <div className="w-full space-y-2 pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span><CurrencyDisplay amount={subtotal} /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(2)}%)</span>
                <span><CurrencyDisplay amount={taxAmount} /></span>
              </div>

              {/* Discount Section */}
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pos-discount" className="text-sm font-medium">Discount (%)</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="pos-discount"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0"
                      value={discountPercentage}
                      onChange={(e) => handleDiscountChange(e.target.value)}
                      className="w-20 text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>

                {discountError && (
                  <p className="text-sm text-red-600">{discountError}</p>
                )}
              </div>

              <Separator className="my-2" />

              {discountAmount > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Total</span>
                    <span><CurrencyDisplay amount={total} /></span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({discountPercent}%)</span>
                    <span>-<CurrencyDisplay amount={discountAmount} /></span>
                  </div>
                </>
              )}

              <div className="flex justify-between font-medium text-lg">
                <span>Final Total</span>
                <span><CurrencyDisplay amount={finalTotal} /></span>
              </div>

              <Button className="w-full mt-4" size="lg" disabled={cartItems.length === 0 || currentLocation === 'all'} onClick={handleCheckout}>
                <CreditCard className="mr-2 h-4 w-4" />
                Checkout
              </Button>
              {currentLocation === 'all' && (
                <div className="text-red-600 text-sm mt-2">
                  Please select a specific location to process sales.
                </div>
              )}
            </div>
          </CardFooter>
        </Card>
      </div>

      <ClientSearchDialog
        open={isClientSearchOpen}
        onOpenChange={setIsClientSearchOpen}
        onSelectClient={handleSelectClient}
      />

      <PaymentDialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          setIsPaymentDialogOpen(open);
          if (!open) setLastTransaction(null);
        }}
        total={total}
        serviceTotal={serviceSubtotal}
        onComplete={handlePaymentComplete}
        lastTransaction={lastTransaction}
      />
    </div>
  )
}

