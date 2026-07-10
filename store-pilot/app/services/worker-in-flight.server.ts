let inFlightJobId: string | null = null;

export function trackInFlightJob(jobId: string | null): void {
  inFlightJobId = jobId;
}

export function getInFlightJobId(): string | null {
  return inFlightJobId;
}

export function resetInFlightJobForTests(): void {
  inFlightJobId = null;
}
