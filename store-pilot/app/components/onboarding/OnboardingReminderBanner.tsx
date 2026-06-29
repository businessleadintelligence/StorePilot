import type { OnboardingReminder } from "../../onboarding/onboarding-types";

type OnboardingReminderBannerProps = {
  reminders: OnboardingReminder[];
  heading?: string;
};

export function OnboardingReminderBanner({
  reminders,
  heading = "Setup reminders",
}: OnboardingReminderBannerProps) {
  if (reminders.length === 0) {
    return null;
  }

  return (
    <s-section heading={heading}>
      <s-stack gap="small-200" aria-label="Connector setup reminders">
        {reminders.map((reminder) => (
          <s-box
            key={reminder.id}
            padding="base"
            background="subdued"
            borderRadius="base"
          >
            <s-stack direction="inline" gap="base" alignItems="center">
              <s-badge tone={reminder.severity === "warning" ? "warning" : undefined}>
                {reminder.severity}
              </s-badge>
              <s-text>{reminder.message}</s-text>
              <s-link href={reminder.href}>Resolve</s-link>
            </s-stack>
          </s-box>
        ))}
      </s-stack>
    </s-section>
  );
}
