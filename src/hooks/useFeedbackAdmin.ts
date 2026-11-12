import { useQuery } from "@tanstack/react-query";
import { isFeedbackAdmin } from "@/lib/admin-inbox";

export function useFeedbackAdmin(userId: string) {
  return useQuery({
    queryKey: ["feedback-admin", userId],
    queryFn: () => isFeedbackAdmin(userId),
    staleTime: 0,
    gcTime: 0,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}
