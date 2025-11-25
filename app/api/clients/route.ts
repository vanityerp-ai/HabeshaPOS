import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Helper function to generate initials for avatar
function generateInitials(name: string): string {
  const nameParts = name.trim().split(" ")
  if (nameParts.length > 1) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }
  return nameParts[0].substring(0, 2).toUpperCase()
}

// Helper function to calculate client segment based on activity
function calculateSegment(client: any): "VIP" | "Regular" | "New" | "At Risk" {
  // This is a simplified segmentation logic
  // You can enhance this based on your business rules
  const createdAt = new Date(client.createdAt)
  const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSinceCreation < 30) {
    return "New"
  }

  // Check loyalty program tier
  if (client.loyaltyProgram?.tier === 'Gold' || client.loyaltyProgram?.tier === 'Platinum') {
    return "VIP"
  }

  // Check last activity
  if (client.loyaltyProgram?.lastActivity) {
    const lastActivity = new Date(client.loyaltyProgram.lastActivity)
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSinceActivity > 90) {
      return "At Risk"
    }
  }

  return "Regular"
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("locationId")

    // Build where clause for location filtering
    const where: any = {}
    if (locationId) {
      where.preferredLocationId = locationId
    }

    // Get all clients from Prisma (SINGLE SOURCE OF TRUTH)
    const clients = await prisma.client.findMany({
      where,
      include: {
        user: true,
        preferredLocation: true,
        loyaltyProgram: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Get all user IDs to fetch transactions
    const userIds = clients.map(client => client.userId).filter(Boolean)

    // Fetch all transactions for these users in one query
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: {
          in: userIds
        },
        status: 'COMPLETED' // Only count completed transactions
      },
      select: {
        userId: true,
        amount: true
      }
    })

    // Calculate total spent per user
    const totalSpentByUser = transactions.reduce((acc, transaction) => {
      const userId = transaction.userId
      if (!acc[userId]) {
        acc[userId] = 0
      }
      acc[userId] += Number(transaction.amount)
      return acc
    }, {} as Record<string, number>)

    console.log(`📊 Calculated total spent for ${Object.keys(totalSpentByUser).length} clients from ${transactions.length} transactions`)

    // Transform clients to match the expected format
    const transformedClients = clients.map(client => {
      // Safely parse preferences with error handling
      let preferences = {
        preferredStylists: [],
        preferredServices: [],
        preferredProducts: [],
        allergies: [],
        notes: ''
      }

      if (client.preferences) {
        try {
          preferences = JSON.parse(client.preferences)
        } catch (error) {
          console.error(`Invalid JSON in preferences for client ${client.name} (${client.id}):`, client.preferences)
          // Keep default preferences if JSON is invalid
        }
      }

      // Map location ID to location string format (for backward compatibility)
      let preferredLocation = 'loc1' // Default
      if (client.preferredLocationId) {
        // Get the location index from the database
        // This is a temporary mapping - ideally we should use location IDs directly
        preferredLocation = client.preferredLocationId
      }

      // Calculate total spent from actual transactions
      const totalSpent = totalSpentByUser[client.userId] || 0

      return {
        id: client.id,
        userId: client.userId, // Add userId for appointment creation
        name: client.name,
        email: client.email || client.user?.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        state: client.state || '',
        zip: client.zipCode || '',
        birthday: client.dateOfBirth?.toISOString().split('T')[0] || '',
        preferredLocation: preferredLocation,
        locations: [preferredLocation], // Use the same as preferred
        status: 'Active' as const,
        avatar: generateInitials(client.name),
        segment: calculateSegment(client),
        totalSpent: totalSpent,
        referredBy: '',
        preferences,
        notes: client.notes || '',
        registrationSource: client.registrationSource || 'manual',
        isAutoRegistered: client.isAutoRegistered || false,
        createdAt: client.createdAt.toISOString(),
        updatedAt: client.updatedAt.toISOString()
      }
    })

    return NextResponse.json({ clients: transformedClients })
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }

    // This route is deprecated - redirect to the new create endpoint
    return NextResponse.json({
      error: "This endpoint is deprecated. Use /api/clients/create instead."
    }, { status: 410 })

  } catch (error) {
    console.error("Error in POST /api/clients:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
