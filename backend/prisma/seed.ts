import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.businessProfile.findFirst();
  if (existing) return;
  const business = await prisma.businessProfile.create({
    data: {
      name: "Nova Web Studio",
      ownerName: "Student Freelancer",
      email: "hello@example.com",
      phone: "+91 90000 00000",
      address: "Kolkata, West Bengal, India",
      pan: "ABCDE1234F",
      gstin: "19ABCDE1234F1Z5",
      state: "West Bengal",
      upiId: "novastudio@upi"
    }
  });
  await prisma.client.create({
    data: {
      businessId: business.id,
      name: "Demo Client",
      email: "client@example.com",
      phone: "+91 98888 88888",
      address: "Salt Lake, Kolkata",
      state: "West Bengal"
    }
  });
}
main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
