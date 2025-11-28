import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOnlineStoreUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'store@habeshasalon.com' },
      include: {
        staffProfile: {
          include: {
            locations: true,
          },
        },
      },
    });

    if (user) {
      console.log('User found:');
      console.log('ID:', user.id);
      console.log('Email:', user.email);
      console.log('Role:', user.role);
      console.log('Is Active:', user.isActive);
      console.log('Created At:', user.createdAt);
      console.log('Updated At:', user.updatedAt);

      if (user.staffProfile) {
        console.log('\nStaff Profile Details:');
        console.log('Staff ID:', user.staffProfile.id);
        console.log('Name:', user.staffProfile.name);
        console.log('Job Role:', user.staffProfile.jobRole);
        console.log('Locations:');
        user.staffProfile.locations.forEach(loc => {
          console.log(`- ${loc.name} (ID: ${loc.id})`);
        });
      } else {
        console.log('\nNo associated staff profile.');
      }
    } else {
      console.log('No user found with email store@habeshasalon.com');
    }
  } catch (error) {
    console.error('Error checking user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOnlineStoreUser();