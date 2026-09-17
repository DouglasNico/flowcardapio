import {
  assinarCloudinary,
  bearer,
  exigirLojaToken,
  fotoDaLoja,
  json,
  normalizarChave,
  preflight,
  secretCloudinary,
  CLOUD_NAME,
  CLOUDINARY_API_KEY
} from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });
  try {
    const chave = normalizarChave(req.body && req.body.chave);
    const publicId = String((req.body && req.body.publicId) || "").trim();
    await exigirLojaToken(bearer(req), chave);
    if (!fotoDaLoja(publicId, chave)) {
      return json(res, 403, { error: "Esta foto não pertence à loja." });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: publicId, timestamp };
    const signature = assinarCloudinary(params, secretCloudinary());
    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      api_key: CLOUDINARY_API_KEY,
      signature
    });
    const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = await resp.json();
    if (!resp.ok || (data.error && data.error.message)) {
      return json(res, 500, { error: (data.error && data.error.message) || "Falha ao apagar a foto." });
    }
    return json(res, 200, { ok: true, result: data.result || "ok" });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || "Falha ao apagar a foto." });
  }
}
