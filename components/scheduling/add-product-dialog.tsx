"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useProducts } from "@/lib/use-products"
import { CurrencyDisplay } from "@/components/ui/currency-display"

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: string
  onProductAdded: (bookingId: string, product: any) => void
}

export function AddProductDialog({ open, onOpenChange, bookingId, onProductAdded }: AddProductDialogProps) {
  const { toast } = useToast()
  const { products, categories } = useProducts()
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedProduct, setSelectedProduct] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Helper function to normalize category names for comparison
  // Converts "Skincare" to "SKINCARE", "Hair Care" to "HAIR_CARE", etc.
  const normalizeCategoryName = (name: string): string => {
    return name.toUpperCase().replace(/\s+/g, '_')
  }

  // Filter products by selected category (if any)
  const filteredProducts = selectedCategory && selectedCategory !== "all"
    ? products.filter((p) => {
        const normalizedProductCategory = p.category?.toUpperCase().replace(/\s+/g, '_')
        const normalizedSelectedCategory = normalizeCategoryName(selectedCategory)
        return normalizedProductCategory === normalizedSelectedCategory && p.isRetail && p.isActive !== false
      })
    : products.filter((p) => p.isRetail && p.isActive !== false)

  console.log('🔍 AddProductDialog Debug:', {
    selectedCategory,
    totalProducts: products.length,
    retailProducts: products.filter(p => p.isRetail).length,
    activeRetailProducts: products.filter(p => p.isRetail && p.isActive !== false).length,
    filteredProducts: filteredProducts.length,
    categories: categories.map(c => c.name),
    sampleProduct: products[0]
  })

  const handleSubmit = async () => {
    if (!selectedProduct) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please select a product.",
      })
      return
    }
    if (quantity < 1) {
      toast({
        variant: "destructive",
        title: "Invalid quantity",
        description: "Quantity must be at least 1.",
      })
      return
    }
    setIsSubmitting(true)
    try {
      // Find the selected product details
      const productDetails = products.find((p) => p.id === selectedProduct)
      if (!productDetails) {
        throw new Error("Product not found")
      }
      // Create the product object
      const newProduct = {
        id: `product-${Date.now()}`,
        type: "product",
        name: productDetails.name,
        price: productDetails.price * quantity,
        quantity: quantity,
        unitPrice: productDetails.price,
      }
      onProductAdded(bookingId, newProduct)
      toast({
        title: "Product added",
        description: `${quantity} x ${productDetails.name} has been added to the booking.`,
      })
      setSelectedCategory("")
      setSelectedProduct("")
      setQuantity(1)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to add product:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add the product. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Product Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.filter((cat) => cat.isActive).map((category, index) => (
                  <SelectItem key={`category-${category.id || category.name}-${category.name}-${index}`} value={category.name}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="product">Product</Label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger id="product">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.length === 0 ? (
                  <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                    {products.length === 0
                      ? "No products available. Please add products in the Inventory page."
                      : selectedCategory && selectedCategory !== "all"
                      ? `No retail products found in ${selectedCategory} category.`
                      : "No retail products available."}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - <CurrencyDisplay amount={product.price} showSymbol={true} useLocaleFormat={false} />
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black text-white hover:bg-gray-800">
            {isSubmitting ? "Adding..." : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

