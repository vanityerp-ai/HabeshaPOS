"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Product } from "@/lib/products-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import { CurrencyDisplay } from "@/components/ui/currency-display"
import { ProductImageModal } from "@/components/shop/product-image-modal"
import {
  Search,
  ShoppingBag,
  Heart,
  Star,
  Filter,
  ChevronDown,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

import { useCart } from "@/lib/cart-provider"


export default function ShopPage() {
  const { toast } = useToast()
  const { addToCart, addToWishlist, isInCart, isInWishlist, getCartItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [sortBy, setSortBy] = useState("featured")

  // Image modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)

  // Simple price range state without complex calculations
  const [minPrice, setMinPrice] = useState(0)
  const [maxPrice, setMaxPrice] = useState(100)

  // Calculate available price range from products (stable)
  const availablePriceRange = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 100 }
    const prices = products.map(p => p.salePrice || p.price).filter(price => price > 0)
    if (prices.length === 0) return { min: 0, max: 100 }
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices))
    }
  }, [products])

  // Update price range only when products first load
  useEffect(() => {
    if (products.length > 0 && maxPrice === 100) {
      setMinPrice(availablePriceRange.min)
      setMaxPrice(availablePriceRange.max)
    }
  }, [products.length, availablePriceRange, maxPrice])

  // Set document title for SEO
  useEffect(() => {
    document.title = "Shop Products - Vanity Hub | Professional Beauty Products"
  }, [])

  // Fetch products from database API
  const fetchProducts = useCallback(async () => {
    console.log("🔄 Manual refresh triggered by user")
    setIsLoading(true)
    setError(null)

    try {
      console.log('🛒 Fetching retail products from database...')
      const response = await fetch('/api/client-portal/products')

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.statusText}`)
      }

      const data = await response.json()
      setProducts(data.products || [])

      console.log(`✅ Loaded ${data.products?.length || 0} retail products`)

      if (data.products?.length > 0) {
        toast({
          title: "Products loaded",
          description: `Found ${data.products.length} products available for purchase.`,
        })
      }
    } catch (err) {
      console.error("❌ Error fetching products:", err)
      setError(err instanceof Error ? err.message : "Failed to load products")
      toast({
        title: "Failed to load products",
        description: "Please try refreshing the page.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Manual refresh function
  const handleManualRefresh = useCallback(async () => {
    await fetchProducts()
  }, [fetchProducts])

  // Load retail products on component mount
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Get unique categories and types for filters (memoized for performance)
  const categories = useMemo(() =>
    [...new Set(products.map(p => p.category))].filter(Boolean).sort(),
    [products]
  )

  const types = useMemo(() =>
    [...new Set(products.map(p => p.type).filter(Boolean))].sort(),
    [products]
  )

  // Filter and sort products (memoized for performance)
  const filteredAndSortedProducts = useMemo(() => {
    // Filter products
    const filtered = products.filter(product => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const searchableText = `${product.name} ${product.description} ${product.category} ${product.type}`.toLowerCase()
        if (!searchableText.includes(query)) {
          return false
        }
      }

      // Price filter
      const productPrice = product.salePrice || product.price
      if (productPrice < minPrice || productPrice > maxPrice) {
        return false
      }

      // Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(product.category.toLowerCase())) {
        return false
      }

      // Type filter
      if (selectedTypes.length > 0 && product.type && !selectedTypes.includes(product.type.toLowerCase())) {
        return false
      }

      return true
    })

    // Sort products
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price-low-high":
          return (a.salePrice || a.price) - (b.salePrice || b.price)
        case "price-high-low":
          return (b.salePrice || b.price) - (a.salePrice || a.price)
        case "rating":
          return (b.rating || 0) - (a.rating || 0)
        case "newest":
          return a.isNew ? -1 : b.isNew ? 1 : 0
        default: // featured
          return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0)
      }
    })
  }, [products, searchQuery, minPrice, maxPrice, selectedCategories, selectedTypes, sortBy])

  // Memoized event handlers for better performance
  const handleCategoryToggle = useCallback((category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }, [])

  const handleTypeToggle = useCallback((type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }, [])

  const clearFilters = useCallback(() => {
    setSearchQuery("")
    setMinPrice(availablePriceRange.min)
    setMaxPrice(availablePriceRange.max)
    setSelectedCategories([])
    setSelectedTypes([])
  }, [availablePriceRange])

  // Image modal handlers
  const handleImageClick = useCallback((product: Product) => {
    // Ensure product has required properties for modal
    const modalProduct: Product = {
      ...product,
      description: product.description || '',
      type: product.type || 'General',
      image: product.image || '/placeholder.jpg'
    };
    setSelectedProduct(modalProduct)
    setIsImageModalOpen(true)
  }, [])

  const handleCloseImageModal = useCallback(() => {
    setIsImageModalOpen(false)
    setSelectedProduct(null)
  }, [])

  const handleAddToCart = useCallback(async (product: Product) => {
    // Check if we have enough stock
    if (product.stock <= 0) {
      toast({
        title: "Out of stock",
        description: `Sorry, ${product.name} is currently out of stock.`,
        variant: "destructive"
      });
      return;
    }

    // Verify real-time stock from database before adding to cart
    try {
      const response = await fetch('/api/client-portal/products');
      if (response.ok) {
        const data = await response.json();
        const currentProduct = data.products?.find((p: Product) => p.id === product.id);
        
        if (!currentProduct || currentProduct.stock <= 0) {
          toast({
            title: "Out of stock",
            description: `Sorry, ${product.name} is no longer available.`,
            variant: "destructive"
          });
          // Refresh products to show current stock
          await fetchProducts();
          return;
        }

        // Check if we're trying to add more than available
        const currentCartItem = getCartItem(product.id);
        const cartQuantity = currentCartItem?.quantity || 0;
        
        if (cartQuantity >= currentProduct.stock) {
          toast({
            title: "Maximum quantity reached",
            description: `You already have all available units (${currentProduct.stock}) of ${product.name} in your cart.`,
            variant: "destructive"
          });
          return;
        }
      }
    } catch (error) {
      console.error('Error checking stock:', error);
      // Continue with add to cart even if check fails
    }

    // Ensure product has required properties for cart
    const cartProduct: Product = {
      ...product,
      description: product.description || '',
      type: product.type || 'General',
      image: product.image || '/placeholder.jpg'
    };

    // Add to cart using cart provider
    addToCart(cartProduct, 1);
    
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  }, [toast, addToCart, fetchProducts, getCartItem])

  const handleAddToWishlist = useCallback((product: Product) => {
    // Ensure product has required properties for wishlist
    const wishlistProduct: Product = {
      ...product,
      description: product.description || '',
      type: product.type || 'General',
      image: product.image || '/placeholder.jpg'
    };

    // Add to wishlist using cart provider
    addToWishlist(wishlistProduct);
  }, [addToWishlist])

  // Error boundary component for images with click handler
  const ProductImage = ({ product }: { product: Product }) => {
    const [imageError, setImageError] = useState(false)

    return (
      <button
        className="relative w-full h-full group/image"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleImageClick(product)
        }}
        aria-label={`View ${product.name} image in full size`}
      >
        <Image
          src={imageError ? "/placeholder.jpg" : (product.image || "/placeholder.jpg")}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          onError={() => setImageError(true)}
          priority={false}
        />
        {/* Zoom overlay indicator */}
        <div className="absolute inset-0 bg-black/0 group-hover/image:bg-black/10 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 bg-white/90 rounded-full p-2">
            <svg
              className="w-5 h-5 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
      </button>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-4">Error Loading Products</h1>
        <p className="text-gray-600 mb-8">{error}</p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Shop Products</h1>
            <p className="text-gray-600">Browse our collection of professional beauty products</p>
            <p className="text-xs text-gray-500 mt-1">
              ✓ Stock levels synchronized with inventory management system
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isLoading}
              title="Refresh products from inventory"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full md:w-[250px]"
                aria-label="Search products"
              />
            </div>

            <Sheet open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Filter className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] sm:w-[350px]">
                <SheetHeader className="mb-6">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Refine your product search
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-3">Price Range</h3>
                    <div className="px-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="min-price-mobile" className="text-xs">Min</Label>
                          <Input
                            id="min-price-mobile"
                            type="number"
                            min={availablePriceRange.min}
                            max={availablePriceRange.max}
                            value={minPrice}
                            onChange={(e) => setMinPrice(Number(e.target.value) || 0)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-price-mobile" className="text-xs">Max</Label>
                          <Input
                            id="max-price-mobile"
                            type="number"
                            min={availablePriceRange.min}
                            max={availablePriceRange.max}
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(Number(e.target.value) || 100)}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span><CurrencyDisplay amount={minPrice} /></span>
                        <span>to</span>
                        <span><CurrencyDisplay amount={maxPrice} /></span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Categories</h3>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category}-mobile`}
                            checked={selectedCategories.includes(category.toLowerCase())}
                            onCheckedChange={() => handleCategoryToggle(category.toLowerCase())}
                          />
                          <Label htmlFor={`category-${category}-mobile`} className="capitalize">
                            {category}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-3">Product Type</h3>
                    <div className="space-y-2">
                      {types.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}-mobile`}
                            checked={selectedTypes.includes(type?.toLowerCase() || '')}
                            onCheckedChange={() => handleTypeToggle(type?.toLowerCase() || '')}
                          />
                          <Label htmlFor={`type-${type}-mobile`}>
                            {formatProductType(type)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={clearFilters}
                  >
                    Clear All Filters
                  </Button>

                  <Button
                    className="w-full bg-pink-600 hover:bg-pink-700"
                    onClick={() => setIsMobileFilterOpen(false)}
                  >
                    Apply Filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Desktop Filters */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Filters</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-pink-600"
                    onClick={clearFilters}
                  >
                    Clear All
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center">
                      Price Range
                      <ChevronDown className="ml-auto h-4 w-4" />
                    </h4>
                    <div className="px-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="min-price-desktop" className="text-xs">Min</Label>
                          <Input
                            id="min-price-desktop"
                            type="number"
                            min={availablePriceRange.min}
                            max={availablePriceRange.max}
                            value={minPrice}
                            onChange={(e) => setMinPrice(Number(e.target.value) || 0)}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label htmlFor="max-price-desktop" className="text-xs">Max</Label>
                          <Input
                            id="max-price-desktop"
                            type="number"
                            min={availablePriceRange.min}
                            max={availablePriceRange.max}
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(Number(e.target.value) || 100)}
                            className="h-8"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span><CurrencyDisplay amount={minPrice} /></span>
                        <span>to</span>
                        <span><CurrencyDisplay amount={maxPrice} /></span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center">
                      Categories
                      <ChevronDown className="ml-auto h-4 w-4" />
                    </h4>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category}`}
                            checked={selectedCategories.includes(category.toLowerCase())}
                            onCheckedChange={() => handleCategoryToggle(category.toLowerCase())}
                          />
                          <Label htmlFor={`category-${category}`} className="capitalize">
                            {category}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-3 flex items-center">
                      Product Type
                      <ChevronDown className="ml-auto h-4 w-4" />
                    </h4>
                    <div className="space-y-2">
                      {types.map((type) => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${type}`}
                            checked={selectedTypes.includes(type?.toLowerCase() || '')}
                            onCheckedChange={() => handleTypeToggle(type?.toLowerCase() || '')}
                          />
                          <Label htmlFor={`type-${type}`}>
                            {formatProductType(type)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <p className="text-sm text-gray-500" role="status" aria-live="polite">
                Showing {filteredAndSortedProducts.length} of {products.length} products
              </p>

              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-sm border-none bg-transparent focus:ring-0"
                  aria-label="Sort products by"
                >
                  <option value="featured">Featured</option>
                  <option value="price-low-high">Price: Low to High</option>
                  <option value="price-high-low">Price: High to Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="newest">Newest</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex justify-center items-center py-20" role="status" aria-label="Loading products">
                <Loader2 className="h-8 w-8 text-pink-600 animate-spin" />
                <span className="ml-2 text-lg text-gray-600">Loading products...</span>
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium mb-2">No products found</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {products.length === 0
                    ? "No products are available in the shop. Try refreshing to load products from inventory."
                    : "We couldn't find any products matching your criteria. Try adjusting your filters or search query."
                  }
                </p>
                <div className="flex gap-3 justify-center">
                  {products.length === 0 ? (
                    <Button onClick={handleManualRefresh} disabled={isLoading}>
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh Products
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" role="grid" aria-label="Product grid">
                {filteredAndSortedProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="relative h-64 overflow-hidden">
                        <ProductImage product={product} />
                        <div className="absolute top-3 left-3 flex flex-col gap-2">
                          {product.isNew && (
                            <Badge className="bg-pink-600">New</Badge>
                          )}
                          {product.isBestSeller && (
                            <Badge className="bg-amber-500">Best Seller</Badge>
                          )}
                          {product.isSale && (
                            <Badge className="bg-red-500">Sale</Badge>
                          )}
                        </div>
                        <div className="absolute top-3 right-3 flex flex-col gap-2">
                          {/* Stock indicator with location breakdown */}
                          <div className="bg-white/90 rounded-md p-2 text-xs">
                            <div className="flex items-center gap-1 mb-1">
                              <Badge
                                variant={product.stock === 0 ? "destructive" : product.stock < 5 ? "secondary" : "outline"}
                                className="text-xs px-1 py-0"
                              >
                                Total: {product.stock}
                              </Badge>
                            </div>
                            {/* Show location breakdown if available */}
                            {product.locations && product.locations.length > 0 && (
                              <div className="space-y-1">
                                {product.locations.slice(0, 3).map((location, index) => (
                                  <div key={index} className="flex justify-between text-xs text-gray-600">
                                    <span className="truncate max-w-[60px]">
                                      {location.locationName || 'Location'}
                                    </span>
                                    <span className={location.stock === 0 ? 'text-red-500' : ''}>{location.stock}</span>
                                  </div>
                                ))}
                                {product.locations.length > 3 && (
                                  <div className="text-xs text-gray-500">+{product.locations.length - 3} more</div>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-pink-600"
                            onClick={() => handleAddToWishlist(product)}
                            aria-label={`Add ${product.name} to wishlist`}
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                      </div>

                      <div className="p-4">
                        <div className="flex items-center gap-1 mb-1">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < Math.floor(product.rating || 0) ? "fill-amber-400" : "fill-gray-200"}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">({product.reviewCount || 0})</span>
                        </div>

                        <Link href={`/client-portal/shop/${product.id}`} className="block">
                          <h3 className="font-medium mb-1 group-hover:text-pink-600 transition-colors">
                            {product.name}
                          </h3>
                        </Link>

                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                          {product.description}
                        </p>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <div>
                              {product.isSale && product.salePrice ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-bold"><CurrencyDisplay amount={product.salePrice || 0} /></span>
                                  <span className="text-sm text-gray-500 line-through"><CurrencyDisplay amount={product.price} /></span>
                                </div>
                              ) : (
                                <span className="font-bold"><CurrencyDisplay amount={product.price} /></span>
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleAddToWishlist(product)}
                              aria-label={`Add ${product.name} to wishlist`}
                              className={`p-2 ${isInWishlist(product.id) ? 'text-pink-600' : 'text-gray-400 hover:text-pink-600'}`}
                            >
                              <Heart className={`h-4 w-4 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                            </Button>
                          </div>

                          {/* Stock status indicator */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={product.stock === 0 ? "destructive" : product.stock < 5 ? "secondary" : "outline"}
                                className="text-xs"
                              >
                                {product.stock === 0 ? "Out of Stock" :
                                 product.stock < 5 ? `Low Stock (${product.stock})` :
                                 `In Stock (${product.stock})`}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {isInCart(product.id) ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 bg-green-50 border-green-200 text-green-700"
                                  disabled
                                >
                                  <ShoppingBag className="h-4 w-4 mr-1" />
                                  In Cart ({getCartItem(product.id)?.quantity || 0})
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAddToCart(product)}
                                  disabled={product.stock <= 0}
                                  className="px-3"
                                >
                                  +
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                className="bg-pink-600 hover:bg-pink-700 flex-1"
                                onClick={() => handleAddToCart(product)}
                                aria-label={`Add ${product.name} to cart`}
                                disabled={product.stock <= 0}
                              >
                                <ShoppingBag className="h-4 w-4 mr-1" />
                                {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Image Modal */}
        <ProductImageModal
          product={selectedProduct}
          isOpen={isImageModalOpen}
          onClose={handleCloseImageModal}
          onAddToCart={handleAddToCart}
          onAddToWishlist={handleAddToWishlist}
          isInCart={isInCart}
          isInWishlist={isInWishlist}
          getCartItem={getCartItem}
        />

      </div>
  )
}


// Helper function to convert enum types to readable names
const formatProductType = (type: string) => {
  const typeMap: { [key: string]: string } = {
    'DAILY_CLEANSER': 'Daily Cleanser',
    'TREATMENT_SERUM': 'Treatment Serum',
    'HYDRATING_CREAM': 'Hydrating Cream',
    'ANTI_AGING_TREATMENT': 'Anti-Aging Treatment',
    'WEEKLY_MASK': 'Weekly Mask',
    'LIQUID_FOUNDATION': 'Liquid Foundation',
    'EYE_ENHANCER': 'Eye Enhancer',
    'LIP_COLOR': 'Lip Color',
    'DAILY_SHAMPOO': 'Daily Shampoo',
    'INTENSIVE_TREATMENT': 'Intensive Treatment',
    'TEMPORARY_EXTENSIONS': 'Temporary Extensions',
    'SEMI_PERMANENT_EXTENSIONS': 'Semi-Permanent Extensions',
  };
  return typeMap[type] || type;
};


