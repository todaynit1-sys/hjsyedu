import type { Metadata } from 'next';
import './globals.css';
import './live-room.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3010')),
  title: { default: 'HJSY AI edu — 실시간 강의실', template: '%s | HJSY AI edu' },
  description: '채팅과 링크 공유, 컨디션과 휴식 투표를 한 화면에서. 로그인 없이 함께하는 AI 수업.',
  openGraph: { title: 'HJSY AI edu', description: '채팅과 투표로 함께하는 AI 수업', images: [{ url: '/branding/hjsy-thumbnail.png', width: 1672, height: 941, alt: 'HJSY AI edu · LIVE CHAT · LIVE POLLS' }] },
  twitter: { card: 'summary_large_image', images: ['/branding/hjsy-thumbnail.png'] },
  robots: { index: false, follow: false }
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
