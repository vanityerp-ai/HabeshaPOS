import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackChange } from "@/lib/change-tracker";
import { getUserFromHeaders } from "@/lib/auth-server";

/**
 * GET /api/appointments/[id]
 * Get a specific appointment by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const appointment = await prisma.appointment.findUnique({
      where: { id },
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
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Transform to match frontend format
    const transformedAppointment = {
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
    };

    return NextResponse.json(transformedAppointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/appointments/[id]
 * Update an existing appointment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = getUserFromHeaders(request);
    const data = await request.json();

    // Update appointment in database
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: {
        clientId: data.clientId,
        staffId: data.staffId,
        locationId: data.location || data.locationId,
        date: new Date(data.date),
        duration: data.duration,
        totalPrice: data.price || data.totalPrice || 0,
        status: data.status,
        notes: data.notes,
        updatedAt: new Date()
      },
      include: {
        client: {
          select: {
            clientProfile: { select: { name: true } }
          }
        },
        staff: {
          select: { name: true }
        },
        location: {
          select: { name: true }
        }
      }
    });

    // Track change for real-time sync
    await trackChange({
      entityType: "Appointment",
      entityId: updatedAppointment.id,
      changeType: "UPDATE",
      locationId: updatedAppointment.locationId,
      userId: currentUser?.id
    });

    // Transform response
    const transformed = {
      id: updatedAppointment.id,
      bookingReference: updatedAppointment.bookingReference,
      clientId: updatedAppointment.clientId,
      clientName: updatedAppointment.client.clientProfile?.name || "Unknown",
      staffId: updatedAppointment.staffId,
      staffName: updatedAppointment.staff.name,
      date: updatedAppointment.date.toISOString(),
      duration: updatedAppointment.duration,
      location: updatedAppointment.locationId,
      locationName: updatedAppointment.location.name,
      price: Number(updatedAppointment.totalPrice),
      notes: updatedAppointment.notes,
      status: updatedAppointment.status,
      updatedAt: updatedAppointment.updatedAt.toISOString()
    };

    return NextResponse.json({
      success: true,
      appointment: transformed
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json(
      { error: "Failed to update appointment" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/appointments/[id]
 * Delete an appointment
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = getUserFromHeaders(request);

    // Get appointment details before deletion for tracking
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { locationId: true }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Delete appointment (cascade will handle related records)
    await prisma.appointment.delete({
      where: { id }
    });

    // Track change for real-time sync
    await trackChange({
      entityType: "Appointment",
      entityId: id,
      changeType: "DELETE",
      locationId: appointment.locationId,
      userId: currentUser?.id
    });

    return NextResponse.json({
      success: true,
      message: "Appointment deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting appointment:", error);
    return NextResponse.json(
      { error: "Failed to delete appointment" },
      { status: 500 }
    );
  }
}
