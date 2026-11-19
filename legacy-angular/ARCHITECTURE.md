# Arquitectura de PMO Front

La aplicación usa Clean Architecture organizada primero por capas. Las cuatro capas principales viven directamente en `src/`; dentro de cada una, el código se agrupa por capacidad de negocio.

## Estructura

```text
src/
  domain/                 # modelos, reglas y contratos del negocio
    audit/
    auth/
    configuration/
    time-records/
  application/            # casos de uso y puertos de entrada/salida
    audit/
    auth/
    configuration/
    time-records/
  infrastructure/         # HTTP, Supabase, geolocalización y persistencia
    audit/
    auth/
    configuration/
    time-records/
  presentation/           # shell, páginas, componentes y pipes Angular
    shell/
    time-records/
  environments/           # configuración por ambiente
  main.ts                 # bootstrap de Angular
```

`main.ts`, `environments`, estilos y archivos estáticos son elementos técnicos de arranque, no capas del negocio.

## Regla de dependencias

```text
presentation ───────> application ───────> domain
                            ▲                  ▲
                            └── infrastructure ┘
```

- `domain` no depende de Angular ni de ninguna capa externa.
- `application` depende únicamente de `domain` y de sí misma.
- `infrastructure` implementa los contratos de `application` y `domain`.
- `presentation` consume casos de uso, fachadas y modelos; no llama HTTP, Supabase o geolocalización directamente.
- `presentation/shell/app.config.ts` y `presentation/shell/providers/` son el composition root: el único lugar donde se conectan contratos con adaptadores concretos.

Los alias `@domain`, `@application`, `@infrastructure`, `@presentation` y `@env` hacen explícita la dirección de cada importación.

## Flujo de registro de tiempos

1. La pantalla ejecuta `SendAllRecordsUseCase`.
2. El caso de uso delega cada elemento a `RegisterTimeRecordUseCase`.
3. Se obtiene la ubicación mediante `LocationGateway`.
4. Se registra el tiempo mediante `TimeRecordRepository`.
5. Se audita el resultado mediante `UserAuditGateway`.
6. Los adaptadores de infraestructura resuelven HTTP, Supabase y `navigator.geolocation`.

Los casos de uso no conocen URLs, `HttpClient`, `fetch`, Supabase ni APIs del navegador.

## Reglas automáticas

`npm run check:architecture` comprueba:

- existencia de las cuatro capas raíz;
- dirección permitida de las dependencias;
- ausencia de Angular en `domain` y `application`;
- ausencia de HTTP directo en `presentation`;
- ausencia de `any` explícito;
- endpoints centralizados en `environments`;
- inexistencia de código en la estructura heredada `src/app`.

`npm run verify` ejecuta estas reglas y una compilación de producción. `strict` y `strictTemplates` deben permanecer habilitados.

## Criterio de migración

Cambiar la API de PMO, Supabase o la fuente de geolocalización debe requerir reemplazar adaptadores y configuración del composition root, sin modificar modelos, reglas del dominio, casos de uso ni componentes.
