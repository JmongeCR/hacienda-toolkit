/* ─────────────────────────────────────────────
   CABYS — catálogos, jerarquías y sugerencias
───────────────────────────────────────────── */

export const CABYS_CAT1 = {
  "0":"Productos agrícolas y animales","1":"Silvicultura, pesca y minerales",
  "2":"Combustibles y productos mineros","3":"Alimentos, bebidas y tabaco",
  "4":"Textiles, confección y cuero","5":"Madera, papel, químicos y farmacéuticos",
  "6":"Metales, maquinaria y equipo","7":"Equipos de transporte",
  "8":"Servicios","9":"Transacciones y bienes especiales",
}

export const CABYS_CAT2 = {
  "31":"Carnes, pescado y mariscos","32":"Lácteos, huevos y grasas","33":"Frutas y verduras",
  "34":"Cereales, harinas y almidones","35":"Alimentos procesados","36":"Bebidas",
  "37":"Tabaco","38":"Alimentos para animales","39":"Otros alimentos",
  "51":"Productos de madera y corcho","52":"Pasta, papel y cartón",
  "53":"Productos impresos y grabados","54":"Medicamentos y farmacéuticos",
  "55":"Caucho y plástico","56":"Vidrio, cerámica y materiales de construcción",
  "61":"Hierro, acero y metales","62":"Maquinaria y equipo general",
  "63":"Equipo eléctrico y electrónico","64":"Instrumentos y óptica",
  "71":"Vehículos automotores","72":"Otro equipo de transporte",
  "81":"Servicios de construcción e inmobiliarios","82":"Distribución y comercio",
  "83":"Servicios empresariales y profesionales","84":"Telecomunicaciones e informática",
  "85":"Servicios de transporte","86":"Soporte a negocios",
  "87":"Servicios agropecuarios","88":"Servicios financieros y seguros",
  "89":"Servicios de arrendamiento","91":"Servicios de salud",
  "92":"Servicios educativos","93":"Servicios de alcantarillado y residuos",
  "94":"Servicios de asociaciones y organizaciones",
  "95":"Servicios de reparación y mantenimiento",
  "96":"Servicios recreativos, culturales y deportivos",
  "97":"Servicios de hospedaje y alimentación",
  "98":"Servicios domésticos y personales",
  "99":"Servicios y transacciones especiales",
}

export const CABYS_SUGERENCIAS = [
  { label: "Restaurante / Soda",    q: "servicio comidas restaurante" },
  { label: "Software / TI",        q: "servicios software tecnologia informatica" },
  { label: "Contabilidad",          q: "servicios contables auditoria" },
  { label: "Transporte",            q: "transporte pasajeros" },
  { label: "Construcción",          q: "servicios construccion" },
  { label: "Farmacia / Salud",      q: "medicamentos farmacia salud" },
  { label: "Ferretería",            q: "materiales ferreteria herramientas" },
  { label: "Ropa / Calzado",        q: "prendas vestir ropa calzado" },
  { label: "Agricultura",           q: "productos agricolas cultivos" },
  { label: "Legal / Asesoría",      q: "servicios juridicos legales asesoria" },
]

/** Mapa AE → términos de búsqueda CABYS */
export const AE_MAP = [
  { kw:["restaurante","soda","comida","almuerzo","cena","cafeteria","cafetería"],        ciiu:"5610", label:"Restaurantes y servicio móvil de comidas",         q:"servicios restaurante comidas alimentacion" },
  { kw:["pulperia","pulpería","abarrotes","tienda","minisuper","colmado"],               ciiu:"4711", label:"Comercio al por menor en almacenes no especializados", q:"comercio minorista abarrotes productos" },
  { kw:["software","programacion","programación","desarrollo","sistemas","informatica"], ciiu:"6201", label:"Actividades de programación informática",             q:"servicios software programacion tecnologia" },
  { kw:["contabilidad","contador","auditoria","auditoría","fiscal","financiero"],        ciiu:"6920", label:"Actividades de contabilidad y auditoría",              q:"servicios contables auditoria contabilidad" },
  { kw:["abogado","juridico","jurídico","legal","notario","derecho"],                   ciiu:"6910", label:"Actividades jurídicas",                                q:"servicios juridicos legales abogado" },
  { kw:["construccion","construcción","obra","edificacion","contratista"],               ciiu:"4100", label:"Construcción de edificios",                           q:"servicios construccion obra edificacion" },
  { kw:["transporte","taxi","uber","carga","flete","logistica","logística"],             ciiu:"4921", label:"Transporte de pasajeros",                             q:"transporte pasajeros carga flete" },
  { kw:["medico","médico","clinica","clínica","salud","doctor","enfermeria"],            ciiu:"8621", label:"Actividades de médicos y odontólogos",                q:"servicios medicos salud clinica" },
  { kw:["farmacia","medicamento","drogueria","droguería"],                               ciiu:"4773", label:"Comercio al por menor de productos farmacéuticos",    q:"medicamentos farmacia salud" },
  { kw:["ferreteria","ferretería","herramienta","pintura","materiales"],                 ciiu:"4752", label:"Comercio de artículos de ferretería",                 q:"materiales ferreteria herramientas" },
  { kw:["ropa","vestir","calzado","moda","textil","confeccion","confección"],            ciiu:"4771", label:"Comercio al por menor de prendas de vestir",          q:"prendas vestir ropa calzado moda" },
  { kw:["agricultura","agricola","agrícola","cultivo","cosecha","finca"],               ciiu:"0111", label:"Cultivo de cereales y otros cultivos",                q:"productos agricolas cultivos cosecha" },
  { kw:["educacion","educación","escuela","academia","colegio","enseñanza","tutoria"],   ciiu:"8542", label:"Enseñanza superior y técnica",                       q:"servicios educacion ensenanza capacitacion" },
  { kw:["hotel","hospedaje","hostal","alquiler","airbnb","turismo"],                     ciiu:"5510", label:"Actividades de alojamiento",                         q:"hospedaje alojamiento hotel turismo" },
  { kw:["publicidad","marketing","diseño","grafico","gráfico","agencia","branding"],    ciiu:"7311", label:"Agencias de publicidad",                              q:"servicios publicidad marketing diseno" },
  { kw:["limpieza","aseo","conserje","janitorial","mantenimiento"],                      ciiu:"8121", label:"Limpieza general de edificios",                       q:"servicios limpieza aseo mantenimiento" },
  { kw:["mecanica","mecánica","taller","automovil","automóvil","vehiculo","vehículo"],  ciiu:"4520", label:"Mantenimiento y reparación de vehículos",             q:"reparacion mantenimiento vehiculos taller" },
  { kw:["electricista","electrico","eléctrico","instalacion","instalación"],             ciiu:"4321", label:"Instalaciones eléctricas",                           q:"instalacion electrica servicios electricos" },
  { kw:["peluqueria","peluquería","barberia","barbería","salon","salón","estetica"],    ciiu:"9602", label:"Peluquería y tratamientos de belleza",                q:"servicios peluqueria estetica belleza" },
  { kw:["veterinario","veterinaria","mascota","animal","clinica veterinaria"],           ciiu:"7500", label:"Actividades veterinarias",                           q:"servicios veterinarios animales mascotas" },
  { kw:["supermercado","autoservicio","hipermercado","maxi"],                            ciiu:"4711", label:"Comercio al por menor en supermercados",             q:"supermercado productos consumo" },
  { kw:["panaderia","panadería","reposteria","repostería","pasteleria","pastelería"],   ciiu:"1071", label:"Elaboración de pan y productos de panadería",        q:"pan panaderia reposteria productos horneados" },
  { kw:["importacion","importación","exportacion","exportación","comercio","aduanas"],  ciiu:"4690", label:"Comercio al por mayor no especializado",              q:"comercio importacion exportacion productos" },
  { kw:["fotografia","fotografía","video","audiovisual","produccion audiovisual"],       ciiu:"7420", label:"Actividades de fotografía",                          q:"servicios fotografia video audiovisual" },
  { kw:["seguridad","vigilancia","guardia","custodia"],                                  ciiu:"8010", label:"Actividades de seguridad privada",                   q:"servicios seguridad vigilancia" },
]
