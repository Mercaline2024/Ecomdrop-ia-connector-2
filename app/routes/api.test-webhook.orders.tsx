import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { triggerEcomdropFlow } from "../lib/ecomdrop.api.server";

/**
 * Endpoint de prueba para simular webhook de orders/create
 * Usa el shop correcto de la base de datos en lugar del genérico
 * 
 * POST /api/test-webhook/orders
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

    // Verificar que tenga Flow ID configurado
    if (!configuration.nuevoPedidoFlowId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No 'Nuevo Pedido' flow configured" 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Datos de pedido de prueba
    const testOrder = {
      id: 1234567890,
      name: "#TEST-1001",
      order_number: 1001,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      total_price: "99.99",
      subtotal_price: "89.99",
      total_tax: "10.00",
      total_discounts: "0.00",
      currency: "USD",
      financial_status: "paid",
      fulfillment_status: "unfulfilled",
      line_items: [
        {
          id: 1111111111,
          name: "Test Product - Variant",
          title: "Test Product",
          quantity: 2,
          price: "49.99",
          sku: "TEST-SKU-123",
          variant_id: 2222222222,
          product_id: 3333333333,
          variant_title: "Default Title",
          vendor: "Test Vendor",
          requires_shipping: true,
          taxable: true,
          fulfillment_status: null,
        },
      ],
      customer: {
        id: 4444444444,
        email: "test@example.com",
        first_name: "Test",
        last_name: "Customer",
        phone: "+1234567890",
        accepts_marketing: true,
        total_spent: "199.98",
        orders_count: 1,
      },
      shipping_address: {
        first_name: "Test",
        last_name: "Customer",
        address1: "123 Test Street",
        address2: "",
        city: "Test City",
        province: "Test Province",
        country: "United States",
        zip: "12345",
        phone: "+1234567890",
        country_code: "US",
        province_code: "TS",
      },
      billing_address: {
        first_name: "Test",
        last_name: "Customer",
        address1: "123 Test Street",
        city: "Test City",
        province: "Test Province",
        country: "United States",
        zip: "12345",
        phone: "+1234567890",
      },
      tags: ["test", "demo"],
      note: "Test order from webhook endpoint",
      note_attributes: [],
      source_name: "web",
      processing_method: "direct",
      checkout_id: null,
      checkout_token: null,
      gateway: "test_gateway",
    };

    console.log(`📋 Processing test order ${testOrder.name} for ${shop}`);

    // Estructurar datos del pedido para Ecomdrop
    const orderData = {
      orderId: testOrder.id,
      orderName: testOrder.name,
      orderNumber: testOrder.order_number,
      createdAt: testOrder.created_at,
      updatedAt: testOrder.updated_at,
      totalPrice: testOrder.total_price,
      subtotalPrice: testOrder.subtotal_price,
      totalTax: testOrder.total_tax,
      totalDiscounts: testOrder.total_discounts,
      currency: testOrder.currency,
      financialStatus: testOrder.financial_status,
      fulfillmentStatus: testOrder.fulfillment_status,
      lineItems: testOrder.line_items.map((item) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        sku: item.sku,
        variantId: item.variant_id,
        productId: item.product_id,
        variantTitle: item.variant_title,
        vendor: item.vendor,
        requiresShipping: item.requires_shipping,
        taxable: item.taxable,
        fulfillmentStatus: item.fulfillment_status,
      })),
      customer: {
        id: testOrder.customer.id,
        email: testOrder.customer.email,
        firstName: testOrder.customer.first_name,
        lastName: testOrder.customer.last_name,
        phone: testOrder.customer.phone,
        acceptsMarketing: testOrder.customer.accepts_marketing,
        totalSpent: testOrder.customer.total_spent,
        ordersCount: testOrder.customer.orders_count,
      },
      shippingAddress: {
        firstName: testOrder.shipping_address.first_name,
        lastName: testOrder.shipping_address.last_name,
        address1: testOrder.shipping_address.address1,
        address2: testOrder.shipping_address.address2,
        city: testOrder.shipping_address.city,
        province: testOrder.shipping_address.province,
        country: testOrder.shipping_address.country,
        zip: testOrder.shipping_address.zip,
        phone: testOrder.shipping_address.phone,
        countryCode: testOrder.shipping_address.country_code,
        provinceCode: testOrder.shipping_address.province_code,
      },
      billingAddress: {
        firstName: testOrder.billing_address.first_name,
        lastName: testOrder.billing_address.last_name,
        address1: testOrder.billing_address.address1,
        city: testOrder.billing_address.city,
        province: testOrder.billing_address.province,
        country: testOrder.billing_address.country,
        zip: testOrder.billing_address.zip,
        phone: testOrder.billing_address.phone,
      },
      tags: testOrder.tags,
      note: testOrder.note,
      noteAttributes: testOrder.note_attributes,
      sourceName: testOrder.source_name,
      processingMethod: testOrder.processing_method,
      checkoutId: testOrder.checkout_id,
      checkoutToken: testOrder.checkout_token,
      gateway: testOrder.gateway,
      shop: shop,
      eventType: "order_created",
    };

    console.log(`🚀 Triggering Ecomdrop flow ${configuration.nuevoPedidoFlowId} for test order ${orderData.orderName}`);

    // Disparar el flow de Ecomdrop
    const result = await triggerEcomdropFlow(
      configuration.ecomdropApiKey!,
      configuration.nuevoPedidoFlowId,
      orderData
    );

    if (result.success) {
      console.log(`✅ Successfully triggered flow for test order ${orderData.orderName}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Flow triggered successfully for order ${orderData.orderName}`,
          shop: shop,
          flowId: configuration.nuevoPedidoFlowId,
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

