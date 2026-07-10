import type { DecisionCardPayload } from "../../executive/shared/types";
import { DecisionCard } from "./DecisionCard";

type ExecutivePriorityListProps = {
  cards: DecisionCardPayload[];
  currency: string;
};

export function ExecutivePriorityList({ cards, currency }: ExecutivePriorityListProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <s-section heading="Executive priorities">
      <s-stack gap="small-200">
        {cards.slice(0, 6).map((card) => (
          <DecisionCard key={card.decisionId} card={card} currency={currency} />
        ))}
      </s-stack>
    </s-section>
  );
}
