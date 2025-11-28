import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateBeti() {
  try {
    console.log('🔍 Finding Beti...');
    
    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: 'beti@habeshasalon.com' },
      include: { staffProfile: true }
    });

    if (!user || !user.staffProfile) {
      console.log('❌ Beti not found');
      return;
    }

    console.log('✅ Found Beti:', {
      userId: user.id,
      staffId: user.staffProfile.id,
      currentName: user.staffProfile.name,
      currentPhone: user.staffProfile.phone,
      currentEmployeeNumber: user.staffProfile.employeeNumber
    });

    // Update staff profile with correct information
    console.log('\n📝 Updating staff profile...');
    const updatedStaff = await prisma.staffMember.update({
      where: { id: user.staffProfile.id },
      data: {
        name: 'Bethlehem',
        phone: '66830977',
        employeeNumber: '9110',
        jobRole: 'stylist',
        avatar: 'BM'
      }
    });

    console.log('✅ Updated staff profile:', {
      name: updatedStaff.name,
      phone: updatedStaff.phone,
      employeeNumber: updatedStaff.employeeNumber,
      jobRole: updatedStaff.jobRole
    });

    // Find Medinat Khalifa location
    console.log('\n📍 Finding Medinat Khalifa location...');
    const medinatKhalifa = await prisma.location.findFirst({
      where: { name: { contains: 'Medinat Khalifa', mode: 'insensitive' } }
    });

    if (!medinatKhalifa) {
      console.log('❌ Medinat Khalifa location not found');
      console.log('Available locations:');
      const allLocations = await prisma.location.findMany({
        where: { isActive: true },
        select: { id: true, name: true }
      });
      console.table(allLocations);
      return;
    }

    console.log('✅ Found Medinat Khalifa:', medinatKhalifa.name);

    // Remove existing location assignments
    console.log('\n🗑️  Removing old location assignments...');
    await prisma.staffLocation.deleteMany({
      where: { staffId: user.staffProfile.id }
    });
    console.log('✅ Removed old locations');

    // Assign to Medinat Khalifa
    console.log('\n📍 Assigning to Medinat Khalifa...');
    await prisma.staffLocation.create({
      data: {
        staffId: user.staffProfile.id,
        locationId: medinatKhalifa.id
      }
    });

    console.log('✅ Successfully updated Beti-Mk (Bethlehem)');
    console.log('\n📋 Final Information:');
    console.log('Employee Number: 9110');
    console.log('Name: Bethlehem');
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

updateBeti();
