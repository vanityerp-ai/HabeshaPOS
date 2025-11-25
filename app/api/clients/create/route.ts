import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.phone) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      )
    }

    // Normalize phone number for comparison
    const normalizedPhone = normalizePhoneNumber(data.phone)
    
    // Normalize name for comparison (case-insensitive)
    const normalizedName = data.name.trim().toLowerCase()

    // Check for duplicates
    const existingClients = await prisma.client.findMany({
      include: {
        user: true
      }
    })

    // Check for phone number duplicate
    const phoneExists = existingClients.find(client => 
      normalizePhoneNumber(client.phone || '') === normalizedPhone
    )

    // Check for name duplicate (case-insensitive)
    const nameExists = existingClients.find(client => 
      client.name.trim().toLowerCase() === normalizedName
    )

    if (phoneExists || nameExists) {
      const duplicateType = phoneExists ? 'phone' : 'name'
      const existingClient = phoneExists || nameExists

      return NextResponse.json({
        error: "Duplicate client found",
        duplicateType,
        existingClient: {
          id: existingClient?.id,
          userId: existingClient?.userId, // Add userId for appointment creation
          name: existingClient?.name,
          phone: existingClient?.phone,
          email: existingClient?.user?.email
        },
        message: duplicateType === 'phone'
          ? `A client with phone number ${data.phone} already exists.`
          : `A client with the name "${data.name}" already exists.`
      }, { status: 409 })
    }

    // Generate a default password for the user account
    const defaultPassword = await bcrypt.hash('client123', 10)

    // Create user first
    const user = await prisma.user.create({
      data: {
        email: data.email || `${normalizedPhone}@temp.local`,
        password: defaultPassword,
        role: 'CLIENT',
        isActive: true
      }
    })

    // Create client profile with all fields
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name: data.name.trim(),
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        zipCode: data.zip || null,
        dateOfBirth: data.birthday ? new Date(data.birthday) : null,
        preferences: data.preferences ? JSON.stringify(data.preferences) : null,
        notes: data.notes || null,
        preferredLocationId: data.preferredLocation || null,
        registrationSource: data.registrationSource || 'manual',
        isAutoRegistered: data.isAutoRegistered || false
      },
      include: {
        user: true,
        preferredLocation: true
      }
    })

    // Create loyalty program for the client
    await prisma.loyaltyProgram.create({
      data: {
        clientId: client.id,
        points: 0,
        tier: 'Bronze',
        totalSpent: 0,
        isActive: true
      }
    })

    // Transform the response to match the expected client format
    const responseClient = {
      id: client.id,
      userId: user.id, // Add userId for appointment creation
      name: client.name,
      email: user.email,
      phone: client.phone,
      address: data.address || '',
      city: data.city || '',
      state: data.state || '',
      birthday: client.dateOfBirth?.toISOString().split('T')[0] || '',
      preferredLocation: data.preferredLocation || '',
      locations: data.locations || [],
      status: 'Active' as const,
      avatar: generateInitials(client.name),
      segment: 'New' as const,
      totalSpent: 0,
      referredBy: data.referredBy || '',
      preferences: data.preferences || {
        preferredStylists: [],
        preferredServices: [],
        allergies: [],
        notes: ''
      },
      notes: client.notes || '',
      registrationSource: data.registrationSource || 'manual',
      isAutoRegistered: data.isAutoRegistered || false,
      currency: data.currency || 'QAR',
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString()
    }

    return NextResponse.json({ 
      client: responseClient,
      message: "Client created successfully"
    })

  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
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

// Helper function to generate initials
function generateInitials(name: string): string {
  const nameParts = name.trim().split(' ')
  if (nameParts.length > 1) {
    return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
  }
  return nameParts[0].substring(0, 2).toUpperCase()
}
