/* eslint-disable react-refresh/only-export-components */
import { IC } from "./icons.jsx"

export const NAV = [
  { id: "home",           icon: IC.dashboard, label: "Inicio" },
  { id: "factura",        icon: IC.xml,       label: "Validador XML" },
  { id: "cabys",          icon: IC.search,    label: "Asistente CABYS" },
  { id: "contribuyente",  icon: IC.user,      label: "Contribuyente" },
  { id: "exoneraciones",  icon: IC.shield,    label: "Exoneraciones" },
  { id: "tipocambio",     icon: IC.currency,  label: "Tipo de Cambio" },
  { id: "clientes",       icon: IC.star,      label: "Clientes" },
  { id: "acerca",         icon: IC.info,      label: "Acerca de" },
]

export const NAV_MAP = Object.fromEntries(NAV.map(n => [n.id, n]))

export const NAV_GROUPS = [
  { items: ["home"] },
  { label: "Comprobantes",  items: ["factura", "cabys"] },
  { label: "Consultas",     items: ["contribuyente", "exoneraciones"] },
  { label: "Finanzas",      items: ["tipocambio"] },
  { label: "Gestión",       items: ["clientes"] },
]
