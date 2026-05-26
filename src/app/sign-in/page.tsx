import { UserAuthPage } from '@/views/UserAuthPage';

export default function SignInPage() {
  return <UserAuthPage mode="login" alternateHref="/sign-up" alternateLabel="New here?" />;
}
