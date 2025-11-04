import type { LoaderFunctionArgs } from "react-router";

/**
 * Endpoint temporal para servir el tema ZIP descargado desde GitHub
 * Este endpoint permite que Shopify descargue el tema desde una URL pública
 * mientras el archivo está almacenado temporalmente en memoria
 * 
 * NOTA: Este endpoint NO requiere autenticación porque Shopify necesita
 * accederlo desde su servidor sin sesión de usuario
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const tempId = params.id;

  if (!tempId) {
    return new Response("ID requerido", { status: 400 });
  }

  // Obtener el archivo del cache temporal
  const cache = (globalThis as any).__themeCache;
  if (!cache) {
    console.error("❌ Cache no disponible para:", tempId);
    return new Response("Cache no disponible", { status: 404 });
  }

  const entry = cache.get(tempId);
  if (!entry) {
    console.error("❌ Archivo no encontrado en cache:", tempId);
    return new Response("Archivo no encontrado o expirado", { status: 404 });
  }

  // Verificar que el archivo no haya expirado
  if (entry.expires < Date.now()) {
    console.error("❌ Archivo expirado:", tempId, "expires:", entry.expires, "now:", Date.now());
    cache.delete(tempId);
    return new Response("Archivo expirado", { status: 410 }); // 410 Gone
  }

  // Log para debugging
  console.log(`📥 Sirviendo archivo temporal: ${tempId} para shop: ${entry.shop}`);
  console.log(`📦 Tamaño del archivo: ${(entry.data.length / 1024 / 1024).toFixed(2)} MB`);

  // Servir el archivo ZIP
  // Shopify necesita que el archivo sea accesible directamente
  return new Response(entry.data, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ecomdrop-theme-2.5.zip"`,
      "Content-Length": entry.data.length.toString(),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "Access-Control-Allow-Origin": "*", // Permitir acceso desde cualquier origen (Shopify)
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS"
    }
  });
};

// Manejar preflight OPTIONS para CORS
export const options = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }
  });
};

