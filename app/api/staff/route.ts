import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromHeaders, filterStaffByLocationAccess } from '@/lib/auth-server';

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

// Map UserRole back to frontend role format (preserve original staff roles)
function mapUserRoleToStaffRole(userRole: string, originalRole?: string): string {
  // If we have the original role stored somewhere, use it
  if (originalRole) {
    return originalRole.toLowerCase();
  }

  // Otherwise, map based on UserRole
  switch (userRole) {
    case 'ADMIN':
      return 'super_admin';
    case 'MANAGER':
      return 'location_manager';
    case 'STAFF':
      return 'stylist'; // Default staff role
    case 'CLIENT':
      return 'client';
    default:
      return 'stylist';
  }
}

/**
 * GET /api/staff
 *
 * Fetch all staff members from database
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get('locationId');

    // Try to get staff from database first
    let allStaff;
    try {
      const dbStaff = await prisma.staffMember.findMany({
        include: {
          user: true,
          locations: {
            include: {
              location: true
            }
          },
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log(`GET /api/staff - Found ${dbStaff.length} staff members in database`);

      if (dbStaff.length > 0) {
        console.log('Sample staff IDs:', dbStaff.slice(0, 3).map(s => `${s.name}: ${s.id}`));

        // Transform database data to match frontend interface
        allStaff = dbStaff.map(staff => ({
          id: staff.id,
          name: staff.name,
          email: staff.user.email,
          phone: staff.phone || '',
          role: staff.jobRole || mapUserRoleToStaffRole(staff.user.role), // Use jobRole if available, otherwise map from UserRole
          locations: staff.locations.map(loc => loc.locationId),
          status: staff.status === 'ACTIVE' ? 'Active' : staff.status === 'INACTIVE' ? 'Inactive' : 'On Leave',
          avatar: staff.avatar || staff.name.split(' ').map(n => n[0]).join(''),
          color: staff.color || 'bg-purple-100 text-purple-800',
          homeService: staff.homeService,
          specialties: staff.specialties ? (() => {
            try {
              return JSON.parse(staff.specialties);
            } catch (e) {
              console.warn('Failed to parse specialties JSON:', staff.specialties);
              return [];
            }
          })() : [],
          // HR Document Management Fields from database
          employeeNumber: staff.employeeNumber || '',
          dateOfBirth: staff.dateOfBirth ? (() => {
            // Handle both Date objects and string formats
            if (typeof staff.dateOfBirth === 'string') {
              // If already in DD-MM-YY format, return as is
              if (/^\d{2}-\d{2}-\d{2}$/.test(staff.dateOfBirth)) {
                return staff.dateOfBirth
              }
              // If in other string format, try to parse and convert
              return staff.dateOfBirth
            } else {
              // Handle Date object
              const date = staff.dateOfBirth.toISOString().split('T')[0] // YYYY-MM-DD
              const [year, month, day] = date.split('-')
              const shortYear = year.slice(-2) // Get last 2 digits for YY format
              return `${day}-${month}-${shortYear}` // Convert to DD-MM-YY for frontend
            }
          })() : '',
          qidNumber: staff.qidNumber || '',
          passportNumber: staff.passportNumber || '',
          qidValidity: staff.qidValidity || '',
          passportValidity: staff.passportValidity || '',
          medicalValidity: staff.medicalValidity || '',
          profileImage: staff.profileImage || staff.avatar || '',
          profileImageType: staff.profileImageType || ''
        }));
      } else {
        console.log('No staff found in database');
        allStaff = [];
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw dbError; // Don't fallback - database is single source of truth
    }

    // Get user information for access control
    const currentUser = getUserFromHeaders(request);

    // Filter by location if provided
    let filteredStaff = allStaff;
    if (locationId) {
      if (locationId === 'home') {
        // Only admin users can access home service staff
        if (currentUser?.role !== 'ADMIN') {
          filteredStaff = [];
        } else {
          filteredStaff = allStaff.filter(s => s.homeService === true || s.locations.includes('home'));
        }
      } else {
        filteredStaff = allStaff.filter(s => s.locations.includes(locationId));
      }
    }

    // Apply user-based access control
    if (currentUser && currentUser.role !== 'ADMIN') {
      // Filter out home service staff for non-admin users
      filteredStaff = filteredStaff.filter(s => {
        // Remove staff that only have home service or are assigned to home location
        return !(s.homeService === true || s.locations.includes('home'));
      });

      // Apply location-based filtering using existing function
      filteredStaff = filterStaffByLocationAccess(filteredStaff, currentUser.locations || []);
    }

    // Return the staff data
    return NextResponse.json(
      { staff: filteredStaff },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        }
      }
    );
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json(
      { error: 'Failed to fetch staff data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staff
 *
 * Create a new staff member
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, role, locations, status, homeService, employeeNumber, dateOfBirth, qidNumber, passportNumber, qidValidity, passportValidity, medicalValidity, profileImage, profileImageType } = body;

    console.log('POST /api/staff - Creating staff member:', { name, email, role });

    // Validate required fields
    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, and role are required' },
        { status: 400 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Try to create in database first
    try {
      // Create user first with enhanced password security
      const { mapStaffRoleToUserRole, hashPassword } = await import('@/lib/auth-utils');
      const userRole = mapStaffRoleToUserRole(role);
      const hashedPassword = hashPassword('temp123'); // Temporary password - should be changed on first login

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: userRole,
          isActive: status === 'Active'
        }
      });

      // Create staff member
      const staff = await prisma.staffMember.create({
        data: {
          userId: user.id,
          name,
          phone,
          avatar: name.split(' ').map(n => n[0]).join(''),
          color: 'bg-purple-100 text-purple-800',
          jobRole: role, // Store the specific job role
          dateOfBirth: dateOfBirth ? (() => {
            try {
              const date = new Date(dateOfBirth);
              return isNaN(date.getTime()) ? null : date;
            } catch (e) {
              console.warn('Invalid dateOfBirth:', dateOfBirth);
              return null;
            }
          })() : null,
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
          profileImageType
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

      // Add location associations - if none provided, assign to all active locations
      let locationIds = locations
      if (!locationIds || locationIds.length === 0) {
        console.log("📍 No locations specified for staff, assigning to all active locations...")
        const allLocations = await prisma.location.findMany({
          where: { isActive: true },
          select: { id: true }
        })
        locationIds = allLocations.map(loc => loc.id)
        console.log(`📍 Found ${locationIds.length} active locations to assign`)
      }

      if (locationIds && locationIds.length > 0) {
        await Promise.all(
          locationIds.map(locationId =>
            prisma.staffLocation.create({
              data: {
                staffId: staff.id,
                locationId
              }
            })
          )
        );
      }

      // Transform response to match frontend interface
      const transformedStaff = {
        id: staff.id,
        name: staff.name,
        email: staff.user.email,
        phone: staff.phone || '',
        role: staff.jobRole || role, // Use the stored jobRole
        locations: locationIds || [],
        status: staff.status === 'ACTIVE' ? 'Active' : staff.status === 'INACTIVE' ? 'Inactive' : 'On Leave',
        avatar: staff.avatar || staff.name.split(' ').map(n => n[0]).join(''),
        color: staff.color || 'bg-purple-100 text-purple-800',
        homeService: staff.homeService,
        specialties: staff.specialties ? (() => {
          try {
            return JSON.parse(staff.specialties);
          } catch (e) {
            console.warn('Failed to parse specialties JSON:', staff.specialties);
            return [];
          }
        })() : [],
        employeeNumber: employeeNumber || '',
        dateOfBirth: staff.dateOfBirth ? (() => {
          // Handle both Date objects and string formats
          if (typeof staff.dateOfBirth === 'string') {
            // If already in DD-MM-YY format, return as is
            if (/^\d{2}-\d{2}-\d{2}$/.test(staff.dateOfBirth)) {
              return staff.dateOfBirth
            }
            // If in other string format, try to parse and convert
            return staff.dateOfBirth
          } else {
            // Handle Date object
            const date = staff.dateOfBirth.toISOString().split('T')[0] // YYYY-MM-DD
            const [year, month, day] = date.split('-')
            const shortYear = year.slice(-2) // Get last 2 digits for YY format
            return `${day}-${month}-${shortYear}` // Convert to DD-MM-YY for frontend
          }
        })() : '',
        qidValidity: qidValidity || '',
        passportValidity: passportValidity || '',
        medicalValidity: medicalValidity || '',
        profileImage: profileImage || '',
        profileImageType: profileImageType || ''
      };

      return NextResponse.json({ staff: transformedStaff }, { status: 201 });
    } catch (dbError) {
      console.error('Database error creating staff:', dbError);
      throw dbError; // Don't fallback - database is single source of truth
    }
  } catch (error) {
    console.error('Error creating staff:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to create staff member',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
