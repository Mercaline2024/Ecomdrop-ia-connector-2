import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Esta ruta servirá para hacer polling manual de órdenes
// Puedes llamarla desde el frontend con un intervalo o usar un cron job

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Query para obtener órdenes recientes (últimas 10)
    const response = await admin.graphql(
      `#graphql
        query GetRecentOrders {
          orders(first: 10, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                displayFulfillmentStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      variant {
                        id
                        title
                        sku
                      }
                      product {
                        id
                        title
                      }
                    }
                  }
                }
                shippingAddress {
                  firstName
                  lastName
                  address1
                  city
                  province
                  country
                  zip
                  phone
                }
                customer {
                  id
                  email
                  firstName
                  lastName
                  phone
                }
                tags
                note
              }
            }
          }
        }
      `
    );

    const responseJson = await response.json();
    const orders = responseJson.data?.orders?.edges || [];

    console.log(`📦 Found ${orders.length} recent orders`);

    // Procesar cada orden
    const processedOrders = orders.map((edge: any) => {
      const order = edge.node;
      return {
        id: order.id,
        name: order.name,
        createdAt: order.createdAt,
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        totalPrice: order.totalPriceSet.shopMoney.amount,
        currency: order.totalPriceSet.shopMoney.currencyCode,
        lineItems: order.lineItems.edges.map((itemEdge: any) => ({
          id: itemEdge.node.id,
          name: itemEdge.node.name,
          quantity: itemEdge.node.quantity,
          variant: itemEdge.node.variant?.title,
          sku: itemEdge.node.variant?.sku,
          productId: itemEdge.node.product?.id,
        })),
        shippingAddress: order.shippingAddress,
        customer: order.customer,
        tags: order.tags,
        note: order.note,
      };
    });

    return {
      success: true,
      orders: processedOrders,
      count: processedOrders.length,
    };

  } catch (error) {
    console.error(`❌ Error fetching orders:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      orders: [],
      count: 0,
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Similar logic for POST requests
  return loader({ request } as LoaderFunctionArgs);
};

