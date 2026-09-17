import {
  assinarCloudinary,
  bearer,
  exigirLojaToken,
  json,
  normalizarChave,
  preflight,
  publicIdProduto,
  pastaCloudinary,
  secretCloudinary,
  CLOUD_NAME,
  CLOUDINARY_API_KEY,
  PRESET
} from "./_lib.js";

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Use POST." });
  try {
    const chave = normalizarChave(req.body && req.body.chave);
    const produtoId = String((req.body && req.body.produtoId) || "").trim();
    await exigirLojaToken(bearer(req), chave);
    const publicId = publicIdProduto(chave, produtoId);
    const assetFolder = pastaCloudinary(chave);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      asset_folder: assetFolder,
      invalidate: "true",
      overwrite: "true",
      public_id: publicId,
      timestamp,
      upload_preset: PRESET
    };
    const signature = assinarCloudinary(params, secretCloudinary());
    return json(res, 200, {
      ok: true,
      cloudName: CLOUD_NAME,
      apiKey: CLOUDINARY_API_KEY,
      timestamp,
      signature,
      publicId,
      assetFolder,
      uploadPreset: PRESET
    });
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || "Falha ao assinar upload." });
  }
}
