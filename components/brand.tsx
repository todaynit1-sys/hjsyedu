import Link from 'next/link';
export function Brand() {
  return <Link href="/" className="brand" aria-label="틈 홈"><span className="brand-symbol" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M5 6h22v16H14l-7 5v-5H5z" fill="currentColor"/><path d="M10 12h12M10 16h8" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round"/></svg></span><span className="brand-name">틈<span className="brand-en">teum</span></span></Link>;
}
