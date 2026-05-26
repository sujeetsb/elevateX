import { UserAuthPage } from '@/views/UserAuthPage';

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { loggedOut?: string };
}) {
  return (
    <UserAuthPage
      mode="login"
      alternateHref="/sign-up"
      alternateLabel="New here?"
      loggedOut={searchParams?.loggedOut === '1'}
    />
  );
}
