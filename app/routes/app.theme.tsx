import { useState, useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Obtener temas existentes
  let themes: any[] = [];
  if (session?.shop) {
    try {
      const response = await admin.graphql(`
        #graphql
        query getThemes {
          themes(first: 10) {
            edges {
              node {
                id
                name
                role
                createdAt
                updatedAt
              }
            }
          }
        }
      `);

      const data = await response.json();
      themes = data.data?.themes?.edges?.map((edge: any) => edge.node) || [];
    } catch (error) {
      console.error("Error fetching themes:", error);
    }
  }

  // Configuración del repositorio Git del tema
  const gitRepo = process.env.THEME_2_5_GIT_REPO || "Mercaline2024/Thema-ecomdro2.5";
  const gitBranch = process.env.THEME_2_5_GIT_BRANCH || "main";
  const gitProvider = process.env.THEME_2_5_GIT_PROVIDER || "github";
  const gitToken = process.env.THEME_2_5_GIT_TOKEN || "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"; // Token para repositorios privados
  
  // Generar URL del tema desde Git
  let themeUrl = process.env.THEME_2_5_URL; // URL directa si está configurada
  
  if (!themeUrl && gitRepo) {
    // Construir URL de descarga desde GitHub
    if (gitProvider === "github") {
      const [owner, repo] = gitRepo.split("/");
      
      // Si hay token, usar API de GitHub (necesario para repos privados)
      // Si no hay token, usar URL pública (solo funciona para repos públicos)
      if (gitToken) {
        // Usar API de GitHub con token para repositorios privados
        // Nota: Esta URL será procesada por el endpoint de instalación
        themeUrl = `github-api://${owner}/${repo}/${gitBranch}?token=${gitToken}`;
      } else {
        // URL pública para repositorios públicos
        themeUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${gitBranch}.zip`;
      }
    } else if (gitProvider === "gitlab") {
      const [owner, repo] = gitRepo.split("/");
      if (gitToken) {
        themeUrl = `gitlab-api://${owner}/${repo}/${gitBranch}?token=${gitToken}`;
      } else {
        themeUrl = `https://gitlab.com/${owner}/${repo}/-/archive/${gitBranch}/${repo}-${gitBranch}.zip`;
      }
    }
  }
  
  // Fallback si no hay configuración
  if (!themeUrl) {
    themeUrl = "https://example.com/theme-2.5.zip";
  }

  return {
    themes,
    shop: session?.shop || "",
    themeUrl,
  };
};

export default function ThemePage() {
  const { themes, shop, themeUrl } = useLoaderData<typeof loader>();
  const installFetcher = useFetcher();
  const shopify = useAppBridge();

  const [showPreview, setShowPreview] = useState(false);

  // URL del tema viene del loader (servidor)
  const THEME_URL = themeUrl;
  const THEME_NAME = "Ecomdrop Theme 2.5";

  const handleInstall = () => {
    if (typeof window === 'undefined') return;

    if (!confirm(`¿Estás seguro de que deseas instalar "${THEME_NAME}"? El tema se instalará pero no se activará automáticamente.`)) {
      return;
    }

    const formData = new FormData();
    formData.append("themeUrl", THEME_URL);
    formData.append("themeName", THEME_NAME);

    installFetcher.submit(formData, {
      method: "POST",
      action: "/api/theme/install"
    });
  };

  // Manejar respuesta de instalación
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (installFetcher.data?.success) {
      shopify.toast.show(installFetcher.data.message || "Tema instalado exitosamente");
    } else if (installFetcher.data?.error) {
      shopify.toast.show(`Error: ${installFetcher.data.error}`);
    }
  }, [installFetcher.data]);

  // Extraer el ID numérico del tema desde el GraphQL ID
  // Formato GraphQL: "gid://shopify/Theme/123456789" -> necesitamos "123456789"
  const extractThemeId = (gid: string) => {
    if (!gid) return null;
    // Probar diferentes formatos de GID
    const match = gid.match(/\/Theme\/(\d+)/);
    if (match) return match[1];
    // Si ya es un número, devolverlo
    if (/^\d+$/.test(gid)) return gid;
    // Intentar extraer de cualquier formato
    const numberMatch = gid.match(/(\d+)/);
    return numberMatch ? numberMatch[1] : null;
  };

  const activeTheme = themes.find((t: any) => t.role === "MAIN");
  const firstTheme = themes[0];
  const themeToPreview = activeTheme || firstTheme;
  
  // Debug: Log de los temas
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log("🎨 Temas disponibles:", themes);
    console.log("🎯 Tema activo:", activeTheme);
    console.log("🎯 Primer tema:", firstTheme);
    console.log("🎯 Tema para preview:", themeToPreview);
  }, [themes, activeTheme, firstTheme, themeToPreview]);

  const themeId = extractThemeId(themeToPreview?.id || '');
  
  // Debug: Log del ID extraído
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log("🆔 ID original del tema:", themeToPreview?.id);
    console.log("🆔 ID extraído:", themeId);
  }, [themeToPreview?.id, themeId]);
  
  // Construir URL de preview con el ID numérico
  // Shopify requiere el ID numérico, no el GID completo
  // También podemos usar el parámetro _ab=0 para bypass de autenticación en preview
  const previewUrl = shop && themeId
    ? `https://${shop}/?preview_theme_id=${themeId}&_ab=0&_fd=0`
    : null;

  // Debug: Log de la URL final
  useEffect(() => {
    if (typeof window === 'undefined') return;
    console.log("🔗 URL de preview:", previewUrl);
    console.log("🏪 Shop:", shop);
  }, [previewUrl, shop]);

  return (
    <s-page heading="Theme 2.5">
      <s-section heading="Tema Premium Ecomdrop 2.5">
        <s-box
          padding="large"
          borderWidth="base"
          borderRadius="base"
          background="info-subdued"
        >
          <s-stack direction="block" gap="base">
            <div>
              <s-heading size="large">Ecomdrop Theme 2.5</s-heading>
              <s-text tone="subdued" style={{ marginTop: "0.5rem", display: "block" }}>
                Instala nuestro tema premium optimizado para dropshipping y automatización
              </s-text>
            </div>

            <div style={{ 
              marginTop: "1.5rem",
              padding: "1.5rem",
              background: "#fff",
              borderRadius: "8px",
              border: "1px solid #e1e3e5"
            }}>
              <s-stack direction="block" gap="base">
                <div>
                  <s-heading size="small">Características del Tema:</s-heading>
                  <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem", color: "#666" }}>
                    <li>Diseño moderno y responsive</li>
                    <li>Optimizado para conversión</li>
                    <li>Integración con Ecomdrop IA</li>
                    <li>Soporte para múltiples idiomas</li>
                    <li>Secciones personalizables</li>
                    <li>Optimizado para velocidad</li>
                  </ul>
                </div>

                <div style={{ marginTop: "1rem" }}>
                  <s-button
                    variant="primary"
                    onClick={handleInstall}
                    disabled={installFetcher.state === "submitting"}
                    size="large"
                  >
                    {installFetcher.state === "submitting" ? "Instalando..." : "Instalar Tema"}
                  </s-button>
                </div>

                {installFetcher.data?.success && (
                  <div style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    background: "#d4edda",
                    border: "1px solid #c3e6cb",
                    borderRadius: "4px",
                    color: "#155724"
                  }}>
                      ✅ Tema instalado exitosamente. Puedes activarlo desde <strong>Temas &gt; Personalizar</strong> en tu panel de Shopify.
                  </div>
                )}

                {installFetcher.data?.error && (
                  <div style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    background: "#f8d7da",
                    border: "1px solid #f5c6cb",
                    borderRadius: "4px",
                    color: "#721c24"
                  }}>
                    ❌ Error: {installFetcher.data.error}
                  </div>
                )}
              </s-stack>
            </div>
          </s-stack>
        </s-box>
      </s-section>

      {/* Preview Section */}
      <s-section heading="Vista Previa">
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
        >
          {previewUrl ? (
            <div>
              <s-text tone="subdued" style={{ marginBottom: "1rem", display: "block" }}>
                Vista previa del tema activo en tu tienda. Si no se muestra, haz clic en "Abrir en nueva pestaña" para verla.
              </s-text>
              <div style={{
                position: "relative",
                width: "100%",
                height: "600px",
                border: "1px solid #e1e3e5",
                borderRadius: "8px",
                overflow: "hidden",
                background: "#f5f5f5"
              }}>
                <iframe
                  src={previewUrl}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none"
                  }}
                  title="Theme Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
                  allow="fullscreen"
                  onError={(e) => {
                    console.error("❌ Error en iframe:", e);
                  }}
                  onLoad={() => {
                    console.log("✅ Iframe cargado");
                  }}
                />
                {/* Fallback si el iframe no carga */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 255, 255, 0.9)",
                  zIndex: 1,
                  pointerEvents: "none"
                }}>
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <p style={{ color: "#666", marginBottom: "1rem" }}>
                      Si la vista previa no se muestra, haz clic en "Abrir en nueva pestaña"
                    </p>
                    <p style={{ color: "#999", fontSize: "12px" }}>
                      URL: {previewUrl}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem" }}>
                <s-button
                  variant="secondary"
                  onClick={() => window.open(previewUrl, "_blank")}
                >
                  Abrir en nueva pestaña
                </s-button>
                {themes.length > 1 && (
                  <s-button
                    variant="secondary"
                    onClick={() => {
                      // Recargar la página para actualizar la vista previa
                      window.location.reload();
                    }}
                  >
                    Actualizar vista previa
                  </s-button>
                )}
              </div>
              <s-text tone="subdued" style={{ marginTop: "0.5rem", display: "block", fontSize: "12px" }}>
                Tema: {activeTheme?.name || themes[0]?.name || "Desconocido"} | ID: {themeId || "N/A"}
              </s-text>
            </div>
          ) : (
            <div>
              <s-text tone="subdued" style={{ marginBottom: "0.5rem", display: "block" }}>
                No hay temas disponibles para mostrar la vista previa.
              </s-text>
              {themes.length === 0 && (
                <s-text tone="subdued" style={{ fontSize: "12px", display: "block" }}>
                  Instala un tema primero para poder ver la vista previa.
                </s-text>
              )}
            </div>
          )}
        </s-box>
      </s-section>
    </s-page>
  );
}

