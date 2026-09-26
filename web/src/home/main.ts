import './home.css'

// In production the markup is prerendered into home.html; the dev server
// serves the bare template, so render it client-side there.
if (import.meta.env.DEV) await import('./dev')
