import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    return new Response(JSON.stringify({ error: "No shop session found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Get shop configuration
    const configuration = await db.shopConfiguration.findUnique({
      where: { shop: session.shop }
    });

    if (!configuration?.dropiToken) {
      return new Response(JSON.stringify({ 
        error: "Dropi no está configurado" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get query params for pagination and search
    const url = new URL(request.url);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
    const startData = parseInt(url.searchParams.get("startData") || "0");
    const keywords = url.searchParams.get("keywords") || "";
    const hasSearch = url.searchParams.get("hasSearch") === "true" || keywords.length > 0;
    const privatedProduct = url.searchParams.get("privated_product") === "true";
    const favorite = url.searchParams.get("favorite") === "true";

    const dropiApiUrl = "https://api.dropi.co/integrations/products/index";
    
    console.log("🔍 Fetching Dropi products from:", dropiApiUrl);
    console.log("📋 Params:", { pageSize, startData, keywords, hasSearch, privated_product: privatedProduct, favorite });
    console.log("🔑 Token length:", configuration.dropiToken?.length || 0);
    console.log("🔑 Token preview:", configuration.dropiToken?.substring(0, 20) || "none");
    
    // Construir el body según si hay búsqueda o no
    const body: any = {
      pageSize,
      startData,
      keywords,
      userVerified: false,
      order_by: "created_at",
      order_type: "desc",
      with_collection: true,
      get_stock: true,
      no_count: false
    };

    // Si hay búsqueda, NO incluir favorite ni privated_product (solo keywords)
    // Si NO hay búsqueda, usar SOLO UNO:
    // - Si privated_product está activado: solo privated_product: true
    // - Si privated_product está desactivado: solo favorite: true (por defecto)
    if (!hasSearch) {
      if (privatedProduct) {
        // Solo productos privados
        body.privated_product = true;
      } else {
        // Solo favoritos (por defecto)
        body.favorite = true;
      }
    }
    // Si hay búsqueda, el body solo tiene keywords y los parámetros requeridos
    
    const response = await fetch(dropiApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://n8n.ecomdropsolutions.com",
        "Referer": "https://n8n.ecomdropsolutions.com",
        "dropi-integration-key": configuration.dropiToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Dropi API Error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        error: `API Error: ${response.status} - ${errorText}`,
        products: [] // Return empty array on error so UI doesn't break
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    console.log("✅ Dropi products received (raw):", JSON.stringify(data).substring(0, 500));
    console.log("📊 Data type:", Array.isArray(data) ? "array" : "object");
    console.log("🔍 Full data structure:", JSON.stringify(data));

    // Handle different response formats
    // Dropi returns an array: [{ objects: [...], count: number }]
    // or directly { objects: [...], count: number }
    let products: any[] = [];
    let total = 0;

    if (Array.isArray(data) && data.length > 0) {
      // If it's an array, take the first element
      console.log("📦 Processing array response with", data.length, "elements");
      const firstItem = data[0];
      console.log("📦 First item keys:", Object.keys(firstItem));
      products = firstItem.objects || [];
      total = firstItem.count || 0;
      console.log("📦 Extracted from array - products:", products.length, "total:", total);
      if (products.length > 0) {
        console.log("📦 First product:", JSON.stringify(products[0]).substring(0, 200));
      }
    } else if (data && typeof data === 'object') {
      // If it's an object directly
      console.log("📦 Processing object response");
      console.log("📦 Object keys:", Object.keys(data));
      products = data.objects || data.data || data.products || [];
      total = data.count || products.length;
      console.log("📦 Extracted from object - products:", products.length, "total:", total);
      if (products.length > 0) {
        console.log("📦 First product:", JSON.stringify(products[0]).substring(0, 200));
      }
    }
    
    console.log("✅ Final products to return:", products.length);

    return new Response(JSON.stringify({ 
      products,
      total,
      pageSize,
      startData
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Error fetching Dropi products:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error occurred",
      products: [] // Return empty array on error so UI doesn't break
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

