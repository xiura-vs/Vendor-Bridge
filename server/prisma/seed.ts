// =============================================================================
// seed.ts
// Populates VendorBridge with a realistic baseline dataset for development
// and hackathon demonstration. All passwords hashed with bcrypt (10 rounds).
// Run via: npx ts-node prisma/seed.ts
// =============================================================================

import { PrismaClient, Role, VendorStatus, RFQStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function main() {
  console.log('🌱 Starting VendorBridge seed...');

  // ---------------------------------------------------------------------------
  // Clean existing data (in FK-safe order)
  // ---------------------------------------------------------------------------
  await prisma.activityLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.rfqVendor.deleteMany();
  await prisma.rfqItem.deleteMany();
  await prisma.rfq.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleared existing data');

  // ---------------------------------------------------------------------------
  // 1. Admin User
  // ---------------------------------------------------------------------------
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@vendorbridge.com',
      password_hash: await hashPassword('Admin@1234'),
      full_name: 'System Administrator',
      role: Role.ADMIN,
      is_active: true,
    },
  });
  console.log(`✅ Created Admin: ${adminUser.email}`);

  // ---------------------------------------------------------------------------
  // 2. Manager User
  // ---------------------------------------------------------------------------
  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@vendorbridge.com',
      password_hash: await hashPassword('Manager@1234'),
      full_name: 'Rajesh Sharma',
      role: Role.MANAGER,
      is_active: true,
    },
  });
  console.log(`✅ Created Manager: ${managerUser.email}`);

  // ---------------------------------------------------------------------------
  // 3. Procurement Officer
  // ---------------------------------------------------------------------------
  const officerUser = await prisma.user.create({
    data: {
      email: 'officer@vendorbridge.com',
      password_hash: await hashPassword('Officer@1234'),
      full_name: 'Priya Mehta',
      role: Role.PROCUREMENT_OFFICER,
      is_active: true,
    },
  });
  console.log(`✅ Created Procurement Officer: ${officerUser.email}`);

  // ---------------------------------------------------------------------------
  // 4. Vendor Users + Vendor Records
  // ---------------------------------------------------------------------------
  const vendorUser1 = await prisma.user.create({
    data: {
      email: 'techsupplies@vendor.com',
      password_hash: await hashPassword('Vendor@1234'),
      full_name: 'Amit Patel',
      role: Role.VENDOR,
      is_active: true,
    },
  });

  const vendor1 = await prisma.vendor.create({
    data: {
      name: 'TechSupplies Pvt. Ltd.',
      category: 'IT Hardware',
      gst_number: '27AABCT1332L1ZY',
      pan_number: 'AABCT1332L',
      contact_email: 'techsupplies@vendor.com',
      contact_phone: '+91-9876543210',
      address: '14, MIDC Industrial Area, Pune, Maharashtra - 411019',
      status: VendorStatus.ACTIVE,
      user_id: vendorUser1.id,
    },
  });
  console.log(`✅ Created Vendor 1: ${vendor1.name}`);

  const vendorUser2 = await prisma.user.create({
    data: {
      email: 'officemart@vendor.com',
      password_hash: await hashPassword('Vendor@5678'),
      full_name: 'Sneha Joshi',
      role: Role.VENDOR,
      is_active: true,
    },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      name: 'OfficeMart Solutions',
      category: 'Office Supplies',
      gst_number: '29AACCO1122M1ZX',
      pan_number: 'AACCO1122M',
      contact_email: 'officemart@vendor.com',
      contact_phone: '+91-9123456789',
      address: '7, Koramangala 5th Block, Bengaluru, Karnataka - 560095',
      status: VendorStatus.ACTIVE,
      user_id: vendorUser2.id,
    },
  });
  console.log(`✅ Created Vendor 2: ${vendor2.name}`);

  // ---------------------------------------------------------------------------
  // 5. Sample RFQ with 2 Line Items
  // ---------------------------------------------------------------------------
  const rfq = await prisma.rfq.create({
    data: {
      rfq_number: 'RFQ-2024-0001',
      title: 'Q4 Office IT Equipment Procurement',
      description:
        'Procurement of laptops and ergonomic accessories for the engineering department expansion.',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      status: RFQStatus.PUBLISHED,
      created_by: officerUser.id,
      items: {
        create: [
          {
            product_name: 'Business Laptop',
            description: 'Intel Core i7, 16GB RAM, 512GB SSD, Windows 11 Pro',
            quantity: 10,
            unit: 'pcs',
            specifications:
              'Screen: 15.6" FHD | Battery: 8hr+ | Ports: USB-C, HDMI, USB-A x3',
          },
          {
            product_name: 'Ergonomic Office Chair',
            description: 'Adjustable lumbar support, mesh back, armrests',
            quantity: 10,
            unit: 'pcs',
            specifications:
              'Weight Capacity: 120kg | Seat Height: 42-52cm | Color: Black',
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`✅ Created RFQ: ${rfq.rfq_number} with ${rfq.items.length} items`);

  // ---------------------------------------------------------------------------
  // 6. Invite Both Vendors to the RFQ
  // ---------------------------------------------------------------------------
  await prisma.rfqVendor.createMany({
    data: [
      {
        rfq_id: rfq.id,
        vendor_id: vendor1.id,
        invited_at: new Date(),
        responded: false,
      },
      {
        rfq_id: rfq.id,
        vendor_id: vendor2.id,
        invited_at: new Date(),
        responded: false,
      },
    ],
  });
  console.log(`✅ Invited both vendors to ${rfq.rfq_number}`);

  // ---------------------------------------------------------------------------
  // 7. Seed Activity Log
  // ---------------------------------------------------------------------------
  await prisma.activityLog.createMany({
    data: [
      {
        user_id: officerUser.id,
        action: 'RFQ_PUBLISHED',
        entity_type: 'Rfq',
        entity_id: rfq.id,
        metadata: { rfq_number: rfq.rfq_number, title: rfq.title },
      },
      {
        user_id: officerUser.id,
        action: 'VENDOR_INVITED',
        entity_type: 'RfqVendor',
        entity_id: rfq.id,
        metadata: {
          rfq_number: rfq.rfq_number,
          vendors: [vendor1.name, vendor2.name],
        },
      },
    ],
  });
  console.log('✅ Seeded activity logs');

  console.log('\n🎉 VendorBridge seed completed successfully!\n');
  console.log('─────────────────────────────────────────');
  console.log('LOGIN CREDENTIALS (for testing):');
  console.log('  Admin      → admin@vendorbridge.com    / Admin@1234');
  console.log('  Manager    → manager@vendorbridge.com  / Manager@1234');
  console.log('  Officer    → officer@vendorbridge.com  / Officer@1234');
  console.log('  Vendor 1   → techsupplies@vendor.com  / Vendor@1234');
  console.log('  Vendor 2   → officemart@vendor.com    / Vendor@5678');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });