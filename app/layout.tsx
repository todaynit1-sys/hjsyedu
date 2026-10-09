import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: '틈 — 함께하는 강의실', template: '%s | 틈' },
  description: '강의 소식과 링크를 함께 보고, 지금의 컨디션과 쉬는 시간을 알려주세요.',
  robots: { index: false, follow: false }
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
