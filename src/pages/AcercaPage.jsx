import { IC } from "../constants/icons.jsx"
import { loadFavs, loadH } from "../constants/storage.js"

export function AcercaPage({ activities }) {
  const favCount  = loadFavs().length
  const actCount  = activities.length
  const histCount = ["ht_cabys","ht_ae","ht_fe","ht_exo"].reduce((n,k) => n + loadH(k).length, 0)

  const TOOLS = [
    { icon:IC.xml,      name:"Validador XML",             desc:"Carga y analiza comprobantes XML: emisor, receptor, líneas, CABYS, IVA e inconsistencias" },
    { icon:IC.search,   name:"Asistente CABYS",           desc:"Búsqueda en el catálogo oficial por producto, actividad o descripción de negocio" },
    { icon:IC.user,     name:"Contribuyentes",            desc:"Estado fiscal, régimen tributario y actividades económicas por cédula, DIMEX o NITE" },
    { icon:IC.shield,   name:"Exoneraciones",             desc:"Verificación de exoneraciones de impuestos registradas en Hacienda" },
    { icon:IC.currency, name:"Tipo de Cambio",            desc:"USD y EUR en tiempo real desde BCCR, historial 30 días y conversor de divisas" },
    { icon:IC.star,     name:"Clientes",                  desc:"Agenda local de clientes con favoritos CABYS por cliente (almacenamiento en dispositivo)" },
  ]

  const SOURCES = [
    { name:"Ministerio de Hacienda de Costa Rica", url:"api.hacienda.go.cr",  desc:"CABYS, Contribuyentes, Facturas, Exoneraciones, Tipo de Cambio",  color:"#f0fdf4", dot:"#16a34a" },
    { name:"Banco Central de Costa Rica (BCCR)",   url:"gee.bccr.fi.cr",      desc:"Indicadores económicos, tipo de cambio histórico USD/CRC",         color:"#eff6ff", dot:"#2563eb" },
  ]

  const TECH = [
    { name:"React 19",   color:"#0891b2", bg:"#ecfeff" },
    { name:"Vite 7",     color:"#7c3aed", bg:"#f5f3ff" },
    { name:"JavaScript", color:"#b45309", bg:"#fffbeb" },
  ]

  const STATS = [
    { label:"Consultas realizadas", value:actCount,  icon:"🔍", desc:"registradas en esta sesión" },
    { label:"Favoritos guardados",  value:favCount,  icon:"⭐", desc:"códigos CABYS en favoritos" },
    { label:"Historial almacenado", value:histCount, icon:"🕒", desc:"búsquedas en historial local" },
  ]

  return (
    <div className="pageWrap pageCentered acercaWrap">

      <div className="acercaHero">
        <div className="acercaHeroLeft">
          <div className="acercaLogo">{IC.bolt}</div>
          <div>
            <h1 className="acercaAppName">HaciendaKit <span className="acercaV2Badge">V2</span></h1>
            <p className="acercaTagline">Plataforma especializada en validación y análisis de comprobantes electrónicos de Costa Rica.</p>
          </div>
        </div>
        <div className="acercaMeta">
          <div className="acercaMetaItem">
            <span className="acercaMetaLabel">Versión</span>
            <span className="acercaVersionBadge">v2.0.0</span>
          </div>
          <div className="acercaMetaItem">
            <span className="acercaMetaLabel">Última actualización</span>
            <span className="acercaMetaVal">Junio 2026</span>
          </div>
          <div className="acercaMetaItem">
            <span className="acercaMetaLabel">Desarrollado por</span>
            <span className="acercaMetaVal acercaAuthor">Jean Monge</span>
          </div>
        </div>
      </div>

      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Herramientas disponibles</div>
          <span className="acercaBadgeCount">{TOOLS.length}</span>
        </div>
        <div className="acercaToolsGrid">
          {TOOLS.map((t, i) => (
            <div key={i} className="acercaToolCard">
              <div className="acercaToolIcon">{t.icon}</div>
              <div>
                <div className="acercaToolName">{t.name}</div>
                <div className="acercaToolDesc">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Estadísticas de uso</div>
          <span className="acercaMetaLabel">datos locales · este dispositivo</span>
        </div>
        <div className="acercaStatsRow">
          {STATS.map((s, i) => (
            <div key={i} className="acercaStatCard">
              <div className="acercaStatIcon">{s.icon}</div>
              <div className="acercaStatVal">{s.value}</div>
              <div className="acercaStatLabel">{s.label}</div>
              <div className="acercaStatDesc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Fuentes de información</div>
        </div>
        <div className="acercaSourcesList">
          {SOURCES.map((s, i) => (
            <div key={i} className="acercaSourceCard" style={{ background: s.color }}>
              <div className="acercaSourceDot" style={{ background: s.dot }} />
              <div>
                <div className="acercaSourceName">{s.name}</div>
                <div className="acercaSourceUrl">{s.url}</div>
                <div className="acercaSourceDesc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="acercaDisclaimer">
          <div className="acercaDisclaimerIcon">{IC.warning}</div>
          <p>
            <strong>HaciendaKit</strong> no es un producto oficial del Ministerio de Hacienda ni del Banco Central de Costa Rica. La información mostrada proviene de fuentes públicas y <strong>debe verificarse para procesos oficiales</strong>. Para trámites formales, consultá directamente con Hacienda o un profesional tributario certificado.
          </p>
        </div>
      </div>

      <div className="acercaSection">
        <div className="acercaSectionHeader">
          <div className="acercaSectionTitle">Tecnologías utilizadas</div>
        </div>
        <div className="acercaTechRow">
          {TECH.map((t, i) => (
            <div key={i} className="acercaTechBadge" style={{ background: t.bg, color: t.color }}>
              {t.name}
            </div>
          ))}
          <div className="acercaTechBadge" style={{ background:"#f0fdf4", color:"#16a34a" }}>APIs Públicas CR</div>
        </div>
        <p className="acercaFootNote">
          Aplicación de página única (SPA) sin backend propio. Todas las consultas se realizan directamente a las APIs públicas de las instituciones costarricenses. Los datos se almacenan únicamente en el dispositivo del usuario.
        </p>
      </div>

    </div>
  )
}
