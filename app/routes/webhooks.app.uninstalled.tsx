import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    // Limpiar todos los datos relacionados con la tienda
    // Webhook requests can trigger multiple times and after an app has already been uninstalled.
    // If this webhook already ran, the session may have been deleted previously.
    await Promise.all([
      // Eliminar sesiones
      db.session.deleteMany({ where: { shop } }),
      // Eliminar configuración de la tienda
      db.shopConfiguration.deleteMany({ where: { shop } }),
      // Eliminar asociaciones de productos
      db.productAssociation.deleteMany({ where: { shop } }),
      // Eliminar configuración de IA
      db.aIConfiguration.deleteMany({ where: { shop } }),
    ]);

    console.log(`✅ Successfully cleaned up all data for ${shop}`);
  } catch (error) {
    console.error(`❌ Error cleaning up data for ${shop}:`, error);
    // Aún así retornamos 200 para que Shopify no reintente el webhook
  }

  return new Response();
};
