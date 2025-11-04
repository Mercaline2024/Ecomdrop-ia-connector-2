import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    return new Response(JSON.stringify({ error: "No shop session found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const formData = await request.formData();
    const dropiProductId = formData.get("dropiProductId")?.toString();
    const dropiProductData = formData.get("dropiProductData")?.toString();
    const shopifyProductId = formData.get("shopifyProductId")?.toString();
    const dropiVariationsStr = formData.get("dropiVariations")?.toString(); // JSON array de variantes Dropi
    const variantAssociationsStr = formData.get("variantAssociations")?.toString(); // JSON array de asociaciones
    const saveDropiName = formData.get("saveDropiName") === "true";
    const saveDropiDescription = formData.get("saveDropiDescription") === "true";
    const useSuggestedBarcode = formData.get("useSuggestedBarcode") === "true";
    const saveDropiImages = formData.get("saveDropiImages") === "true";

    if (!dropiProductId || !dropiProductData || !shopifyProductId) {
      return new Response(JSON.stringify({ error: "Datos del producto Dropi y Shopify requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const dropiProduct = JSON.parse(dropiProductData);
    const dropiVariations = dropiVariationsStr ? JSON.parse(dropiVariationsStr) : [];
    const variantAssociations = variantAssociationsStr ? JSON.parse(variantAssociationsStr) : [];

    let finalShopifyProductId = shopifyProductId;
    let shopifyProductTitle = "";

    // Solo soportamos sincronización (link), no creación de nuevos productos
    // Vincular con producto existente
    if (!shopifyProductId) {
      return new Response(JSON.stringify({ error: "Debe seleccionar un producto de Shopify" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

      // Obtener información del producto Shopify
      const query = `
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
          }
        }
      `;

      const response = await admin.graphql(query, {
        variables: { id: shopifyProductId }
      });

      const data = await response.json();
      shopifyProductTitle = data.data?.product?.title || "";

      // Actualizar producto si es necesario (nombre, descripción, etc.)
      if (saveDropiName && (dropiProduct.name || dropiProduct.title)) {
        const updateNameMutation = `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                title
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        await admin.graphql(updateNameMutation, {
          variables: {
            input: {
              id: shopifyProductId,
              title: dropiProduct.name || dropiProduct.title
            }
          }
        });
      }

      if (saveDropiDescription && dropiProduct.description) {
        const updateMutation = `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        await admin.graphql(updateMutation, {
          variables: {
            input: {
              id: shopifyProductId,
              descriptionHtml: dropiProduct.description
            }
          }
        });
      }

      // Agregar imágenes si está habilitado
      if (saveDropiImages && dropiProduct.gallery && dropiProduct.gallery.length > 0) {
        const CLOUDFRONT_BASE_URL = "https://d39ru7awumhhs2.cloudfront.net/";
        const images = dropiProduct.gallery.slice(0, 5).map((img: any) => {
          // Asegurar que la URL tenga el prefijo correcto
          let imageUrl = img.urlS3 || img.url || "";
          if (!imageUrl.startsWith("http")) {
            // Si no tiene http, agregar el prefijo de CloudFront
            imageUrl = imageUrl.startsWith("/") ? imageUrl.slice(1) : imageUrl;
            imageUrl = `${CLOUDFRONT_BASE_URL}${imageUrl}`;
          }
          return {
            originalSource: imageUrl,
            alt: dropiProduct.name || dropiProduct.title || "Producto Dropi"
          };
        });

        // Primero, eliminar imágenes existentes (opcional) o simplemente agregar nuevas
        const appendMediaMutation = `
          mutation productAppendMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productAppendMedia(productId: $productId, media: $media) {
              media {
                id
                ... on MediaImage {
                  image {
                    url
                  }
                }
              }
              mediaUserErrors {
                field
                message
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        try {
          const mediaResponse = await admin.graphql(appendMediaMutation, {
            variables: {
              productId: shopifyProductId,
              media: images
            }
          });

          const mediaData = await mediaResponse.json();
          
          if (mediaData.data?.productAppendMedia?.mediaUserErrors?.length > 0 || 
              mediaData.data?.productAppendMedia?.userErrors?.length > 0) {
            console.error("Error agregando imágenes:", mediaData.data.productAppendMedia);
            // No fallamos la vinculación si las imágenes no se pueden agregar
          }
        } catch (mediaError) {
          console.error("Error al agregar imágenes:", mediaError);
          // No fallamos la vinculación si las imágenes no se pueden agregar
        }
      }

    // Verificar que tenemos un ID de producto Shopify válido
    if (!finalShopifyProductId) {
      return new Response(JSON.stringify({ error: "No se pudo obtener el ID del producto de Shopify" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Guardar asociación en la base de datos
    const association = await db.productAssociation.upsert({
      where: {
        shop_dropiProductId_shopifyProductId: {
          shop: session.shop,
          dropiProductId: dropiProductId,
          shopifyProductId: finalShopifyProductId
        }
      },
      create: {
        shop: session.shop,
        dropiProductId: dropiProductId,
        shopifyProductId: finalShopifyProductId,
        dropiProductName: dropiProduct.name || dropiProduct.title,
        shopifyProductTitle: shopifyProductTitle,
        importType: "link",
        dropiVariations: JSON.stringify(dropiVariations),
        saveDropiName: saveDropiName,
        saveDropiDescription: saveDropiDescription,
        customPrice: null,
        useSuggestedBarcode: useSuggestedBarcode,
        saveDropiImages: saveDropiImages,
      },
      update: {
        shopifyProductTitle: shopifyProductTitle,
        dropiVariations: JSON.stringify(dropiVariations),
        saveDropiName: saveDropiName,
        saveDropiDescription: saveDropiDescription,
        customPrice: null,
        useSuggestedBarcode: useSuggestedBarcode,
        saveDropiImages: saveDropiImages,
      }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      association,
      message: "Producto sincronizado exitosamente"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error importing/linking product:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

