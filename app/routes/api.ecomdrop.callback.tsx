import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { updateOrderTags } from "../lib/shopify.order.server";
import { sessionStorage } from "../shopify.server";

/**
 * Endpoint de callback para recibir notificaciones de Ecomdrop
 * cuando termine de procesar un pedido
 * 
 * POST /api/ecomdrop/callback
 * 
 * Payload esperado:
 * {
 *   "orderId": "gid://shopify/Order/123" o "#1001" o 123,
 *   "orderName": "#1001" (opcional, para identificar si no hay orderId en formato GraphQL),
 *   "shop": "tienda.myshopify.com" (opcional, si no se proporciona se busca por API key),
 *   "tag": "procesado" o "tags": ["tag1", "tag2"],
 *   "apiKey": "ecomdrop_api_key" (para validación),
 *   "status": "success" | "error" | "pending" (opcional)
 * }
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  // Solo aceptar POST
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const body = await request.json();
    console.log(`📥 Received Ecomdrop callback:`, JSON.stringify(body, null, 2));

    // Validar que tenga API key para autenticación
    const apiKey = body.apiKey || body.api_key || body.token;
    if (!apiKey) {
      console.error("❌ No API key provided in callback");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API key is required for authentication" 
        }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Buscar la configuración de la tienda por API key
    const configuration = await db.shopConfiguration.findFirst({
      where: {
        ecomdropApiKey: apiKey,
      },
    });

    if (!configuration) {
      console.error(`❌ Invalid API key: ${apiKey.substring(0, 10)}...`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Invalid API key" 
        }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const shop = body.shop || configuration.shop;
    console.log(`🔍 Processing callback for shop: ${shop}`);

    // Obtener el identificador del pedido
    // IMPORTANTE: Ecomdrop enviará orderName (ej: "#1014") como identificador principal
    const orderId = body.orderId || body.order_id;
    const orderName = body.orderName || body.order_name;
    
    // Validar que al menos tengamos orderName (que es lo que Ecomdrop enviará)
    if (!orderName && !orderId) {
      console.error("❌ No order identifier provided");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "orderName (e.g., '#1014') or orderId is required" 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Obtener los tags a asignar
    let tagsToAdd: string[] = [];

    // Estrategia 1: Tags directos
    if (body.tag) {
      tagsToAdd.push(body.tag);
    } else if (body.tags) {
      if (Array.isArray(body.tags)) {
        tagsToAdd = body.tags;
      } else if (typeof body.tags === "string") {
        tagsToAdd = body.tags.split(",").map((tag: string) => tag.trim());
      }
    }

    // Estrategia 2: Mapeo por status
    if (body.status) {
      const statusTagMap: Record<string, string> = {
        "success": "ecomdrop-processed",
        "completed": "ecomdrop-completed",
        "pending": "ecomdrop-pending",
        "error": "ecomdrop-error",
        "failed": "ecomdrop-error",
      };
      const statusTag = statusTagMap[body.status];
      if (statusTag && !tagsToAdd.includes(statusTag)) {
        tagsToAdd.push(statusTag);
      }
    }

    // Si no hay tags, usar tag por defecto
    if (tagsToAdd.length === 0) {
      tagsToAdd.push("ecomdrop-processed");
    }

    console.log(`🏷️ Tags to add: ${tagsToAdd.join(", ")}`);

    // Obtener la sesión de la tienda para actualizar el pedido
    const sessionId = `offline_${shop}`;
    const session = await sessionStorage.loadSession(sessionId);

    if (!session) {
      console.error(`❌ No session found for shop: ${shop}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No active session found for shop. Please ensure the app is installed." 
        }),
        { 
          status: 404,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (!session.accessToken) {
      console.error(`❌ No access token in session for shop: ${shop}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No access token available in session" 
        }),
        { 
          status: 401,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Convertir orderId a formato GraphQL si es necesario
    // IMPORTANTE: Ecomdrop enviará orderName (ej: "#1014"), no orderId GraphQL
    let graphQLOrderId: string | null = null;
    
    // Si hay orderId en formato GraphQL, usarlo directamente
    if (orderId && orderId.startsWith("gid://")) {
      graphQLOrderId = orderId;
      console.log(`✅ Using provided GraphQL orderId: ${graphQLOrderId}`);
    }
    // Si no hay orderId válido, buscar por orderName (formato que Ecomdrop envía)
    else {
      if (!orderName) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "orderName is required when orderId is not provided in GraphQL format" 
          }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Buscar el pedido por nombre usando GraphQL API
      // Nota: Requiere aprobación de Shopify para datos protegidos
      // Una vez que la app esté publicada y aprobada, funcionará correctamente
      const apiVersion = "2025-10";
      const graphqlEndpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
      
      console.log(`🔍 Searching for order by name: ${orderName} using GraphQL API`);
      
      const findOrderQuery = {
        query: `#graphql
          query GetOrderByName($name: String!) {
            orders(first: 1, query: $name) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        `,
        variables: {
          name: `name:${orderName}`,
        },
      };

      try {
        const findResponse = await fetch(graphqlEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": session.accessToken || "",
          },
          body: JSON.stringify(findOrderQuery),
        });

        const findData = await findResponse.json();
        
        if (findData.errors) {
          const isProtectedDataError = findData.errors.some((err: any) => 
            err.message?.includes("protected") || err.extensions?.code === "ACCESS_DENIED"
          );
          
          if (isProtectedDataError) {
            console.warn("⚠️ App not approved for protected customer data. Will work after approval.");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: "App requires approval for protected customer data. Will work after publication.",
                message: "This endpoint will work once the app is published and approved by Shopify."
              }),
              { 
                status: 403,
                headers: { "Content-Type": "application/json" }
              }
            );
          }
          
          console.error("❌ Error searching for order:", findData.errors);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to search order: ${findData.errors[0]?.message || "Unknown error"}` 
            }),
            { 
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        
        if (findData.data?.orders?.edges?.length > 0) {
          graphQLOrderId = findData.data.orders.edges[0].node.id;
          console.log(`✅ Found order by name: ${orderName} → ${graphQLOrderId}`);
        } else {
          console.error(`❌ Order not found by name: ${orderName}`);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Order ${orderName} not found in shop ${shop}` 
            }),
            { 
              status: 404,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      } catch (error) {
        console.error(`❌ Error finding order by name:`, error);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to find order: ${error instanceof Error ? error.message : "Unknown error"}` 
          }),
          { 
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    // Validar que tenemos un GraphQL orderId antes de continuar
    if (!graphQLOrderId) {
      console.error("❌ No valid orderId found after search");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Could not resolve order ID from provided orderName or orderId" 
        }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    // Actualizar el pedido con los tags
    console.log(`🔄 Updating order ${graphQLOrderId} with tags: ${tagsToAdd.join(", ")}`);
    
    const tagUpdateResult = await updateOrderTags({
      session,
      orderId: graphQLOrderId,
      tags: tagsToAdd,
    });

    if (tagUpdateResult.success) {
      console.log(`✅ Successfully updated order ${orderName || graphQLOrderId} with tags`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Tags added successfully: ${tagsToAdd.join(", ")}`,
          orderId: graphQLOrderId,
          tags: tagsToAdd,
        }),
        { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } else {
      console.error(`❌ Failed to update order tags: ${tagUpdateResult.error}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: tagUpdateResult.error || "Failed to update order tags" 
        }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error("❌ Error processing Ecomdrop callback:", error);
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

