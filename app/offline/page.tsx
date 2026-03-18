export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <p className="text-4xl">📶</p>
      <h1 className="text-xl font-bold">오프라인 상태입니다</h1>
      <p className="text-sm text-muted-foreground">인터넷 연결을 확인하고 다시 시도해주세요.</p>
    </div>
  );
}
