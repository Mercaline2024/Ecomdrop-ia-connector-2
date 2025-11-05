import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { triggerEcomdropFlow } from "../lib/ecomdrop.api.server";
import { updateOrderTags } from "../lib/shopify.order.server"; // Solo para casos de error inmediato

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic, payload } = await authenticate.webhook(request);

  console.log(`📦 Received ${topic} webhook for ${shop}`);

  try {
    // Obtener la configuración de la tienda
    const configuration = await db.shopConfiguration.findUnique({
      where: { shop },
    });

    // Debug: Log para verificar qué shop se está buscando
    console.log(`🔍 Looking for configuration with shop: ${shop}`);
    console.log(`🔍 Configuration found: ${configuration ? 'Yes' : 'No'}`);
    if (configuration) {
      console.log(`🔍 API Key exists: ${configuration.ecomdropApiKey ? 'Yes' : 'No'}`);
      console.log(`🔍 Flow ID exists: ${configuration.nuevoPedidoFlowId ? 'Yes' : 'No'}`);
    }

    // Verificar que tenga API Key y Flow ID configurado
    if (!configuration?.ecomdropApiKey) {
      console.log(`⚠️ No API Key configured for ${shop}`);
      console.log(`💡 Tip: When testing with CLI, the shop is 'shop.myshopify.com' (generic). Use real shop domain for testing.`);
      return new Response("OK", { status: 200 });
    }

    if (!configuration?.nuevoPedidoFlowId) {
      console.log(`⚠️ No "Nuevo Pedido" flow configured for ${shop}`);
      return new Response("OK", { status: 200 });
    }

    // El payload del webhook GraphQL contiene el objeto order
    // Estructura GraphQL: { order: { id, name, createdAt, ... } }
    // O puede venir directamente como order (dependiendo de la versión)
    const order = (payload as any).order || payload;

    console.log(`📋 Processing order ${order.name || order.id} for ${shop}`);

    // Estructurar datos del pedido para Ecomdrop
    // Los webhooks GraphQL (ORDERS_CREATE) envían datos en formato GraphQL JSON
    const orderData = {
      // Información básica del pedido
      // Compatible con formato GraphQL y REST
      orderId: order.id,
      orderName: order.name || order.orderNumber || order.order_number,
      orderNumber: order.orderNumber || order.order_number || order.name,
      createdAt: order.createdAt || order.created_at,
      updatedAt: order.updatedAt || order.updated_at,
      
      // Información financiera
      // GraphQL usa MoneyV2: { amount, currencyCode }
      // REST usa strings directamente
      totalPrice: order.totalPriceSet?.shopMoney?.amount || order.totalPrice?.amount || order.total_price,
      subtotalPrice: order.subtotalPriceSet?.shopMoney?.amount || order.subtotalPrice?.amount || order.subtotal_price,
      totalTax: order.totalTaxSet?.shopMoney?.amount || order.totalTax?.amount || order.total_tax,
      totalDiscounts: order.totalDiscountsSet?.shopMoney?.amount || order.totalDiscounts?.amount || order.total_discounts,
      currency: order.currencyCode || order.currency,
      financialStatus: order.displayFinancialStatus || order.financialStatus || order.financial_status,
      fulfillmentStatus: order.displayFulfillmentStatus || order.fulfillmentStatus || order.fulfillment_status,
      
      // Items del pedido
      // GraphQL: lineItems.edges[].node
      // REST: line_items[]
      lineItems: (order.lineItems?.edges?.map((edge: any) => {
        const item = edge.node;
        return {
          id: item.id,
          name: item.name || item.title,
          title: item.title || item.name,
          quantity: item.quantity,
          price: item.originalUnitPrice?.amount || item.originalUnitPriceSet?.shopMoney?.amount || item.price,
          sku: item.variant?.sku,
          variantId: item.variant?.id || item.variantId,
          productId: item.product?.id || item.productId,
          variantTitle: item.variant?.title || item.variantTitle,
          vendor: item.vendor,
          requiresShipping: item.requiresShipping || item.requires_shipping,
          taxable: item.taxable,
          fulfillmentStatus: item.fulfillmentStatus || item.fulfillment_status,
        };
      }) || order.lineItems?.map((item: any) => ({
        id: item.id,
        name: item.name || item.title,
        title: item.title || item.name,
        quantity: item.quantity,
        price: item.originalUnitPrice?.amount || item.price,
        sku: item.variant?.sku,
        variantId: item.variant?.id,
        productId: item.product?.id,
        variantTitle: item.variant?.title,
        vendor: item.vendor,
        requiresShipping: item.requiresShipping,
        taxable: item.taxable,
        fulfillmentStatus: item.fulfillmentStatus,
      })) || order.line_items?.map((item: any) => ({
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
      }))) || [],
      
      // Información del cliente
      // Compatible con formato GraphQL y REST
      customer: order.customer ? {
        id: order.customer.id,
        email: order.customer.email,
        firstName: order.customer.firstName || order.customer.first_name,
        lastName: order.customer.lastName || order.customer.last_name,
        phone: order.customer.phone,
        acceptsMarketing: order.customer.acceptsMarketing || order.customer.accepts_marketing,
        totalSpent: order.customer.totalSpent?.amount || order.customer.total_spent,
        ordersCount: order.customer.numberOfOrders || order.customer.orders_count,
      } : null,
      
      // Dirección de envío
      // Compatible con formato GraphQL y REST
      shippingAddress: (order.shippingAddress || order.shipping_address) ? {
        firstName: (order.shippingAddress || order.shipping_address)?.firstName || (order.shippingAddress || order.shipping_address)?.first_name,
        lastName: (order.shippingAddress || order.shipping_address)?.lastName || (order.shippingAddress || order.shipping_address)?.last_name,
        address1: (order.shippingAddress || order.shipping_address)?.address1,
        address2: (order.shippingAddress || order.shipping_address)?.address2,
        city: (order.shippingAddress || order.shipping_address)?.city,
        province: (order.shippingAddress || order.shipping_address)?.province,
        country: (order.shippingAddress || order.shipping_address)?.country,
        zip: (order.shippingAddress || order.shipping_address)?.zip,
        phone: (order.shippingAddress || order.shipping_address)?.phone,
        countryCode: (order.shippingAddress || order.shipping_address)?.countryCode || (order.shippingAddress || order.shipping_address)?.country_code,
        provinceCode: (order.shippingAddress || order.shipping_address)?.provinceCode || (order.shippingAddress || order.shipping_address)?.province_code,
      } : null,
      
      // Dirección de facturación
      // Compatible con formato GraphQL y REST
      billingAddress: (order.billingAddress || order.billing_address) ? {
        firstName: (order.billingAddress || order.billing_address)?.firstName || (order.billingAddress || order.billing_address)?.first_name,
        lastName: (order.billingAddress || order.billing_address)?.lastName || (order.billingAddress || order.billing_address)?.last_name,
        address1: (order.billingAddress || order.billing_address)?.address1,
        city: (order.billingAddress || order.billing_address)?.city,
        province: (order.billingAddress || order.billing_address)?.province,
        country: (order.billingAddress || order.billing_address)?.country,
        zip: (order.billingAddress || order.billing_address)?.zip,
        phone: (order.billingAddress || order.billing_address)?.phone,
      } : null,
      
      // Metadata
      tags: order.tags || [],
      note: order.note || "",
      noteAttributes: order.note_attributes || [],
      
      // Información adicional
      sourceName: order.source_name,
      processingMethod: order.processing_method,
      checkoutId: order.checkout_id,
      checkoutToken: order.checkout_token,
      gateway: order.gateway,
      
      // Información de la tienda
      shop: shop,
      
      // Tipo de evento
      eventType: "order_created",
    };

    // Construir la URL del callback para que Ecomdrop nos notifique cuando termine
    const callbackUrl = process.env.SHOPIFY_APP_URL 
      ? `${process.env.SHOPIFY_APP_URL}/api/ecomdrop/callback`
      : null;

    // Agregar información del callback al payload si está disponible
    if (callbackUrl) {
      orderData.callbackUrl = callbackUrl;
      orderData.callbackApiKey = configuration.ecomdropApiKey; // Para validación
      console.log(`📞 Callback URL configured: ${callbackUrl}`);
    }

    console.log(`🚀 Triggering Ecomdrop flow ${configuration.nuevoPedidoFlowId} for order ${orderData.orderName}`);

    // Disparar el flow de Ecomdrop (sin esperar respuesta - procesamiento asíncrono)
    // Ecomdrop llamará al callback cuando termine de procesar
    const result = await triggerEcomdropFlow(
      configuration.ecomdropApiKey,
      configuration.nuevoPedidoFlowId,
      orderData
    );

    if (result.success) {
      console.log(`✅ Successfully triggered flow for order ${orderData.orderName}`);
      console.log(`⏳ Waiting for Ecomdrop callback to assign tags...`);
      // No esperamos la respuesta - Ecomdrop llamará al callback cuando termine
    } else {
      console.error(`❌ Failed to trigger flow: ${result.error}`);
      
      // Solo agregar tag de error si falla inmediatamente (error de red, etc.)
      if (session && order.id) {
        const errorTagResult = await updateOrderTags({
          session,
          orderId: order.id,
          tags: ["ecomdrop-error"],
        });
        if (errorTagResult.success) {
          console.log(`🏷️ Added error tag to order ${orderData.orderName}`);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`❌ Error processing order webhook for ${shop}:`, error);
    // Siempre retornamos 200 para que Shopify no reintente el webhook
    // en caso de errores de procesamiento
    return new Response("OK", { status: 200 });
  }
};

