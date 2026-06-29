import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS = [
  {
    name: "Starter",
    slug: "starter",
    monthlyPrice: 49,
    annualPrice: 490,
    maxProducts: 1000,
    maxOrders: 5000,
    maxTeamMembers: 2,
    aiCreditsPerMonth: 100,
    active: true,
  },
  {
    name: "Growth",
    slug: "growth",
    monthlyPrice: 99,
    annualPrice: 990,
    maxProducts: 10000,
    maxOrders: 50000,
    maxTeamMembers: 10,
    aiCreditsPerMonth: 500,
    active: true,
  },
  {
    name: "Agency",
    slug: "agency",
    monthlyPrice: 199,
    annualPrice: 1990,
    maxProducts: 100000,
    maxOrders: 500000,
    maxTeamMembers: 50,
    aiCreditsPerMonth: 2000,
    active: true,
  },
] as const;

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: {
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        annualPrice: plan.annualPrice,
        maxProducts: plan.maxProducts,
        maxOrders: plan.maxOrders,
        maxTeamMembers: plan.maxTeamMembers,
        aiCreditsPerMonth: plan.aiCreditsPerMonth,
        active: plan.active,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
