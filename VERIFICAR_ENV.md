# Verificación de Variables de Entorno

## ✅ Variables Requeridas para Tema 2.5

Para que el tema se instale correctamente desde un repositorio privado de GitHub, necesitas configurar estas variables:

```env
THEME_2_5_GIT_REPO=Mercaline2024/Thema-ecomdro2.5
THEME_2_5_GIT_BRANCH=main
THEME_2_5_GIT_PROVIDER=github
THEME_2_5_GIT_TOKEN=ghp_tu_token_aqui
```

## 🔍 Cómo Verificar que Están Configuradas

### Opción 1: Verificar en el Código

Las variables se leen en el servidor en `app/routes/app.theme.tsx`. Si no están configuradas, se usan valores por defecto.

### Opción 2: Verificar en la Consola

Cuando inicies la app con `shopify app dev`, las variables de entorno deberían estar disponibles. Puedes agregar un log temporal para verificar:

```typescript
console.log("THEME_2_5_GIT_REPO:", process.env.THEME_2_5_GIT_REPO);
console.log("THEME_2_5_GIT_TOKEN:", process.env.THEME_2_5_GIT_TOKEN ? "✅ Configurado" : "❌ No configurado");
```

### Opción 3: Verificar en la Página de Theme 2.5

Al intentar instalar el tema, si falta el token o está mal configurado, verás un mensaje de error específico.

## 📝 Ubicación del Archivo .env

El archivo `.env` debe estar en la raíz del proyecto:
```
ecomdrop-ia-connector/
  ├── .env          ← Aquí
  ├── app/
  ├── package.json
  └── ...
```

## ⚠️ Notas Importantes

1. **Shopify CLI**: Si usas `shopify app dev`, las variables de entorno pueden estar en `.shopify/app.env` o en el archivo `.env` local.

2. **Reiniciar el Servidor**: Después de cambiar las variables de entorno, debes reiniciar el servidor de desarrollo.

3. **Seguridad**: El archivo `.env` está en `.gitignore` para proteger tus tokens.

## 🧪 Probar la Configuración

1. Inicia la app: `shopify app dev`
2. Ve a la página "Theme 2.5"
3. Intenta instalar el tema
4. Si hay errores, revisa la consola del servidor para ver los mensajes específicos

## ❌ Errores Comunes

- **"Token de GitHub requerido"**: No has configurado `THEME_2_5_GIT_TOKEN`
- **"Token de GitHub inválido"**: El token no tiene permisos o está mal escrito
- **"Error al acceder al repositorio"**: El token no tiene acceso al repositorio o el repo no existe

