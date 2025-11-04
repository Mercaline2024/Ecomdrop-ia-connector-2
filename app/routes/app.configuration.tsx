import { useEffect, useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getEcomdropFlows, clearFlowsCache, type EcomdropFlow } from "../lib/ecomdrop.api.server";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { getCountryCallingCode } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Obtener la configuración existente de la tienda
  const configuration = session?.shop 
    ? await db.shopConfiguration.findUnique({
        where: { shop: session.shop }
      })
    : null;

  // Obtener la configuración del Asistente IA
  const aiConfiguration = session?.shop
    ? await db.aIConfiguration.findUnique({
        where: { shop: session.shop }
      })
    : null;

  // Si hay API key configurada, obtener los flujos
  let flows: EcomdropFlow[] = [];
  if (configuration?.ecomdropApiKey) {
    console.log("🔑 API Key found, fetching flows...");
    const flowsResponse = await getEcomdropFlows(configuration.ecomdropApiKey);
    console.log("📊 Flow response:", flowsResponse);
    if (flowsResponse.success && flowsResponse.data) {
      flows = flowsResponse.data;
      console.log("✅ Loaded flows:", flows.length);
    } else {
      console.error("❌ Failed to load flows:", flowsResponse.error);
    }
  } else {
    console.log("⚠️ No API Key configured");
  }

  return { configuration, flows, aiConfiguration };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  
  if (!session?.shop) {
    return { success: false, error: "No shop session found" };
  }

  const formData = await request.formData();
  const intent = formData.get("intent")?.toString();

  try {
    if (intent === "save_api_key") {
      const apiKey = formData.get("apiKey")?.toString() || "";
      
      // Crear o actualizar la configuración
      const configuration = await db.shopConfiguration.upsert({
        where: { shop: session.shop },
        create: {
          shop: session.shop,
          ecomdropApiKey: apiKey,
        },
        update: {
          ecomdropApiKey: apiKey,
        },
      });

      return { success: true, configuration };
    }

    if (intent === "save_flows") {
      const nuevoPedidoFlowId = formData.get("nuevoPedidoFlowId")?.toString() || null;
      const carritoAbandonadoFlowId = formData.get("carritoAbandonadoFlowId")?.toString() || null;

      const configuration = await db.shopConfiguration.upsert({
        where: { shop: session.shop },
        create: {
          shop: session.shop,
          nuevoPedidoFlowId,
          carritoAbandonadoFlowId,
        },
        update: {
          nuevoPedidoFlowId,
          carritoAbandonadoFlowId,
        },
      });

      return { success: true, configuration };
    }

    if (intent === "sync_flows") {
      // Obtener configuración para limpiar el cache
      const config = await db.shopConfiguration.findUnique({
        where: { shop: session.shop }
      });
      
      // Clear cache and re-cargar los flujos
      if (config?.ecomdropApiKey) {
        clearFlowsCache(config.ecomdropApiKey);
      }
      return { success: true, synced: true };
    }

    if (intent === "save_ai_config") {
      const agentName = formData.get("agentName")?.toString() || null;
      const companyName = formData.get("companyName")?.toString() || null;
      const companyDescription = formData.get("companyDescription")?.toString() || null;
      const companyPolicies = formData.get("companyPolicies")?.toString() || null;
      const paymentMethods = formData.get("paymentMethods")?.toString() || null;
      const faq = formData.get("faq")?.toString() || null;
      const postSaleFaq = formData.get("postSaleFaq")?.toString() || null;
      const rules = formData.get("rules")?.toString() || null;
      const notifications = formData.get("notifications")?.toString() || null;

      const aiConfig = await db.aIConfiguration.upsert({
        where: { shop: session.shop },
        create: {
          shop: session.shop,
          agentName,
          companyName,
          companyDescription,
          companyPolicies,
          paymentMethods,
          faq,
          postSaleFaq,
          rules,
          notifications,
        },
        update: {
          agentName,
          companyName,
          companyDescription,
          companyPolicies,
          paymentMethods,
          faq,
          postSaleFaq,
          rules,
          notifications,
        },
      });

      return { success: true, aiConfiguration: aiConfig };
    }

    return { success: false, error: "Invalid intent" };
  } catch (error) {
    console.error("Error saving configuration:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
};

export default function ConfigurationPage() {
  const { configuration, flows, aiConfiguration } = useLoaderData<typeof loader>();
  const apiKeyFetcher = useFetcher<typeof action>();
  const flowsFetcher = useFetcher<typeof action>();
  const dropiFetcher = useFetcher();
  const shopify = useAppBridge();

  const [activeTab, setActiveTab] = useState<"ecomdrop" | "dropi" | "ai" | "status">("status");
  const [selectedNuevoPedido, setSelectedNuevoPedido] = useState(
    configuration?.nuevoPedidoFlowId || ""
  );
  const [selectedCarritoAbandonado, setSelectedCarritoAbandonado] = useState(
    configuration?.carritoAbandonadoFlowId || ""
  );
  const [dropiStoreName, setDropiStoreName] = useState(configuration?.dropiStoreName || "");
  const [dropiCountry, setDropiCountry] = useState(configuration?.dropiCountry || "");
  const [dropiToken, setDropiToken] = useState("");
  const [editingDropiToken, setEditingDropiToken] = useState(false);

  const countries = [
    { code: 'CO', name: 'Colombia' },
    { code: 'EC', name: 'Ecuador' },
    { code: 'CL', name: 'Chile' },
    { code: 'GT', name: 'Guatemala' },
    { code: 'MX', name: 'México' },
    { code: 'PA', name: 'Panamá' },
    { code: 'PE', name: 'Perú' },
    { code: 'PY', name: 'Paraguay' },
  ];

  useEffect(() => {
    console.log("🔍 Configuration loaded:", configuration);
    console.log("📦 Flows loaded:", flows.length, flows);
    console.log("🔄 Flows array sample:", flows.slice(0, 3));
  }, [configuration, flows]);

  useEffect(() => {
    if (apiKeyFetcher.data?.success) {
      shopify.toast.show("✅ ¡Conectado a Ecomdrop IA exitosamente!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeyFetcher.data?.success]);

  useEffect(() => {
    if (flowsFetcher.data?.success) {
      shopify.toast.show("✅ ¡Configuración de flujos guardada exitosamente!");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowsFetcher.data?.success]);

  useEffect(() => {
    if (dropiFetcher.data?.success) {
      shopify.toast.show("✅ ¡Configuración de Dropi guardada exitosamente!");
      setDropiToken(""); // Clear the token field after successful save
      setEditingDropiToken(false); // Exit edit mode
    } else if (dropiFetcher.data?.error) {
      shopify.toast.show(`❌ Error: ${dropiFetcher.data.error}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropiFetcher.data]);

  return (
    <s-page heading="Configuración">
      {/* Tabs Navigation */}
      <div style={{ 
        borderBottom: '2px solid #e1e3e5', 
        marginBottom: '2rem' 
      }}>
        <div style={{ display: 'flex', gap: '0' }}>
          <button
            type="button"
            onClick={() => setActiveTab("ecomdrop")}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              background: activeTab === "ecomdrop" ? '#fff' : 'transparent',
              color: activeTab === "ecomdrop" ? '#000' : '#666',
              fontWeight: activeTab === "ecomdrop" ? 'bold' : 'normal',
              borderBottom: activeTab === "ecomdrop" ? '3px solid #008060' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Ecomdrop
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dropi")}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              background: activeTab === "dropi" ? '#fff' : 'transparent',
              color: activeTab === "dropi" ? '#000' : '#666',
              fontWeight: activeTab === "dropi" ? 'bold' : 'normal',
              borderBottom: activeTab === "dropi" ? '3px solid #008060' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Dropi
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              background: activeTab === "ai" ? '#fff' : 'transparent',
              color: activeTab === "ai" ? '#000' : '#666',
              fontWeight: activeTab === "ai" ? 'bold' : 'normal',
              borderBottom: activeTab === "ai" ? '3px solid #008060' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            🤖 Configurar Asistente IA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("status")}
            style={{
              padding: '1rem 2rem',
              border: 'none',
              background: activeTab === "status" ? '#fff' : 'transparent',
              color: activeTab === "status" ? '#000' : '#666',
              fontWeight: activeTab === "status" ? 'bold' : 'normal',
              borderBottom: activeTab === "status" ? '3px solid #008060' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            📊 Estado de Configuración
          </button>
        </div>
      </div>

      {/* Ecomdrop Tab */}
      {activeTab === "ecomdrop" && (
        <>
          <s-section heading="Configuración de Integración">
            <s-paragraph>
              Conecte su cuenta de Ecomdrop IA y seleccione los flujos que desea utilizar.
            </s-paragraph>

            <apiKeyFetcher.Form method="post">
              <input type="hidden" name="intent" value="save_api_key" />
              <s-stack direction="block" gap="large">
                <s-text-field
                  name="apiKey"
                  label="Clave API de Ecomdrop"
                  type="password"
                  value={configuration?.ecomdropApiKey || ""}
                  placeholder="Ingrese su Clave API de Ecomdrop"
                  helpText="Su clave API se almacena de forma segura y cifrada por tienda"
                  error={apiKeyFetcher.data?.error}
                />

                <s-button 
                  type="submit" 
                  variant="primary"
                  {...(apiKeyFetcher.state === "submitting" ? { loading: true } : {})}
                >
                  {configuration?.ecomdropApiKey ? "Actualizar Conexión y Refrescar Flujos" : "Conectar Ecomdrop IA y Refrescar Flujos"}
                </s-button>
              </s-stack>
            </apiKeyFetcher.Form>
          </s-section>

          {configuration?.ecomdropApiKey && flows.length > 0 && (
            <s-section heading="Configuración de Flujos">
              <s-paragraph>
                Seleccione qué flujos de Ecomdrop deben activarse para estos eventos de Shopify:
              </s-paragraph>

              <flowsFetcher.Form method="post">
                <input type="hidden" name="intent" value="save_flows" />
                <s-stack direction="block" gap="large">
                  {/* Nuevo Pedido Flow */}
                  <div>
                    <s-label for="nuevoPedidoFlowId">
                      <strong>🛒 Nuevo Pedido</strong>
                    </s-label>
                    <select
                      id="nuevoPedidoFlowId"
                      name="nuevoPedidoFlowId"
                      value={selectedNuevoPedido}
                      onChange={(e) => setSelectedNuevoPedido(e.currentTarget.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      <option value="">-- Seleccione un flujo --</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Carrito Abandonado Flow */}
                  <div>
                    <s-label for="carritoAbandonadoFlowId">
                      <strong>📦 Carrito Abandonado</strong>
                    </s-label>
                    <select
                      id="carritoAbandonadoFlowId"
                      name="carritoAbandonadoFlowId"
                      value={selectedCarritoAbandonado}
                      onChange={(e) => setSelectedCarritoAbandonado(e.currentTarget.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      <option value="">-- Seleccione un flujo --</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <s-button 
                    type="submit" 
                    variant="primary"
                    {...(flowsFetcher.state === "submitting" ? { loading: true } : {})}
                  >
                    Guardar Configuración de Flujos
                  </s-button>
                </s-stack>
              </flowsFetcher.Form>
            </s-section>
          )}
        </>
      )}

      {/* AI Assistant Tab */}
      {activeTab === "ai" && (
        <div style={{ padding: '2rem' }}>
          {!configuration?.ecomdropApiKey ? (
            /* Mensaje cuando no hay API Key configurada */
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '3rem',
              marginBottom: '2rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              border: '2px solid #ffc107',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '4rem',
                marginBottom: '1rem'
              }}>
                🔑
              </div>
              <h2 style={{
                fontSize: '1.5rem',
                margin: 0,
                marginBottom: '1rem',
                color: '#333',
                fontWeight: '600'
              }}>
                API Key de Ecomdrop Requerida
              </h2>
              <p style={{
                fontSize: '1rem',
                color: '#666',
                margin: 0,
                marginBottom: '2rem',
                lineHeight: '1.6'
              }}>
                Para configurar el Asistente IA, primero debes configurar tu Clave API de Ecomdrop.<br />
                Esto es necesario para sincronizar la configuración con el sistema de Ecomdrop.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("ecomdrop")}
                style={{
                  padding: '1rem 2rem',
                  background: 'linear-gradient(135deg, rgb(0, 32, 238) 0%, rgb(75, 81, 162) 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 32, 238, 0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 32, 238, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 32, 238, 0.3)';
                }}
              >
                ⚙️ Ir a Configuración de Ecomdrop
              </button>
            </div>
          ) : (
            <>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '16px',
                padding: '1.5rem',
                marginBottom: '2rem',
                color: 'white',
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
              }}>
                <h1 style={{ fontSize: '1.5rem', margin: 0, marginBottom: '0.5rem', fontWeight: '600' }}>
                  🤖 Configurar Asistente IA
                </h1>
                <p style={{ fontSize: '0.9375rem', opacity: 0.9, margin: 0, lineHeight: '1.5' }}>
                  Personaliza tu asistente de inteligencia artificial para brindar la mejor experiencia a tus clientes
                </p>
              </div>

              <AIConfigurationForm aiConfiguration={aiConfiguration} shopify={shopify} />
            </>
          )}
        </div>
      )}

      {/* Dropi Tab */}
      {activeTab === "dropi" && (
        <s-section heading="Configuración de Dropi">
          <s-paragraph>
            Configure su integración con Dropi para habilitar la sincronización de órdenes.
          </s-paragraph>

          {!configuration?.ecomdropApiKey && (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="warning-subdued"
            >
              <s-paragraph>
                ⚠️ Primero debe configurar su clave API de Ecomdrop en la pestaña "Ecomdrop"
              </s-paragraph>
            </s-box>
          )}

          <dropiFetcher.Form method="post" action="/api/integrations/dropi/save">
            <s-stack direction="block" gap="large">
              <s-text-field
                name="store_name"
                label="Nombre de la Tienda"
                value={dropiStoreName}
                onChange={(e) => setDropiStoreName(e.currentTarget.value)}
                placeholder="Ingrese el nombre de su tienda"
                required
                error={dropiFetcher.data?.error && dropiFetcher.data.error.includes("tienda") ? dropiFetcher.data.error : undefined}
              />

              <div>
                <s-label for="country">
                  <strong>País de Operación</strong>
                </s-label>
                <select
                  id="country"
                  name="country"
                  value={dropiCountry}
                  onChange={(e) => setDropiCountry(e.currentTarget.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  required
                >
                  <option value="">-- Seleccione un país --</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Token Field with Edit Option */}
              {configuration?.dropiToken && !editingDropiToken ? (
                <div>
                  <s-label for="dropi_token_display">
                    <strong>Token de Dropi</strong>
                  </s-label>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '1rem',
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    background: '#f5f5f5'
                  }}>
                    <span style={{ 
                      fontFamily: 'monospace', 
                      letterSpacing: '0.2em',
                      userSelect: 'none'
                    }}>
                      •••••••••••••••••••••••••••••••••
                    </span>
                    <s-button 
                      type="button"
                      variant="secondary"
                      size="small"
                      onClick={() => setEditingDropiToken(true)}
                    >
                      Editar Token
                    </s-button>
                  </div>
                  <s-text tone="subdued" style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    Token configurado y almacenado de forma segura
                  </s-text>
                </div>
              ) : (
                <s-text-field
                  name="dropi_token"
                  label="Token de Dropi"
                  type="password"
                  value={dropiToken}
                  onChange={(e) => setDropiToken(e.currentTarget.value)}
                  placeholder={configuration?.dropiToken ? "Ingrese el nuevo token" : "Ingrese su token de Dropi"}
                  helpText="Su token se almacena de forma segura y cifrada"
                  required={!configuration?.dropiToken || editingDropiToken}
                  error={dropiFetcher.data?.error && dropiFetcher.data.error.includes("token") ? dropiFetcher.data.error : undefined}
                />
              )}
              
              {/* Only show required notice if editing existing token */}
              {(configuration?.dropiToken && editingDropiToken) && (
                <s-box
                  padding="tight"
                  background="info-subdued"
                  borderRadius="base"
                >
                  <s-paragraph style={{ margin: 0, fontSize: '0.875rem' }}>
                    ℹ️ Debe ingresar un nuevo token para actualizar la configuración
                  </s-paragraph>
                </s-box>
              )}

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <s-button 
                  type="submit" 
                  variant="primary"
                  {...(dropiFetcher.state === "submitting" ? { loading: true } : {})}
                  disabled={!configuration?.ecomdropApiKey}
                >
                  {dropiFetcher.state === "submitting" ? "Guardando..." : 
                   dropiFetcher.data?.success ? "Configuración guardada ✅" :
                   configuration?.dropiToken && !editingDropiToken ? "Guardar Cambios" : 
                   "Guardar"}
                </s-button>
                
                {editingDropiToken && (
                  <s-button 
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingDropiToken(false);
                      setDropiToken("");
                    }}
                  >
                    Cancelar
                  </s-button>
                )}
              </div>
            </s-stack>
          </dropiFetcher.Form>
        </s-section>
      )}

      {/* Status Tab */}
      {activeTab === "status" && (
        <div style={{ padding: '2rem' }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            marginBottom: '2rem', 
            color: '#333', 
            fontWeight: '600' 
          }}>
            📊 Estado de Configuración
          </h2>

          {/* Estado de Configuración */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              marginBottom: '1rem', 
              color: '#333', 
              fontWeight: '600' 
            }}>
              Estado de Configuración
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Ecomdrop API Key Status */}
              {configuration?.ecomdropApiKey && (
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: '#10b981',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#333',
                      marginBottom: '0.5rem'
                    }}>
                      Clave API de Ecomdrop configurada
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#666'
                    }}>
                      Última actualización: {new Date(configuration.updatedAt).toLocaleString('es-ES')}
                    </div>
                  </div>
                </div>
              )}

              {/* Dropi Status */}
              {configuration?.dropiStoreName && (
                <div style={{
                  background: '#f0f9ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: '#10b981',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#333',
                      marginBottom: '0.5rem'
                    }}>
                      Dropi configurado
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#666',
                      marginBottom: '0.25rem'
                    }}>
                      Tienda: {configuration.dropiStoreName}
                    </div>
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#666'
                    }}>
                      País: {countries.find(c => c.code === configuration.dropiCountry)?.name || configuration.dropiCountry}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuraciones de Flujos Activas */}
          {(configuration?.nuevoPedidoFlowId || configuration?.carritoAbandonadoFlowId) && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ 
                fontSize: '1.125rem', 
                marginBottom: '1rem', 
                color: '#333', 
                fontWeight: '600' 
              }}>
                Configuraciones de Flujos Activas:
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {configuration.nuevoPedidoFlowId && (
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e1e3e5',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>🛒</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#666',
                        marginBottom: '0.25rem'
                      }}>
                        Nuevo Pedido:
                      </div>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: '500',
                        color: '#333'
                      }}>
                        {flows.find(f => f.id === configuration.nuevoPedidoFlowId)?.name || 'Flujo seleccionado'}
                      </div>
                    </div>
                  </div>
                )}
                
                {configuration.carritoAbandonadoFlowId && (
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e1e3e5',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>📦</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#666',
                        marginBottom: '0.25rem'
                      }}>
                        Carrito Abandonado:
                      </div>
                      <div style={{
                        fontSize: '1rem',
                        fontWeight: '500',
                        color: '#333'
                      }}>
                        {flows.find(f => f.id === configuration.carritoAbandonadoFlowId)?.name || 'Flujo seleccionado'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Próximos Pasos */}
          <div>
            <h3 style={{ 
              fontSize: '1.125rem', 
              marginBottom: '1rem', 
              color: '#333', 
              fontWeight: '600' 
            }}>
              Próximos Pasos
            </h3>
            
            <div style={{
              background: '#fff',
              border: '1px solid #e1e3e5',
              borderRadius: '8px',
              padding: '1.5rem'
            }}>
              <ul style={{
                margin: 0,
                paddingLeft: '1.5rem',
                listStyle: 'disc',
                color: '#666'
              }}>
                <li style={{ marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
                  Configure su clave API de Ecomdrop para habilitar la integración
                </li>
                <li style={{ marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
                  Opcionalmente configure Dropi para sincronización de órdenes
                </li>
                <li style={{ marginBottom: '0.75rem', fontSize: '0.9375rem' }}>
                  Seleccione flujos para activadores automáticos de eventos
                </li>
                <li style={{ fontSize: '0.9375rem' }}>
                  Configure el Asistente IA para personalizar la experiencia del cliente
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </s-page>
  );
}

// Componente para el formulario de Configuración del Asistente IA
function AIConfigurationForm({ aiConfiguration, shopify }: { aiConfiguration: any, shopify: any }) {
  const aiFetcher = useFetcher();

  // Estados para los campos del formulario
  const [agentName, setAgentName] = useState(aiConfiguration?.agentName || "");
  const [companyName, setCompanyName] = useState(aiConfiguration?.companyName || "");
  const [companyDescription, setCompanyDescription] = useState(aiConfiguration?.companyDescription || "");
  const [companyPolicies, setCompanyPolicies] = useState(aiConfiguration?.companyPolicies || "");
  
  // Estados para arrays dinámicos
  const [paymentMethods, setPaymentMethods] = useState<any[]>(() => {
    if (aiConfiguration?.paymentMethods) {
      try {
        return JSON.parse(aiConfiguration.paymentMethods);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [faq, setFaq] = useState<any[]>(() => {
    if (aiConfiguration?.faq) {
      try {
        return JSON.parse(aiConfiguration.faq);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [postSaleFaq, setPostSaleFaq] = useState<any[]>(() => {
    if (aiConfiguration?.postSaleFaq) {
      try {
        return JSON.parse(aiConfiguration.postSaleFaq);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [rules, setRules] = useState<any[]>(() => {
    if (aiConfiguration?.rules) {
      try {
        return JSON.parse(aiConfiguration.rules);
      } catch {
        return [];
      }
    }
    return [];
  });

  const [notifications, setNotifications] = useState<any[]>(() => {
    if (aiConfiguration?.notifications) {
      try {
        return JSON.parse(aiConfiguration.notifications);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Estado para el modal de notificaciones
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [notificationType, setNotificationType] = useState("");
  const [notificationPhone, setNotificationPhone] = useState("");
  const [notificationName, setNotificationName] = useState("");
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);

  // Países disponibles para integración
  const availableCountries: Country[] = ['CO', 'EC', 'CL', 'GT', 'MX', 'PA', 'PE', 'PY'];

  // Función para extraer el código de país del número telefónico
  const extractCountryFromPhone = (phone: string): string | null => {
    if (!phone) return null;
    for (const country of availableCountries) {
      const code = getCountryCallingCode(country);
      if (phone.startsWith(`+${code}`)) {
        return country;
      }
    }
    return null;
  };

  // Estado para rastrear cambios sin guardar
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Detectar cambios en los campos
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Verificar si hay cambios comparando con la configuración inicial
    const hasChanges = 
      agentName !== (aiConfiguration?.agentName || "") ||
      companyName !== (aiConfiguration?.companyName || "") ||
      companyDescription !== (aiConfiguration?.companyDescription || "") ||
      companyPolicies !== (aiConfiguration?.companyPolicies || "") ||
      JSON.stringify(paymentMethods) !== (aiConfiguration?.paymentMethods || "[]") ||
      JSON.stringify(faq) !== (aiConfiguration?.faq || "[]") ||
      JSON.stringify(postSaleFaq) !== (aiConfiguration?.postSaleFaq || "[]") ||
      JSON.stringify(rules) !== (aiConfiguration?.rules || "[]") ||
      JSON.stringify(notifications) !== (aiConfiguration?.notifications || "[]");
    
    setHasUnsavedChanges(hasChanges);
  }, [agentName, companyName, companyDescription, companyPolicies, paymentMethods, faq, postSaleFaq, rules, notifications, aiConfiguration]);

  // Manejar respuesta del guardado
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (aiFetcher.data?.success) {
      shopify.toast.show("✅ Configuración del Asistente IA guardada exitosamente");
      setHasUnsavedChanges(false); // Resetear el estado de cambios sin guardar
    } else if (aiFetcher.data?.error) {
      shopify.toast.show(`❌ Error: ${aiFetcher.data.error}`);
    }
  }, [aiFetcher.data, shopify]);

  // Funciones para agregar elementos
  const addPaymentMethod = () => {
    setPaymentMethods([
      ...paymentMethods,
      { id: Date.now().toString(), name: "", enabled: true }
    ]);
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter(pm => pm.id !== id));
  };

  const updatePaymentMethod = (id: string, field: string, value: any) => {
    setPaymentMethods(paymentMethods.map(pm => 
      pm.id === id ? { ...pm, [field]: value } : pm
    ));
  };

  const addFAQ = () => {
    setFaq([...faq, { id: Date.now().toString(), question: "", answer: "" }]);
  };

  const removeFAQ = (id: string) => {
    setFaq(faq.filter(f => f.id !== id));
  };

  const updateFAQ = (id: string, field: string, value: string) => {
    setFaq(faq.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addPostSaleFAQ = () => {
    setPostSaleFaq([...postSaleFaq, { id: Date.now().toString(), question: "", answer: "" }]);
  };

  const removePostSaleFAQ = (id: string) => {
    setPostSaleFaq(postSaleFaq.filter(f => f.id !== id));
  };

  const updatePostSaleFAQ = (id: string, field: string, value: string) => {
    setPostSaleFaq(postSaleFaq.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addRule = () => {
    setRules([...rules, { id: Date.now().toString(), text: "" }]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, text: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, text } : r));
  };

  // Tipos de notificación disponibles
  const notificationTypes = [
    "Cancelación",
    "Confirmación de Compra",
    "Cambio de Datos",
    "Otra Compra",
    "Solicitud de Asesor",
    "Comprobante de Pago",
    "Garantía",
    "Error Open AI"
  ];

  const openNotificationModal = (notificationId?: string) => {
    if (notificationId) {
      // Editar notificación existente
      const notification = notifications.find(n => n.id === notificationId);
      if (notification) {
        setNotificationType(notification.type || "");
        // Si hay un número guardado, usarlo; si no, usar el país guardado para construir el número
        if (notification.phone) {
          setNotificationPhone(notification.phone);
        } else if (notification.country) {
          setNotificationPhone(`+${getCountryCallingCode(notification.country as Country)}`);
        } else {
          setNotificationPhone("");
        }
        setNotificationName(notification.name || "");
        setEditingNotificationId(notificationId);
      }
    } else {
      // Nueva notificación
      setNotificationType("");
      setNotificationPhone("");
      setNotificationName("");
      setEditingNotificationId(null);
    }
    setNotificationModalOpen(true);
  };

  const closeNotificationModal = () => {
    setNotificationModalOpen(false);
    setNotificationType("");
    setNotificationPhone("");
    setNotificationName("");
    setEditingNotificationId(null);
  };

  const saveNotification = () => {
    if (!notificationType || !notificationPhone || !notificationName) {
      if (typeof window !== 'undefined') {
        shopify.toast.show("❌ Por favor completa todos los campos");
      }
      return;
    }

    // Validar que no exista otra notificación con el mismo tipo (excepto la que se está editando)
    const existingNotification = notifications.find(n => 
      n.type === notificationType && n.id !== editingNotificationId
    );

    if (existingNotification) {
      if (typeof window !== 'undefined') {
        shopify.toast.show(`❌ Ya existe una notificación configurada para el tipo "${notificationType}"`);
      }
      return;
    }

    // Extraer el país del número telefónico
    const country = extractCountryFromPhone(notificationPhone);

    if (editingNotificationId) {
      // Actualizar notificación existente
      setNotifications(notifications.map(n => 
        n.id === editingNotificationId 
          ? { ...n, type: notificationType, country: country, phone: notificationPhone, name: notificationName }
          : n
      ));
    } else {
      // Agregar nueva notificación
      setNotifications([
        ...notifications,
        { 
          id: Date.now().toString(), 
          type: notificationType,
          country: country,
          phone: notificationPhone,
          name: notificationName
        }
      ]);
    }
    closeNotificationModal();
  };

  // Obtener los tipos de notificación ya configurados (excluyendo el que se está editando)
  const getConfiguredNotificationTypes = (): string[] => {
    return notifications
      .filter(n => n.id !== editingNotificationId)
      .map(n => n.type)
      .filter(Boolean) as string[];
  };

  const removeNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  // Manejar guardado
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append("intent", "save_ai_config");
    formData.append("agentName", agentName);
    formData.append("companyName", companyName);
    formData.append("companyDescription", companyDescription);
    formData.append("companyPolicies", companyPolicies);
    formData.append("paymentMethods", JSON.stringify(paymentMethods));
    formData.append("faq", JSON.stringify(faq));
    formData.append("postSaleFaq", JSON.stringify(postSaleFaq));
    formData.append("rules", JSON.stringify(rules));
    formData.append("notifications", JSON.stringify(notifications));

    aiFetcher.submit(formData, {
      method: "POST",
      action: "/app/configuration"
    });
  };

  return (
    <form onSubmit={handleSave}>
      {/* Información Básica */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          📋 Información Básica
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333', fontSize: '0.875rem' }}>
            👤 Nombre del agente IA
            <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="Ej: Andrés"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '0.875rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333', fontSize: '0.875rem' }}>
            🏢 Nombre de la empresa
            <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Ej: ClickShop®"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '0.875rem',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333', fontSize: '0.875rem' }}>
            📝 Descripción de la empresa
            <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
          </label>
          <textarea
            value={companyDescription}
            onChange={(e) => setCompanyDescription(e.target.value)}
            placeholder="Describe tu empresa..."
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* Métodos de Pago */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          💳 Métodos de pago
          <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
        </h2>

        {paymentMethods.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '8px',
            color: '#666',
            fontSize: '0.875rem'
          }}>
            No hay métodos de pago agregados
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {paymentMethods.map((pm) => (
              <div key={pm.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e1e3e5'
              }}>
                <input
                  type="text"
                  value={pm.name}
                  onChange={(e) => updatePaymentMethod(pm.id, 'name', e.target.value)}
                  placeholder="Nombre del método de pago"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '1rem'
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={pm.enabled}
                    onChange={(e) => updatePaymentMethod(pm.id, 'enabled', e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span style={{ color: '#666', fontSize: '0.875rem' }}>Activo</span>
                </label>
                <button
                  type="button"
                  onClick={() => removePaymentMethod(pm.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1.2rem'
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addPaymentMethod}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
        >
          ➕ Agregar
        </button>
      </div>

      {/* Políticas de la empresa */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          📜 Políticas de la empresa
          <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
        </h2>
        <textarea
          value={companyPolicies}
          onChange={(e) => setCompanyPolicies(e.target.value)}
          placeholder="politicas de la empresa"
          rows={6}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #ddd',
            fontSize: '1rem',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
      </div>

      {/* Preguntas Frecuentes */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          ❓ Preguntas Frecuentes
        </h2>

        {faq.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '8px',
            color: '#666',
            fontSize: '0.9375rem'
          }}>
            No hay preguntas frecuentes agregadas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {faq.map((item, index) => (
              <div key={item.id} style={{
                padding: '1.5rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e1e3e5'
              }}>
                <div                 style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#333', fontSize: '0.875rem' }}>
                  Pregunta #{index + 1}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updateFAQ(item.id, 'question', e.target.value)}
                    placeholder="pregunta respuesta"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '0.9375rem'
                    }}
                  />
                  <input
                    type="text"
                    value={item.answer}
                    onChange={(e) => updateFAQ(item.id, 'answer', e.target.value)}
                    placeholder="respuesta"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '0.9375rem'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeFAQ(item.id)}
                  style={{
                    marginTop: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1.2rem'
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addFAQ}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
        >
          ➕ Agregar
        </button>
      </div>

      {/* Preguntas Frecuentes Post Venta */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          🛍️ Preguntas Frecuentes Post Venta
        </h2>

        {postSaleFaq.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '8px',
            color: '#666',
            fontSize: '0.9375rem'
          }}>
            No hay preguntas post venta agregadas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {postSaleFaq.map((item, index) => (
              <div key={item.id} style={{
                padding: '1.5rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e1e3e5'
              }}>
                <div                 style={{ fontWeight: '600', marginBottom: '0.75rem', color: '#333', fontSize: '0.875rem' }}>
                  Pregunta #{index + 1}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => updatePostSaleFAQ(item.id, 'question', e.target.value)}
                    placeholder="pregunta post venta"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '0.9375rem'
                    }}
                  />
                  <input
                    type="text"
                    value={item.answer}
                    onChange={(e) => updatePostSaleFAQ(item.id, 'answer', e.target.value)}
                    placeholder="respuesta post venta"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '0.9375rem'
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePostSaleFAQ(item.id)}
                  style={{
                    marginTop: '0.5rem',
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1.2rem'
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addPostSaleFAQ}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
        >
          ➕ Agregar
        </button>
      </div>

      {/* Reglas */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          📋 Reglas
        </h2>

        {rules.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            background: '#f8f9fa',
            borderRadius: '8px',
            color: '#666',
            fontSize: '0.9375rem'
          }}>
            No hay reglas agregadas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {rules.map((rule, index) => (
              <div key={rule.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e1e3e5'
              }}>
                <div                 style={{ fontWeight: '600', color: '#333', minWidth: '80px', fontSize: '0.875rem' }}>
                  Regla #{index + 1}
                </div>
                <input
                  type="text"
                  value={rule.text}
                  onChange={(e) => updateRule(rule.id, e.target.value)}
                  placeholder="reglas"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #ddd',
                    fontSize: '1rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeRule(rule.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1.2rem'
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addRule}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginLeft: 'auto'
            }}
        >
          ➕ Agregar
        </button>
      </div>

      {/* Notificaciones */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '1px solid #e1e3e5'
      }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: '1rem', color: '#333', fontWeight: '600' }}>
          🔔 Notificaciones
          <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
        </h2>

        {notifications.length === 0 ? (
          <div style={{
            padding: '1rem',
            background: '#f8f9fa',
            borderRadius: '8px',
            color: '#666',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            No hay notificaciones agregadas
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            {notifications.map((notification) => (
              <div key={notification.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e1e3e5'
              }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ fontWeight: '600', color: '#333', fontSize: '0.875rem' }}>
                    {notification.type || 'Sin tipo'}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.8125rem' }}>
                    {notification.name || 'Sin nombre'} • {notification.phone || 'Sin número'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openNotificationModal(notification.id)}
                  style={{
                    background: 'none',
                    border: '1px solid #667eea',
                    color: '#667eea',
                    cursor: 'pointer',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  ✏️ Editar
                </button>
                <button
                  type="button"
                  onClick={() => removeNotification(notification.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc3545',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1.2rem'
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => openNotificationModal()}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginLeft: 'auto'
          }}
        >
          ➕ Agregar
        </button>
      </div>

      {/* Modal de Notificaciones */}
      {notificationModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeNotificationModal();
          }
        }}
        >
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '2rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e1e3e5'
            }}>
              <h2 style={{
                fontSize: '1.125rem',
                margin: 0,
                color: '#333',
                fontWeight: '600'
              }}>
                🔔 Agregar Notificación
              </h2>
              <button
                type="button"
                onClick={closeNotificationModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  lineHeight: 1,
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8f9fa'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                ✕
              </button>
            </div>

            {/* Formulario del Modal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Tipo de Notificación */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#333',
                  fontSize: '0.875rem'
                }}>
                  Tipo de notificación
                  <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
                </label>
                <select
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e1e3e5',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    background: '#fff',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e1e3e5'}
                >
                  <option value="">Selecciona una opción</option>
                  {(() => {
                    const configuredTypes = getConfiguredNotificationTypes();
                    return notificationTypes.map((type) => {
                      const isDisabled = configuredTypes.includes(type);
                      return (
                        <option 
                          key={type} 
                          value={type}
                          disabled={isDisabled}
                          style={{
                            backgroundColor: isDisabled ? '#f8f9fa' : '#fff',
                            color: isDisabled ? '#999' : '#333'
                          }}
                        >
                          {type} {isDisabled ? '✓ (Ya configurado)' : ''}
                        </option>
                      );
                    });
                  })()}
                </select>
                {getConfiguredNotificationTypes().length > 0 && !editingNotificationId && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    color: '#856404'
                  }}>
                    ℹ️ Los tipos de notificación ya configurados aparecen bloqueados. Solo puedes configurar un número por tipo.
                  </div>
                )}
              </div>

              {/* Número de Teléfono con selector de país */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#333',
                  fontSize: '0.875rem'
                }}>
                  Número
                  <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
                </label>
                <div style={{
                  '--PhoneInput-color--focus': '#667eea',
                  '--PhoneInputCountryIcon-opacity': '1',
                  '--PhoneInputCountrySelect-marginRight': '0',
                } as React.CSSProperties}>
                  <style>{`
                    .PhoneInput {
                      width: 100%;
                      border: 2px solid #e1e3e5;
                      border-radius: 8px;
                      transition: border-color 0.2s;
                    }
                    .PhoneInput:focus-within {
                      border-color: #667eea;
                    }
                    .PhoneInputInput {
                      padding: 0.75rem;
                      border: none;
                      outline: none;
                      font-size: 0.875rem;
                      font-family: inherit;
                      background: transparent;
                    }
                    .PhoneInputCountryIcon {
                      width: 1.5rem;
                      height: 1.5rem;
                      border-radius: 4px;
                    }
                    .PhoneInputCountrySelect {
                      padding: 0.75rem;
                      border-right: 1px solid #e1e3e5;
                      background: transparent;
                      border: none;
                      cursor: pointer;
                    }
                    .PhoneInputCountrySelectArrow {
                      opacity: 0.5;
                      margin-left: 0.5rem;
                    }
                  `}</style>
                  <PhoneInput
                    international
                    defaultCountry="CO"
                    value={notificationPhone}
                    onChange={(value) => setNotificationPhone(value || "")}
                    countries={availableCountries}
                    placeholder="Ingrese el número de teléfono"
                    className="PhoneInput"
                    numberInputProps={{
                      className: "PhoneInputInput"
                    }}
                  />
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: '500',
                  color: '#333',
                  fontSize: '0.875rem'
                }}>
                  Nombre
                  <span style={{ color: '#999', fontSize: '0.75rem', marginLeft: '0.5rem' }}>ℹ️</span>
                </label>
                <input
                  type="text"
                  value={notificationName}
                  onChange={(e) => setNotificationName(e.target.value)}
                  placeholder="Ingrese el nombre del recipiente"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '2px solid #e1e3e5',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#667eea'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e1e3e5'}
                />
              </div>
            </div>

            {/* Botones del Modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              marginTop: '2rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #e1e3e5'
            }}>
              <button
                type="button"
                onClick={closeNotificationModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f8f9fa',
                  color: '#666',
                  border: '1px solid #e1e3e5',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e9ecef'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f8f9fa'}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveNotification}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                }}
              >
                ✓ Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón Actualizar Información / Guardar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '2rem',
        borderTop: '1px solid #e1e3e5',
        marginTop: '2rem'
      }}>
        {hasUnsavedChanges && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '6px',
            fontSize: '0.875rem',
            color: '#856404',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span>⚠️</span>
            <span>Tienes cambios sin guardar</span>
          </div>
        )}
        {!hasUnsavedChanges && <div />}
        <button
          type="submit"
          disabled={aiFetcher.state === "submitting" || !hasUnsavedChanges}
          style={{
            padding: '1rem 2rem',
            background: aiFetcher.state === "submitting" || !hasUnsavedChanges
              ? '#ccc' 
              : 'linear-gradient(135deg, rgb(0, 32, 238) 0%, rgb(75, 81, 162) 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontWeight: '600',
            cursor: aiFetcher.state === "submitting" || !hasUnsavedChanges ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: aiFetcher.state === "submitting" || !hasUnsavedChanges
              ? 'none' 
              : '0 4px 12px rgba(0, 32, 238, 0.4)',
            opacity: aiFetcher.state === "submitting" || !hasUnsavedChanges ? 0.7 : 1,
            transition: 'all 0.2s'
          }}
        >
          {aiFetcher.state === "submitting" 
            ? "💾 Guardando..." 
            : hasUnsavedChanges 
              ? "🔄 Actualizar Información" 
              : "💾 Guardar"}
        </button>
      </div>
    </form>
  );
}
