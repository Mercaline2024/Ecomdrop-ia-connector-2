import { useEffect, useState, useRef } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { LoadingModal } from "../components/modals/LoadingModal";
import { SuccessModal } from "../components/modals/SuccessModal";
import { Button as ShadcnButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { 
  Search, 
  X, 
  Package, 
  Link2, 
  Eye, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  Warehouse,
  DollarSign,
  Filter,
  RefreshCw,
  Trash2,
  Settings
} from "lucide-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Get shop configuration
  const configuration = session?.shop 
    ? await db.shopConfiguration.findUnique({
        where: { shop: session.shop }
      })
    : null;

  // Shopify products are fetched on-demand when needed in the modal
  // No longer fetching all products upfront

  // Get product associations
  let associations: any[] = [];
  if (session?.shop) {
    try {
      associations = await db.productAssociation.findMany({
        where: { shop: session.shop },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error("Error fetching associations:", error);
    }
  }

  return {
    configuration,
    associations,
  };
};

export default function ProductsPage() {
  const { configuration, associations: initialAssociations } = useLoaderData<typeof loader>();
  const dropiProductsFetcher = useFetcher();
  const importFetcher = useFetcher();
  const shopifyProductVariantsFetcher = useFetcher();
  const shopifyProductsFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const shopify = useAppBridge();
  
  // Estado para productos de Shopify (cargados dinámicamente cuando se abre el modal)
  const [shopifyProducts, setShopifyProducts] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<"productos" | "sincronizada">("productos");
  const [dropiProducts, setDropiProducts] = useState<any[]>([]);
  const [selectedShopifyProduct, setSelectedShopifyProduct] = useState<string>("");
  const [selectedDropiProduct, setSelectedDropiProduct] = useState<string>("");
  const [searchKeywords, setSearchKeywords] = useState<string>("");
  const [privatedProduct, setPrivatedProduct] = useState<boolean>(false); // Por defecto false (muestra favoritos)
  const [currentPage, setCurrentPage] = useState<number>(1); // Página actual (por defecto 1)
  const [totalProducts, setTotalProducts] = useState<number>(0); // Total de productos
  const [associations, setAssociations] = useState<any[]>(initialAssociations);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProduct, setModalProduct] = useState<any>(null);
  const [selectedShopifyProductVariants, setSelectedShopifyProductVariants] = useState<any[]>([]);
  const [dropiVariations, setDropiVariations] = useState<any[]>([]);
  const [variantAssociations, setVariantAssociations] = useState<Record<string, string>>({}); // Map: dropiVariationId -> shopifyVariantId
  const [saveDropiName, setSaveDropiName] = useState(true);
  const [saveDropiDescription, setSaveDropiDescription] = useState(true);
  const [useSuggestedBarcode, setUseSuggestedBarcode] = useState(false);
  const [saveDropiImages, setSaveDropiImages] = useState(true);
  
  // Estados para modales de loading y success
  const [loadingModalOpen, setLoadingModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  
  // Referencias para prevenir procesamiento duplicado
  const processedImportRef = useRef<string | null>(null);
  const processedDeleteRef = useRef<string | null>(null);
  const shopifyProductsLoadedRef = useRef<boolean>(false); // Para evitar recargar productos de Shopify

  // Load Dropi products on mount
  useEffect(() => {
    if (configuration?.dropiToken) {
      loadDropiProducts();
    }
  }, [configuration?.dropiToken]);

  // Handle Dropi products response
  useEffect(() => {
    console.log("🔍 Dropi products fetcher data:", dropiProductsFetcher.data);
    if (dropiProductsFetcher.data?.products) {
      console.log("📦 Setting products:", dropiProductsFetcher.data.products.length);
      setDropiProducts(dropiProductsFetcher.data.products);
      if (dropiProductsFetcher.data.total !== undefined) {
        console.log("📊 Setting total products:", dropiProductsFetcher.data.total);
        setTotalProducts(dropiProductsFetcher.data.total);
      } else {
        // Si no hay total, usar el número de productos cargados como estimación
        console.log("⚠️ No total provided, using products length");
        setTotalProducts(dropiProductsFetcher.data.products.length);
      }
    } else if (dropiProductsFetcher.data?.error) {
      console.error("❌ Dropi error:", dropiProductsFetcher.data.error);
    }
  }, [dropiProductsFetcher.data]);

  const loadDropiProducts = (keywords: string = "", page: number = currentPage) => {
    const pageSize = 10;
    const startData = (page - 1) * pageSize; // Calcular startData según la página
    
    const params = new URLSearchParams();
    params.append("pageSize", pageSize.toString());
    params.append("startData", startData.toString());
    if (keywords) {
      // Cuando hay búsqueda, solo enviar keywords (no favorite ni privated_product)
      params.append("keywords", keywords);
      params.append("hasSearch", "true"); // Flag para indicar que hay búsqueda
    } else {
      // Cuando NO hay búsqueda:
      // Si privatedProduct está activado: solo privated_product: true
      // Si privatedProduct está desactivado: solo favorite: true (por defecto)
      if (privatedProduct) {
        params.append("privated_product", "true");
      } else {
        params.append("favorite", "true");
      }
    }
    dropiProductsFetcher.load(`/api/dropi/products?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadDropiProducts(searchKeywords, newPage);
  };

  const totalPages = totalProducts > 0 ? Math.ceil(totalProducts / 10) : 1;

  // Debug paginador
  useEffect(() => {
    console.log("📄 Paginador - totalProducts:", totalProducts, "totalPages:", totalPages, "currentPage:", currentPage, "products loaded:", dropiProducts.length);
  }, [totalProducts, totalPages, currentPage, dropiProducts.length]);

  const handleAssociate = async () => {
    if (typeof window === 'undefined') return;
    
    if (!selectedShopifyProduct || !selectedDropiProduct) {
      shopify.toast.show("Seleccione ambos productos para asociarlos");
      return;
    }

    shopify.toast.show("Funcionalidad de asociación en desarrollo");
  };

  // Cargar productos de Shopify cuando se abre el modal (solo una vez por sesión)
  useEffect(() => {
    // Solo cargar si:
    // 1. El modal está abierto
    // 2. No hemos cargado productos antes (usando ref para persistir entre aperturas/cierres)
    // 3. No hay productos en el estado actual (doble verificación)
    // 4. El fetcher está en estado idle (no está cargando)
    // 5. El fetcher no tiene datos ya cargados
    if (
      modalOpen && 
      !shopifyProductsLoadedRef.current && 
      shopifyProducts.length === 0 && 
      shopifyProductsFetcher.state === "idle" &&
      !shopifyProductsFetcher.data // Verificar que no hay datos ya cargados
    ) {
      shopifyProductsLoadedRef.current = true; // Marcar como cargado ANTES de hacer la petición
      shopifyProductsFetcher.load("/api/shopify/products");
    }
  }, [modalOpen]); // Solo depende de modalOpen, no de shopifyProducts.length para evitar recargas

  // Manejar respuesta de productos de Shopify
  useEffect(() => {
    if (shopifyProductsFetcher.data?.success && shopifyProductsFetcher.data.products) {
      setShopifyProducts(shopifyProductsFetcher.data.products);
      // Los productos ya están cargados, no necesitamos recargarlos
    }
  }, [shopifyProductsFetcher.data]);

  // Abrir modal de importación
  const openImportModal = (product: any) => {
    setModalProduct(product);
    setModalOpen(true);
    setSelectedShopifyProduct("");
    setSelectedShopifyProductVariants([]);
    setVariantAssociations({});
    
    // Extraer variaciones del producto Dropi
    const variations = product.variations || product.product_variations || [];
    setDropiVariations(variations);
    
    // Resetear otros campos
    setSaveDropiName(true);
    setSaveDropiDescription(true);
    setUseSuggestedBarcode(false);
    setSaveDropiImages(true);
  };

  // Cargar variantes de Shopify cuando se selecciona un producto
  useEffect(() => {
    if (selectedShopifyProduct && modalOpen) {
      shopifyProductVariantsFetcher.load(`/api/shopify/product/variants?productId=${encodeURIComponent(selectedShopifyProduct)}`);
    }
  }, [selectedShopifyProduct, modalOpen]);

  // Manejar respuesta de variantes de Shopify
  useEffect(() => {
    if (shopifyProductVariantsFetcher.data?.success) {
      setSelectedShopifyProductVariants(shopifyProductVariantsFetcher.data.variants || []);
      // Resetear asociaciones cuando cambian las variantes
      setVariantAssociations({});
    }
  }, [shopifyProductVariantsFetcher.data]);

  // Manejar eliminación de asociaciones
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Solo procesar si el fetcher está en estado "idle" (ha completado) y tiene datos
    if (deleteFetcher.state !== 'idle' || !deleteFetcher.data) return;
    
    // Crear un identificador único para esta respuesta
    const responseId = JSON.stringify(deleteFetcher.data);
    
    // Si ya procesamos esta respuesta, ignorar
    if (processedDeleteRef.current === responseId) return;
    
    // Marcar como procesada
    processedDeleteRef.current = responseId;
    
    if (deleteFetcher.data.success) {
      shopify.toast.show(deleteFetcher.data.message || "Asociación eliminada exitosamente");
      // Remover la asociación de la lista SIN recargar el loader
      // Esto evita que se recarguen los productos de Dropi
      const associationId = deleteFetcher.data.associationId;
      if (associationId) {
        setAssociations(prev => prev.filter((assoc: any) => assoc.id !== associationId));
      }
      // NO usar revalidator.revalidate() aquí porque recarga el loader
      // y causa que se recarguen los productos de Dropi innecesariamente
      // La asociación ya se eliminó localmente arriba
    } else if (deleteFetcher.data.error) {
      shopify.toast.show(`Error: ${deleteFetcher.data.error}`);
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  // Función para eliminar una asociación
  const handleDeleteAssociation = (associationId: string) => {
    if (typeof window === 'undefined') return;
    
    if (!confirm("¿Estás seguro de que deseas eliminar esta asociación?")) {
      return;
    }

    const formData = new FormData();
    formData.append("associationId", associationId);

    deleteFetcher.submit(formData, {
      method: "POST",
      action: "/api/products/association/delete"
    });
  };

  // Manejar sincronización
  const handleImport = () => {
    if (typeof window === 'undefined') return;
    if (!modalProduct) return;
    
    if (!selectedShopifyProduct) {
      shopify.toast.show("Debe seleccionar un producto de Shopify para sincronizar");
      return;
    }

    // Preparar asociaciones de variantes (Dropi -> Shopify)
    const variantMappings = Object.entries(variantAssociations).map(([dropiVarId, shopifyVarId]) => ({
      dropiVariationId: dropiVarId,
      shopifyVariantId: shopifyVarId
    }));

    const formData = new FormData();
    formData.append("dropiProductId", modalProduct.id.toString());
    formData.append("dropiProductData", JSON.stringify(modalProduct));
    formData.append("importType", "link");
    formData.append("shopifyProductId", selectedShopifyProduct);
    formData.append("dropiVariations", JSON.stringify(dropiVariations));
    formData.append("variantAssociations", JSON.stringify(variantMappings));
    formData.append("saveDropiName", saveDropiName.toString());
    formData.append("saveDropiDescription", saveDropiDescription.toString());
    formData.append("useSuggestedBarcode", useSuggestedBarcode.toString());
    formData.append("saveDropiImages", saveDropiImages.toString());

    // Cerrar el modal de configuración y mostrar el modal de loading
    setModalOpen(false);
    setLoadingModalOpen(true);

    importFetcher.submit(formData, {
      method: "POST",
      action: "/api/products/import"
    });
  };

  // Manejar respuesta de importación
  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;
    
    // Solo procesar si el fetcher está en estado "idle" (ha completado) y tiene datos
    if (importFetcher.state !== 'idle' || !importFetcher.data) return;
    
    // Crear un identificador único para esta respuesta
    const responseId = JSON.stringify(importFetcher.data);
    
    // Si ya procesamos esta respuesta, ignorar
    if (processedImportRef.current === responseId) return;
    
    // Marcar como procesada
    processedImportRef.current = responseId;
    
    if (importFetcher.data.success) {
      // Cerrar el modal de loading y mostrar el modal de éxito
      setLoadingModalOpen(false);
      
      // Actualizar asociaciones localmente ANTES de mostrar el modal de éxito
      // Esto evita que se recarguen los productos de Dropi
      if (importFetcher.data.association) {
        setAssociations(prev => [importFetcher.data.association, ...prev]);
      }
      
      // Limpiar el estado del modal de configuración
      setModalProduct(null);
      setSelectedShopifyProduct("");
      setSelectedShopifyProductVariants([]);
      setVariantAssociations({});
      
      // Mostrar modal de éxito
      setSuccessModalOpen(true);
      
      // NO usar revalidator.revalidate() aquí porque recarga el loader
      // y causa que se recarguen los productos de Dropi innecesariamente
      // Las asociaciones ya se actualizaron localmente arriba
      // Los productos de Shopify se mantienen cargados para la próxima vez que se abra el modal
    } else if (importFetcher.data.error) {
      // Cerrar el modal de loading si hay error
      setLoadingModalOpen(false);
      shopify.toast.show(`Error: ${importFetcher.data.error}`);
    }
  }, [importFetcher.state, importFetcher.data]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Productos</h1>
            <p className="text-gray-600">Gestiona y sincroniza tus productos de Dropi con Shopify</p>
          </div>

          {/* Tabs Navigation Moderna */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveTab("productos")}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === "productos"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <Package className="h-4 w-4" />
                Productos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sincronizada")}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === "sincronizada"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <Link2 className="h-4 w-4" />
                Sincronizados
                {associations.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {associations.length}
                  </Badge>
                )}
              </button>
            </nav>
          </div>

        {activeTab === "productos" && (
          <>
            {!configuration?.dropiToken && (
              <Card className="mb-6 border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-900">
                    <AlertCircle className="h-5 w-5" />
                    Configuración Requerida
                  </CardTitle>
                  <CardDescription className="text-amber-800">
                    Primero debe configurar Dropi en la pestaña "Configuración" para poder gestionar productos.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            {configuration?.dropiToken && (
              <>
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5" />
                      Buscar Productos de Dropi
                    </CardTitle>
                    <CardDescription>
                      Conecte productos de Dropi con productos de Shopify para sincronización automática
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          id="search_dropi"
                          type="text"
                          value={searchKeywords}
                          onChange={(e) => {
                            const value = e.currentTarget.value;
                            setSearchKeywords(value);
                            if (!value) {
                              setCurrentPage(1);
                              loadDropiProducts("", 1);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setCurrentPage(1);
                              loadDropiProducts(searchKeywords, 1);
                            }
                          }}
                          placeholder="Ingrese ID producto o nombre del producto"
                          className="pl-10"
                        />
                      </div>
                      <ShadcnButton
                        onClick={() => {
                          setCurrentPage(1);
                          loadDropiProducts(searchKeywords, 1);
                        }}
                        disabled={dropiProductsFetcher.state === "loading"}
                      >
                        {dropiProductsFetcher.state === "loading" ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Buscando...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Buscar
                          </>
                        )}
                      </ShadcnButton>
                      {searchKeywords && (
                        <ShadcnButton
                          variant="outline"
                          onClick={() => {
                            setSearchKeywords("");
                            setCurrentPage(1);
                            loadDropiProducts("", 1);
                          }}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Limpiar
                        </ShadcnButton>
                      )}
                    </div>
                    
                    {/* Filtros */}
                    {!searchKeywords && (
                      <div className="flex items-center gap-4 flex-wrap">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privatedProduct}
                            onChange={(e) => {
                              setPrivatedProduct(e.target.checked);
                              setCurrentPage(1);
                              loadDropiProducts("", 1);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            <Filter className="h-4 w-4" />
                            Productos Privados
                          </span>
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {privatedProduct 
                            ? 'Mostrando productos privados' 
                            : 'Mostrando productos favoritos'}
                        </Badge>
                      </div>
                    )}
                    
                    {dropiProducts.length > 0 && (
                      <div className="mt-4">
                        <Badge variant="secondary" className="text-xs">
                          {totalProducts > 0 ? `${totalProducts} producto(s) total(es)` : `${dropiProducts.length} producto(s)`} {searchKeywords ? 'encontrado(s)' : 'cargado(s)'}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

            {dropiProducts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay productos disponibles
                  </h3>
                  <p className="text-sm text-gray-500 text-center max-w-md">
                    {dropiProductsFetcher.state === "loading" 
                      ? "Cargando productos..." 
                      : "Busca productos de Dropi o ajusta los filtros para ver tus productos"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {/* Overlay de carga */}
                  {dropiProductsFetcher.state === "loading" && dropiProducts.length > 0 && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg gap-4">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <p className="text-primary font-semibold">Cargando productos...</p>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[800px]">
                      <thead>
                        <tr className="bg-gray-50 border-b-2 border-gray-200">
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">
                            ID/SKU
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">
                            NOMBRE
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">
                            PRECIO
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">
                            STOCK
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">
                            BODEGA
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700 text-sm">
                            ACCIONES
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {dropiProducts.map((product: any, index: number) => (
                          <tr 
                            key={product.id}
                            className={`
                              border-b border-gray-100 transition-colors cursor-pointer
                              ${selectedDropiProduct === product.id 
                                ? 'bg-blue-50 hover:bg-blue-100' 
                                : index % 2 === 0 
                                ? 'bg-white hover:bg-gray-50' 
                                : 'bg-gray-50/50 hover:bg-gray-100'
                              }
                            `}
                            onClick={() => setSelectedDropiProduct(product.id)}
                          >
                            <td className="px-4 py-4 align-middle">
                              <div className="flex items-center gap-3">
                                {product.gallery && product.gallery.length > 0 ? (
                                  <img 
                                    src={`https://d39ru7awumhhs2.cloudfront.net/${product.gallery[0].urlS3}`} 
                                    alt={product.name}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-600 font-semibold">
                                    {product.name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-gray-900 text-sm">
                                    {product.id}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {product.sku || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <div className="font-medium text-gray-900 text-sm">
                                {product.name || product.title}
                              </div>
                              {product.categories && product.categories.length > 0 && (
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
                                  {product.categories.slice(0, 2).map((cat: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {cat.name}
                                    </Badge>
                                  ))}
                                  {product.categories.length > 2 && (
                                    <span className="text-gray-400">+{product.categories.length - 2}</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <div className="flex flex-col gap-1.5">
                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 w-fit">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  ${parseFloat(product.sale_price || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </Badge>
                                {product.suggested_price && (
                                  <Badge variant="outline" className="w-fit text-xs">
                                    Sugerido: ${parseFloat(product.suggested_price).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <Badge 
                                variant={product.private_product_inventories && product.private_product_inventories.length > 0 ? "default" : "secondary"}
                                className="w-fit"
                              >
                                {product.private_product_inventories && product.private_product_inventories.length > 0 
                                  ? product.private_product_inventories.reduce((sum: number, inv: any) => sum + parseFloat(inv.stock || 0), 0).toLocaleString('es-CO')
                                  : product.warehouse_product && product.warehouse_product.length > 0
                                  ? product.warehouse_product.reduce((sum: number, wp: any) => sum + (wp.stock || 0), 0).toLocaleString('es-CO')
                                  : '0'}
                              </Badge>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              {product.warehouse_product && product.warehouse_product.length > 0 ? (
                                <div className="flex items-center gap-1 text-sm text-gray-700">
                                  <Warehouse className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium">
                                    {product.warehouse_product.map((wp: any) => wp.warehouse?.name || 'N/A').join(', ')}
                                  </span>
                                </div>
                              ) : product.private_product_inventories && product.private_product_inventories.length > 0 ? (
                                <div className="text-sm text-gray-600">
                                  {product.private_product_inventories.map((inv: any) => inv.user?.name || 'N/A').join(', ')}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-middle text-center">
                              <div className="flex items-center justify-center gap-2">
                                <ShadcnButton
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImportModal(product);
                                  }}
                                  className="h-8 w-8"
                                  title="Asociar producto"
                                >
                                  <Eye className="h-4 w-4" />
                                </ShadcnButton>
                                <input
                                  type="checkbox"
                                  checked={selectedDropiProduct === product.id}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setSelectedDropiProduct(e.target.checked ? product.id : "");
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Controles de Paginación */}
            {dropiProducts.length > 0 && (
              <Card className="mt-6">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <ShadcnButton
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1 || dropiProductsFetcher.state === "loading"}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </ShadcnButton>
                    <span className="text-sm text-gray-600 px-4">
                      Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{Math.ceil(totalProducts / 10)}</span>
                    </span>
                    <ShadcnButton
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage * 10 >= totalProducts || dropiProductsFetcher.state === "loading"}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </ShadcnButton>
                  </div>
                  <div className="text-xs text-gray-500">
                    Mostrando {((currentPage - 1) * 10) + 1} - {Math.min(currentPage * 10, totalProducts)} de {totalProducts} productos
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === "sincronizada" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Productos Sincronizados
              </CardTitle>
              <CardDescription>
                Productos de Dropi asociados con productos de Shopify
              </CardDescription>
            </CardHeader>
            <CardContent>
              {associations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Link2 className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No hay productos sincronizados
                  </h3>
                  <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                    Use el botón <Eye className="h-4 w-4 inline mx-1" /> en un producto de Dropi para importar o vincular productos.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">Producto Dropi</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700 text-sm">Producto Shopify</th>
                        <th className="px-4 py-3 text-center font-semibold text-gray-700 text-sm">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {associations.map((assoc: any) => (
                        <tr key={assoc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900 text-sm">{assoc.dropiProductName}</div>
                            <div className="text-xs text-gray-500 mt-1">ID Dropi: {assoc.dropiProductId}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900 text-sm">{assoc.shopifyProductTitle}</div>
                            <div className="text-xs text-gray-500 mt-1">ID Shopify: {assoc.shopifyProductId}</div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <ShadcnButton
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteAssociation(assoc.id)}
                              disabled={deleteFetcher.state === "submitting"}
                            >
                              {deleteFetcher.state === "submitting" ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Eliminando...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </>
                              )}
                            </ShadcnButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </div>

      {/* Modales de Loading y Success */}
      <LoadingModal 
        open={loadingModalOpen}
        title="Importando producto"
        description="Por favor espere..."
      />
      <SuccessModal
        open={successModalOpen}
        onClose={() => {
          setSuccessModalOpen(false);
        }}
        title="Listo!"
        description="Producto importado con éxito"
        buttonText="Cool"
      />

      {/* Modal de Importación */}
      {modalOpen && modalProduct && (
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
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem',
              borderBottom: '1px solid #e1e3e5'
            }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#333' }}>
                Importar producto
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0.5rem',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '14px' }}>
                Sincroniza el producto Dropi con un producto existente en tu tienda Shopify para que tus órdenes se vinculen correctamente.
              </p>

              {/* Select Existing Product */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
                  Selecciona el producto de tu tienda Shopify
                </label>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  El producto seleccionado se sincronizará con el producto Dropi
                </p>
                <select
                  value={selectedShopifyProduct}
                  onChange={(e) => setSelectedShopifyProduct(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Haz click aquí para seleccionar un producto...</option>
                  {shopifyProductsFetcher.state === "loading" ? (
                    <option value="" disabled>Cargando productos...</option>
                  ) : shopifyProducts.length === 0 ? (
                    <option value="" disabled>No hay productos disponibles</option>
                  ) : (
                    shopifyProducts.map((product: any) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))
                  )}
                </select>
                
                {/* Loading indicator cuando se cargan variantes */}
                {shopifyProductVariantsFetcher.state === "loading" && (
                  <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '14px' }}>
                    🔄 Cargando variantes del producto...
                  </div>
                )}
              </div>

              {/* Variant Associations - Asociar variantes de Dropi con Shopify */}
              {selectedShopifyProduct && dropiVariations.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600' }}>Asociar Variantes</h3>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                    Asocia las variantes del producto Dropi con las variantes del producto Shopify seleccionado
                  </p>

                  {selectedShopifyProductVariants.length > 0 ? (
                    <div style={{
                      border: '1px solid #e1e3e5',
                      borderRadius: '4px',
                      padding: '12px',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e1e3e5' }}>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Variante Dropi</th>
                            <th style={{ padding: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Asociar con Variante Shopify</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dropiVariations.map((dropiVar: any, idx: number) => {
                            const dropiVarId = dropiVar.id?.toString() || `dropi-${idx}`;
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                  <div style={{ fontWeight: '500', fontSize: '14px' }}>
                                    {dropiVar.color || dropiVar.option1 || dropiVar.name || `Variante ${idx + 1}`}
                                    {dropiVar.size || dropiVar.option2 ? ` - ${dropiVar.size || dropiVar.option2}` : ''}
                                  </div>
                                  {dropiVar.sku && (
                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                      SKU: {dropiVar.sku}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '12px', verticalAlign: 'middle' }}>
                                  <select
                                    value={variantAssociations[dropiVarId] || ""}
                                    onChange={(e) => {
                                      setVariantAssociations(prev => ({
                                        ...prev,
                                        [dropiVarId]: e.target.value
                                      }));
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px',
                                      border: '1px solid #ccc',
                                      borderRadius: '4px',
                                      fontSize: '14px'
                                    }}
                                  >
                                    <option value="">-- Seleccione una variante --</option>
                                    {selectedShopifyProductVariants.map((shopifyVar: any) => (
                                      <option key={shopifyVar.id} value={shopifyVar.id}>
                                        {shopifyVar.title} 
                                        {shopifyVar.sku ? ` (SKU: ${shopifyVar.sku})` : ''}
                                        {shopifyVar.price ? ` - $${parseFloat(shopifyVar.price).toFixed(2)}` : ''}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : shopifyProductVariantsFetcher.state !== "loading" ? (
                    <div style={{ 
                      padding: '12px', 
                      background: '#fff3cd', 
                      border: '1px solid #ffc107',
                      borderRadius: '4px',
                      color: '#856404',
                      fontSize: '14px'
                    }}>
                      ⚠️ El producto seleccionado no tiene variantes. Solo podrás sincronizar el producto principal.
                    </div>
                  ) : null}
                </div>
              )}

              {/* Options */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={saveDropiName}
                    onChange={(e) => setSaveDropiName(e.target.checked)}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Guardar nombre dropi</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Si desmarca esta opción, el nombre del producto no se guardará. Si el SKU no existe, esta opción se ignorará.
                    </div>
                    {saveDropiName && (
                      <input
                        type="text"
                        value={modalProduct.name || modalProduct.title || ''}
                        readOnly
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginTop: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '14px'
                        }}
                      />
                    )}
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={saveDropiDescription}
                    onChange={(e) => setSaveDropiDescription(e.target.checked)}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Guardar descripción dropi</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Si desmarca esta opción, la descripción del producto no se guardará.
                    </div>
                    {saveDropiDescription && modalProduct.description && (
                      <textarea
                        value={modalProduct.description}
                        readOnly
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginTop: '8px',
                          border: '1px solid #ccc',
                          borderRadius: '4px',
                          fontSize: '14px',
                          minHeight: '80px',
                          resize: 'vertical'
                        }}
                      />
                    )}
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '1rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={useSuggestedBarcode}
                    onChange={(e) => setUseSuggestedBarcode(e.target.checked)}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Establecer código de barras sugerido</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Si desmarca esta opción, el campo código de barras de los productos a importar estará vacío.
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={saveDropiImages}
                    onChange={(e) => setSaveDropiImages(e.target.checked)}
                    style={{ marginTop: '4px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>Guardar imágenes dropi</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Al marcar esta opción, si el producto a importar se está vinculando a uno existente, sus imágenes serán remplazadas. Si desmarca esta opción, las imágenes del producto no se guardarán.
                    </div>
                  </div>
                </label>
              </div>

              {/* Info message */}
              <div style={{
                padding: '12px',
                background: '#e7f3ff',
                borderRadius: '4px',
                marginBottom: '1.5rem',
                fontSize: '14px',
                color: '#0066cc'
              }}>
                Debido a cambios en Shopify, desde ahora, cada que importes un producto también se importará el stock desde dropi.
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              padding: '1.5rem',
              borderTop: '1px solid #e1e3e5'
            }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '10px 20px',
                  background: '#e1e3e5',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importFetcher.state === "submitting" || !selectedShopifyProduct}
                style={{
                  padding: '10px 20px',
                  background: (importFetcher.state === "submitting" || !selectedShopifyProduct) ? '#ccc' : '#5c6ac4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (importFetcher.state === "submitting" || !selectedShopifyProduct) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {importFetcher.state === "submitting" ? "Sincronizando..." : "Sincronizar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
