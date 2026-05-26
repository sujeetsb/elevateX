import { UserAuthPage } from '@/views/UserAuthPage';

export default function SignUpPage() {
  return <UserAuthPage mode="signup" alternateHref="/sign-in" alternateLabel="Already have an account?" />;
}
