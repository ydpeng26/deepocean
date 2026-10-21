import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listOfflineDives, syncOfflineDives } from "@/lib/offline-dives";

export function OfflineSyncBanner({ dark = false }: { dark?: boolean }) {
  const queryClient = useQueryClient();
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const working = useRef(false);

  useEffect(() => {
    listOfflineDives()
      .then((drafts) => setCount(drafts.length))
      .catch(() => undefined);
  }, []);

  if (!count) return null;

  async function handleSync() {
    if (working.current) return;
    working.current = true;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        toast.error("请先登录，再同步离线记录");
        return;
      }
      const account = data.user.email ?? "当前账号";
      if (
        !window.confirm(
          `将这台设备上的 ${count} 条离线记录同步到 ${account} 吗？请确认这是你的账号。`,
        )
      )
        return;
      setSyncing(true);
      setProgress(0);
      try {
        const result = await syncOfflineDives((done) => setProgress(done), {
          expectedUserId: data.user.id,
        });
        setCount((await listOfflineDives()).length);
        await queryClient.invalidateQueries({ queryKey: ["dives"] });
        if (result.synced) toast.success(`已同步 ${result.synced} 条潜水记录`);
        if (result.failures.length)
          toast.error(
            `${result.failures.length} 条记录未同步，仍保存在此设备。${result.failures[0]}`,
          );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "同步失败；记录仍保存在此设备");
      } finally {
        setSyncing(false);
      }
    } catch {
      toast.error("无法核对登录状态，请检查网络后重试；记录仍保存在此设备");
    } finally {
      working.current = false;
    }
  }

  return (
    <aside
      className={`mb-8 flex flex-wrap items-center gap-4 border border-sky-500/35 bg-sky-500/10 px-5 py-4 ${dark ? "rounded-lg" : ""}`}
      aria-label="离线记录待同步"
    >
      <CloudUpload className="h-6 w-6 text-sky-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${dark ? "text-white" : "text-foreground"}`}>
          这台设备有 {count} 条未同步的潜水记录
        </p>
        <p className={`mt-1 text-xs ${dark ? "text-sky-100/70" : "text-muted-foreground"}`}>
          记录目前只保存在此设备；确认账号后才能上传。
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/offline" className="text-xs text-sky-400 hover:underline">
          查看记录
        </Link>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {syncing ? `同步中 ${progress}/${count}` : "同步到我的账号"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
