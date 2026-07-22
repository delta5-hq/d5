import type { Route } from '@playwright/test'

export const htmlPage = (body: string): string => `<!DOCTYPE html><html><body>${body}</body></html>`

export const serveHtml =
  (html: string) =>
  (route: Route): Promise<void> =>
    route.fulfill({ status: 200, contentType: 'text/html', body: html })
