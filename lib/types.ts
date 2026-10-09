export type PollKind = 'mood' | 'break' | 'custom';
export type Message = { id: string; text: string; url: string | null; createdAt: string; pinned: boolean };
export type Poll = { id: string; question: string; options: string[]; kind: PollKind; open: boolean; archived: boolean; votes: Record<string, number> };
export type Day = { date: string; active: boolean; messages: Message[]; polls: Poll[]; presence: Record<string, number> };
export type Room = { code: string; title: string; createdAt: string; demo: boolean; days: Record<string, Day> };
export type PublicPoll = Omit<Poll, 'votes'> & { counts: number[]; total: number; myVote: number | null };
export type Snapshot = {
  code: string; title: string; demo: boolean; date: string; today: string;
  active: boolean; online: number; dates: string[]; messages: Message[];
  polls: PublicPoll[]; mode: 'local' | 'cloud'; updatedAt: string;
};
