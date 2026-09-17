import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase.js";
import { normalizarChave } from "./chave.js";

const DOMINIO_LOJA = "pdv.flowpdv.com.br";
const SAL_ACESSO = "flowpdv-2026-acesso-loja";
const SESSAO_KEY = "flowpdv_cardapio_sessao";

export function emailDaLoja(chave) {
  return `loja_${String(chave || "").trim().toLowerCase()}@${DOMINIO_LOJA}`;
}

function senhaDaLoja(chave) {
  return `${String(chave || "").trim().toUpperCase()}.${SAL_ACESSO}`;
}

export async function entrarComoLoja(chave) {
  const alvo = normalizarChave(chave);
  if (!alvo) throw new Error("Informe a chave da licença.");
  const email = emailDaLoja(alvo);
  const senha = senhaDaLoja(alvo);

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    const codigo = (e && e.code) || "";
    const podeCriar = codigo === "auth/user-not-found"
      || codigo === "auth/invalid-credential"
      || codigo === "auth/invalid-login-credentials";
    if (!podeCriar) throw e;
    try {
      await createUserWithEmailAndPassword(auth, email, senha);
    } catch (eCriacao) {
      if ((eCriacao && eCriacao.code) !== "auth/email-already-in-use") throw eCriacao;
      await signInWithEmailAndPassword(auth, email, senha);
    }
  }
  return alvo;
}

export async function loginGestor(chaveBruta, pin, lembrar = true) {
  const chave = await entrarComoLoja(chaveBruta);
  const snap = await getDoc(doc(db, "licencas", chave));
  if (!snap.exists()) throw new Error("Chave de licença não encontrada no sistema.");
  const licenca = snap.data() || {};
  const status = String(licenca.status || "").trim().toLowerCase();
  if (status === "bloqueado" || status === "bloqueada") {
    throw new Error("Esta licença está bloqueada no Painel Central.");
  }
  const pinCorreto = String(licenca.pinGerente || licenca.pinMestre || "").trim();
  if (!pinCorreto) throw new Error("Senha do gestor não configurada para esta licença.");
  if (String(pin || "").trim() !== pinCorreto) throw new Error("Senha do gestor incorreta.");

  const sessao = {
    chave,
    pin: String(pin || "").trim(),
    storedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12
  };
  if (lembrar) localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao));
  else localStorage.removeItem(SESSAO_KEY);

  return { chave, licenca };
}

export function lerSessaoLocal() {
  try {
    const raw = localStorage.getItem(SESSAO_KEY);
    if (!raw) return null;
    const sessao = JSON.parse(raw);
    if (!sessao || !sessao.chave || !sessao.pin) return null;
    if (Number(sessao.expiresAt) && Date.now() > Number(sessao.expiresAt)) {
      localStorage.removeItem(SESSAO_KEY);
      return null;
    }
    return sessao;
  } catch {
    return null;
  }
}

export async function sairDaLoja() {
  localStorage.removeItem(SESSAO_KEY);
  try { await signOut(auth); } catch { /* ignore */ }
}

export function nomeDaLoja(licenca) {
  return String(
    (licenca && (licenca.razaoSocial || licenca.nomeFantasia || licenca.nome)) || "Minha loja"
  ).trim();
}
