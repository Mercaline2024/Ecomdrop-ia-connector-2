import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (!session?.shop) {
    return new Response(JSON.stringify({ error: "No shop session found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const formData = await request.formData();
    const associationId = formData.get("associationId")?.toString();

    if (!associationId) {
      return new Response(JSON.stringify({ error: "ID de asociación requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Verificar que la asociación pertenece a esta tienda
    const association = await db.productAssociation.findUnique({
      where: { id: associationId }
    });

    if (!association) {
      return new Response(JSON.stringify({ error: "Asociación no encontrada" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (association.shop !== session.shop) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Eliminar la asociación
    await db.productAssociation.delete({
      where: { id: associationId }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Asociación eliminada exitosamente",
      associationId: associationId
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error deleting association:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

