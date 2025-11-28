import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// Mock staff data removed - using real staff data from FileStaffStorage instead

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
  return roleMapping[normalizedRole] || 'STAFF';
}

/**
 * POST /api/seed-staff
 * 
 * Seed the database with mock staff data as real data
 */
export async function POST() {
  try {
    // Mock staff data has been removed - all staff data is now real data
    return NextResponse.json({
      success: false,
      message: 'Staff seeding is no longer available. All staff data is now real data managed through the HR system.',
      seededCount: 0,
      seededStaff: [],
      errors: []
    });
  } catch (error) {
    console.error('Error seeding staff data:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed staff data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/seed-staff
 * 
 * Check if staff seeding is needed
 */
export async function GET() {
  try {
    const staffCount = await prisma.staffMember.count();
    const userCount = await prisma.user.count();

    return NextResponse.json({
      currentStaffCount: staffCount,
      currentUserCount: userCount,
      mockStaffCount: 0, // No mock staff data available
      seedingNeeded: false, // Seeding no longer needed
      seedingRecommended: false // Seeding no longer recommended
    });
  } catch (error) {
    console.error('Error checking staff seeding status:', error);
    return NextResponse.json(
      { error: 'Failed to check seeding status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/seed-staff
 * 
 * Clear all staff data (for testing purposes)
 */
export async function DELETE() {
  try {
    // Delete in correct order due to foreign key constraints
    await prisma.staffLocation.deleteMany();
    await prisma.staffMember.deleteMany();
    await prisma.user.deleteMany({
      where: {
        role: {
          in: ['STAFF', 'MANAGER']
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'All staff data cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing staff data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to clear staff data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
