'use client';
import { Check, ChevronDown, Coffee, Meh, Plus, RotateCcw, Smile, Sparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PublicPoll } from '../lib/types';
export function PollCard({ poll, host, active, busy, onAction }: { poll: PublicPoll; host: boolean; active: boolean; busy: boolean; onAction: (input: Record<string, unknown>, success: string) => Promise<void> }) {
  const Icon = poll.kind === 'mood' ? Smile : poll.kind === 'break' ? Coffee : Sparkles;
  const choices = [Smile, Meh, Coffee];
  return <section className={`poll-card poll-${poll.kind}`} aria-labelledby={`poll-${poll.id}`}>
    <div className="poll-top"><span className="poll-kind"><Icon size={17} />{poll.kind === 'mood' ? '오늘의 컨디션' : poll.kind === 'break' ? '쉬어가는 시간' : '한 번 물어볼게요'}</span><span className={`poll-live ${!poll.open || !active ? 'closed' : ''}`}><span />{poll.open && active ? '응답 중' : '마감'}</span></div>
    <h2 id={`poll-${poll.id}`}>{poll.question}</h2>
    {poll.kind === 'break' && <p className="poll-description">잠깐의 쉼이 필요하면 알려주세요.</p>}
    {!host && <div className={`poll-choices ${poll.kind === 'mood' ? 'mood-choices' : ''}`}>
      {poll.options.map((option, i) => { const ChoiceIcon = choices[i % choices.length]; return <button key={i} className={`vote-option ${poll.myVote === i ? 'selected' : ''}`} disabled={!active || !poll.open || busy} aria-pressed={poll.myVote === i} onClick={() => onAction({ type: 'vote', pollId: poll.id, option: i }, `${poll.question} — ${option}로 응답했어요.`)}>{poll.kind === 'mood' ? <ChoiceIcon size={25} /> : poll.kind === 'break' ? <Coffee size={19} /> : null}<span>{option}</span>{poll.myVote === i && <Check className="vote-check" size={15} />}</button>; })}
    </div>}
    <div className="poll-results" aria-label="응답 결과">{poll.options.map((option, i) => { const percentage = poll.total ? Math.round(poll.counts[i] / poll.total * 100) : 0; return <div className={`result-row result-${i}`} key={i}><div className="result-caption"><span>{option}</span><span><strong>{poll.counts[i]}<small>명</small></strong><span className="percentage">{percentage}%</span></span></div><div className="result-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div></div>; })}</div>
    <div className="poll-footer"><span><b>{poll.total}</b>명 응답{poll.total === 0 ? ' · 첫 반응을 기다려요' : ''}</span>{!host && poll.myVote !== null && <span className="answered"><Check size={13} />응답 완료</span>}</div>
    {host && active && <div className="poll-tools"><button disabled={busy} onClick={() => onAction({ type: 'poll-toggle', id: poll.id }, `${poll.question} 투표를 ${poll.open ? '마감' : '재개'}했어요.`)}>{poll.open ? '응답 마감' : '응답 다시 받기'}</button><button disabled={busy} onClick={() => onAction({ type: 'poll-reset', id: poll.id }, `${poll.question} 새 투표를 시작했어요. 이전 결과는 기록에 남아요.`)}><RotateCcw size={14} />다시 물어보기</button></div>}
  </section>;
}
export function NewPoll({ busy, onAction }: { busy: boolean; onAction: (input: Record<string, unknown>, success: string) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [question, setQuestion] = useState(''); const [options, setOptions] = useState(''); const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null); const optionsRef = useRef<HTMLTextAreaElement>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError('');
    const values = options.split('\n').map(o => o.trim()).filter(Boolean);
    if (!question.trim()) { setError('질문을 입력해주세요.'); inputRef.current?.focus(); return; }
    if (values.length < 2 || values.length > 5 || new Set(values).size !== values.length) { setError('중복되지 않는 응답 항목을 2~5개 입력해주세요.'); optionsRef.current?.focus(); return; }
    try { await onAction({ type: 'poll-create', question, options: values }, `${question} 투표를 만들었어요.`); setOpen(false); setQuestion(''); setOptions(''); }
    catch { /* the room status reports server errors */ }
  }
  return <section className="new-poll"><button className="new-poll-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="new-poll-form"><Plus size={18} />새 질문 만들기{open ? <X size={16} /> : <ChevronDown size={16} />}</button>{open && <form id="new-poll-form" onSubmit={submit}><label htmlFor="poll-question">질문</label><input id="poll-question" ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)} maxLength={100} aria-describedby={error ? 'poll-error' : undefined} /><label htmlFor="poll-options">응답 항목</label><textarea id="poll-options" ref={optionsRef} value={options} onChange={e => setOptions(e.target.value)} placeholder={'한 줄에 하나씩\n예: 이해했어요\n한 번 더 설명해주세요'} rows={3} aria-describedby={`poll-options-hint${error ? ' poll-error' : ''}`} /><p className="hint" id="poll-options-hint">한 줄에 하나씩, 2~5개를 입력해주세요.</p>{error && <p role="alert" id="poll-error" className="error">{error}</p>}<button className="primary" disabled={busy}>질문 올리기 <Plus size={16} /></button></form>}</section>;
}
