/**
 * Ecomdrop API Integration Service
 * Handles all API calls to Ecomdrop IA Solutions
 */

const ECOMDROP_API_BASE = "https://panel.ecomdrop.app/api";

// Simple in-memory cache to prevent rate limiting
const flowsCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute

export interface EcomdropFlow {
  id: string;
  name: string;
  description?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface EcomdropApiResponse {
  success: boolean;
  data?: EcomdropFlow[];
  error?: string;
}

/**
 * Fetch all flows from Ecomdrop account
 */
export async function getEcomdropFlows(apiKey: string): Promise<EcomdropApiResponse> {
  // Check cache first
  const cached = flowsCache.get(apiKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log("📦 Returning cached flows");
    return {
      success: true,
      data: cached.data,
    };
  }
  try {
    console.log("🔍 Fetching flows from Ecomdrop API...");
    console.log("📡 API URL:", `${ECOMDROP_API_BASE}/accounts/flows`);
    
    const response = await fetch(`${ECOMDROP_API_BASE}/accounts/flows`, {
      method: "GET",
      headers: {
        "accept": "application/json",
        "X-ACCESS-TOKEN": apiKey,
      },
    });

    console.log("📊 Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", response.status, errorText);
      return {
        success: false,
        error: `API Error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    console.log("✅ Flows received:", data);
    console.log("📦 Number of flows:", Array.isArray(data) ? data.length : 0);
    
    const flows = Array.isArray(data) ? data : [];
    
    // Cache the result
    flowsCache.set(apiKey, { data: flows, timestamp: Date.now() });
    
    return {
      success: true,
      data: flows,
    };
  } catch (error) {
    console.error("❌ Error fetching Ecomdrop flows:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Clear flows cache (useful when syncing)
 */
export function clearFlowsCache(apiKey?: string) {
  if (apiKey) {
    flowsCache.delete(apiKey);
  } else {
    flowsCache.clear();
  }
}

/**
 * Trigger a specific flow by ID
 * Envía los datos del evento (pedido o carrito) al endpoint de Ecomdrop
 */
export async function triggerEcomdropFlow(
  apiKey: string,
  flowId: string,
  payload: any
): Promise<EcomdropApiResponse> {
  try {
    console.log(`🔍 Triggering Ecomdrop flow ${flowId}...`);
    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    // Endpoint para disparar un flow en Ecomdrop
    // Ajusta esta URL según la documentación de la API de Ecomdrop
    const response = await fetch(`${ECOMDROP_API_BASE}/flows/${flowId}/trigger`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-ACCESS-TOKEN": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log(`📊 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", response.status, errorText);
      return {
        success: false,
        error: `API Error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    console.log("✅ Flow triggered successfully:", data);

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("❌ Error triggering Ecomdrop flow:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Country to Field ID mapping for Dropi bot fields
 */
const DROPI_COUNTRY_FIELD_MAP: Record<string, string> = {
  'CO': '640597',
  'EC': '805359',
  'CL': '665134',
  'GT': '747995',
  'MX': '641097',
  'PA': '742965',
  'PE': '142979',
  'PY': '240677',
};

/**
 * Validate and save Dropi integration
 */
export async function validateAndSaveDropiIntegration(
  apiKey: string,
  country: string,
  dropiToken: string
): Promise<EcomdropApiResponse> {
  try {
    // Get the field ID for the country
    const fieldId = DROPI_COUNTRY_FIELD_MAP[country];
    
    if (!fieldId) {
      return {
        success: false,
        error: `País no válido: ${country}`,
      };
    }

    console.log(`🔍 Validating Dropi integration for country: ${country}, fieldId: ${fieldId}`);
    
    // Make POST request to save the token
    const response = await fetch(`${ECOMDROP_API_BASE}/accounts/bot_fields/${fieldId}`, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "X-ACCESS-TOKEN": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        value: dropiToken
      }).toString(),
    });

    console.log(`📊 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ API Error:", response.status, errorText);
      return {
        success: false,
        error: `API Error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    console.log("✅ Dropi integration validated:", data);
    
    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("❌ Error validating Dropi integration:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

