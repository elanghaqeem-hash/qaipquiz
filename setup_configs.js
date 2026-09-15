const fs = require('fs');

const tsconfig = {
  compilerOptions: {
    target: 'es5',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'bundler',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'preserve',
    incremental: true,
    plugins: [{ name: 'next' }],
    paths: {
      '@/*': ['./src/*']
    }
  },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
  exclude: ['node_modules']
};
fs.writeFileSync('tsconfig.json', JSON.stringify(tsconfig, null, 2), 'utf8');

const postcss = module.exports = {\n plugins: {\n tailwindcss: {},\n autoprefixer: {},\n },\n};\n;
fs.writeFileSync('postcss.config.js', postcss, 'utf8');

const tailwind = /** @type {import('tailwindcss').Config} */\nmodule.exports = {\n darkMode: 'class',\n content: [\n './src/**/*.{js,ts,jsx,tsx,mdx}',\n ],\n theme: {\n extend: {\n colors: {\n brand: {\n navy: '#0f172a',\n indigo: '#1e1b4b',\n blue: '#2563eb',\n cyan: '#06b6d4',\n emerald: '#10b981',\n amber: '#f59e0b',\n rose: '#f43f5e',\n }\n }\n },\n },\n plugins: [],\n};\n;
fs.writeFileSync('tailwind.config.js', tailwind, 'utf8');

const nextConfig = /** @type {import('next').NextConfig} */\nconst nextConfig = {\n reactStrictMode: false,\n};\n\nmodule.exports = nextConfig;\n;
fs.writeFileSync('next.config.js', nextConfig, 'utf8');

console.log('Configs written successfully');
