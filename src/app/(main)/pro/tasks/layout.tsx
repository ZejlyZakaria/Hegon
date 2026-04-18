export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden max-w-8xl mx-auto">{children}</div>
  );
}
