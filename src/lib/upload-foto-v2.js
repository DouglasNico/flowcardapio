export async function enviarFotoGestaoV2(file, sign, request = fetch) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) throw Error('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.');
  const signature = await sign();
  if (!/^[A-Za-z0-9_-]+$/.test(signature.cloudName || '') || !/^\d+$/.test(signature.apiKey || '') || !/^flowpdv-v2\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/.test(signature.publicId || '') || !/^[a-f0-9]{40}$/.test(signature.signature || '') || !Number.isSafeInteger(signature.timestamp)) throw Error('Assinatura de upload inválida. Tente novamente.');
  const body = new FormData(); body.append('file', file); body.append('api_key', signature.apiKey); body.append('timestamp', String(signature.timestamp)); body.append('signature', signature.signature); body.append('public_id', signature.publicId); body.append('overwrite', 'false');
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
  let response;
  try { response = await request(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body, signal: controller.signal }); }
  catch { throw Error('Não foi possível confirmar o envio. Confira sua conexão e tente novamente.'); }
  finally { clearTimeout(timer); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw Error('O serviço de imagens recusou o envio. Tente outra imagem.');
  let url; try { url = new URL(data.secure_url); } catch { throw Error('O serviço não retornou uma foto válida.'); }
  if (data.public_id !== signature.publicId || data.resource_type !== 'image' || url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || !url.pathname.startsWith(`/${signature.cloudName}/image/upload/`) || url.search || url.hash || url.username || url.password || url.port) throw Error('A resposta do serviço não corresponde à foto enviada.');
  return url.href;
}
