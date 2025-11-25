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

    console.log('🔄 Updating appointment:', id, 'with data:', JSON.stringify(data, null, 2));

    // Handle additional services and products
    // First, get current appointment to find the main service
    let mainServiceServiceId: string | undefined;
    if (data.additionalServices !== undefined || data.products !== undefined) {
      const currentAppointment = await prisma.appointment.findUnique({
        where: { id },
        include: {
          services: true,
          products: true
        }
      });

      if (currentAppointment) {
        // Get the main service's serviceId (not the AppointmentService id)
        mainServiceServiceId = currentAppointment.services[0]?.serviceId;
        const mainServiceId = currentAppointment.services[0]?.id;

        if (data.additionalServices !== undefined) {
          console.log('🗑️ Deleting existing additional services (keeping main service)');
          await prisma.appointmentService.deleteMany({
            where: {
              appointmentId: id,
              id: { not: mainServiceId }
            }
          });
        }

        if (data.products !== undefined) {
          console.log('🗑️ Deleting existing products');
          await prisma.appointmentProduct.deleteMany({
            where: { appointmentId: id }
          });
        }
      }
    }

    // Build the update data object
    const updateData: any = {
      clientId: data.clientId,
      staffId: data.staffId,
      locationId: data.location || data.locationId,
      date: new Date(data.date),
      duration: data.duration,
      totalPrice: data.price || data.totalPrice || 0,
      status: data.status,
      notes: data.notes,
      updatedAt: new Date()
    };

    // Add additional services if provided
    if (data.additionalServices && data.additionalServices.length > 0) {
      console.log('➕ Adding additional services:', data.additionalServices.length);

      // Filter out services that match the main service to avoid unique constraint violation
      const servicesToAdd = data.additionalServices.filter((service: any) => {
        const serviceId = service.serviceId || service.id;
        const isDuplicate = serviceId === mainServiceServiceId;
        if (isDuplicate) {
          console.log('  ⚠️ Skipping duplicate service:', service.name, 'ID:', serviceId);
        }
        return !isDuplicate;
      });

      if (servicesToAdd.length > 0) {
        updateData.services = {
          create: servicesToAdd.map((service: any) => {
            console.log('  - Service:', service.name, 'ID:', service.serviceId || service.id);
            return {
              serviceId: service.serviceId || service.id,
              price: service.price,
              duration: service.duration
            };
          })
        };
      }
    }

    // Add products if provided
    if (data.products && data.products.length > 0) {
      console.log('➕ Adding products:', data.products.length);
      updateData.products = {
        create: data.products.map((product: any) => {
          console.log('  - Product:', product.name, 'ID:', product.productId || product.id);
          return {
            productId: product.productId || product.id,
            quantity: product.quantity || 1,
            price: product.price
          };
        })
      };
    }

    // Update appointment in database
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
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

    console.log('✅ Appointment updated successfully with services:', updatedAppointment.services.length, 'and products:', updatedAppointment.products.length);

    // Track change for real-time sync
    await trackChange({
      entityType: "Appointment",
      entityId: updatedAppointment.id,
      changeType: "UPDATE",
      locationId: updatedAppointment.locationId,
      userId: currentUser?.id
    });

    // Transform response to match frontend format
    const transformed = {
      id: updatedAppointment.id,
      bookingReference: updatedAppointment.bookingReference,
      clientId: updatedAppointment.clientId,
      clientName: updatedAppointment.client.clientProfile?.name || "Unknown",
      staffId: updatedAppointment.staffId,
      staffName: updatedAppointment.staff.name,
      service: updatedAppointment.services[0]?.service.name || "",
      serviceId: updatedAppointment.services[0]?.serviceId || "",
      date: updatedAppointment.date.toISOString(),
      duration: updatedAppointment.duration,
      location: updatedAppointment.locationId,
      locationName: updatedAppointment.location.name,
      price: Number(updatedAppointment.totalPrice),
      notes: updatedAppointment.notes,
      status: updatedAppointment.status,
      updatedAt: updatedAppointment.updatedAt.toISOString(),
      additionalServices: updatedAppointment.services.slice(1).map(s => ({
        id: s.serviceId,
        name: s.service.name,
        price: Number(s.price),
        duration: s.duration,
        staffId: s.service.id,
        staffName: s.service.name
      })),
      products: updatedAppointment.products.map(p => ({
        id: p.productId,
        name: p.product.name,
        price: Number(p.price),
        quantity: p.quantity,
        unitPrice: Number(p.product.price)
      }))
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
