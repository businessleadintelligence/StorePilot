import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";

import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="StorePilot">

      <s-section heading="AI COO Status">
        <s-paragraph>
          Store Health Score: --
        </s-paragraph>

        <s-paragraph>
          Revenue At Risk: --
        </s-paragraph>

        <s-paragraph>
          Revenue Opportunity: --
        </s-paragraph>

        <s-paragraph>
          Critical Issues: 0
        </s-paragraph>

        <s-paragraph>
          Warning Issues: 0
        </s-paragraph>
      </s-section>

      <s-section heading="Today's Executive Brief">
        <s-paragraph>
          Welcome to StorePilot.
        </s-paragraph>

        <s-paragraph>
          Your AI COO will summarize business performance,
          identify risks, and surface opportunities here.
        </s-paragraph>
      </s-section>

      <s-section heading="Priority Issues">
        <s-paragraph>
          No active issues detected.
        </s-paragraph>
      </s-section>

      <s-section heading="Revenue Opportunities">
        <s-paragraph>
          Revenue opportunities will appear here after analysis.
        </s-paragraph>
      </s-section>

      <s-section heading="AI COO Chat">
        <s-paragraph>
          AI COO Chat coming soon.
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="StorePilot">
        <s-paragraph>
          Operational Intelligence Platform
        </s-paragraph>

        <s-paragraph>
          Shopify Connected
        </s-paragraph>

        <s-paragraph>
          Dashboard Shell v1
        </s-paragraph>
      </s-section>

    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};