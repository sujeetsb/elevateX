import { AdminLoginPage } from '@/views/AdminLogin';

export default function Page({
  searchParams,
}: {
  searchParams?: { loggedOut?: string };
}) {
  return <AdminLoginPage loggedOut={searchParams?.loggedOut === '1'} />;
}
