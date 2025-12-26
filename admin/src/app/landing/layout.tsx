export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Landing page has its own navigation, no sidebar needed
  return <>{children}</>;
}
