import type { ExecutiveBrief } from "../types/store-dashboard";

type ExecutiveBriefCardProps = {
  brief: ExecutiveBrief;
};

export function ExecutiveBriefCard({ brief }: ExecutiveBriefCardProps) {
  return (
    <s-section heading="Executive Brief">
      <s-box
        padding="base"
        background="subdued"
        borderWidth="small"
        borderColor="base"
        borderRadius="base"
      >
        <s-stack gap="base">
          <s-stack gap="small-200">
            <s-text type="strong">{brief.headline}</s-text>
            <s-paragraph>{brief.summary}</s-paragraph>
          </s-stack>

          {brief.highlights.length > 0 ? (
            <s-stack gap="small-200">
              <s-text type="strong">Highlights</s-text>
              <s-unordered-list>
                {brief.highlights.map((highlight) => (
                  <s-list-item key={highlight}>{highlight}</s-list-item>
                ))}
              </s-unordered-list>
            </s-stack>
          ) : null}

          {brief.concerns.length > 0 ? (
            <s-stack gap="small-200">
              <s-text type="strong">Concerns</s-text>
              <s-unordered-list>
                {brief.concerns.map((concern) => (
                  <s-list-item key={concern}>{concern}</s-list-item>
                ))}
              </s-unordered-list>
            </s-stack>
          ) : null}
        </s-stack>
      </s-box>
    </s-section>
  );
}
