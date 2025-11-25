import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const { name, phone } = await request.json()

    if (!name && !phone) {
      return NextResponse.json(
        { error: "Name or phone is required" },
        { status: 400 }
      )
    }

    // Normalize inputs for comparison
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null
    const normalizedName = name ? name.trim().toLowerCase() : null

    // Get all clients to check for duplicates
    const existingClients = await prisma.client.findMany({
      include: {
        user: true
      }
    })

    const duplicates = []

    // Check for phone number duplicate
    if (normalizedPhone) {
      const phoneMatch = existingClients.find(client => 
        normalizePhoneNumber(client.phone || '') === normalizedPhone
      )
      
      if (phoneMatch) {
        duplicates.push({
          type: 'phone',
          client: {
            id: phoneMatch.id,
            userId: phoneMatch.userId, // Add userId for appointment creation
            name: phoneMatch.name,
            phone: phoneMatch.phone,
            email: phoneMatch.user?.email
          }
        })
      }
    }

    // Check for name duplicate (case-insensitive)
    if (normalizedName) {
      const nameMatch = existingClients.find(client => 
        client.name.trim().toLowerCase() === normalizedName
      )
      
      if (nameMatch && (!normalizedPhone || normalizePhoneNumber(nameMatch.phone || '') !== normalizedPhone)) {
        duplicates.push({
          type: 'name',
          client: {
            id: nameMatch.id,
            userId: nameMatch.userId, // Add userId for appointment creation
            name: nameMatch.name,
            phone: nameMatch.phone,
            email: nameMatch.user?.email
          }
        })
      }
    }

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      duplicates
    })

  } catch (error) {
    console.error("Error checking for duplicates:", error)
    return NextResponse.json(
      { error: "Failed to check for duplicates" },
      { status: 500 }
    )
  }
}

// Helper function to normalize phone numbers for comparison
function normalizePhoneNumber(phone: string): string {
  if (!phone) return ''
  // Remove all non-digit characters and normalize
  return phone.replace(/\D/g, '')
}
