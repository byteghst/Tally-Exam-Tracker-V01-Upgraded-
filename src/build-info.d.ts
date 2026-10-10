// Injected at build time by vite.config.ts (`define`).
declare const __APP_COMMIT__: string;
declare const __APP_BUILT__: string;
// CI run number (matches the Android versionCode and the `build-N` release tag).
// 0 for local/dev builds, which disables the update check.
declare const __APP_BUILD__: number;
