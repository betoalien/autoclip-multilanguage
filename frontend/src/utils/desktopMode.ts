export async function isDesktopMode(): Promise<boolean> {
  // Always allow settings and desktop features in local web and Tauri modes
  return true
}

export function isTauriEnvironment(): boolean {
  return Boolean((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__)
}

