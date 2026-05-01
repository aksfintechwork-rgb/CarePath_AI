import { useEffect, useRef } from "react";
import { queryClient } from "@/lib/queryClient";

export function useRealtime() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let mounted = true;

    function connect() {
      if (!mounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[ws] connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "invalidate" && Array.isArray(data.keys)) {
            data.keys.forEach((key: string) => {
              queryClient.invalidateQueries({
                predicate: (query) => {
                  const qk = query.queryKey;
                  if (!Array.isArray(qk) || qk.length === 0) return false;
                  const base = qk[0] as string;
                  return base === key || key.startsWith(base);
                },
                refetchType: "active",
              });
            });
          }
        } catch {}
      };

      ws.onclose = () => {
        if (mounted) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      mounted = false;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);
}
