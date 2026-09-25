import type { Plugin, ViteDevServer } from 'vite'
import { handleCatalogRequest } from './catalog.ts'

export function catalogPlugin(): Plugin {
  const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
    server.middlewares.use((request, response, next) => {
      void handleCatalogRequest(request, response)
        .then((handled) => {
          if (!handled) next()
        })
        .catch(next)
    })
  }
  return {
    name: 'mediashelf-catalog',
    configureServer: configure,
    configurePreviewServer: configure,
  }
}
