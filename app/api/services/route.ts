import { NextResponse, NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUserFromHeaders } from "@/lib/auth-server"

export async function GET(request: NextRequest) {
  try {
    console.log("🔄 Fetching services from database...")

    // Fetch services with location relationships
    const services = await prisma.service.findMany({
      where: {
        isActive: true
      },
      include: {
        locations: {
          where: {
            isActive: true
          },
          include: {
            location: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    console.log(`✅ Found ${services.length} services in database`)

    // Transform to expected format
    const transformedServices = services.map(service => ({
      id: service.id,
      name: service.name,
      description: service.description || "",
      duration: service.duration,
      price: Number(service.price),
      category: service.category,
      categoryName: service.category,
      showPrices: service.showPricesToClients,
      locations: service.locations.map(loc => loc.locationId), // Include actual location IDs
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    }))

    console.log(`✅ Successfully returning ${transformedServices.length} services`)
    return NextResponse.json({ services: transformedServices })
  } catch (error) {
    console.error("❌ Error fetching services:", error)
    console.error("❌ Error details:", error instanceof Error ? error.message : String(error))
    console.error("❌ Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json({ 
      error: "Failed to fetch services",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    console.log("🔄 Creating new service...")
    const data = await request.json()

    // Validate required fields
    if (!data.name || !data.duration || data.price === undefined) {
      return NextResponse.json({ error: "Missing required fields: name, duration, and price are required" }, { status: 400 })
    }

    // If no locations specified, assign to all active locations
    let locationIds = data.locations
    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      console.log("📍 No locations specified, assigning to all active locations...")
      const allLocations = await prisma.location.findMany({
        where: { isActive: true },
        select: { id: true }
      })
      locationIds = allLocations.map(loc => loc.id)
      console.log(`📍 Found ${locationIds.length} active locations to assign`)
    }

    // Create the service with Prisma
    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description || null,
        duration: parseInt(data.duration),
        price: parseFloat(data.price),
        category: data.category || "Uncategorized",
        showPricesToClients: data.showPrices !== undefined ? data.showPrices : true,
        locations: {
          create: locationIds.map((locationId: string) => ({
            locationId: locationId,
            price: data.locationPrices?.[locationId] ? parseFloat(data.locationPrices[locationId]) : parseFloat(data.price)
          }))
        }
      },
      include: {
        locations: {
          include: {
            location: true
          }
        }
      }
    })

    // Transform service to match expected format
    const transformedService = {
      id: service.id,
      name: service.name,
      description: service.description || "",
      duration: service.duration,
      price: Number(service.price),
      category: service.category,
      categoryName: service.category,
      showPrices: service.showPricesToClients,
      locations: service.locations.map(loc => loc.locationId),
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    }

    console.log(`✅ Successfully created service: ${service.name}`)
    return NextResponse.json({ service: transformedService }, { status: 201 })
  } catch (error) {
    console.error("❌ Error creating service:", error)
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 })
  }
}

