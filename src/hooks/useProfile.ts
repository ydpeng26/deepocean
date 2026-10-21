import { useQuery } from "@tanstack/react-query";
import { getMyProfile, signedAvatarUrl } from "@/lib/profile";

export function useProfile(enabled = true) {
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: getMyProfile,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const avatarPath = profileQuery.data?.avatar_url ?? null;
  const avatarQuery = useQuery({
    queryKey: ["avatar-url", avatarPath],
    queryFn: () => signedAvatarUrl(avatarPath),
    enabled: !!avatarPath,
    staleTime: 55 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  return {
    profile: profileQuery.data ?? null,
    avatarUrl: avatarQuery.data ?? null,
    isPending: profileQuery.isPending,
    isError: profileQuery.isError,
    refetch: profileQuery.refetch,
  };
}
