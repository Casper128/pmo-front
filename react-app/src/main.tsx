import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import './index.css'
import { environment } from '@env/environment'
import { AppProviders } from '@presentation/providers/app-providers'
import { createContainer } from '@presentation/providers/container'
import { createQueryClient } from '@presentation/providers/query-client'
import { appRoutes } from '@presentation/shell/routes'

const root = document.getElementById('root')
if (!root) throw new Error('No se encontró el elemento #root')

// Se crean una sola vez, fuera del árbol React: StrictMode no debe duplicar servicios con estado.
const container = createContainer(environment)
const queryClient = createQueryClient(container.auth)
const router = createBrowserRouter(appRoutes)

createRoot(root).render(
  <StrictMode>
    <AppProviders container={container} queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
