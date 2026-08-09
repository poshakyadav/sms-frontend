import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },              // new homepage
  { path: 'public/about', renderMode: RenderMode.Prerender },
  { path: 'public/pricing', renderMode: RenderMode.Prerender },
  { path: 'public/register', renderMode: RenderMode.Prerender },
  { path: 'public/terms', renderMode: RenderMode.Prerender },
  { path: 'public/privacy', renderMode: RenderMode.Prerender },
  { path: 'public/security', renderMode: RenderMode.Prerender },
  { path: 'public/verify/:token', renderMode: RenderMode.Client }, // no SEO value
  { path: '**', renderMode: RenderMode.Client },                // login, school app, super admin
];
