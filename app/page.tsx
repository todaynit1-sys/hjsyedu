import { Entry } from '../components/entry';
export default function Home() {
  return <Entry preview={process.env.LOCAL_PREVIEW === 'true' && !process.env.VERCEL} />;
}
