import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Get shop configuration
  const configuration = session?.shop 
    ? await db.shopConfiguration.findUnique({
        where: { shop: session.shop }
      })
    : null;

  // Fetch Shopify products
  let shopifyProducts: any[] = [];
  if (session?.shop) {
    try {
  const response = await admin.graphql(
    `#graphql
          query getProducts {
            products(first: 50) {
              edges {
                node {
            id
            title
            handle
            status
                  featuredImage {
                    url
                    altText
                  }
            variants(first: 10) {
              edges {
                node {
                  id
                        title
                  price
                      }
                }
              }
            }
          }
        }
          }`
      );
      
      const data = await response.json();
      shopifyProducts = data.data?.products?.edges?.map((edge: any) => edge.node) || [];
    } catch (error) {
      console.error("Error fetching Shopify products:", error);
    }
  }

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
    shopifyProducts,
    associations,
  };
};

export default function ProductsPage() {
  const { configuration, shopifyProducts, associations: initialAssociations } = useLoaderData<typeof loader>();
  const dropiProductsFetcher = useFetcher();
  const importFetcher = useFetcher();
  const shopifyProductVariantsFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const shopify = useAppBridge();
  
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
    
    if (deleteFetcher.data?.success) {
      shopify.toast.show(deleteFetcher.data.message || "Asociación eliminada exitosamente");
      // Remover la asociación de la lista
      const associationId = deleteFetcher.data.associationId;
      if (associationId) {
        setAssociations(prev => prev.filter((assoc: any) => assoc.id !== associationId));
      } else {
        // Si no tenemos el ID, recargar la página
        window.location.reload();
      }
    } else if (deleteFetcher.data?.error) {
      shopify.toast.show(`Error: ${deleteFetcher.data.error}`);
    }
  }, [deleteFetcher.data]);

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

    importFetcher.submit(formData, {
      method: "POST",
      action: "/api/products/import"
    });
  };

  // Manejar respuesta de importación
  useEffect(() => {
    // Solo ejecutar en el cliente
    if (typeof window === 'undefined') return;
    
    if (importFetcher.data?.success) {
      shopify.toast.show(importFetcher.data.message || "Producto procesado exitosamente");
      setModalOpen(false);
      setModalProduct(null);
      
      // Actualizar asociaciones
      if (importFetcher.data.association) {
        setAssociations(prev => [importFetcher.data.association, ...prev]);
      }
      
      // Recargar asociaciones del servidor
      window.location.reload();
    } else if (importFetcher.data?.error) {
      shopify.toast.show(`Error: ${importFetcher.data.error}`);
    }
  }, [importFetcher.data]);

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <s-page heading="Productos">
        {/* Tabs Navigation */}
        <div style={{ 
        borderBottom: '2px solid #e1e3e5', 
        marginBottom: '2rem',
        display: 'flex',
        gap: '0'
      }}>
        <button
          type="button"
          onClick={() => setActiveTab("productos")}
          style={{
            padding: '1rem 2rem',
            border: 'none',
            background: activeTab === "productos" ? '#5c6ac4' : 'transparent',
            color: activeTab === "productos" ? '#fff' : '#666',
            fontWeight: activeTab === "productos" ? 'bold' : 'normal',
            borderBottom: activeTab === "productos" ? '3px solid #5c6ac4' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: '8px 8px 0 0'
          }}
        >
          Productos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("sincronizada")}
          style={{
            padding: '1rem 2rem',
            border: 'none',
            background: activeTab === "sincronizada" ? '#5c6ac4' : 'transparent',
            color: activeTab === "sincronizada" ? '#fff' : '#666',
            fontWeight: activeTab === "sincronizada" ? 'bold' : 'normal',
            borderBottom: activeTab === "sincronizada" ? '3px solid #5c6ac4' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: '8px 8px 0 0'
          }}
        >
          Información sincronizada
        </button>
        </div>

        {activeTab === "productos" && (
          <>
            <s-section heading="Asociación de Productos Dropi ↔ Shopify">
        <s-paragraph>
                Conecte productos de Dropi con productos de Shopify para sincronización automática y personalización con campos del bot de Ecomdrop.
              </s-paragraph>

              {!configuration?.dropiToken && (
                <s-box
                  padding="base"
                  borderWidth="base"
                  borderRadius="base"
                  background="warning-subdued"
                >
                  <s-paragraph>
                    ⚠️ Primero debe configurar Dropi en la pestaña "Configuración"
        </s-paragraph>
                </s-box>
              )}
      </s-section>

            {configuration?.dropiToken && (
              <>
                <div style={{ width: '100%', maxWidth: '100%' }}>
            <s-section heading="Productos de Dropi">
              <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label htmlFor="search_dropi" style={{ display: 'block', marginBottom: '4px', fontWeight: '500', fontSize: '14px' }}>
                    Buscar Producto
                  </label>
                  <input
                    id="search_dropi"
                    type="text"
                    value={searchKeywords}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setSearchKeywords(value);
                      // Si se borra la búsqueda, volver a cargar favoritos por defecto
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
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      borderRadius: '4px', 
                      border: '1px solid #ccc',
                      marginTop: '4px'
                    }}
                  />
                </div>
          <s-button
                  variant="primary"
              onClick={() => {
                    setCurrentPage(1);
                    loadDropiProducts(searchKeywords, 1);
              }}
                  {...(dropiProductsFetcher.state === "loading" ? { loading: true } : {})}
            >
                  🔍 Buscar
          </s-button>
            {searchKeywords && (
            <s-button
                variant="secondary"
              onClick={() => {
                  setSearchKeywords("");
                  setCurrentPage(1);
                  loadDropiProducts("", 1);
                }}
              >
                ✕ Limpiar
            </s-button>
          )}
              </div>
              
              {/* Filtros - Solo mostrar cuando NO hay búsqueda activa */}
              {!searchKeywords && (
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={privatedProduct}
                      onChange={(e) => {
                        setPrivatedProduct(e.target.checked);
                        setCurrentPage(1);
                        loadDropiProducts("", 1);
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
                      🔒 Productos Privados
                    </span>
                  </label>
                  <s-text tone="subdued" style={{ fontSize: '12px', color: '#666' }}>
                    {privatedProduct 
                      ? '(Mostrando solo productos privados)' 
                      : '(Mostrando solo productos favoritos por defecto)'}
                  </s-text>
                </div>
              )}
              
              {dropiProducts.length > 0 && (
                <s-text tone="subdued" style={{ marginTop: '0.5rem', display: 'block' }}>
                  {totalProducts > 0 ? `${totalProducts} producto(s) total(es)` : `${dropiProducts.length} producto(s)`} {searchKeywords ? 'encontrado(s)' : 'cargado(s)'}
                </s-text>
              )}
            </div>

            {dropiProducts.length === 0 ? (
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="info-subdued"
              >
                <s-paragraph>
                  Haga clic en "Cargar Productos de Dropi" para ver sus productos en favoritos
                </s-paragraph>
              </s-box>
            ) : (
              <div style={{ 
                background: '#fff', 
                borderRadius: '8px', 
                overflow: 'hidden',
                border: '1px solid #e1e3e5',
                width: '100%',
                overflowX: 'auto',
                position: 'relative'
              }}>
                {/* Overlay de carga */}
                {dropiProductsFetcher.state === "loading" && dropiProducts.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255, 255, 255, 0.9)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    borderRadius: '8px',
                    gap: '1rem'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      border: '4px solid #e1e3e5',
                      borderTop: '4px solid #5c6ac4',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    <div style={{
                      color: '#5c6ac4',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}>
                      Cargando productos...
                    </div>
                  </div>
                )}
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                  <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e1e3e5' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        ID/SKU
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        NOMBRE
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        PRECIO
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        STOCK
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        BODEGA
                      </th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        ACCIONES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dropiProducts.map((product: any, index: number) => (
                      <tr 
                        key={product.id}
                        style={{ 
                          borderBottom: '1px solid #e1e3e5',
                          background: selectedDropiProduct === product.id ? '#f0f9ff' : index % 2 === 0 ? '#fff' : '#fafafa',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedDropiProduct !== product.id) {
                            e.currentTarget.style.background = '#f8f9fa';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedDropiProduct !== product.id) {
                            e.currentTarget.style.background = index % 2 === 0 ? '#fff' : '#fafafa';
                          }
                        }}
                        onClick={() => setSelectedDropiProduct(product.id)}
                      >
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {product.gallery && product.gallery.length > 0 ? (
                              <img 
                                src={`https://d39ru7awumhhs2.cloudfront.net/${product.gallery[0].urlS3}`} 
                                alt={product.name}
                                style={{ 
                                  width: '50px', 
                                  height: '50px', 
                                  borderRadius: '50%', 
                                  objectFit: 'cover',
                                  border: '2px solid #e1e3e5'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                background: '#e1e3e5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666',
                                fontSize: '12px'
                              }}>
                                {product.name?.charAt(0) || '?'}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: '600', color: '#333', fontSize: '14px' }}>
                                {product.id}
                              </div>
                              <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                                {product.sku || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: '500', color: '#333', fontSize: '14px' }}>
                            {product.name || product.title}
                          </div>
                          {product.categories && product.categories.length > 0 && (
                            <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                              {product.categories.map((cat: any) => cat.name).join(', ')}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{
                              padding: '6px 12px',
                              background: '#d4edda',
                              color: '#155724',
                              borderRadius: '4px',
                              fontWeight: '600',
                              fontSize: '14px',
                              display: 'inline-block',
                              width: 'fit-content'
                            }}>
                              ${parseFloat(product.sale_price || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {product.suggested_price && (
                              <div style={{
                                padding: '4px 12px',
                                background: '#fff3cd',
                                color: '#856404',
                                borderRadius: '4px',
                                fontWeight: '500',
                                fontSize: '12px',
                                display: 'inline-block',
                                width: 'fit-content'
                              }}>
                                ${parseFloat(product.suggested_price).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          <div style={{ 
                            fontWeight: '600', 
                            color: '#333', 
                            fontSize: '14px',
                            padding: '6px 12px',
                            background: product.private_product_inventories && product.private_product_inventories.length > 0 ? '#d1ecf1' : '#f8d7da',
                            borderRadius: '4px',
                            display: 'inline-block'
                          }}>
                            {product.private_product_inventories && product.private_product_inventories.length > 0 
                              ? product.private_product_inventories.reduce((sum: number, inv: any) => sum + parseFloat(inv.stock || 0), 0).toLocaleString('es-CO')
                              : product.warehouse_product && product.warehouse_product.length > 0
                              ? product.warehouse_product.reduce((sum: number, wp: any) => sum + (wp.stock || 0), 0).toLocaleString('es-CO')
                              : '0'}
                          </div>
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                          {product.warehouse_product && product.warehouse_product.length > 0 ? (
                            <div style={{ color: '#333', fontSize: '14px', fontWeight: '500' }}>
                              {product.warehouse_product.map((wp: any) => wp.warehouse?.name || 'N/A').join(', ')}
                            </div>
                          ) : product.private_product_inventories && product.private_product_inventories.length > 0 ? (
                            <div style={{ color: '#666', fontSize: '14px' }}>
                              {product.private_product_inventories.map((inv: any) => inv.user?.name || 'N/A').join(', ')}
                            </div>
                          ) : (
                            <div style={{ color: '#999', fontSize: '14px' }}>N/A</div>
                          )}
                        </td>
                        <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <button
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '50%',
                                color: '#5c6ac4',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f0f0f0';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                openImportModal(product);
                              }}
                              title="Importar producto"
                            >
                              👁️
                            </button>
                            <input
                              type="checkbox"
                              checked={selectedDropiProduct === product.id}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedDropiProduct(e.target.checked ? product.id : "");
                              }}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: 'pointer'
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Controles de Paginación */}
            {dropiProducts.length > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '1rem',
                marginTop: '2rem',
                padding: '1rem',
                background: '#f5f5f5',
                borderRadius: '8px'
              }}>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || dropiProductsFetcher.state === "loading"}
                  style={{
                    padding: '8px 16px',
                    background: currentPage === 1 ? '#e1e3e5' : '#5c6ac4',
                    color: currentPage === 1 ? '#666' : '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage > 1) {
                      e.currentTarget.style.background = '#4c5b9e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage > 1) {
                      e.currentTarget.style.background = '#5c6ac4';
                    }
                  }}
                >
                  ← Anterior
                </button>
                
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#333'
                }}>
                  {dropiProductsFetcher.state === "loading" ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid #e1e3e5',
                        borderTop: '2px solid #5c6ac4',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      <span>Cargando...</span>
                    </div>
                  ) : (
                    <>
                      <span>Página</span>
                      <span style={{
                        padding: '6px 12px',
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}>
                        {currentPage}
                      </span>
                      <span>de</span>
                      <span style={{
                        padding: '6px 12px',
                        background: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        minWidth: '40px',
                        textAlign: 'center'
                      }}>
                        {totalPages}
                      </span>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={(totalProducts > 0 && currentPage >= totalPages) || (totalProducts === 0 && dropiProducts.length < 10) || dropiProductsFetcher.state === "loading"}
                  style={{
                    padding: '8px 16px',
                    background: (totalProducts > 0 && currentPage >= totalPages) || (totalProducts === 0 && dropiProducts.length < 10) ? '#e1e3e5' : '#5c6ac4',
                    color: (totalProducts > 0 && currentPage >= totalPages) || (totalProducts === 0 && dropiProducts.length < 10) ? '#666' : '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (totalProducts > 0 && currentPage >= totalPages) || (totalProducts === 0 && dropiProducts.length < 10) ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    const isDisabled = (totalProducts > 0 && currentPage >= totalPages) || (totalProducts === 0 && dropiProducts.length < 10);
                    if (!isDisabled) {
                      e.currentTarget.style.background = '#4c5b9e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const isDisabled = (totalProducts > 0 && currentPage >= totalPages) || (totalProducts === 0 && dropiProducts.length < 10);
                    if (!isDisabled) {
                      e.currentTarget.style.background = '#5c6ac4';
                    }
                  }}
                >
                  Siguiente →
                </button>
              </div>
            )}

            {dropiProducts.length > 0 && (
              <div style={{ marginTop: '1rem', textAlign: 'center', color: '#666', fontSize: '14px' }}>
                Mostrando {((currentPage - 1) * 10) + 1} - {Math.min(currentPage * 10, totalProducts)} de {totalProducts} productos
              </div>
            )}
            </s-section>

          <s-section heading="Productos de Shopify">
            {shopifyProducts.length === 0 ? (
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background="info-subdued"
              >
                <s-paragraph>
                  No se encontraron productos en su tienda de Shopify
                </s-paragraph>
              </s-box>
            ) : (
              <s-stack direction="block" gap="base">
                {shopifyProducts.map((product: any) => (
                  <s-box
                    key={product.id}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                    background={selectedShopifyProduct === product.id ? "selected" : "subdued"}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedShopifyProduct(product.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <s-heading size="small">{product.title}</s-heading>
                        <s-text tone="subdued">
                          Status: {product.status} | Variantes: {product.variants.edges.length}
                        </s-text>
                      </div>
                      {selectedShopifyProduct === product.id && (
                        <s-text tone="success">✓ Seleccionado</s-text>
                      )}
                    </div>
              </s-box>
                ))}
            </s-stack>
        )}
      </s-section>

            {selectedShopifyProduct && selectedDropiProduct && (
              <s-section heading="Asociar Productos">
                <s-box
                  padding="large"
                  borderWidth="base"
                  borderRadius="base"
                  background="success-subdued"
                >
        <s-paragraph>
                    <strong>Listo para asociar:</strong>
        </s-paragraph>
                  <s-text>
                    Producto Dropi: {dropiProducts.find(p => p.id === selectedDropiProduct)?.name || selectedDropiProduct}
                  </s-text>
                  <s-text>
                    Producto Shopify: {shopifyProducts.find(p => p.id === selectedShopifyProduct)?.title || selectedShopifyProduct}
                  </s-text>
                  <div style={{ marginTop: '1rem' }}>
                    <s-button 
                      variant="primary"
                      onClick={handleAssociate}
                    >
                      Asociar Productos
                    </s-button>
                  </div>
                </s-box>
              </s-section>
            )}
          </div>
          </>
        )}
      </>
    )}

        {activeTab === "sincronizada" && (
          <s-section heading="Información Sincronizada">
          {associations.length === 0 ? (
            <s-box
              padding="base"
              borderWidth="base"
              borderRadius="base"
              background="info-subdued"
            >
        <s-paragraph>
                No hay productos sincronizados aún. Use el botón 👁️ en un producto de Dropi para importar o vincular productos.
              </s-paragraph>
            </s-box>
          ) : (
            <div style={{ 
              background: '#fff', 
              borderRadius: '8px', 
              overflow: 'hidden',
              border: '1px solid #e1e3e5',
              width: '100%',
              overflowX: 'auto'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e1e3e5' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                      Producto Dropi
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                      Producto Shopify
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                      Tipo
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                      Fecha
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#333', fontSize: '14px', width: '100px' }}>
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {associations.map((assoc: any, index: number) => (
                    <tr 
                      key={assoc.id}
                      style={{ 
                        borderBottom: '1px solid #e1e3e5',
                        background: index % 2 === 0 ? '#fff' : '#fafafa'
                      }}
                    >
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: '500', color: '#333', fontSize: '14px' }}>
                          {assoc.dropiProductName || assoc.dropiProductId}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                          ID: {assoc.dropiProductId}
                        </div>
                      </td>
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: '500', color: '#333', fontSize: '14px' }}>
                          {assoc.shopifyProductTitle || assoc.shopifyProductId}
                        </div>
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                          ID: {assoc.shopifyProductId.split('/').pop()}
                        </div>
                      </td>
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{
                          padding: '6px 12px',
                          background: assoc.importType === 'new' ? '#d4edda' : '#d1ecf1',
                          color: assoc.importType === 'new' ? '#155724' : '#0c5460',
                          borderRadius: '4px',
                          fontWeight: '500',
                          fontSize: '12px',
                          display: 'inline-block',
                          width: 'fit-content'
                        }}>
                          {assoc.importType === 'new' ? 'Nuevo' : 'Vinculado'}
                        </div>
                      </td>
                      <td style={{ padding: '16px', verticalAlign: 'middle' }}>
                        <div style={{ color: '#666', fontSize: '14px' }}>
                          {new Date(assoc.createdAt).toLocaleDateString('es-CO', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td style={{ padding: '16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteAssociation(assoc.id)}
                          disabled={deleteFetcher.state === "submitting"}
                          style={{
                            padding: '6px 12px',
                            background: deleteFetcher.state === "submitting" ? '#ccc' : '#dc3545',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: deleteFetcher.state === "submitting" ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (deleteFetcher.state !== "submitting") {
                              e.currentTarget.style.background = '#c82333';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (deleteFetcher.state !== "submitting") {
                              e.currentTarget.style.background = '#dc3545';
                            }
                          }}
                        >
                          {deleteFetcher.state === "submitting" ? (
                            <>
                              <span style={{ 
                                display: 'inline-block',
                                width: '12px',
                                height: '12px',
                                border: '2px solid #fff',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 0.6s linear infinite'
                              }}></span>
                              Eliminando...
                            </>
                          ) : (
                            <>
                              🗑️ Eliminar
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </s-section>
        )}

        <s-section heading="Información">
        <s-paragraph>
            Esta página le permite asociar productos de Dropi con productos de Shopify para sincronización automática.
        </s-paragraph>
        <s-paragraph>
            Una vez asociados, podrá asignar campos personalizados del bot de Ecomdrop para personalización automática.
        </s-paragraph>
      </s-section>
      </s-page>

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
                  {shopifyProducts.map((product: any) => (
                    <option key={product.id} value={product.id}>
                      {product.title}
                    </option>
                  ))}
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
