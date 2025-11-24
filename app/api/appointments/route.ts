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
            }
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
    const transformedAppointments = appointments.map(appointment => ({
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
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
      additionalServices: appointment.services.slice(1).map(s => ({
        id: s.serviceId,
        name: s.service.name,
        price: Number(s.price),
        duration: s.duration
      })),
      products: appointment.products.map(p => ({
        id: p.productId,
        name: p.product.name,
        price: Number(p.price),
        quantity: p.quantity
      }))
    }));

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

    // Generate booking reference if not provided
    const bookingReference = data.bookingReference || `VH-${Date.now().toString().slice(-6)}`;

    // Create appointment in database
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
        notes: data.notes
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
        }
      }
    });

    // Create service relationship if service provided
    if (data.serviceId || data.service) {
      await prisma.appointmentService.create({
        data: {
          appointmentId: appointment.id,
          serviceId: data.serviceId,
          price: data.price || 0,
          duration: data.duration
        }
      });
    }

    // Track change for real-time sync
    await trackChange({
      entityType: "Appointment",
      entityId: appointment.id,
      changeType: "CREATE",
      locationId: appointment.locationId,
      userId: currentUser?.id
    });

    // Transform response
    const transformed = {
      id: appointment.id,
      bookingReference: appointment.bookingReference,
      clientId: appointment.clientId,
      clientName: appointment.client.clientProfile?.name || "Unknown",
      staffId: appointment.staffId,
      staffName: appointment.staff.name,
      staffColor: appointment.staff.color,
      service: data.service,
      serviceId: data.serviceId,
      date: appointment.date.toISOString(),
      duration: appointment.duration,
      location: appointment.locationId,
      locationName: appointment.location.name,
      price: Number(appointment.totalPrice),
      notes: appointment.notes,
      status: appointment.status,
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString()
    };

    console.log("API: Created appointment", transformed.id);

    return NextResponse.json({
      success: true,
      appointment: transformed
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json(
      { error: "Failed to create appointment" },
      { status: 500 }
    );
  }
}
