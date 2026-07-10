import type { ExecutiveBriefingPayload } from "../../executive/shared/types";

type ExecutiveBriefingCardProps = {
  briefing: ExecutiveBriefingPayload;
};

export function ExecutiveBriefingCard({ briefing }: ExecutiveBriefingCardProps) {
  return (
    <s-section heading="Executive briefing">
      <s-box
        padding="base"
        background="base"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-stack gap="small-200">
            <s-text type="strong">{briefing.greeting}</s-text>
            <s-text>{briefing.headline}</s-text>
          </s-stack>

          <s-stack gap="small-200">
            {briefing.sections.map((section) => (
              <s-box
                key={section.key}
                padding="small-200"
                background="subdued"
                borderRadius="base"
              >
                <s-stack gap="small-100">
                  <s-text type="strong">{section.title}</s-text>
                  <s-text color="subdued">{section.content}</s-text>
                </s-stack>
              </s-box>
            ))}
          </s-stack>

          <s-stack gap="small-200">
            <s-text type="strong">Today&apos;s focus</s-text>
            {briefing.todaysFocus.map((item) => (
              <s-text key={item}>• {item}</s-text>
            ))}
          </s-stack>

          <s-text color="subdued">Outlook: {briefing.businessOutlook}</s-text>
        </s-stack>
      </s-box>
    </s-section>
  );
}
