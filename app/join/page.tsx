import { Entry } from '../../components/entry';
export default function Join() {
  return <Entry preview={process.env.LOCAL_PREVIEW === 'true' && !process.env.VERCEL} />;
}
