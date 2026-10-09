import Link from 'next/link';
import Image from 'next/image';
export function Brand() {
  return <Link href="/" className="brand" aria-label="현준선영 HJSY AI edu 홈"><Image className="brand-mark" src="/branding/hj-sy-characters.png" width={48} height={48} sizes="48px" alt="HJ 곰과 SY 토끼 로고" /><span className="brand-wordmark">HJSY <span>AI <em>edu</em></span><small>현준선영의 AI 교실</small></span></Link>;
}
