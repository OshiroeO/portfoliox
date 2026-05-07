const LOGO_DOMAINS = {
  TSM: 'tsmc.com',
  MSFT: 'microsoft.com',
  NVDA: 'nvidia.com',
  GOOGL: 'google.com',
  VOO: 'vanguard.com',
  CRWD: 'crowdstrike.com',
  FTNT: 'fortinet.com',
  PLTR: 'palantir.com',
  RKLB: 'rocketlabusa.com',
}

export function stockLogoDomain(ticker) {
  return LOGO_DOMAINS[String(ticker || '').toUpperCase()] || ''
}

export function stockLogoSources(ticker) {
  const t = String(ticker || '').toUpperCase()
  const domain = stockLogoDomain(t)
  const sources = [`https://assets.parqet.com/logos/symbol/${t}`]
  if (domain) {
    sources.push(`https://api.companyenrich.com/logo/${domain}`)
    sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`)
  }
  return sources
}

export function stockInitials(ticker = '') {
  return String(ticker || '').slice(0, 2).toUpperCase()
}
