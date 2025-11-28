import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateStaffServices } from '@/lib/services/staff';

/**
 * GET /api/staff/[id]
 *
 * Get a single staff member by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`GET /api/staff/${id} - Fetching staff member`);

    // Find the staff member with user data
    const staff = await prisma.staffMember.findUnique({
      where: { id },
      include: {
        user: true,
        locations: {
          include: {
            location: true
          }
        }
      }
    });

    if (!staff) {
      console.log(`Staff member with ID ${id} not found in database`);
      return NextResponse.json(
        { error: 'Staff member not found' },
        { status: 404 }
      );
    }

    console.log(`Found staff member: ${staff.name} (userId: ${staff.userId})`);

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff member:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff member' },
      { status: 500 }
    );
  }
}

// Map staff roles to UserRole enum values
function mapStaffRoleToUserRole(staffRole: string): string {
  const roleMapping: { [key: string]: string } = {
    // Admin roles
    'super_admin': 'ADMIN',
    'org_admin': 'ADMIN',

    // Manager roles
    'location_manager': 'MANAGER',
    'manager': 'MANAGER',

    // Staff roles (all salon workers)
    'stylist': 'STAFF',
    'colorist': 'STAFF',
    'barber': 'STAFF',
    'nail_technician': 'STAFF',
    'esthetician': 'STAFF',
    'receptionist': 'STAFF',
    'sales': 'SALES',
    'staff': 'STAFF',

    // Client role
    'client': 'CLIENT'
  };

  const normalizedRole = staffRole.toLowerCase().trim();
  if (normalizedRole.includes("sales")) {
    return 'SALES';
  }
  return roleMapping[normalizedRole] || 'STAFF'; // Default to STAFF if role not found
}

/**
 * PUT /api/staff/[id]
 * 
 * Update an existing staff member
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, role, locations, status, homeService, employeeNumber, dateOfBirth, qidNumber, passportNumber, qidValidity, passportValidity, medicalValidity, profileImage, profileImageType, specialties } = body;

    console.log(`PUT /api/staff/${id} - Attempting to update staff member`);
    console.log('Request body:', { name, email, role, status });

    // Try to update in database first
    try {
      // Find the staff member
      const existingStaff = await prisma.staffMember.findUnique({
        where: { id },
        include: { user: true }
      });

      console.log('Found existing staff:', existingStaff ? `${existingStaff.name} (${existingStaff.id})` : 'null');

      if (!existingStaff) {
        console.log(`Staff member with ID ${id} not found in database`);
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }

      // Update user
      const userRole = mapStaffRoleToUserRole(role);
      await prisma.user.update({
        where: { id: existingStaff.userId },
        data: {
          email,
          role: userRole,
          isActive: status === 'Active'
        }
      });

      // Update staff member
      const updatedStaff = await prisma.staffMember.update({
        where: { id },
        data: {
          name,
          phone,
          avatar: name.split(' ').map(n => n[0]).join(''),
          jobRole: role, // Update the specific job role
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          homeService: homeService || false,
          status: status === 'Active' ? 'ACTIVE' : status === 'Inactive' ? 'INACTIVE' : 'ON_LEAVE',
          // HR Document Management Fields
          employeeNumber,
          qidNumber,
          passportNumber,
          qidValidity,
          passportValidity,
          medicalValidity,
          profileImage,
          profileImageType,
          // Manual specialties as JSON string
          specialties: specialties ? JSON.stringify(specialties) : null
        },
        include: {
          user: true,
          locations: {
            include: {
              location: true
            }
          }
        }
      });

      // Update location associations
      if (locations) {
        // Remove existing associations
        await prisma.staffLocation.deleteMany({
          where: { staffId: id }
        });

        // Add new associations
        if (locations.length > 0) {
          await Promise.all(
            locations.map(locationId =>
              prisma.staffLocation.create({
                data: {
                  staffId: id,
                  locationId
                }
              })
            )
          );
        }
      }

      // Fetch the updated staff with location data
      const updatedStaffWithLocations = await prisma.staffMember.findUnique({
        where: { id },
        include: {
          user: true,
          locations: {
            include: {
              location: true
            }
          }
        }
      });

      if (!updatedStaffWithLocations) {
        throw new Error("Failed to fetch updated staff data");
      }

      // Transform response to match frontend interface
      const transformedStaff = {
        id: updatedStaffWithLocations.id,
        name: updatedStaffWithLocations.name,
        email: updatedStaffWithLocations.user.email,
        phone: updatedStaffWithLocations.phone || '',
        role: updatedStaffWithLocations.jobRole || role, // Use the stored jobRole
        locations: updatedStaffWithLocations.locations.map(loc => loc.locationId), // Get actual location IDs from database
        status: updatedStaffWithLocations.status === 'ACTIVE' ? 'Active' : updatedStaffWithLocations.status === 'INACTIVE' ? 'Inactive' : 'On Leave',
        avatar: updatedStaffWithLocations.avatar || updatedStaffWithLocations.name.split(' ').map(n => n[0]).join(''),
        color: updatedStaffWithLocations.color || 'bg-purple-100 text-purple-800',
        homeService: updatedStaffWithLocations.homeService,
        specialties: updatedStaffWithLocations.specialties ? (() => {
          try {
            return JSON.parse(updatedStaffWithLocations.specialties);
          } catch (e) {
            console.warn('Failed to parse specialties JSON:', updatedStaffWithLocations.specialties);
            return [];
          }
        })() : [],
        employeeNumber: employeeNumber || '',
        dateOfBirth: updatedStaffWithLocations.dateOfBirth ? (() => {
          const date = updatedStaffWithLocations.dateOfBirth.toISOString().split('T')[0] // YYYY-MM-DD
          const [year, month, day] = date.split('-')
          const shortYear = year.slice(-2) // Get last 2 digits for YY format
          return `${day}-${month}-${shortYear}` // Convert to DD-MM-YY for frontend
        })() : '',
        qidValidity: qidValidity || '',
        passportValidity: passportValidity || '',
        medicalValidity: medicalValidity || '',
        profileImage: profileImage || '',
        profileImageType: profileImageType || ''
      };

      return NextResponse.json({ staff: transformedStaff });
    } catch (dbError) {
      console.error('Database error updating staff member:', dbError);
      return NextResponse.json(
        { error: 'Failed to update staff member' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json(
      { error: 'Failed to update staff member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/staff/[id]
 *
 * Delete a staff member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`🔄 Attempting to delete staff member with ID: ${id}`);

    // Try to delete from database first
    try {
      // Find the staff member to get the user ID
      const existingStaff = await prisma.staffMember.findUnique({
        where: { id },
        include: { user: true }
      });

      if (!existingStaff) {
        console.log(`❌ Staff member not found: ${id}`);
        return NextResponse.json(
          { error: 'Staff member not found' },
          { status: 404 }
        );
      }

      // Check if staff has any appointments
      const appointmentCount = await prisma.appointment.count({
        where: { staffId: id }
      });

      if (appointmentCount > 0) {
        console.log(`❌ Cannot delete staff with ${appointmentCount} appointments`);
        return NextResponse.json(
          {
            error: `Cannot delete staff member with ${appointmentCount} appointments. Please reassign or cancel the appointments first.`
          },
          { status: 400 }
        );
      }

      console.log(`🔄 Deleting staff member: ${existingStaff.name}`);

      // Delete related records first (in correct order)
      // 1. Delete staff-service associations
      await prisma.staffService.deleteMany({
        where: { staffId: id }
      });
      console.log(`  ✅ Deleted staff-service associations`);

      // 2. Delete staff-location associations
      await prisma.staffLocation.deleteMany({
        where: { staffId: id }
      });
      console.log(`  ✅ Deleted staff-location associations`);

      // 3. Delete staff schedule
      await prisma.staffSchedule.deleteMany({
        where: { staffId: id }
      });
      console.log(`  ✅ Deleted staff schedule`);

      // 4. Delete staff member
      await prisma.staffMember.delete({
        where: { id }
      });
      console.log(`  ✅ Deleted staff member record`);

      // 5. Delete the associated user
      await prisma.user.delete({
        where: { id: existingStaff.userId }
      });
      console.log(`  ✅ Deleted user account`);

      console.log(`✅ Successfully deleted staff member: ${existingStaff.name}`);
      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('❌ Database error deleting staff member:', dbError);
      return NextResponse.json(
        {
          error: 'Failed to delete staff member',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ Error deleting staff:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete staff member',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
