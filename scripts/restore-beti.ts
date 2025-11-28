import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth-utils';

const prisma = new PrismaClient();

async function restoreBeti() {
  try {
    console.log('🔍 Checking if Beti exists...');
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'beti@habeshasalon.com' },
      include: { staffProfile: true }
    });

    if (existingUser) {
      console.log('✅ User exists:', {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        hasStaffProfile: !!existingUser.staffProfile
      });

      if (existingUser.staffProfile) {
        console.log('✅ Staff profile exists:', {
          id: existingUser.staffProfile.id,
          name: existingUser.staffProfile.name,
          status: existingUser.staffProfile.status
        });

        // Check locations
        const staffLocations = await prisma.staffLocation.findMany({
          where: { staffId: existingUser.staffProfile.id },
          include: { location: true }
        });

        console.log('📍 Staff locations:', staffLocations.map(sl => sl.location.name));

        if (staffLocations.length === 0) {
          console.log('⚠️  Staff has no location assignments. Adding Medinat Khalifa...');
          
          // Find Medinat Khalifa location
          const medinatKhalifa = await prisma.location.findFirst({
            where: { name: { contains: 'Medinat Khalifa', mode: 'insensitive' } }
          });

          if (medinatKhalifa) {
            await prisma.staffLocation.create({
              data: {
                staffId: existingUser.staffProfile.id,
                locationId: medinatKhalifa.id
              }
            });
            console.log('✅ Added Medinat Khalifa location');
          } else {
            console.log('❌ Medinat Khalifa location not found');
          }
        }

        return;
      } else {
        console.log('⚠️  User exists but has no staff profile. Creating staff profile...');
      }
    } else {
      console.log('❌ User does not exist. Creating new user and staff profile...');
    }

    // Create or restore user and staff profile
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user
      const hashedPassword = hashPassword('temp123');
      const newUser = await prisma.user.create({
        data: {
          email: 'beti@habeshasalon.com',
          password: hashedPassword,
          role: 'STAFF',
          isActive: true
        }
      });
      userId = newUser.id;
      console.log('✅ Created user:', userId);
    }

    // Create staff profile
    const staffProfile = await prisma.staffMember.create({
      data: {
        userId: userId,
        name: 'Bethlehem',
        phone: '66830977',
        avatar: 'BM',
        color: 'bg-purple-100 text-purple-800',
        jobRole: 'stylist',
        employeeNumber: '9110',
        status: 'ACTIVE',
        homeService: false
      }
    });

    console.log('✅ Created staff profile:', staffProfile.id);

    // Assign to Medinat Khalifa location
    const medinatKhalifa = await prisma.location.findFirst({
      where: { name: { contains: 'Medinat Khalifa', mode: 'insensitive' } }
    });

    if (medinatKhalifa) {
      await prisma.staffLocation.create({
        data: {
          staffId: staffProfile.id,
          locationId: medinatKhalifa.id
        }
      });
      console.log('✅ Assigned to Medinat Khalifa location');
    } else {
      console.log('⚠️  Could not find Medinat Khalifa location. Please assign manually.');
      
      // Show all locations
      const allLocations = await prisma.location.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      });
      console.log('Available locations:', allLocations);
    }

    console.log('\n✅ Successfully restored Beti-Mk (Bethlehem)');
    console.log('Employee Number: 9110');
    console.log('Email: beti@habeshasalon.com');
    console.log('Phone: 66830977');
    console.log('Role: Stylist');
    console.log('Location: Medinat Khalifa');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restoreBeti();
