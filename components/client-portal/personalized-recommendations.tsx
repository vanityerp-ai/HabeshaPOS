"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Star, Heart, ShoppingBag, Calendar, RefreshCw } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { useToast } from "@/components/ui/use-toast"
import { useCurrency } from "@/lib/currency-provider"
import { CurrencyDisplay } from "@/components/ui/currency-display"
import { EnhancedImage } from "@/components/ui/enhanced-image"
import { useUnifiedStaff } from "@/lib/unified-staff-provider"
import { useServices } from "@/lib/service-provider"
import { ServiceStorage, Service, ServiceCategory } from "@/lib/service-storage"
import { useProducts } from "@/lib/product-provider"
import { Product } from "@/lib/product-provider"
import { getFirstName } from "@/lib/female-avatars"

interface PersonalizedRecommendationsProps {
  clientId: string
  clientPreferences?: {
    preferredServices?: string[]
    preferredProducts?: string[]
    preferredStylists?: string[]
  }
  pastAppointments?: any[]
  pastPurchases?: any[]
}

export function PersonalizedRecommendations({
  clientId,
  clientPreferences = {},
  pastAppointments = [],
  pastPurchases = []
}: PersonalizedRecommendationsProps) {
  const { toast } = useToast()
  const { formatCurrency } = useCurrency()
  const { staff } = useUnifiedStaff()
  const { services, categories, refreshServices } = useServices()
  const { products, getRetailProducts, refreshProducts, categories: productCategories } = useProducts()

  // State management
  const [dataLoading, setDataLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [recommendedServices, setRecommendedServices] = useState<any[]>([])
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([])
  const [recommendedStylists, setRecommendedStylists] = useState<any[]>([])

  // Service images for different categories
  const serviceImages = {
    "1": "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Braiding
    "2": "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Hair Extension
    "3": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Styling
    "4": "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Hair Treatment
    "5": "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Color
    "6": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Nail
    "7": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Eyelash
    "8": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Threading
    "9": "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Waxing
    "10": "https://images.unsplash.com/photo-1626784215021-2e39ccf971cd?w=400&h=300&fit=crop&crop=center&auto=format&q=80", // Henna
    "11": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop&crop=center&auto=format&q=80"  // Massage And Spa
  }

  const refreshData = useCallback(async () => {
    setDataLoading(true)
    try {
      await Promise.all([
        refreshServices(),
        refreshProducts()
      ])
    } catch (error) {
      console.error("Error refreshing data:", error)
    } finally {
      setTimeout(() => setDataLoading(false), 1000)
    }
  }, [refreshServices, refreshProducts])

  // Helper function to get category name by ID
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(cat => cat.id === categoryId)
    return category?.name || "Service"
  }

  // Helper function to calculate service recommendation score
  const calculateRecommendationScore = (service: Service): number => {
    let score = 0

    // Base score for popular/featured services
    // @ts-ignore - These properties exist in the actual service objects but not in the type definition
    if ((service as any).isPopular) score += 30
    // @ts-ignore - These properties exist in the actual service objects but not in the type definition
    if ((service as any).isFeatured) score += 20
    // @ts-ignore - These properties exist in the actual service objects but not in the type definition
    if ((service as any).isNew) score += 10

    // Score based on price range (mid-range services get higher scores)
    if (service.price >= 50 && service.price <= 200) score += 15
    else if (service.price >= 200 && service.price <= 400) score += 10
    else if (service.price < 50) score += 5

    // Score based on duration (reasonable duration gets higher score)
    if (service.duration >= 30 && service.duration <= 120) score += 10

    // Random factor for variety
    score += Math.random() * 20

    return score
  }

  // Helper function to generate recommendation reasons
  const getRecommendationReason = (service: Service, index: number): string => {
    const reasons = [
      "Based on your past appointments",
      "Popular with clients like you",
      "Recommended for your preferences",
      "Pairs well with your recent services",
      "Trending service this month",
      "Perfect for your hair type",
      "Highly rated by our clients",
      "Great value for the quality"
    ]

    // @ts-ignore - These properties exist in the actual service objects but not in the type definition
    if ((service as any).isPopular) return "Popular with clients like you"
    // @ts-ignore - These properties exist in the actual service objects but not in the type definition
    if ((service as any).isFeatured) return "Featured service this month"
    // @ts-ignore - These properties exist in the actual service objects but not in the type definition
    if ((service as any).isNew) return "New service - try something different"

    return reasons[index % reasons.length]
  }

  // Helper function to calculate product recommendation score
  const calculateProductRecommendationScore = (product: Product): number => {
    let score = 0

    // Base score for popular/featured products
    if (product.isBestSeller) score += 30
    if (product.isFeatured) score += 25
    if (product.isNew) score += 15
    if (product.isSale || product.isOnSale) score += 20

    // Score based on price range (mid-range products get higher scores)
    if (product.price >= 30 && product.price <= 150) score += 15
    else if (product.price >= 150 && product.price <= 300) score += 10
    else if (product.price < 30) score += 5

    // Score based on stock availability
    if (product.stock > 20) score += 10
    else if (product.stock > 10) score += 5

    // Score based on rating
    if (product.rating && product.rating >= 4.5) score += 15
    else if (product.rating && product.rating >= 4.0) score += 10

    // Random factor for variety
    score += Math.random() * 15

    return score
  }

  // Helper function to generate product recommendation reasons
  const getProductRecommendationReason = (product: Product, index: number): string => {
    const reasons = [
      "Based on your hair type",
      "Pairs well with your shampoo",
      "Recommended by your stylist",
      "Popular with clients like you",
      "Perfect for your skin type",
      "Great for daily use",
      "Highly rated by customers",
      "Trending this month"
    ]

    if (product.isBestSeller) return "Best seller - loved by clients"
    if (product.isFeatured) return "Featured product this month"
    if (product.isNew) return "New arrival - try something fresh"
    if (product.isSale || product.isOnSale) return "Special offer - limited time"

    return reasons[index % reasons.length]
  }

  // Main effect to fetch recommendations
  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // Get real services data
        const allServices = services.length > 0 ? services : ServiceStorage.getServices()

        // Filter and score services for recommendations
        const scoredServices = allServices
          .filter(service => service.name && service.price > 0) // Valid services only
          .map(service => ({
            ...service,
            score: calculateRecommendationScore(service),
            // @ts-ignore - imageUrl property exists in actual service objects
            image: (service as any).imageUrl || serviceImages[service.category as keyof typeof serviceImages] || serviceImages["1"],
            categoryName: getCategoryName(service.category),
            rating: 4.2 + (Math.random() * 0.8), // Random rating between 4.2-5.0
            reason: getRecommendationReason(service, parseInt(service.id) || 0)
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 4) // Top 4 recommendations

        // Transform to expected format
        const recommendedServicesData = scoredServices.map(service => ({
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration,
          image: service.image,
          category: service.categoryName,
          rating: parseFloat(service.rating.toFixed(1)),
          reason: service.reason,
          description: service.description
        }))

        // Get real products data for recommendations using the same API as shop page
        let allProducts: any[] = []
        try {
          const response = await fetch('/api/client-portal/products')
          if (response.ok) {
            const data = await response.json()
            allProducts = data.products || []
          }
        } catch (error) {
          console.error("Error fetching products for recommendations:", error)
          // Fallback to existing products if API fails
          allProducts = products.length > 0 ? getRetailProducts() : []
        }

        // Filter and score products for recommendations
        const scoredProducts = allProducts
          .filter(product => {
            // Products from client-portal API are already filtered for retail and active status
            // and have stock calculated, so we just need to check basic validity
            const isValid = product.isActive !== false &&
              product.isRetail &&
              product.stock > 0 &&
              product.name &&
              product.price > 0

            return isValid
          })
          .map(product => {
            return {
              ...product,
              score: calculateProductRecommendationScore(product),
              image: product.images?.[0] || product.image || "/product-placeholder.jpg",
              rating: product.rating || 4.5, // Default rating if not set
              reason: getProductRecommendationReason(product, parseInt(product.id.replace(/\D/g, '')) || 0)
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 4) // Top 4 recommendations

        // Transform to expected format with enhanced data from shop page structure
        const recommendedProductsData = scoredProducts.map(product => {
          // Use the same image handling as the shop page
          const productImage = product.images && product.images.length > 0
            ? product.images[0]
            : product.image || "/product-placeholder.jpg"

          return {
            id: product.id,
            name: product.name,
            description: product.description || product.category,
            price: product.salePrice || product.price,
            originalPrice: product.salePrice ? product.price : undefined,
            salePrice: product.salePrice,
            image: productImage,
            images: product.images || (product.image ? [product.image] : []),
            category: product.category,
            type: product.type,
            brand: product.brand,
            sku: product.sku,
            rating: parseFloat(product.rating.toFixed(1)),
            stock: product.stock,
            reason: product.reason,
            isSale: !!(product.isSale || product.salePrice),
            isNew: product.isNew,
            isBestSeller: product.isBestSeller,
            isFeatured: product.isFeatured,
            isRecommended: product.isFeatured || product.isBestSeller,
            // Include additional fields from the API response
            features: product.features || [],
            ingredients: product.ingredients || [],
            howToUse: product.howToUse || [],
            reviewCount: product.reviewCount || 0,
            isRetail: product.isRetail,
            isActive: product.isActive
          }
        })

        // Get recommended stylists from centralized staff data
        const activeStaff = staff.filter(member => member.status === "Active")
        const recommendedStaffData = activeStaff.slice(0, 6).map((member, index) => {
          // Helper function to validate if a string is a valid URL
          const isValidUrl = (string: string): boolean => {
            if (!string || typeof string !== 'string' || string.trim() === '') return false
            try {
              new URL(string)
              return true
            } catch {
              return false
            }
          }

          // Get proper image URL with validation
          const getStaffImageUrl = (member: any): string => {
            // First check if profileImage is a valid URL
            if (member.profileImage && isValidUrl(member.profileImage)) {
              return member.profileImage
            }

            // Fallback to placeholder images
            return "/staff-placeholder.jpg"
          }

          return {
            id: member.id,
            name: member.name,
            role: member.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            image: getStaffImageUrl(member),
            rating: 4.5 + (Math.random() * 0.5), // Random rating between 4.5-5.0
            specialties: member.role === 'colorist' ? ['Color', 'Highlights'] :
                        member.role === 'stylist' ? ['Haircuts', 'Styling'] :
                        member.role === 'barber' ? ['Men\'s Cuts', 'Beard Trim'] :
                        ['Hair Care', 'Treatments'],
            reason: index === 0 ? "Your most visited stylist" :
                   index === 1 ? "Specializes in your preferred services" :
                   index === 2 ? "Highly rated for your hair type" :
                   "Recommended based on your preferences",
            employeeNumber: member.employeeNumber,
            homeService: member.homeService,
            locations: member.locations
          }
        })

        // Use only real staff data from database
        const realStylists = recommendedStaffData

        setRecommendedServices(recommendedServicesData)
        setRecommendedProducts(recommendedProductsData)
        setRecommendedStylists(realStylists)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching recommendations:", error)
        setLoading(false)
      }
    }

    fetchRecommendations()
    // Depend on services, products, categories, and staff to refresh when data changes
  }, [clientId, services, products, categories, staff])

  const addToFavorites = (item: any, type: string) => {
    toast({
      title: "Added to favorites",
      description: `${item.name} has been added to your favorites.`,
    })
  }

  const addToCart = (product: any) => {
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    })
  }

  if (loading || dataLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="animate-pulse">
                <div className="h-40 bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-full mt-4"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">Personalized Recommendations</h3>
          <p className="text-sm text-gray-500">Based on your preferences and history</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshData}
          disabled={dataLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Recommended Services */}
      {recommendedServices.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Recommended Services</h3>
            <Button variant="link" size="sm" asChild>
              <Link href="/client-portal/services" className="text-pink-600">
                View All Services
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendedServices.map((service) => (
              <Card key={service.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="relative h-40 w-full">
                    <EnhancedImage
                      src={service.image}
                      alt={service.name}
                      className="h-40 w-full"
                      aspectRatio="landscape"
                      showZoom={true}
                      fallbackSrc="/service-placeholder.jpg"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        className="bg-pink-600 hover:bg-pink-700"
                        size="sm"
                        asChild
                      >
                        <Link href={`/client-portal/appointments/book?serviceId=${service.id}`}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Book Now
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{service.name}</h4>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${i < Math.floor(service.rating) ? "fill-amber-400" : "fill-gray-200"}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">{service.rating}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{service.reason}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-400 hover:text-pink-600"
                        onClick={() => addToFavorites(service, 'service')}
                      >
                        <Heart className="h-4 w-4" />
                        <span className="sr-only">Add to favorites</span>
                      </Button>
                    </div>

                    <div className="flex justify-between items-center mt-3">
                      <p className="font-bold"><CurrencyDisplay amount={service.price} /></p>
                      <p className="text-xs text-gray-500">{service.duration} min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Products */}
      {recommendedProducts.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Recommended Products</h3>
            <Button variant="link" size="sm" asChild>
              <Link href="/client-portal/shop" className="text-pink-600">
                View All Products
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendedProducts.map((product) => (
              <Link key={product.id} href={`/client-portal/shop/${product.id}`}>
                <Card className="overflow-hidden group hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-0">
                    <div className="relative h-40 w-full">
                      <EnhancedImage
                        src={product.image}
                        alt={product.name}
                        className="h-40 w-full"
                        aspectRatio="landscape"
                        showZoom={true}
                        fallbackSrc="/product-placeholder.jpg"
                      />
                      <div className="absolute top-2 left-2 flex flex-col gap-2">
                        {product.isNew && (
                          <Badge className="bg-pink-600">New</Badge>
                        )}
                        {product.isBestSeller && (
                          <Badge className="bg-amber-500">Best Seller</Badge>
                        )}
                        {product.isSale && (
                          <Badge className="bg-red-500">Sale</Badge>
                        )}
                        {product.isRecommended && (
                          <Badge className="bg-pink-500">Recommended</Badge>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          className="bg-pink-600 hover:bg-pink-700"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            addToCart(product)
                          }}
                        >
                          <ShoppingBag className="mr-2 h-4 w-4" />
                          Add to Cart
                        </Button>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{product.name}</h4>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < Math.floor(product.rating) ? "fill-amber-400" : "fill-gray-200"}`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">{product.rating}</span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{product.reason}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-pink-600"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            addToFavorites(product, 'product')
                          }}
                        >
                          <Heart className="h-4 w-4" />
                          <span className="sr-only">Add to favorites</span>
                        </Button>
                      </div>

                      <div className="flex justify-between items-center mt-3">
                        <div className="flex items-center gap-2">
                          {product.isSale && product.salePrice ? (
                            <>
                              <p className="font-bold"><CurrencyDisplay amount={product.salePrice} /></p>
                              <p className="text-sm text-gray-500 line-through"><CurrencyDisplay amount={product.originalPrice || product.price} /></p>
                            </>
                          ) : (
                            <p className="font-bold"><CurrencyDisplay amount={product.price} /></p>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Stylists */}
      {recommendedStylists.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Recommended Stylists</h3>
            <Button variant="link" size="sm" asChild>
              <Link href="/client-portal/stylists" className="text-pink-600">
                View All Stylists
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedStylists.map((stylist) => (
              <Card key={stylist.id} className="overflow-hidden group hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className="flex">
                    <div className="relative h-32 w-32 flex-shrink-0">
                      <EnhancedImage
                        src={stylist.image}
                        alt={stylist.name}
                        className="h-32 w-32 rounded-lg"
                        aspectRatio="square"
                        showZoom={true}
                        fallbackSrc="/staff-placeholder.jpg"
                      />
                    </div>

                    <div className="p-4 flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{stylist.name}</h4>
                          <p className="text-sm text-gray-500">{stylist.role}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${i < Math.floor(stylist.rating) ? "fill-amber-400" : "fill-gray-200"}`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-gray-500">{stylist.rating}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-pink-600"
                          onClick={() => addToFavorites(stylist, 'stylist')}
                        >
                          <Heart className="h-4 w-4" />
                          <span className="sr-only">Add to favorites</span>
                        </Button>
                      </div>

                      <div className="mt-2">
                        <p className="text-xs text-gray-500">{stylist.reason}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {stylist.specialties.map((specialty: string) => (
                            <Badge key={specialty} variant="outline" className="text-xs">
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 border-t">
                    <Button
                      className="w-full bg-pink-600 hover:bg-pink-700"
                      size="sm"
                      asChild
                    >
                      <Link href={`/client-portal/appointments/book?staffId=${stylist.id}`}>
                        Book with {getFirstName(stylist.name)}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
