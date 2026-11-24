/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
    // PDF.js loads its native canvas and worker dynamically, outside Next's trace.
    outputFileTracingIncludes: {
      '/api/process-pdf': [
        './node_modules/@napi-rs/canvas*/**/*',
        './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      ],
    },
  },
};

export default nextConfig;
