import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"

// GET /api/inventory/batches - Get all product batches with optional filtering
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")
    const locationId = searchParams.get("locationId")
    const expiringSoon = searchParams.get("expiringSoon") === "true"

    console.log("🔄 Fetching product batches...")

    // Build where clause based on filters
    const whereClause: any = {
      isActive: true
    }

    if (productId) {
      whereClause.productId = productId
    }

    if (locationId) {
      whereClause.locationId = locationId
    }

    // If filtering for expiring soon, add date filter
    if (expiringSoon) {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      
      whereClause.expiryDate = {
        lte: thirtyDaysFromNow,
        gte: new Date() // Not expired yet
      }
    }

    const batches = await prisma.productBatch.findMany({
      where: whereClause,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            sku: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    console.log(`✅ Found ${batches.length} product batches`)
    return NextResponse.json({ batches })
  } catch (error) {
    console.error("❌ Error fetching product batches:", error)

    // Check if it's a database schema issue
    if (error instanceof Error && error.message.includes('ProductBatch')) {
      return NextResponse.json({
        error: "Batch tracking not available",
        details: "ProductBatch table not found. Please run database migration: npx prisma db push",
        batches: []
      }, { status: 500 })
    }

    return NextResponse.json({
      error: "Failed to fetch product batches",
      details: error instanceof Error ? error.message : "Unknown error",
      batches: []
    }, { status: 500 })
  }
}

// POST /api/inventory/batches - Create a new product batch
export async function POST(request: Request) {
  try {
    // Check user session and permissions
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.productId || !data.locationId || !data.batchNumber || !data.quantity) {
      return NextResponse.json({ 
        error: "Missing required fields: productId, locationId, batchNumber, and quantity are required" 
      }, { status: 400 })
    }

    console.log("🔄 Creating new product batch...")

    // Check if batch already exists
    const existingBatch = await prisma.productBatch.findUnique({
      where: {
        productId_locationId_batchNumber: {
          productId: data.productId,
          locationId: data.locationId,
          batchNumber: data.batchNumber
        }
      }
    })

    if (existingBatch) {
      return NextResponse.json({ 
        error: "Batch with this number already exists for this product and location" 
      }, { status: 400 })
    }

    // Verify product and location exist
    const product = await prisma.product.findUnique({
      where: { id: data.productId }
    })

    const location = await prisma.location.findUnique({
      where: { id: data.locationId }
    })

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    // Create the batch
    const batch = await prisma.productBatch.create({
      data: {
        productId: data.productId,
        locationId: data.locationId,
        batchNumber: data.batchNumber,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        quantity: parseInt(data.quantity),
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,
        supplierInfo: data.supplierInfo || null,
        notes: data.notes || null
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            sku: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.log(`✅ Created product batch: ${batch.batchNumber}`)
    return NextResponse.json({ 
      success: true, 
      message: "Product batch created successfully",
      batch 
    })

  } catch (error) {
    console.error("❌ Error creating product batch:", error)
    return NextResponse.json({ 
      error: "Failed to create product batch",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
