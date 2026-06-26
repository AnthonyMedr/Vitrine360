export type Category = {
  id: string;
  slug: string;
  name: string;
  short: string;
};

export const categories: Category[] = [
  { id: "all", slug: "todos", name: "Todos", short: "Todos" },
  {
    id: "ripados-internos",
    slug: "ripados-internos",
    name: "Ripados Internos",
    short: "Ripados Internos",
  },
  {
    id: "ripados-externos",
    slug: "ripados-externos",
    name: "Ripados Externos",
    short: "Ripados Externos",
  },
  { id: "forros-pvc", slug: "forros-pvc", name: "Forros PVC", short: "Forros PVC" },
  {
    id: "tetos-laminados",
    slug: "tetos-laminados",
    name: "Tetos Laminados",
    short: "Tetos Laminados",
  },
  {
    id: "pisos-vinilicos",
    slug: "pisos-vinilicos",
    name: "Pisos Vinilicos",
    short: "Pisos Vinilicos",
  },
  { id: "chapas-uv", slug: "chapas-uv", name: "Chapas UV", short: "Chapas UV" },
  {
    id: "perfil-aluminio",
    slug: "perfil-aluminio",
    name: "Perfil de Aluminio",
    short: "Aluminio",
  },
  { id: "acm", slug: "acm", name: "ACM", short: "ACM" },
];
