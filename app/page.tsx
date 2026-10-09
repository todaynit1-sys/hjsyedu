import { RoomView } from '../components/room-view';
import { MAIN_ROOM_CODE } from '../lib/types';
export default function Home() {
  return <RoomView code={MAIN_ROOM_CODE} host={false} />;
}
