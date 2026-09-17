import {
  assinarCloudinary,
  bearer,
  exigirLojaToken,
  fotoDaLoja,
  idsDestroy,
  json,
  normalizarChave,
  preflight,
  secretCloudinary,
  CLOUD_NAME,
  CLOUDINARY_API_KEY
} from "./_lib.js";

async function destroyCloudinary(publicId, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: "true", public_id: publicId, timestamp };
  const signature = assinarCloudinary(params, secret);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    invalidate: "true",
    api_key: CLOUDINARY_API_KEY,
    signature
  });
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await resp.json().catch(() => ({}));
  return { resp, data };
}

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
    const secret = secretCloudinary();
    let ultimo = { result: "not found" };
    for (const id of idsDestroy(publicId, chave)) {
      const { data } = await destroyCloudinary(id, secret);
      ultimo = data;
      const result = String((data && data.result) || "").toLowerCase();
      const msg = String((data && data.error && data.error.message) || "");
      if (result === "ok" || result === "not found") {
        return json(res, 200, { ok: true, result: data.result || "ok" });
      }
      if (msg && !/general error/i.test(msg)) {
        return json(res, 200, { ok: true, result: "unlinked", aviso: msg });
      }
    }
    return json(res, 200, { ok: true, result: ultimo.result || "unlinked" });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || "Falha ao apagar a foto." });
  }
}
