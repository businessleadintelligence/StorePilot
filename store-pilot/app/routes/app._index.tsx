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
  return ( <s-page heading="StorePilot">
  
  ```
    <s-section heading="AI COO For Shopify Stores">
      <s-paragraph>
        Stop checking dashboards.
      </s-paragraph>
  
      <s-paragraph>
        StorePilot monitors your store and tells you what is wrong,
        why it happened, and what to do next.
      </s-paragraph>
    </s-section>
  
    <s-section heading="Monitoring Status">
      <s-stack direction="block" gap="base">
        <s-paragraph>✅ Shopify Connected</s-paragraph>
        <s-paragraph>✅ Data Collection Active</s-paragraph>
        <s-paragraph>✅ AI Analysis Ready</s-paragraph>
      </s-stack>
    </s-section>
  
    <s-section heading="Store Health">
      <s-stack direction="block" gap="base">
        <s-paragraph>Revenue Health: Healthy</s-paragraph>
        <s-paragraph>Conversion Health: Healthy</s-paragraph>
        <s-paragraph>Traffic Health: Healthy</s-paragraph>
        <s-paragraph>Inventory Health: Healthy</s-paragraph>
        <s-paragraph>Refund Health: Healthy</s-paragraph>
      </s-stack>
    </s-section>
  
    <s-section slot="aside" heading="StorePilot">
      <s-paragraph>
        Version 0.1
      </s-paragraph>
  
      <s-paragraph>
        Shopify Connection Active
      </s-paragraph>
  
      <s-paragraph>
        AI COO Engine Coming Soon
      </s-paragraph>
    </s-section>
  
  </s-page>
  ```
  
  );
  }
  
  export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
  };
  