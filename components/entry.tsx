'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Coffee, Link2, MessageSquare, Smile } from 'lucide-react';
import { Brand } from './brand';
import { api } from '../lib/client';
export function Entry({ preview }: { preview: boolean }) {
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  async function enter(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (!/^[A-Z0-9]{6}$/.test(code)) { setError('강사에게 받은 6자리 참여 코드를 입력해주세요.'); inputRef.current?.focus(); return; }
    setBusy(true);
    try { await api(`/api/rooms/${code}`, { type: 'join' }); window.location.assign(`/room/${code}`); }
    catch (e) { setError((e as Error).message); inputRef.current?.focus(); setBusy(false); }
  }
  return <div className="entry-page">
    <a className="skip-link" href="#main">본문으로 건너뛰기</a>
    <header className="entry-header"><Brand /><Link className="host-entry" href="/host">강사로 시작하기 <ArrowUpRight size={17} /></Link></header>
    <main id="main" className="entry-main">
      <section className="entry-copy"><span className="eyebrow"><span className="little-line" /> 오늘도, 함께 배우는 시간</span><h1>같은 수업,<br />더 가까이.</h1><p className="entry-description">강의 링크는 놓치지 않고.<br />지금 내 컨디션은 가볍게 전하고.</p>
        <form onSubmit={enter} className="entry-form"><label htmlFor="room-code">강의실 참여 코드</label><div className="entry-field"><input id="room-code" ref={inputRef} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} maxLength={6} placeholder="6자리 코드 입력" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={Boolean(error)} aria-describedby={error ? 'entry-error' : 'entry-hint'} /><button className="primary" disabled={busy} type="submit">{busy ? '참여 중' : '참여하기'}<ArrowRight size={18} /></button></div><p id="entry-hint" className="hint">로그인 없이 참여할 수 있어요.</p>{error && <p id="entry-error" role="alert" className="error">{error}</p>}</form>
        {preview && <Link className="demo-link" href="/room/DEMO26">강의실 미리 둘러보기 <ArrowUpRight size={16} /></Link>}
      </section>
      <section className="entry-art" aria-label="강의 소식과 컨디션 응답 미리보기"><div className="art-grid" aria-hidden="true" /><span className="art-kicker">A LITTLE SPACE TO CONNECT</span><div className="art-note"><span className="art-note-icon"><MessageSquare size={25} /></span><span>선생님이 보낸 소식</span><strong>반가워요.<br />오늘도 같이 해볼까요?</strong><span className="art-note-foot"><span className="tiny-avatar">강</span> 강사 · 강의 소식</span></div><div className="art-link"><Link2 size={20} /><div><strong>오늘의 강의 자료</strong><span>링크 하나로, 모두에게</span></div><ArrowUpRight size={22} /></div><div className="art-poll"><span className="art-poll-label">지금 컨디션 어때요?</span><div className="art-poll-answers"><span><Smile size={24} />좋아요<Check className="art-check" size={15} /></span><span><Coffee size={24} />잠깐 쉬고 싶어요</span></div></div><svg className="art-orbit" viewBox="0 0 120 120" aria-hidden="true"><path d="M10 70C20 10 110 10 110 70S20 130 10 70" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M60 10v100M10 70h100" stroke="currentColor" strokeWidth="1"/></svg><p className="art-caption">작은 반응이 모여, 더 좋은 수업이 됩니다.</p></section>
    </main><footer className="entry-footer"><span>틈 · 함께하는 강의실</span><span>소식과 링크, 그리고 오늘의 우리.</span></footer>
  </div>;
}
