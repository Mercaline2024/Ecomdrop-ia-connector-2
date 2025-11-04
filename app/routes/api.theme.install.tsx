import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  if (!session?.shop) {
    return new Response(JSON.stringify({ error: "No shop session found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const formData = await request.formData();
    const themeUrl = formData.get("themeUrl")?.toString();
    const themeName = formData.get("themeName")?.toString() || "Ecomdrop Theme 2.5";

    if (!themeUrl) {
      return new Response(JSON.stringify({ error: "URL del tema es requerida" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`📥 Instalando tema desde: ${themeUrl}`);

    // Manejar URLs de repositorios privados de GitHub/GitLab
    let finalThemeUrl = themeUrl;
    let githubToken: string | null = null;
    
    if (themeUrl.startsWith("github-api://")) {
      // Formato: github-api://owner/repo/branch?token=xxx
      const urlMatch = themeUrl.match(/github-api:\/\/([^\/]+)\/([^\/]+)\/([^?]+)(\?token=([^&]+))?/);
      if (urlMatch) {
        const [, owner, repo, branch, , token] = urlMatch;
        
        if (!token) {
          return new Response(JSON.stringify({ 
            error: "Token de GitHub requerido para repositorios privados. Configure THEME_2_5_GIT_TOKEN en las variables de entorno." 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        githubToken = token;

        // Usar GitHub API para obtener el zipball del repositorio privado
        const githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;
        
        // Verificar que el token funciona primero
        try {
          console.log(`🔍 Verificando acceso al repositorio: ${owner}/${repo}`);
          const verifyResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
              "Authorization": `token ${token}`,
              "Accept": "application/vnd.github.v3+json",
              "User-Agent": "Ecomdrop-IA-Connector"
            }
          });

          if (!verifyResponse.ok) {
            let errorText = "";
            try {
              errorText = await verifyResponse.text();
            } catch {}

            if (verifyResponse.status === 401 || verifyResponse.status === 403) {
              let detailedError = "Token de GitHub inválido o sin permisos.";
              
              if (verifyResponse.status === 403) {
                detailedError = `403 Forbidden: El token no tiene acceso al repositorio '${owner}/${repo}'. 
                
Verifica que:
1. El token tenga el permiso 'repo' (control total de repositorios privados)
2. El token tenga acceso específico al repositorio '${owner}/${repo}'
3. El token no haya expirado
4. La variable THEME_2_5_GIT_TOKEN esté correctamente configurada en .env

Respuesta de GitHub: ${errorText.substring(0, 200)}`;
              } else {
                detailedError = `401 Unauthorized: Token inválido o mal formateado. Verifica que el token sea correcto.`;
              }
              
              return new Response(JSON.stringify({ 
                error: detailedError
              }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
              });
            }
            return new Response(JSON.stringify({ 
              error: `Error al acceder al repositorio: ${verifyResponse.status} ${verifyResponse.statusText}. ${errorText.substring(0, 200)}` 
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }
          
          console.log(`✅ Acceso al repositorio verificado correctamente`);

          // Guardar la URL para descargar
          finalThemeUrl = githubApiUrl;
          
        } catch (apiError) {
          console.error("Error accediendo a GitHub API:", apiError);
          return new Response(JSON.stringify({ 
            error: `Error al acceder al repositorio privado: ${apiError instanceof Error ? apiError.message : "Error desconocido"}` 
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
    } else if (themeUrl.startsWith("gitlab-api://")) {
      // Similar para GitLab si es necesario en el futuro
      return new Response(JSON.stringify({ 
        error: "GitLab API para repositorios privados aún no implementado" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // Para URLs públicas, validar que sea accesible
      try {
        const headResponse = await fetch(themeUrl, { method: "HEAD" });
        if (!headResponse.ok) {
          return new Response(JSON.stringify({ 
            error: `No se pudo acceder a la URL del tema: ${headResponse.status} ${headResponse.statusText}. Verifica que la URL sea pública y accesible.` 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      } catch (fetchError) {
        console.error("Error verificando URL del tema:", fetchError);
        return new Response(JSON.stringify({ 
          error: `Error al verificar la URL del tema: ${fetchError instanceof Error ? fetchError.message : "Error desconocido"}` 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Shopify REST API para instalar temas desde URL
    const apiUrl = `https://${session.shop}/admin/api/2025-10/themes.json`;

    // Obtener el token de acceso de la sesión
    const accessToken = session.accessToken;

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No access token found" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Shopify puede descargar desde URLs públicas, pero para repos privados necesitamos
    // descargar el archivo primero y enviarlo como base64
    let themeSrc = finalThemeUrl;

    // Si es una URL de GitHub API (repositorio privado), necesitamos descargar primero
    if (finalThemeUrl.includes("api.github.com/repos/") && githubToken) {
      try {
        console.log("📥 Descargando tema desde GitHub API (repositorio privado)...");
        console.log(`🔗 URL: ${finalThemeUrl}`);
        console.log(`🔑 Token presente: ${githubToken ? 'Sí' : 'No'} (longitud: ${githubToken?.length || 0})`);
        
        const downloadResponse = await fetch(finalThemeUrl, {
          headers: {
            "Authorization": `token ${githubToken}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Ecomdrop-IA-Connector"
          },
          redirect: "follow" // Seguir redirecciones
        });

        if (!downloadResponse.ok) {
          // Obtener más detalles del error
          let errorDetails = "";
          try {
            const errorText = await downloadResponse.text();
            errorDetails = errorText;
          } catch {}

          let errorMessage = `Error al descargar el tema desde GitHub: ${downloadResponse.status} ${downloadResponse.statusText}`;
          
          if (downloadResponse.status === 403) {
            errorMessage = `403 Forbidden: El token de GitHub no tiene permisos para acceder al repositorio. Verifica que:
1. El token tenga el permiso 'repo' (control total de repositorios privados)
2. El token tenga acceso al repositorio '${finalThemeUrl.match(/repos\/([^\/]+\/[^\/]+)/)?.[1] || "Mercaline2024/Thema-ecomdro2.5"}'
3. El token no haya expirado
4. La variable THEME_2_5_GIT_TOKEN esté correctamente configurada en .env`;
          } else if (downloadResponse.status === 401) {
            errorMessage = `401 Unauthorized: Token de GitHub inválido o mal formateado. Verifica que el token sea correcto.`;
          } else if (downloadResponse.status === 404) {
            errorMessage = `404 Not Found: El repositorio o la rama no existe. Verifica THEME_2_5_GIT_REPO y THEME_2_5_GIT_BRANCH.`;
          }

          console.error("Error detalles:", errorDetails);
          
          return new Response(JSON.stringify({ 
            error: errorMessage
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        // Obtener el contenido del ZIP
        const zipBuffer = await downloadResponse.arrayBuffer();
        console.log(`✅ Tema descargado: ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        
        // Shopify no acepta data URIs directamente, necesitamos crear una URL temporal
        // Opción 1: Usar un servicio de almacenamiento temporal (no disponible aquí)
        // Opción 2: Crear un endpoint temporal que sirva el archivo
        // Por ahora, intentamos usar la URL de GitHub con autenticación en el servidor
        // pero Shopify no puede hacer esto...
        
        // SOLUCIÓN: Necesitamos crear una URL pública temporal o usar un enfoque diferente
        // Por ahora, guardamos el buffer en memoria y creamos un endpoint temporal
        
        // Convertir ArrayBuffer a Buffer para almacenamiento temporal
        const zipData = Buffer.from(zipBuffer);
        
        // Crear un ID único para esta descarga temporal
        const tempId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        // Almacenar temporalmente en memoria (en producción, usar Redis o similar)
        // Por ahora, usamos un Map global temporal (no ideal para producción)
        if (!(globalThis as any).__themeCache) {
          (globalThis as any).__themeCache = new Map();
        }
        (globalThis as any).__themeCache.set(tempId, {
          data: zipData,
          expires: Date.now() + 5 * 60 * 1000, // 5 minutos
          shop: session.shop
        });
        
        // Limpiar entradas expiradas
        setTimeout(() => {
          const cache = (globalThis as any).__themeCache;
          if (cache) {
            for (const [id, entry] of cache.entries()) {
              if (entry.expires < Date.now()) {
                cache.delete(id);
              }
            }
          }
        }, 60000); // Limpiar cada minuto
        
        // Crear URL temporal que apunte a nuestro servidor
        // Shopify necesita poder acceder a esta URL sin autenticación
        const baseUrl = process.env.SHOPIFY_APP_URL || 
                       request.headers.get('origin') || 
                       request.url.split('/api/')[0] || 
                       '';
        
        // Asegurarnos de que la URL sea absoluta y accesible
        let tempUrl = `${baseUrl}/api/theme/download/${tempId}`;
        
        // Si la URL no es https, intentar usar la URL del request
        if (!tempUrl.startsWith('http')) {
          const url = new URL(request.url);
          tempUrl = `${url.protocol}//${url.host}/api/theme/download/${tempId}`;
        }
        
        console.log(`🔗 URL temporal creada: ${tempUrl}`);
        console.log(`⏰ Archivo expira en: ${new Date(Date.now() + 5 * 60 * 1000).toISOString()}`);
        themeSrc = tempUrl;
        
      } catch (downloadError) {
        console.error("Error descargando tema:", downloadError);
        return new Response(JSON.stringify({ 
          error: `Error al descargar el tema: ${downloadError instanceof Error ? downloadError.message : "Error desconocido"}` 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Instalar el tema usando REST API
    console.log(`📤 Enviando tema a Shopify desde: ${themeSrc}`);
    
    const installResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        theme: {
          name: themeName,
          src: themeSrc, // Shopify descargará el tema desde esta URL
          role: "unpublished" // Instalar sin publicar automáticamente
        }
      })
    });

    // Limpiar el cache después de un tiempo (si es una URL temporal)
    if (themeSrc.includes("/api/theme/download/")) {
      const tempId = themeSrc.split("/api/theme/download/")[1];
      setTimeout(() => {
        const cache = (globalThis as any).__themeCache;
        if (cache && tempId) {
          cache.delete(tempId);
          console.log(`🗑️ Archivo temporal ${tempId} eliminado del cache`);
        }
      }, 10 * 60 * 1000); // Limpiar después de 10 minutos
    }

    if (!installResponse.ok) {
      const errorText = await installResponse.text();
      console.error("Error instalando tema:", errorText);
      
      let errorMessage = `Error al instalar el tema: ${installResponse.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.errors?.base?.[0] || errorJson.errors?.theme?.[0] || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const installData = await installResponse.json();

    console.log("✅ Tema instalado exitosamente:", installData.theme?.id);

    return new Response(JSON.stringify({ 
      success: true,
      message: "Tema instalado exitosamente. Puedes activarlo desde Temas > Personalizar.",
      theme: installData.theme
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error installing theme:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Error desconocido"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

