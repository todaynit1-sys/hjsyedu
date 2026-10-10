import { Info } from 'lucide-react';
import { ABOUT_URL } from '../lib/brand';

export function AboutLink() {
  return <a className="about-link" href={ABOUT_URL} target="_blank" rel="noopener noreferrer" aria-label="AI전략연구소 소개 (새 탭)" title="AI전략연구소 소개"><Info size={17} aria-hidden="true" /></a>;
}
