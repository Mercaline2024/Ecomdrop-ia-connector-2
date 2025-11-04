import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { validateAndSaveDropiIntegration } from "../lib/ecomdrop.api.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return { success: false, error: "No shop session found" };
  }

  const formData = await request.formData();
  const storeName = formData.get("store_name")?.toString() || "";
  const country = formData.get("country")?.toString() || "";
  const dropiToken = formData.get("dropi_token")?.toString() || "";

  // Validations
  if (!storeName) {
    return { success: false, error: "El nombre de la tienda es requerido" };
  }

  if (!country) {
    return { success: false, error: "El país es requerido" };
  }

  try {
    // Get configuration to access Ecomdrop API key
    const configuration = await db.shopConfiguration.findUnique({
      where: { shop: session.shop }
    });

    if (!configuration?.ecomdropApiKey) {
      return { success: false, error: "Primero debe configurar su clave API de Ecomdrop" };
    }

    // Token is required for new configurations only
    if (!configuration.dropiToken && !dropiToken) {
      return { success: false, error: "El token de Dropi es requerido" };
    }

    // Only validate with Ecomdrop API if a new token is provided
    if (dropiToken) {
      const validationResult = await validateAndSaveDropiIntegration(
        configuration.ecomdropApiKey,
        country,
        dropiToken
      );

      if (!validationResult.success) {
        return { 
          success: false, 
          error: validationResult.error || "Error al validar la integración con Dropi" 
        };
      }
    }

    // Save configuration to database
    const tokenToSave = dropiToken || configuration.dropiToken || "";
    
    const updatedConfiguration = await db.shopConfiguration.upsert({
      where: { shop: session.shop },
      create: {
        shop: session.shop,
        dropiStoreName: storeName,
        dropiCountry: country,
        dropiToken: tokenToSave,
      },
      update: {
        dropiStoreName: storeName,
        dropiCountry: country,
        // Only update token if a new one was provided
        ...(dropiToken ? { dropiToken: dropiToken } : {}),
      },
    });

    return { success: true, configuration: updatedConfiguration };
  } catch (error) {
    console.error("Error saving Dropi configuration:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

