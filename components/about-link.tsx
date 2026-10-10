import { ABOUT_URL, BRAND_MARK } from '../lib/brand';

export function AboutLink() {
  return <a className="about-link" href={ABOUT_URL} target="_blank" rel="noopener noreferrer" aria-label="AI전략연구소 소개 (새 탭)" title="AI전략연구소 소개"><img src={BRAND_MARK} width={24} height={24} alt="" /></a>;
}
