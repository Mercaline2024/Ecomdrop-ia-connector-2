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
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId es requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Obtener variantes del producto usando GraphQL
    const query = `
      query getProductVariants($id: ID!) {
        product(id: $id) {
          id
          title
          variants(first: 250) {
            edges {
              node {
                id
                title
                price
                sku
                barcode
                inventoryQuantity
                availableForSale
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    `;

    const response = await admin.graphql(query, {
      variables: { id: productId }
    });

    const data = await response.json();

    if (data.data?.product?.variants) {
      const variants = data.data.product.variants.edges.map((edge: any) => edge.node);
      return new Response(JSON.stringify({ 
        success: true,
        product: {
          id: data.data.product.id,
          title: data.data.product.title,
        },
        variants 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      success: false,
      error: "Producto no encontrado o sin variantes"
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error fetching product variants:", error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

