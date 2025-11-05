import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { triggerEcomdropFlow } from "../lib/ecomdrop.api.server";

/**
 * Endpoint de prueba para simular webhook de DRAFT_ORDERS_CREATE (GraphQL)
 * Usa el shop correcto de la base de datos en lugar del genérico
 * 
 * POST /api/test-webhook/checkouts
 * 
 * Nota: Este endpoint simula DRAFT_ORDERS_CREATE que es el webhook moderno
 * para carritos abandonados según la API GraphQL de Shopify
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === "production") {
    return new Response("Not available in production", { status: 403 });
  }

  try {
    // Buscar la primera configuración disponible en la base de datos
    const configuration = await db.shopConfiguration.findFirst({
      where: {
        ecomdropApiKey: { not: null },
      },
    });

    if (!configuration) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No configuration found with API Key" 
        }),
        { 
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const shop = configuration.shop;
    console.log(`🧪 Test webhook: Using shop ${shop} from database`);

    // Verificar que tenga Flow ID configurado para carrito abandonado
    if (!configuration.carritoAbandonadoFlowId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No 'Carrito Abandonado' flow configured" 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Datos de draft order de prueba (formato GraphQL)
    // Simula un pedido preliminar que representa un carrito abandonado
    const testDraftOrder = {
      id: "gid://shopify/DraftOrder/9876543210",
      name: "#DRAFT-1001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalPrice: {
        amount: "79.99",
        currencyCode: "USD",
      },
      subtotalPrice: {
        amount: "69.99",
        currencyCode: "USD",
      },
      totalTax: {
        amount: "10.00",
        currencyCode: "USD",
      },
      currencyCode: "USD",
      lineItems: {
        edges: [
          {
            node: {
              id: "gid://shopify/DraftOrderLineItem/5555555555",
              title: "Test Product",
              name: "Test Product - Variant",
              quantity: 1,
              originalUnitPrice: {
                amount: "69.99",
                currencyCode: "USD",
              },
              variant: {
                id: "gid://shopify/ProductVariant/6666666666",
                sku: "TEST-SKU-456",
                title: "Default Title",
              },
              product: {
                id: "gid://shopify/Product/7777777777",
              },
              vendor: "Test Vendor",
              requiresShipping: true,
              taxable: true,
            },
          },
        ],
      },
      customer: {
        id: "gid://shopify/Customer/8888888888",
        email: "test@example.com",
        firstName: "Test",
        lastName: "Customer",
        phone: "+1234567890",
      },
      email: "test@example.com",
      shippingAddress: {
        firstName: "Test",
        lastName: "Customer",
        address1: "123 Test Street",
        address2: "",
        city: "Test City",
        province: "Test Province",
        country: "United States",
        zip: "12345",
        phone: "+1234567890",
        countryCode: "US",
        provinceCode: "TS",
      },
      billingAddress: {
        firstName: "Test",
        lastName: "Customer",
        address1: "123 Test Street",
        city: "Test City",
        province: "Test Province",
        country: "United States",
        zip: "12345",
        phone: "+1234567890",
      },
      note: "Test draft order from webhook endpoint (carrito abandonado)",
      tags: ["abandoned", "test"],
      status: "OPEN",
    };

    console.log(`📋 Processing test draft order ${testDraftOrder.name} for ${shop}`);

    // Estructurar datos del draft order para Ecomdrop (formato GraphQL)
    const draftOrderData = {
      draftOrderId: testDraftOrder.id,
      draftOrderName: testDraftOrder.name,
      createdAt: testDraftOrder.createdAt,
      updatedAt: testDraftOrder.updatedAt,
      totalPrice: testDraftOrder.totalPrice.amount,
      subtotalPrice: testDraftOrder.subtotalPrice.amount,
      totalTax: testDraftOrder.totalTax.amount,
      currencyCode: testDraftOrder.currencyCode,
      lineItems: testDraftOrder.lineItems.edges.map((edge: any) => {
        const item = edge.node;
        return {
          id: item.id,
          title: item.title || item.name,
          name: item.name || item.title,
          quantity: item.quantity,
          originalUnitPrice: item.originalUnitPrice.amount,
          sku: item.variant?.sku,
          variantId: item.variant?.id,
          productId: item.product?.id,
          variantTitle: item.variant?.title,
          vendor: item.vendor,
          requiresShipping: item.requiresShipping,
          taxable: item.taxable,
        };
      }),
      customer: {
        id: testDraftOrder.customer.id,
        email: testDraftOrder.customer.email,
        firstName: testDraftOrder.customer.firstName,
        lastName: testDraftOrder.customer.lastName,
        phone: testDraftOrder.customer.phone,
      },
      email: testDraftOrder.email,
      shippingAddress: {
        firstName: testDraftOrder.shippingAddress.firstName,
        lastName: testDraftOrder.shippingAddress.lastName,
        address1: testDraftOrder.shippingAddress.address1,
        address2: testDraftOrder.shippingAddress.address2,
        city: testDraftOrder.shippingAddress.city,
        province: testDraftOrder.shippingAddress.province,
        country: testDraftOrder.shippingAddress.country,
        zip: testDraftOrder.shippingAddress.zip,
        phone: testDraftOrder.shippingAddress.phone,
        countryCode: testDraftOrder.shippingAddress.countryCode,
        provinceCode: testDraftOrder.shippingAddress.provinceCode,
      },
      billingAddress: {
        firstName: testDraftOrder.billingAddress.firstName,
        lastName: testDraftOrder.billingAddress.lastName,
        address1: testDraftOrder.billingAddress.address1,
        city: testDraftOrder.billingAddress.city,
        province: testDraftOrder.billingAddress.province,
        country: testDraftOrder.billingAddress.country,
        zip: testDraftOrder.billingAddress.zip,
        phone: testDraftOrder.billingAddress.phone,
      },
      note: testDraftOrder.note,
      tags: testDraftOrder.tags,
      status: testDraftOrder.status,
      shop: shop,
      eventType: "draft_order_created",
    };

    console.log(`🚀 Triggering Ecomdrop flow ${configuration.carritoAbandonadoFlowId} for test draft order ${draftOrderData.draftOrderName}`);

    // Disparar el flow de Ecomdrop para carrito abandonado
    const result = await triggerEcomdropFlow(
      configuration.ecomdropApiKey!,
      configuration.carritoAbandonadoFlowId,
      draftOrderData
    );

    if (result.success) {
      console.log(`✅ Successfully triggered flow for test draft order ${draftOrderData.draftOrderName}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Flow triggered successfully for draft order ${draftOrderData.draftOrderName}`,
          shop: shop,
          flowId: configuration.carritoAbandonadoFlowId,
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } else {
      console.error(`❌ Failed to trigger flow: ${result.error}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error,
          shop: shop,
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error(`❌ Error processing test webhook:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};

