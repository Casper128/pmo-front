# Playful mascot

Este componente es únicamente decorativo y no participa en la lógica de negocio. Los modelos se renderizan en 3D con Three.js y usan un emoji como respaldo cuando WebGL no está disponible.

## Distribución

- `dog`: navegación y envío de registros.
- `penguin`: apertura y guardado de ediciones.
- `dragon`: celebración de procesos completados.

Para desactivarlo sin eliminar código, cambia `playfulMascotEnabled` a `false` en:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Para retirarlo completamente, elimina esta carpeta, el elemento `<app-playful-mascot />` y sus dos imports en `presentation/shell/app.component.ts`. Después elimina las llamadas `mascot.play(...)` donde se quiera retirar cada evento.

Para retirar solo un personaje, cambia `mascotForMoment` en `playful-mascot.service.ts` y elimina su método constructor 3D en `playful-mascot.component.ts`.
