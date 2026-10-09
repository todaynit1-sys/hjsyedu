import { RoomView } from '../../../components/room-view';
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  return <RoomView code={(await params).code.toUpperCase()} host={false} />;
}
