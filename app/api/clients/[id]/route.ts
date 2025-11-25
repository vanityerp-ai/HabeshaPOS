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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

    // Fetch client from Prisma (SINGLE SOURCE OF TRUTH)
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: true,
        preferredLocation: true,
        loyaltyProgram: true
      }
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Parse preferences
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
        console.error(`Invalid JSON in preferences for client ${client.name}:`, client.preferences)
      }
    }

    // Transform to expected format
    const clientData = {
      id: client.id,
      name: client.name,
      email: client.email || client.user?.email || '',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      state: client.state || '',
      zip: client.zipCode || '',
      birthday: client.dateOfBirth?.toISOString().split('T')[0] || '',
      preferredLocation: client.preferredLocationId || 'loc1',
      locations: client.preferredLocationId ? [client.preferredLocationId] : ['loc1'],
      status: 'Active' as const,
      avatar: generateInitials(client.name),
      segment: 'Regular' as const,
      totalSpent: client.loyaltyProgram?.totalSpent ? Number(client.loyaltyProgram.totalSpent) : 0,
      preferences,
      notes: client.notes || '',
      registrationSource: client.registrationSource || 'manual',
      isAutoRegistered: client.isAutoRegistered || false,
      createdAt: client.createdAt.toISOString(),
      updatedAt: client.updatedAt.toISOString()
    }

    return NextResponse.json({ client: clientData })
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const data = await request.json()

    console.log(`🔄 Updating client ${clientId} with data:`, data)

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        user: true
      }
    })

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Prepare update data
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.phone !== undefined) updateData.phone = data.phone || null
    if (data.email !== undefined) updateData.email = data.email || null
    if (data.address !== undefined) updateData.address = data.address || null
    if (data.city !== undefined) updateData.city = data.city || null
    if (data.state !== undefined) updateData.state = data.state || null
    if (data.zipCode !== undefined) updateData.zipCode = data.zipCode || null
    if (data.notes !== undefined) updateData.notes = data.notes || null
    if (data.birthday !== undefined) {
      updateData.dateOfBirth = data.birthday ? new Date(data.birthday) : null
    }

    // Handle preferred location - convert empty string to null
    if (data.preferredLocationId !== undefined) {
      updateData.preferredLocationId = data.preferredLocationId || null
    }

    // Handle preferences
    if (data.preferences !== undefined) {
      updateData.preferences = JSON.stringify(data.preferences)
    }

    console.log('📝 Update data prepared:', updateData)

    // Update client in Prisma (SINGLE SOURCE OF TRUTH)
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: updateData,
      include: {
        user: true,
        preferredLocation: true,
        loyaltyProgram: true
      }
    })

    console.log('✅ Client updated successfully:', {
      id: updatedClient.id,
      name: updatedClient.name,
      preferredLocationId: updatedClient.preferredLocationId,
      preferredLocationName: updatedClient.preferredLocation?.name
    })

    // Also update user email if provided
    if (data.email && existingClient.user) {
      await prisma.user.update({
        where: { id: existingClient.userId },
        data: { email: data.email }
      })
    }

    // Parse preferences for response
    let preferences = {
      preferredStylists: [],
      preferredServices: [],
      preferredProducts: [],
      allergies: [],
      notes: ''
    }

    if (updatedClient.preferences) {
      try {
        preferences = JSON.parse(updatedClient.preferences)
      } catch (error) {
        console.error(`Invalid JSON in preferences:`, updatedClient.preferences)
      }
    }

    // Transform to expected format
    const responseClient = {
      id: updatedClient.id,
      name: updatedClient.name,
      email: updatedClient.email || updatedClient.user?.email || '',
      phone: updatedClient.phone || '',
      address: updatedClient.address || '',
      city: updatedClient.city || '',
      state: updatedClient.state || '',
      zip: updatedClient.zipCode || '',
      birthday: updatedClient.dateOfBirth?.toISOString().split('T')[0] || '',
      preferredLocation: updatedClient.preferredLocationId || 'loc1',
      locations: updatedClient.preferredLocationId ? [updatedClient.preferredLocationId] : ['loc1'],
      status: 'Active' as const,
      avatar: generateInitials(updatedClient.name),
      segment: 'Regular' as const,
      totalSpent: updatedClient.loyaltyProgram?.totalSpent ? Number(updatedClient.loyaltyProgram.totalSpent) : 0,
      preferences,
      notes: updatedClient.notes || '',
      registrationSource: updatedClient.registrationSource || 'manual',
      isAutoRegistered: updatedClient.isAutoRegistered || false,
      createdAt: updatedClient.createdAt.toISOString(),
      updatedAt: updatedClient.updatedAt.toISOString()
    }

    return NextResponse.json({ client: responseClient })
  } catch (error) {
    console.error("Error updating client:", error)
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

    // Check if client exists
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId }
    })

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Delete client from Prisma (SINGLE SOURCE OF TRUTH)
    // Cascade delete will handle related records (loyaltyProgram, memberships)
    // User will also be deleted due to onDelete: Cascade
    await prisma.client.delete({
      where: { id: clientId }
    })

    return NextResponse.json({
      success: true,
      message: "Client deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting client:", error)
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 })
  }
}
