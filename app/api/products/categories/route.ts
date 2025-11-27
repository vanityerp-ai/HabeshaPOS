import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth/next"

// GET /api/products/categories - Fetch all product categories from database
export async function GET() {
  try {
    console.log("🔄 Fetching product categories...")

    // Get all products and extract unique categories with counts
    const products = await prisma.product.findMany({
      where: {
        isActive: true
      },
      select: {
        category: true
      }
    })

    // Extract unique categories and count products for each
    const categoryMap = new Map<string, number>()

    products.forEach(product => {
      const category = (product.category || "Uncategorized").trim()
      if (category && category !== "") {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
      }
    })

    // Convert to array format with unique ID generation
    const categories = Array.from(categoryMap.entries()).map(([name, count], index) => {
      const baseId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      // Ensure unique ID by adding index if needed
      const id = baseId || `category-${index}`

      return {
        id,
        name,
        description: `${name} products`,
        productCount: count,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })

    // Additional deduplication by ID to ensure uniqueness
    const uniqueCategories = categories.filter((category, index, array) =>
      array.findIndex(c => c.id === category.id) === index
    )

    // Sort by name
    uniqueCategories.sort((a, b) => a.name.localeCompare(b.name))

    console.log(`✅ Found ${uniqueCategories.length} unique product categories`)
    return NextResponse.json({ categories: uniqueCategories })
  } catch (error) {
    console.error("❌ Error fetching product categories:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}

// POST /api/products/categories - Create a new product category
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("🔄 Creating product category...")
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 })
    }

    // Check if category already exists
    const existingProducts = await prisma.product.findFirst({
      where: {
        category: data.name,
        isActive: true
      }
    })

    if (existingProducts) {
      return NextResponse.json({ 
        error: "Category already exists" 
      }, { status: 400 })
    }

    // Since we're using string categories in the product model,
    // we don't actually create a separate category record.
    // Categories are created implicitly when products are created with them.
    const category = {
      id: data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      name: data.name,
      description: data.description || `${data.name} products`,
      productCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    console.log(`✅ Category "${data.name}" ready for use`)
    return NextResponse.json({ category })
  } catch (error) {
    console.error("❌ Error creating product category:", error)
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 })
  }
}
