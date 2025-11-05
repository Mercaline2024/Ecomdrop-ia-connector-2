import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { triggerEcomdropFlow } from "../lib/ecomdrop.api.server";

/**
 * Handler para webhook DRAFT_ORDERS_CREATE (GraphQL API)
 * Este webhook se dispara cuando se crea un pedido preliminar (draft order)
 * que puede representar un carrito abandonado o un pedido en proceso
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic, payload } = await authenticate.webhook(request);

  console.log(`📝 Received ${topic} webhook for ${shop}`);

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
      console.log(`🔍 Flow ID exists: ${configuration.carritoAbandonadoFlowId ? 'Yes' : 'No'}`);
    }

    // Verificar que tenga API Key y Flow ID configurado para carrito abandonado
    if (!configuration?.ecomdropApiKey) {
      console.log(`⚠️ No API Key configured for ${shop}`);
      return new Response("OK", { status: 200 });
    }

    if (!configuration?.carritoAbandonadoFlowId) {
      console.log(`⚠️ No "Carrito Abandonado" flow configured for ${shop}`);
      return new Response("OK", { status: 200 });
    }

    // El payload del webhook GraphQL contiene el objeto draftOrder en formato GraphQL
    // Estructura: { draftOrder: { id, name, createdAt, ... } }
    const draftOrder = (payload as any).draftOrder || payload;

    console.log(`📋 Processing draft order ${draftOrder.name || draftOrder.id} for ${shop}`);

    // Estructurar datos del draft order para Ecomdrop
    // Los webhooks GraphQL envían datos en formato GraphQL JSON
    const draftOrderData = {
      // Información básica del draft order
      draftOrderId: draftOrder.id,
      draftOrderName: draftOrder.name,
      createdAt: draftOrder.createdAt || draftOrder.created_at,
      updatedAt: draftOrder.updatedAt || draftOrder.updated_at,
      
      // Información financiera
      totalPrice: draftOrder.totalPrice?.amount || draftOrder.total_price,
      subtotalPrice: draftOrder.subtotalPrice?.amount || draftOrder.subtotal_price,
      totalTax: draftOrder.totalTax?.amount || draftOrder.total_tax,
      currencyCode: draftOrder.currencyCode || draftOrder.currency,
      
      // Items del draft order
      lineItems: draftOrder.lineItems?.edges?.map((edge: any) => {
        const item = edge.node;
        return {
          id: item.id,
          title: item.title || item.name,
          name: item.name || item.title,
          quantity: item.quantity,
          originalUnitPrice: item.originalUnitPrice?.amount || item.price,
          sku: item.variant?.sku,
          variantId: item.variant?.id,
          productId: item.product?.id,
          variantTitle: item.variant?.title,
          vendor: item.vendor,
          requiresShipping: item.requiresShipping || item.requires_shipping,
          taxable: item.taxable,
        };
      }) || draftOrder.lineItems?.map((item: any) => ({
        id: item.id,
        title: item.title || item.name,
        name: item.name || item.title,
        quantity: item.quantity,
        originalUnitPrice: item.price,
        sku: item.sku,
        variantId: item.variant_id,
        productId: item.product_id,
        variantTitle: item.variant_title,
        vendor: item.vendor,
        requiresShipping: item.requires_shipping,
        taxable: item.taxable,
      })) || [],
      
      // Información del cliente
      customer: draftOrder.customer ? {
        id: draftOrder.customer.id,
        email: draftOrder.customer.email,
        firstName: draftOrder.customer.firstName || draftOrder.customer.first_name,
        lastName: draftOrder.customer.lastName || draftOrder.customer.last_name,
        phone: draftOrder.customer.phone,
      } : null,
      
      // Email del draft order (si existe)
      email: draftOrder.email,
      
      // Dirección de envío
      shippingAddress: draftOrder.shippingAddress || draftOrder.shipping_address ? {
        firstName: (draftOrder.shippingAddress || draftOrder.shipping_address)?.firstName || (draftOrder.shippingAddress || draftOrder.shipping_address)?.first_name,
        lastName: (draftOrder.shippingAddress || draftOrder.shipping_address)?.lastName || (draftOrder.shippingAddress || draftOrder.shipping_address)?.last_name,
        address1: (draftOrder.shippingAddress || draftOrder.shipping_address)?.address1,
        address2: (draftOrder.shippingAddress || draftOrder.shipping_address)?.address2,
        city: (draftOrder.shippingAddress || draftOrder.shipping_address)?.city,
        province: (draftOrder.shippingAddress || draftOrder.shipping_address)?.province,
        country: (draftOrder.shippingAddress || draftOrder.shipping_address)?.country,
        zip: (draftOrder.shippingAddress || draftOrder.shipping_address)?.zip,
        phone: (draftOrder.shippingAddress || draftOrder.shipping_address)?.phone,
        countryCode: (draftOrder.shippingAddress || draftOrder.shipping_address)?.countryCode || (draftOrder.shippingAddress || draftOrder.shipping_address)?.country_code,
        provinceCode: (draftOrder.shippingAddress || draftOrder.shipping_address)?.provinceCode || (draftOrder.shippingAddress || draftOrder.shipping_address)?.province_code,
      } : null,
      
      // Dirección de facturación
      billingAddress: draftOrder.billingAddress || draftOrder.billing_address ? {
        firstName: (draftOrder.billingAddress || draftOrder.billing_address)?.firstName || (draftOrder.billingAddress || draftOrder.billing_address)?.first_name,
        lastName: (draftOrder.billingAddress || draftOrder.billing_address)?.lastName || (draftOrder.billingAddress || draftOrder.billing_address)?.last_name,
        address1: (draftOrder.billingAddress || draftOrder.billing_address)?.address1,
        city: (draftOrder.billingAddress || draftOrder.billing_address)?.city,
        province: (draftOrder.billingAddress || draftOrder.billing_address)?.province,
        country: (draftOrder.billingAddress || draftOrder.billing_address)?.country,
        zip: (draftOrder.billingAddress || draftOrder.billing_address)?.zip,
        phone: (draftOrder.billingAddress || draftOrder.billing_address)?.phone,
      } : null,
      
      // Información adicional
      note: draftOrder.note || "",
      tags: draftOrder.tags || [],
      status: draftOrder.status,
      
      // Información de la tienda
      shop: shop,
      
      // Tipo de evento
      eventType: "draft_order_created",
    };

    console.log(`🚀 Triggering Ecomdrop flow ${configuration.carritoAbandonadoFlowId} for draft order ${draftOrderData.draftOrderName}`);

    // Disparar el flow de Ecomdrop para carrito abandonado
    const result = await triggerEcomdropFlow(
      configuration.ecomdropApiKey,
      configuration.carritoAbandonadoFlowId,
      draftOrderData
    );

    if (result.success) {
      console.log(`✅ Successfully triggered flow for draft order ${draftOrderData.draftOrderName}`);
    } else {
      console.error(`❌ Failed to trigger flow: ${result.error}`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(`❌ Error processing draft order webhook for ${shop}:`, error);
    // Siempre retornamos 200 para que Shopify no reintente el webhook
    return new Response("OK", { status: 200 });
  }
};

