import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local')) {
  console.log('.env.local이 이미 있습니다. 기존 설정을 유지합니다.');
} else {
  const password = randomBytes(12).toString('base64url');
  writeFileSync('.env.local', `LOCAL_PREVIEW=true\nHOST_PASSWORD=${password}\nSESSION_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });
  mkdirSync('.local', { recursive: true });
  writeFileSync('.local/host-password.txt', password, { mode: 0o600 });
  console.log('로컬 설정 완료. 강사 비밀번호는 .local/host-password.txt에서 확인하세요.');
}
