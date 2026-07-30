import { useQuery } from "@tanstack/react-query";
import { getMyProfile, signedAvatarUrl } from "@/lib/profile";

export function useProfile() {
  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: getMyProfile });
  const avatarPath = profileQuery.data?.avatar_url ?? null;
  const avatarQuery = useQuery({
    queryKey: ["avatar-url", avatarPath],
    queryFn: () => signedAvatarUrl(avatarPath),
    enabled: !!avatarPath,
  });
  return {
    profile: profileQuery.data ?? null,
    avatarUrl: avatarQuery.data ?? null,
    isPending: profileQuery.isPending,
  };
}
