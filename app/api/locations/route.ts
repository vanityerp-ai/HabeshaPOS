import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserFromHeaders, filterLocationsByAccess } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
  try {
    console.log("🔄 Fetching locations from database...")

    const locations = await prisma.location.findMany({
      where: {
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log(`📊 Found ${locations.length} active locations in database`)

    // Transform locations to match expected format
    const transformedLocations = locations.map(location => ({
      id: location.id,
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      country: location.country,
      phone: location.phone,
      email: location.email,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt
    }))

    // Apply user-based access control
    let filteredLocations = transformedLocations;
    
    try {
      const currentUser = getUserFromHeaders(request);
      
      if (currentUser) {
        console.log(`🔍 Current user ID: ${currentUser.id}, Role: ${currentUser.role}, Locations: ${JSON.stringify(currentUser.locations)}`);
        filteredLocations = filterLocationsByAccess(transformedLocations, currentUser.locations || [], currentUser.role || undefined);
        console.log(`🔒 Filtered locations by user access: ${filteredLocations.length}/${transformedLocations.length} locations visible to user`);
        console.log(`🔒 Visible locations: ${filteredLocations.map(loc => loc.name).join(', ')}`);
      } else {
        console.log("🔍 No authenticated user found in headers, returning all locations");
      }
    } catch (filterError) {
      console.warn("⚠️ Error filtering locations by user access, returning all locations:", filterError);
      // If filtering fails, return all locations to avoid breaking the app
      filteredLocations = transformedLocations;
    }

    console.log(`✅ Successfully fetched ${filteredLocations.length} locations`)
    return NextResponse.json({ locations: filteredLocations })
  } catch (error) {
    console.error("❌ Error fetching locations:", error)
    console.error("❌ Error details:", error instanceof Error ? error.message : String(error))
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json({ 
      error: "Failed to fetch locations",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log("🔄 Creating new location...")
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.address || !data.city) {
      return NextResponse.json({ error: "Missing required fields: name, address, and city are required" }, { status: 400 })
    }

    // Create the location with Prisma
    const location = await prisma.location.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state || "",
        zipCode: data.zipCode || "",
        country: data.country || "Qatar",
        phone: data.phone || "",
        email: data.email || "",
      }
    })

    // Transform location to match expected format
    const transformedLocation = {
      id: location.id,
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zipCode: location.zipCode,
      country: location.country,
      phone: location.phone,
      email: location.email,
      isActive: location.isActive,
      createdAt: location.createdAt,
      updatedAt: location.updatedAt
    }

    console.log(`✅ Successfully created location: ${location.name}`)
    return NextResponse.json({ location: transformedLocation }, { status: 201 })
  } catch (error) {
    console.error("❌ Error creating location:", error)
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 })
  }
}
