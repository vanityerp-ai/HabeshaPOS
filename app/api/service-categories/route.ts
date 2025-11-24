import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper function to retry database operations
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      console.warn(`⚠️ Database operation failed (attempt ${attempt}/${maxRetries}):`, error)

      if (attempt < maxRetries) {
        console.log(`🔄 Retrying in ${delayMs}ms...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        // Exponential backoff
        delayMs *= 2
      }
    }
  }

  throw lastError
}

export async function GET() {
  try {
    console.log("🔄 Fetching service categories...")

    // Get all services and extract unique categories with retry logic
    const services = await retryOperation(async () => {
      return await prisma.service.findMany({
        where: {
          isActive: true
        },
        select: {
          category: true
        }
      })
    })

    // Extract unique categories and count services for each
    const categoryMap = new Map<string, number>()

    services.forEach(service => {
      const category = (service.category || "Uncategorized").trim()
      // Ensure we don't have empty categories
      if (category && category !== "") {
        categoryMap.set(category, (categoryMap.get(category) || 0) + 1)
      }
    })

    // Convert to the expected format with consistent ID generation
    const categories = Array.from(categoryMap.entries()).map(([name, count], index) => {
      // Ensure consistent ID generation - trim whitespace and normalize
      const normalizedName = name.trim()
      const id = normalizedName.toLowerCase().replace(/\s+/g, '-')

      return {
        id: id,
        name: normalizedName,
        description: `${normalizedName} services`,
        serviceCount: count,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    })

    // Sort by name and remove any potential duplicates by ID
    const uniqueCategories = categories.reduce((acc, category) => {
      const existingIndex = acc.findIndex(c => c.id === category.id)
      if (existingIndex === -1) {
        acc.push(category)
      } else {
        // If duplicate found, merge service counts
        acc[existingIndex].serviceCount += category.serviceCount
      }
      return acc
    }, [] as typeof categories)

    uniqueCategories.sort((a, b) => a.name.localeCompare(b.name))

    console.log(`✅ Successfully fetched ${uniqueCategories.length} categories`)
    console.log('Categories:', uniqueCategories.map(c => `${c.name} (${c.id})`).join(', '))
    return NextResponse.json({ categories: uniqueCategories })
  } catch (error) {
    console.error("❌ Error fetching service categories:", error)

    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isDatabaseError = errorMessage.includes("Can't reach database") ||
                           errorMessage.includes("P1001")

    if (isDatabaseError) {
      return NextResponse.json({
        error: "Database connection failed. Please check your database connection and try again.",
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        code: 'DATABASE_CONNECTION_ERROR'
      }, { status: 503 }) // Service Unavailable
    }

    return NextResponse.json({
      error: "Failed to fetch service categories",
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log("🔄 Creating service category...")
    const data = await request.json()

    // Validate required fields
    if (!data.name) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 })
    }

    // Since we're using string categories in the service model,
    // we don't actually create a separate category record.
    // Categories are created implicitly when services are created with them.
    const category = {
      id: data.name.toLowerCase().replace(/\s+/g, '-'),
      name: data.name,
      description: data.description || `${data.name} services`,
      serviceCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    console.log(`✅ Category "${data.name}" will be available when services are created with this category`)
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error("❌ Error creating service category:", error)
    return NextResponse.json({ error: "Failed to create service category" }, { status: 500 })
  }
}
