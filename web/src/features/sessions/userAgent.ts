export type Device = 'mobile' | 'desktop' | 'unknown'

/** A readable name for the client behind a user agent, e.g. "Firefox on Linux". */
export function describeUserAgent(ua: string): { label: string; device: Device } {
  if (!ua) return { label: 'Unknown device', device: 'unknown' }
  const browser = matchFirst(ua, [
    [/Edg(A|iOS)?\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/Firefox\/|FxiOS\//, 'Firefox'],
    [/Chrome\/|CriOS\//, 'Chrome'],
    [/Version\/[\d.]+.*Safari\//, 'Safari'],
    [/^curl\//, 'curl'],
  ])
  const os = matchFirst(ua, [
    [/Windows/, 'Windows'],
    [/Android/, 'Android'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/CrOS/, 'ChromeOS'],
    [/Linux/, 'Linux'],
  ])
  const device: Device = /Mobi|Android|iPhone|iPod/.test(ua) ? 'mobile' : browser || os ? 'desktop' : 'unknown'
  const label = browser && os ? `${browser} on ${os}` : browser || os || 'Unknown device'
  return { label, device }
}

function matchFirst(ua: string, rules: [RegExp, string][]): string | null {
  return rules.find(([re]) => re.test(ua))?.[1] ?? null
}
