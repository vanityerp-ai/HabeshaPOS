import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
 * POST /api/migrate-data
 * 
 * Migrate localStorage data to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffData } = body;

    if (!staffData || !Array.isArray(staffData)) {
      return NextResponse.json(
        { error: 'Invalid staff data provided' },
        { status: 400 }
      );
    }

    const migratedStaff = [];
    const errors = [];

    for (const staff of staffData) {
      try {
        // Check if user with this email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: staff.email }
        });

        if (existingUser) {
          console.log(`User with email ${staff.email} already exists in database, skipping...`);
          continue;
        }

        // Also check if staff already exists by name (in case of email duplicates in localStorage)
        const existingStaffByName = await prisma.staffMember.findFirst({
          where: {
            name: staff.name,
            user: {
              email: staff.email
            }
          }
        });

        if (existingStaffByName) {
          console.log(`Staff member ${staff.name} (${staff.email}) already exists in database, skipping...`);
          continue;
        }

        // Create user first
        const userRole = mapStaffRoleToUserRole(staff.role);

        // Handle potential duplicate emails by making them unique
        let emailToUse = staff.email;
        let emailCounter = 1;

        // Keep trying until we find a unique email
        while (true) {
          const emailExists = await prisma.user.findUnique({
            where: { email: emailToUse }
          });

          if (!emailExists) {
            break; // Email is unique, we can use it
          }

          // Email exists, try with a counter
          const emailParts = staff.email.split('@');
          emailToUse = `${emailParts[0]}_${emailCounter}@${emailParts[1]}`;
          emailCounter++;

          // Safety check to prevent infinite loop
          if (emailCounter > 100) {
            throw new Error(`Could not generate unique email for ${staff.name}`);
          }
        }

        const user = await prisma.user.create({
          data: {
            email: emailToUse,
            password: 'temp123', // Temporary password - should be changed on first login
            role: userRole,
            isActive: staff.status === 'Active'
          }
        });

        // Create staff member
        const newStaff = await prisma.staffMember.create({
          data: {
            userId: user.id,
            name: staff.name,
            phone: staff.phone || null,
            avatar: staff.avatar || staff.name.split(' ').map(n => n[0]).join(''),
            color: staff.color || 'bg-purple-100 text-purple-800',
            jobRole: staff.role, // Store the original specific job role
            homeService: staff.homeService || false,
            status: staff.status === 'Active' ? 'ACTIVE' : staff.status === 'Inactive' ? 'INACTIVE' : 'ON_LEAVE'
          }
        });

        // Add location associations if provided
        if (staff.locations && staff.locations.length > 0) {
          // First, check if locations exist in the database
          const existingLocations = await prisma.location.findMany({
            where: {
              id: {
                in: staff.locations
              }
            }
          });

          // Create location associations for existing locations
          for (const location of existingLocations) {
            await prisma.staffLocation.create({
              data: {
                staffId: newStaff.id,
                locationId: location.id
              }
            });
          }
        }

        migratedStaff.push({
          id: newStaff.id,
          name: newStaff.name,
          email: user.email,
          originalEmail: staff.email,
          originalId: staff.id,
          emailChanged: user.email !== staff.email
        });

      } catch (staffError) {
        console.error(`Error migrating staff ${staff.name}:`, staffError);
        errors.push({
          staff: staff.name,
          error: staffError instanceof Error ? staffError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      migratedCount: migratedStaff.length,
      migratedStaff,
      errors,
      message: `Successfully migrated ${migratedStaff.length} staff members to database`
    });

  } catch (error) {
    console.error('Error during data migration:', error);
    return NextResponse.json(
      { 
        error: 'Failed to migrate data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/migrate-data
 * 
 * Check migration status
 */
export async function GET() {
  try {
    // Count staff in database
    const staffCount = await prisma.staffMember.count();
    const userCount = await prisma.user.count();
    
    return NextResponse.json({
      databaseStaffCount: staffCount,
      databaseUserCount: userCount,
      migrationNeeded: staffCount === 0
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json(
      { error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
