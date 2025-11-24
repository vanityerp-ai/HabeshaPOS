import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"

/**
 * GET /api/transactions
 * Fetch all transactions from the database
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")
    const clientId = searchParams.get("clientId")
    const userId = searchParams.get("userId")

    // Build where clause
    const where: any = {}
    if (locationId) {
      where.locationId = locationId
    }
    if (userId) {
      where.userId = userId
    }

    console.log("🔄 Fetching transactions from database...", where)

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`✅ Found ${transactions.length} transactions`)

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error("❌ Error fetching transactions:", error)
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 })
  }
}

/**
 * POST /api/transactions
 * Create a new transaction in the database
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()

    console.log("💾 Creating transaction in database:", {
      userId: data.userId,
      amount: data.amount,
      type: data.type,
      status: data.status
    })

    // Validate required fields
    if (!data.userId || !data.amount || !data.type || !data.status || !data.method) {
      return NextResponse.json({ 
        error: "Missing required fields: userId, amount, type, status, and method are required" 
      }, { status: 400 })
    }

    // Create transaction in database
    const transaction = await prisma.transaction.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        type: data.type,
        status: data.status,
        method: data.method,
        reference: data.reference || null,
        description: data.description || null,
        locationId: data.locationId || null,
        appointmentId: data.appointmentId || null,
        serviceAmount: data.serviceAmount || null,
        productAmount: data.productAmount || null,
        originalServiceAmount: data.originalServiceAmount || null,
        discountPercentage: data.discountPercentage || null,
        discountAmount: data.discountAmount || null,
        items: data.items ? JSON.stringify(data.items) : null
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
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

    console.log(`✅ Transaction created: ${transaction.id}`)

    return NextResponse.json({ 
      success: true,
      transaction 
    })
  } catch (error) {
    console.error("❌ Error creating transaction:", error)
    return NextResponse.json({ 
      error: "Failed to create transaction",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

