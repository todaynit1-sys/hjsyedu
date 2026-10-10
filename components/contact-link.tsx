import { Mail } from 'lucide-react';

export function ContactLink() {
  return <a className="contact-link" href="mailto:todaynit1@gmail.com" aria-label="문의 메일 보내기: todaynit1@gmail.com" title="todaynit1@gmail.com"><Mail size={13} aria-hidden="true" /><span>문의</span></a>;
}
