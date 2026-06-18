/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.aff?raw' {
  const content: string;
  export default content;
}

declare module '*.dic?raw' {
  const content: string;
  export default content;
}
