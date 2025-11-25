import { NextRequest, NextResponse } from "next/server";
import { appointments, createAppointment, Appointment } from "@/lib/appointments-data";
import { parseISO, isBefore, isAfter, addMinutes } from "date-fns";
import { addAppointment, getAllAppointments } from "@/lib/appointment-service";
import { getUserFromHeaders, filterAppointmentsByLocationAccess } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";

// Get all appointments or filter by client
export async function GET(request: NextRequest) {
  try {
    // Get user information from headers (set by middleware)
    const currentUser = getUserFromHeaders(request);

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const staffId = searchParams.get("staffId");
    const location = searchParams.get("location");
    const date = searchParams.get("date");

    // Get all appointments from the appointment service
    // This combines localStorage, mockAppointments, and appointments arrays
    let filteredAppointments = await getAllAppointments();
    console.log("API: Retrieved all appointments", filteredAppointments.length);

    // Apply location-based access control
    if (currentUser && currentUser.locations.length > 0) {
      filteredAppointments = filterAppointmentsByLocationAccess(filteredAppointments, currentUser.locations);
      console.log(`🔒 Filtered appointments by user location access: ${filteredAppointments.length} appointments visible to user`);
    }

    if (clientId) {
      filteredAppointments = filteredAppointments.filter(
        appointment => appointment.clientId === clientId
      );
    }

    if (staffId) {
      filteredAppointments = filteredAppointments.filter(
        appointment => appointment.staffId === staffId
      );
    }

    if (location) {
      filteredAppointments = filteredAppointments.filter(
        appointment => appointment.location === location
      );
    }

    if (date) {
      const targetDate = parseISO(date);
      filteredAppointments = filteredAppointments.filter(appointment => {
        const appointmentDate = parseISO(appointment.date);
        return (
          appointmentDate.getFullYear() === targetDate.getFullYear() &&
          appointmentDate.getMonth() === targetDate.getMonth() &&
          appointmentDate.getDate() === targetDate.getDate()
        );
      });
    }

    return NextResponse.json({ appointments: filteredAppointments });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json({ error: "Failed to fetch appointments" }, { status: 500 });
  }
}

// Book a new appointment
export async function POST(request: Request) {
  try {
    const data = await request.json();

    console.log("📅 Client Portal: Booking appointment for client:", {
      clientId: data.clientId,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      service: data.service,
      isGuestCheckout: data.isGuestCheckout
    });

    // Validate required fields
    if (!data.clientId || !data.staffId || !data.service || !data.date || !data.duration || !data.location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate appointment date is in the future
    const appointmentDate = parseISO(data.date);
    if (isBefore(appointmentDate, new Date())) {
      return NextResponse.json({ error: "Appointment date must be in the future" }, { status: 400 });
    }

    // Check for scheduling conflicts
    const appointmentEnd = addMinutes(appointmentDate, data.duration);
    const conflictingAppointments = appointments.filter(appointment => {
      // Only check appointments for the same staff and location
      if (appointment.staffId !== data.staffId || appointment.location !== data.location) {
        return false;
      }

      // IMPORTANT: Skip completed appointments - they don't block staff availability
      if (appointment.status === "completed") {
        return false;
      }

      // IMPORTANT: Skip cancelled and no-show appointments - they don't block staff availability
      if (appointment.status === "cancelled" || appointment.status === "no-show") {
        return false;
      }

      const existingStart = parseISO(appointment.date);
      const existingEnd = addMinutes(existingStart, appointment.duration);

      // Check if the new appointment overlaps with an existing one
      return (
        (isAfter(appointmentDate, existingStart) && isBefore(appointmentDate, existingEnd)) ||
        (isAfter(appointmentEnd, existingStart) && isBefore(appointmentEnd, existingEnd)) ||
        (isBefore(appointmentDate, existingStart) && isAfter(appointmentEnd, existingEnd)) ||
        (appointmentDate.getTime() === existingStart.getTime())
      );
    });

    if (conflictingAppointments.length > 0) {
      return NextResponse.json({
        error: "This time slot is already booked",
        conflicts: conflictingAppointments
      }, { status: 409 });
    }

    // Generate a simple booking reference number
    const generateBookingReference = () => {
      // Format: VH-XXXXXX where XXXXXX is a 6-digit number based on timestamp
      return `VH-${Date.now().toString().slice(-6)}`;
    };

    // Create the new appointment with all required properties for calendar view
    const newAppointment = {
      id: `a${Date.now()}`,
      bookingReference: generateBookingReference(), // Add booking reference number
      clientId: data.clientId,
      clientName: data.clientName,
      staffId: data.staffId,
      staffName: data.staffName,
      service: data.service,
      serviceId: data.serviceId,
      date: data.date,
      duration: data.duration,
      location: data.location,
      price: data.price,
      notes: data.notes,
      status: data.status || "pending",
      statusHistory: data.statusHistory || [
        {
          status: "pending",
          timestamp: new Date().toISOString(),
          updatedBy: "Client Portal"
        }
      ],
      type: data.type || "appointment",
      additionalServices: data.additionalServices || [],
      products: data.products || [],
      // Mark this appointment as coming from client portal
      source: 'client_portal',
      bookedVia: 'client_portal',
      metadata: {
        source: 'client_portal',
        bookedVia: 'client_portal',
        isClientPortalBooking: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save appointment to Prisma database
    try {
      console.log("💾 Saving appointment to Prisma database...");

      // Create appointment in Prisma
      const prismaAppointment = await prisma.appointment.create({
        data: {
          bookingReference: newAppointment.bookingReference,
          clientId: data.clientId,
          staffId: data.staffId,
          locationId: data.location, // location is the locationId
          date: new Date(data.date),
          duration: data.duration,
          totalPrice: data.price || 0,
          status: data.status || "PENDING",
          notes: data.notes,
          services: {
            create: data.serviceId ? [{
              serviceId: data.serviceId,
              price: data.price || 0,
              duration: data.duration
            }] : []
          }
        },
        include: {
          client: true,
          staff: true,
          location: true,
          services: {
            include: {
              service: true
            }
          }
        }
      });

      console.log("✅ Appointment saved to Prisma:", prismaAppointment.id);

      // Also add to in-memory arrays for backward compatibility
      appointments.push(newAppointment);

      try {
        addAppointment(newAppointment);
        console.log("✅ Appointment added to appointment service");
      } catch (error) {
        console.error("⚠️ Error adding to appointment service:", error);
      }

      return NextResponse.json({
        success: true,
        appointment: {
          ...newAppointment,
          id: prismaAppointment.id,
          prismaId: prismaAppointment.id
        }
      });
    } catch (error) {
      console.error("❌ Error saving appointment to Prisma:", error);

      // Fallback to in-memory storage if Prisma fails
      appointments.push(newAppointment);

      try {
        addAppointment(newAppointment);
      } catch (serviceError) {
        console.error("Error in appointment service:", serviceError);
      }

      return NextResponse.json({
        success: true,
        appointment: newAppointment,
        warning: "Appointment saved to memory only, not persisted to database"
      });
    }
  } catch (error) {
    console.error("Error booking appointment:", error);
    return NextResponse.json({ error: "Failed to book appointment" }, { status: 500 });
  }
}
