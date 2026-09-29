import { useId, type SVGProps } from 'react'

// Flags are drawn inline rather than as emoji, which Windows shows as letters.
// Both fill a 3:2 box; the 2:1 Union Jack is cropped at the sides.

export function FlagGB(props: SVGProps<SVGSVGElement>) {
  const clip = useId()
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden {...props}>
      <clipPath id={clip}>
        <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
      </clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${clip})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  )
}

export function FlagFR(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 3 2" preserveAspectRatio="none" aria-hidden {...props}>
      <path d="M0 0h1v2H0z" fill="#002654" />
      <path d="M1 0h1v2H1z" fill="#fff" />
      <path d="M2 0h1v2H2z" fill="#CE1126" />
    </svg>
  )
}
