import { buildDbPlanSeedRecords } from "../app/billing/plan-registry";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = buildDbPlanSeedRecords();

  for (const plan of plans) {
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

  const scalePlan = await prisma.plan.findUnique({ where: { slug: "scale" } });
  if (scalePlan) {
    const legacyPlans = await prisma.plan.findMany({
      where: { slug: { in: ["pro", "agency"] } },
      select: { id: true },
    });

    for (const legacy of legacyPlans) {
      await prisma.subscription.updateMany({
        where: { planId: legacy.id },
        data: { planId: scalePlan.id },
      });
    }

    await prisma.plan.updateMany({
      where: { slug: { in: ["pro", "agency"] } },
      data: { active: false },
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
