# 📝 Plantilla de Variables de Entorno

Copia este contenido y crea un archivo `.env` en el directorio `ecomdrop-ia-connector/` con tus valores reales.

```bash
# ============================================
# 🚀 CONFIGURACIÓN DE DESPLIEGUE - SHOPIFY APP
# ============================================

# ============================================
# 🗄️ BASE DE DATOS MYSQL
# ============================================
MYSQL_ROOT_PASSWORD=tu_password_root_mysql_seguro
MYSQL_PASSWORD=tu_password_usuario_mysql_seguro

# ============================================
# 🔐 SHOPIFY API CREDENTIALS
# ============================================
# Obtén estos valores desde: https://partners.shopify.com/
SHOPIFY_API_KEY=tu_api_key_aqui
SHOPIFY_API_SECRET=tu_api_secret_aqui

# ============================================
# 🌐 CONFIGURACIÓN DE URL
# ============================================
# URL completa de tu aplicación (con https://)
SHOPIFY_APP_URL=https://connector.ecomdrop.io

# ============================================
# 🎨 TEMA 2.5 (Opcional)
# ============================================
# Si quieres usar un tema desde Git
THEME_2_5_GIT_REPO=Mercaline2024/Thema-ecomdro2.5
THEME_2_5_GIT_BRANCH=main
THEME_2_5_GIT_PROVIDER=github
THEME_2_5_GIT_TOKEN=tu_token_github_si_es_privado

# ============================================
# 🏪 DOMINIO PERSONALIZADO (Opcional)
# ============================================
# Si tu tienda usa un dominio personalizado
SHOP_CUSTOM_DOMAIN=
```

## 📋 Instrucciones

1. Copia el contenido de arriba
2. Crea un archivo `.env` en el directorio `ecomdrop-ia-connector/`
3. Reemplaza todos los valores de ejemplo con tus valores reales
4. **NUNCA** subas el archivo `.env` al repositorio Git

