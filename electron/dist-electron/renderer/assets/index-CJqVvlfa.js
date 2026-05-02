async function render() {
  const app = document.querySelector("#app");
  if (!app) {
    throw new Error("Renderer root element #app was not found.");
  }
  const version = await window.desktop?.getAppVersion?.() ?? "unknown";
  app.innerHTML = `
    <section style="font-family: sans-serif; padding: 24px;">
      <h1 style="margin: 0 0 12px;">Beaverhack2026</h1>
      <p style="margin: 0 0 8px;">Electron renderer is running.</p>
      <p style="margin: 0; color: #555;">App version: ${version}</p>
    </section>
  `;
}
void render();
