import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth-utils';

const prisma = new PrismaClient();

async function fixBothBetis() {
  try {
    console.log('🔍 Setting up both Beti staff members...\n');

    // Find locations
    const medinatKhalifa = await prisma.location.findFirst({
      where: { name: { contains: 'Medinat Khalifa', mode: 'insensitive' } }
    });

    const muaither = await prisma.location.findFirst({
      where: { name: { contains: 'Muaither', mode: 'insensitive' } }
    });

    if (!medinatKhalifa || !muaither) {
      console.log('❌ Required locations not found');
      return;
    }

    console.log('✅ Found locations:', { medinatKhalifa: medinatKhalifa.name, muaither: muaither.name });

    // === Beti Thomas (9117) - Muaither ===
    console.log('\n📋 Processing Beti Thomas (9117) - Muaither...');
    
    let betiThomasUser = await prisma.user.findUnique({
      where: { email: 'beti@habeshasalon.com' },
      include: { staffProfile: true }
    });

    if (betiThomasUser) {
      console.log('✅ User exists for beti@habeshasalon.com');
      
      if (betiThomasUser.staffProfile) {
        // Update existing staff profile
        console.log('📝 Updating Beti Thomas profile...');
        await prisma.staffMember.update({
          where: { id: betiThomasUser.staffProfile.id },
          data: {
            name: 'Beti Thomas',
            phone: '30732501',
            employeeNumber: '9117',
            jobRole: 'stylist',
            avatar: 'BT',
            dateOfBirth: new Date('1991-09-12'),
            homeService: true,
            qidNumber: '29123002832',
            passportNumber: 'EP6689476',
            qidValidity: '02-05-26',
            passportValidity: '13-9-26',
            medicalValidity: '01-01-26'
          }
        });

        // Update location
        await prisma.staffLocation.deleteMany({
          where: { staffId: betiThomasUser.staffProfile.id }
        });
        await prisma.staffLocation.create({
          data: {
            staffId: betiThomasUser.staffProfile.id,
            locationId: muaither.id
          }
        });
        console.log('✅ Updated Beti Thomas - assigned to Muaither');
      }
    }

    // === Beti-MK (9110) - Medinat Khalifa ===
    console.log('\n📋 Processing Beti-MK (9110) - Medinat Khalifa...');
    
    // Check if user exists with alternative email
    let betiMKUser = await prisma.user.findUnique({
      where: { email: 'betimk@habeshasalon.com' },
      include: { staffProfile: true }
    });

    if (!betiMKUser) {
      console.log('📝 Creating new user for Beti-MK with email: betimk@habeshasalon.com');
      const hashedPassword = hashPassword('temp123');
      betiMKUser = await prisma.user.create({
        data: {
          email: 'betimk@habeshasalon.com',
          password: hashedPassword,
          role: 'STAFF',
          isActive: true
        },
        include: { staffProfile: true }
      });
      console.log('✅ Created user for Beti-MK');
    }

    if (!betiMKUser.staffProfile) {
      console.log('📝 Creating staff profile for Beti-MK...');
      const staffProfile = await prisma.staffMember.create({
        data: {
          userId: betiMKUser.id,
          name: 'Beti-MK',
          phone: '66830977',
          employeeNumber: '9110',
          jobRole: 'stylist',
          avatar: 'BM',
          homeService: true,
          status: 'ACTIVE',
          medicalValidity: '01-01-26'
        }
      });

      // Assign to Medinat Khalifa
      await prisma.staffLocation.create({
        data: {
          staffId: staffProfile.id,
          locationId: medinatKhalifa.id
        }
      });
      console.log('✅ Created Beti-MK staff profile - assigned to Medinat Khalifa');
    } else {
      console.log('📝 Updating existing Beti-MK profile...');
      await prisma.staffMember.update({
        where: { id: betiMKUser.staffProfile.id },
        data: {
          name: 'Beti-MK',
          phone: '66830977',
          employeeNumber: '9110',
          jobRole: 'stylist',
          avatar: 'BM',
          homeService: true,
          medicalValidity: '01-01-26'
        }
      });

      // Update location
      await prisma.staffLocation.deleteMany({
        where: { staffId: betiMKUser.staffProfile.id }
      });
      await prisma.staffLocation.create({
        data: {
          staffId: betiMKUser.staffProfile.id,
          locationId: medinatKhalifa.id
        }
      });
      console.log('✅ Updated Beti-MK - assigned to Medinat Khalifa');
    }

    console.log('\n✅ Successfully configured both Beti staff members:');
    console.log('\n📋 Beti Thomas (9117):');
    console.log('   Email: beti@habeshasalon.com');
    console.log('   Phone: 30732501');
    console.log('   Location: Muaither');
    console.log('   Date of Birth: 12-09-91');
    console.log('   QID: 29123002832');
    console.log('   Passport: EP6689476');
    
    console.log('\n📋 Beti-MK (9110):');
    console.log('   Email: betimk@habeshasalon.com');
    console.log('   Phone: 66830977');
    console.log('   Location: Medinat Khalifa');
    console.log('   Medical Validity: 01-01-26');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixBothBetis();
