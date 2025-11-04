# Configuración del Tema 2.5 desde Git

## 📋 Configuración para Repositorio Privado

Para instalar el tema desde un repositorio privado de GitHub, necesitas configurar las siguientes variables de entorno:

### Variables de Entorno Requeridas

```env
# Repositorio Git (formato: owner/repo)
THEME_2_5_GIT_REPO=Mercaline2024/Thema-ecomdro2.5

# Rama del repositorio (opcional, por defecto: main)
THEME_2_5_GIT_BRANCH=main

# Proveedor Git (opcional, por defecto: github)
THEME_2_5_GIT_PROVIDER=github

# Token de GitHub para repositorios privados (OBLIGATORIO para repos privados)
THEME_2_5_GIT_TOKEN=ghp_tu_token_aqui
```

## 🔑 Cómo Obtener un Token de GitHub

1. Ve a [GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)](https://github.com/settings/tokens)
2. Haz clic en "Generate new token (classic)"
3. Dale un nombre descriptivo (ej: "Ecomdrop Theme Installer")
4. Selecciona los siguientes permisos:
   - ✅ `repo` - Control total de repositorios privados
   - ✅ `repo:status` - Acceso a estados de confirmación
5. Genera el token y cópialo
6. **Importante**: Guarda el token en un lugar seguro, no podrás verlo de nuevo

## 🔒 Seguridad del Token

- **NUNCA** compartas el token públicamente
- **NUNCA** lo subas a Git (debe estar en `.env` que está en `.gitignore`)
- Usa tokens con permisos mínimos necesarios
- Considera usar tokens con expiración

## ✅ Funcionamiento

1. **Repositorio Público**: Si no configuras `THEME_2_5_GIT_TOKEN`, intentará usar la URL pública
2. **Repositorio Privado**: Si configuras `THEME_2_5_GIT_TOKEN`:
   - Se autentica con GitHub API
   - Descarga el ZIP del repositorio
   - Convierte a base64
   - Envía directamente a Shopify usando data URI

## 🧪 Probar la Configuración

1. Verifica que el token tenga acceso al repositorio:
   ```bash
   curl -H "Authorization: token TU_TOKEN" https://api.github.com/repos/Mercaline2024/Thema-ecomdro2.5
   ```

2. Si obtienes un 200 OK, el token funciona correctamente.

## 📝 Ejemplo Completo de .env

```env
# Configuración del Tema 2.5
THEME_2_5_GIT_REPO=Mercaline2024/Thema-ecomdro2.5
THEME_2_5_GIT_BRANCH=main
THEME_2_5_GIT_PROVIDER=github
THEME_2_5_GIT_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## ⚠️ Notas Importantes

- El repositorio debe contener el tema completo de Shopify en la raíz
- Shopify espera que el ZIP contenga la estructura estándar de un tema
- El tamaño del tema puede ser grande, asegúrate de tener suficiente memoria
- Los tokens de GitHub pueden expirar, verifica periódicamente

