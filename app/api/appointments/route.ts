import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackChange } from "@/lib/change-tracker";
import { getUserFromHeaders } from "@/lib/auth-server";

/**
 * GET /api/appointments
 * 
 * Get all appointments from database with location-based access control
 */
export async function GET(request: NextRequest) {
  try {
    // Get user information from headers (set by middleware)
    const currentUser = getUserFromHeaders(request);
    
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const staffId = searchParams.get("staffId");
    const clientId = searchParams.get("clientId");
    const date = searchParams.get("date");

    // Build where clause
    const where: any = {};

    // Apply location-based access control
    if (currentUser && currentUser.locations.length > 0) {
      where.locationId = { in: currentUser.locations };
    }

    // Apply additional filters
    if (locationId) {
      where.locationId = locationId;
    }

    if (staffId) {
      where.staffId = staffId;
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      where.date = {
        gte: targetDate,
        lt: nextDay
      };
    }

    // Fetch appointments from database
    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            clientProfile: {
              select: { name: true, phone: true, email: true }
            }
          }
        },
        staff: {
          select: { id: true, name: true, color: true }
        },
        location: {
          select: { id: true, name: true, address: true }
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true, duration: true }
            },
            staff: true
          }
        },
        products: {
          include: {
            product: {
              select: { id: true, name: true, price: true }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Transform to match frontend format
    const transformedAppointments = appointments.map(appointment => {
      // Parse statusHistory from JSON string if it exists
      let statusHistory = [];
      if ((appointment as any).statusHistory) {
        try {
          statusHistory = typeof (appointment as any).statusHistory === 'string'
            ? JSON.parse((appointment as any).statusHistory)
            : (appointment as any).statusHistory;
        } catch (e) {
          console.error('Failed to parse statusHistory:', e);
          statusHistory = [];
        }
      }

      // If no status history exists, create initial entry from createdAt
      if (statusHistory.length === 0) {
        statusHistory = [{
          status: 'pending',
          timestamp: appointment.createdAt.toISOString(),
          updatedBy: 'System'
        }];
      }

      return {
        id: appointment.id,
        bookingReference: appointment.bookingReference,
        clientId: appointment.clientId,
        clientName: appointment.client.clientProfile?.name || "Unknown",
        staffId: appointment.staffId,
        staffName: appointment.staff.name,
        service: appointment.services[0]?.service.name || "",
        serviceId: appointment.services[0]?.serviceId || "",
        date: appointment.date.toISOString(),
        duration: appointment.duration,
        location: appointment.locationId,
        locationName: appointment.location.name,
        price: Number(appointment.totalPrice),
        notes: appointment.notes,
        status: appointment.status,
        statusHistory: statusHistory,
        // Payment fields
        paymentStatus: (appointment as any).paymentStatus,
        paymentMethod: (appointment as any).paymentMethod,
        paymentDate: (appointment as any).paymentDate?.toISOString(),
        discountPercentage: (appointment as any).discountPercentage ? Number((appointment as any).discountPercentage) : undefined,
        discountAmount: (appointment as any).discountAmount ? Number((appointment as any).discountAmount) : undefined,
        originalAmount: (appointment as any).originalAmount ? Number((appointment as any).originalAmount) : undefined,
        finalAmount: (appointment as any).finalAmount ? Number((appointment as any).finalAmount) : undefined,
        transactionRecorded: (appointment as any).transactionRecorded,
        createdAt: appointment.createdAt.toISOString(),
        updatedAt: appointment.updatedAt.toISOString(),
        additionalServices: appointment.services.slice(1).map(s => {
          return {
            id: s.serviceId,
            serviceId: s.serviceId,
            name: s.service.name,
            price: Number(s.price),
            duration: s.duration,
            staffId: s.staffId,
            staffName: s.staff?.name || null,
            completed: s.completed // surface per-service completion for calendar + availability
          };
        }),
        products: appointment.products.map(p => ({
          id: p.productId,
          name: p.product.name,
          price: Number(p.price),
          quantity: p.quantity
        }))
      };
    });

    console.log(`API: Retrieved ${transformedAppointments.length} appointments from database`);
    
    return NextResponse.json({ 
      appointments: transformedAppointments,
      total: transformedAppointments.length
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

/**
 * POST /api/appointments
 *
 * Create a new appointment in database with change tracking
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = getUserFromHeaders(request);
    const data = await request.json();

    console.log("📅 Creating appointment with data:", JSON.stringify(data, null, 2));

    // Generate booking reference if not provided
    const bookingReference = data.bookingReference || `VH-${Date.now().toString().slice(-6)}`;

    // Build the services array for creation
    const servicesToCreate: { serviceId: string; price: number; duration: number }[] = [];

    // Add main service if provided
    if (data.serviceId) {
      servicesToCreate.push({
        serviceId: data.serviceId,
        price: data.price || 0,
        duration: data.duration || 0
      });
      console.log("📦 Adding main service:", data.serviceId);
    }

    // Add additional services if provided
    if (data.additionalServices && Array.isArray(data.additionalServices) && data.additionalServices.length > 0) {
      console.log("📦 Processing additional services:", data.additionalServices.length);
      for (const additionalService of data.additionalServices) {
        const serviceId = additionalService.serviceId || additionalService.id;
        // Skip if no valid service ID or if it's a temp ID
        if (!serviceId || serviceId.startsWith('temp-') || serviceId.startsWith('service-')) {
          console.log("⚠️ Skipping invalid service ID:", serviceId);
          continue;
        }
        // Skip if it's the same as the main service
        if (serviceId === data.serviceId) {
          console.log("⚠️ Skipping duplicate main service:", serviceId);
          continue;
        }
        servicesToCreate.push({
          serviceId: serviceId,
          price: additionalService.price || 0,
          duration: additionalService.duration || 0
        });
        console.log("📦 Adding additional service:", serviceId, additionalService.name);
      }
    }

    console.log("📦 Total services to create:", servicesToCreate.length);

    // Create appointment in database with all services
    const appointment = await prisma.appointment.create({
      data: {
        bookingReference,
        clientId: data.clientId,
        staffId: data.staffId,
        locationId: data.location || data.locationId,
        date: new Date(data.date),
        duration: data.duration,
        totalPrice: data.price || data.totalPrice || 0,
        status: data.status || "PENDING",
        notes: data.notes,
        statusHistory: data.statusHistory ? JSON.stringify(data.statusHistory) : undefined,
        // Create all services (main + additional) in one go
        services: servicesToCreate.length > 0 ? {
          create: servicesToCreate
        } : undefined
      },
      include: {
        client: {
          select: {
            clientProfile: { select: { name: true } }
          }
        },
        staff: {
          select: { name: true, color: true }
        },
        location: {
          select: { name: true }
        },
        services: {
          include: {
            service: {
              select: { id: true, name: true, duration: true }
            }
          }
        }
      }
    });

    console.log("✅ Appointment created with", appointment.services.length, "services");

    // Track change for real-time sync
    await trackChange({
      entityType: "Appointment",
      entityId: appointment.id,
      changeType: "CREATE",
      locationId: appointment.locationId,
      userId: currentUser?.id
    });

    // Transform additional services for response
    const additionalServicesResponse = appointment.services.slice(1).map(as => ({
      id: as.id,
      serviceId: as.serviceId,
      name: as.service.name,
      price: Number(as.price),
      duration: as.duration || as.service.duration,
      completed: as.completed
    }));

    // Transform response
    const transformed = {
      id: appointment.id,
      bookingReference: appointment.bookingReference,
      clientId: appointment.clientId,
      clientName: appointment.client.clientProfile?.name || "Unknown",
      staffId: appointment.staffId,
      staffName: appointment.staff.name,
      staffColor: appointment.staff.color,
      service: appointment.services[0]?.service.name || data.service,
      serviceId: appointment.services[0]?.serviceId || data.serviceId,
      date: appointment.date.toISOString(),
      duration: appointment.duration,
      location: appointment.locationId,
      locationName: appointment.location.name,
      price: Number(appointment.totalPrice),
      notes: appointment.notes,
      status: appointment.status,
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
      // Include additional services in response
      additionalServices: additionalServicesResponse
    };

    console.log("API: Created appointment", transformed.id, "with", additionalServicesResponse.length, "additional services");

    return NextResponse.json({
      success: true,
      appointment: transformed
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create appointment", message: errorMessage },
      { status: 500 }
    );
  }
}
