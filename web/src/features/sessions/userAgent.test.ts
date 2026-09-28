import { describe, expect, it } from 'vitest'

import { describeUserAgent } from './userAgent'

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
      'Firefox on Linux',
      'desktop',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      'Edge on Windows',
      'desktop',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'Safari on macOS',
      'desktop',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari on iOS',
      'mobile',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
      'Chrome on Android',
      'mobile',
    ],
    ['curl/8.5.0', 'curl', 'desktop'],
    ['', 'Unknown device', 'unknown'],
    ['something odd', 'Unknown device', 'unknown'],
  ])('%s', (ua, label, device) => {
    expect(describeUserAgent(ua)).toEqual({ label, device })
  })
})
