import { PrismaClient } from '@prisma/client'
import Database from 'better-sqlite3'
import * as path from 'path'

// SQLite source database
const sqliteDb = new Database(path.join(__dirname, '../prisma/prisma/dev.db'), { 
  readonly: true 
})

// PostgreSQL target database
const postgresPrisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: ['error', 'warn'],
})

// Helper function to convert SQLite boolean (0/1) to PostgreSQL boolean
function toBool(value: number | null): boolean | null {
  if (value === null) return null
  return value === 1
}

// Helper function to parse JSON strings
function parseJSON(value: string | null): any {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

async function migrateData() {
  console.log('🚀 Starting data migration from SQLite to PostgreSQL...\n')

  try {
    // Connect to PostgreSQL
    await postgresPrisma.$connect()
    console.log('✅ Connected to PostgreSQL\n')

    // Get table counts from SQLite
    console.log('📊 Current SQLite data:')
    const tables = [
      'users', 'staff_members', 'staff_schedules', 'clients', 'locations',
      'staff_locations', 'services', 'staff_services', 'location_services',
      'appointments', 'appointment_services', 'appointment_products',
      'products', 'product_locations', 'product_batches', 'transfers', 'inventory_audits',
      'transactions', 'loyalty_programs', 'gift_cards', 'gift_card_transactions',
      'membership_tiers', 'memberships', 'membership_transactions', 'audit_logs'
    ]

    const counts: Record<string, number> = {}
    for (const table of tables) {
      try {
        const result = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        counts[table] = result.count
        if (result.count > 0) {
          console.log(`  - ${table}: ${result.count} records`)
        }
      } catch (error) {
        console.log(`  - ${table}: Table not found or empty`)
        counts[table] = 0
      }
    }
    console.log()

    // Migrate Users
    if (counts.users > 0) {
      console.log('👤 Migrating users...')
      const users = sqliteDb.prepare('SELECT * FROM users').all()
      for (const user of users) {
        await postgresPrisma.user.create({
          data: {
            id: user.id,
            email: user.email,
            password: user.password,
            role: user.role,
            isActive: toBool(user.isActive) ?? true,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt),
            lastLogin: user.lastLogin ? new Date(user.lastLogin) : null,
          },
        })
      }
      console.log(`  ✅ Migrated ${users.length} users\n`)
    }

    // Migrate Locations (needed before staff_locations and others)
    if (counts.locations > 0) {
      console.log('📍 Migrating locations...')
      const locations = sqliteDb.prepare('SELECT * FROM locations').all()
      for (const location of locations) {
        await postgresPrisma.location.create({
          data: {
            id: location.id,
            name: location.name,
            address: location.address,
            city: location.city,
            state: location.state,
            zipCode: location.zipCode,
            country: location.country,
            phone: location.phone,
            email: location.email,
            isActive: toBool(location.isActive) ?? true,
            coordinates: location.coordinates,
            createdAt: new Date(location.createdAt),
            updatedAt: new Date(location.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${locations.length} locations\n`)
    }

    // Migrate Staff Members
    if (counts.staff_members > 0) {
      console.log('👨‍💼 Migrating staff members...')
      const staffMembers = sqliteDb.prepare('SELECT * FROM staff_members').all()
      for (const staff of staffMembers) {
        await postgresPrisma.staffMember.create({
          data: {
            id: staff.id,
            userId: staff.userId,
            name: staff.name,
            phone: staff.phone,
            avatar: staff.avatar,
            color: staff.color,
            jobRole: staff.jobRole,
            dateOfBirth: staff.dateOfBirth ? new Date(staff.dateOfBirth) : null,
            homeService: toBool(staff.homeService) ?? false,
            status: staff.status,
            employeeNumber: staff.employeeNumber,
            qidNumber: staff.qidNumber,
            passportNumber: staff.passportNumber,
            qidValidity: staff.qidValidity,
            passportValidity: staff.passportValidity,
            medicalValidity: staff.medicalValidity,
            profileImage: staff.profileImage,
            profileImageType: staff.profileImageType,
            specialties: staff.specialties,
            createdAt: new Date(staff.createdAt),
            updatedAt: new Date(staff.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${staffMembers.length} staff members\n`)
    }

    // Migrate Staff Schedules
    if (counts.staff_schedules > 0) {
      console.log('📅 Migrating staff schedules...')
      const schedules = sqliteDb.prepare('SELECT * FROM staff_schedules').all()
      for (const schedule of schedules) {
        await postgresPrisma.staffSchedule.create({
          data: {
            id: schedule.id,
            staffId: schedule.staffId,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            isActive: toBool(schedule.isActive) ?? true,
            createdAt: new Date(schedule.createdAt),
            updatedAt: new Date(schedule.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${schedules.length} schedules\n`)
    }

    // Migrate Clients
    if (counts.clients > 0) {
      console.log('👥 Migrating clients...')
      const clients = sqliteDb.prepare('SELECT * FROM clients').all()
      for (const client of clients) {
        await postgresPrisma.client.create({
          data: {
            id: client.id,
            userId: client.userId,
            name: client.name,
            phone: client.phone,
            email: client.email,
            address: client.address,
            city: client.city,
            state: client.state,
            zipCode: client.zipCode,
            dateOfBirth: client.dateOfBirth ? new Date(client.dateOfBirth) : null,
            preferences: client.preferences,
            notes: client.notes,
            preferredLocationId: client.preferredLocationId,
            registrationSource: client.registrationSource,
            isAutoRegistered: toBool(client.isAutoRegistered) ?? false,
            createdAt: new Date(client.createdAt),
            updatedAt: new Date(client.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${clients.length} clients\n`)
    }

    // Migrate Staff Locations
    if (counts.staff_locations > 0) {
      console.log('🔗 Migrating staff locations...')
      const staffLocations = sqliteDb.prepare('SELECT * FROM staff_locations').all()
      for (const sl of staffLocations) {
        await postgresPrisma.staffLocation.create({
          data: {
            id: sl.id,
            staffId: sl.staffId,
            locationId: sl.locationId,
            isActive: toBool(sl.isActive) ?? true,
            createdAt: new Date(sl.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${staffLocations.length} staff locations\n`)
    }

    // Migrate Services
    if (counts.services > 0) {
      console.log('💇 Migrating services...')
      const services = sqliteDb.prepare('SELECT * FROM services').all()
      for (const service of services) {
        await postgresPrisma.service.create({
          data: {
            id: service.id,
            name: service.name,
            description: service.description,
            duration: service.duration,
            price: service.price,
            category: service.category,
            showPricesToClients: toBool(service.showPricesToClients) ?? true,
            isActive: toBool(service.isActive) ?? true,
            createdAt: new Date(service.createdAt),
            updatedAt: new Date(service.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${services.length} services\n`)
    }

    // Migrate Staff Services
    if (counts.staff_services > 0) {
      console.log('🔗 Migrating staff services...')
      const staffServices = sqliteDb.prepare('SELECT * FROM staff_services').all()
      for (const ss of staffServices) {
        await postgresPrisma.staffService.create({
          data: {
            id: ss.id,
            staffId: ss.staffId,
            serviceId: ss.serviceId,
            isActive: toBool(ss.isActive) ?? true,
            createdAt: new Date(ss.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${staffServices.length} staff services\n`)
    }

    // Migrate Location Services
    if (counts.location_services > 0) {
      console.log('🔗 Migrating location services...')
      const locationServices = sqliteDb.prepare('SELECT * FROM location_services').all()
      for (const ls of locationServices) {
        await postgresPrisma.locationService.create({
          data: {
            id: ls.id,
            locationId: ls.locationId,
            serviceId: ls.serviceId,
            price: ls.price,
            isActive: toBool(ls.isActive) ?? true,
            createdAt: new Date(ls.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${locationServices.length} location services\n`)
    }

    // Migrate Products
    if (counts.products > 0) {
      console.log('📦 Migrating products...')
      const products = sqliteDb.prepare('SELECT * FROM products').all()
      for (const product of products) {
        await postgresPrisma.product.create({
          data: {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            cost: product.cost,
            category: product.category,
            type: product.type,
            brand: product.brand,
            sku: product.sku,
            barcode: product.barcode,
            image: product.image,
            images: product.images,
            isRetail: toBool(product.isRetail) ?? false,
            isActive: toBool(product.isActive) ?? true,
            isFeatured: toBool(product.isFeatured) ?? false,
            isNew: toBool(product.isNew) ?? false,
            isBestSeller: toBool(product.isBestSeller) ?? false,
            isSale: toBool(product.isSale) ?? false,
            salePrice: product.salePrice,
            rating: product.rating ?? 0,
            reviewCount: product.reviewCount ?? 0,
            features: product.features,
            ingredients: product.ingredients,
            howToUse: product.howToUse,
            createdAt: new Date(product.createdAt),
            updatedAt: new Date(product.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${products.length} products\n`)
    }

    // Migrate Product Locations
    if (counts.product_locations > 0) {
      console.log('🔗 Migrating product locations...')
      const productLocations = sqliteDb.prepare('SELECT * FROM product_locations').all()
      for (const pl of productLocations) {
        await postgresPrisma.productLocation.create({
          data: {
            id: pl.id,
            productId: pl.productId,
            locationId: pl.locationId,
            stock: pl.stock,
            price: pl.price,
            isActive: toBool(pl.isActive) ?? true,
            createdAt: new Date(pl.createdAt),
            updatedAt: new Date(pl.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${productLocations.length} product locations\n`)
    }

    // Migrate Product Batches
    if (counts.product_batches > 0) {
      console.log('📦 Migrating product batches...')
      const batches = sqliteDb.prepare('SELECT * FROM product_batches').all()
      for (const batch of batches) {
        await postgresPrisma.productBatch.create({
          data: {
            id: batch.id,
            productId: batch.productId,
            locationId: batch.locationId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : null,
            quantity: batch.quantity,
            costPrice: batch.costPrice,
            supplierInfo: batch.supplierInfo,
            notes: batch.notes,
            isActive: toBool(batch.isActive) ?? true,
            createdAt: new Date(batch.createdAt),
            updatedAt: new Date(batch.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${batches.length} product batches\n`)
    }

    // Migrate Appointments
    if (counts.appointments > 0) {
      console.log('📅 Migrating appointments...')
      const appointments = sqliteDb.prepare('SELECT * FROM appointments').all()
      for (const apt of appointments) {
        await postgresPrisma.appointment.create({
          data: {
            id: apt.id,
            bookingReference: apt.bookingReference,
            clientId: apt.clientId,
            staffId: apt.staffId,
            locationId: apt.locationId,
            date: new Date(apt.date),
            duration: apt.duration,
            totalPrice: apt.totalPrice,
            status: apt.status,
            notes: apt.notes,
            createdAt: new Date(apt.createdAt),
            updatedAt: new Date(apt.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${appointments.length} appointments\n`)
    }

    // Migrate Appointment Services
    if (counts.appointment_services > 0) {
      console.log('🔗 Migrating appointment services...')
      const aptServices = sqliteDb.prepare('SELECT * FROM appointment_services').all()
      for (const as of aptServices) {
        await postgresPrisma.appointmentService.create({
          data: {
            id: as.id,
            appointmentId: as.appointmentId,
            serviceId: as.serviceId,
            price: as.price,
            duration: as.duration,
            createdAt: new Date(as.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${aptServices.length} appointment services\n`)
    }

    // Migrate Appointment Products
    if (counts.appointment_products > 0) {
      console.log('🔗 Migrating appointment products...')
      const aptProducts = sqliteDb.prepare('SELECT * FROM appointment_products').all()
      for (const ap of aptProducts) {
        await postgresPrisma.appointmentProduct.create({
          data: {
            id: ap.id,
            appointmentId: ap.appointmentId,
            productId: ap.productId,
            quantity: ap.quantity,
            price: ap.price,
            createdAt: new Date(ap.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${aptProducts.length} appointment products\n`)
    }

    // Migrate Transactions
    if (counts.transactions > 0) {
      console.log('💰 Migrating transactions...')
      const transactions = sqliteDb.prepare('SELECT * FROM transactions').all()
      for (const txn of transactions) {
        await postgresPrisma.transaction.create({
          data: {
            id: txn.id,
            userId: txn.userId,
            amount: txn.amount,
            type: txn.type,
            status: txn.status,
            method: txn.method,
            reference: txn.reference,
            description: txn.description,
            locationId: txn.locationId,
            appointmentId: txn.appointmentId,
            serviceAmount: txn.serviceAmount,
            productAmount: txn.productAmount,
            originalServiceAmount: txn.originalServiceAmount,
            discountPercentage: txn.discountPercentage,
            discountAmount: txn.discountAmount,
            items: txn.items,
            createdAt: new Date(txn.createdAt),
            updatedAt: new Date(txn.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${transactions.length} transactions\n`)
    }

    // Migrate Transfers
    if (counts.transfers > 0) {
      console.log('🔄 Migrating transfers...')
      const transfers = sqliteDb.prepare('SELECT * FROM transfers').all()
      for (const transfer of transfers) {
        await postgresPrisma.transfer.create({
          data: {
            id: transfer.id,
            transferId: transfer.transferId,
            productId: transfer.productId,
            productName: transfer.productName,
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            quantity: transfer.quantity,
            status: transfer.status,
            reason: transfer.reason,
            notes: transfer.notes,
            createdBy: transfer.createdBy,
            createdAt: new Date(transfer.createdAt),
            completedAt: transfer.completedAt ? new Date(transfer.completedAt) : null,
          },
        })
      }
      console.log(`  ✅ Migrated ${transfers.length} transfers\n`)
    }

    // Migrate Inventory Audits
    if (counts.inventory_audits > 0) {
      console.log('📋 Migrating inventory audits...')
      const audits = sqliteDb.prepare('SELECT * FROM inventory_audits').all()
      for (const audit of audits) {
        await postgresPrisma.inventoryAudit.create({
          data: {
            id: audit.id,
            productId: audit.productId,
            locationId: audit.locationId,
            adjustmentType: audit.adjustmentType,
            quantity: audit.quantity,
            previousStock: audit.previousStock,
            newStock: audit.newStock,
            reason: audit.reason,
            notes: audit.notes,
            userId: audit.userId,
            timestamp: new Date(audit.timestamp),
            createdAt: new Date(audit.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${audits.length} inventory audits\n`)
    }

    // Migrate Loyalty Programs
    if (counts.loyalty_programs > 0) {
      console.log('🎁 Migrating loyalty programs...')
      const loyaltyPrograms = sqliteDb.prepare('SELECT * FROM loyalty_programs').all()
      for (const lp of loyaltyPrograms) {
        await postgresPrisma.loyaltyProgram.create({
          data: {
            id: lp.id,
            clientId: lp.clientId,
            points: lp.points,
            tier: lp.tier,
            totalSpent: lp.totalSpent,
            joinDate: new Date(lp.joinDate),
            lastActivity: new Date(lp.lastActivity),
            isActive: toBool(lp.isActive) ?? true,
            createdAt: new Date(lp.createdAt),
            updatedAt: new Date(lp.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${loyaltyPrograms.length} loyalty programs\n`)
    }

    // Migrate Gift Cards
    if (counts.gift_cards > 0) {
      console.log('🎁 Migrating gift cards...')
      const giftCards = sqliteDb.prepare('SELECT * FROM gift_cards').all()
      for (const gc of giftCards) {
        await postgresPrisma.giftCard.create({
          data: {
            id: gc.id,
            code: gc.code,
            type: gc.type,
            originalAmount: gc.originalAmount,
            currentBalance: gc.currentBalance,
            status: gc.status,
            issuedDate: new Date(gc.issuedDate),
            expirationDate: gc.expirationDate ? new Date(gc.expirationDate) : null,
            issuedBy: gc.issuedBy,
            issuedByName: gc.issuedByName,
            issuedTo: gc.issuedTo,
            issuedToName: gc.issuedToName,
            purchaserEmail: gc.purchaserEmail,
            purchaserPhone: gc.purchaserPhone,
            message: gc.message,
            location: gc.location,
            transactionId: gc.transactionId,
            createdAt: new Date(gc.createdAt),
            updatedAt: new Date(gc.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${giftCards.length} gift cards\n`)
    }

    // Migrate Gift Card Transactions
    if (counts.gift_card_transactions > 0) {
      console.log('💳 Migrating gift card transactions...')
      const gcTransactions = sqliteDb.prepare('SELECT * FROM gift_card_transactions').all()
      for (const gct of gcTransactions) {
        await postgresPrisma.giftCardTransaction.create({
          data: {
            id: gct.id,
            giftCardId: gct.giftCardId,
            type: gct.type,
            amount: gct.amount,
            balanceBefore: gct.balanceBefore,
            balanceAfter: gct.balanceAfter,
            description: gct.description,
            transactionId: gct.transactionId,
            createdAt: new Date(gct.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${gcTransactions.length} gift card transactions\n`)
    }

    // Migrate Membership Tiers
    if (counts.membership_tiers > 0) {
      console.log('🏆 Migrating membership tiers...')
      const membershipTiers = sqliteDb.prepare('SELECT * FROM membership_tiers').all()
      for (const mt of membershipTiers) {
        await postgresPrisma.membershipTier.create({
          data: {
            id: mt.id,
            name: mt.name,
            description: mt.description,
            price: mt.price,
            duration: mt.duration,
            benefits: mt.benefits,
            discountPercentage: mt.discountPercentage,
            maxDiscountAmount: mt.maxDiscountAmount,
            includedServices: mt.includedServices,
            priorityBooking: toBool(mt.priorityBooking) ?? false,
            freeServices: mt.freeServices,
            isActive: toBool(mt.isActive) ?? true,
            sortOrder: mt.sortOrder,
            createdAt: new Date(mt.createdAt),
            updatedAt: new Date(mt.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${membershipTiers.length} membership tiers\n`)
    }

    // Migrate Memberships
    if (counts.memberships > 0) {
      console.log('💎 Migrating memberships...')
      const memberships = sqliteDb.prepare('SELECT * FROM memberships').all()
      for (const m of memberships) {
        await postgresPrisma.membership.create({
          data: {
            id: m.id,
            clientId: m.clientId,
            clientName: m.clientName,
            tierId: m.tierId,
            tierName: m.tierName,
            status: m.status,
            startDate: new Date(m.startDate),
            endDate: new Date(m.endDate),
            autoRenew: toBool(m.autoRenew) ?? true,
            price: m.price,
            discountPercentage: m.discountPercentage,
            usedFreeServices: m.usedFreeServices,
            totalFreeServices: m.totalFreeServices,
            location: m.location,
            createdAt: new Date(m.createdAt),
            updatedAt: new Date(m.updatedAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${memberships.length} memberships\n`)
    }

    // Migrate Membership Transactions
    if (counts.membership_transactions > 0) {
      console.log('💳 Migrating membership transactions...')
      const membershipTransactions = sqliteDb.prepare('SELECT * FROM membership_transactions').all()
      for (const mtx of membershipTransactions) {
        await postgresPrisma.membershipTransaction.create({
          data: {
            id: mtx.id,
            membershipId: mtx.membershipId,
            type: mtx.type,
            amount: mtx.amount,
            description: mtx.description,
            serviceId: mtx.serviceId,
            serviceName: mtx.serviceName,
            createdAt: new Date(mtx.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${membershipTransactions.length} membership transactions\n`)
    }

    // Migrate Audit Logs
    if (counts.audit_logs > 0) {
      console.log('📝 Migrating audit logs...')
      const auditLogs = sqliteDb.prepare('SELECT * FROM audit_logs').all()
      for (const log of auditLogs) {
        await postgresPrisma.auditLog.create({
          data: {
            id: log.id,
            action: log.action,
            userId: log.userId,
            userEmail: log.userEmail,
            userRole: log.userRole,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            details: log.details,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            location: log.location,
            severity: log.severity,
            metadata: log.metadata,
            createdAt: new Date(log.createdAt),
          },
        })
      }
      console.log(`  ✅ Migrated ${auditLogs.length} audit logs\n`)
    }

    console.log('✅ Migration completed successfully!\n')

    // Verify counts in PostgreSQL
    console.log('📊 Verifying PostgreSQL data:')
    for (const table of tables) {
      if (counts[table] > 0) {
        let pgCount = 0
        try {
          switch (table) {
            case 'users':
              pgCount = await postgresPrisma.user.count()
              break
            case 'staff_members':
              pgCount = await postgresPrisma.staffMember.count()
              break
            case 'clients':
              pgCount = await postgresPrisma.client.count()
              break
            case 'locations':
              pgCount = await postgresPrisma.location.count()
              break
            case 'services':
              pgCount = await postgresPrisma.service.count()
              break
            case 'products':
              pgCount = await postgresPrisma.product.count()
              break
            case 'appointments':
              pgCount = await postgresPrisma.appointment.count()
              break
            case 'transactions':
              pgCount = await postgresPrisma.transaction.count()
              break
            // Add more as needed
          }
          
          const match = pgCount === counts[table] ? '✅' : '❌'
          console.log(`  ${match} ${table}: ${pgCount} / ${counts[table]}`)
        } catch (error) {
          console.log(`  ⚠️ ${table}: Could not verify`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    sqliteDb.close()
    await postgresPrisma.$disconnect()
  }
}

// Run migration
migrateData()
  .then(() => {
    console.log('\n🎉 All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  })
