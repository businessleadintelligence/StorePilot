import prisma from "../../../db.server";

export async function getHistoricalMemory(storeId: string) {
  return prisma.historicalMemory.findUnique({ where: { storeId } });
}

export async function getHistoricalSnapshots(storeId: string, take = 10) {
  return prisma.historicalSnapshot.findMany({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
    take,
  });
}

export async function getPatternSeeds(storeId: string, activeOnly = true) {
  return prisma.patternSeed.findMany({
    where: { storeId, active: activeOnly ? true : undefined },
    orderBy: { confidence: "desc" },
  });
}

export async function getConfidenceSeeds(storeId: string) {
  return prisma.confidenceSeed.findMany({
    where: { storeId },
    orderBy: { domain: "asc" },
  });
}

export async function getMerchantBaselines(storeId: string) {
  return prisma.merchantBaseline.findMany({
    where: { storeId },
    orderBy: { baselineType: "asc" },
  });
}

export async function getBusinessDnaVersions(storeId: string, take = 5) {
  return prisma.businessDnaVersion.findMany({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
    take,
  });
}

export async function getLatestBusinessDna(storeId: string) {
  return prisma.businessDnaVersion.findFirst({
    where: { storeId },
    orderBy: { versionNumber: "desc" },
  });
}
