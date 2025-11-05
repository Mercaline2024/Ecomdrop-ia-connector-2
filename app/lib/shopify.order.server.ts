/**
 * Shopify Order Helper Functions
 * Utilidades para trabajar con pedidos de Shopify usando GraphQL API
 * 
 * NOTA: Esta función requiere que la app esté aprobada por Shopify para acceder a datos protegidos de clientes.
 * Una vez que la app esté publicada y aprobada, funcionará correctamente.
 */

// No necesita imports adicionales, usa fetch directamente con el access token

export interface UpdateOrderTagsParams {
  session: any; // Session from authenticate.webhook
  orderId: string; // GraphQL ID del pedido (ej: "gid://shopify/Order/123")
  tags: string[]; // Array de tags a agregar
}

/**
 * Actualiza los tags de un pedido en Shopify
 * @param session - Sesión del webhook (obtenida de authenticate.webhook)
 * @param orderId - ID del pedido en formato GraphQL (gid://shopify/Order/123)
 * @param tags - Array de tags a agregar. Si el pedido ya tiene tags, estos se agregarán
 * @returns Promise con el resultado de la operación
 */
export async function updateOrderTags({
  session,
  orderId,
  tags,
}: UpdateOrderTagsParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!session) {
      return {
        success: false,
        error: "No session available to update order",
      };
    }

    // Usar GraphQL API (API moderna de Shopify)
    // Nota: Requiere aprobación de Shopify para datos protegidos de clientes
    // Una vez que la app esté publicada y aprobada, funcionará correctamente
    const shop = session.shop;
    const accessToken = session.accessToken;
    
    if (!accessToken) {
      return {
        success: false,
        error: "No access token available in session",
      };
    }

    // Usar GraphQL API (API moderna de Shopify)
    // Nota: Requiere aprobación de Shopify para datos protegidos de clientes
    // Una vez que la app esté publicada y aprobada, funcionará correctamente
    const apiVersion = "2025-10";
    const graphqlEndpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
    
    // Obtener los tags actuales del pedido usando GraphQL
    const getOrderQuery = {
      query: `#graphql
        query GetOrderTags($id: ID!) {
          order(id: $id) {
            id
            tags
          }
        }
      `,
      variables: {
        id: orderId,
      },
    };

    const getOrderResponse = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify(getOrderQuery),
    });

    const getOrderData = await getOrderResponse.json();

    if (getOrderData.errors) {
      console.error("❌ Error fetching order:", getOrderData.errors);
      // Si el error es por datos protegidos, informar pero no fallar
      const isProtectedDataError = getOrderData.errors.some((err: any) => 
        err.message?.includes("protected") || err.extensions?.code === "ACCESS_DENIED"
      );
      
      if (isProtectedDataError) {
        console.warn("⚠️ App not approved for protected customer data. Will work after approval.");
        // Continuar sin tags existentes, solo agregar los nuevos
      } else {
        return {
          success: false,
          error: `Failed to fetch order: ${getOrderData.errors[0]?.message || "Unknown error"}`,
        };
      }
    }

    const currentTags = getOrderData.data?.order?.tags || [];
    const existingTagsArray = currentTags.length > 0 
      ? currentTags.split(",").map((tag: string) => tag.trim())
      : [];

    // Combinar tags existentes con los nuevos (evitar duplicados)
    const allTags = [...new Set([...existingTagsArray, ...tags])];
    const tagsString = allTags.join(", ");

    console.log(`🏷️ Updating order ${orderId} with tags: ${tagsString}`);

    // Actualizar el pedido con los nuevos tags usando GraphQL
    const updateMutation = {
      query: `#graphql
        mutation UpdateOrderTags($id: ID!, $tags: [String!]!) {
          orderUpdate(input: { id: $id, tags: $tags }) {
            order {
              id
              tags
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      variables: {
        id: orderId,
        tags: allTags,
      },
    };

    const updateResponse = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify(updateMutation),
    });

    const updateData = await updateResponse.json();

    if (updateData.errors || updateData.data?.orderUpdate?.userErrors?.length > 0) {
      const errors = updateData.errors || updateData.data?.orderUpdate?.userErrors;
      const isProtectedDataError = errors.some((err: any) => 
        err.message?.includes("protected") || err.extensions?.code === "ACCESS_DENIED"
      );
      
      if (isProtectedDataError) {
        console.warn("⚠️ App not approved for protected customer data. Will work after approval.");
        return {
          success: false,
          error: "App requires approval for protected customer data. Will work after publication.",
        };
      }
      
      console.error("❌ Error updating order tags:", errors);
      return {
        success: false,
        error: `Failed to update tags: ${errors[0]?.message || "Unknown error"}`,
      };
    }

    console.log(`✅ Successfully updated order tags: ${tagsString}`);
    return {
      success: true,
    };
  } catch (error) {
    console.error("❌ Error in updateOrderTags:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Agrega un tag específico a un pedido
 * Útil para agregar tags basados en la respuesta de Ecomdrop
 */
export async function addTagToOrder(
  session: any,
  orderId: string,
  tag: string
): Promise<{ success: boolean; error?: string }> {
  return updateOrderTags({
    session,
    orderId,
    tags: [tag],
  });
}

