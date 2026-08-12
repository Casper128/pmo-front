# Configuración de Supabase para PMO

La aplicación funciona con los valores locales actuales mientras Supabase no esté configurado.

## 1. Crear o vincular el proyecto

Instala/inicia sesión en Supabase CLI y vincula este repositorio con el proyecto:

```powershell
npx supabase login
npx supabase link --project-ref pmo-extend
```

## 2. Crear tablas, datos iniciales y políticas

```powershell
npx supabase db push
```

La migración crea:

- `pmo_field_options`: opciones, etiquetas, orden, estado y valor predeterminado de cada campo avanzado.
- `pmo_app_settings`: jornada esperada y límites de horas.
- `pmo_send_logs`: trazabilidad mínima de envíos con retención automática de 90 días.
- Políticas RLS de solo lectura para la app.
- Una función SQL transaccional disponible únicamente para `service_role`.

## 3. Autorizar al administrador

Configura en Supabase el correo o los correos PMO autorizados, separados por coma:

```powershell
npx supabase secrets set CONFIG_ADMIN_EMAILS=darwin.osorio@netwconsulting.com
npx supabase secrets set LOCATION_ADMIN_EMAILS=1darwin.osorio@netwconsulting.com
```

La Edge Function valida el JWT actual contra `/home/datosusuario` antes de permitir una escritura.

Configura también las credenciales técnicas usadas exclusivamente por la función de edición. Estos valores son secretos de Supabase y no deben añadirse a `src/environments`:

```powershell
npx supabase secrets set PMO_AUDIT_EMAIL="correo-tecnico" PMO_AUDIT_PASSWORD="clave-tecnica"
```

## 4. Desplegar la función administrativa

```powershell
npx supabase functions deploy pmo-config-admin --no-verify-jwt
npx supabase functions deploy pmo-user-audit --no-verify-jwt
npx supabase functions deploy pmo-management-edit --no-verify-jwt
npx supabase functions deploy pmo-location-admin --no-verify-jwt
npx supabase functions deploy pmo-send-logs --no-verify-jwt
```

`verify_jwt` se desactiva en el gateway porque el JWT pertenece al backend PMO; la función lo valida directamente contra el servicio PMO antes de usar la clave de servicio.

## 5. Conexión Angular

Este repositorio ya está conectado al proyecto `sjjzrlwskarbyfqxuknj`. La URL y la clave publicable están configuradas en:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Angular usa únicamente la clave publicable. Nunca copies `service_role` al frontend. Al abrir Configuración, el indicador debe mostrar `Origen: Supabase`.

La edición de reportes pasa por `pmo-management-edit`: valida que el reporte pertenezca al consultor autenticado y usa las credenciales técnicas solo dentro de Supabase para llamar al endpoint protegido.

Los logs se escriben y consultan mediante `pmo-send-logs`. La función valida primero la sesión contra PMO, limita cada consultor a sus propios registros y permite alcance global únicamente a los correos configurados como administradores. No se almacenan tokens, contraseñas ni respuestas completas del endpoint.
