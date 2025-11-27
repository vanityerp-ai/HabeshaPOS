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
      }
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

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
      statusHistory: statusHistory,
      createdAt: appointment.createdAt.toISOString(),
      updatedAt: appointment.updatedAt.toISOString(),
      // Payment fields
      paymentStatus: appointment.paymentStatus,
      paymentMethod: appointment.paymentMethod,
      paymentDate: appointment.paymentDate?.toISOString(),
      discountPercentage: appointment.discountPercentage ? Number(appointment.discountPercentage) : undefined,
      discountAmount: appointment.discountAmount ? Number(appointment.discountAmount) : undefined,
      originalAmount: appointment.originalAmount ? Number(appointment.originalAmount) : undefined,
      finalAmount: appointment.finalAmount ? Number(appointment.finalAmount) : undefined,
      transactionRecorded: appointment.transactionRecorded,
      additionalServices: appointment.services.slice(1).map(s => {
        return {
          id: s.serviceId,
          serviceId: s.serviceId,
          name: s.service.name,
          price: Number(s.price),
          duration: s.duration,
          staffId: s.staffId,
          staffName: s.staff?.name || null,
          completed: s.completed
        };
      }),
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

    console.log('🔄 PUT /api/appointments/[id] called');
    console.log('🔄 Appointment ID:', id);
    console.log('🔄 Request data keys:', Object.keys(data));
    console.log('🔄 justUpdated flag:', data.justUpdated);
    console.log('🔄 additionalServices:', JSON.stringify(data.additionalServices, null, 2));
    console.log('🔄 products:', JSON.stringify(data.products, null, 2));

    // Handle additional services and products
    // Only process if they are explicitly being updated with new items
    // New items from the UI have:
    //   - id: temporary UI ID like "service-1234567890-abc"
    //   - serviceId: the actual database service ID (a CUID)
    let mainServiceServiceId: string | undefined;

    // Debug: Check each service
    if (data.additionalServices && Array.isArray(data.additionalServices)) {
      console.log('🔍 Checking additionalServices:');
      data.additionalServices.forEach((s: any, i: number) => {
        const hasTempId = s.id && (s.id.startsWith('service-') || s.id.startsWith('temp-'));
        const hasValidServiceId = s.serviceId && !s.serviceId.startsWith('service-') && !s.serviceId.startsWith('temp-');
        console.log(`  [${i}] id: ${s.id}, serviceId: ${s.serviceId}, hasTempId: ${hasTempId}, hasValidServiceId: ${hasValidServiceId}`);
      });
    }

    const hasNewAdditionalServices = data.additionalServices &&
      Array.isArray(data.additionalServices) &&
      data.additionalServices.length > 0 &&
      data.additionalServices.some((s: any) => {
        // New services have a temp UI id (starting with 'service-') but a valid serviceId
        const hasTempId = s.id && (s.id.startsWith('service-') || s.id.startsWith('temp-'));
        const hasValidServiceId = s.serviceId && !s.serviceId.startsWith('service-') && !s.serviceId.startsWith('temp-');
        return hasTempId && hasValidServiceId;
      });

    console.log('🔍 hasNewAdditionalServices:', hasNewAdditionalServices);

    const hasNewProducts = data.products &&
      Array.isArray(data.products) &&
      data.products.length > 0 &&
      data.products.some((p: any) => {
        // New products have a temp UI id (starting with 'product-') but a valid productId
        const hasTempId = p.id && (p.id.startsWith('product-') || p.id.startsWith('temp-'));
        const hasValidProductId = p.productId && !p.productId.startsWith('product-') && !p.productId.startsWith('temp-');
        return hasTempId && hasValidProductId;
      });

    if (hasNewAdditionalServices || hasNewProducts) {
      console.log('📦 Processing additional services/products update');
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

        if (hasNewAdditionalServices) {
          console.log('🗑️ Deleting existing additional services (keeping main service)');
          await prisma.appointmentService.deleteMany({
            where: {
              appointmentId: id,
              id: { not: mainServiceId }
            }
          });
        }

        if (hasNewProducts) {
          console.log('🗑️ Deleting existing products');
          await prisma.appointmentProduct.deleteMany({
            where: { appointmentId: id }
          });
        }
      }
    } else {
      console.log('⏭️ Skipping services/products update (no new items to add)');
    }

    // Build the update data object - only include fields that are provided
    const updateData: any = {
      updatedAt: new Date()
    };

    // Only add fields if they are provided (not undefined)
    if (data.clientId !== undefined) {
      updateData.clientId = data.clientId;
    }
    if (data.staffId !== undefined) {
      updateData.staffId = data.staffId;
    }
    if (data.location !== undefined || data.locationId !== undefined) {
      updateData.locationId = data.location || data.locationId;
    }
    if (data.date !== undefined) {
      updateData.date = new Date(data.date);
    }
    if (data.duration !== undefined) {
      updateData.duration = data.duration;
    }
    if (data.price !== undefined || data.totalPrice !== undefined) {
      updateData.totalPrice = data.price || data.totalPrice || 0;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    // Add payment fields if provided
    if (data.paymentStatus !== undefined) {
      updateData.paymentStatus = data.paymentStatus;
    }
    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    if (data.paymentDate !== undefined) {
      updateData.paymentDate = data.paymentDate ? new Date(data.paymentDate) : null;
    }
    if (data.discountPercentage !== undefined) {
      updateData.discountPercentage = data.discountPercentage;
    }
    if (data.discountAmount !== undefined) {
      updateData.discountAmount = data.discountAmount;
    }
    if (data.originalAmount !== undefined) {
      updateData.originalAmount = data.originalAmount;
    }
    if (data.finalAmount !== undefined) {
      updateData.finalAmount = data.finalAmount;
    }
    if (data.transactionRecorded !== undefined) {
      updateData.transactionRecorded = data.transactionRecorded;
    }

    // Add statusHistory if provided (store as JSON string)
    if (data.statusHistory !== undefined) {
      updateData.statusHistory = JSON.stringify(data.statusHistory);
    }

    // If the appointment status is being changed to 'completed',
    // also mark all associated services as completed
    if (data.status === 'completed') {
      console.log('✅ Parent appointment marked as completed - updating all services to completed');
      await prisma.appointmentService.updateMany({
        where: { appointmentId: id },
        data: { completed: true }
      });
    }

    // Add additional services if there are new ones to add
    if (hasNewAdditionalServices) {
      console.log('➕ Adding additional services:', data.additionalServices.length);

      // Filter to only include NEW services (those with temp UI IDs but valid serviceIds)
      // and exclude duplicates of the main service
      const servicesToAdd = data.additionalServices.filter((service: any) => {
        // Must have a temp UI id (meaning it's new from the frontend)
        const hasTempId = service.id && (service.id.startsWith('service-') || service.id.startsWith('temp-'));
        if (!hasTempId) {
          console.log('  ⚠️ Skipping service without temp ID (already in DB):', service.name);
          return false;
        }

        // Must have a valid serviceId (the actual database service ID)
        if (!service.serviceId) {
          console.log('  ⚠️ Skipping service without serviceId:', service.name);
          return false;
        }

        // Skip if it's the same as the main service
        const isDuplicate = service.serviceId === mainServiceServiceId;
        if (isDuplicate) {
          console.log('  ⚠️ Skipping duplicate of main service:', service.name, 'ID:', service.serviceId);
          return false;
        }

        return true;
      });

      console.log('📦 Services to add after filtering:', servicesToAdd.length);

      if (servicesToAdd.length > 0) {
        console.log('📋 Services to add:', JSON.stringify(servicesToAdd, null, 2));
        
        updateData.services = {
          create: servicesToAdd.map((service: any) => {
            const serviceData = {
              serviceId: service.serviceId,
              staffId: service.staffId || null, // Store staff assignment in database
              price: service.price || 0,
              duration: service.duration || 0
            };
            
            console.log('  ✅ Creating AppointmentService:', {
              serviceName: service.name,
              serviceId: serviceData.serviceId,
              staffId: serviceData.staffId,
              staffName: service.staffName,
              price: serviceData.price,
              duration: serviceData.duration
            });
            
            return serviceData;
          })
        };
        
        console.log('✅ Staff assignments will be stored in AppointmentService table');
      }
    }

    // Add products if there are new ones to add
    if (hasNewProducts) {
      console.log('➕ Adding products:', data.products.length);

      // Filter to only include NEW products (those with temp UI IDs but valid productIds)
      const productsToAdd = data.products.filter((product: any) => {
        // Must have a temp UI id (meaning it's new from the frontend)
        const hasTempId = product.id && (product.id.startsWith('product-') || product.id.startsWith('temp-'));
        if (!hasTempId) {
          console.log('  ⚠️ Skipping product without temp ID (already in DB):', product.name);
          return false;
        }

        // Must have a valid productId (the actual database product ID)
        if (!product.productId) {
          console.log('  ⚠️ Skipping product without productId:', product.name);
          return false;
        }

        return true;
      });

      console.log('📦 Products to add after filtering:', productsToAdd.length);

      if (productsToAdd.length > 0) {
        updateData.products = {
          create: productsToAdd.map((product: any) => {
            console.log('  ✅ Adding product:', product.name, 'productId:', product.productId);
            return {
              productId: product.productId,
              quantity: product.quantity || 1,
              price: product.price || 0
            };
          })
        };
      }
    }

    // Log the update data for debugging
    console.log('📝 Update data being sent to Prisma:', JSON.stringify(updateData, null, 2));

    // Update appointment in database
    let updatedAppointment;
    try {
      updatedAppointment = await prisma.appointment.update({
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
        }
      });
    } catch (prismaError: any) {
      console.error('❌ Prisma update error:', prismaError);
      console.error('❌ Prisma error code:', prismaError?.code);
      console.error('❌ Prisma error message:', prismaError?.message);
      console.error('❌ Prisma error meta:', prismaError?.meta);
      throw prismaError;
    }

    console.log('✅ Appointment updated successfully with services:', updatedAppointment.services.length, 'and products:', updatedAppointment.products.length);

    // Track change for real-time sync
    await trackChange({
      entityType: "Appointment",
      entityId: updatedAppointment.id,
      changeType: "UPDATE",
      locationId: updatedAppointment.locationId,
      userId: currentUser?.id
    });

    // Parse statusHistory from updated appointment
    let updatedStatusHistory = [];
    if ((updatedAppointment as any).statusHistory) {
      try {
        updatedStatusHistory = typeof (updatedAppointment as any).statusHistory === 'string'
          ? JSON.parse((updatedAppointment as any).statusHistory)
          : (updatedAppointment as any).statusHistory;
      } catch (e) {
        console.error('Failed to parse statusHistory:', e);
        updatedStatusHistory = [];
      }
    }

    // If no status history exists, create initial entry from createdAt
    if (updatedStatusHistory.length === 0) {
      updatedStatusHistory = [{
        status: 'pending',
        timestamp: updatedAppointment.createdAt.toISOString(),
        updatedBy: 'System'
      }];
    }

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
      statusHistory: updatedStatusHistory,
      createdAt: updatedAppointment.createdAt.toISOString(),
      updatedAt: updatedAppointment.updatedAt.toISOString(),
      // Payment fields
      paymentStatus: updatedAppointment.paymentStatus,
      paymentMethod: updatedAppointment.paymentMethod,
      paymentDate: updatedAppointment.paymentDate?.toISOString(),
      discountPercentage: updatedAppointment.discountPercentage ? Number(updatedAppointment.discountPercentage) : undefined,
      discountAmount: updatedAppointment.discountAmount ? Number(updatedAppointment.discountAmount) : undefined,
      originalAmount: updatedAppointment.originalAmount ? Number(updatedAppointment.originalAmount) : undefined,
      finalAmount: updatedAppointment.finalAmount ? Number(updatedAppointment.finalAmount) : undefined,
      transactionRecorded: updatedAppointment.transactionRecorded,
      additionalServices: updatedAppointment.services.slice(1).map(s => {
        return {
          id: s.serviceId,
          serviceId: s.serviceId,
          name: s.service.name,
          price: Number(s.price),
          duration: s.duration,
          staffId: s.staffId,
          staffName: s.staff?.name || null,
          completed: s.completed
        };
      }),
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
    // Return more detailed error information for debugging
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorDetails = error instanceof Error && 'code' in error ? (error as any).code : undefined;
    return NextResponse.json(
      {
        error: "Failed to update appointment",
        message: errorMessage,
        code: errorDetails
      },
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
