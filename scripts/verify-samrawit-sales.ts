import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifySamrawit() {
  try {
    console.log('🔍 Checking Samrawit\'s account...\n');

    // Find Samrawit by email
    const user = await prisma.user.findUnique({
      where: { email: 'samrawit@habeshasalon.com' },
      include: { 
        staffProfile: {
          include: {
            locations: {
              include: {
                location: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ Samrawit not found with email: samrawit@habeshasalon.com');
      return;
    }

    console.log('✅ Found Samrawit:');
    console.log('   User ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Active:', user.isActive);

    if (user.staffProfile) {
      console.log('\n   Staff Profile:');
      console.log('   Staff ID:', user.staffProfile.id);
      console.log('   Name:', user.staffProfile.name);
      console.log('   Job Role:', user.staffProfile.jobRole);
      console.log('   Status:', user.staffProfile.status);
      console.log('   Locations:', user.staffProfile.locations.map(l => l.location.name).join(', '));
    }

    // Check if role needs to be updated
    if (user.role !== 'SALES') {
      console.log('\n⚠️  User role is not SALES. Updating to SALES...');
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SALES' }
      });
      console.log('✅ Updated user role to SALES');
    } else {
      console.log('\n✅ User role is correctly set to SALES');
    }

    // Check staff profile
    if (user.staffProfile) {
      if (user.staffProfile.jobRole?.toLowerCase() !== 'sales') {
        console.log('\n⚠️  Staff job role is not "sales". Updating...');
        await prisma.staffMember.update({
          where: { id: user.staffProfile.id },
          data: { jobRole: 'sales' }
        });
        console.log('✅ Updated staff job role to "sales"');
      } else {
        console.log('✅ Staff job role is correctly set');
      }
    }

    console.log('\n📋 Summary:');
    console.log('Samrawit should now:');
    console.log('1. Log out completely');
    console.log('2. Clear browser cache (Ctrl+Shift+Delete) or run in console:');
    console.log('   localStorage.clear(); sessionStorage.clear(); location.reload();');
    console.log('3. Log back in');
    console.log('4. She will be redirected to POS page');
    console.log('5. Only POS and Inventory will be visible in navigation');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifySamrawit();
