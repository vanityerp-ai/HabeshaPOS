import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findSamrawit() {
  try {
    console.log('Searching for staff named "Samrawit"...');
    const staff = await prisma.staffMember.findMany({
      where: {
        name: {
          contains: 'Samrawit',
          mode: 'insensitive'
        }
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

    if (staff.length > 0) {
      console.log(`Found ${staff.length} staff member(s):`);
      staff.forEach(s => {
        console.log('--------------------------------');
        console.log(`Name: ${s.name}`);
        console.log(`ID: ${s.id}`);
        console.log(`Job Role: ${s.jobRole}`);
        console.log(`User ID: ${s.userId}`);
        if (s.user) {
          console.log(`User Email: ${s.user.email}`);
          console.log(`User Role: ${s.user.role}`);
          console.log(`User Active: ${s.user.isActive}`);
        } else {
          console.log('No associated user account');
        }
        console.log('Locations:');
        s.locations.forEach(sl => {
          console.log(`  - ${sl.location.name} (Active: ${sl.isActive})`);
        });
      });
    } else {
      console.log('No staff found with name containing "Samrawit"');
    }

  } catch (error) {
    console.error('Error finding staff:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findSamrawit();