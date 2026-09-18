import { brl } from "./format.js";

export const CANAL_LOJA = "Delivery & Retiradas";

export const DIAS = [
  { id: "seg", curto: "Seg", label: "Segunda" },
  { id: "ter", curto: "Ter", label: "Terça" },
  { id: "qua", curto: "Qua", label: "Quarta" },
  { id: "qui", curto: "Qui", label: "Quinta" },
  { id: "sex", curto: "Sex", label: "Sexta" },
  { id: "sab", curto: "Sáb", label: "Sábado" },
  { id: "dom", curto: "Dom", label: "Domingo" }
];

export const HORARIO_PRESETS = [
  { id: "jantar", label: "Ter a Dom · jantar", dias: ["ter", "qua", "qui", "sex", "sab", "dom"], abre: "18:00", fecha: "23:00" },
  { id: "diario", label: "Todos os dias", dias: DIAS.map((d) => d.id), abre: "11:00", fecha: "23:00" },
  { id: "almoco", label: "Seg a Sex · almoço", dias: ["seg", "ter", "qua", "qui", "sex"], abre: "11:00", fecha: "15:00" },
  { id: "fds", label: "Sex a Dom", dias: ["sex", "sab", "dom"], abre: "18:00", fecha: "00:00" }
];

export const ENTREGA_PRESETS = [
  { min: 20, max: 30 },
  { min: 30, max: 45 },
  { min: 40, max: 60 },
  { min: 40, max: 70 },
  { min: 50, max: 80 },
  { min: 60, max: 90 }
];

export const MINIMO_PRESETS = [0, 15, 20, 25, 30, 40, 50];

const ORDEM = DIAS.map((d) => d.id);

function nomeDia(id) {
  const d = DIAS.find((x) => x.id === id);
  return d ? d.curto : id;
}

export function textoHorario(dias, abre, fecha) {
  const ids = ORDEM.filter((id) => (dias || []).includes(id));
  if (!ids.length || !abre || !fecha) return "";
  let faixa;
  if (ids.length === 7) faixa = "Todos os dias";
  else {
    const idxs = ids.map((id) => ORDEM.indexOf(id));
    const seguido = idxs.every((n, i) => i === 0 || n === idxs[i - 1] + 1);
    faixa = (seguido && ids.length > 1)
      ? `${nomeDia(ids[0])} a ${nomeDia(ids[ids.length - 1])}`
      : ids.map(nomeDia).join(", ");
  }
  return `${faixa} · ${abre}–${fecha}`;
}

export function textoEntrega(min, max) {
  const a = Number(min) || 0;
  const b = Number(max) || 0;
  if (!a && !b) return "";
  if (a && b && a !== b) return `${a}–${b} min`;
  return `${a || b} min`;
}

export function textoMinimo(valor) {
  const n = Number(valor) || 0;
  return n > 0 ? `Mín. ${brl(n)}` : "Sem pedido mínimo";
}

function parseHoras(texto) {
  const m = String(texto || "").match(/(\d{1,2}):(\d{2})/g) || [];
  const norm = (h) => {
    const [hh, mm] = h.split(":");
    return `${String(hh).padStart(2, "0")}:${mm}`;
  };
  return m.map(norm);
}

function parseDias(texto) {
  const t = String(texto || "").toLowerCase();
  if (/todos os dias/.test(t)) return DIAS.map((d) => d.id);
  const mapa = [
    ["segunda", "seg"], ["terça", "ter"], ["terca", "ter"], ["quarta", "qua"],
    ["quinta", "qui"], ["sexta", "sex"], ["sábado", "sab"], ["sabado", "sab"], ["domingo", "dom"],
    ["seg", "seg"], ["ter", "ter"], ["qua", "qua"], ["qui", "qui"], ["sex", "sex"], ["sáb", "sab"], ["sab", "sab"], ["dom", "dom"]
  ];
  const aMatch = t.match(/(seg|ter|qua|qui|sex|s[áa]b|dom)[a-zç]*\s*a\s*(seg|ter|qua|qui|sex|s[áa]b|dom)/i);
  if (aMatch) {
    const a = mapa.find((x) => aMatch[1].startsWith(x[0].slice(0, 3)))?.[1];
    const b = mapa.find((x) => aMatch[2].startsWith(x[0].slice(0, 3)))?.[1];
    if (a && b) {
      const i = ORDEM.indexOf(a);
      const j = ORDEM.indexOf(b);
      if (i >= 0 && j >= i) return ORDEM.slice(i, j + 1);
    }
  }
  const ids = [];
  mapa.forEach(([k, id]) => {
    if (t.includes(k) && !ids.includes(id)) ids.push(id);
  });
  return ORDEM.filter((id) => ids.includes(id));
}

export function lerFormatoLoja(config) {
  const cfg = config || {};
  const horas = parseHoras(cfg.horarioTexto);
  const dias = Array.isArray(cfg.horarioDias) && cfg.horarioDias.length
    ? ORDEM.filter((id) => cfg.horarioDias.includes(id))
    : parseDias(cfg.horarioTexto);
  const entregaNums = String(cfg.entregaTexto || "").match(/\d+/g) || [];
  const minTxt = String(cfg.pedidoMinimoTexto || "");
  const minVal = cfg.pedidoMinimoValor != null
    ? Number(cfg.pedidoMinimoValor)
    : (/sem pedido m[ií]nimo/i.test(minTxt) ? 0 : Number((minTxt.match(/\d+/) || [0])[0]));
  return {
    dias: dias.length ? dias : ["ter", "qua", "qui", "sex", "sab", "dom"],
    abre: cfg.horarioAbre || (horas.length >= 2 ? horas[0] : "18:00"),
    fecha: cfg.horarioFecha || horas[horas.length >= 2 ? 1 : 0] || "23:00",
    entregaMin: Number(cfg.entregaMin) || Number(entregaNums[0]) || 40,
    entregaMax: Number(cfg.entregaMax) || Number(entregaNums[1]) || Number(entregaNums[0]) || 70,
    pedidoMinimoValor: Number.isFinite(minVal) ? minVal : 0
  };
}

export function patchLoja(form) {
  const horarioTexto = textoHorario(form.dias, form.abre, form.fecha);
  const entregaTexto = textoEntrega(form.entregaMin, form.entregaMax);
  const pedidoMinimoTexto = textoMinimo(form.pedidoMinimoValor);
  return {
    horarioDias: form.dias,
    horarioAbre: form.abre,
    horarioFecha: form.fecha,
    entregaMin: Number(form.entregaMin) || 0,
    entregaMax: Number(form.entregaMax) || 0,
    pedidoMinimoValor: Number(form.pedidoMinimoValor) || 0,
    horarioTexto,
    entregaTexto,
    pedidoMinimoTexto
  };
}
