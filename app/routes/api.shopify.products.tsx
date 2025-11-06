import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    return new Response(JSON.stringify({ error: "No shop session found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const response = await admin.graphql(
      `#graphql
        query getProducts {
          products(first: 250) {
            edges {
              node {
                id
                title
                handle
                status
                featuredImage {
                  url
                  altText
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                    }
                  }
                }
              }
            }
          }
        }
      `
    );
    
    const data = await response.json();
    const products = data.data?.products?.edges?.map((edge: any) => edge.node) || [];

    return new Response(JSON.stringify({ 
      success: true,
      products 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Error fetching Shopify products:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido",
      products: []
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

