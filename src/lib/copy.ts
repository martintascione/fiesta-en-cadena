export const COPY_FIELDS = [
  { key: "eyebrow", label: "Línea de arriba", multiline: false },
  { key: "title", label: "Título", multiline: false },
  { key: "hosts", label: "Cumpleañeros (línea bajo el título)", multiline: false },
  { key: "synopsis", label: "Texto principal", multiline: true },
  { key: "joke", label: "Frase en azul", multiline: true },
  { key: "tag1", label: "Etiqueta 1", multiline: false },
  { key: "tag2", label: "Etiqueta 2", multiline: false },
  { key: "tag3", label: "Etiqueta 3", multiline: false },
  { key: "when", label: "Cuándo", multiline: false },
  { key: "whenNote", label: "Cuándo (nota)", multiline: false },
  { key: "where", label: "Dónde", multiline: false },
  { key: "whereNote", label: "Dónde (nota)", multiline: false },
  { key: "bar", label: "Barra libre", multiline: false },
  { key: "barNote", label: "Barra libre (nota)", multiline: false },
  { key: "formTitle", label: "Título del formulario", multiline: false },
  { key: "formSub", label: "Texto del formulario", multiline: false },
  { key: "button", label: "Botón", multiline: false },
  { key: "buttonLoading", label: "Botón mientras carga", multiline: false },
] as const;

export type CopyKey = (typeof COPY_FIELDS)[number]["key"];
export type Copy = Record<CopyKey, string>;

export const DEFAULT_COPY: Copy = {
  eyebrow: "Estás invitad@ al",
  title: "Tricumple",
  hosts: "Giu, Manuch & Tincho",
  synopsis: "Tres cumples, una sola noche y barra libre. Juntamos todo en una fiesta porque hacer tres era mucho. Vení, que se va a descontrolar.",
  joke: "Si no venís, date como eliminad@ de nuestras vidas.",
  tag1: "Sáb 7/11 · 1:30 hs",
  tag2: "Barra libre · $15.000",
  tag3: "DJ invitado ;)",
  when: "Sáb 7/11 · 1:30 hs",
  whenNote: "la noche del viernes",
  where: "Niceto Vega 5635",
  whereNote: "Palermo",
  bar: "$15.000",
  barNote: "toda la noche",
  formTitle: "Confirmá tu lugar.",
  formSub: "Solo tu nombre y email. Nada más.",
  button: "Yendo",
  buttonLoading: "Abrime que estoy afuera",
};

export function mergeCopy(rows: { key: string; value: string }[] | null | undefined): Copy {
  const c = { ...DEFAULT_COPY };
  for (const r of rows ?? []) if (r.key in c) c[r.key as CopyKey] = r.value;
  return c;
}
