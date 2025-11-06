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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Settings,
  Key,
  ShoppingCart,
  Package,
  Bot,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Store,
  Globe,
  Lock,
  Edit,
  X,
  Plus,
  Trash2,
  FileText,
  CreditCard,
  HelpCircle,
  ShoppingBag,
  List,
  Bell,
  Sparkles,
  BarChart3,
  Info
} from "lucide-react";

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            Configuración
          </h1>
          <p className="text-gray-600">Gestiona las integraciones y configuraciones de tu aplicación</p>
        </div>

        {/* Tabs Navigation Moderna */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              type="button"
              onClick={() => setActiveTab("ecomdrop")}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === "ecomdrop"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <Key className="h-4 w-4" />
              Ecomdrop
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dropi")}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === "dropi"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <Package className="h-4 w-4" />
              Dropi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === "ai"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <Bot className="h-4 w-4" />
              Asistente IA
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("status")}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === "status"
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <BarChart3 className="h-4 w-4" />
              Estado
            </button>
          </nav>
        </div>

        {/* Ecomdrop Tab */}
        {activeTab === "ecomdrop" && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Configuración de Integración
                </CardTitle>
                <CardDescription>
                  Conecte su cuenta de Ecomdrop IA y seleccione los flujos que desea utilizar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <apiKeyFetcher.Form method="post">
                  <input type="hidden" name="intent" value="save_api_key" />
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                        Clave API de Ecomdrop
                      </label>
                      <Input
                        id="apiKey"
                        name="apiKey"
                        type="password"
                        value={configuration?.ecomdropApiKey || ""}
                        placeholder="Ingrese su Clave API de Ecomdrop"
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">
                        Su clave API se almacena de forma segura y cifrada por tienda
                      </p>
                      {apiKeyFetcher.data?.error && (
                        <p className="text-xs text-red-600">{apiKeyFetcher.data.error}</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={apiKeyFetcher.state === "submitting"}
                      className="w-full sm:w-auto"
                    >
                      {apiKeyFetcher.state === "submitting" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {configuration?.ecomdropApiKey ? "Actualizar Conexión y Refrescar Flujos" : "Conectar Ecomdrop IA y Refrescar Flujos"}
                        </>
                      )}
                    </Button>
                  </div>
                </apiKeyFetcher.Form>
              </CardContent>
            </Card>

            {configuration?.ecomdropApiKey && flows.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Configuración de Flujos
                  </CardTitle>
                  <CardDescription>
                    Seleccione qué flujos de Ecomdrop deben activarse para estos eventos de Shopify
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <flowsFetcher.Form method="post">
                    <input type="hidden" name="intent" value="save_flows" />
                    <div className="space-y-6">
                      {/* Nuevo Pedido Flow */}
                      <div className="space-y-2">
                        <label htmlFor="nuevoPedidoFlowId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4" />
                          Nuevo Pedido
                        </label>
                        <Select
                          value={selectedNuevoPedido}
                          onValueChange={setSelectedNuevoPedido}
                        >
                          <SelectTrigger id="nuevoPedidoFlowId" name="nuevoPedidoFlowId">
                            <SelectValue placeholder="Seleccione un flujo" />
                          </SelectTrigger>
                          <SelectContent>
                            {flows.map((flow) => (
                              <SelectItem key={flow.id} value={flow.id}>
                                {flow.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Carrito Abandonado Flow */}
                      <div className="space-y-2">
                        <label htmlFor="carritoAbandonadoFlowId" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4" />
                          Carrito Abandonado
                        </label>
                        <Select
                          value={selectedCarritoAbandonado}
                          onValueChange={setSelectedCarritoAbandonado}
                        >
                          <SelectTrigger id="carritoAbandonadoFlowId" name="carritoAbandonadoFlowId">
                            <SelectValue placeholder="Seleccione un flujo" />
                          </SelectTrigger>
                          <SelectContent>
                            {flows.map((flow) => (
                              <SelectItem key={flow.id} value={flow.id}>
                                {flow.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button
                        type="submit"
                        disabled={flowsFetcher.state === "submitting"}
                        className="w-full sm:w-auto"
                      >
                        {flowsFetcher.state === "submitting" ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Guardando...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Guardar Configuración de Flujos
                          </>
                        )}
                      </Button>
                    </div>
                  </flowsFetcher.Form>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* AI Assistant Tab */}
        {activeTab === "ai" && (
          <div className="p-8">
            {!configuration?.ecomdropApiKey ? (
              <Card className="border-amber-200 bg-amber-50 mb-6">
                <CardContent className="pt-6 text-center">
                  <div className="text-6xl mb-4">🔑</div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    API Key de Ecomdrop Requerida
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Para configurar el Asistente IA, primero debes configurar tu Clave API de Ecomdrop.<br />
                    Esto es necesario para sincronizar la configuración con el sistema de Ecomdrop.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setActiveTab("ecomdrop")}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Ir a Configuración de Ecomdrop
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="mb-6 bg-gradient-to-r from-purple-600 to-purple-800 text-white border-0">
                  <CardContent className="pt-6">
                    <h1 className="text-xl font-semibold mb-2 flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      Configurar Asistente IA
                    </h1>
                    <p className="text-purple-100 text-sm">
                      Personaliza tu asistente de inteligencia artificial para brindar la mejor experiencia a tus clientes
                    </p>
                  </CardContent>
                </Card>

                <AIConfigurationForm aiConfiguration={aiConfiguration} shopify={shopify} />
              </>
            )}
          </div>
        )}

        {/* Dropi Tab */}
        {activeTab === "dropi" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Configuración de Dropi
              </CardTitle>
              <CardDescription>
                Configure su integración con Dropi para habilitar la sincronización de órdenes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!configuration?.ecomdropApiKey && (
                <Card className="mb-6 border-amber-200 bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm">
                        Primero debe configurar su clave API de Ecomdrop en la pestaña "Ecomdrop"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <dropiFetcher.Form method="post" action="/api/integrations/dropi/save">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="store_name" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Nombre de la Tienda
                    </label>
                    <Input
                      id="store_name"
                      name="store_name"
                      value={dropiStoreName}
                      onChange={(e) => setDropiStoreName(e.currentTarget.value)}
                      placeholder="Ingrese el nombre de su tienda"
                      required
                      className="w-full"
                    />
                    {dropiFetcher.data?.error && dropiFetcher.data.error.includes("tienda") && (
                      <p className="text-xs text-red-600">{dropiFetcher.data.error}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="country" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      País de Operación
                    </label>
                    <Select
                      value={dropiCountry}
                      onValueChange={setDropiCountry}
                    >
                      <SelectTrigger id="country" name="country">
                        <SelectValue placeholder="Seleccione un país" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Token Field with Edit Option */}
                  {configuration?.dropiToken && !editingDropiToken ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Token de Dropi
                      </label>
                      <div className="flex items-center gap-3 p-3 rounded-md border border-gray-200 bg-gray-50">
                        <span className="font-mono text-sm tracking-wider text-gray-600 select-none">
                          •••••••••••••••••••••••••••••••••
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setEditingDropiToken(true)}
                          className="ml-auto bg-gray-100 hover:bg-gray-200 text-gray-900"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar Token
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Token configurado y almacenado de forma segura
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label htmlFor="dropi_token" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Token de Dropi
                      </label>
                      <Input
                        id="dropi_token"
                        name="dropi_token"
                        type="password"
                        value={dropiToken}
                        onChange={(e) => setDropiToken(e.currentTarget.value)}
                        placeholder={configuration?.dropiToken ? "Ingrese el nuevo token" : "Ingrese su token de Dropi"}
                        required={!configuration?.dropiToken || editingDropiToken}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500">
                        Su token se almacena de forma segura y cifrada
                      </p>
                      {dropiFetcher.data?.error && dropiFetcher.data.error.includes("token") && (
                        <p className="text-xs text-red-600">{dropiFetcher.data.error}</p>
                      )}
                    </div>
                  )}
                  
                  {/* Only show required notice if editing existing token */}
                  {(configuration?.dropiToken && editingDropiToken) && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 text-blue-800">
                          <Info className="h-5 w-5" />
                          <p className="text-sm">
                            Debe ingresar un nuevo token para actualizar la configuración
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-3 items-center">
                    <Button
                      type="submit"
                      disabled={dropiFetcher.state === "submitting" || !configuration?.ecomdropApiKey}
                      className="flex-1 sm:flex-none"
                    >
                      {dropiFetcher.state === "submitting" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : dropiFetcher.data?.success ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Configuración guardada
                        </>
                      ) : configuration?.dropiToken && !editingDropiToken ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Guardar Cambios
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Guardar
                        </>
                      )}
                    </Button>
                    
                    {editingDropiToken && (
                      <Button
                        type="button"
                        onClick={() => {
                          setEditingDropiToken(false);
                          setDropiToken("");
                        }}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-900"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </dropiFetcher.Form>
            </CardContent>
          </Card>
        )}

        {/* Status Tab */}
        {activeTab === "status" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Estado de Configuración
                </CardTitle>
                <CardDescription>
                  Revisa el estado de todas tus integraciones y configuraciones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Ecomdrop API Key Status */}
                {configuration?.ecomdropApiKey ? (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-full bg-green-500 p-2 flex-shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Clave API de Ecomdrop configurada
                          </div>
                          <p className="text-sm text-gray-600">
                            Última actualización: {new Date(configuration.updatedAt).toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-gray-200 bg-gray-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-full bg-gray-400 p-2 flex-shrink-0">
                          <X className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">
                            Clave API de Ecomdrop no configurada
                          </div>
                          <p className="text-sm text-gray-600">
                            Configure su clave API en la pestaña "Ecomdrop"
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Dropi Status */}
                {configuration?.dropiStoreName ? (
                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-full bg-green-500 p-2 flex-shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Dropi configurado
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Store className="h-3 w-3" />
                              <span>Tienda: <strong>{configuration.dropiStoreName}</strong></span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Globe className="h-3 w-3" />
                              <span>País: <strong>{countries.find(c => c.code === configuration.dropiCountry)?.name || configuration.dropiCountry}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-gray-200 bg-gray-50">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-full bg-gray-400 p-2 flex-shrink-0">
                          <X className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">
                            Dropi no configurado
                          </div>
                          <p className="text-sm text-gray-600">
                            Configure Dropi en la pestaña "Dropi"
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Configuraciones de Flujos Activas */}
            {(configuration?.nuevoPedidoFlowId || configuration?.carritoAbandonadoFlowId) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Flujos Activos
                  </CardTitle>
                  <CardDescription>
                    Flujos de Ecomdrop configurados para eventos de Shopify
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {configuration.nuevoPedidoFlowId && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-blue-500 p-2">
                            <ShoppingCart className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-gray-600 mb-1">Nuevo Pedido</div>
                            <div className="font-medium text-gray-900">
                              {flows.find(f => f.id === configuration.nuevoPedidoFlowId)?.name || 'Flujo seleccionado'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {configuration.carritoAbandonadoFlowId && (
                    <Card className="border-purple-200 bg-purple-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-purple-500 p-2">
                            <ShoppingBag className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-gray-600 mb-1">Carrito Abandonado</div>
                            <div className="font-medium text-gray-900">
                              {flows.find(f => f.id === configuration.carritoAbandonadoFlowId)?.name || 'Flujo seleccionado'}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Próximos Pasos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Próximos Pasos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 list-disc list-inside text-sm text-gray-600">
                  <li>Configure su clave API de Ecomdrop para habilitar la integración</li>
                  <li>Opcionalmente configure Dropi para sincronización de órdenes</li>
                  <li>Seleccione flujos para activadores automáticos de eventos</li>
                  <li>Configure el Asistente IA para personalizar la experiencia del cliente</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
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
    <form onSubmit={handleSave} className="space-y-6">
      {/* Información Básica */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Información Básica
          </CardTitle>
          <CardDescription>
            Configura la información básica del asistente IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="agentName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Nombre del agente IA
              <Info className="h-3 w-3 text-gray-400" />
            </label>
            <Input
              id="agentName"
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ej: Andrés"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="companyName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Store className="h-4 w-4" />
              Nombre de la empresa
              <Info className="h-3 w-3 text-gray-400" />
            </label>
            <Input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ej: ClickShop®"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="companyDescription" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Descripción de la empresa
              <Info className="h-3 w-3 text-gray-400" />
            </label>
            <Textarea
              id="companyDescription"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="Describe tu empresa..."
              rows={4}
              className="w-full resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Métodos de Pago */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Métodos de Pago
            <Info className="h-4 w-4 text-gray-400" />
          </CardTitle>
          <CardDescription>
            Configura los métodos de pago que acepta tu tienda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No hay métodos de pago agregados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((pm) => (
                <Card key={pm.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Input
                        type="text"
                        value={pm.name}
                        onChange={(e) => updatePaymentMethod(pm.id, 'name', e.target.value)}
                        placeholder="Nombre del método de pago"
                        className="flex-1"
                      />
                      <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-md hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={pm.enabled}
                          onChange={(e) => updatePaymentMethod(pm.id, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-gray-700">Activo</span>
                      </label>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => removePaymentMethod(pm.id)}
                        className="bg-transparent hover:bg-red-50 text-red-600 hover:text-red-700 border-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={addPaymentMethod}
            className="w-full sm:w-auto ml-auto bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Método de Pago
          </Button>
        </CardContent>
      </Card>

      {/* Políticas de la empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Políticas de la Empresa
            <Info className="h-4 w-4 text-gray-400" />
          </CardTitle>
          <CardDescription>
            Define las políticas de tu empresa (devoluciones, garantías, términos, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={companyPolicies}
            onChange={(e) => setCompanyPolicies(e.target.value)}
            placeholder="Escribe las políticas de tu empresa..."
            rows={6}
            className="w-full resize-y"
          />
        </CardContent>
      </Card>

      {/* Preguntas Frecuentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="h-5 w-5" />
            Preguntas Frecuentes
          </CardTitle>
          <CardDescription>
            Agrega preguntas frecuentes y sus respuestas para el asistente IA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {faq.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <HelpCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No hay preguntas frecuentes agregadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {faq.map((item, index) => (
                <Card key={item.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-xs">
                        Pregunta #{index + 1}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => removeFAQ(item.id)}
                        className="bg-transparent hover:bg-red-50 text-red-600 hover:text-red-700 border-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">Pregunta</label>
                        <Input
                          type="text"
                          value={item.question}
                          onChange={(e) => updateFAQ(item.id, 'question', e.target.value)}
                          placeholder="Escribe la pregunta..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">Respuesta</label>
                        <Textarea
                          value={item.answer}
                          onChange={(e) => updateFAQ(item.id, 'answer', e.target.value)}
                          placeholder="Escribe la respuesta..."
                          rows={2}
                          className="w-full resize-y"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={addFAQ}
            className="w-full sm:w-auto ml-auto bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Pregunta Frecuente
          </Button>
        </CardContent>
      </Card>

      {/* Preguntas Frecuentes Post Venta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5" />
            Preguntas Frecuentes Post Venta
          </CardTitle>
          <CardDescription>
            Agrega preguntas frecuentes relacionadas con el servicio post venta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {postSaleFaq.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No hay preguntas post venta agregadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postSaleFaq.map((item, index) => (
                <Card key={item.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="outline" className="text-xs">
                        Pregunta Post Venta #{index + 1}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => removePostSaleFAQ(item.id)}
                        className="bg-transparent hover:bg-red-50 text-red-600 hover:text-red-700 border-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">Pregunta</label>
                        <Input
                          type="text"
                          value={item.question}
                          onChange={(e) => updatePostSaleFAQ(item.id, 'question', e.target.value)}
                          placeholder="Escribe la pregunta post venta..."
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-600">Respuesta</label>
                        <Textarea
                          value={item.answer}
                          onChange={(e) => updatePostSaleFAQ(item.id, 'answer', e.target.value)}
                          placeholder="Escribe la respuesta post venta..."
                          rows={2}
                          className="w-full resize-y"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={addPostSaleFAQ}
            className="w-full sm:w-auto ml-auto bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Pregunta Post Venta
          </Button>
        </CardContent>
      </Card>

      {/* Reglas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <List className="h-5 w-5" />
            Reglas
          </CardTitle>
          <CardDescription>
            Define reglas específicas que el asistente IA debe seguir
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length === 0 ? (
            <div className="py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <List className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">No hay reglas agregadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <Card key={rule.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="min-w-[80px] text-xs">
                        Regla #{index + 1}
                      </Badge>
                      <Input
                        type="text"
                        value={rule.text}
                        onChange={(e) => updateRule(rule.id, e.target.value)}
                        placeholder="Escribe la regla..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => removeRule(rule.id)}
                        className="bg-transparent hover:bg-red-50 text-red-600 hover:text-red-700 border-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={addRule}
            className="w-full sm:w-auto ml-auto bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Regla
          </Button>
        </CardContent>
      </Card>

      {/* Notificaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5" />
            Notificaciones
            <Info className="h-4 w-4 text-gray-400" />
          </CardTitle>
          <CardDescription>
            Configura números de teléfono para recibir notificaciones por tipo de evento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifications.length === 0 ? (
            <div className="py-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <Bell className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No hay notificaciones agregadas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Card key={notification.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-sm mb-1">
                          {notification.type || 'Sin tipo'}
                        </div>
                        <div className="text-xs text-gray-600 flex items-center gap-2">
                          <span>{notification.name || 'Sin nombre'}</span>
                          <span>•</span>
                          <span>{notification.phone || 'Sin número'}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openNotificationModal(notification.id)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-900"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        onClick={() => removeNotification(notification.id)}
                        className="bg-transparent hover:bg-red-50 text-red-600 hover:text-red-700 border-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button
            type="button"
            onClick={() => openNotificationModal()}
            className="w-full sm:w-auto ml-auto bg-gray-100 hover:bg-gray-200 text-gray-900"
          >
            <Plus className="h-4 w-4 mr-2" />
            Agregar Notificación
          </Button>
        </CardContent>
      </Card>

      {/* Modal de Notificaciones */}
      <Dialog open={notificationModalOpen} onOpenChange={(open) => {
        if (!open) closeNotificationModal();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {editingNotificationId ? 'Editar Notificación' : 'Agregar Notificación'}
            </DialogTitle>
            <DialogDescription>
              Configura los datos de contacto para recibir notificaciones
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo de Notificación */}
            <div className="space-y-2">
              <label htmlFor="notificationType" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Tipo de notificación
                <Info className="h-3 w-3 text-gray-400" />
              </label>
              <Select
                value={notificationType}
                onValueChange={setNotificationType}
              >
                <SelectTrigger id="notificationType">
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const configuredTypes = getConfiguredNotificationTypes();
                    return notificationTypes.map((type) => {
                      const isDisabled = configuredTypes.includes(type);
                      return (
                        <SelectItem 
                          key={type} 
                          value={type}
                          disabled={isDisabled}
                          className={isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                        >
                          {type} {isDisabled && <span className="ml-2 text-xs">(Ya configurado)</span>}
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
              {getConfiguredNotificationTypes().length > 0 && !editingNotificationId && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-2 text-amber-800">
                      <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <p className="text-xs">
                        Los tipos de notificación ya configurados aparecen bloqueados. Solo puedes configurar un número por tipo.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Número de Teléfono con selector de país */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Número de Teléfono
                <Info className="h-3 w-3 text-gray-400" />
              </label>
              <div className="[--PhoneInput-color--focus:#667eea] [--PhoneInputCountryIcon-opacity:1] [--PhoneInputCountrySelect-marginRight:0]">
                <style>{`
                  .PhoneInput {
                    width: 100%;
                    border: 2px solid #e1e3e5;
                    border-radius: 0.5rem;
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
                    border-radius: 0.25rem;
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
            <div className="space-y-2">
              <label htmlFor="notificationName" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                Nombre del Recipiente
                <Info className="h-3 w-3 text-gray-400" />
              </label>
              <Input
                id="notificationName"
                type="text"
                value={notificationName}
                onChange={(e) => setNotificationName(e.target.value)}
                placeholder="Ingrese el nombre del recipiente"
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={closeNotificationModal}
              className="bg-gray-100 hover:bg-gray-200 text-gray-900"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={saveNotification}
              className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Botón Actualizar Información / Guardar */}
      <Card className="border-t-2">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {hasUnsavedChanges ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Tienes cambios sin guardar</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-sm text-gray-500">No hay cambios pendientes</div>
            )}
            <Button
              type="submit"
              disabled={aiFetcher.state === "submitting" || !hasUnsavedChanges}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {aiFetcher.state === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar Información
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
